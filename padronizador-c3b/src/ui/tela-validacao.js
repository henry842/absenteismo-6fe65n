// Tela Validação: Quality Score calculado dos dados, pendências por severidade, prévia do commit
// (o que entra, muda, fica igual e some em cada base), política para ausentes, liberação de bloqueio
// com motivo (só Implantador) e confirmação. Em ANALISE/SIMULACAO nada é aplicado.
(function () {
  'use strict';
  const { $, $$, esc, num, S, D } = UI;
  const filtro = { sev: '', base: '' };
  const politicas = {};
  const AU = () => C3B['core/auditoria'];

  function loteResumo(s) {
    const trab = Object.values(s.trabalhos).filter(t => t.resultado);
    return { import_batch_id: s.lote.import_batch_id, estado: s.lote.estado, modo: s.modo, arquivo: s.lote.arquivo, executado_por: s.usuario, iniciado_em: s.lote.iniciado_em, finalizado_em: s.lote.finalizado_em,
      abas: trab.map(t => AU().resumoAba({ aba: t.aba, schema: t.schema, registros: t.resultado.registros, ignoradas: t.resultado.ignoradas, log: t.resultado.log, issues: t.resultado.issues })),
      log: trab.flatMap(t => t.resultado.log.map(l => ({ aba: t.aba, ...l }))), issues: trab.flatMap(t => t.resultado.issues) };
  }
  UI.loteResumo = loteResumo;
  UI.naoMapeados = s => Object.values(s.trabalhos).flatMap(t => t.mapeamento.filter(m => !m.campo).map(m => ({ aba: t.aba, cabecalho: m.cabecalho, decisao: m.decisao, motivo: m.decisao === 'NAO_UTILIZADO' ? `dado não usado pelo C3B (${m.tipoNaoUtilizado})` : m.decisao === 'IGNORADO' ? 'desmarcada pelo usuário' : 'nenhum campo do padrão correspondeu' })));

  function gauge(q, titulo) {
    const n = q.nota;
    return `<div style="display:flex;gap:16px;align-items:center"><div class="gauge mini" style="background:conic-gradient(var(--mint) 0 ${n || 0}%,#16241f ${n || 0}%)"><b>${n == null ? '—' : n + '%'}</b><small>QUALIDADE</small></div>
      <div><b>${esc(titulo)}</b><div style="margin-top:6px">${UI.tagStatus(q.status)}</div></div></div>`;
  }

  function render() {
    const el = $('#telaValidacao');
    const s = UI.estado.sessao;
    const head = `<div class="telaHead"><div><h2>4. Validação <small>数据校验 · qualidade e pendências</small></h2>
      <div class="sub">A nota vem só dos dados: obrigatórios preenchidos (25), IDs válidos (20), valores reconhecidos (15), duplicidades (15), integridade entre bases (15), recomendados (5) e ambiguidades (5). Bloqueios (✕✕) impedem gravar até serem resolvidos.</div></div></div>`;
    const trab = s ? Object.values(s.trabalhos).filter(t => t.resultado) : [];
    if (!s || !trab.length) { el.innerHTML = head + `<div class="panel bloco">${UI.vazio('Nada validado ainda.', 'Processe as abas no Mapeamento.')}</div>`; return; }
    const p = S.importacao.previa(s);
    UI.estado.previa = p;
    const issues = p.issues.filter(i => (!filtro.sev || i.severidade === filtro.sev) && (!filtro.base || i.schema === filtro.base));
    const cont = p.contagem;
    const concluido = s.lote.estado === 'COMPLETED';
    const qualidades = trab.map(t => ({ t, q: S.calculateQualityScore(t.schema, p.futuras[t.schema], { issues: p.issues, bases: p.futuras }) }));
    el.innerHTML = head + `
      ${concluido ? `<div class="banner ok">✓ Importação ${esc(s.lote.import_batch_id)} confirmada: os dados já estão no pacote. Vá para <b>Geração</b> para gravar os arquivos oficiais.</div>` : ''}
      ${s.modo !== 'IMPORTACAO' ? `<div class="banner info">Modo <b>${s.modo === 'ANALISE' ? 'Analisar sem alterar nada' : 'Simulação'}</b>: esta tela mostra o que aconteceria. Nenhuma base será alterada.</div>` : ''}
      <div class="grid3" style="margin-bottom:12px">${qualidades.map(({ t, q }) => `<div class="panel bloco">${gauge(q, `${t.aba} → ${UI.nomeSchema(t.schema)}`)}
        <details class="maisInfo" open><summary>Como a nota foi calculada</summary>${q.componentes.map(c => `<div class="qualidadeLinha" style="grid-template-columns:170px 1fr 60px"><span>${esc(c.nome)} (${c.peso})</span><div class="barra"><i style="width:${c.percentual}%"></i></div><b>${c.obtido}/${c.peso}</b></div>`).join('')}</details>
        <div class="resumoLinhas">${q.resumo.slice(0, 12).map(r => `<div class="${r.nivel}">${r.icone} ${esc(r.texto)}</div>`).join('')}</div></div>`).join('')}</div>
      <div class="panel bloco"><h3>Pendências<small>问题清单</small></h3>
        <div class="linhaForm">${[['', 'Todas', cont.INFO + cont.WARNING + cont.ERROR + cont.BLOCKING], ['BLOCKING', 'Bloqueios', cont.BLOCKING], ['ERROR', 'Erros', cont.ERROR], ['WARNING', 'Avisos', cont.WARNING], ['INFO', 'Info', cont.INFO]]
          .map(([k, r, n]) => `<button class="btn sm ${filtro.sev === k ? 'primary' : ''} fSev" data-sev="${k}">${r} (${n})</button>`).join('')}
          <select class="select" id="fBase"><option value="">todas as bases</option>${[...new Set(p.issues.map(i => i.schema))].map(b => `<option value="${b}" ${filtro.base === b ? 'selected' : ''}>${esc(UI.nomeSchema(b))}</option>`).join('')}</select>
          <button class="btn sm" id="expErros">⇩ Erros e avisos (.xlsx)</button><button class="btn sm" id="expNaoMap">⇩ Não mapeados (.xlsx)</button><button class="btn sm" id="expRel">⇩ Relatório da importação (.xlsx)</button></div>
        <div style="max-height:460px;overflow:auto">${issues.length ? issues.slice(0, 300).map(i => `<div class="issue ${i.severidade}">${UI.tagSev(i.severidade)} <b>${esc(UI.nomeSchema(i.schema))}</b>${i.linha ? ` · linha ${i.linha}` : ''}${i.campo ? ` · ${esc(i.campo)}` : ''} — ${esc(i.mensagem)}<small>Como resolver: ${esc(i.comoResolver || '—')}<span class="so-implantador"> · ${esc(i.codigo)}${i.registro ? ' · ' + esc(i.registro) : ''}</span></small></div>`).join('')
          + (issues.length > 300 ? `<small style="color:#8fa39a">Mostrando 300 de ${issues.length}. Exporte a lista completa.</small>` : '') : UI.vazio('Nenhuma pendência com esse filtro.')}</div></div>
      <div class="panel bloco"><h3>O que muda nas bases (prévia do commit)<small>提交前差异</small></h3>
        <table class="table"><thead><tr><th>Base</th><th>Aba</th><th>Novos</th><th>Alterados</th><th>Iguais</th><th>Ausentes no arquivo</th><th>Sem chave</th><th>Repetidos</th><th>Eventos no histórico</th><th></th></tr></thead><tbody>
        ${Object.entries(p.porBase).map(([b, i]) => `<tr><td>${esc(UI.nomeSchema(b))}</td><td>${esc(i.aba)}</td><td class="ok">${i.adicionados}</td><td class="warn">${i.alterados}</td><td>${i.inalterados}</td>
          <td>${i.ausentesNoNovo ? `${i.ausentesNoNovo} ${politicaHTML(b)}` : '0'}</td><td>${i.semChave ? `<span style="color:#ff8a8a" title="sem chave: não entram na base">${i.semChave}</span>` : 0}</td><td>${i.repetidos ? `<span style="color:#ffd66e" title="mesma chave repetida: entra só uma vez">${i.repetidos}</span>` : 0}</td><td>${i.eventosHistorico}</td>
          <td>${i.alterados || i.ausentesNoNovo ? `<button class="btn sm verDiff" data-base="${b}">Ver diferenças</button>` : ''}</td></tr>`).join('')}</tbody></table>
        <small style="color:#8fa39a">Linhas sem chave (ex.: sem matrícula) não entram; chave repetida entra uma vez só. Registros que existem nas bases mas não vieram no arquivo nunca são apagados: você escolhe manter ou desativar (fica marcado como inativo). O Histórico só recebe eventos novos.</small></div>
      ${acoesHTML(s, p, concluido)}`;
    ligar(s, p);
  }

  function politicaHTML(b) {
    if (!['PEOPLE', 'OPERATIONS', 'SKILLS'].includes(b)) return '<small style="color:#8fa39a">(mantidos)</small>';
    const v = politicas[b] || 'MANTER';
    return `<select class="select politica" data-base="${b}" style="padding:4px"><option value="MANTER" ${v === 'MANTER' ? 'selected' : ''}>Manter</option><option value="DESATIVAR" ${v === 'DESATIVAR' ? 'selected' : ''}>Desativar</option><option value="REVISAR">Revisar lista…</option></select>`;
  }

  function acoesHTML(s, p, concluido) {
    if (concluido) return `<div class="btnRow"><button class="btn primary" data-ir-tela="geracao">Ir para Geração →</button></div>`;
    if (['CANCELLED', 'FAILED'].includes(s.lote.estado)) return `<div class="banner erro">Lote ${esc(s.lote.estado)}. Inicie uma nova importação.</div>`;
    if (s.modo !== 'IMPORTACAO') return `<div class="btnRow"><button class="btn" data-ir-tela="normalizacao">← Normalização</button><button class="btn primary" id="encerrar">Encerrar ${s.modo === 'ANALISE' ? 'análise' : 'simulação'} sem gravar</button></div>`;
    return `<div class="panel bloco"><h3>Confirmar importação<small>确认导入</small></h3>
      ${p.bloqueado ? `<div class="banner erro">✕ ${p.contagem.BLOCKING} bloqueio(s). Resolva na Normalização (ou importe a base que falta) antes de confirmar.</div>
        <div class="so-implantador"><button class="btn perigo sm" id="liberar">Liberar com decisão administrativa…</button> <small style="color:#8fa39a">Exige motivo; fica registrado em Configurações › DECISOES.</small></div>` : `<div class="banner ok">Sem bloqueios. ${p.contagem.ERROR ? `${p.contagem.ERROR} erro(s) e ` : ''}${p.contagem.WARNING} aviso(s) não impedem a confirmação.</div>`}
      <div class="btnRow"><button class="btn" data-ir-tela="normalizacao">← Normalização</button><button class="btn fantasma" id="cancelarLote">Cancelar importação</button>
        <button class="btn primary" id="confirmar" ${p.bloqueado ? 'disabled' : ''}>✓ Confirmar e aplicar às bases</button></div></div>`;
  }

  function diffModal(p, base) {
    const i = p.porBase[base];
    const alt = i.comparacao.alterados.slice(0, 200), aus = i.comparacao.ausentesNoNovo.slice(0, 200);
    const chave = D.schema(base).chave[0];
    UI.modal(`<h3>Diferenças · ${esc(UI.nomeSchema(base))}</h3>
      ${alt.length ? `<h4>Alterados (${i.alterados})</h4><div class="tabelaWrap" style="max-height:300px"><table class="table dados"><thead><tr><th>Registro</th><th>Campo</th><th>Antes</th><th>Depois</th></tr></thead><tbody>
        ${alt.flatMap(a => a.campos.map(c => `<tr><td class="mono">${esc(a.chave)}</td><td>${esc(c)}</td><td style="color:#ffd9a6">${esc(a.antes[c])}</td><td style="color:#7dffc0">${esc(a.depois[c])}</td></tr>`)).join('')}</tbody></table></div>` : ''}
      ${aus.length ? `<h4>Não vieram no arquivo (${i.ausentesNoNovo})</h4><div class="tabelaWrap" style="max-height:240px"><table class="table dados"><tbody>${aus.map(r => `<tr><td class="mono">${esc(r[chave])}</td><td>${esc(r.nome || r.descricao_pt || r.operation_id || '')}</td></tr>`).join('')}</tbody></table></div>
        ${['PEOPLE', 'OPERATIONS', 'SKILLS'].includes(base) ? `<div class="btnRow"><button class="btn" id="polManter">Manter como estão</button><button class="btn aviso" id="polDesativar">Desativar (não apaga)</button></div>` : ''}` : ''}
      <div class="modalActions"><button class="btn" data-fechar>Fechar</button></div>`, (box, fechar) => {
      const m = box.querySelector('#polManter'), d = box.querySelector('#polDesativar');
      if (m) m.onclick = () => { politicas[base] = 'MANTER'; fechar(); render(); };
      if (d) d.onclick = () => { politicas[base] = 'DESATIVAR'; fechar(); render(); };
    });
  }

  async function confirmar(s, override = null) {
    const t0 = performance.now();
    const pol = {};
    for (const b of Object.keys(UI.estado.previa.porBase)) pol[b] = politicas[b] || 'MANTER';
    const desat = Object.entries(pol).filter(([b, v]) => v === 'DESATIVAR' && UI.estado.previa.porBase[b].ausentesNoNovo);
    const texto = Object.entries(UI.estado.previa.porBase).map(([b, i]) => `${UI.nomeSchema(b)}: +${i.adicionados} novos, ${i.alterados} alterados${i.ausentesNoNovo ? `, ${i.ausentesNoNovo} ausentes (${pol[b] === 'DESATIVAR' ? 'serão desativados' : 'mantidos'})` : ''}`).join('\n');
    const ok = await UI.confirmar('Confirmar importação?', esc(texto) + (desat.length ? '\n\nDesativar não apaga: o registro fica com status inativo.' : ''), { botao: 'Confirmar' });
    if (!ok) return;
    try {
      const r = S.importacao.confirmar(s, { ausentes: pol, override });
      UI.medir('Commit da importação', { lote: s.lote.import_batch_id, tempo_ms: Math.round(performance.now() - t0) });
      UI.estado.pacote = s.pacote;
      UI.salvarProjeto();
      UI.toast(`Importação ${r.lote.import_batch_id} aplicada às bases.`);
      render(); UI.telas.inicio.painel();
    } catch (e) { UI.erro(e, 'Confirmar'); render(); }
  }

  function ligar(s, p) {
    $$('[data-ir-tela]').forEach(b => b.onclick = () => UI.ir(b.dataset.irTela));
    $$('.fSev').forEach(b => b.onclick = () => { filtro.sev = b.dataset.sev; render(); });
    $('#fBase').onchange = e => { filtro.base = e.target.value; render(); };
    $$('.politica').forEach(sel => sel.onchange = () => { if (sel.value === 'REVISAR') { diffModal(p, sel.dataset.base); sel.value = politicas[sel.dataset.base] || 'MANTER'; } else politicas[sel.dataset.base] = sel.value; });
    $$('.verDiff').forEach(b => b.onclick = () => diffModal(p, b.dataset.base));
    $('#expErros').onclick = async () => UI.baixar(await S.relatorios.exportarErros(p.issues, UI.opcoesExcel()), `PENDENCIAS_${s.lote.import_batch_id}.xlsx`);
    $('#expNaoMap').onclick = async () => UI.baixar(await S.relatorios.exportarNaoMapeados(UI.naoMapeados(s).map(n => ({ aba: n.aba, campo: '(coluna)', original: n.cabecalho, motivo: n.motivo, ocorrencias: '' })), UI.opcoesExcel()), `NAO_MAPEADOS_${s.lote.import_batch_id}.xlsx`);
    $('#expRel').onclick = async () => UI.baixar(await S.relatorios.relatorioImportacao({ ...loteResumo(s), issues: p.issues }, { naoMapeados: UI.naoMapeados(s), ...UI.opcoesExcel() }), `RELATORIO_${s.lote.import_batch_id}.xlsx`);
    const c = $('#confirmar'); if (c) c.onclick = () => confirmar(s);
    const l = $('#liberar'); if (l) l.onclick = async () => {
      const motivo = await UI.confirmar('Liberar bloqueios?', `Existem ${p.contagem.BLOCKING} bloqueio(s) (ex.: ${esc(p.issues.find(i => i.severidade === 'BLOCKING').mensagem)}).\nA liberação fica registrada com o seu nome e o motivo.`, { exigirMotivo: true, botao: 'Liberar e confirmar', perigo: true });
      if (motivo) confirmar(s, { motivo });
    };
    const cl = $('#cancelarLote'); if (cl) cl.onclick = async () => {
      if (!(await UI.confirmar('Cancelar importação?', 'Nada será aplicado às bases. As decisões de alias já criadas continuam salvas.'))) return;
      S.importacao.cancelar(s); s.pacote.lotes.push({ ...loteResumo(s), estado: 'CANCELLED' }); UI.salvarProjeto(); UI.toast('Importação cancelada. Nada foi aplicado.'); render(); UI.telas.inicio.painel();
    };
    const en = $('#encerrar'); if (en) en.onclick = () => { const r = S.importacao.encerrarSemGravar(s); UI.salvarProjeto(); UI.toast(`${r.import_batch_id} encerrado. Nenhuma base foi alterada.`); render(); UI.telas.inicio.painel(); };
  }

  UI.telas.validacao = { render };
})();
