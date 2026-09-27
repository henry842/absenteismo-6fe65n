// Estado da interface e utilidades comuns. A lógica de dados fica em C3B.servicos; aqui só a tela.
(function () {
  'use strict';
  const S = C3B.servicos, D = S.dicionario, U = S.util;
  const UI = window.UI = { S, D, U, telas: {}, estado: {
    modo: 'IMPLANTADOR', pacote: null, sessao: null, abaAtiva: null, storage: null, raiz: 'C3B', prefs: {}, geracao: null, diagnostico: null,
    observabilidade: [], exemplo: false,
  } };

  // ---------- DOM ----------
  UI.$ = (s, r = document) => r.querySelector(s);
  UI.$$ = (s, r = document) => [...r.querySelectorAll(s)];
  const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  UI.esc = v => String(v == null ? '' : v instanceof Date ? v.toISOString().slice(0, 10) : v).replace(/[&<>"']/g, c => ESC[c]);
  UI.num = n => (n == null ? '—' : Number(n).toLocaleString('pt-BR'));
  UI.dataHora = s => { if (!s) return '—'; const d = new Date(s); return isNaN(d) ? UI.esc(s) : d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }); };
  UI.tag = (texto, tipo = 'neutro') => `<span class="tag ${tipo}">${UI.esc(texto)}</span>`;
  UI.tagSev = s => UI.tag({ INFO: 'Info', WARNING: 'Aviso', ERROR: 'Erro', BLOCKING: 'Bloqueio' }[s] || s, { INFO: 'info', WARNING: 'aviso', ERROR: 'erro', BLOCKING: 'bloq' }[s]);
  UI.tagStatus = s => UI.tag(S.dicionario && ({ AUSENTE: 'Ausente', NAO_INICIADO: 'Não iniciado', PARCIAL: 'Parcial', VALIDO: 'Válido', COM_AVISOS: 'Com avisos', BLOQUEADO: 'Bloqueado' }[s] || s),
    { AUSENTE: 'erro', NAO_INICIADO: 'neutro', PARCIAL: 'aviso', VALIDO: 'ok', COM_AVISOS: 'aviso', BLOQUEADO: 'bloq' }[s] || 'neutro');
  UI.conf = (c, modo) => {
    if (c == null) return '';
    const p = Math.round(c * 100), cls = c >= 0.95 ? '' : c >= 0.8 ? 'revisar' : 'baixa';
    return `<span class="conf ${cls}"><i><b style="width:${p}%"></b></i>${p}%${c < 0.95 ? ' ⚠' : ''}</span>`;
  };
  UI.vazio = (titulo, texto = '') => `<div class="vazio"><b>${UI.esc(titulo)}</b>${UI.esc(texto)}</div>`;
  UI.nomeSchema = id => { try { const s = D.schema(id); return `${s.base} ${s.nome_pt}`; } catch (e) { return id; } };
  UI.ehImplantador = () => UI.estado.modo === 'IMPLANTADOR';

  let toastT;
  UI.toast = (msg, erro = false) => {
    const t = UI.$('#toast'); t.textContent = msg; t.className = 'toast show' + (erro ? ' erro' : '');
    clearTimeout(toastT); toastT = setTimeout(() => { t.className = 'toast'; }, erro ? 7000 : 3800);
  };
  UI.erro = (e, contexto = '') => {
    console.error(contexto, e);
    UI.toast(`${contexto ? contexto + ': ' : ''}${e.message || e}${e.comoResolver ? ' — ' + e.comoResolver : ''}`, true);
  };
  UI.banner = (html, tipo = '') => { UI.$('#bannerGlobal').innerHTML = html ? `<div class="banner ${tipo}">${html}</div>` : ''; };

  // Modal genérico. conteudo: HTML; montar(box) liga eventos. Devolve função para fechar.
  UI.modal = (conteudo, montar = () => {}) => {
    const m = UI.$('#modalGenerico'), box = UI.$('#modalGenericoBox');
    box.innerHTML = conteudo; m.classList.add('show');
    const fechar = () => { m.classList.remove('show'); box.innerHTML = ''; };
    m.onclick = e => { if (e.target === m) fechar(); };
    UI.$$('[data-fechar]', box).forEach(b => b.onclick = fechar);
    montar(box, fechar);
    return fechar;
  };
  // Confirmação com texto (e, opcionalmente, motivo obrigatório)
  UI.confirmar = (titulo, texto, { exigirMotivo = false, botao = 'Confirmar', perigo = false } = {}) => new Promise(resolve => {
    UI.modal(`<h3>${UI.esc(titulo)}</h3><div style="white-space:pre-wrap;color:#c6d4ce;font-size:13px;line-height:1.55">${texto}</div>
      ${exigirMotivo ? '<label class="campo" style="margin-top:12px"><b>Motivo (fica registrado)</b><textarea class="input" id="motivoConf" rows="2"></textarea></label>' : ''}
      <div class="modalActions"><button class="btn" data-fechar>Cancelar</button><button class="btn ${perigo ? 'perigo' : 'primary'}" id="okConf">${UI.esc(botao)}</button></div>`, (box, fechar) => {
      box.querySelector('[data-fechar]').onclick = () => { fechar(); resolve(null); };
      box.querySelector('#okConf').onclick = () => {
        const motivo = exigirMotivo ? box.querySelector('#motivoConf').value.trim() : true;
        if (exigirMotivo && !motivo) { UI.toast('Escreva o motivo.', true); return; }
        fechar(); resolve(motivo);
      };
    });
  });

  UI.baixar = (bytes, nome, tipo) => {
    const url = URL.createObjectURL(new Blob([bytes], { type: tipo || (/\.xlsx$/i.test(nome) ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'application/octet-stream') }));
    const a = document.createElement('a'); a.href = url; a.download = nome; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  };

  // ---------- persistência local (IndexedDB) ----------
  function idb(modo, fn) {
    return new Promise((ok, falha) => {
      const req = indexedDB.open('padronizador-c3b', 1);
      req.onupgradeneeded = () => req.result.createObjectStore('kv');
      req.onerror = () => falha(req.error);
      req.onsuccess = () => {
        try {
          const tx = req.result.transaction('kv', modo);
          const r = fn(tx.objectStore('kv'));
          tx.oncomplete = () => ok(r && r.result);
          tx.onerror = () => falha(tx.error);
        } catch (e) { falha(e); }
      };
    });
  }
  UI.guardar = (chave, valor) => idb('readwrite', s => s.put(valor, chave)).catch(e => console.warn('IndexedDB', e));
  UI.ler = chave => idb('readonly', s => s.get(chave)).catch(() => null);
  let salvarT;
  // Projeto atual (pacote) fica salvo no navegador para "Abrir Último Projeto"
  UI.salvarProjeto = () => {
    clearTimeout(salvarT);
    salvarT = setTimeout(() => { if (UI.estado.pacote && !UI.estado.exemplo) UI.guardar('pacote', JSON.parse(JSON.stringify(UI.estado.pacote))); }, 400);
  };
  UI.prefs = async (novas) => {
    if (novas) { UI.estado.prefs = { ...UI.estado.prefs, ...novas }; await UI.guardar('prefs', UI.estado.prefs); }
    return UI.estado.prefs;
  };

  // ---------- armazenamento ----------
  UI.pacote = () => {
    if (!UI.estado.pacote) UI.estado.pacote = S.createPackage({}, UI.usuario());
    return UI.estado.pacote;
  };
  UI.usuario = () => UI.estado.prefs.usuario || (UI.estado.modo === 'IMPLANTADOR' ? 'implantador' : 'lider');
  UI.storage = () => UI.estado.storage || (UI.estado.storage = S.armazenamento.BrowserDownloadAdapter());
  UI.opcoesExcel = () => ({ ExcelJS: window.ExcelJS });

  // ---------- navegação ----------
  UI.ir = (tela) => {
    UI.$$('.navBtn').forEach(b => b.classList.toggle('active', b.dataset.view === tela));
    UI.$$('.tela').forEach(s => s.classList.toggle('ativa', s.dataset.tela === tela));
    UI.estado.tela = tela;
    const t = UI.telas[tela];
    if (t && t.render) { try { t.render(); } catch (e) { UI.erro(e, 'Tela ' + tela); } }
    window.scrollTo({ top: document.querySelector('.nav').offsetTop, behavior: 'smooth' });
  };
  UI.atualizar = () => { const t = UI.telas[UI.estado.tela]; if (t && t.render) t.render(); UI.telas.inicio.painel(); };

  // Observabilidade (modo Implantador)
  UI.medir = (etapa, dados) => {
    const mem = performance && performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) + ' MB' : 'indisponível neste navegador';
    UI.estado.observabilidade.unshift({ em: new Date().toISOString(), etapa, memoria: mem, ...dados });
    UI.estado.observabilidade = UI.estado.observabilidade.slice(0, 50);
  };
})();
