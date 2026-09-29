// Exportações: relatório da importação, erros, não mapeados e base padronizada avulsa (tudo em .xlsx real).
(typeof module === 'object' ? require('../modulo') : C3BModulo)('features/relatorios', ['core/util', 'core/auditoria'], (U, AU) => {
  'use strict';

  const obterExcelJS = x => x || (typeof ExcelJS !== 'undefined' ? ExcelJS : require('exceljs'));
  function aba(wb, nome, colunas, linhas) {
    const ws = wb.addWorksheet(nome);
    ws.columns = colunas.map(([k, rot, w]) => ({ header: rot, key: k, width: w || 18 }));
    for (const l of linhas) ws.addRow(Object.fromEntries(colunas.map(([k]) => [k, l[k] == null ? '' : typeof l[k] === 'object' ? JSON.stringify(l[k]) : l[k]])));
    const cab = ws.getRow(1);
    cab.font = { bold: true, color: { argb: 'FFFFFFFF' } }; cab.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0B5D3B' } };
    ws.views = [{ state: 'frozen', ySplit: 1 }];
    if (colunas.length) ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: colunas.length } };
    return ws;
  }
  const COL_ISSUES = [['categoria', 'Categoria', 22], ['severidade', 'Severidade', 12], ['schema', 'Base', 12], ['linha', 'Linha', 8], ['campo', 'Campo', 18], ['valor', 'Valor', 22], ['mensagem', 'O que aconteceu', 70], ['comoResolver', 'Como resolver', 50], ['codigo', 'Código', 22]];
  const COL_LOG = [['aba', 'Aba', 16], ['row_id', 'Linha', 8], ['field', 'Campo', 18], ['original_value', 'Valor original', 26], ['normalized_value', 'Valor padrão C3B', 26], ['rule', 'Regra', 26], ['confidence', 'Confiança', 10], ['decision', 'Decisão', 16]];

  // lote: resumo guardado em pacote.lotes (import_batch_id, abas, log, issues...)
  async function relatorioImportacao(lote, { naoMapeados = [], ExcelJS = null } = {}) {
    const wb = new (obterExcelJS(ExcelJS)).Workbook();
    const texto = AU.relatorioTexto({ ...lote, transicoes: [], modo: lote.modo }).split('\n').map(l => ({ linha: l }));
    aba(wb, 'RESUMO', [['linha', 'Relatório', 90]], texto);
    aba(wb, 'POR_ABA', [['aba', 'Aba', 20], ['schema', 'Base', 12], ['encontrados', 'Encontrados', 12], ['importados', 'Importados', 12], ['ignorados', 'Ignorados', 12], ['corrigidos', 'Corrigidos', 12], ['naoReconhecidos', 'Não reconhecidos', 16], ['duplicidades', 'Duplicidades', 12]], lote.abas || []);
    aba(wb, 'TRANSFORMACOES', COL_LOG, lote.log || []);
    aba(wb, 'PENDENCIAS', COL_ISSUES, lote.issues || []);
    aba(wb, 'NAO_MAPEADOS', [['aba', 'Aba', 16], ['cabecalho', 'Coluna', 28], ['decisao', 'Situação', 18], ['motivo', 'Motivo', 60]], naoMapeados);
    return new Uint8Array(await wb.xlsx.writeBuffer());
  }
  async function exportarErros(issues, { ExcelJS = null, apenas = ['ERROR', 'BLOCKING', 'WARNING'] } = {}) {
    const wb = new (obterExcelJS(ExcelJS)).Workbook();
    aba(wb, 'PENDENCIAS', COL_ISSUES, issues.filter(i => apenas.includes(i.severidade)));
    return new Uint8Array(await wb.xlsx.writeBuffer());
  }
  async function exportarNaoMapeados(linhas, { ExcelJS = null } = {}) {
    const wb = new (obterExcelJS(ExcelJS)).Workbook();
    aba(wb, 'NAO_MAPEADOS', [['aba', 'Aba', 16], ['campo', 'Campo / coluna', 26], ['original', 'Valor ou coluna original', 30], ['motivo', 'Motivo', 60], ['ocorrencias', 'Ocorrências', 12]], linhas);
    return new Uint8Array(await wb.xlsx.writeBuffer());
  }
  // Valores não reconhecidos agrupados (para o de/para e para exportação)
  function naoReconhecidos(log) {
    const g = new Map();
    for (const l of log) {
      if (!['UNKNOWN', 'NAO_RESOLVIDO', 'AMBIGUO', 'REVISAR'].includes(l.status)) continue;
      const k = `${l.aba || ''}|${l.field}|${U.dobrar(l.original_value)}`;
      if (!g.has(k)) g.set(k, { aba: l.aba, campo: l.field, original: l.original_value, sugerido: l.normalized_value, regra: l.rule, confianca: l.confidence, status: l.status, ocorrencias: 0, linhas: [] });
      const x = g.get(k); x.ocorrencias++; if (x.linhas.length < 20) x.linhas.push(l.row_id);
    }
    return [...g.values()].sort((a, b) => b.ocorrencias - a.ocorrencias);
  }

  return { relatorioImportacao, exportarErros, exportarNaoMapeados, naoReconhecidos };
}, typeof module === 'object' ? module : null);
