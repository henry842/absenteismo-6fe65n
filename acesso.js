// Acesso da conta: segundo passo do supervisor (código do celular) e troca de senha.
// Tudo o que vem do servidor entra na tela por textContent. Este arquivo só cuida da tela e chama o Supabase;
// as regras (o que é senha fraca, quando pedir o código) ficam em lideres.js, onde são testadas.
(function () {
  'use strict';
  const D = window.Lideres;
  const $ = s => document.querySelector(s);
  let supa = null;
  let ctx = { aviso() {}, sair: async () => {} };
  const usar = (cliente, contexto) => { supa = cliente; if (contexto) ctx = Object.assign({}, ctx, contexto); };
  const ehRede = e => /fetch|network|offline|failed to/i.test(String((e && e.message) || e || ''));

  function mensagem(el, texto, nivel) {
    el.className = 'caixa-aviso msg-login ' + (nivel || 'vermelho');
    el.textContent = texto || '';
  }

  async function fatores() {
    const { data, error } = await supa.auth.mfa.listFactors();
    if (error) throw error;
    const todos = (data && data.all) || [];
    const verificados = todos.filter(f => f.status === 'verified' && f.factor_type === 'totp');
    return { verificados, todos };
  }

  // ---------- Tela do código ----------
  let esperando = null;   // { modo: 'cadastrar' | 'codigo' | 'adicionar', factorId, resolve }
  const telaMfa = () => $('#telaMfa');

  function abrirTelaMfa(modo, factorId, qr, chave) {
    const cadastro = modo !== 'codigo';
    $('#mfaTitulo').textContent = modo === 'codigo' ? 'Digite o código' : modo === 'adicionar' ? 'Adicionar outro celular' : 'Ative a verificação em dois passos';
    $('#mfaSub').textContent = modo === 'codigo'
      ? 'Abra o aplicativo de códigos no celular e digite o código de 6 números que aparece para o Absenteísmo.'
      : 'Depois da senha, o sistema passa a pedir um código do seu celular. Assim, quem descobrir a sua senha não consegue entrar.';
    $('#mfaCadastro').hidden = !cadastro;
    const img = $('#mfaQr'), semQr = $('#mfaSemQr');
    if (cadastro) {
      img.hidden = !qr; semQr.hidden = !!qr;
      if (qr) img.src = qr; else img.removeAttribute('src');
      $('#mfaChave').textContent = chave || 'indisponível';
    }
    $('#lnkMfaSair').textContent = modo === 'adicionar' ? 'Cancelar' : 'Sair desta conta';
    mensagem($('#msgMfa'), '');
    $('#mfaCodigo').value = '';
    telaMfa().hidden = false;
    telaMfa().scrollTop = 0;
    if (!cadastro) setTimeout(() => $('#mfaCodigo').focus(), 50);   // no cadastro o quadro tem que aparecer primeiro
    return new Promise(resolve => { esperando = { modo, factorId, resolve }; });
  }
  function fecharTelaMfa(ok) {
    const e = esperando; esperando = null;
    telaMfa().hidden = true; $('#mfaCodigo').value = ''; $('#mfaQr').removeAttribute('src');
    if (e) e.resolve(ok);
  }
  function erroDoCodigo(e) {
    const t = String((e && (e.code || e.message)) || e || '');
    if (/rate|too many|over_request/i.test(t)) return 'Muitas tentativas. Espere um minuto e tente de novo.';
    if (ehRede(e)) return 'Sem internet. Conecte-se e tente de novo.';
    if (/verification|invalid|totp|code/i.test(t)) return 'Código errado ou vencido. Digite o código que está aparecendo agora no aplicativo.';
    return 'Não consegui confirmar o código. Tente de novo.';
  }

  $('#formMfa').addEventListener('submit', async ev => {
    ev.preventDefault();
    if (!esperando) return;
    const codigo = D.limparCodigo($('#mfaCodigo').value);
    if (!D.codigoValido(codigo)) return mensagem($('#msgMfa'), 'O código tem 6 números.');
    mensagem($('#msgMfa'), '');
    const botao = $('#btnMfa'); botao.disabled = true;
    try {
      const { error } = await supa.auth.mfa.challengeAndVerify({ factorId: esperando.factorId, code: codigo });
      if (error) throw error;
      const foiCadastro = esperando.modo !== 'codigo';
      fecharTelaMfa(true);
      if (foiCadastro) ctx.aviso('Verificação em dois passos ativada.');
    } catch (err) {
      mensagem($('#msgMfa'), erroDoCodigo(err));
      $('#mfaCodigo').select();
    } finally { botao.disabled = false; }
  });
  $('#lnkMfaSair').addEventListener('click', async () => {
    if (!esperando) return;
    if (esperando.modo === 'adicionar') {
      try { await supa.auth.mfa.unenroll({ factorId: esperando.factorId }); } catch (e) { /* fica um cadastro pela metade; é apagado na próxima vez */ }
      fecharTelaMfa(false);
      return;
    }
    fecharTelaMfa(false);
    await ctx.sair();
  });

  async function novoFator(modo) {
    const nome = `Celular ${new Date().toISOString().slice(0, 10)} ${Math.random().toString(36).slice(2, 6)}`;
    const { data, error } = await supa.auth.mfa.enroll({ factorType: 'totp', friendlyName: nome, issuer: 'Absenteísmo dos times' });
    if (error || !data || !data.totp) { ctx.aviso('Não consegui preparar o segundo passo. Tente de novo.'); return null; }
    return abrirTelaMfa(modo, data.id, D.imagemDoQr(data.totp.qr_code), D.formatarChave(data.totp.secret));
  }

  // Depois de entrar como supervisor: cadastra o celular (1ª vez) ou pede o código. Devolve true | 'saiu' | 'falhou'.
  async function garantir(cliente, contexto) {
    usar(cliente, contexto);
    const semConfirmar = e => {
      ctx.aviso(ehRede(e) ? 'Sem internet: para entrar como supervisor é preciso confirmar o código.' : 'Não consegui verificar a segurança da conta. Tente de novo.');
      return 'falhou';
    };
    let nivel;
    try {
      const r = await supa.auth.mfa.getAuthenticatorAssuranceLevel();
      if (r.error) throw r.error;
      nivel = r.data.currentLevel;
    } catch (e) { return semConfirmar(e); }
    if (nivel === 'aal2') return true;          // já passou pelo código nesta sessão (vale também sem internet)
    let f;
    try { f = await fatores(); } catch (e) { return semConfirmar(e); }
    const passo = D.decidirSegundoPasso('supervisor', f.verificados.length, nivel);
    if (passo === 'ok') return true;
    let ok;
    if (passo === 'codigo') ok = await abrirTelaMfa('codigo', f.verificados[0].id);
    else {
      for (const x of f.todos.filter(y => y.status !== 'verified')) { try { await supa.auth.mfa.unenroll({ factorId: x.id }); } catch (e) { /* ok */ } }
      ok = await novoFator('cadastrar');
      if (ok === null) return 'falhou';
    }
    return ok ? true : 'saiu';
  }

  // Antes de trocar a senha pelo link do e-mail: se a conta tem celular cadastrado, confirma o código primeiro
  async function elevar(cliente, contexto) {
    usar(cliente, contexto);
    let f;
    try {
      const r = await supa.auth.mfa.getAuthenticatorAssuranceLevel();
      if (r.error) throw r.error;
      if (r.data.currentLevel === 'aal2') return true;
      f = await fatores();
    } catch (e) { return true; }               // sem sessão ou sem internet: quem decide é o servidor
    if (!f.verificados.length) return true;
    return !!(await abrirTelaMfa('codigo', f.verificados[0].id));
  }

  // ---------- Cartão em Ajustes (supervisor) ----------
  async function desenharCartao(cliente, contexto) {
    usar(cliente, contexto);
    const lista = $('#mfaLista'), quem = $('#mfaEquipe');
    if (!lista) return;
    lista.textContent = 'Consultando…'; quem.textContent = '';
    let f;
    try { f = await fatores(); } catch (e) { lista.textContent = 'Não consegui consultar agora. Confira a internet.'; return; }
    lista.textContent = '';
    if (!f.verificados.length) {
      const p = document.createElement('p'); p.className = 'suave'; p.textContent = 'Ainda não ativada neste login.'; lista.append(p);
    }
    f.verificados.forEach(fa => {
      const linha = document.createElement('div'); linha.className = 'linha-mfa';
      const nome = document.createElement('span');
      const quando = fa.created_at ? new Date(fa.created_at) : null;
      nome.textContent = 'Celular com aplicativo de códigos' + (quando && !isNaN(quando) ? ` · ativado em ${quando.toLocaleDateString('pt-BR')}` : '');
      linha.append(nome);
      const b = document.createElement('button');
      b.className = 'botao neutro p'; b.type = 'button'; b.dataset.mfaRemover = fa.id; b.textContent = 'Remover';
      b.disabled = f.verificados.length < 2; b.title = b.disabled ? 'Adicione outro celular antes de remover este.' : '';
      linha.append(b);
      lista.append(linha);
    });
    try {
      const { data, error } = await supa.rpc('supervisores_sem_mfa');
      if (!error && Array.isArray(data)) quem.textContent = data.length ? `Ainda sem verificação em dois passos: ${data.map(x => x.usuario).join(', ')}.` : 'Os supervisores já ativaram a verificação em dois passos.';
    } catch (e) { /* aviso é só informação */ }
  }
  $('#mfaLista').addEventListener('click', async e => {
    const b = e.target.closest('[data-mfa-remover]'); if (!b || b.disabled || !supa) return;
    if (!confirm('Remover este celular? Confirme que o outro celular está funcionando antes.')) return;
    b.disabled = true;
    try {
      const { error } = await supa.auth.mfa.unenroll({ factorId: b.dataset.mfaRemover });
      if (error) throw error;
      ctx.aviso('Celular removido.');
    } catch (err) { ctx.aviso('Não consegui remover agora. Tente de novo.'); }
    desenharCartao(supa);
  });
  $('#btnMfaAdicionar').addEventListener('click', async () => {
    if (!supa) return;
    const ok = await novoFator('adicionar');
    if (ok) desenharCartao(supa);
  });

  // ---------- Troca de senha ----------
  let senhaEsp = null;   // { resolve, usuario, obrigatoria }
  function erroDaSenha(e) {
    const t = String((e && (e.code || e.message)) || e || '');
    if (/same_password|different from the old/i.test(t)) return 'Escolha uma senha diferente da atual.';
    if (/weak_password|password should be|weak/i.test(t)) return 'O sistema recusou essa senha por ser fraca. Escolha outra.';
    if (/aal2|mfa/i.test(t)) return 'Confirme primeiro o código do segundo passo (saia e entre de novo).';
    if (ehRede(e)) return 'Sem internet. Conecte-se e tente de novo.';
    return 'Não consegui trocar a senha. Tente de novo.';
  }
  function trocarSenha(cliente, opcoes) {
    usar(cliente, opcoes && opcoes.contexto);
    const o = opcoes || {};
    $('#senhaTitulo').textContent = o.obrigatoria ? 'Crie a sua senha' : 'Trocar minha senha';
    $('#senhaSub').textContent = o.obrigatoria
      ? 'A senha que o supervisor gerou é provisória. Escolha uma só sua: só você vai saber qual é.'
      : 'Escolha uma senha nova, que só você saiba.';
    $('#lnkSenhaDepois').textContent = o.obrigatoria ? 'Sair desta conta' : 'Agora não';
    $('#senhaDica').textContent = `Pelo menos ${D.SENHA_MINIMA} caracteres, misturando letras e números (ou uma frase longa).`;
    $('#senhaNova').value = ''; $('#senhaNova2').value = '';
    mensagem($('#msgSenha'), '');
    $('#telaSenha').hidden = false;
    setTimeout(() => $('#senhaNova').focus(), 50);
    return new Promise(resolve => { senhaEsp = { resolve, usuario: o.usuario || '', obrigatoria: !!o.obrigatoria }; });
  }
  function fecharTelaSenha(ok) {
    const e = senhaEsp; senhaEsp = null;
    $('#telaSenha').hidden = true; $('#senhaNova').value = ''; $('#senhaNova2').value = '';
    if (e) e.resolve(ok);
  }
  $('#formSenha').addEventListener('submit', async ev => {
    ev.preventDefault();
    if (!senhaEsp) return;
    const a = $('#senhaNova').value, b = $('#senhaNova2').value;
    if (a !== b) return mensagem($('#msgSenha'), 'As duas senhas estão diferentes.');
    const fraca = D.senhaFraca(a, senhaEsp.usuario);
    if (fraca) return mensagem($('#msgSenha'), fraca);
    mensagem($('#msgSenha'), '');
    const botao = $('#btnSenha'); botao.disabled = true;
    try {
      const { error } = await supa.auth.updateUser({ password: a, data: { trocar_senha: false } });
      if (error) throw error;
      fecharTelaSenha(true);
      ctx.aviso('Senha trocada.');
    } catch (err) { mensagem($('#msgSenha'), erroDaSenha(err)); }
    finally { botao.disabled = false; }
  });
  $('#lnkSenhaDepois').addEventListener('click', async () => {
    if (!senhaEsp) return;
    const obrigatoria = senhaEsp.obrigatoria;
    fecharTelaSenha(false);
    if (obrigatoria) await ctx.sair();      // sem senha própria não entra: sair é a única saída
  });

  window.Acesso = { garantir, elevar, desenharCartao, trocarSenha };
})();
