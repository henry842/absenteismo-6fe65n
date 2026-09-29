// Formas (Shapes/Drawings) de um .xlsx, lidas direto do ZIP original (as bibliotecas de planilha ignoram formas).
// Caminho: xl/workbook.xml + xl/_rels/workbook.xml.rels (nome da aba → xl/worksheets/sheetN.xml)
//          → xl/worksheets/_rels/sheetN.xml.rels (→ ../drawings/drawingN.xml)
//          → cada <xdr:twoCellAnchor>/<xdr:oneCellAnchor> com <xdr:sp> e <a:prstGeom prst="...">.
// Âncoras em índices 0-based (como no XML). Não depende do nome da forma: só da geometria e da posição.
(typeof module === 'object' ? require('../modulo') : C3BModulo)('excel/byd_drawings', [], () => {
  'use strict';

  const obterJSZip = x => x || (typeof JSZip !== 'undefined' ? JSZip : require('jszip'));
  const TIPOS = { ellipse: 'ellipse', flowChartConnector: 'ellipse', triangle: 'triangle' }; // ○ e △

  // Atributo de um trecho XML (tolerante a prefixos de namespace diferentes)
  const attr = (xml, nome) => { const m = xml.match(new RegExp(`\\s${nome}="([^"]*)"`)); return m ? decodificar(m[1]) : null; };
  const decodificar = s => s.replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  const elementos = (xml, local) => {
    const re = new RegExp(`<((?:\\w+:)?${local})\\b[^>]*?(?:/>|>[\\s\\S]*?</\\1>)`, 'g');
    return xml.match(re) || [];
  };
  const inteiro = (xml, local) => { const m = xml.match(new RegExp(`<(?:\\w+:)?${local}>(-?\\d+)</(?:\\w+:)?${local}>`)); return m ? +m[1] : null; };
  const ponto = xml => xml ? { col: inteiro(xml, 'col'), colOff: inteiro(xml, 'colOff'), row: inteiro(xml, 'row'), rowOff: inteiro(xml, 'rowOff') } : null;

  // Resolve "../drawings/drawing1.xml" relativo a "xl/worksheets/sheet1.xml"
  function resolver(base, alvo) {
    if (alvo.startsWith('/')) return alvo.slice(1);
    const partes = base.split('/').slice(0, -1);
    for (const p of alvo.split('/')) { if (p === '..') partes.pop(); else if (p !== '.') partes.push(p); }
    return partes.join('/');
  }
  const relsDe = caminho => { const p = caminho.split('/'); const nome = p.pop(); return [...p, '_rels', nome + '.rels'].join('/'); };
  async function lerRels(zip, caminho) {
    const f = zip.file(relsDe(caminho));
    if (!f) return [];
    return elementos(await f.async('string'), 'Relationship').map(r => ({ id: attr(r, 'Id'), tipo: attr(r, 'Type') || '', alvo: resolver(caminho, attr(r, 'Target') || ''), externo: attr(r, 'TargetMode') === 'External' }));
  }

  // Uma âncora → formas (inclui as de dentro de grupos, com a âncora do grupo)
  function formasDaAncora(bloco, tipoAncora, drawingFile, ordem) {
    const inner = bloco.replace(/^<[^>]+>/, '');
    const from = ponto((inner.match(/<(?:\w+:)?from>[\s\S]*?<\/(?:\w+:)?from>/) || [])[0]);
    const to = tipoAncora === 'twoCellAnchor' ? ponto((inner.match(/<(?:\w+:)?to>[\s\S]*?<\/(?:\w+:)?to>/) || [])[0]) : null;
    const emGrupo = /<(?:\w+:)?grpSp\b/.test(inner);
    return elementos(inner, 'sp').map((sp, i) => {
      const cnv = (sp.match(/<(?:\w+:)?cNvPr\b[^>]*>/) || [''])[0];
      const prst = (sp.match(/<(?:\w+:)?prstGeom\b[^>]*prst="([^"]+)"/) || [])[1] || null;
      const texto = (sp.match(/<a:t>([^<]*)<\/a:t>/g) || []).map(t => decodificar(t.replace(/<\/?a:t>/g, ''))).join('').trim();
      return { drawing_file: drawingFile, ordem: ordem + i / 100, shape_id: attr(cnv, 'id'), shape_name: attr(cnv, 'name'),
        prst, tipo: TIPOS[prst] || 'outro', anchor_type: tipoAncora, from, to, hidden: attr(cnv, 'hidden') === '1', em_grupo: emGrupo, texto: texto || null };
    });
  }

  // bytes do .xlsx → { abas: { [nome]: { sheet_file, drawing_file, formas: [...] } }, tema: {...} }
  async function lerFormas(bytes, { JSZip: lib = null } = {}) {
    const zip = await obterJSZip(lib).loadAsync(bytes);
    const wbXml = await zip.file('xl/workbook.xml').async('string');
    const relsWb = await lerRels(zip, 'xl/workbook.xml');
    const abas = {};
    for (const s of elementos(wbXml, 'sheet')) {
      const nome = attr(s, 'name'), rid = attr(s, 'r:id') || attr(s, 'id');
      const rel = relsWb.find(r => r.id === rid);
      if (!rel) continue;
      const aba = { nome, sheet_file: rel.alvo, drawing_file: null, formas: [] };
      abas[nome] = aba;
      const relDrawing = (await lerRels(zip, rel.alvo)).find(r => /\/drawing$/.test(r.tipo));
      if (!relDrawing || !zip.file(relDrawing.alvo)) continue;
      aba.drawing_file = relDrawing.alvo;
      const xml = await zip.file(relDrawing.alvo).async('string');
      let ordem = 0;
      for (const tipo of ['twoCellAnchor', 'oneCellAnchor', 'absoluteAnchor']) {
        for (const bloco of elementos(xml, tipo)) aba.formas.push(...formasDaAncora(bloco, tipo, relDrawing.alvo, ordem++));
      }
    }
    return { abas, tema: await lerTema(zip) };
  }

  // Cores do tema (para resolver preenchimentos "theme N + tint" das células)
  async function lerTema(zip) {
    const rel = (await lerRels(zip, 'xl/workbook.xml')).find(r => /\/theme$/.test(r.tipo));
    const f = rel && zip.file(rel.alvo);
    if (!f) return null;
    const xml = await f.async('string');
    const esquema = (xml.match(/<a:clrScheme\b[\s\S]*?<\/a:clrScheme>/) || [''])[0];
    const cor = nome => { const m = esquema.match(new RegExp(`<a:${nome}>[\\s\\S]*?(?:srgbClr val="([0-9A-Fa-f]{6})"|lastClr="([0-9A-Fa-f]{6})")`)); return m ? (m[1] || m[2]).toUpperCase() : null; };
    // Ordem dos índices de tema usada pelas células do Excel: lt1, dk1, lt2, dk2, accent1..6, hlink, folHlink
    return ['lt1', 'dk1', 'lt2', 'dk2', 'accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'accent6', 'hlink', 'folHlink'].map(cor);
  }

  // Cor do tema com tint (regra do Excel/ECMA-376, via HSL)
  function corDoTema(tema, indice, tint = 0) {
    const base = tema && tema[indice];
    if (!base) return null;
    let [r, g, b] = [0, 2, 4].map(i => parseInt(base.slice(i, i + 2), 16) / 255);
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0, l = (max + min) / 2;
    if (max !== min) {
      const d = max - min; s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4; h /= 6;
    }
    if (tint < 0) l = l * (1 + tint); else if (tint > 0) l = l * (1 - tint) + tint;
    const f = (p, q, t) => { if (t < 0) t += 1; if (t > 1) t -= 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
    if (s === 0) r = g = b = l; else { const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q; r = f(p, q, h + 1 / 3); g = f(p, q, h); b = f(p, q, h - 1 / 3); }
    return 'FF' + [r, g, b].map(x => Math.round(x * 255).toString(16).padStart(2, '0')).join('').toUpperCase();
  }

  // Célula (0-based) que representa a forma: o centro entre "from" e "to" (ou "from" quando não há "to")
  function celulaCentral(f) {
    if (!f.from) return null;
    if (!f.to) return { row: f.from.row, col: f.from.col };
    return { row: Math.floor((f.from.row + f.to.row) / 2), col: Math.floor((f.from.col + f.to.col) / 2) };
  }

  return { lerFormas, lerTema, corDoTema, celulaCentral, TIPOS };
}, typeof module === 'object' ? module : null);
