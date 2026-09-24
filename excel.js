// Gera e lê o arquivo Excel (.xlsx) do absenteísmo, sem biblioteca externa.
// O .xlsx é um zip de arquivos XML. Escrevemos sem compressão; na leitura aceitamos
// também o arquivo depois que o Excel salvou por cima (comprimido, com textos compartilhados).
(function (raiz) {
  'use strict';

  const L = (typeof module !== 'undefined' && module.exports) ? require('./leitor.js') : raiz.Leitor;
  const ABA_BACKUP = '_backup';
  const TAM_PEDACO = 30000; // Excel aceita até 32767 caracteres por célula

  // ---------- zip ----------
  const TABELA_CRC = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })();
  function crc32(bytes) {
    let c = 0xffffffff;
    for (let i = 0; i < bytes.length; i++) c = TABELA_CRC[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }

  function zipar(arquivos, agora) {
    const enc = new TextEncoder();
    const d = agora || new Date();
    const hora = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
    const dia = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
    const partes = [], central = [];
    let pos = 0;
    for (const a of arquivos) {
      const nome = enc.encode(a.nome);
      const dados = typeof a.conteudo === 'string' ? enc.encode(a.conteudo) : a.conteudo;
      const crc = crc32(dados);
      const loc = new DataView(new ArrayBuffer(30));
      loc.setUint32(0, 0x04034b50, true); loc.setUint16(4, 20, true); loc.setUint16(6, 0x0800, true);
      loc.setUint16(8, 0, true); loc.setUint16(10, hora, true); loc.setUint16(12, dia, true);
      loc.setUint32(14, crc, true); loc.setUint32(18, dados.length, true); loc.setUint32(22, dados.length, true);
      loc.setUint16(26, nome.length, true); loc.setUint16(28, 0, true);
      const cen = new DataView(new ArrayBuffer(46));
      cen.setUint32(0, 0x02014b50, true); cen.setUint16(4, 20, true); cen.setUint16(6, 20, true);
      cen.setUint16(8, 0x0800, true); cen.setUint16(10, 0, true); cen.setUint16(12, hora, true); cen.setUint16(14, dia, true);
      cen.setUint32(16, crc, true); cen.setUint32(20, dados.length, true); cen.setUint32(24, dados.length, true);
      cen.setUint16(28, nome.length, true); cen.setUint32(42, pos, true);
      partes.push(new Uint8Array(loc.buffer), nome, dados);
      central.push(new Uint8Array(cen.buffer), nome);
      pos += 30 + nome.length + dados.length;
    }
    const tamCentral = central.reduce((s, p) => s + p.length, 0);
    const fim = new DataView(new ArrayBuffer(22));
    fim.setUint32(0, 0x06054b50, true);
    fim.setUint16(8, arquivos.length, true); fim.setUint16(10, arquivos.length, true);
    fim.setUint32(12, tamCentral, true); fim.setUint32(16, pos, true);
    const tudo = partes.concat(central, [new Uint8Array(fim.buffer)]);
    const saida = new Uint8Array(tudo.reduce((s, p) => s + p.length, 0));
    let o = 0;
    for (const p of tudo) { saida.set(p, o); o += p.length; }
    return saida;
  }

  async function inflar(bytes) {
    const ds = new DecompressionStream('deflate-raw');
    const buf = await new Response(new Blob([bytes]).stream().pipeThrough(ds)).arrayBuffer();
    return new Uint8Array(buf);
  }

  // Devolve { 'caminho/no/zip': Uint8Array }
  async function deszipar(bytes) {
    const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let fimPos = -1;
    for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
      if (v.getUint32(i, true) === 0x06054b50) { fimPos = i; break; }
    }
    if (fimPos < 0) throw new Error('Não é um arquivo Excel (.xlsx).');
    const n = v.getUint16(fimPos + 10, true);
    let p = v.getUint32(fimPos + 16, true);
    const dec = new TextDecoder();
    const saida = {};
    for (let i = 0; i < n; i++) {
      if (v.getUint32(p, true) !== 0x02014b50) throw new Error('Arquivo Excel corrompido.');
      const metodo = v.getUint16(p + 10, true);
      const tam = v.getUint32(p + 20, true);
      const nl = v.getUint16(p + 28, true), el = v.getUint16(p + 30, true), cl = v.getUint16(p + 32, true);
      const off = v.getUint32(p + 42, true);
      const nome = dec.decode(bytes.subarray(p + 46, p + 46 + nl));
      const ini = off + 30 + v.getUint16(off + 26, true) + v.getUint16(off + 28, true);
      const bruto = bytes.subarray(ini, ini + tam);
      saida[nome] = metodo === 0 ? bruto : metodo === 8 ? await inflar(bruto) : null;
      p += 46 + nl + el + cl;
    }
    return saida;
  }

  // ---------- XML ----------
  const escXml = s => String(s == null ? '' : s)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const desescXml = s => s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');

  function letraColuna(i) {
    let s = '';
    for (i++; i > 0; i = Math.floor((i - 1) / 26)) s = String.fromCharCode(65 + (i - 1) % 26) + s;
    return s;
  }

  // Data ISO → número de série do Excel
  function serialExcel(iso) {
    const [a, m, d] = iso.split('-').map(Number);
    return Math.round((Date.UTC(a, m - 1, d) - Date.UTC(1899, 11, 30)) / 86400000);
  }

  // Estilos: 0 normal · 1 cabeçalho · 2 data · 3 porcentagem · 4 texto quebrando linha
  const ESTILO = { t: 0, n: 0, d: 2, p: 3 };
  const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="2"><numFmt numFmtId="164" formatCode="dd/mm/yyyy"/><numFmt numFmtId="165" formatCode="0.0%"/></numFmts>
<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts>
<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF1F5FBF"/><bgColor indexed="64"/></patternFill></fill></fills>
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="5">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>
<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment wrapText="1" vertical="top"/></xf>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

  function celula(ref, valor, tipo) {
    if (valor == null || valor === '') return '';
    if (tipo === 'd') return `<c r="${ref}" s="${ESTILO.d}"><v>${serialExcel(valor)}</v></c>`;
    if ((tipo === 'n' || tipo === 'p') && typeof valor === 'number' && isFinite(valor))
      return `<c r="${ref}" s="${ESTILO[tipo]}"><v>${valor}</v></c>`;
    return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${escXml(valor)}</t></is></c>`;
  }

  // aba = { nome, colunas: [{titulo, tipo:'t'|'n'|'d'|'p', largura}], linhas: [[...]], oculta }
  function xmlAba(aba) {
    const cols = aba.colunas.map((c, i) => `<col min="${i + 1}" max="${i + 1}" width="${c.largura || 14}" customWidth="1"/>`).join('');
    const cab = `<row r="1">${aba.colunas.map((c, i) => `<c r="${letraColuna(i)}1" s="1" t="inlineStr"><is><t>${escXml(c.titulo)}</t></is></c>`).join('')}</row>`;
    const corpo = aba.linhas.map((ln, r) =>
      `<row r="${r + 2}">${ln.map((v, i) => celula(letraColuna(i) + (r + 2), v, aba.colunas[i].tipo)).join('')}</row>`).join('');
    const ultima = letraColuna(aba.colunas.length - 1) + (aba.linhas.length + 1);
    const congelar = aba.oculta ? '' : '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>';
    const filtro = aba.oculta || !aba.linhas.length ? '' : `<autoFilter ref="A1:${ultima}"/>`;
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
${congelar}<cols>${cols}</cols><sheetData>${cab}${corpo}</sheetData>${filtro}</worksheet>`;
  }

  function gerarXlsx(abas, agora) {
    const arquivos = [];
    arquivos.push({ nome: '[Content_Types].xml', conteudo: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
${abas.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('\n')}
</Types>` });
    arquivos.push({ nome: '_rels/.rels', conteudo: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>` });
    const nomes = [];
    arquivos.push({ nome: 'xl/workbook.xml', conteudo: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets>${abas.map((a, i) => `<sheet name="${escXml(a.nome)}" sheetId="${i + 1}"${a.oculta ? ' state="hidden"' : ''} r:id="rId${i + 1}"/>`).join('')}</sheets>
<definedNames>${abas.map((a, i) => {
    if (a.oculta || !a.linhas.length) return '';
    const ultima = letraColuna(a.colunas.length - 1) + (a.linhas.length + 1);
    return `<definedName name="_xlnm._FilterDatabase" localSheetId="${i}" hidden="1">'${escXml(a.nome)}'!$A$1:$${ultima.replace(/(\d+)$/, '$$$1')}</definedName>`;
  }).join('')}</definedNames>
</workbook>`.replace('<definedNames></definedNames>', '') });
    arquivos.push({ nome: 'xl/_rels/workbook.xml.rels', conteudo: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${abas.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('\n')}
<Relationship Id="rId${abas.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>` });
    arquivos.push({ nome: 'xl/styles.xml', conteudo: STYLES });
    abas.forEach((a, i) => arquivos.push({ nome: `xl/worksheets/sheet${i + 1}.xml`, conteudo: xmlAba(a) }));
    return zipar(arquivos, agora);
  }

  // ---------- conteúdo do absenteísmo ----------
  const ordenar = (a, b) => a.data.localeCompare(b.data) || a.time.localeCompare(b.time, 'pt', { numeric: true });
  const nomeDia = iso => L.DIAS_SEMANA[L.diaDaSemana(iso)];

  function abasDaBase(base) {
    const naoContam = (base.config && base.config.naoContam) || [];
    const fs = Object.values(base.fechamentos || {}).sort(ordenar);
    const datas = [...new Set(fs.map(f => f.data))].sort();

    const resumo = datas.map(d => {
      const r = L.resumoDoDia(base, d);
      return [d, nomeDia(d), r.recebidos.length, r.efetivo, r.presentes, r.ausentes, r.efetivo ? r.faltasQueContam / r.efetivo : 0];
    });
    const porTime = fs.map(f => [f.data, nomeDia(f.data), f.time, f.turno || '', f.efetivo, f.presentes, f.ausentes,
      f.efetivo ? L.faltasDoFechamento(f, naoContam) / f.efetivo : 0]);
    const ausencias = [];
    for (const f of fs) for (const p of f.pessoas)
      ausencias.push([f.data, nomeDia(f.data), f.time, f.turno || '', p.matricula, p.nome, p.motivo, p.motivoOriginal]);
    const ultima = datas[datas.length - 1];
    const reinc = ultima ? L.alertasReincidencia(base, ultima, 30, 3).map(a => [
      a.nome, a.matricula, a.time, a.total, a.datas.map(d => L.dataBR(d).slice(0, 5)).join(', '),
      a.padraoDia || '', Object.entries(a.motivos).map(([m, n]) => `${m} (${n})`).join(', '),
    ]) : [];

    const json = JSON.stringify(base);
    const pedacos = [];
    for (let i = 0; i < json.length; i += TAM_PEDACO) pedacos.push([json.slice(i, i + TAM_PEDACO)]);

    return [
      { nome: 'Resumo por dia', linhas: resumo, colunas: [
        { titulo: 'Data', tipo: 'd', largura: 12 }, { titulo: 'Dia da semana', tipo: 't', largura: 14 },
        { titulo: 'Times recebidos', tipo: 'n', largura: 15 }, { titulo: 'Efetivo', tipo: 'n', largura: 10 },
        { titulo: 'Presentes', tipo: 'n', largura: 11 }, { titulo: 'Ausentes', tipo: 'n', largura: 10 },
        { titulo: 'Absenteísmo', tipo: 'p', largura: 13 }] },
      { nome: 'Por time', linhas: porTime, colunas: [
        { titulo: 'Data', tipo: 'd', largura: 12 }, { titulo: 'Dia da semana', tipo: 't', largura: 14 },
        { titulo: 'Time', tipo: 't', largura: 9 }, { titulo: 'Turno', tipo: 't', largura: 10 },
        { titulo: 'Efetivo', tipo: 'n', largura: 10 }, { titulo: 'Presentes', tipo: 'n', largura: 11 },
        { titulo: 'Ausentes', tipo: 'n', largura: 10 }, { titulo: 'Absenteísmo', tipo: 'p', largura: 13 }] },
      { nome: 'Ausências', linhas: ausencias, colunas: [
        { titulo: 'Data', tipo: 'd', largura: 12 }, { titulo: 'Dia da semana', tipo: 't', largura: 14 },
        { titulo: 'Time', tipo: 't', largura: 9 }, { titulo: 'Turno', tipo: 't', largura: 10 },
        { titulo: 'Matrícula', tipo: 't', largura: 12 }, { titulo: 'Nome', tipo: 't', largura: 32 },
        { titulo: 'Motivo', tipo: 't', largura: 22 }, { titulo: 'Escrito pelo líder', tipo: 't', largura: 28 }] },
      { nome: 'Reincidência 30 dias', linhas: reinc, colunas: [
        { titulo: 'Nome', tipo: 't', largura: 32 }, { titulo: 'Matrícula', tipo: 't', largura: 12 },
        { titulo: 'Time', tipo: 't', largura: 9 }, { titulo: 'Ausências', tipo: 'n', largura: 11 },
        { titulo: 'Datas', tipo: 't', largura: 30 }, { titulo: 'Mesmo dia da semana', tipo: 't', largura: 20 },
        { titulo: 'Motivos', tipo: 't', largura: 34 }] },
      { nome: ABA_BACKUP, oculta: true, linhas: pedacos, colunas: [{ titulo: 'Backup do sistema de absenteísmo. Não altere esta aba.', tipo: 't', largura: 60 }] },
    ];
  }

  function gerarExcel(base, agora) { return gerarXlsx(abasDaBase(base), agora); }

  // Lê a aba escondida de backup e devolve a base. Funciona mesmo depois do Excel salvar por cima.
  async function lerBackupDoExcel(bytes) {
    const z = await deszipar(bytes);
    const txt = k => z[k] ? new TextDecoder().decode(z[k]) : '';
    const attrs = tag => {
      const o = {};
      tag.replace(/([\w:]+)="([^"]*)"/g, (_, k, v) => { o[k] = desescXml(v); });
      return o;
    };
    const aba = (txt('xl/workbook.xml').match(/<sheet\b[^>]*\/?>/g) || []).map(attrs).find(a => a.name === ABA_BACKUP);
    if (!aba) throw new Error('Esse Excel não tem o backup do sistema.');
    const rel = (txt('xl/_rels/workbook.xml.rels').match(/<Relationship\b[^>]*\/?>/g) || []).map(attrs).find(r => r.Id === aba['r:id']);
    if (!rel) throw new Error('Arquivo Excel incompleto.');
    const caminho = rel.Target.startsWith('/') ? rel.Target.slice(1) : 'xl/' + rel.Target.replace(/^\.\//, '');
    const textoT = x => (x.match(/<t\b[^>]*>([\s\S]*?)<\/t>/g) || []).map(t => desescXml(t.replace(/^<t\b[^>]*>|<\/t>$/g, ''))).join('');
    const compartilhados = (txt('xl/sharedStrings.xml').match(/<si>[\s\S]*?<\/si>/g) || []).map(textoT);

    const celulas = [];
    const re = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
    let m;
    const xml = txt(caminho);
    while ((m = re.exec(xml))) {
      const a = attrs(m[1]);
      const col = (a.r || '').replace(/\d+/g, ''), lin = +(a.r || '').replace(/\D+/g, '');
      if (col !== 'A' || lin < 2) continue;
      const corpo = m[2] || '';
      const v = (corpo.match(/<v>([\s\S]*?)<\/v>/) || [])[1];
      let valor = '';
      if (a.t === 'inlineStr') valor = textoT(corpo);
      else if (a.t === 's') valor = compartilhados[+v] || '';
      else if (v != null) valor = desescXml(v);
      celulas.push([lin, valor]);
    }
    celulas.sort((x, y) => x[0] - y[0]);
    const base = JSON.parse(celulas.map(c => c[1]).join(''));
    if (!base || !base.fechamentos) throw new Error('Backup do Excel inválido.');
    return base;
  }

  const Excel = { gerarXlsx, gerarExcel, abasDaBase, lerBackupDoExcel, zipar, deszipar, crc32, serialExcel, letraColuna };
  if (typeof module !== 'undefined' && module.exports) module.exports = Excel;
  else raiz.Excel = Excel;
})(typeof window !== 'undefined' ? window : globalThis);
