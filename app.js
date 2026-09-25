// Telas e comportamento da página (separado do HTML para a regra de segurança CSP funcionar).

// O app não abre dentro de outro site (evita que alguém o esconda numa página para enganar o clique)
if (window.top !== window.self) {
  document.documentElement.innerHTML = '';
  throw new Error('Aberto dentro de outro site');
}

(function () {
  'use strict';
  const L = window.Leitor;
  const X = window.Excel;
  const CHAVE = 'absenteismo.v1';
  const $ = s => document.querySelector(s);

  // ---------- Ícones (traço simples, cor do texto) ----------
  const ICONES = {
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
    user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    checkCircle: '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
    alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4M12 17h.01"/>',
    alertCircle: '<circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>',
    xCircle: '<circle cx="12" cy="12" r="10"/><path d="m15 9-6 6M9 9l6 6"/>',
    info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
    trash: '<path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"/>',
    save: '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8M7 3v5h8"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>',
    fileText: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/>',
    sheet: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h2M14 13h2M8 17h2M14 17h2"/>',
    chart: '<path d="M12 20V10M18 20V4M6 20v-4"/>',
    clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
    history: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5M12 7v5l4 2"/>',
    settings: '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
    search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
    database: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14a9 3 0 0 0 18 0V5"/><path d="M3 12a9 3 0 0 0 18 0"/>',
    bulb: '<path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6M10 22h4"/>',
    message: '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>',
    whats: '<path d="M3 21l1.65-3.8a9 9 0 1 1 3.4 2.9L3 21"/><path d="M9 10a.5.5 0 0 0 1 0V9a.5.5 0 0 0-1 0v1a5 5 0 0 0 5 5h1a.5.5 0 0 0 0-1h-1a.5.5 0 0 0 0 1"/>',
    printer: '<path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>',
    copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
    upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>',
    folder: '<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>',
    table: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18"/>',
    ban: '<circle cx="12" cy="12" r="10"/><path d="m4.9 4.9 14.2 14.2"/>',
    play: '<path d="m6 3 14 9-14 9z"/>',
    megafone: '<path d="m3 11 18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/>',
    trend: '<path d="M22 7 13.5 15.5 8.5 10.5 2 17"/><path d="M16 7h6v6"/>',
    nuvem: '<path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/>',
    nuvemOff: '<path d="m2 2 20 20M5.78 5.78A7 7 0 0 0 9 19h8.5a4.5 4.5 0 0 0 1.31-.2M21.53 16.5A4.5 4.5 0 0 0 17.5 10h-1.79A7 7 0 0 0 10.2 5.1"/>',
    chevron: '<path d="m6 9 6 6 6-6"/>',
    sair: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  };
  const ic = (n, extra) => `<svg class="i" viewBox="0 0 24 24" aria-hidden="true"${extra ? ' ' + extra : ''}>${ICONES[n] || ''}</svg>`;
  function trocarIcones(raiz) {
    (raiz || document).querySelectorAll('i[data-i]').forEach(el => { el.outerHTML = ic(el.dataset.i); });
  }
  trocarIcones();

  // ---------- Base local ----------
  function completar(b) {
    const nova = Object.assign(L.baseVazia(), b);
    nova.cadastro = b.cadastro || {};
    nova.config = Object.assign({ times: [], naoContam: ['Férias'], apelidos: {}, meta: null }, b.config || {});
    return nova;
  }
  function carregar() {
    try {
      const b = JSON.parse(localStorage.getItem(CHAVE));
      if (b && b.fechamentos) return completar(b);
    } catch (e) { /* base vazia */ }
    return completar(L.baseVazia());
  }
  let base = carregar();
  function guardarLocal() {
    try { localStorage.setItem(CHAVE, JSON.stringify(base)); }
    catch (e) { alert('Não consegui salvar no aparelho. Baixe um backup em Ajustes.'); }
  }
  function salvar(opcoes) {
    guardarLocal();
    if (sinc) sinc.marcarMudancas();
    if (!(opcoes && opcoes.semExcel)) salvarExcel(true);
  }
  let sinc = null; // criado mais abaixo (login e sincronização)
  function lerPreferencia(k) { try { return localStorage.getItem('absenteismo.' + k); } catch (e) { return null; } }
  function gravarPreferencia(k, v) { try { localStorage.setItem('absenteismo.' + k, v); } catch (e) { /* sem problema */ } }

  // Mensagens lidas esperando conferência (não ficam salvas até gravar)
  let fila = [];
  let proximoId = 1;

  // ---------- utilidades ----------
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const hoje = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  const ordenarTimes = (a, b) => a.localeCompare(b, 'pt', { numeric: true });
  const pctDe = (a, b) => L.pct(a, b);
  function aviso(txt) {
    const t = $('#toast'); t.textContent = txt; t.classList.add('mostrar');
    clearTimeout(aviso.t); aviso.t = setTimeout(() => t.classList.remove('mostrar'), 2800);
  }
  function baixar(nome, conteudo, tipo) {
    const url = URL.createObjectURL(new Blob([conteudo], { type: tipo }));
    const a = document.createElement('a'); a.href = url; a.download = nome;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function copiar(texto) {
    try { await navigator.clipboard.writeText(texto); return true; }
    catch (e) {
      const t = document.createElement('textarea'); t.value = texto; document.body.appendChild(t);
      t.select(); const ok = document.execCommand('copy'); t.remove(); return ok;
    }
  }
  function ultimaData() {
    const ds = Object.values(base.fechamentos).map(f => f.data).sort();
    return ds.length ? ds[ds.length - 1] : hoje();
  }
  function vazio(icone, titulo, sub) {
    return `<div class="vazio-tracejado">${ic(icone)}${esc(titulo)}${sub ? `<small>${esc(sub)}</small>` : ''}</div>`;
  }
  const d0 = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  $('#dataHoje').textContent = d0.charAt(0).toUpperCase() + d0.slice(1);

  // ---------- Arquivo Excel (salva sozinho no arquivo escolhido) ----------
  // O "atalho" para o arquivo fica guardado no IndexedDB do navegador.
  const temSeletor = typeof window.showSaveFilePicker === 'function';
  let arquivoExcel = null;
  const excel = { estado: 'nenhum', hora: null, gravando: false, deNovo: false };

  function idb(modo, fn) {
    return new Promise((ok, falha) => {
      const req = indexedDB.open('absenteismo', 1);
      req.onupgradeneeded = () => req.result.createObjectStore('arquivos');
      req.onerror = () => falha(req.error);
      req.onsuccess = () => {
        const tx = req.result.transaction('arquivos', modo);
        const r = fn(tx.objectStore('arquivos'));
        tx.oncomplete = () => ok(r && r.result);
        tx.onerror = () => falha(tx.error);
      };
    });
  }

  function mostrarEstadoExcel() {
    const b = $('#estadoExcel');
    const hora = excel.hora ? excel.hora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '';
    const nome = arquivoExcel ? arquivoExcel.name : '';
    const textos = {
      nenhum: ['', 'Excel: escolher arquivo', 'Ainda não escolheu onde salvar o Excel. Clique em "Escolher onde salvar o Excel".'],
      semSeletor: ['atencao', 'Excel: só baixar', 'Este navegador não salva sozinho. Use "Baixar uma cópia". (Funciona no Edge e no Chrome.)'],
      ok: ['ok', `Excel salvo ${hora}`, `Salvo em "${nome}" às ${hora}.`],
      pronto: ['ok', 'Excel ligado', `O Excel é salvo em "${nome}" a cada gravação.`],
      permissao: ['atencao', 'Excel: clique para liberar', `O navegador precisa da sua permissão para salvar em "${nome}". Clique em "Salvar Excel agora".`],
      erro: ['erro', 'Excel: NÃO salvou', `Não consegui salvar em "${nome}". Se o arquivo estiver aberto no Excel, feche e clique em "Salvar Excel agora".`],
    }[excel.estado];
    b.className = 'pilula ' + textos[0];
    b.querySelector('span').textContent = textos[1];
    b.title = textos[2];
    $('#infoExcel').textContent = textos[2];
  }

  async function salvarExcel(interativo) {
    if (!arquivoExcel) { mostrarEstadoExcel(); return false; }
    if (excel.gravando) { excel.deNovo = true; return true; }
    excel.gravando = true;
    try {
      let perm = await arquivoExcel.queryPermission({ mode: 'readwrite' });
      if (perm !== 'granted' && interativo) perm = await arquivoExcel.requestPermission({ mode: 'readwrite' });
      if (perm !== 'granted') { excel.estado = 'permissao'; return false; }
      const w = await arquivoExcel.createWritable();
      await w.write(X.gerarExcel(base));
      await w.close();
      excel.estado = 'ok'; excel.hora = new Date();
      return true;
    } catch (e) {
      console.error('Excel', e);
      excel.estado = 'erro';
      return false;
    } finally {
      excel.gravando = false;
      mostrarEstadoExcel();
      if (excel.deNovo) { excel.deNovo = false; salvarExcel(false); }
    }
  }

  async function escolherArquivoExcel() {
    if (!temSeletor) { alert('Este navegador não deixa salvar direto num arquivo. Use o Edge ou o Chrome, ou o botão "Baixar uma cópia".'); return; }
    try {
      arquivoExcel = await window.showSaveFilePicker({
        suggestedName: 'absenteismo.xlsx',
        types: [{ description: 'Planilha do Excel', accept: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] } }],
      });
    } catch (e) { return; } // cancelou
    try { await idb('readwrite', s => s.put(arquivoExcel, 'excel')); } catch (e) { console.error(e); }
    if (await salvarExcel(true)) aviso('Excel ligado. Ele será atualizado a cada gravação.');
  }

  async function iniciarExcel() {
    if (!temSeletor) { excel.estado = 'semSeletor'; mostrarEstadoExcel(); return; }
    try { arquivoExcel = await idb('readonly', s => s.get('excel')) || null; } catch (e) { arquivoExcel = null; }
    if (arquivoExcel) {
      const perm = await arquivoExcel.queryPermission({ mode: 'readwrite' }).catch(() => 'prompt');
      excel.estado = perm === 'granted' ? 'pronto' : 'permissao';
    }
    mostrarEstadoExcel();
  }

  $('#estadoExcel').addEventListener('click', () => {
    if (excel.estado === 'permissao' || excel.estado === 'erro') salvarExcel(true);
    else irPara('ajustes');
  });
  $('#btnEscolherExcel').addEventListener('click', escolherArquivoExcel);
  $('#btnSalvarExcelAgora').addEventListener('click', async () => {
    if (!arquivoExcel) return escolherArquivoExcel();
    if (await salvarExcel(true)) aviso('Excel salvo.');
  });
  $('#btnBaixarExcel').addEventListener('click', () =>
    baixar(`absenteismo-${hoje()}.xlsx`, X.gerarExcel(base), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'));

  // ---------- abas ----------
  function irPara(aba) {
    document.querySelectorAll('nav .passo').forEach(b => b.classList.toggle('ativa', b.dataset.aba === aba));
    document.querySelectorAll('main section.aba').forEach(s => s.classList.toggle('ativa', s.id === 'aba-' + aba));
    if (aba === 'colar') desenharColar();
    if (aba === 'conferencia') desenharConferencia();
    if (aba === 'dia') desenharDia();
    if (aba === 'historico') { desenharBusca(); desenharPeriodo(); }
    if (aba === 'ajustes') desenharAjustes();
    window.scrollTo(0, 0);
  }
  $('#abas').addEventListener('click', e => { const b = e.target.closest('.passo'); if (b) irPara(b.dataset.aba); });

  function atualizarContador() {
    const n = $('#nPendentes'); n.textContent = fila.length; n.hidden = !fila.length;
  }

  // ---------- 1. Colar ----------
  function textoExemplo() {
    const [a, m, d] = hoje().split('-');
    return [
      `*Absenteísmo C7B ${d}/${m}/${a}*`,
      '*Turno:* 2',
      '',
      '*Total de pessoas:* 46',
      '*Presentes:* 44',
      '*Ausentes:* 2',
      '',
      '*Nome:* Maria Exemplo',
      '*Matrícula:* 1234567',
      '*Motivo:* Atestado médico',
      '',
      '*Nome:* João Exemplo',
      '*Matrícula:* 7654321',
      '*Motivo:* Sem justificativa',
    ].join('\n');
  }

  function desenharColar() {
    const times = base.config.times.length;
    const ultima = lerPreferencia('ultimaLeitura');
    let rotUltima = 'Nenhuma leitura ainda', valUltima = '—';
    if (ultima) {
      const u = new Date(ultima);
      const hh = u.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      const ehHoje = u.toDateString() === new Date().toDateString();
      rotUltima = ehHoje ? 'Última leitura hoje' : 'Última leitura em ' + u.toLocaleDateString('pt-BR');
      valUltima = hh;
    }
    const r = L.resumoDoDia(base, hoje());
    $('#numerosColar').innerHTML = `
      <div class="numero"><div class="ladrilho">${ic('fileText')}</div>
        <div>${times ? `<span class="grande">${times}</span> <span class="t">times esperados</span><div class="s">Conforme os Ajustes</div>`
          : '<div class="t">Times esperados</div><div class="s">Cadastre os times em Ajustes</div>'}</div></div>
      <div class="numero"><div class="ladrilho">${ic('clock')}</div>
        <div><div class="s">${esc(rotUltima)}</div><div class="grande">${esc(valUltima)}</div><div class="s"><span class="ponto"></span>Sistema pronto</div></div></div>
      <div class="numero"><div class="ladrilho ${fila.length ? 'amarelo' : 'verde'}">${ic(fila.length ? 'alert' : 'check')}</div>
        <div>${fila.length ? `<div class="t">${fila.length} esperando conferência</div><div class="s">Revise na etapa 2 antes de gravar.</div>`
          : '<div class="t">Pronto para conferência</div><div class="s">As mensagens serão analisadas e organizadas automaticamente.</div>'}</div></div>
      <div class="numero"><div class="ladrilho">${ic('chart')}</div>
        <div><div class="s">Total do dia (já gravado)</div><div class="grande">${r.efetivo}</div><div class="s">pessoas · ${r.recebidos.length} time(s) hoje</div></div></div>`;
    $('#textoExemplo').textContent = textoExemplo();
    previaImportacao();
  }

  // Mostra, enquanto cola, o que o sistema já está entendendo
  function previaImportacao() {
    const texto = $('#entrada').value;
    $('#contagemCar').textContent = `${texto.length.toLocaleString('pt-BR')} caracteres`;
    const lidas = texto.trim() ? L.lerMensagens(texto, { ano: new Date().getFullYear(), apelidos: base.config.apelidos }) : [];
    const exemplo = texto.trim() === textoExemplo().trim();
    const pend = lidas.filter(m => exemplo || L.conferir(m, base, base.config).status !== 'verde').length;
    const total = lidas.reduce((s, m) => s + (m.efetivo || 0), 0);
    const quais = lidas.map(m => m.time || '?').join(', ');
    $('#resumoImportacao').innerHTML = `
      <div><div class="ladrilho p">${ic('file')}</div><div><div class="n">${lidas.length}</div><div class="s">mensagens coladas</div></div></div>
      <div><div class="ladrilho p verde">${ic('users')}</div><div><div class="n">${lidas.filter(m => m.time).length}</div><div class="s">times reconhecidos${quais ? `<br>${esc(quais)}` : ''}</div></div></div>
      <div><div class="ladrilho p amarelo">${ic('alert')}</div><div><div class="n${pend ? ' alerta' : ''}">${pend}</div><div class="s">precisam de revisão</div></div></div>
      <div><div class="ladrilho p">${ic('users')}</div><div><div class="n">${total}</div><div class="s">pessoas nas mensagens</div></div></div>`;
  }
  $('#entrada').addEventListener('input', () => { clearTimeout(previaImportacao.t); previaImportacao.t = setTimeout(previaImportacao, 250); });

  document.querySelectorAll('[data-acao-colar="exemplo"]').forEach(b => b.addEventListener('click', () => {
    $('#entrada').value = textoExemplo(); previaImportacao(); $('#entrada').focus();
  }));
  $('#btnCopiarExemplo').addEventListener('click', async () => aviso(await copiar(textoExemplo()) ? 'Exemplo copiado.' : 'Não consegui copiar.'));

  $('#btnLer').addEventListener('click', () => {
    const texto = $('#entrada').value;
    const lidas = L.lerMensagens(texto, { ano: new Date().getFullYear(), apelidos: base.config.apelidos });
    if (!lidas.length) {
      $('#resultadoLeitura').innerHTML = `<div class="caixa-aviso info" style="margin-top:14px">${ic('info')}<span>Não encontrei nenhuma mensagem de absenteísmo nesse texto.</span></div>`;
      return;
    }
    const exemplo = texto.trim() === textoExemplo().trim();
    for (const m of lidas) {
      m.id = proximoId++;
      m.exemplo = exemplo;
      m.pessoas.forEach(p => { p.motivoEraDesconhecido = !p.motivoReconhecido; });
      fila.push(m);
    }
    gravarPreferencia('ultimaLeitura', new Date().toISOString());
    $('#entrada').value = '';
    $('#resultadoLeitura').innerHTML = '';
    atualizarContador();
    aviso(`${lidas.length} mensagem(ns) lida(s): ${lidas.map(m => m.time || '?').join(', ')}`);
    irPara('conferencia');
  });
  $('#btnLimparEntrada').addEventListener('click', () => { $('#entrada').value = ''; $('#resultadoLeitura').innerHTML = ''; previaImportacao(); });

  // ---------- 2. Conferência ----------
  function conferirComData(m) {
    const c = L.conferir(m, base, base.config);
    if (m.exemplo) {
      c.problemas.unshift({ nivel: 'vermelho', texto: 'Esta é a mensagem de EXEMPLO. Serve só para ver como funciona: descarte, não grave.' });
      c.status = 'vermelho';
    }
    return c;
  }

  const ICONE_NIVEL = { vermelho: 'xCircle', amarelo: 'alert', info: 'info' };
  const STATUS = {
    verde: ['Tudo certo', 'checkCircle'],
    amarelo: ['Dê uma olhada', 'alertCircle'],
    vermelho: ['Não fecha', 'xCircle'],
  };
  const TURNOS = ['1º turno', '2º turno', '3º turno', 'Turno A', 'Turno B', 'Turno C', 'ADM'];

  function desenharConferencia() {
    const lista = $('#listaConferencia');
    atualizarBotaoTodos();
    if (!fila.length) {
      lista.innerHTML = `<div class="cartao">${vazio('checkCircle', 'Nada para conferir.', 'Cole as mensagens na etapa 1.')}</div>`;
      return;
    }
    lista.innerHTML = fila.map(cartaoHTML).join('');
  }

  function cartaoHTML(m) {
    const c = conferirComData(m);
    const [nomeStatus, iconeStatus] = STATUS[c.status];
    const opcoesMotivo = sel => L.MOTIVOS.map(x => `<option${x === sel ? ' selected' : ''}>${esc(x)}</option>`).join('');
    const turnos = m.turno && !TURNOS.includes(m.turno) ? [m.turno].concat(TURNOS) : TURNOS;
    const podeGravar = !m.exemplo && m.time && m.data && m.efetivo != null && m.presentes != null;
    const ausConta = m.efetivo != null && m.presentes != null ? m.efetivo - m.presentes : '';
    return `
    <div class="cartao msg ${c.status}" data-id="${m.id}">
      <div class="msg-topo">
        <h3 class="titulo-msg">${esc(m.time || 'Time ?')}${m.data ? ' · ' + L.dataBR(m.data) : ''}</h3>
        <span class="selo ${c.status}">${ic(iconeStatus)}${nomeStatus}</span>
        <span class="espaco"></span>
        <button class="botao perigo" data-acao="descartar">${ic('trash')}Descartar</button>
      </div>
      <div class="avisos">${avisosHTML(c)}</div>
      <div class="campos">
        <div><label class="rotulo">Time</label><input data-campo="time" value="${esc(m.time || '')}" placeholder="ex.: C5B"></div>
        <div><label class="rotulo">Data</label><input type="date" data-campo="data" value="${esc(m.data || '')}">
          ${m.data ? '' : `<button class="botao sec p" data-acao="hoje" style="margin-top:6px">Usar hoje</button>`}</div>
        <div><label class="rotulo">Turno</label><select data-campo="turno"><option value="">Selecione...</option>${turnos.map(t => `<option${t === m.turno ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select></div>
        <div><label class="rotulo">Total de pessoas</label><input type="number" min="0" data-campo="efetivo" value="${m.efetivo ?? ''}"></div>
        <div><label class="rotulo">Presentes</label><input type="number" min="0" data-campo="presentes" value="${m.presentes ?? ''}"></div>
        <div><label class="rotulo">Ausentes (conta)</label><input disabled class="aus-conta" value="${ausConta}"></div>
      </div>
      <hr>
      <div class="ausentes-titulo">${ic('users')}Pessoas ausentes (${m.pessoas.length})</div>
      <div class="tabela-rolar">
      <table class="pessoas">
        <thead><tr><th style="width:32%">Nome</th><th style="width:16%">Matrícula</th><th style="width:22%">Motivo</th><th>Escrito pelo líder</th><th style="width:52px"></th></tr></thead>
        <tbody>
          ${m.pessoas.map((p, i) => `
          <tr data-i="${i}">
            <td data-rot="Nome"><input data-p="nome" value="${esc(p.nome)}" placeholder="Nome"></td>
            <td data-rot="Matrícula"><input data-p="matricula" value="${esc(p.matricula)}" inputmode="numeric" placeholder="Matrícula"></td>
            <td data-rot="Motivo"><select data-p="motivo">${opcoesMotivo(p.motivo)}</select></td>
            <td data-rot="Escrito pelo líder"><input disabled value="${esc(p.motivoOriginal)}"></td>
            <td><button class="botao perigo icone" data-acao="tirarPessoa" title="Remover pessoa">${ic('trash')}</button></td>
          </tr>`).join('')}
        </tbody>
      </table>
      </div>
      <div class="msg-rodape">
        <button class="botao sec" data-acao="addPessoa">${ic('plus')}Adicionar pessoa</button>
        <span class="espaco"></span>
        <button class="botao g" data-acao="gravar" ${podeGravar ? '' : `disabled title="${m.exemplo ? 'Mensagem de exemplo não pode ser gravada' : 'Preencha time, data, total e presentes'}"`}>${ic('save')}Gravar ${esc(m.time || '')}</button>
      </div>
      <details class="original"><summary>Ver mensagem original</summary><pre>${esc(m.texto)}</pre></details>
    </div>`;
  }

  function mensagemDoCartao(el) {
    const id = +el.closest('[data-id]').dataset.id;
    return fila.find(m => m.id === id);
  }

  const avisosHTML = c => c.problemas.map(p => `<div class="caixa-aviso ${p.nivel}">${ic(ICONE_NIVEL[p.nivel])}<span>${esc(p.texto)}</span></div>`).join('');

  // Depois de corrigir um campo, atualiza só as partes do cartão que mudam.
  // Não troca os botões: assim o clique em "Gravar" logo depois de corrigir não se perde.
  function atualizarCartao(m) {
    const el = document.querySelector(`[data-id="${m.id}"]`);
    if (!el) return;
    const c = conferirComData(m);
    const [nomeStatus, iconeStatus] = STATUS[c.status];
    el.className = 'cartao msg ' + c.status;
    el.querySelector('.titulo-msg').textContent = (m.time || 'Time ?') + (m.data ? ' · ' + L.dataBR(m.data) : '');
    const selo = el.querySelector('.selo');
    selo.className = 'selo ' + c.status;
    selo.innerHTML = ic(iconeStatus) + nomeStatus;
    el.querySelector('.avisos').innerHTML = avisosHTML(c);
    el.querySelector('.aus-conta').value = m.efetivo != null && m.presentes != null ? m.efetivo - m.presentes : '';
    const g = el.querySelector('[data-acao="gravar"]');
    const podeGravar = !m.exemplo && m.time && m.data && m.efetivo != null && m.presentes != null;
    g.disabled = !podeGravar;
    g.title = podeGravar ? '' : 'Preencha time, data, total e presentes';
    g.lastChild.textContent = 'Gravar ' + (m.time || '');
    const hojeBtn = el.querySelector('[data-acao="hoje"]');
    if (hojeBtn && m.data) hojeBtn.remove();
    atualizarBotaoTodos();
  }

  // Quantos dá para gravar de uma vez (verdes + amarelos; vermelhos ficam de fora)
  function atualizarBotaoTodos() {
    const st = fila.map(m => conferirComData(m).status);
    const ok = st.filter(x => x !== 'vermelho').length;
    const verm = st.length - ok;
    const b = $('#btnConfirmarVerdes');
    b.disabled = !ok;
    b.querySelector('span').textContent = ok ? `Gravar todos (${ok})` : 'Gravar todos';
    $('#dicaGravarTodos').textContent = verm ? `${verm} vermelho(s) ficam de fora: corrija ou grave um por um.` : '';
  }

  function redesenharCartao(m) {
    const velho = document.querySelector(`[data-id="${m.id}"]`);
    const foco = document.activeElement;
    const chaveFoco = foco && velho.contains(foco) ? (foco.dataset.campo || (foco.dataset.p && foco.closest('tr').dataset.i + ':' + foco.dataset.p)) : null;
    const tmp = document.createElement('div'); tmp.innerHTML = cartaoHTML(m);
    velho.replaceWith(tmp.firstElementChild);
    atualizarBotaoTodos();
    if (chaveFoco) {
      const novo = document.querySelector(`[data-id="${m.id}"]`);
      const [i, p] = chaveFoco.split(':');
      const alvo = p ? novo.querySelector(`tr[data-i="${i}"] [data-p="${p}"]`) : novo.querySelector(`[data-campo="${chaveFoco}"]`);
      if (alvo) alvo.focus();
    }
  }

  $('#listaConferencia').addEventListener('change', e => {
    const m = mensagemDoCartao(e.target); if (!m) return;
    const campo = e.target.dataset.campo, pc = e.target.dataset.p;
    if (campo) {
      let v = e.target.value.trim();
      if (campo === 'time') { v = L.normalizarTime(v); m.timeIncompleto = false; }
      if (campo === 'efetivo' || campo === 'presentes') { v = v === '' ? null : +v; m.ausentesInformado = false; }
      if (campo === 'data') m.dataDoWhats = false;
      m[campo] = v === '' ? null : v;
      if (m.efetivo != null && m.presentes != null) m.ausentes = m.efetivo - m.presentes;
    } else if (pc) {
      const p = m.pessoas[+e.target.closest('tr').dataset.i];
      if (pc === 'motivo') { p.motivo = e.target.value; p.motivoReconhecido = true; }
      else if (pc === 'matricula') { p.matricula = e.target.value.replace(/\D/g, ''); e.target.value = p.matricula; }
      else { p.nome = L.nomeBonito(e.target.value); e.target.value = p.nome; }
    }
    if (campo === 'time') e.target.value = m.time || '';
    atualizarCartao(m);
  });

  $('#listaConferencia').addEventListener('click', e => {
    const b = e.target.closest('[data-acao]'); if (!b) return;
    const m = mensagemDoCartao(b); if (!m) return;
    const acao = b.dataset.acao;
    if (acao === 'descartar') {
      if (!m.exemplo && !confirm(`Descartar a mensagem do ${m.time || 'time ?'}? Ela não será gravada.`)) return;
      fila = fila.filter(x => x !== m); atualizarContador(); desenharConferencia();
    } else if (acao === 'hoje') { m.data = hoje(); redesenharCartao(m); }
    else if (acao === 'addPessoa') {
      m.pessoas.push({ nome: '', matricula: '', motivo: 'Atestado médico', motivoOriginal: '', motivoReconhecido: true });
      redesenharCartao(m);
    } else if (acao === 'tirarPessoa') {
      m.pessoas.splice(+b.closest('tr').dataset.i, 1); redesenharCartao(m);
    } else if (acao === 'gravar') {
      if (m.exemplo) return;
      const c = conferirComData(m);
      if (c.status === 'vermelho' && !confirm(`O ${m.time} tem problema na conta:\n\n${c.problemas.filter(p => p.nivel === 'vermelho').map(p => '• ' + p.texto).join('\n')}\n\nGravar mesmo assim?`)) return;
      gravarMensagem(m);
      desenharConferencia();
    }
  });

  function gravarMensagem(m) {
    // Aprende os motivos que o sistema não conhecia e o usuário corrigiu
    for (const p of m.pessoas) {
      if (p.motivoEraDesconhecido && p.motivoOriginal && p.motivo !== 'Outros')
        base.config.apelidos[L.dobrar(p.motivoOriginal).replace(/[.,;!]+$/g, '')] = p.motivo;
    }
    base = L.gravar(base, m);
    salvar();
    fila = fila.filter(x => x !== m);
    atualizarContador();
    $('#dataDia').value = m.data;
    aviso(`${m.time} de ${L.dataBR(m.data)} gravado.`);
  }

  $('#btnConfirmarVerdes').addEventListener('click', () => {
    const lista = fila.map(m => ({ m, c: conferirComData(m) }));
    const gravar = lista.filter(x => x.c.status !== 'vermelho');
    const amarelos = gravar.filter(x => x.c.status === 'amarelo');
    const vermelhos = lista.filter(x => x.c.status === 'vermelho');
    if (!gravar.length) return;
    if (amarelos.length || vermelhos.length) {
      const partes = [`Vou gravar ${gravar.length} time(s): ${gravar.map(x => x.m.time).join(', ')}.`];
      if (amarelos.length) {
        partes.push('', 'Com aviso amarelo (confira se está certo):');
        for (const x of amarelos) for (const p of x.c.problemas.filter(p => p.nivel === 'amarelo')) partes.push(`• ${x.m.time}: ${p.texto}`);
      }
      if (vermelhos.length) partes.push('', `NÃO vou gravar (conta não fecha): ${vermelhos.map(x => x.m.time || '?').join(', ')}. Corrija ou grave um por um.`);
      partes.push('', 'Gravar agora?');
      if (!confirm(partes.join('\n'))) return;
    }
    for (const x of gravar) gravarMensagem(x.m);
    aviso(`${gravar.length} time(s) gravado(s).`);
    desenharConferencia();
    if (!fila.length) irPara('dia');
  });

  // ---------- 3. Dia ----------
  function desenharDia() {
    if (!$('#dataDia').value) $('#dataDia').value = ultimaData();
    const data = $('#dataDia').value;
    const r = L.resumoDoDia(base, data);
    const alvo = $('#conteudoDia');
    const comNomes = !!desenharDia.comNomes;
    const cobranca = L.textoCobranca(r);
    const cadastrados = base.config.times.length;
    const pctRecebido = r.esperados ? Math.round(r.recebidos.length / r.esperados * 100) : 0;

    const mandouHTML = `
      <div class="cartao">
        <div class="mandou">
          <div class="ladrilho p verde">${ic('check')}</div>
          <div class="texto">
            <h3 style="margin:0 0 2px;font-size:18px">Quem já mandou</h3>
            <div style="color:var(--suave);font-size:14px;margin-bottom:8px">${cadastrados ? `${r.recebidos.length} de ${cadastrados} times cadastrados.` : 'Cadastre os times em Ajustes para ver quem falta.'}</div>
            ${chipsHTML(r)}
          </div>
          <div class="resumo-tiles">
            <div class="tile verde"><div class="ladrilho p verde">${ic('check')}</div><div><b>${r.recebidos.length} time(s) enviaram</b><span>${cadastrados ? pctRecebido + '% concluído' : '—'}</span></div></div>
            <div class="tile amarelo"><div class="ladrilho p amarelo">${ic('clock')}</div><div><b>${r.pendentes.length} time(s) pendentes</b><span>${cadastrados ? `de ${cadastrados} cadastrados` : 'sem lista de times'}</span></div></div>
          </div>
        </div>
        ${cobranca ? `<div class="linha nao-imprimir" style="margin-top:14px"><button class="botao sec" id="btnCobranca">${ic('megafone')}Copiar cobrança para quem não mandou</button></div>` : ''}
      </div>`;

    if (!r.times.length) {
      alvo.innerHTML = `<div class="cartao">${vazio('fileText', `Nenhum time gravado em ${L.dataBR(data)}.`, 'Cole as mensagens na etapa 1 e grave na Conferência.')}</div>${cadastrados ? mandouHTML : ''}`;
      ligarCobranca(cobranca);
      return;
    }
    const maxPct = Math.max(...r.times.map(t => t.efetivo ? t.faltas / t.efetivo : 0), 0.0001);
    const motivos = Object.entries(r.porMotivo).sort((a, b) => b[1] - a[1]);
    const texto = L.textoWhatsApp(r, { comNomes });
    const classeSeta = { '↑': 'subiu', '↓': 'desceu', '=': 'igual' };
    const antes = t => {
      if (!t.anterior) return '<span class="igual">–</span>';
      const s = L.seta(t.ausentes, t.anterior.ausentes);
      return `<span class="${classeSeta[s]}" title="${L.dataBR(t.anterior.data)}: ${t.anterior.ausentes} ausente(s)">${t.anterior.ausentes} ${s}</span>`;
    };
    const geralAcima = L.acimaDaMeta(r.faltasQueContam, r.efetivo, r.meta);
    const nomesSup = lerPreferencia('nomesSuperior') !== 'nao';
    const textoSup = L.textoSuperior(r, base.config.area, { comNomes: nomesSup });
    // O que precisa de revisão antes de mandar para o superior
    const revisao = [];
    if (r.pendentes.length) revisao.push(`Ainda falta(m) ${r.pendentes.length} time(s): ${r.pendentes.join(', ')}. O texto ainda não está completo.`);
    for (const t of r.times) {
      if (nomesSup) {
        if (t.ausentes > t.pessoas.length) revisao.push(`${t.time}: ${t.ausentes} ausente(s), mas só ${t.pessoas.length} com nome. Faltam nomes no texto.`);
        const semId = t.pessoas.filter(p => !p.matricula).length;
        if (semId) revisao.push(`${t.time}: ${semId} pessoa(s) sem ID/matrícula.`);
      }
      const outros = t.pessoas.filter(p => p.motivo === 'Outros').length;
      if (outros) revisao.push(`${t.time}: ${outros} pessoa(s) com motivo "Outros". Confira o motivo certo.`);
    }
    alvo.innerHTML = `
      <h2 class="so-impressao">Absenteísmo – ${L.dataBR(data)}</h2>
      <div class="kpis">
        <div class="kpi"><div class="ladrilho p">${ic('file')}</div><div style="flex:1"><div class="rot">Times recebidos</div><div class="valor">${r.recebidos.length}/${r.esperados}</div>
          <div class="det">${pctRecebido}% concluído</div><div class="progresso"><span style="width:${pctRecebido}%"></span></div></div></div>
        <div class="kpi"><div class="ladrilho p">${ic('users')}</div><div><div class="rot">Total de pessoas</div><div class="valor">${r.efetivo}</div><div class="det">Pessoas no dia</div></div></div>
        <div class="kpi"><div class="ladrilho p verde">${ic('users')}</div><div><div class="rot">Presentes</div><div class="valor">${r.presentes}</div><div class="det">${pctDe(r.presentes, r.efetivo)} do total</div></div></div>
        <div class="kpi"><div class="ladrilho p laranja">${ic('alert')}</div><div><div class="rot">Ausentes</div><div class="valor">${r.ausentes}</div><div class="det">${pctDe(r.ausentes, r.efetivo)} do total</div></div></div>
        <div class="kpi destaque"><div class="ladrilho p">${ic('chart')}</div><div><div class="rot">Absenteísmo${r.meta ? ` (meta ${L.pctMeta(r.meta)})` : ''}</div>
          <div class="valor${geralAcima ? ' acima' : ''}">${L.pct(r.faltasQueContam, r.efetivo)}</div><div class="det">${r.faltasQueContam} de ${r.efetivo} pessoas</div></div></div>
      </div>
      ${mandouHTML}
      <div class="grade-2">
        <div class="cartao">
          <div class="cartao-topo"><div class="ladrilho p">${ic('chart')}</div><div><h3>Por time</h3><p>Resumo de presença e ausência por time.</p></div></div>
          <div class="tabela-rolar"><table>
            <thead><tr><th>Time</th><th class="num">Total</th><th class="num col-pres">Presentes</th><th class="num"><span class="so-grande">Ausentes</span><span class="so-celular">Aus.</span></th>
              <th class="centro" title="Ausentes no último lançamento do time">Antes</th><th class="num">%</th><th class="col-barra"></th><th class="nao-imprimir"></th></tr></thead>
            <tbody>${r.times.map(t => {
              const acima = L.acimaDaMeta(t.faltas, t.efetivo, r.meta);
              return `<tr>
                <td><b>${esc(t.time)}</b>${t.turno ? `<br><span style="color:var(--fraco);font-size:13px">${esc(t.turno)}</span>` : ''}</td>
                <td class="num">${t.efetivo}</td><td class="num col-pres">${t.presentes}</td><td class="num">${t.ausentes}</td>
                <td class="centro">${antes(t)}</td>
                <td class="num${acima ? ' acima' : ''}">${L.pct(t.faltas, t.efetivo)}</td>
                <td class="col-barra"><div class="barra"><span style="width:${(t.efetivo ? t.faltas / t.efetivo : 0) / maxPct * 100}%${acima ? ';background:var(--vermelho)' : ''}"></span></div></td>
                <td class="nao-imprimir"><button class="botao perigo icone" data-apagar="${esc(t.time)}" title="Apagar lançamento">${ic('trash')}</button></td>
              </tr>`; }).join('')}
            </tbody>
          </table></div>
        </div>
        <div class="cartao">
          <div class="cartao-topo"><div class="ladrilho p laranja">${ic('alert')}</div><div><h3>Por motivo</h3><p>Principais motivos de ausência no dia.</p></div></div>
          ${motivos.length ? `<table><thead><tr><th>Motivo</th><th class="num">Quantidade</th></tr></thead><tbody>${motivos.map(([m, n]) => `<tr><td>${esc(m)}${base.config.naoContam.includes(m) ? ' <span class="etiqueta">não conta no %</span>' : ''}</td><td class="num">${n}</td></tr>`).join('')}</tbody></table>` : vazio('fileText', 'Sem nomes informados.')}
        </div>
      </div>
      <div class="cartao" style="margin-top:18px">
        <div class="cartao-topo"><div class="ladrilho p">${ic('users')}</div><div><h3>Quem faltou</h3><p>Lista de pessoas que não estiveram presentes no dia.</p></div></div>
        <div class="tabela-rolar"><table>
          <thead><tr><th>Time</th><th>Nome</th><th>Matrícula</th><th>Motivo</th></tr></thead>
          <tbody>${r.times.flatMap(t => t.pessoas.map(p => `<tr><td>${esc(t.time)}</td><td>${esc(p.nome)}</td><td>${esc(p.matricula)}</td><td>${esc(p.motivo)}</td></tr>`)).join('')}</tbody>
        </table></div>
      </div>
      <div class="cartao nao-imprimir" style="border-color:var(--azul-borda)">
        <div class="cartao-topo">
          <div class="ladrilho p">${ic('megafone')}</div>
          <div><h3>Texto para o superior</h3><p>Fechamento de todos os times juntos, no modelo que vai para a chefia.</p></div>
          <span class="espaco"></span>
          <div class="linha">
            <label style="display:flex;align-items:center;gap:8px;font-weight:600;cursor:pointer"><input type="checkbox" id="nomesSuperior" style="width:18px;height:18px" ${nomesSup ? 'checked' : ''}> Incluir nomes</label>
            <button class="botao" id="btnCopiarSuperior">${ic('copy')}Copiar texto para o superior</button>
          </div>
        </div>
        ${revisao.length
          ? revisao.map(t => `<div class="caixa-aviso amarelo">${ic('alert')}<span>${esc(t)}</span></div>`).join('')
          : `<div class="caixa-aviso ok">${ic('checkCircle')}<span>Tudo conferido: todos os times mandaram e as contas fecham.</span></div>`}
        ${base.config.area ? '' : `<div class="caixa-aviso info">${ic('info')}<span>Coloque o nome da área em Ajustes (ex.: SUB MONTAGEM TURNO B) para ele aparecer no título.</span></div>`}
        <pre class="whats" style="margin-top:10px">${esc(textoSup)}</pre>
      </div>
      <div class="cartao nao-imprimir">
        <div class="cartao-topo">
          <div class="ladrilho p">${ic('fileText')}</div>
          <div><h3>Resumo para o grupo</h3><p>Resumo com % por time, para enviar no grupo dos líderes.</p></div>
          <span class="espaco"></span>
          <div class="linha">
            <label style="display:flex;align-items:center;gap:8px;font-weight:600;cursor:pointer"><input type="checkbox" id="comNomes" style="width:18px;height:18px" ${comNomes ? 'checked' : ''}> Incluir nomes</label>
            <button class="botao sec" id="btnImprimirDia">${ic('printer')}Imprimir / PDF</button>
            <button class="botao" id="btnCopiar">${ic('copy')}Copiar resumo</button>
          </div>
        </div>
        <pre class="whats">${esc(texto)}</pre>
      </div>`;
    $('#btnCopiar').onclick = async () => aviso(await copiar(texto) ? 'Resumo copiado. É só colar no WhatsApp.' : 'Não consegui copiar. Selecione o texto e copie.');
    $('#btnImprimirDia').onclick = () => window.print();
    $('#btnCopiarSuperior').onclick = async () => {
      if (revisao.length && !confirm(`Ainda tem ${revisao.length} ponto(s) para revisar:\n\n${revisao.map(t => '• ' + t).join('\n')}\n\nCopiar mesmo assim?`)) return;
      aviso(await copiar(textoSup) ? 'Texto copiado. É só colar na conversa com o superior.' : 'Não consegui copiar.');
    };
    $('#nomesSuperior').onchange = e => { gravarPreferencia('nomesSuperior', e.target.checked ? 'sim' : 'nao'); desenharDia(); };
    $('#comNomes').onchange = e => { desenharDia.comNomes = e.target.checked; desenharDia(); };
    ligarCobranca(cobranca);
    alvo.querySelectorAll('[data-apagar]').forEach(b => b.onclick = () => {
      const t = b.dataset.apagar;
      if (!confirm(`Apagar o lançamento do ${t} de ${L.dataBR(data)}?`)) return;
      delete base.fechamentos[L.chaveFechamento(data, t)];
      salvar(); desenharDia(); aviso(`${t} apagado.`);
    });
  }

  function ligarCobranca(cobranca) {
    const b = $('#btnCobranca');
    if (b) b.onclick = async () => aviso(await copiar(cobranca) ? 'Cobrança copiada. Cole no grupo.' : 'Não consegui copiar.');
  }

  function chipsHTML(r) {
    const esperados = base.config.times.length ? base.config.times : r.recebidos;
    if (!esperados.length) return '';
    return `<div class="chips">${esperados.slice().sort(ordenarTimes).map(t => r.recebidos.includes(t)
        ? `<span class="chip ok">${esc(t)} ${ic('check')}</span>`
        : `<span class="chip falta">${esc(t)} pendente</span>`).join('')}
      ${r.recebidos.filter(t => !esperados.includes(t)).map(t => `<span class="chip ok">${esc(t)} ${ic('check')}</span>`).join('')}</div>`;
  }
  $('#dataDia').addEventListener('change', desenharDia);

  // ---------- Histórico ----------
  function desenharBusca() {
    const b = $('#buscaPessoa').value;
    const alvo = $('#resultadoBusca');
    if (!b.trim()) { alvo.innerHTML = ''; return; }
    const linhas = L.historicoPessoa(base, b);
    if (!linhas.length) { alvo.innerHTML = `<div style="margin-top:16px">${vazio('search', 'Ninguém encontrado.')}</div>`; return; }
    alvo.innerHTML = `<p style="margin:16px 0 8px"><b>${linhas.length}</b> ausência(s)</p>
      <div class="tabela-rolar"><table class="cinza"><thead><tr><th>Data</th><th>Dia</th><th>Time</th><th>Nome</th><th>Matrícula</th><th>Motivo</th></tr></thead>
      <tbody>${linhas.map(l => `<tr><td>${L.dataBR(l.data)}</td><td>${L.DIAS_SEMANA[L.diaDaSemana(l.data)]}</td><td>${esc(l.time)}</td><td>${esc(l.nome)}</td><td>${esc(l.matricula)}</td><td>${esc(l.motivo)}</td></tr>`).join('')}</tbody></table></div>`;
  }
  $('#buscaPessoa').addEventListener('input', desenharBusca);

  function definirPeriodo(tipo) {
    const ref = new Date(ultimaData() + 'T12:00:00Z');
    const iso = d => d.toISOString().slice(0, 10);
    const d = new Date(ref);
    let de, ate;
    if (tipo === 'semana' || tipo === 'semanaPassada') {
      const volta = (d.getUTCDay() + 6) % 7; // segunda-feira da semana
      d.setUTCDate(d.getUTCDate() - volta - (tipo === 'semanaPassada' ? 7 : 0));
      de = iso(d); d.setUTCDate(d.getUTCDate() + 6); ate = iso(d);
    } else if (tipo === 'mes' || tipo === 'mesPassado') {
      const ini = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth() - (tipo === 'mesPassado' ? 1 : 0), 1, 12));
      const fim = new Date(Date.UTC(ini.getUTCFullYear(), ini.getUTCMonth() + 1, 0, 12));
      de = iso(ini); ate = iso(fim);
    } else {
      ate = iso(ref); de = L.somarDias(ate, -29);
    }
    $('#periodoDe').value = de; $('#periodoAte').value = ate;
    desenharPeriodo.atalho = tipo;
    desenharPeriodo();
  }

  function graficoHTML(p, serie) {
    const pontos = p.dias.map(d => {
      const x = serie === 'Geral' ? p.porDia[d] : p.celulas[L.chaveFechamento(d, serie)];
      return x && x.efetivo ? { d, v: x.faltas / x.efetivo } : null;
    }).filter(Boolean);
    if (!pontos.length) return vazio('chart', 'Sem dados para esse time no período.');
    const larg = ($('#resultadoPeriodo').clientWidth || 760) - 32;
    const W = Math.max(320, Math.min(760, larg)), H = W < 500 ? 220 : 260, E = 42, D = 12, T = 14, B = 30;
    const maxV = Math.max(...pontos.map(x => x.v), p.meta || 0, 0.01) * 1.15;
    const passo = maxV > 0.2 ? 0.05 : maxV > 0.08 ? 0.02 : 0.01;
    const topo = Math.ceil(maxV / passo) * passo;
    const X_ = i => E + (pontos.length === 1 ? (W - E - D) / 2 : i * (W - E - D) / (pontos.length - 1));
    const Y = v => T + (1 - v / topo) * (H - T - B);
    const grade = [];
    for (let v = 0; v <= topo + 1e-9; v += passo)
      grade.push(`<line class="grade" x1="${E}" x2="${W - D}" y1="${Y(v)}" y2="${Y(v)}"/><text x="${E - 6}" y="${Y(v) + 4}" text-anchor="end">${L.pct(v, 1).replace(',0%', '%')}</text>`);
    const cada = Math.ceil(pontos.length / Math.max(4, Math.floor((W - E) / 58)));
    const rotulos = pontos.map((x, i) => i % cada ? '' : `<text x="${X_(i)}" y="${H - 12}" text-anchor="middle">${L.dataBR(x.d).slice(0, 5)}</text>`).join('');
    const linha = pontos.map((x, i) => `${i ? 'L' : 'M'}${X_(i).toFixed(1)},${Y(x.v).toFixed(1)}`).join(' ');
    const bolas = pontos.map((x, i) => `<circle class="pt${p.meta && x.v > p.meta ? ' acima' : ''}" cx="${X_(i)}" cy="${Y(x.v)}" r="4"><title>${L.dataBR(x.d)} (${L.DIAS_SEMANA[L.diaDaSemana(x.d)]}): ${L.pct(x.v, 1)}</title></circle>`).join('');
    const meta = p.meta ? `<line class="meta" x1="${E}" x2="${W - D}" y1="${Y(p.meta)}" y2="${Y(p.meta)}"/><text class="meta-txt" x="${W - D}" y="${Y(p.meta) - 6}" text-anchor="end">meta ${L.pctMeta(p.meta)}</text>` : '';
    return `<svg class="grafico" viewBox="0 0 ${W} ${H}" role="img" aria-label="Absenteísmo por dia – ${esc(serie)}">${grade.join('')}${meta}<path class="serie" d="${linha}"/>${bolas}${rotulos}</svg>`;
  }

  function desenharPeriodo() {
    if (!$('#periodoAte').value) $('#periodoAte').value = ultimaData();
    if (!$('#periodoDe').value) { $('#periodoDe').value = L.somarDias($('#periodoAte').value, -6); desenharPeriodo.atalho = null; }
    document.querySelectorAll('[data-periodo]').forEach(b => b.classList.toggle('ligado', b.dataset.periodo === desenharPeriodo.atalho));
    const de = $('#periodoDe').value, ate = $('#periodoAte').value;
    const p = L.resumoPeriodo(base, de, ate);
    const alvo = $('#resultadoPeriodo');
    if (!p.dias.length) {
      $('#faixaPeriodo').innerHTML = '';
      alvo.innerHTML = `<div class="cartao">${vazio('calendar', 'Nada gravado nesse período.')}</div>`;
      return;
    }
    const alertas = L.alertasReincidencia(base, ate, 30, 3);
    const texto = L.textoPeriodo(p, alertas);
    const serie = desenharPeriodo.serie && (desenharPeriodo.serie === 'Geral' || p.times.includes(desenharPeriodo.serie)) ? desenharPeriodo.serie : 'Geral';
    const pc = (f, e) => `<span class="${L.acimaDaMeta(f, e, p.meta) ? 'acima' : ''}">${L.pct(f, e)}</span>`;
    const cel = (t, d) => { const c = p.celulas[L.chaveFechamento(d, t)]; return c ? pc(c.faltas, c.efetivo) : '<span class="igual">–</span>'; };
    const piorDia = p.porDiaSemana.length > 1 ? p.porDiaSemana.slice().sort((a, b) => b.faltas / b.efetivo - a.faltas / a.efetivo)[0].nome : null;

    // Faltou mais de uma vez dentro do período
    const vezes = {};
    const fs = Object.values(base.fechamentos).filter(f => f.data >= de && f.data <= ate);
    for (const f of fs) for (const x of f.pessoas) {
      const k = x.matricula || x.nome;
      vezes[k] = vezes[k] || { nome: x.nome, matricula: x.matricula, time: f.time, n: 0, motivos: {} };
      vezes[k].n++; vezes[k].motivos[x.motivo] = (vezes[k].motivos[x.motivo] || 0) + 1;
    }
    const repetiu = Object.values(vezes).filter(v => v.n > 1).sort((a, b) => b.n - a.n);

    $('#faixaPeriodo').innerHTML = `
      <div class="faixa">
        <div class="ladrilho">${ic('chart')}</div>
        <div><div class="rot">Absenteísmo no período</div><div class="valor">${pc(p.faltas, p.efetivo)}</div></div>
        <div class="extra">${p.meta ? `Meta ${L.pctMeta(p.meta)} · ` : ''}${p.ausentes} ausências em ${p.dias.length} dia(s) · ${L.dataBR(de)} a ${L.dataBR(ate)}</div>
      </div>`;

    alvo.innerHTML = `
      <h2 class="so-impressao">Absenteísmo – ${L.dataBR(de)} a ${L.dataBR(ate)}</h2>
      <div class="cartao">
        <div class="cartao-topo">
          <div class="ladrilho p">${ic('trend')}</div>
          <div><h3>Evolução</h3><p>Absenteísmo dia a dia${p.meta ? ', com a linha da meta' : ' (defina a meta em Ajustes para ver a linha de corte)'}.</p></div>
          <span class="espaco"></span>
          <select id="serieGrafico" style="width:auto;min-width:160px">${['Geral'].concat(p.times).map(t => `<option${t === serie ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select>
        </div>
        ${graficoHTML(p, serie)}
      </div>
      <div class="cartao">
        <div class="cartao-topo"><div class="ladrilho p">${ic('chart')}</div><div><h3>Absenteísmo por time</h3><p>Percentual de cada time por dia e no período selecionado.</p></div></div>
        <div class="tabela-rolar"><table class="cinza time-dia">
          <thead><tr><th>Time</th>${p.dias.map(d => `<th class="centro">${L.dataBR(d).slice(0, 5)}</th>`).join('')}<th class="centro">Período</th></tr></thead>
          <tbody>
            ${p.times.map(t => `<tr><td><b>${esc(t)}</b></td>${p.dias.map(d => `<td class="centro">${cel(t, d)}</td>`).join('')}<td class="centro"><b>${pc(p.porTime[t].faltas, p.porTime[t].efetivo)}</b></td></tr>`).join('')}
            <tr><td><b>Geral</b></td>${p.dias.map(d => `<td class="centro"><b>${pc(p.porDia[d].faltas, p.porDia[d].efetivo)}</b></td>`).join('')}<td class="centro"><b>${pc(p.faltas, p.efetivo)}</b></td></tr>
          </tbody>
        </table></div>
        ${p.dias.length > 3 ? '<div class="dica-rolar">Arraste a tabela para o lado para ver os outros dias →</div>' : ''}
      </div>
      <div class="grade-2">
        <div class="cartao">
          <div class="cartao-topo"><div class="ladrilho p laranja">${ic('users')}</div><div><h3>Faltou mais de uma vez</h3><p>Pessoas com mais de uma ausência no período.</p></div></div>
          ${repetiu.length ? `<div class="tabela-rolar"><table class="cinza"><thead><tr><th>Nome</th><th>Time</th><th class="num">Vezes</th><th>Motivos</th></tr></thead><tbody>
            ${repetiu.map(v => `<tr><td>${esc(v.nome)}<br><span style="color:var(--fraco);font-size:13px">${esc(v.matricula)}</span></td><td>${esc(v.time)}</td><td class="num"><b>${v.n}</b></td>
              <td style="font-size:14px">${Object.entries(v.motivos).map(([m, n]) => `${esc(m)} (${n})`).join(', ')}</td></tr>`).join('')}
          </tbody></table></div>` : vazio('users', 'Ninguém repetiu no período.')}
        </div>
        <div class="cartao">
          <div class="cartao-topo"><div class="ladrilho p verde">${ic('fileText')}</div><div><h3>Por motivo</h3><p>Principais motivos de ausência no período.</p></div></div>
          <table class="cinza"><thead><tr><th>Motivo</th><th class="num">Quantidade</th></tr></thead>
            <tbody>${Object.entries(p.porMotivo).sort((a, b) => b[1] - a[1]).map(([m, n]) => `<tr><td>${esc(m)}</td><td class="num">${n}</td></tr>`).join('')}</tbody></table>
        </div>
      </div>
      <div class="grade-2">
        <div class="cartao">
          <div class="cartao-topo"><div class="ladrilho p">${ic('calendar')}</div><div><h3>Por dia da semana</h3><p>Em qual dia se falta mais.</p></div></div>
          <table class="cinza"><thead><tr><th>Dia</th><th class="num">Dias lançados</th><th class="num">Faltas</th><th class="num">%</th></tr></thead><tbody>
            ${p.porDiaSemana.map(s => `<tr><td>${s.nome === piorDia ? `<b>${s.nome}</b> <span class="etiqueta">mais falta</span>` : s.nome}</td>
              <td class="num">${p.dias.filter(d => L.DIAS_SEMANA[L.diaDaSemana(d)] === s.nome).length}</td>
              <td class="num">${s.faltas}</td><td class="num">${pc(s.faltas, s.efetivo)}</td></tr>`).join('')}
          </tbody></table>
        </div>
        <div class="cartao">
          <div class="cartao-topo"><div class="ladrilho p vermelho">${ic('alert')}</div><div><h3>Atenção: 3 ou mais ausências em 30 dias</h3><p>Até ${L.dataBR(ate)}. Vale uma conversa do líder.</p></div></div>
          ${alertas.length ? `<div class="tabela-rolar"><table class="cinza"><thead><tr><th>Nome</th><th>Time</th><th class="num">Vezes</th><th>Datas</th></tr></thead><tbody>
            ${alertas.map(a => `<tr><td>${esc(a.nome)}<br><span style="color:var(--fraco);font-size:13px">${esc(a.matricula)}</span></td><td>${esc(a.time)}</td>
              <td class="num"><b>${a.total}</b></td>
              <td style="font-size:14px">${a.datas.map(d => L.dataBR(d).slice(0, 5)).join(', ')}${a.padraoDia ? `<br><span class="etiqueta">quase sempre na ${a.padraoDia.toLowerCase()}</span>` : ''}</td></tr>`).join('')}
          </tbody></table></div>` : vazio('checkCircle', 'Ninguém com 3 ou mais ausências.')}
        </div>
      </div>
      <div class="cartao nao-imprimir" style="margin-top:18px">
        <div class="cartao-topo">
          <div class="ladrilho p">${ic('fileText')}</div>
          <div><h3>Resumo do período para o WhatsApp</h3><p>Copie e cole no grupo.</p></div>
          <span class="espaco"></span>
          <div class="linha">
            <button class="botao sec" id="btnImprimirPeriodo">${ic('printer')}Imprimir / PDF</button>
            <button class="botao" id="btnCopiarPeriodo">${ic('copy')}Copiar resumo</button>
          </div>
        </div>
        <pre class="whats">${esc(texto)}</pre>
      </div>`;
    $('#serieGrafico').onchange = e => { desenharPeriodo.serie = e.target.value; desenharPeriodo(); };
    $('#btnCopiarPeriodo').onclick = async () => aviso(await copiar(texto) ? 'Resumo do período copiado.' : 'Não consegui copiar.');
    $('#btnImprimirPeriodo').onclick = () => window.print();
  }
  const mudouData = () => { desenharPeriodo.atalho = null; desenharPeriodo(); };
  $('#periodoDe').addEventListener('change', mudouData);
  $('#periodoAte').addEventListener('change', mudouData);
  document.querySelector('.atalhos').addEventListener('click', e => {
    const b = e.target.closest('[data-periodo]'); if (b) definirPeriodo(b.dataset.periodo);
  });

  // ---------- Ajustes ----------
  function desenharModelo() {
    $('#previaModelo').textContent = L.textoModelo(hoje(), $('#modeloTime').value);
  }
  function contarTimes() {
    const n = $('#cfgTimes').value.split(/[\n;]+/).map(L.normalizarTime).filter(Boolean).length;
    $('#contagemTimes').textContent = `${n} time(s)`;
  }

  function desenharAjustes() {
    mostrarEstadoExcel();
    $('#cfgMeta').value = base.config.meta ? +(base.config.meta * 100).toFixed(2) : '';
    $('#cfgArea').value = base.config.area || '';
    const times = base.config.times.length ? base.config.times
      : [...new Set(Object.values(base.fechamentos).map(f => f.time))].sort(ordenarTimes);
    const escolhido = $('#modeloTime').value;
    $('#modeloTime').innerHTML = ['<option value="">Sem time (o líder escreve)</option>']
      .concat(times.map(t => `<option${t === escolhido ? ' selected' : ''}>${esc(t)}</option>`)).join('');
    desenharModelo();
    $('#cfgTimes').value = base.config.times.join('\n');
    contarTimes();
    $('#cfgNaoContam').innerHTML = L.MOTIVOS.map(m => `
      <label><input type="checkbox" value="${esc(m)}" ${base.config.naoContam.includes(m) ? 'checked' : ''}> ${esc(m)}</label>`).join('');
    const ap = Object.entries(base.config.apelidos);
    $('#cfgApelidos').innerHTML = ap.length
      ? `<table class="cinza"><thead><tr><th>Quando o líder escreve</th><th>Vira</th><th></th></tr></thead><tbody>${ap.map(([k, v]) =>
          `<tr><td>${esc(k)}</td><td>${esc(v)}</td><td class="num"><button class="botao perigo p" data-apelido="${esc(k)}">Esquecer</button></td></tr>`).join('')}</tbody></table>`
      : vazio('fileText', 'Nenhum motivo ainda.', 'Os motivos que o sistema aprender aparecerão aqui.');
  }
  $('#cfgTimes').addEventListener('input', contarTimes);
  $('#btnSalvarTimes').addEventListener('click', () => {
    base.config.times = [...new Set($('#cfgTimes').value.split(/[\n;]+/).map(L.normalizarTime).filter(Boolean))].sort(ordenarTimes);
    salvar(); desenharAjustes(); aviso(`${base.config.times.length} time(s) salvo(s).`);
  });
  $('#btnTimesDosLancamentos').addEventListener('click', () => {
    const ts = [...new Set(Object.values(base.fechamentos).map(f => f.time).concat(base.config.times))].sort(ordenarTimes);
    $('#cfgTimes').value = ts.join('\n'); contarTimes();
    aviso('Confira a lista e clique em Salvar times.');
  });
  $('#cfgNaoContam').addEventListener('change', () => {
    base.config.naoContam = [...document.querySelectorAll('#cfgNaoContam input:checked')].map(i => i.value);
    salvar(); aviso('Salvo.');
  });
  $('#cfgApelidos').addEventListener('click', e => {
    const b = e.target.closest('[data-apelido]'); if (!b) return;
    delete base.config.apelidos[b.dataset.apelido]; salvar(); desenharAjustes();
  });
  $('#btnSalvarMeta').addEventListener('click', () => {
    const v = $('#cfgMeta').value.trim().replace(',', '.');
    if (v !== '' && !(+v > 0 && +v < 100)) { alert('Digite a meta em %, por exemplo 3 ou 2,5.'); return; }
    base.config.meta = v === '' ? null : +v / 100;
    base.config.area = $('#cfgArea').value.trim().replace(/\s+/g, ' ').toUpperCase();
    salvar(); aviso('Área e meta salvas.');
  });
  $('#modeloTime').addEventListener('change', desenharModelo);
  $('#btnCopiarModelo').addEventListener('click', async () =>
    aviso(await copiar($('#previaModelo').textContent) ? 'Modelo copiado. Cole no grupo dos líderes.' : 'Não consegui copiar.'));

  $('#btnBackup').addEventListener('click', () => baixar(`absenteismo-backup-${hoje()}.json`, JSON.stringify(base, null, 1), 'application/json'));
  $('#arqBackup').addEventListener('change', async e => {
    const arq = e.target.files[0]; if (!arq) return;
    e.target.value = '';
    let b;
    try {
      b = /\.xlsx$/i.test(arq.name)
        ? await X.lerBackupDoExcel(new Uint8Array(await arq.arrayBuffer()))
        : JSON.parse(await arq.text());
      if (!b || !b.fechamentos) throw new Error('arquivo sem fechamentos');
    } catch (err) {
      alert(/\.xlsx$/i.test(arq.name) ? 'Não achei o backup do sistema dentro desse Excel. Use o Excel gerado por este sistema.' : 'Esse arquivo não é um backup válido.');
      return;
    }
    const n = Object.keys(b.fechamentos).length;
    if (!confirm(`O arquivo tem ${n} lançamento(s). Ele vai SUBSTITUIR os dados atuais (${Object.keys(base.fechamentos).length} lançamento(s)). Continuar?`)) return;
    base = completar(b);
    salvar(); desenharAjustes(); aviso('Dados restaurados.');
  });
  $('#btnCsvAusencias').addEventListener('click', () => baixar(`ausencias-${hoje()}.csv`, L.csvAusencias(base), 'text/csv;charset=utf-8'));
  $('#btnCsvFechamentos').addEventListener('click', () => baixar(`totais-por-time-${hoje()}.csv`, L.csvFechamentos(base), 'text/csv;charset=utf-8'));
  $('#btnApagarTudo').addEventListener('click', () => {
    if (!confirm('Apagar TODOS os lançamentos da sua conta? Some no celular e no computador. Baixe um backup antes.')) return;
    if (!confirm('Tem certeza? Não dá para desfazer.\n\nO arquivo Excel NÃO será apagado: ele fica com os dados antigos, como backup.')) return;
    const config = base.config;
    base = L.baseVazia(); base.config = config; salvar({ semExcel: true }); aviso('Dados apagados. O Excel ficou como backup.');
  });

  // ---------- Login e sincronização entre aparelhos ----------
  const abaAtual = () => (document.querySelector('.passo.ativa') || {}).dataset.aba || 'colar';
  function redesenharAtual() {
    const a = abaAtual();
    if (a === 'colar') desenharColar();
    if (a === 'conferencia') atualizarBotaoTodos();
    if (a === 'dia') desenharDia();
    if (a === 'historico') { desenharBusca(); desenharPeriodo(); }
  }

  function mostrarSinc(info) {
    const b = $('#estadoSinc');
    const hora = info.hora ? info.hora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '';
    const p = info.pendentes || 0;
    const t = {
      parado: ['', 'nuvem', 'Sincronização', ''],
      ok: ['ok', 'nuvem', hora ? `Sincronizado ${hora}` : 'Sincronizado', 'Celular e computador estão com os mesmos dados.'],
      enviando: ['', 'nuvem', 'Sincronizando…', 'Enviando as mudanças para a sua conta.'],
      offline: ['atencao', 'nuvemOff', p ? `Sem internet · ${p} p/ enviar` : 'Sem internet', 'Tudo fica salvo neste aparelho e sobe sozinho quando a internet voltar.'],
      erro: ['erro', 'nuvemOff', 'Não sincronizou', `Não consegui falar com o servidor (${info.erro || 'erro'}). Clique para tentar de novo.`],
    }[info.estado] || ['', 'nuvem', 'Sincronização', ''];
    b.className = 'pilula ' + t[0];
    b.innerHTML = ic(t[1]) + `<span>${esc(t[2])}</span>`;
    b.title = t[3];
  }

  function trocarBase(nova) {
    base = completar(nova || L.baseVazia());
    guardarLocal();
  }

  if (window.CONFIG && window.Sincronia) {
    sinc = window.Sincronia.criar({
      url: window.CONFIG.supabaseUrl, chave: window.CONFIG.supabaseChave,
      pegarBase: () => base, trocarBase, aoMudarEstado: mostrarSinc, aoReceber: redesenharAtual,
    });
  }

  // Tela de login
  let modoLogin = 'entrar'; // entrar | criar | nova-senha
  function msgLogin(texto, nivel) {
    const m = $('#msgLogin');
    m.className = 'caixa-aviso msg-login ' + (nivel || 'vermelho');
    m.innerHTML = texto ? ic(nivel === 'ok' ? 'checkCircle' : nivel === 'info' ? 'info' : 'alertCircle') + `<span>${esc(texto)}</span>` : '';
  }
  function modo(m) {
    modoLogin = m;
    $('#campoSenha2').hidden = m === 'entrar';
    $('#loginSenha2').required = m !== 'entrar';
    $('#loginEmail').closest('div').hidden = m === 'nova-senha';
    $('#loginEmail').required = m !== 'nova-senha';
    $('#loginSenha').autocomplete = m === 'entrar' ? 'current-password' : 'new-password';
    $('#btnEntrar').textContent = { entrar: 'Entrar', criar: 'Criar conta', 'nova-senha': 'Salvar nova senha' }[m];
    $('#lnkModo').textContent = m === 'entrar' ? 'Criar conta' : 'Já tenho conta';
    $('#lnkEsqueci').hidden = m !== 'entrar';
    $('#subLogin').textContent = {
      entrar: 'Entre com sua conta para ver os dados no celular e no computador.',
      criar: 'Crie sua conta com e-mail e senha. Use a mesma no celular e no computador.',
      'nova-senha': 'Digite a sua nova senha.',
    }[m];
    msgLogin('');
  }
  function traduzirErro(e) {
    const t = String((e && e.message) || e || '');
    if (/invalid login credentials/i.test(t)) return 'E-mail ou senha errados.';
    if (/email not confirmed/i.test(t)) return 'Falta confirmar o e-mail: abra o link que chegou na sua caixa de entrada (veja também o spam).';
    if (/already registered|already been registered/i.test(t)) return 'Esse e-mail já tem conta. Use "Já tenho conta" para entrar.';
    if (/password should be at least|weak password/i.test(t)) return 'Senha muito curta ou fraca. Use pelo menos 6 caracteres.';
    if (/rate limit|too many/i.test(t)) return 'Muitas tentativas seguidas. Espere alguns minutos e tente de novo.';
    if (/fetch|network/i.test(t)) return 'Sem internet. Conecte-se e tente de novo.';
    return 'Não deu certo: ' + t;
  }
  function mostrarLogin(m) {
    modo(m || 'entrar');
    $('#telaLogin').hidden = false;
    setTimeout(() => (m === 'nova-senha' ? $('#loginSenha') : $('#loginEmail')).focus(), 50);
  }
  const enderecoApp = () => location.origin + location.pathname;

  $('#lnkModo').addEventListener('click', () => modo(modoLogin === 'entrar' ? 'criar' : 'entrar'));
  $('#lnkEsqueci').addEventListener('click', async () => {
    const email = $('#loginEmail').value.trim();
    if (!email) { msgLogin('Digite seu e-mail acima e clique de novo em "Esqueci a senha".', 'info'); return; }
    const { error } = await sinc.supa.auth.resetPasswordForEmail(email, { redirectTo: enderecoApp() });
    if (error) msgLogin(traduzirErro(error));
    else msgLogin('Enviamos um link para o seu e-mail. Abra ele neste aparelho para criar uma senha nova.', 'ok');
  });

  $('#formLogin').addEventListener('submit', async e => {
    e.preventDefault();
    const email = $('#loginEmail').value.trim(), senha = $('#loginSenha').value, senha2 = $('#loginSenha2').value;
    if (modoLogin !== 'entrar' && senha !== senha2) { msgLogin('As duas senhas estão diferentes.'); return; }
    const botao = $('#btnEntrar'); botao.disabled = true;
    try {
      if (modoLogin === 'entrar') {
        const { data, error } = await sinc.supa.auth.signInWithPassword({ email, password: senha });
        if (error) throw error;
        await entrar(data.user);
      } else if (modoLogin === 'criar') {
        const { data, error } = await sinc.supa.auth.signUp({ email, password: senha, options: { emailRedirectTo: enderecoApp() } });
        if (error) throw error;
        if (data.session) await entrar(data.user);
        else { modo('entrar'); $('#loginEmail').value = email; msgLogin('Conta criada! Abra o e-mail de confirmação que enviamos e depois entre aqui com sua senha.', 'ok'); }
      } else {
        const { data, error } = await sinc.supa.auth.updateUser({ password: senha });
        if (error) throw error;
        aviso('Senha trocada.');
        await entrar(data.user);
      }
    } catch (err) {
      msgLogin(traduzirErro(err));
    } finally { botao.disabled = false; $('#loginSenha').value = ''; $('#loginSenha2').value = ''; }
  });

  async function entrar(usuario) {
    $('#telaLogin').hidden = true;
    const email = usuario.email || '';
    $('#emailUsuario').textContent = email;
    $('#nomeUsuario').textContent = email.split('@')[0];
    $('#iniciais').textContent = (email.replace(/[^a-z]/gi, '').slice(0, 2) || '?').toUpperCase();
    const n = Object.keys(base.fechamentos).length;
    await sinc.prepararUsuario(usuario, async () =>
      confirm(`Este aparelho já tem ${n} lançamento(s) de antes do login.\n\nEnviar para a sua conta, para aparecerem também nos outros aparelhos?\n\n(OK = enviar · Cancelar = descartar deste aparelho)`));
    redesenharAtual();
  }

  // Menu do usuário
  $('#btnUsuario').addEventListener('click', e => { e.stopPropagation(); $('#menuUsuario').hidden = !$('#menuUsuario').hidden; });
  document.addEventListener('click', e => { if (!e.target.closest('.usuario')) $('#menuUsuario').hidden = true; });
  $('#btnSincronizarAgora').addEventListener('click', async () => { $('#menuUsuario').hidden = true; await sinc.sincronizar(); });
  $('#estadoSinc').addEventListener('click', () => sinc && sinc.sincronizar());
  $('#btnSair').addEventListener('click', async () => {
    const p = sinc.pendentes();
    if (p && !confirm(`Ainda tem ${p} mudança(s) que não subiram (sem internet?). Se sair agora, elas se perdem.\n\nSair mesmo assim?`)) return;
    if (!p && !confirm('Sair desta conta? Os dados continuam salvos na conta; este aparelho fica limpo.')) return;
    $('#menuUsuario').hidden = true;
    try { await sinc.supa.auth.signOut(); } catch (e) { /* sem internet: sai do mesmo jeito */ }
    sinc.esquecer();
    fila = []; atualizarContador();
    trocarBase(null);
    irPara('colar');
    mostrarLogin('entrar');
  });

  // Sincroniza ao voltar para o app, quando a internet volta e a cada minuto
  document.addEventListener('visibilitychange', () => { if (!document.hidden && sinc && sinc.estado.usuario) sinc.sincronizar(); });
  window.addEventListener('online', () => sinc && sinc.estado.usuario && sinc.sincronizar());
  window.addEventListener('offline', () => mostrarSinc({ estado: 'offline', pendentes: sinc ? sinc.pendentes() : 0 }));
  setInterval(() => { if (!document.hidden && sinc && sinc.estado.usuario) sinc.sincronizar(); }, 60000);

  async function iniciarConta() {
    if (!sinc || !sinc.disponivel) {
      // Sem a biblioteca (sem internet no primeiro acesso): usa o que já está no aparelho
      const est = sinc ? sinc.estado : null;
      if (est && est.usuario) { $('#emailUsuario').textContent = est.email || ''; mostrarSinc({ estado: 'offline', pendentes: sinc.pendentes() }); return; }
      $('#telaLogin').hidden = false; modo('entrar');
      msgLogin('Precisa de internet para o primeiro acesso.', 'info');
      $('#formLogin').querySelectorAll('input,button').forEach(x => { x.disabled = true; });
      return;
    }
    sinc.supa.auth.onAuthStateChange((evento, sessao) => {
      if (evento === 'PASSWORD_RECOVERY') mostrarLogin('nova-senha');
    });
    const { data } = await sinc.supa.auth.getSession();
    if (data && data.session) return entrar(data.session.user);
    const est = sinc.estado;
    if (!navigator.onLine && est.usuario) {
      // Já entrou antes neste aparelho: abre sem internet e sincroniza quando voltar
      $('#emailUsuario').textContent = est.email || '';
      $('#nomeUsuario').textContent = (est.email || '').split('@')[0];
      mostrarSinc({ estado: 'offline', pendentes: sinc.pendentes() });
      return;
    }
    mostrarLogin('entrar');
  }

  if ('serviceWorker' in navigator && location.protocol.startsWith('http') && location.hostname !== 'localhost') {
    navigator.serviceWorker.register('sw.js').catch(e => console.warn('Service worker', e));
  }

  atualizarContador();
  desenharColar();
  iniciarExcel();
  iniciarConta();
})();
