// Inicialização: preferências salvas, modo Líder/Implantador, destino dos arquivos e navegação.
(function () {
  'use strict';
  const { $, $$, esc, S, D } = UI;

  async function restaurarArmazenamento(prefs) {
    try {
      if (prefs.armazenamento === 'fsaccess') {
        const h = await UI.ler('fsHandle');
        if (h && h.queryPermission && (await h.queryPermission({ mode: 'readwrite' })) === 'granted') { UI.estado.storage = S.armazenamento.FileSystemAccessAdapter(h); return; }
        if (h) UI.banner(`A pasta "${esc(h.name)}" precisa de nova permissão do navegador. <button class="btn sm" id="reconectarPasta">Reconectar pasta</button>`, 'info');
        const b = $('#reconectarPasta');
        if (b) b.onclick = async () => { try { await UI.usarArmazenamento('fsaccess', { handle: h }); UI.banner(''); UI.toast('Pasta reconectada.'); UI.atualizar(); } catch (e) { UI.erro(e, 'Pasta'); } };
      } else if (prefs.armazenamento === 'bridge' && prefs.bridgeToken) {
        const b = S.armazenamento.LocalBridgeAdapter({ url: prefs.bridgeUrl, token: prefs.bridgeToken });
        await b.ping(); UI.estado.storage = b;
      } else if (prefs.armazenamento === 'memory') UI.estado.storage = S.armazenamento.MemoryAdapter();
    } catch (e) {
      UI.banner(`Não foi possível reconectar ao destino salvo (${esc(e.message)}). Usando Downloads do navegador.`, 'info');
    }
  }

  document.addEventListener('DOMContentLoaded', async () => {
    const prefs = (await UI.ler('prefs')) || {};
    UI.estado.prefs = prefs;
    UI.estado.raiz = prefs.raiz != null ? prefs.raiz : 'C3B';
    await UI.definirModo(prefs.modo || 'IMPLANTADOR');
    await restaurarArmazenamento(prefs);
    $$('.navBtn').forEach(b => b.addEventListener('click', () => UI.ir(b.dataset.view)));
    $('#perfilModo').addEventListener('click', async () => { await UI.definirModo(UI.estado.modo === 'LIDER' ? 'IMPLANTADOR' : 'LIDER'); UI.toast(UI.estado.modo === 'LIDER' ? 'Modo Líder: tela simplificada.' : 'Modo Implantador/Admin: regras e detalhes técnicos visíveis.'); UI.atualizar(); });
    $('#rodapeVersao').textContent = `${D.SYSTEM_VERSION} · schema ${D.SCHEMA_VERSION}`;
    UI.estado.tela = 'inicio';
    UI.telas.inicio.painel();
    document.body.dataset.pronto = '1';
  });

  window.addEventListener('error', e => UI.toast('Erro inesperado: ' + (e.message || e), true));
  window.addEventListener('unhandledrejection', e => UI.toast('Erro inesperado: ' + ((e.reason && e.reason.message) || e.reason), true));
})();
