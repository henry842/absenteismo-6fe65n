// Tela Início: o painel original, alimentado pelos dados reais do projeto atual + modal de importação.
(function () {
  'use strict';
  const { $, $$, esc, num, S, D } = UI;
  const ROTULOS_BASES = [['PEOPLE', 'Colaboradores'], ['OPERATIONS', 'Operações'], ['SKILLS', 'Matriz'], ['HISTORY', 'Histórico'], ['TRAINING', 'Treinamentos'], ['ATTENDANCE', 'Presença']];

  // Etapas concluídas de verdade: 1 importado, 2 mapeado, 3 normalizado, 4 validado sem bloqueio, 5 gerado
  function etapaAtual() {
    const s = UI.estado.sessao, g = UI.estado.geracao;
    if (g && g.ok && (!s || g.em > (s.lote.iniciado_em || ''))) return 5;
    if (!s || s.erro) return 0;
    const trabalhos = Object.values(s.trabalhos);
    const processados = trabalhos.filter(t => t.resultado);
    if (s.lote.estado === 'COMPLETED') return 4;
    if (processados.length) {
      const p = S.importacao.previa(s);
      return p.bloqueado ? 3 : 4;
    }
    if (trabalhos.length) return 2;
    return 1;
  }

  function painel() {
    const passo = etapaAtual();
    const pct = passo * 20;
    $('#progressPct').textContent = pct + '%';
    $('#progressBar').style.width = pct + '%';
    $$('.step').forEach((el, i) => { el.classList.toggle('done', i < passo); el.classList.toggle('active', i === passo && passo < 5); });
    $$('.flowCard').forEach((el, i) => { if (i < 5) el.classList.toggle('active', i === Math.min(passo, 4)); });
    const s = UI.estado.sessao;
    $('#statusTexto').textContent = !s ? 'Nenhuma importação em andamento.' : s.erro ? `Falhou: ${s.erro.message}` : `${s.lote.import_batch_id} · ${s.lote.arquivo ? s.lote.arquivo.nome : ''} · estado ${s.lote.estado} · modo ${s.modo}`;
    recentes(); qualidade(); resumoUltima(); destinos();
  }

  function recentes() {
    const lotes = (UI.estado.pacote ? UI.estado.pacote.lotes : []).slice(-5).reverse();
    if (!lotes.length) { $('#recentes').innerHTML = UI.vazio('Nenhum arquivo processado ainda.', 'Os arquivos importados aparecem aqui.'); return; }
    const status = l => l.estado === 'COMPLETED' ? (l.abas.some(a => a.severidades.ERROR || a.severidades.WARNING) ? '<td class="warn">● Com ajustes</td>' : '<td class="ok">● Processado</td>')
      : l.modo !== 'IMPORTACAO' ? `<td style="color:#9ed8ff">● ${l.modo === 'ANALISE' ? 'Só análise' : 'Simulação'}</td>` : `<td class="warn">● ${esc(l.estado)}</td>`;
    $('#recentes').innerHTML = `<table class="table"><thead><tr><th>Nome do arquivo</th><th>Tipo</th><th>Registros</th><th>Data</th><th>Status</th></tr></thead><tbody>
      ${lotes.map(l => `<tr><td>${esc(l.arquivo ? l.arquivo.nome : '—')}</td><td>${esc((l.arquivo && l.arquivo.formato || '').toUpperCase())}</td>
        <td>${num(l.abas.reduce((t, a) => t + a.importados, 0))}</td><td>${UI.dataHora(l.finalizado_em || l.iniciado_em)}</td>${status(l)}</tr>`).join('')}</tbody></table>`;
  }

  function qualidade() {
    const p = UI.estado.pacote;
    const porBase = {};
    for (const [id] of ROTULOS_BASES) porBase[id] = S.calculateQualityScore(id, p ? p.bases[id] : [], { issues: p ? S.validatePackage(p.bases) : [], bases: p ? p.bases : {} });
    const saude = S.dicionario && C3B['core/qualidade'].saudePacote(porBase);
    const nota = saude.nota;
    $('#qualityNum').textContent = nota == null ? '—' : nota + '%';
    $('#gauge').style.background = `conic-gradient(var(--mint) 0 ${nota || 0}%,#16241f ${nota || 0}%)`;
    $('#barrasQualidade').innerHTML = ROTULOS_BASES.map(([id, rot]) => {
      const q = porBase[id];
      return `<div class="srow"><span>${rot}</span><div class="miniBar"><i style="width:${q.nota || 0}%"></i></div><b style="font-size:9px">${q.nota == null ? esc(q.rotulo) : q.nota + '%'}</b></div>`;
    }).join('');
  }

  function resumoUltima() {
    const s = UI.estado.sessao;
    const l = UI.estado.pacote && UI.estado.pacote.lotes.slice(-1)[0];
    if (!s && !l) { $('#resumoUltima').innerHTML = UI.vazio('Nenhuma importação ainda.'); return; }
    if (s && !s.erro) {
      const trab = Object.values(s.trabalhos).filter(t => t.resultado);
      const lidos = trab.reduce((t, x) => t + x.resultado.registros.length, 0);
      const colunas = Object.values(s.trabalhos).reduce((t, x) => t + x.mapeamento.filter(m => m.campo).length, 0);
      const ajustes = trab.reduce((t, x) => t + x.resultado.log.filter(g => g.status !== 'OK').length, 0);
      const p = trab.length ? S.importacao.previa(s) : null;
      $('#resumoUltima').innerHTML = `<div class="sumGrid"><div class="sumBox"><b>${num(lidos)}</b><small>Registros lidos</small></div><div class="sumBox"><b>${num(colunas)}</b><small>Colunas mapeadas</small></div>
        <div class="sumBox"><b>${num(s.abas.filter(a => !a.virtual).length)}</b><small>Abas detectadas</small></div><div class="sumBox"><b>${num(ajustes)}</b><small>Ajustes sugeridos</small></div></div>
        ${!p ? `<div class="ready" style="border-color:#35534a;background:#0d1714;color:#b6c6bf">Revise o mapeamento e processe</div>`
          : p.bloqueado ? `<div class="ready" style="border-color:#7a2d2d;background:#240e0e;color:#ffb3b3">✕ ${p.contagem.BLOCKING} bloqueio(s) a resolver</div>`
          : s.lote.estado === 'COMPLETED' ? '<div class="ready">✓ Confirmado · pronto para gerar</div>' : '<div class="ready" style="border-color:#8a6b1c;background:#2a2210;color:#ffe199">Pronto para confirmar</div>'}`;
      return;
    }
    const lidos = l.abas.reduce((t, a) => t + a.encontrados, 0);
    $('#resumoUltima').innerHTML = `<div class="sumGrid"><div class="sumBox"><b>${num(lidos)}</b><small>Registros lidos</small></div><div class="sumBox"><b>${num(l.abas.reduce((t, a) => t + a.importados, 0))}</b><small>Importados</small></div>
      <div class="sumBox"><b>${num(l.abas.length)}</b><small>Abas processadas</small></div><div class="sumBox"><b>${num(l.abas.reduce((t, a) => t + a.corrigidos, 0))}</b><small>Corrigidos</small></div></div>`;
  }

  function destinos() {
    const st = UI.storage();
    const ligado = st.id !== 'download';
    $('#destinos').innerHTML = `<div class="integrCard"><b>☁ Pasta C3B${st.id === 'fsaccess' ? ` (${esc(st.handle.name)})` : ''}</b><small>${esc(st.descricaoDestino)}</small>
        <span class="pill ${ligado ? '' : 'aviso'}">${ligado ? 'Conectado' : 'Downloads do navegador'}</span></div>
      <div class="integrCard"><b>☁ Integração com C3B</b><small>Serviços expostos em window.C3B.servicos (analyzeWorkbook, validateDataset, generateOfficialWorkbook, diagnoseInstallation…)</small><span class="pill">Contrato preparado</span></div>`;
  }

  // ---------- modal de importação ----------
  let arquivo = null, token = null;
  function abrirModal() {
    arquivo = null; $('#fileMeta').classList.remove('show'); $('#fileInput').value = '';
    $('#progressoImport').classList.remove('show'); $('#simulateBtn').disabled = false; $('#closeModal').textContent = 'Cancelar';
    $('#importModal').classList.add('show');
  }
  function fecharModal() { $('#importModal').classList.remove('show'); }
  function mostrarArquivo(f) {
    arquivo = f;
    const ext = UI.S.util.nomeSeguro(f.name).split('.').pop().toLowerCase();
    const ok = ['xlsx', 'xlsm', 'csv'].includes(ext);
    $('#fileMeta').classList.add('show');
    $('#fileMeta').innerHTML = `<b>${esc(f.name)}</b><div style="color:#94a79f;margin-top:5px">${(f.size / 1048576).toFixed(2)} MB • .${esc(ext)} • modificado em ${new Date(f.lastModified).toLocaleString('pt-BR')}</div>
      ${ext === 'xls' ? '<div class="banner erro" style="margin-top:8px">Arquivo .xls (Excel 97-2003) não é suportado. Abra no Excel e salve como .xlsx.</div>' : !ok ? '<div class="banner erro" style="margin-top:8px">Extensão não reconhecida. Use .xlsx, .xlsm ou .csv.</div>' : ''}`;
  }
  async function analisar(bytes, nome, { modificado = null, exemplo = false, modo = null } = {}) {
    token = S.util.tokenCancelamento();
    $('#progressoImport').classList.add('show'); $('#simulateBtn').disabled = true; $('#closeModal').textContent = 'Cancelar análise';
    const progresso = (p, txt) => { $('#progressoImportBar').style.width = p + '%'; $('#progressoImportTxt').textContent = `${txt || ''} (${p}%)`; };
    const t0 = performance.now();
    UI.estado.exemplo = exemplo;
    const pacote = exemplo ? S.createPackage({ empresa: 'EXEMPLO', unidade: 'EXEMPLO', equipe: 'EXEMPLO' }, 'exemplo') : UI.pacote();
    if (exemplo) UI.estado.pacoteReal = UI.estado.pacote, UI.estado.pacote = pacote;
    const sessao = await S.importacao.iniciar({ bytes, nome, modificado, pacote, modo: modo || $('#modoSelect').value, usuario: UI.usuario(), token, progresso, ExcelJS: window.ExcelJS });
    UI.medir('Análise do arquivo', { arquivo: nome, tempo_ms: Math.round(performance.now() - t0), abas: sessao.abas.length, linhas: sessao.abas.reduce((t, a) => t + (a.linhas || 0), 0) });
    $('#simulateBtn').disabled = false; $('#closeModal').textContent = 'Cancelar';
    if (sessao.erro) {
      $('#progressoImport').classList.remove('show');
      if (sessao.lote.estado === 'CANCELLED') { UI.toast('Análise cancelada. Nada foi alterado.'); return; }
      $('#fileMeta').classList.add('show');
      $('#fileMeta').innerHTML += `<div class="banner erro" style="margin-top:8px"><b>${esc(sessao.erro.message)}</b>${sessao.erro.comoResolver ? '<br>' + esc(sessao.erro.comoResolver) : ''}</div>`;
      return;
    }
    UI.estado.sessao = sessao; UI.estado.abaAtiva = null;
    fecharModal();
    UI.banner(exemplo ? '<b>MODO EXEMPLO</b> — planilha fictícia gerada para demonstração. O processamento é real, mas nada disto entra no seu projeto. Para sair, clique em "Iniciar Importação" e escolha um arquivo seu.' : '', exemplo ? '' : '');
    UI.ir('importacao');
  }

  UI.telas.inicio = { render: painel, painel, abrirModal, analisar };

  document.addEventListener('DOMContentLoaded', () => {
    $('#startImport').onclick = abrirModal; $('#quickImport').onclick = abrirModal;
    $('#closeModal').onclick = () => { if (token && $('#simulateBtn').disabled) token.cancelar(); else fecharModal(); };
    $('#importModal').addEventListener('click', e => { if (e.target === $('#importModal') && !$('#simulateBtn').disabled) fecharModal(); });
    const drop = $('#dropzone');
    ['dragenter', 'dragover'].forEach(n => drop.addEventListener(n, e => { e.preventDefault(); drop.classList.add('drag'); }));
    ['dragleave', 'drop'].forEach(n => drop.addEventListener(n, e => { e.preventDefault(); drop.classList.remove('drag'); }));
    drop.addEventListener('drop', e => { if (e.dataTransfer.files[0]) mostrarArquivo(e.dataTransfer.files[0]); });
    $('#fileInput').addEventListener('change', () => { if ($('#fileInput').files[0]) mostrarArquivo($('#fileInput').files[0]); });
    $('#simulateBtn').onclick = async () => {
      if (!arquivo) { $('#fileMeta').classList.add('show'); $('#fileMeta').innerHTML = '<span style="color:#ffcc4a">Selecione um arquivo antes de analisar.</span>'; return; }
      try {
        if (UI.estado.exemplo && UI.estado.pacoteReal !== undefined) { UI.estado.pacote = UI.estado.pacoteReal; UI.estado.exemplo = false; UI.banner(''); }
        await analisar(new Uint8Array(await arquivo.arrayBuffer()), arquivo.name, { modificado: new Date(arquivo.lastModified).toISOString() });
      } catch (e) { UI.erro(e, 'Importação'); $('#simulateBtn').disabled = false; }
    };
    $('#loadExample').onclick = async () => {
      try { abrirModal(); await analisar(await UI.gerarPlanilhaExemplo(), 'EXEMPLO_C3B_ficticio.xlsx', { exemplo: true, modo: 'IMPORTACAO' }); }
      catch (e) { UI.erro(e, 'Exemplo'); }
    };
    $('#quickUltimo').onclick = async () => {
      const p = await UI.ler('pacote');
      if (!p) { UI.toast('Nenhum projeto salvo neste navegador ainda.', true); return; }
      UI.estado.pacote = p; UI.estado.exemplo = false; UI.banner('');
      UI.toast(`Projeto aberto: ${p.manifesto.empresa || '(sem empresa)'} · ${Object.entries(p.bases).map(([k, v]) => v.length).reduce((a, b) => a + b, 0)} registros.`);
      UI.ir('geracao');
    };
    $('#quickDiag').onclick = () => { UI.ir('config'); setTimeout(() => { const el = $('#blocoDiagnostico'); if (el) el.scrollIntoView({ behavior: 'smooth' }); }, 100); };
    $('#startNova').onclick = () => UI.ir('nova');
    $$('[data-ir]').forEach(el => el.addEventListener('click', () => UI.ir(el.dataset.ir)));
  });
})();
