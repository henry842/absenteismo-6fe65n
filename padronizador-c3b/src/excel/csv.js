// Leitor de CSV: detecta codificação (UTF-8, com ou sem BOM; senão Windows-1252) e separador (; , tab |).
// Todos os valores ficam como texto: matrícula "001234" continua "001234".
(typeof module === 'object' ? require('../modulo') : C3BModulo)('excel/csv', [], () => {
  'use strict';

  function decodificar(bytes) {
    const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    if (u8[0] === 0xef && u8[1] === 0xbb && u8[2] === 0xbf) return { texto: new TextDecoder('utf-8').decode(u8.subarray(3)), codificacao: 'UTF-8 (BOM)' };
    if (u8[0] === 0xff && u8[1] === 0xfe) return { texto: new TextDecoder('utf-16le').decode(u8.subarray(2)), codificacao: 'UTF-16LE' };
    try { return { texto: new TextDecoder('utf-8', { fatal: true }).decode(u8), codificacao: 'UTF-8' }; }
    catch (e) { return { texto: new TextDecoder('windows-1252').decode(u8), codificacao: 'Windows-1252' }; }
  }

  function detectarSeparador(texto) {
    const linhas = texto.split(/\r?\n/).filter(l => l.trim()).slice(0, 20);
    let melhor = { sep: ',', nota: -1 };
    for (const sep of [';', ',', '\t', '|']) {
      const contagens = linhas.map(l => contarForaDeAspas(l, sep));
      const media = contagens.reduce((a, b) => a + b, 0) / (contagens.length || 1);
      if (!media) continue;
      const iguais = contagens.filter(c => c === contagens[0]).length / contagens.length;
      const nota = media * iguais;
      if (nota > melhor.nota) melhor = { sep, nota };
    }
    return melhor.sep;
  }
  function contarForaDeAspas(l, sep) {
    let n = 0, aspas = false;
    for (const ch of l) { if (ch === '"') aspas = !aspas; else if (ch === sep && !aspas) n++; }
    return n;
  }

  // RFC 4180: aspas, aspas duplas escapadas e quebras de linha dentro de campos
  function parse(texto, sep) {
    const linhas = [];
    let campo = '', linha = [], aspas = false;
    for (let i = 0; i < texto.length; i++) {
      const ch = texto[i];
      if (aspas) {
        if (ch === '"') { if (texto[i + 1] === '"') { campo += '"'; i++; } else aspas = false; }
        else campo += ch;
      } else if (ch === '"' && campo === '') aspas = true;
      else if (ch === sep) { linha.push(campo); campo = ''; }
      else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && texto[i + 1] === '\n') i++;
        linha.push(campo); linhas.push(linha); linha = []; campo = '';
      } else campo += ch;
    }
    if (campo !== '' || linha.length) { linha.push(campo); linhas.push(linha); }
    return linhas.map(l => l.map(v => (v === '' ? null : v)));
  }

  function lerCsv(bytes) {
    const { texto, codificacao } = decodificar(bytes);
    const separador = detectarSeparador(texto);
    return { linhas: parse(texto, separador), codificacao, separador };
  }

  return { lerCsv, decodificar, detectarSeparador, parse };
}, typeof module === 'object' ? module : null);
