// Parsers de campos críticos: estação (base/lado/posição), matrícula (sempre texto) e referências.
(typeof module === 'object' ? require('../modulo') : C3BModulo)('core/parsers', ['core/util', 'core/dicionario'], (U, D) => {
  'use strict';

  // Códigos de lado do Dicionário, do mais longo para o mais curto (FR antes de R)
  const LADOS = () => D.ENUMS.LADO.map(l => l.codigo).sort((a, b) => b.length - a.length);
  const PALAVRAS_LADO = [
    [/^(esquerd[ao]|esq|left|lh)$/, 'L'], [/^(direit[ao]|dir|right|rh)$/, 'R'], [/^(centro|central|center)$/, 'C'],
    [/^左$/, 'L'], [/^右$/, 'R'], [/^中$/, 'C'],
  ];

  // "C16L", "C16 L1", "C16-L1", "C16 Esquerda", "C18 FR1", "C19 FZ2", "C16-LEFT" → { station_base, side, position }
  function parseEstacao(bruto) {
    const original = U.valorCelula(bruto);
    if (U.vazio(original)) return { original: original ?? null, status: 'VAZIO', station_base: null, side: null, position: null };
    const s = String(original).trim().toUpperCase().replace(/[‐-―]/g, '-');
    const m = s.match(/^([A-Z]{1,3})\s*-?\s*(\d{1,3})(.*)$/);
    if (!m) return { original, status: 'UNKNOWN', regra: 'ESTACAO_SEM_PADRAO', confianca: 0, station_base: null, side: null, position: null };
    const base = m[1] + m[2];
    let resto = m[3].trim().replace(/^[-_/.\s]+/, '');
    if (!resto) return fim(original, base, null, null, 1, 'STATION_PARSER');
    // lado por palavra (esquerda, left...) opcionalmente seguido de posição
    const mp = resto.match(/^([A-Z一-鿿]+?)\s*-?\s*(\d{1,2})?$/);
    if (mp) {
      const palavra = mp[1];
      for (const [re, lado] of PALAVRAS_LADO) if (re.test(palavra.toLowerCase()))
        return fim(original, base, lado, mp[2] || null, 0.87, 'STATION_PARSER_PALAVRA');
      if (LADOS().includes(palavra)) return fim(original, base, palavra, mp[2] || null, 1, 'STATION_PARSER');
    }
    // lado + posição colados (L1, FR1, FZ2)
    for (const lado of LADOS()) {
      const mm = resto.match(new RegExp(`^${lado}\\s*-?\\s*(\\d{1,2})?$`));
      if (mm) return fim(original, base, lado, mm[1] || null, 1, 'STATION_PARSER');
    }
    // só posição numérica
    const soPos = resto.match(/^(\d{1,2})$/);
    if (soPos) return fim(original, base, null, soPos[1], 0.9, 'STATION_PARSER');
    return { original, status: 'UNKNOWN', regra: 'LADO_NAO_RECONHECIDO', confianca: 0.4, station_base: base, side: null, position: null, resto };
  }
  function fim(original, base, side, position, confianca, regra) {
    const pos = position == null ? null : String(+position);
    return { original, status: confianca >= 0.95 ? 'OK' : 'REVISAR', regra, confianca, station_base: base, side, position: pos,
      normalizado: base + (side || pos ? '-' + (side || '') + (pos || '') : '') };
  }

  // Procura uma estação dentro de um texto maior: "C16R - Conexão da tubulação", "INSPEÇÃO - C16R1 - ..."
  function estacaoEmTexto(txt) {
    const s = String(txt || '').toUpperCase();
    const re = /(?:^|[^A-Z0-9])([A-Z]{1,2}\d{1,3})\s?(FR|FL|FZ|RR|RL|L|R|C)?(\d{1,2})?(?=$|[^A-Z0-9])/g;
    let m;
    while ((m = re.exec(s))) {
      if (/^(SA|C3B)/.test(m[1]) && !m[2]) continue; // modelo (SA6H) ou equipe (C3B) não é estação
      return { station_base: m[1], side: m[2] || null, position: m[3] ? String(+m[3]) : null, trecho: m[0].trim() };
    }
    return null;
  }

  // Matrícula é sempre texto. Se o Excel guardou como número sem formato, zeros à esquerda já se perderam
  // no arquivo; avisamos em vez de inventar.
  function parseMatricula(bruto, { textoFormatado = null, eraNumero = false } = {}) {
    const v = textoFormatado != null && textoFormatado !== '' ? textoFormatado : U.valorCelula(bruto);
    if (U.vazio(v)) return { valor: null, status: 'VAZIO' };
    let s = String(v).trim().replace(/\s+/g, '');
    if (/^\d+\.0+$/.test(s)) s = s.replace(/\.0+$/, '');
    if (!/^[0-9A-Za-z][0-9A-Za-z.\-/]*$/.test(s)) return { valor: null, status: 'INVALIDO', original: String(v) };
    return { valor: s, status: 'OK', avisoNumero: eraNumero && typeof bruto === 'number' && textoFormatado == null };
  }

  return { parseEstacao, estacaoEmTexto, parseMatricula };
}, typeof module === 'object' ? module : null);
