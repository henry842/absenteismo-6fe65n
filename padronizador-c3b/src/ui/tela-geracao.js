// Tela Geração: saúde do pacote por base, destino dos arquivos, geração (completo / só ausentes /
// atualizar selecionadas) pelo pipeline seguro, checklist marcado só com etapas que aconteceram de fato,
// exportação avulsa, visualização das bases e edição em massa com prévia.
(function () {
  'use strict';
  const { $, $$, esc, num, S, D, U } = UI;
  const BASES = ['PEOPLE', 'OPERATIONS', 'SKILLS', 'HISTORY', 'TRAINING', 'ATTENDANCE'];
  const sel = new Set();
  const visor = { base: 'PEOPLE', texto: '', marcados: new Set(), previa: null };
  let gerando = false;

  function saude(p) {
    const issues = S.validatePackage(p.bases);
    const porBase = {};
    for (const b of BASES) porBase[b] = S.calculateQualityScore(b, p.bases[b], { issues, bases: p.bases });
    return { issues, porBase, geral: C3B['core/qualidade'].saudePacote(porBase) };
  }

  function render() {
    const el = $('#telaGeracao');
    const p = UI.pacote();
    const st = UI.storage();
    const h = saude(p);
    const bloq = h.issues.filter(i => i.severidade === 'BLOCKING');
    const g = UI.estado.geracao;
    el.innerHTML = `<div class="telaHead"><div><h2>5. Geração das Bases <small>生成官方数据 · pacote oficial C3B</small></h2>
      <div class="sub">Cada arquivo passa por: ler o atual → comparar → validar → backup → gerar → gravar → reler e verificar → registrar log. O checklist abaixo só marca o que realmente aconteceu.</div></div></div>
      ${UI.estado.exemplo ? '<div class="banner">MODO EXEMPLO: os arquivos gerados conterão dados fictícios (empresa "EXEMPLO").</div>' : ''}
      <div class="grid2">
        <div class="panel bloco"><h3>Saúde do pacote<small>数据包健康度 · ${h.geral.nota == null ? 'sem dados' : h.geral.nota + '%'}</small></h3>
          <div class="statusBase" style="color:#8fa39a;font-weight:700"><span>Base</span><span>Arquivo</span><span>Status</span><span>Registros · nota</span><span>Versão · ações</span></div>
          ${D.SCHEMAS.map(s => linhaBase(p, s, h)).join('')}
          ${bloq.length ? `<div class="banner erro" style="margin-top:10px">✕ ${bloq.length} referência(s) quebrada(s) entre bases (ex.: ${esc(bloq[0].mensagem)}). As bases afetadas não são gravadas sem resolver ou sem decisão administrativa.</div>` : ''}
        </div>
        <div class="panel bloco"><h3>Onde os arquivos vão ficar<small>存储位置</small></h3>
          <div class="integrCard"><b>${esc(st.nome)}</b><small>${esc(st.descricaoDestino)}</small><span class="pill ${st.id === 'download' ? 'aviso' : ''}">${st.suportaLeitura ? 'Leitura e gravação' : 'Só download'}</span></div>
          <div style="font-size:12px;color:#9fb3aa;margin:8px 0">Pasta raiz do pacote: <b class="mono">${esc(UI.estado.raiz || '(raiz)')}</b> · subpastas BACKUP, EXPORTACOES, RELATORIOS, LOGS ${st.suportaDiretorios ? 'são criadas' : 'não existem no modo downloads'}.</div>
          <button class="btn sm" data-ir-tela="config">Trocar destino em Configurações</button>
          <h3 style="margin-top:16px">Gerar<small>生成</small></h3>
          <div class="btnRow" style="flex-wrap:wrap">
            <button class="btn primary" id="gerarCompleto" ${gerando ? 'disabled' : ''}>▦ Gerar pacote completo (8 arquivos)</button>
            <button class="btn" id="gerarAusentes" ${gerando || !st.suportaLeitura ? 'disabled title="Precisa de pasta escolhida ou Bridge"' : ''}>Gerar só os ausentes</button>
            <button class="btn" id="gerarSel" ${gerando || !sel.size ? 'disabled' : ''}>Atualizar ${sel.size} base(s) marcada(s)</button>
          </div>
          ${bloq.length ? `<label class="campo so-implantador" style="margin-top:8px"><b>Decisão administrativa (opcional) para gravar mesmo com bloqueios</b><input class="input" id="motivoOverride" placeholder="motivo — fica registrado no log e nas DECISOES"/></label>` : ''}
          <div class="progressoImport" id="progGerar"><div class="bar"><i id="progGerarBar"></i></div><small id="progGerarTxt"></small></div>
        </div>
      </div>
      <div class="panel bloco"><h3>Checklist da última geração<small>生成检查清单</small></h3>${checklist(g)}</div>
      <div class="panel bloco"><h3>Ver e editar bases<small>查看与批量编辑</small></h3>${visorHTML(p)}</div>`;
    ligar(p);
  }

  function linhaBase(p, s, h) {
    const arq = p.arquivos[s.id] || {};
    const q = h.porBase[s.id];
    const status = s.id === 'MANIFEST' || s.id === 'CONFIG' ? (arq.data_version ? 'VALIDO' : 'NAO_INICIADO') : q.status;
    const regs = p.bases[s.id];
    return `<div class="statusBase"><span><b>${s.base}</b></span><span>${esc(s.nome_pt)}<div class="mono" style="color:#8fa39a">${esc(s.arquivo)}</div></span><span>${UI.tagStatus(status)}</span>
      <span>${regs ? num(regs.length) + ' reg.' : '—'}${q && q.nota != null ? ` · ${q.nota}%` : ''}${s.obrigatoria ? '' : ' <small style="color:#8fa39a">(opcional)</small>'}</span>
      <span>${arq.data_version ? 'v' + arq.data_version : 'não gerado'} ${BASES.includes(s.id) ? `<label style="font-size:11px"><input type="checkbox" class="selBase" value="${s.id}" ${sel.has(s.id) ? 'checked' : ''}/> atualizar</label>
        <button class="btn sm exportar" data-base="${s.id}" ${regs && regs.length ? '' : 'disabled'}>⇩ Exportar</button>` : ''}</span></div>`;
  }

  function checklist(g) {
    if (!g) return UI.vazio('Nenhuma geração nesta sessão.', 'Os passos aparecem aqui conforme são executados de verdade.');
    const icone = e => (e.pulado ? '<span class="p">–</span>' : e.ok ? '<span class="v">✓</span>' : '<span class="x">✕</span>');
    const blocos = g.resultados.map(r => `<div style="margin:8px 0"><b>${esc(UI.nomeSchema(r.schemaId))}</b> ${r.ok ? UI.tag(`v${r.dataVersion}`, 'ok') : UI.tag('não gravado', 'erro')}
      <div class="checklist">${r.etapas.map(e => `<div>${icone(e)}<span>${esc(e.etapa)}<small>${esc(e.detalhe || '')}</small></span></div>`).join('')}</div></div>`).join('');
    const extra = [['07 Configurações', g.configuracao], ['00 Manifesto', g.manifesto]].filter(([, r]) => r).map(([n, r]) => `<div class="checklist"><div>${r.ok ? '<span class="v">✓</span>' : '<span class="x">✕</span>'}<span>${n} v${r.dataVersion || '—'}<small>${esc(r.caminho || '')}${r.backup ? ' · backup ' + esc(r.backup) : ''}${r.relido === true ? ' · relido e verificado' : r.relido === null ? ' · verificado antes do download' : ''}</small></span></div></div>`).join('');
    return `<div class="banner ${g.ok ? 'ok' : 'erro'}">${g.ok ? '✓' : '✕'} ${esc(g.mensagem)} · ${UI.dataHora(g.em)}</div><div class="grid3">${blocos}</div>${extra}`;
  }

  function visorHTML(p) {
    const s = D.schema(visor.base);
    const campos = D.camposSaida(visor.base).filter(c => !c.tecnico);
    const chave = s.chave[0];
    const todos = p.bases[visor.base] || [];
    const lista = todos.filter(r => !visor.texto || U.dobrar(Object.values(r).join(' ')).includes(U.dobrar(visor.texto)));
    const editaveis = D.camposSaida(visor.base).filter(c => c.origem === 'arquivo' && c.editable);
    const podeEditar = visor.base !== 'HISTORY';
    return `<div class="linhaForm"><label class="campo"><b>Base</b><select class="select" id="visorBase">${BASES.map(b => `<option value="${b}" ${b === visor.base ? 'selected' : ''}>${esc(UI.nomeSchema(b))} (${(p.bases[b] || []).length})</option>`).join('')}</select></label>
      <label class="campo"><b>Filtrar</b><input class="input" id="visorTexto" value="${esc(visor.texto)}" placeholder="qualquer texto"/></label>
      ${podeEditar && editaveis.length ? `<span class="so-implantador" style="display:flex;gap:8px;align-items:flex-end;flex-wrap:wrap"><label class="campo"><b>Editar em massa: campo</b><select class="select" id="massaCampo">${editaveis.map(c => `<option value="${c.field_id}">${esc(c.label_pt)}</option>`).join('')}</select></label>
        <label class="campo"><b>Novo valor</b><input class="input" id="massaValor" placeholder="ex.: T2, ATIVO, L"/></label><button class="btn sm" id="massaPrevia">Prévia (${visor.marcados.size} marcados)</button></span>` : visor.base === 'HISTORY' ? '<small style="color:#8fa39a">Histórico é só de acréscimo: não se edita.</small>' : ''}</div>
      ${visor.previa ? `<div class="banner info">Prévia: ${visor.previa.mudam} de ${visor.previa.itens.length} registro(s) mudam o campo <b>${esc(visor.previa.campo)}</b> para <b>${esc(visor.previa.valor)}</b> (${esc(visor.previa.regra)}).
        <div class="tabelaWrap" style="max-height:160px;margin:6px 0"><table class="table dados"><tbody>${visor.previa.itens.slice(0, 50).map(i => `<tr><td class="mono">${esc(i.chave)}</td><td style="color:#ffd9a6">${esc(i.antes ?? '—')}</td><td>→</td><td style="color:#7dffc0">${esc(i.depois)}</td></tr>`).join('')}</tbody></table></div>
        <button class="btn sm primary" id="massaAplicar">Aplicar</button> <button class="btn sm" id="massaCancelar">Cancelar</button></div>` : ''}
      ${todos.length ? `<div class="tabelaWrap" style="max-height:420px"><table class="table dados"><thead><tr>${podeEditar ? '<th><input type="checkbox" id="marcarTodos"/></th>' : ''}${campos.map(c => `<th title="${esc(c.field_id)}">${esc(c.label_pt)}</th>`).join('')}</tr></thead><tbody>
        ${lista.slice(0, 300).map(r => `<tr>${podeEditar ? `<td><input type="checkbox" class="marcar" value="${esc(r[chave])}" ${visor.marcados.has(r[chave]) ? 'checked' : ''}/></td>` : ''}${campos.map(c => `<td>${r[c.field_id] == null ? '<span style="color:#56685f">—</span>' : esc(r[c.field_id])}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
        <small style="color:#8fa39a">${num(lista.length)} de ${num(todos.length)} registro(s)${lista.length > 300 ? ' · mostrando 300' : ''}.</small>` : UI.vazio('Base vazia.', 'Importe uma planilha ou use a Nova Implantação.')}`;
  }

  async function gerar(modo) {
    const p = UI.pacote(), st = UI.storage();
    const motivo = ($('#motivoOverride') || {}).value;
    const override = motivo && motivo.trim() ? { motivo: motivo.trim() } : null;
    const bases = modo === 'ATUALIZAR' ? [...sel] : undefined;
    gerando = true; $('#progGerar').classList.add('show');
    $$('#telaGeracao .btnRow .btn').forEach(b => { b.disabled = true; });
    $('#progGerarBar').style.width = '15%'; $('#progGerarTxt').textContent = 'Gerando e verificando arquivos…';
    const t0 = performance.now();
    try {
      if (override) p.config.decisoes.push({ tipo: 'LIBERACAO_BLOQUEIO', detalhe: `Geração ${modo}: ${override.motivo}`, decidido_por: UI.usuario(), decidido_em: U.agoraISO() });
      const r = await S.writePackage(st, UI.estado.raiz, p, { modo, bases, usuario: UI.usuario(), override, ExcelJS: window.ExcelJS });
      const ok = r.ok;
      UI.estado.geracao = { ...r, ok, em: U.agoraISO(), mensagem: ok ? `${r.resultados.length} base(s) + Configurações + Manifesto gravados em ${st.nome}.` : r.erro || 'Falha ao gravar.' };
      UI.medir('Geração do pacote', { modo, tempo_ms: Math.round(performance.now() - t0), bases: r.resultados.length, destino: st.id });
      if (ok) await UI.guardar('snapshot:' + p.manifesto.installation_id, JSON.parse(JSON.stringify(p.bases)));
      UI.salvarProjeto();
      UI.toast(UI.estado.geracao.mensagem, !ok);
    } catch (e) {
      UI.estado.geracao = { ok: false, em: U.agoraISO(), resultados: [], mensagem: e.message };
      UI.erro(e, 'Geração');
    } finally { gerando = false; render(); UI.telas.inicio.painel(); }
  }

  function ligar(p) {
    $$('[data-ir-tela]').forEach(b => b.onclick = () => UI.ir(b.dataset.irTela));
    $$('.selBase').forEach(c => c.onchange = () => { c.checked ? sel.add(c.value) : sel.delete(c.value); render(); });
    $('#gerarCompleto').onclick = () => gerar('COMPLETO');
    $('#gerarAusentes').onclick = () => gerar('AUSENTES');
    $('#gerarSel').onclick = () => gerar('ATUALIZAR');
    $$('.exportar').forEach(b => b.onclick = async () => {
      try {
        const id = b.dataset.base, s = D.schema(id);
        const bytes = await S.generateOfficialWorkbook(id, p.bases[id], { data_version: (p.arquivos[id] || {}).data_version || 0, installation_id: p.manifesto.installation_id, sync_origin: 'EXPORTACAO_AVULSA', updated_by: UI.usuario() }, UI.opcoesExcel());
        const v = await S.verifyWorkbook(bytes, id, p.bases[id], UI.opcoesExcel());
        if (!v.ok) throw new Error('verificação falhou: ' + v.checks.filter(c => !c.ok).map(c => c.nome).join(', '));
        const nome = s.arquivo.replace(/\.xlsx$/, `__EXPORT_${U.carimbo()}.xlsx`);
        const st = UI.storage();
        if (st.suportaDiretorios && st.id !== 'download') { await st.createDirectory(U.caminhoSeguro(UI.estado.raiz, 'EXPORTACOES')); await st.writeFile(U.caminhoSeguro(UI.estado.raiz, 'EXPORTACOES', nome), bytes); UI.toast(`Exportado em EXPORTACOES/${nome}`); }
        else { UI.baixar(bytes, nome); UI.toast(`${nome} enviado para os downloads (verificado: ${v.checks.length} checagens).`); }
      } catch (e) { UI.erro(e, 'Exportar'); }
    });
    $('#visorBase').onchange = e => { visor.base = e.target.value; visor.marcados.clear(); visor.previa = null; render(); };
    $('#visorTexto').onchange = e => { visor.texto = e.target.value; render(); };
    $$('.marcar').forEach(c => c.onchange = () => { c.checked ? visor.marcados.add(c.value) : visor.marcados.delete(c.value); const b = $('#massaPrevia'); if (b) b.textContent = `Prévia (${visor.marcados.size} marcados)`; });
    const mt = $('#marcarTodos'); if (mt) mt.onchange = () => { $$('.marcar').forEach(c => { c.checked = mt.checked; mt.checked ? visor.marcados.add(c.value) : visor.marcados.delete(c.value); }); const b = $('#massaPrevia'); if (b) b.textContent = `Prévia (${visor.marcados.size} marcados)`; };
    const mp = $('#massaPrevia'); if (mp) mp.onclick = () => {
      try {
        if (!visor.marcados.size) throw new Error('Marque os registros que quer alterar.');
        visor.previa = S.cadastro.previaEmMassa(p, visor.base, [...visor.marcados], $('#massaCampo').value, $('#massaValor').value);
        render();
      } catch (e) { UI.erro(e, 'Edição em massa'); }
    };
    const ma = $('#massaAplicar'); if (ma) ma.onclick = () => {
      const r = S.cadastro.aplicarEmMassa(p, visor.base, visor.previa, { usuario: UI.usuario() });
      visor.previa = null; visor.marcados.clear(); UI.salvarProjeto();
      UI.toast(`${r.alterados} registro(s) alterado(s). Gere a base novamente para gravar no arquivo.`); render();
    };
    const mc = $('#massaCancelar'); if (mc) mc.onclick = () => { visor.previa = null; render(); };
  }

  UI.telas.geracao = { render };
})();
