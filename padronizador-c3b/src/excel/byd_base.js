// Base Operacional BYD (.xlsx) a partir da extração BYD_SKILL_MATRIX_V1 + camada de Ajustes Manuais:
//   MATRIZ ORIGINAL → base importada → AJUSTES MANUAIS → VALOR EFETIVO (o que o C3B usa para KPIs)
// As abas de pessoas e habilidades trazem o valor EFETIVO e, ao lado, o valor da fonte (source_*) e os ajustes aplicados.
// Os ajustes ficam em abas próprias (AJUSTES_MANUAIS, LOG_AJUSTES, HISTORICO_OFICIAL): a Base é gerada de novo a cada
// leitura da Matriz, e os ajustes são reaplicados — nunca se edita a Base direto.
// Depois de gerar, o arquivo é reaberto e comparado (verificarBaseOperacional).
(typeof module === 'object' ? require('../modulo') : C3BModulo)('excel/byd_base', ['core/util', 'features/ajustes'], (U, AJ) => {
  'use strict';

  const obterExcelJS = x => x || (typeof ExcelJS !== 'undefined' ? ExcelJS : require('exceljs'));
  const VERSAO = '1.2.0';

  // Colunas técnicas: ficam no arquivo, ocultas; não entram em KPI, cobertura, risco ou decisão.
  const TECNICAS = ['fill_state', 'fill_rgb', 'fill_source', 'l_marker_raw'];
  const COLUNAS = {
    RESUMO: ['sheet', 'model_id', 'pessoas', 'operacoes', 'combinacoes', 'nivel_L', 'titulares', 'em_treinamento', 'futuros_titulares', 'com_data', 'ajustes_ativos', 'problemas_de_dados'],
    PESSOAS: ['employee_id', 'employee_id_status', 'matricula', 'nome', 'funcao', 'turno', 'status', 'observacao', 'papel', 'abas', 'nomes_na_matriz', 'configuracao_pendente',
      'source_employee_id', 'source_nome', 'override_ids'],
    OPERACOES: ['sheet', 'model_id', 'operation_id', 'operation_no', 'station_code', 'station_base', 'side', 'position', 'descricao_zh', 'descricao_pt', 'source_cell', 'block_rows', 'l_row'],
    HABILIDADES_ATUAIS: ['sheet', 'model_id', 'employee_id', 'employee_id_status', 'nome', 'nome_na_matriz', 'papel', 'operation_id', 'operation_no', 'station_code', 'descricao_zh', 'descricao_pt',
      'skill_level', 'assignment_status', 'has_circle', 'has_triangle', 'is_current_operator', 'is_training_planned', 'is_future_holder', 'desconsiderado', 'observacao',
      'origem_efetiva', 'source_skill_level', 'source_assignment_status', 'source_operation_id', 'override_ids', 'ultima_atualizacao', 'skill_level_source',
      'dates_raw', 'first_date', 'latest_date', 'source_block', 'source_l_cell', 'source_circle_anchor', 'source_triangle_anchor', 'unrecognized_values', 'review_flags', 'source_employee_id', ...TECNICAS],
    MATRIZ_LONGA: ['sheet', 'model_id', 'employee_id', 'nome', 'operation_id', 'station_code', 'skill_level', 'assignment_status', 'is_current_operator', 'is_training_planned', 'is_future_holder',
      'desconsiderado', 'source_skill_level', 'source_assignment_status', 'override_ids', 'source_block', 'fill_state'],
    TREINAMENTOS: ['sheet', 'model_id', 'employee_id', 'nome', 'operation_id', 'station_code', 'descricao_pt', 'assignment_status', 'skill_level', 'dates_raw', 'first_date', 'latest_date', 'origem_efetiva', 'override_ids', 'source_block', 'source_triangle_anchor'],
    ...AJ.COLUNAS,
    CONFIGURACAO: ['chave', 'valor', 'descricao'],
    ORIGEM_MAPEAMENTO: ['purpose', 'sheet', 'cell', 'drawing_file', 'shape_id', 'shape_name', 'shape_type', 'anchor_from_row', 'anchor_from_col', 'anchor_to_row', 'anchor_to_col', 'anchor_a1',
      'employee_id', 'operation_id', 'raw_value', 'dedup', 'fill_state', 'fill_source', 'l_marker_source'],
    SYNC_STATE: ['chave', 'valor'],
    PENDENCIAS: ['categoria', 'severidade', 'codigo', 'sheet', 'cell', 'employee_id', 'operation_id', 'mensagem'],
    VALIDACAO: ['item', 'obtido', 'esperado', 'ok', 'detalhe'],
  };
  const ORDEM_CAT = { CONFIGURACAO_PENDENTE: 0, PROBLEMA_DE_DADOS: 1, AVISO: 2, INFORMACAO: 3 };
  const ordenarPendencias = ps => ps.slice().sort((a, b) => (ORDEM_CAT[a.categoria] ?? 9) - (ORDEM_CAT[b.categoria] ?? 9));

  // Conteúdo de cada aba: efetivo (fonte + ajustes) nas abas de negócio; fonte nas de rastreabilidade
  function montar(r, { ajustes = null, config = {}, origem_hash = null, agora = U.agoraISO() } = {}) {
    const estado = ajustes || AJ.novoEstado();
    const ef = AJ.aplicar(r, estado);
    const rec = AJ.reconciliar(r, estado);
    const linhasAj = AJ.paraLinhas(estado);
    const pendencias = r.pendencias.concat(rec.map(x => ({ categoria: 'AVISO', severidade: 'WARNING', codigo: x.situacao === 'NAO_MAIS_NECESSARIO' ? 'AJUSTE_NAO_MAIS_NECESSARIO' : x.situacao === 'ORFAO' ? 'AJUSTE_ORFAO' : 'AJUSTE_FONTE_MUDOU',
      employee_id: x.override.employee_id, operation_id: x.override.operation_id, cell: x.override_id, mensagem: x.mensagem })));
    const aliasesPessoa = (config.aliases || []).filter(a => a.entity_type === 'PESSOA' && a.active !== false);
    const configuracao = [
      { chave: 'perfil', valor: r.perfil, descricao: 'Perfil de leitura da Matriz' },
      { chave: 'versao_base_operacional', valor: VERSAO, descricao: 'Versão do formato desta Base' },
      { chave: 'residuos_conhecidos', valor: ((r.config || {}).residuosConhecidos || []).join(','), descricao: 'Valores ignorados nas células de habilidade (só neste perfil)' },
      { chave: 'regra_nivel', valor: 'L somente com marcador 1', descricao: 'A cor da célula não define nível' },
      { chave: 'regra_designacao', valor: '○ TITULAR · △ EM_TREINAMENTO · ○+△ FUTURO_TITULAR · nada SEM_DESIGNACAO', descricao: 'Formas do Excel' },
      { chave: 'prioridade', valor: 'MATRIZ → base importada → AJUSTES MANUAIS → valor efetivo → C3B', descricao: 'Ordem de aplicação' },
      ...aliasesPessoa.map(a => ({ chave: `alias_pessoa:${a.alias_id}`, valor: `${a.original_value} → ${a.normalized_value}`, descricao: `confirmado por ${a.created_by || '—'} em ${a.created_at || '—'}` })),
      ...(config.decisoes || []).filter(d => /^PESSOAS_/.test(d.tipo)).map(d => ({ chave: `decisao:${d.tipo}`, valor: d.detalhe, descricao: `${d.decidido_por || '—'} em ${d.decidido_em || '—'}` })),
    ];
    const sync = [
      ['arquivo_origem', r.arquivo], ['hash_origem', origem_hash || r.hash_origem || ''], ['matriz_lida_em', r.gerado_em], ['base_gerada_em', agora],
      ['abas_lidas', r.abas.map(a => a.sheet).join(',')], ['ajustes_ativos', AJ.ativos(estado).length], ['ajustes_inativos', estado.overrides.length - AJ.ativos(estado).length],
      ['alteracoes_oficiais_pendentes_na_matriz', estado.historico_oficial.filter(h => h.status_matriz === 'PENDENTE_NA_MATRIZ').length],
      ['ajustes_a_revisar_apos_releitura', rec.length], ['sentido_da_sincronizacao', 'Matriz oficial → Base Operacional → C3B (alterações oficiais: C3B → Matriz + Histórico → Base)'],
    ].map(([chave, valor]) => ({ chave, valor }));
    const resumo = ef.resumo.map(s => ({ ...s, problemas_de_dados: (r.resumo.find(x => x.sheet === s.sheet) || {}).problemas_de_dados }));
    return { ef, rec, estado, fontes: { RESUMO: resumo, PESSOAS: ef.pessoas, OPERACOES: r.operacoes, HABILIDADES_ATUAIS: ef.habilidadesAtuais, MATRIZ_LONGA: ef.registros, TREINAMENTOS: ef.treinamentos,
      AJUSTES_MANUAIS: linhasAj.AJUSTES_MANUAIS, LOG_AJUSTES: linhasAj.LOG_AJUSTES, HISTORICO_OFICIAL: linhasAj.HISTORICO_OFICIAL, CONFIGURACAO: configuracao,
      ORIGEM_MAPEAMENTO: r.origem, SYNC_STATE: sync, PENDENCIAS: ordenarPendencias(pendencias), VALIDACAO: r.validacaoFinal } };
  }

  const REGRAS = [
    ['Prioridade', 'MATRIZ ORIGINAL → base importada → AJUSTES MANUAIS → valor efetivo → C3B calcula KPIs. As colunas skill_level/assignment_status são o valor EFETIVO; source_* é o que a Matriz diz.'],
    ['Ajustes manuais', 'Não edite esta Base: ela é gerada de novo a cada leitura da Matriz. Ajustes são feitos no Padronizador (perfil da pessoa) e ficam em AJUSTES_MANUAIS, reaplicados a cada geração. Nada é apagado: remover = desconsiderar no C3B (desconsiderado = TRUE), a origem continua registrada.'],
    ['Ajuste local × alteração oficial', 'LOCAL corrige só a Base/C3B (ex.: nome). OFICIAL (nível, designação, remoção) também vira evento em HISTORICO_OFICIAL e fica PENDENTE_NA_MATRIZ até a Matriz oficial ser atualizada.'],
    ['Reconciliação', 'Ao reler a Matriz: se a fonte passou a dizer o mesmo que o ajuste, o ajuste é marcado "não é mais necessário" (encerrar ou manter); se a fonte mudou para outro valor, "revise".'],
    ['skill_level (fonte)', 'L quando a célula do marcador oculto (início do bloco +2 linhas, +2 colunas; confirmada pela fórmula "Número L proficiente") contém 1. Senão NAO_IDENTIFICADO. Níveis oficiais i/I/L/U inalterados.'],
    ['assignment_status (fonte)', '○ (forma ellipse) somente = TITULAR · △ (forma triangle) somente = EM_TREINAMENTO · ○ + △ no mesmo bloco = FUTURO_TITULAR · nenhuma forma = SEM_DESIGNACAO. Independente de skill_level.'],
    ['Formas', 'Lidas de xl/drawings/drawingN.xml pela âncora (centro entre from e to, índices 0-based). Formas sobrepostas do mesmo tipo no mesmo bloco contam uma vez. Formas abaixo da grade (legenda) são ignoradas e registradas.'],
    ['fill_state / fill_rgb (colunas técnicas ocultas)', 'Cor da célula do marcador, guardada só como metadado técnico. "L verde", "L amarelo" ou outra cor é simplesmente L.'],
    ['Resíduo "c"', 'Neste perfil, "c" nas células de habilidade é resíduo conhecido de automação antiga: log técnico (KNOWN_RESIDUE_IGNORED), sem pendência e sem nível. Não é regra global.'],
    ['Pessoas', 'Grafias diferentes da mesma pessoa só são unidas por alias PESSOA confirmado. Matrícula informada por ajuste troca o employee_id efetivo para EMP-<matrícula>; source_employee_id guarda o ID de origem.'],
    ['Pendências', 'Configuração pendente · Problema de dados · Aviso · Informação técnica. Nada é corrigido automaticamente.'],
  ];

  const celula = v => (v === undefined ? null : v);
  function aba(wb, nome, colunas, linhas, ocultas = []) {
    const ws = wb.addWorksheet(nome);
    ws.addRow(colunas);
    for (const l of linhas) ws.addRow(colunas.map(c => { const v = l[c]; return Array.isArray(v) ? v.join(',') : celula(v); }));
    const cab = ws.getRow(1);
    cab.font = { bold: true, color: { argb: 'FFFFFFFF' } }; cab.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0B5D3B' } };
    ws.views = [{ state: 'frozen', ySplit: 1 }];
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: colunas.length } };
    colunas.forEach((c, i) => { const col = ws.getColumn(i + 1); col.width = Math.min(60, Math.max(10, c.length + 2)); if (ocultas.includes(c)) col.hidden = true; });
    return ws;
  }

  // opcoes: { ajustes (estado da camada de ajustes), config ({ aliases, decisoes }), origem_hash, ExcelJS }
  async function gerarBaseOperacional(r, opcoes = {}) {
    const wb = new (obterExcelJS(opcoes.ExcelJS)).Workbook();
    wb.creator = 'Padronizador C3B'; wb.created = new Date(r.gerado_em || U.agoraISO());
    const { fontes, ef } = montar(r, opcoes);
    for (const nome of Object.keys(COLUNAS)) aba(wb, nome, COLUNAS[nome], fontes[nome], TECNICAS);
    aba(wb, 'REGRAS', ['campo', 'regra'], REGRAS.map(([campo, regra]) => ({ campo, regra })));
    const meta = wb.addWorksheet('_META');
    const contagens = Object.fromEntries(Object.keys(COLUNAS).map(k => [k, fontes[k].length]));
    for (const [k, v] of Object.entries({ tipo: 'BASE_OPERACIONAL_BYD', perfil: r.perfil, versao: VERSAO, arquivo_origem: r.arquivo, hash_origem: opcoes.origem_hash || '', gerado_em: r.gerado_em,
      contagens: JSON.stringify(contagens), hash_conteudo: hashConteudo(ef.registros) })) meta.addRow([k, v]);
    meta.state = 'hidden';
    return new Uint8Array(await wb.xlsx.writeBuffer());
  }
  // Hash dos campos efetivos que o C3B usa (independente de formatação)
  const hashConteudo = regs => U.hashCurto(JSON.stringify(regs.map(x => [x.sheet, x.employee_id, x.operation_id, x.skill_level, x.assignment_status, !!x.is_current_operator, !!x.is_training_planned, !!x.desconsiderado])), 16);

  async function lerBaseOperacional(bytes, { ExcelJS = null } = {}) {
    const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    const wb = new (obterExcelJS(ExcelJS)).Workbook();
    await wb.xlsx.load(u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength));
    const abas = {};
    for (const ws of wb.worksheets) {
      if (ws.name === '_META') continue;
      const cab = []; ws.getRow(1).eachCell((c, i) => { cab[i - 1] = String(c.value); });
      abas[ws.name] = [];
      ws.eachRow((row, i) => { if (i === 1) return; const o = {}; cab.forEach((k, c) => { const v = row.getCell(c + 1).value; o[k] = v === undefined ? null : v; }); abas[ws.name].push(o); });
    }
    const meta = {};
    const m = wb.getWorksheet('_META');
    if (m) m.eachRow(row => { meta[String(row.getCell(1).value)] = row.getCell(2).value; });
    const ocultas = {};
    for (const ws of wb.worksheets) { const cab = []; ws.getRow(1).eachCell((c, i) => { if (ws.getColumn(i).hidden) cab.push(String(c.value)); }); ocultas[ws.name] = cab; }
    return { meta, abas, ocultas, nomesAbas: wb.worksheets.map(w => w.name), metaOculta: m ? m.state : null };
  }
  // Ajustes guardados numa Base Operacional anterior (para não perder a camada de ajustes)
  async function lerAjustesDaBase(bytes, opcoes = {}) {
    const lido = await lerBaseOperacional(bytes, opcoes);
    if (lido.meta.tipo !== 'BASE_OPERACIONAL_BYD') throw new Error('O arquivo não é uma Base Operacional BYD gerada pelo Padronizador.');
    return AJ.deLinhas(lido.abas);
  }

  async function verificarBaseOperacional(bytes, r, opcoes = {}) {
    const checks = [];
    const ok = (nome, cond, detalhe) => checks.push({ nome, ok: !!cond, detalhe });
    let lido;
    try { lido = await lerBaseOperacional(bytes, opcoes); } catch (e) { ok('Reabrir', false, e.message); return { ok: false, checks }; }
    ok('Reabrir', true, `${bytes.length} bytes`);
    ok('Abas', Object.keys(COLUNAS).every(k => lido.abas[k]), lido.nomesAbas.join(','));
    ok('Perfil no _META', lido.meta.perfil === r.perfil && lido.meta.tipo === 'BASE_OPERACIONAL_BYD', lido.meta.perfil);
    const { fontes, ef } = montar(r, opcoes);
    for (const [k, fonte] of Object.entries(fontes))
      if (!['SYNC_STATE', 'CONFIGURACAO'].includes(k)) ok(`Quantidade ${k}`, lido.abas[k] && lido.abas[k].length === fonte.length, `${lido.abas[k] ? lido.abas[k].length : 0} de ${fonte.length}`);
    const campos = ['employee_id', 'operation_id', 'nome', 'skill_level', 'assignment_status', 'has_circle', 'has_triangle', 'is_current_operator', 'is_training_planned', 'is_future_holder',
      'desconsiderado', 'source_skill_level', 'source_assignment_status', 'override_ids', 'first_date', 'latest_date', 'source_block'];
    const dif = [];
    (lido.abas.HABILIDADES_ATUAIS || []).forEach((x, i) => { for (const c of campos) if ((x[c] ?? null) !== (ef.habilidadesAtuais[i][c] ?? null)) dif.push(`linha ${i + 2} ${c}`); });
    ok('Conteúdo efetivo de HABILIDADES_ATUAIS igual ao calculado', !dif.length, dif.slice(0, 5).join('; ') || 'todos os campos conferem');
    const ajLidos = AJ.deLinhas(lido.abas);
    ok('Ajustes manuais preservados', JSON.stringify(ajLidos.overrides.map(o => [o.override_id, o.active, o.new_value])) === JSON.stringify(fontes.AJUSTES_MANUAIS.map(o => [o.override_id, o.active, o.new_value])), `${ajLidos.overrides.length} ajuste(s)`);
    ok('Hash do conteúdo efetivo (MATRIZ_LONGA)', lido.meta.hash_conteudo === hashConteudo(lido.abas.MATRIZ_LONGA || []), lido.meta.hash_conteudo);
    return { ok: checks.every(c => c.ok), checks, lido };
  }

  return { gerarBaseOperacional, lerBaseOperacional, lerAjustesDaBase, verificarBaseOperacional, montar, COLUNAS, TECNICAS, REGRAS, VERSAO };
}, typeof module === 'object' ? module : null);
