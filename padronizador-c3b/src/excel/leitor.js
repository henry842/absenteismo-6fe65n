// Leitura real de .xlsx / .xlsm / .csv. Devolve metadados do arquivo e de cada aba e a grade de valores.
// XLSM é tratado só como dados: macros e VBA nunca são executados (o ExcelJS não executa código).
// .xls (formato binário antigo) não é suportado: o usuário recebe a orientação de salvar como .xlsx.
(typeof module === 'object' ? require('../modulo') : C3BModulo)('excel/leitor', ['core/util', 'excel/csv'], (U, CSV) => {
  'use strict';

  const LIMITE_BYTES = 60 * 1024 * 1024;
  const obterExcelJS = x => x || (typeof ExcelJS !== 'undefined' ? ExcelJS : require('exceljs'));

  function extensao(nome) { const m = String(nome).toLowerCase().match(/\.([a-z0-9]+)$/); return m ? m[1] : ''; }

  // Assinatura do arquivo: não confia só na extensão
  function formatoPorConteudo(u8) {
    if (u8[0] === 0x50 && u8[1] === 0x4b) return 'zip';                 // xlsx/xlsm
    if (u8[0] === 0xd0 && u8[1] === 0xcf && u8[2] === 0x11 && u8[3] === 0xe0) return 'ole'; // xls antigo
    return 'texto';
  }

  class ErroLeitura extends Error {
    constructor(msg, comoResolver) { super(msg); this.name = 'ErroLeitura'; this.comoResolver = comoResolver; }
  }

  // Resultado: { arquivo, abas: [{ nome, indice, visivel, linhas, colunas, dimensao, valores, textos, mescladas,
  //   celulasDeMescla, formulas, tabelas, celulasVazias, celulasPreenchidas }] }
  async function analisarArquivo(bytes, nomeArquivo, opcoes = {}) {
    const { token = null, progresso = () => {}, modificado = null, ExcelJS: lib = null } = opcoes;
    const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    const ext = extensao(nomeArquivo);
    if (u8.length > LIMITE_BYTES) throw new ErroLeitura(`O arquivo tem ${(u8.length / 1048576).toFixed(1)} MB; o limite é 60 MB.`, 'Divida a planilha ou remova abas que não serão importadas.');
    if (!u8.length) throw new ErroLeitura('O arquivo está vazio (0 bytes).', 'Confira se o arquivo foi salvo corretamente.');
    const assinatura = formatoPorConteudo(u8);
    const arquivo = { nome: nomeArquivo, extensao: ext, tamanho: u8.length, modificado, hash: await U.sha256(u8) };
    progresso(5, 'Lendo o arquivo');

    if (ext === 'xls' || assinatura === 'ole')
      throw new ErroLeitura('Arquivo .xls (formato antigo do Excel 97-2003) não é suportado.', 'Abra no Excel e use "Salvar como" → Pasta de Trabalho do Excel (.xlsx).');

    if (ext === 'csv' || ext === 'txt' || assinatura === 'texto') {
      const { linhas, codificacao, separador } = CSV.lerCsv(u8);
      arquivo.formato = 'csv'; arquivo.codificacao = codificacao; arquivo.separador = separador;
      const aba = montarAba(nomeArquivo.replace(/\.[^.]+$/, ''), 0, true, linhas, new Map(), [], new Set(), 0, []);
      progresso(100, 'Concluído');
      return { arquivo, abas: [aba] };
    }

    if (!['xlsx', 'xlsm'].includes(ext) && assinatura !== 'zip')
      throw new ErroLeitura(`Extensão .${ext} não reconhecida.`, 'Use .xlsx, .xlsm ou .csv.');

    const ExcelJSLib = obterExcelJS(lib);
    const wb = new ExcelJSLib.Workbook();
    try { await wb.xlsx.load(u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength)); }
    catch (e) { throw new ErroLeitura(`Não foi possível abrir o arquivo como Excel: ${e.message}`, 'Confira se o arquivo não está corrompido ou protegido por senha; abra no Excel e salve de novo.'); }
    if (token) token.verificar();
    arquivo.formato = ext === 'xlsm' ? 'xlsm' : 'xlsx';
    const abas = [];
    const total = wb.worksheets.length;
    for (let i = 0; i < total; i++) {
      const ws = wb.worksheets[i];
      if (token) token.verificar();
      progresso(10 + Math.round(85 * i / Math.max(1, total)), `Lendo a aba ${ws.name}`);
      const valores = [], textos = new Map();
      let formulas = 0;
      const nLin = ws.rowCount, nCol = ws.columnCount;
      for (let r = 1; r <= nLin; r++) {
        const row = ws.getRow(r);
        const linha = new Array(nCol).fill(null);
        if (row.hasValues) {
          row.eachCell({ includeEmpty: false }, (cell, c) => {
            const bruto = cell.value;
            if (bruto && typeof bruto === 'object' && ('formula' in bruto || 'sharedFormula' in bruto)) formulas++;
            const v = U.valorCelula(bruto);
            linha[c - 1] = typeof v === 'string' ? (v.trim() === '' ? null : v) : v;
            // Guarda o texto formatado de números com formato (ex.: 001234 com formato "000000")
            if (typeof v === 'number' && cell.numFmt && !/^General$/i.test(cell.numFmt)) {
              const t = textoComFormato(v, cell.numFmt);
              if (t && t !== String(v)) textos.set(`${r - 1},${c - 1}`, t);
            }
          });
        }
        valores.push(linha);
        if (r % 400 === 0) { await U.respirar(); if (token) token.verificar(); }
      }
      const merges = ((ws.model && ws.model.merges) || []).slice();
      const celulasDeMescla = new Set();
      // Células mescladas: o valor fica só na primeira; copiamos para as outras e marcamos a origem
      for (const ref of merges) {
        const [a, b] = ref.split(':').map(refParaRC);
        if (!a || !b) continue;
        const v = (valores[a.r] || [])[a.c];
        for (let r = a.r; r <= b.r; r++) for (let c = a.c; c <= b.c; c++) {
          if (r === a.r && c === a.c) continue;
          if (!valores[r]) continue;
          if (valores[r][c] == null && v != null) { valores[r][c] = v; celulasDeMescla.add(`${r},${c}`); }
        }
      }
      const tabelas = [];
      try { for (const t of Object.values(ws.tables || {})) tabelas.push(t.name || (t.table && t.table.name)); } catch (e) { /* sem tabelas */ }
      abas.push(montarAba(ws.name, i, ws.state !== 'hidden' && ws.state !== 'veryHidden', valores, textos, merges, celulasDeMescla, formulas, tabelas.filter(Boolean)));
    }
    progresso(100, 'Concluído');
    return { arquivo, abas };
  }

  // Máscaras de zeros ("000000", "00000;@") guardam os zeros à esquerda da matrícula
  function textoComFormato(v, numFmt) {
    const sec = String(numFmt).split(';')[0].replace(/"[^"]*"|\\./g, '');
    if (/^0+$/.test(sec) && Number.isInteger(v) && v >= 0) return String(v).padStart(sec.length, '0');
    return null;
  }

  function refParaRC(ref) {
    const m = String(ref).match(/^([A-Z]+)(\d+)$/);
    if (!m) return null;
    let c = 0; for (const ch of m[1]) c = c * 26 + ch.charCodeAt(0) - 64;
    return { r: +m[2] - 1, c: c - 1 };
  }
  const letraColuna = c => { let s = ''; c++; while (c) { const m = (c - 1) % 26; s = String.fromCharCode(65 + m) + s; c = Math.floor((c - 1) / 26); } return s; };

  function montarAba(nome, indice, visivel, valores, textos, mescladas, celulasDeMescla, formulas, tabelas) {
    // corta linhas e colunas vazias do fim
    let ultimaLinha = -1, ultimaColuna = -1, preenchidas = 0;
    valores.forEach((l, r) => l.forEach((v, c) => { if (v != null && v !== '') { preenchidas++; ultimaLinha = Math.max(ultimaLinha, r); ultimaColuna = Math.max(ultimaColuna, c); } }));
    const linhas = ultimaLinha + 1, colunas = ultimaColuna + 1;
    const grade = valores.slice(0, linhas).map(l => { const x = l.slice(0, colunas); while (x.length < colunas) x.push(null); return x; });
    return {
      nome, indice, visivel, linhas, colunas, dimensao: linhas ? `A1:${letraColuna(colunas - 1)}${linhas}` : '(vazia)',
      valores: grade, textos, mescladas, celulasDeMescla, formulas, tabelas,
      celulasPreenchidas: preenchidas, celulasVazias: linhas * colunas - preenchidas,
    };
  }

  // Tipo predominante de uma coluna (para a tela de importação)
  function tipoValor(v) {
    if (v == null || v === '') return 'vazio';
    if (v instanceof Date) return 'data';
    if (typeof v === 'number') return 'numero';
    if (typeof v === 'boolean') return 'booleano';
    const s = String(v).trim();
    if (/^\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}$|^\d{4}-\d{2}-\d{2}/.test(s)) return 'data';
    if (/^-?\d+([.,]\d+)?$/.test(s)) return 'numero';
    return 'texto';
  }

  return { analisarArquivo, ErroLeitura, textoComFormato, tipoValor, letraColuna, refParaRC, extensao, LIMITE_BYTES };
}, typeof module === 'object' ? module : null);
