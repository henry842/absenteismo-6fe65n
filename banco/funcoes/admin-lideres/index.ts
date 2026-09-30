// Gerencia os logins dos líderes. Só supervisor ativo (e, se tiver celular cadastrado, com o código confirmado) pode chamar.
// Ações: criar, redefinir (nova senha), desativar, reativar.
// Cada ação fica na auditoria com o supervisor que fez (a senha nunca vai para a auditoria nem para o log).
// Versão 6: exige o código do segundo passo de quem tem celular cadastrado, marca a senha gerada como provisória,
// derruba as sessões abertas ao redefinir/desativar e fixa a versão da biblioteca.
import { createClient } from 'npm:@supabase/supabase-js@2.57.4';   // versão fixa: nada muda sozinho

// Só o site do sistema (e o teste local) pode chamar esta função pelo navegador.
const ORIGENS = [/^https:\/\/henry842\.github\.io$/, /^https:\/\/absenteismo-times\.pages\.dev$/, /^http:\/\/localhost(:\d+)?$/, /^http:\/\/127\.0\.0\.1(:\d+)?$/];
const DOMINIO = 'lider.absenteismo.app';

function cors(req: Request) {
  const o = req.headers.get('Origin') || '';
  const ok = ORIGENS.some(r => r.test(o));
  return {
    'Access-Control-Allow-Origin': ok ? o : 'https://henry842.github.io',
    'Vary': 'Origin',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}

const resp = (req: Request, corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...cors(req), 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

// Erro interno: detalhe só no log do servidor; quem chamou recebe uma mensagem simples
function falha(req: Request, mensagem: string, detalhe: unknown, status = 400) {
  console.error(mensagem, detalhe instanceof Error ? detalhe.message : (detalhe as { message?: string })?.message || detalhe);
  return resp(req, { erro: mensagem }, status);
}

// 12 caracteres sem letras parecidas (0/O, 1/l/I)
function gerarSenha(): string {
  const letras = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const limite = 256 - (256 % letras.length); // evita viés no sorteio
  let saida = '';
  while (saida.length < 12) {
    const b = crypto.getRandomValues(new Uint8Array(24));
    for (const x of b) { if (x < limite && saida.length < 12) saida += letras[x % letras.length]; }
  }
  return saida;
}

// Nível da sessão (aal1 = só senha, aal2 = senha + código). Só é lido depois de o Supabase ter validado o token.
function nivelDoToken(token: string): string {
  try {
    const parte = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return String(JSON.parse(atob(parte)).aal || 'aal1');
  } catch { return 'aal1'; }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(req) });
  if (req.method !== 'POST') return resp(req, { erro: 'Método inválido' }, 405);

  const url = Deno.env.get('SUPABASE_URL')!;
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });

  // Quem está chamando?
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  const { data: u, error: eu } = await admin.auth.getUser(token);
  if (eu || !u?.user) return resp(req, { erro: 'Não autenticado' }, 401);
  const { data: quem } = await admin.from('perfis').select('papel,ativo,usuario').eq('user_id', u.user.id).maybeSingle();
  if (!quem || quem.papel !== 'supervisor' || !quem.ativo) return resp(req, { erro: 'Só supervisor pode fazer isso' }, 403);
  // Supervisor com celular cadastrado precisa ter confirmado o código nesta sessão
  const temSegundoPasso = (u.user.factors || []).some((f: { status?: string }) => f.status === 'verified');
  if (temSegundoPasso && nivelDoToken(token) !== 'aal2') return resp(req, { erro: 'Confirme o código do segundo passo.' }, 403);

  // Trilha de auditoria: quem (supervisor), o quê, em qual login. Nunca a senha.
  const supervisorId = u.user.id, supervisor = quem.usuario;
  const auditar = async (acao: 'INSERT' | 'UPDATE', operacao: string, alvo: string, time: string | null) => {
    const { error } = await admin.from('auditoria').insert({
      user_id: supervisorId, usuario: supervisor, acao, tabela: 'logins_lideres', registro: alvo, time,
      depois: { operacao },
    });
    if (error) console.error('auditoria', error.message);
  };
  // Derruba as sessões abertas do login (o aparelho perdido deixa de renovar o acesso). Se a função do banco ainda não existir, só registra no log.
  const encerrarSessoes = async (userId: string) => {
    const { error } = await admin.rpc('encerrar_sessoes', { alvo: userId });
    if (error) console.error('encerrar_sessoes', error.message);
  };

  let p: any;
  try { p = await req.json(); } catch { return resp(req, { erro: 'Pedido inválido' }, 400); }

  if (p.acao === 'criar') {
    const usuario = String(p.usuario || '').trim().toLowerCase();
    const time = String(p.time || '').trim();
    const nome = String(p.nome || '').trim().slice(0, 120);
    if (!/^[a-z0-9._-]{2,40}$/.test(usuario)) return resp(req, { erro: 'Usuário: 2 a 40 letras minúsculas, números, ponto, traço ou sublinhado.' }, 400);
    if (!time || time.length > 60) return resp(req, { erro: 'Informe o time.' }, 400);
    const { data: porUsuario } = await admin.from('perfis').select('usuario').eq('usuario', usuario).limit(1);
    if (porUsuario && porUsuario.length) return resp(req, { erro: 'Esse usuário já existe.' }, 409);
    const { data: porTime } = await admin.from('perfis').select('usuario').eq('papel', 'lider').eq('ativo', true).eq('time', time).limit(1);
    if (porTime && porTime.length) return resp(req, { erro: `O time ${time} já tem um login ativo (${porTime[0].usuario}).` }, 409);
    const senha = gerarSenha();
    const email = `${usuario}@${DOMINIO}`;
    // O banco só aceita conta nova se houver convite (cadastro público fica bloqueado)
    const { error: ei } = await admin.from('convites').upsert({ email });
    if (ei) return falha(req, 'Não consegui preparar o convite.', ei);
    const { data: novo, error: ec } = await admin.auth.admin.createUser({
      email, password: senha, email_confirm: true, user_metadata: { papel: 'lider', time, trocar_senha: true },   // a senha gerada é provisória
    });
    await admin.from('convites').delete().eq('email', email);
    if (ec || !novo?.user) return falha(req, 'Não consegui criar o login.', ec);
    const { error: ep } = await admin.from('perfis').insert({ user_id: novo.user.id, papel: 'lider', usuario, nome, time });
    if (ep) { await admin.auth.admin.deleteUser(novo.user.id); return falha(req, 'Não consegui salvar o perfil.', ep); }
    await auditar('INSERT', 'criar', usuario, time);
    return resp(req, { ok: true, usuario, time, senha });
  }

  if (['redefinir', 'desativar', 'reativar'].includes(p.acao)) {
    const { data: alvo } = await admin.from('perfis').select('user_id,papel,usuario,time,ativo').eq('usuario', String(p.usuario || '')).maybeSingle();
    if (!alvo || alvo.papel !== 'lider') return resp(req, { erro: 'Líder não encontrado.' }, 404);
    if (p.acao === 'redefinir') {
      const senha = gerarSenha();
      const { error } = await admin.auth.admin.updateUserById(alvo.user_id, { password: senha, user_metadata: { trocar_senha: true } });
      if (error) return falha(req, 'Não consegui trocar a senha.', error);
      await encerrarSessoes(alvo.user_id);   // quem estava logado com a senha antiga sai
      await auditar('UPDATE', 'redefinir senha', alvo.usuario, alvo.time);
      return resp(req, { ok: true, usuario: alvo.usuario, time: alvo.time, senha });
    }
    if (p.acao === 'desativar') {
      await admin.from('perfis').update({ ativo: false }).eq('user_id', alvo.user_id);
      await admin.auth.admin.updateUserById(alvo.user_id, { ban_duration: '876000h' });
      await encerrarSessoes(alvo.user_id);
      await auditar('UPDATE', 'desativar', alvo.usuario, alvo.time);
      return resp(req, { ok: true });
    }
    const { error: er } = await admin.from('perfis').update({ ativo: true }).eq('user_id', alvo.user_id);
    if (er) return resp(req, { erro: 'Já existe outro login ativo para esse time.' }, 409);
    await admin.auth.admin.updateUserById(alvo.user_id, { ban_duration: 'none' });
    await auditar('UPDATE', 'reativar', alvo.usuario, alvo.time);
    return resp(req, { ok: true });
  }

  return resp(req, { erro: 'Ação desconhecida' }, 400);
});
