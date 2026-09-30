// Acesso da conta: troca de senha (o líder cria a própria no primeiro acesso; "Trocar minha senha" vale para todos).
// Tudo o que vem do servidor entra na tela por textContent. A regra do que é senha fraca fica em lideres.js, onde é testada.
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

  // ---------- Troca de senha ----------
  let senhaEsp = null;   // { resolve, usuario, obrigatoria }
  function erroDaSenha(e) {
    const t = String((e && (e.code || e.message)) || e || '');
    if (/same_password|different from the old/i.test(t)) return 'Escolha uma senha diferente da atual.';
    if (/weak_password|password should be|weak/i.test(t)) return 'O sistema recusou essa senha por ser fraca. Escolha outra.';
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

  window.Acesso = { trocarSenha };
})();
