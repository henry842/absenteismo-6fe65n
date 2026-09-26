// Roda dentro da página antes do app (addInitScript): simula o Supabase, troca os diálogos nativos
// (confirm/alert/print) por avisos visíveis na gravação e cria as camadas do vídeo (legenda, cursor, destaque).
(() => {
  const USUARIO = { id: 'demo-lider', email: 'lider.demo@exemplo.com' };
  const logado = () => localStorage.getItem('demo.logado') === 'sim';
  const resposta = v => Promise.resolve(v);
  const consulta = () => {
    const q = { select: () => q, order: () => q, limit: () => q, gt: () => q,
      then: (ok, erro) => resposta({ data: [], error: null }).then(ok, erro) };
    return q;
  };
  const cliente = {
    auth: {
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      getSession: () => resposta({ data: { session: logado() ? { user: USUARIO } : null } }),
      signInWithPassword: () => { localStorage.setItem('demo.logado', 'sim'); return resposta({ data: { user: USUARIO, session: { user: USUARIO } }, error: null }); },
      signUp: () => resposta({ data: { user: USUARIO, session: null }, error: null }),
      signOut: () => { localStorage.removeItem('demo.logado'); return resposta({ error: null }); },
      resetPasswordForEmail: () => resposta({ error: null }),
      updateUser: () => resposta({ data: { user: USUARIO }, error: null }),
    },
    from: () => ({ ...consulta(), upsert: () => new Promise(r => setTimeout(() => r({ error: null }), 400)) }),
  };
  Object.defineProperty(window, 'supabase', { value: { createClient: () => cliente }, writable: false });

  // Excel: seletor de arquivo simulado (grava em lugar nenhum, mas o app segue o fluxo real).
  // O IndexedDB não guarda objetos com funções, então o arquivo simulado vira só o nome na hora de guardar.
  const putOriginal = IDBObjectStore.prototype.put;
  IDBObjectStore.prototype.put = function (valor, ...resto) {
    return putOriginal.call(this, valor && valor.__demo ? 'demo:' + valor.name : valor, ...resto);
  };
  window.showSaveFilePicker = async () => ({
    __demo: true, name: 'absenteismo.xlsx', kind: 'file',
    queryPermission: async () => 'granted', requestPermission: async () => 'granted',
    createWritable: async () => ({ write: async () => {}, close: async () => {} }),
  });

  // ---------- camadas do vídeo ----------
  const CSS = `
  #demo-leg{position:fixed;left:50%;bottom:26px;transform:translateX(-50%);z-index:2147483600;max-width:min(1100px,92vw);
    background:rgba(16,24,40,.92);color:#fff;border-left:5px solid #3b82f6;border-radius:12px;padding:12px 22px;
    font:600 clamp(15px,1.9vw,22px)/1.4 system-ui,'Segoe UI',Arial,'WenQuanYi Zen Hei',sans-serif;text-align:center;opacity:0;transition:opacity .3s,bottom .35s;pointer-events:none}
  #demo-leg.topo{bottom:auto;top:18px}
  #toast{bottom:110px!important}
  #demo-dest{position:fixed;z-index:2147483500;border:3px solid #3b82f6;border-radius:12px;pointer-events:none;opacity:0;
    box-shadow:0 0 0 4px #3b82f655,0 0 0 9999px rgba(10,20,40,.42);transition:all .5s cubic-bezier(.4,0,.2,1)}
  #demo-cur{position:fixed;z-index:2147483647;width:28px;height:28px;pointer-events:none;opacity:0;transition:left .7s cubic-bezier(.4,0,.2,1),top .7s cubic-bezier(.4,0,.2,1),opacity .3s}
  .demo-ond{position:fixed;z-index:2147483646;width:24px;height:24px;border-radius:50%;background:#3b82f6;pointer-events:none;animation:demoOnd .9s ease-out forwards}
  @keyframes demoOnd{0%{transform:scale(.4);opacity:.9}100%{transform:scale(3);opacity:0}}
  #demo-dlg{position:fixed;inset:0;z-index:2147483550;display:flex;align-items:center;justify-content:center;background:rgba(10,20,40,.45);opacity:0;pointer-events:none;transition:opacity .3s}
  #demo-dlg div{background:#fff;color:#101828;border-radius:14px;max-width:min(620px,90vw);padding:22px 26px;box-shadow:0 20px 60px #0005;
    font:15px/1.5 system-ui,'Segoe UI',Arial,sans-serif;white-space:pre-wrap}
  #demo-dlg b{display:block;margin-top:14px;text-align:right;color:#1a5fd6}
  #demo-tit{position:fixed;inset:0;z-index:2147483640;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;
    background:linear-gradient(135deg,#123a8a,#1a5fd6);color:#fff;font-family:system-ui,'Segoe UI',Arial,'WenQuanYi Zen Hei',sans-serif;opacity:0;pointer-events:none;transition:opacity .5s}
  #demo-tit small{font-size:clamp(14px,1.6vw,20px);opacity:.85;letter-spacing:1px;text-transform:uppercase}
  #demo-tit strong{font-size:clamp(26px,4vw,52px);letter-spacing:-1px;text-align:center;padding:0 20px}
  #demo-tit span{font-size:clamp(14px,1.7vw,22px);opacity:.9;text-align:center;max-width:80vw}`;
  function montar() {
    if (document.getElementById('demo-leg')) return;
    const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    document.body.insertAdjacentHTML('beforeend', `<div id="demo-dest"></div><div id="demo-leg"></div>
      <div id="demo-dlg"><div></div></div><div id="demo-tit"><small></small><strong></strong><span></span></div>
      <svg id="demo-cur" viewBox="0 0 24 24"><path d="M3 2l7 19 2.5-8.5L21 10z" fill="#fff" stroke="#101828" stroke-width="1.6"/></svg>`);
  }
  document.addEventListener('DOMContentLoaded', montar);
  let dlgT;
  function mostrarDialogo(msg, botao) {
    montar();
    const d = document.getElementById('demo-dlg');
    d.firstElementChild.innerHTML = '';
    d.firstElementChild.textContent = msg;
    d.firstElementChild.insertAdjacentHTML('beforeend', `<b>${botao}</b>`);
    d.style.opacity = 1; clearTimeout(dlgT);
    dlgT = setTimeout(() => { d.style.opacity = 0; }, window.__demoDlgMs || 3800);
  }
  window.confirm = msg => { mostrarDialogo(msg, 'OK ✓'); return true; };
  window.alert = msg => { mostrarDialogo(msg, 'OK'); };
  window.print = () => mostrarDialogo('Abre a janela de impressão do navegador.\nDá para imprimir ou salvar em PDF.', 'Imprimir / Salvar PDF');
  window.__demo = { montar, mostrarDialogo };
})();
