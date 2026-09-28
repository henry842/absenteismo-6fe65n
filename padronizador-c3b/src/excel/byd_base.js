// Base Operacional BYD (.xlsx) a partir da extração BYD_SKILL_MATRIX_V1: o que o C3B usa para calcular
// proficiência, titulares, substitutos, pessoas em treinamento, futuros titulares, cobertura e concentração.
// Abas: RESUMO, OPERADORES, OPERACOES, HABILIDADES_ATUAIS, MATRIZ_LONGA, ORIGEM_MAPEAMENTO, PENDENCIAS, REGRAS, _META.
// Depois de gerar, o arquivo é reaberto e comparado com a extração (verificarBaseOperacional).
(typeof module === 'object' ? require('../modulo') : C3BModulo)('excel/byd_base', ['core/util'], (U) => {
  'use strict';

  const obterExcelJS = x => x || (typeof ExcelJS !== 'undefined' ? ExcelJS : require('exceljs'));
  const VERSAO = '1.0.0';

  const COLUNAS = {
    RESUMO: ['sheet', 'model_id', 'operadores', 'operacoes', 'blocos', 'nivel_L', 'titulares', 'em_treinamento', 'futuros_titulares', 'fill_green', 'fill_yellow', 'fill_other', 'com_data', 'pendencias'],
    OPERADORES: ['employee_id', 'employee_id_status', 'matricula', 'nome', 'papel', 'abas'],
    OPERACOES: ['sheet', 'model_id', 'operation_id', 'operation_no', 'station_code', 'station_base', 'side', 'position', 'descricao_zh', 'descricao_pt', 'source_cell', 'block_rows', 'l_row'],
    HABILIDADES_ATUAIS: ['sheet', 'model_id', 'employee_id', 'employee_id_status', 'nome', 'papel', 'operation_id', 'operation_no', 'station_code', 'descricao_zh', 'descricao_pt',
      'skill_level', 'skill_level_source', 'assignment_status', 'has_circle', 'has_triangle', 'is_current_operator', 'is_training_planned', 'is_future_holder',
      'fill_state', 'fill_rgb', 'fill_source', 'dates_raw', 'first_date', 'latest_date', 'source_block', 'source_l_cell', 'source_circle_anchor', 'source_triangle_anchor', 'unrecognized_values', 'review_flags'],
    MATRIZ_LONGA: ['sheet', 'model_id', 'employee_id', 'nome', 'operation_id', 'station_code', 'skill_level', 'assignment_status', 'is_current_operator', 'is_training_planned', 'is_future_holder', 'fill_state', 'source_block'],
    ORIGEM_MAPEAMENTO: ['purpose', 'sheet', 'cell', 'drawing_file', 'shape_id', 'shape_name', 'shape_type', 'anchor_from_row', 'anchor_from_col', 'anchor_to_row', 'anchor_to_col', 'anchor_a1',
      'employee_id', 'operation_id', 'raw_value', 'dedup', 'fill_state', 'fill_source', 'l_marker_source'],
    PENDENCIAS: ['severidade', 'codigo', 'sheet', 'cell', 'employee_id', 'operation_id', 'mensagem'],
  };
  const REGRAS = [
    ['skill_level', 'L quando a célula do marcador oculto (início do bloco +2 linhas, +2 colunas; confirmada pela fórmula "Número L proficiente") contém 1. Senão NAO_IDENTIFICADO. Níveis oficiais i/I/L/U inalterados.'],
    ['assignment_status', '○ (forma ellipse) somente = TITULAR · △ (forma triangle) somente = EM_TREINAMENTO · ○ + △ no mesmo bloco = FUTURO_TITULAR · nenhuma forma = SEM_DESIGNACAO. Independente de skill_level.'],
    ['is_current_operator / is_training_planned / is_future_holder', 'has_circle / has_triangle / ambos. Legenda da Matriz: ○ = operadores atuais; △ = pessoas programadas para treinamento.'],
    ['Formas', 'Lidas de xl/drawings/drawingN.xml pela âncora (centro entre from e to, índices 0-based). Formas sobrepostas do mesmo tipo no mesmo bloco contam uma vez. Formas abaixo da grade (legenda) são ignoradas e registradas.'],
    ['fill_state', 'Cor real da célula do marcador: GREEN (FF92D050), YELLOW (FFFFFF00), OTHER (outra cor), NONE (sem preenchimento ou branco). Nenhum significado de negócio atribuído à cor.'],
    ['Datas', 'dates_raw preserva o texto da coluna Dia/Mês; first_date/latest_date são as datas reconhecidas (dd/mm/aaaa). Datas não definem designação.'],
    ['employee_id', 'A Matriz não traz matrícula. Sem Cadastro (01) com o mesmo nome, o ID é provisório: EMP-SEMMATR-<hash do nome> (status SEM_MATRICULA).'],
    ['Validação', 'Combinações incomuns (○ sem L, △ com L, ○+△+L) viram pendência WARNING; nada é corrigido automaticamente.'],
  ];

  const celula = v => (v === undefined ? null : v);
  function aba(wb, nome, colunas, linhas) {
    const ws = wb.addWorksheet(nome);
    ws.addRow(colunas);
    for (const l of linhas) ws.addRow(colunas.map(c => { const v = l[c]; return Array.isArray(v) ? v.join(',') : celula(v); }));
    const cab = ws.getRow(1);
    cab.font = { bold: true, color: { argb: 'FFFFFFFF' } }; cab.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0B5D3B' } };
    ws.views = [{ state: 'frozen', ySplit: 1 }];
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: colunas.length } };
    colunas.forEach((c, i) => { ws.getColumn(i + 1).width = Math.min(60, Math.max(10, c.length + 2)); });
    return ws;
  }

  async function gerarBaseOperacional(r, { ExcelJS = null, origem_hash = null } = {}) {
    const wb = new (obterExcelJS(ExcelJS)).Workbook();
    wb.creator = 'Padronizador C3B'; wb.created = new Date(r.gerado_em || U.agoraISO());
    aba(wb, 'RESUMO', COLUNAS.RESUMO, r.resumo);
    aba(wb, 'OPERADORES', COLUNAS.OPERADORES, r.operadores);
    aba(wb, 'OPERACOES', COLUNAS.OPERACOES, r.operacoes);
    aba(wb, 'HABILIDADES_ATUAIS', COLUNAS.HABILIDADES_ATUAIS, r.habilidadesAtuais);
    aba(wb, 'MATRIZ_LONGA', COLUNAS.MATRIZ_LONGA, r.registros);
    aba(wb, 'ORIGEM_MAPEAMENTO', COLUNAS.ORIGEM_MAPEAMENTO, r.origem);
    aba(wb, 'PENDENCIAS', COLUNAS.PENDENCIAS, r.pendencias);
    aba(wb, 'REGRAS', ['campo', 'regra'], REGRAS.map(([campo, regra]) => ({ campo, regra })));
    const meta = wb.addWorksheet('_META');
    const contagens = Object.fromEntries(Object.keys(COLUNAS).map(k => [k, ({ RESUMO: r.resumo, OPERADORES: r.operadores, OPERACOES: r.operacoes, HABILIDADES_ATUAIS: r.habilidadesAtuais, MATRIZ_LONGA: r.registros, ORIGEM_MAPEAMENTO: r.origem, PENDENCIAS: r.pendencias })[k].length]));
    for (const [k, v] of Object.entries({ tipo: 'BASE_OPERACIONAL_BYD', perfil: r.perfil, versao: VERSAO, arquivo_origem: r.arquivo, hash_origem: origem_hash || '', gerado_em: r.gerado_em,
      contagens: JSON.stringify(contagens), hash_conteudo: hashConteudo(r) })) meta.addRow([k, v]);
    meta.state = 'hidden';
    return new Uint8Array(await wb.xlsx.writeBuffer());
  }
  // Hash dos campos que o C3B usa (independente de formatação)
  const hashConteudo = r => U.hashCurto(JSON.stringify(r.registros.map(x => [x.sheet, x.employee_id, x.operation_id, x.skill_level, x.assignment_status, x.has_circle, x.has_triangle, x.fill_state])), 16);

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
    return { meta, abas, nomesAbas: wb.worksheets.map(w => w.name), metaOculta: m ? m.state : null };
  }

  async function verificarBaseOperacional(bytes, r, opcoes = {}) {
    const checks = [];
    const ok = (nome, cond, detalhe) => checks.push({ nome, ok: !!cond, detalhe });
    let lido;
    try { lido = await lerBaseOperacional(bytes, opcoes); } catch (e) { ok('Reabrir', false, e.message); return { ok: false, checks }; }
    ok('Reabrir', true, `${bytes.length} bytes`);
    ok('Abas', Object.keys(COLUNAS).every(k => lido.abas[k]), lido.nomesAbas.join(','));
    ok('Perfil no _META', lido.meta.perfil === r.perfil && lido.meta.tipo === 'BASE_OPERACIONAL_BYD', lido.meta.perfil);
    for (const [k, fonte] of [['HABILIDADES_ATUAIS', r.habilidadesAtuais], ['MATRIZ_LONGA', r.registros], ['ORIGEM_MAPEAMENTO', r.origem], ['OPERADORES', r.operadores], ['OPERACOES', r.operacoes], ['PENDENCIAS', r.pendencias]])
      ok(`Quantidade ${k}`, lido.abas[k] && lido.abas[k].length === fonte.length, `${lido.abas[k] ? lido.abas[k].length : 0} de ${fonte.length}`);
    const campos = ['employee_id', 'operation_id', 'nome', 'skill_level', 'assignment_status', 'has_circle', 'has_triangle', 'is_current_operator', 'is_training_planned', 'is_future_holder', 'fill_state', 'fill_rgb', 'first_date', 'latest_date'];
    const dif = [];
    (lido.abas.HABILIDADES_ATUAIS || []).forEach((x, i) => { for (const c of campos) if ((x[c] ?? null) !== (r.habilidadesAtuais[i][c] ?? null)) dif.push(`linha ${i + 2} ${c}`); });
    ok('Conteúdo de HABILIDADES_ATUAIS igual ao extraído', !dif.length, dif.slice(0, 5).join('; ') || 'todos os campos conferem');
    const rec = { registros: (lido.abas.MATRIZ_LONGA || []).map(x => ({ ...x, has_circle: x.is_current_operator, has_triangle: x.is_training_planned })) };
    ok('Hash do conteúdo (MATRIZ_LONGA)', lido.meta.hash_conteudo === hashConteudo(rec), lido.meta.hash_conteudo);
    return { ok: checks.every(c => c.ok), checks, lido };
  }

  return { gerarBaseOperacional, lerBaseOperacional, verificarBaseOperacional, COLUNAS, REGRAS, VERSAO };
}, typeof module === 'object' ? module : null);
