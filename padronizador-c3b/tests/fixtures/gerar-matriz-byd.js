// Fixture estruturalmente idêntica à Matriz BYD real ("Planejamento de Treinamento de Habilidades"),
// com nomes fictícios: blocos de 4 colunas por pessoa e 4 linhas por operação, marcador oculto 1 (fonte branca)
// em (início+2, início+2), fórmula "Número L proficiente" =SUM(E11+E15+...), preenchimentos reais (FF92D050,
// FFFFFF00, cor de tema 0) e as formas ○ △ gravadas em xl/drawings/drawing1.xml como no arquivo real
// (twoCellAnchor + <xdr:sp> + <a:prstGeom prst="ellipse|triangle">), inclusive elipses duplicadas, legenda e retângulos.
// Uso: node tests/fixtures/gerar-matriz-byd.js
// Variante (testes de reconciliação): gerar({ saida, marcadoresL: [[pessoa, operação], ...] }) acrescenta marcadores 1
// — simula a Matriz oficial atualizada depois de um ajuste manual.
const ExcelJS = require('exceljs'), JSZip = require('jszip'), fs = require('fs'), path = require('path');
const SAIDA = path.join(__dirname, 'Matriz_BYD_estrutura_real_sintetica.xlsx');

const PESSOAS = ['JOÃO EXEMPLO DA SILVA', 'MARIA EXEMPLO SANTOS', 'CARLOS EXEMPLO LIMA', 'ANA EXEMPLO SOUZA', 'PEDRO EXEMPLO ALVES', '王伟 EXEMPLO'];
const OPS = [
  '左侧后稳定杆分装合件预紧\nC14 FZ1 - A barra estabilizadora traseira esquerda é pré-carregada',
  '后横向稳定杆与稳定杆拉杆分装 \nC16 L1 - Aperto do suporte dianteiro',
  '车身紧固互检--右\nC25 R1 - Verificação mútua de fixação do corpo - direita',
  '前副车架力矩紧固-左\nC14 L1 - Fixação do momento do quadro secundário dianteiro - Esquerda',
];
const col = i => 3 + 4 * i;            // C, G, K, O, S, W
const linha = j => 9 + 4 * j;          // 9, 13, 17, 21
const RESUMO = 25;
const TEMA_BRANCO = { type: 'pattern', pattern: 'solid', fgColor: { theme: 0, tint: 0 }, bgColor: { indexed: 64 } };
const cor = argb => ({ type: 'pattern', pattern: 'solid', fgColor: { argb }, bgColor: { indexed: 64 } });

// Blocos: [pessoa, operação, { L, fill, datas, extra }]
const BLOCOS = [
  [0, 0, { L: true, fill: 'FF92D050' }],                                     // ○ só → TITULAR, L, GREEN
  [1, 0, { datas: '12/08/2026\n14/08/2026' }],                               // △ só → EM_TREINAMENTO, sem L
  [2, 0, { datas: '01/09/2026' }],                                           // ○ + △ → FUTURO_TITULAR, sem L
  [0, 1, { L: true, fill: 'FFFFFF00' }],                                     // duas ○ sobrepostas → um TITULAR, YELLOW
  [3, 1, { L: true, fill: 'FF92D050' }],                                     // só marcador 1 → L, SEM_DESIGNACAO
  [3, 2, {}],                                                                // ○ sem L → WARNING
  [1, 2, { L: true, fill: 'FF92D050' }],                                     // △ com L → WARNING
  [2, 2, { L: true, fill: 'FF92D050' }],                                     // ○ + △ + L → WARNING (preservado)
  [4, 3, { L: true, fill: 'FF00B0F0', extra: 'c' }],                        // outra cor (só metadado); "c" = resíduo conhecido do perfil
  [4, 0, { extra: 'XYZ' }],                                                  // valor sem regra → pendência (não é resíduo conhecido)
  [5, 3, { L: true, fill: 'FF92D050' }],                                     // nome em chinês
];
// Formas (0-based, como no XML). col/row = célula; "ate" = to (quando diferente)
const E = (c, r, extra = {}) => ({ prst: 'ellipse', c, r, ...extra });
const T = (c, r, extra = {}) => ({ prst: 'triangle', c, r, ...extra });
const c0 = i => col(i) - 1 + 2;        // coluna do marcador (0-based)
const r0 = j => linha(j) - 1;          // 1ª linha do bloco (0-based)
const FORMAS = [
  E(c0(0), r0(0) + 2, { name: 'Elipse 149' }),
  T(c0(1), r0(0), { tr: r0(0) + 1, name: 'Triângulo isósceles 148' }),
  T(c0(2), r0(0), { tr: r0(0) + 1, name: 'Triângulo isósceles 150' }), E(c0(2), r0(0) + 2, { name: 'Elipse 151' }),
  E(c0(0), r0(1) + 1, { tr: r0(1) + 2, name: 'Elipse 5' }), E(c0(0), r0(1) + 1, { tr: r0(1) + 2, name: 'Elipse 6' }),   // sobrepostas
  E(c0(3), r0(2) + 1, { tr: r0(2) + 2, name: 'Elipse 20' }),
  T(c0(1), r0(2), { tr: r0(2) + 1, name: 'Triângulo isósceles 30' }),
  T(c0(2), r0(2), { tr: r0(2) + 1, name: 'Triângulo isósceles 31' }), E(c0(2), r0(2) + 2, { name: 'Elipse 32' }),
  // legenda abaixo da grade (como "Oval 7" / "Isosceles Triangle 16" do arquivo real): deve ser ignorada
  E(27, RESUMO + 1, { tr: RESUMO + 1, name: 'Oval 7', legenda: true }), T(27, RESUMO + 2, { tr: RESUMO + 2, name: 'Isosceles Triangle 16', legenda: true }),
  // forma fora da grade (acima das operações): aviso
  E(10, 2, { name: 'Elipse perdida' }),
];

async function gerar({ saida = SAIDA, marcadoresL = [] } = {}) {
  const blocos = BLOCOS.map(([i, j, b]) => [i, j, marcadoresL.some(([mi, mj]) => mi === i && mj === j) ? { ...b, L: true, fill: b.fill || 'FF92D050' } : b])
    .concat(marcadoresL.filter(([mi, mj]) => !BLOCOS.some(([i, j]) => i === mi && j === mj)).map(([i, j]) => [i, j, { L: true, fill: 'FF92D050' }]));
  const wb = new ExcelJS.Workbook();
  // HA2H: mesma equipe, com a grafia de um sobrenome trocada (como acontece no arquivo real)
  const GRAFIA_HA2H = { 4: 'PEDRO EXEMPLO ALVSE' };
  for (const nomeAba of ['SA6H', 'HA2H', 'Exemplo 范例']) {
    const ws = wb.addWorksheet(nomeAba);
    ws.getCell('A2').value = 'Divisão 11 \n第十一事业部 ';
    ws.getCell('C2').value = 'Planejamento de Treinamento de Habilidades da Montagem Final Seção Chassis (EXEMPLO)';
    ws.getCell(`${letra(col(4))}2`).value = 'Técnico\n技术员'; ws.mergeCells(2, col(4), 3, col(4) + 3);
    ws.getCell(`${letra(col(5))}2`).value = 'Lider de equipe\n领班 '; ws.mergeCells(2, col(5), 3, col(5) + 3);
    ws.getCell(`${letra(col(6))}2`).value = 'Proficiência de nível L em cada processo \n各工序L等级熟练';
    ws.getCell('B5').value = 'Nome do operador\n 作业员姓名';
    ws.getCell('A7').value = 'Nome de Posto\n岗位名称 '; ws.mergeCells('A7:B8');
    PESSOAS.forEach((p, i) => {
      ws.getCell(5, col(i)).value = (nomeAba === 'HA2H' && GRAFIA_HA2H[i]) || p; ws.getCell(5, col(i)).font = { color: { argb: 'FFFF0000' } };
      ws.getCell(7, col(i)).value = 'Dia日\nMês月  '; ws.getCell(7, col(i) + 1).value = 'Nível de habilidade \n技水能准';
    });
    OPS.forEach((t, j) => {
      ws.getCell(linha(j), 1).value = String(j + 1); ws.mergeCells(linha(j), 1, linha(j) + 3, 1);
      ws.getCell(linha(j), 2).value = t; ws.mergeCells(linha(j), 2, linha(j) + 3, 2);
      PESSOAS.forEach((_, i) => {
        ws.mergeCells(linha(j), col(i), linha(j) + 3, col(i));
        for (let r = linha(j); r < linha(j) + 4; r++) for (let c = col(i) + 1; c < col(i) + 4; c++) ws.getCell(r, c).fill = TEMA_BRANCO;
      });
    });
    for (const [i, j, b] of blocos) {
      if (b.fill) for (let r = linha(j); r < linha(j) + 4; r++) for (let c = col(i) + 1; c < col(i) + 4; c++) ws.getCell(r, c).fill = cor(b.fill);
      if (b.L) { const m = ws.getCell(linha(j) + 2, col(i) + 2); m.value = 1; m.font = { color: { theme: 0 } }; }
      if (b.datas) ws.getCell(linha(j), col(i)).value = b.datas;
      if (b.extra) ws.getCell(linha(j), col(i) + 1).value = b.extra;
    }
    ws.getCell(RESUMO, 1).value = 'Número L proficiente de cada operador 各作业员L熟练数量'; ws.mergeCells(RESUMO, 1, RESUMO, 2);
    PESSOAS.forEach((_, i) => {
      const refs = OPS.map((__, j) => `${letra(col(i) + 2)}${linha(j) + 2}`);
      let total = blocos.filter(([pi, , b]) => pi === i && b.L).length;
      if (i === 3 && nomeAba === 'SA6H') total = 3;   // resultado salvo desatualizado (como no arquivo real): deve gerar aviso, sem mudar a leitura
      ws.getCell(RESUMO, col(i)).value = { formula: `SUM(${refs.join('+')})`, result: total };
    });
    ws.getCell(RESUMO + 1, 1).value = 'Nota备　注';
    ws.getCell(RESUMO + 1, 2).value = 'Definição  定义：\ni: Fase de treinamento. …\nL: Fase de trabalho. …';
  }
  const base = wb.addWorksheet('BASE DE DADOS');
  base.getCell('A4').value = 'Modelo\n车型'; base.getCell('A5').value = 'SA6H';
  let bytes = await wb.xlsx.writeBuffer();
  // ---- formas: drawing1.xml ligado à aba SA6H, do mesmo jeito que o Excel grava ----
  const zip = await JSZip.loadAsync(bytes);
  const wbXml = await zip.file('xl/workbook.xml').async('string');
  const rid = wbXml.match(/<sheet [^>]*name="SA6H"[^>]*r:id="([^"]+)"/)[1];
  const rels = await zip.file('xl/_rels/workbook.xml.rels').async('string');
  const alvo = 'xl/' + rels.match(new RegExp(`Id="${rid}"[^>]*Target="([^"]+)"|Target="([^"]+)"[^>]*Id="${rid}"`)).slice(1).find(Boolean).replace(/^\/?xl\//, '');
  const relsAba = alvo.replace(/worksheets\//, 'worksheets/_rels/') + '.rels';
  const RID = 'rIdC3BDraw1';
  const relNova = `<Relationship Id="${RID}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing1.xml"/>`;
  const relsAtual = zip.file(relsAba) ? await zip.file(relsAba).async('string') : '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>';
  zip.file(relsAba, relsAtual.replace('</Relationships>', relNova + '</Relationships>'));
  let sheetXml = await zip.file(alvo).async('string');
  if (!/xmlns:r=/.test(sheetXml)) sheetXml = sheetXml.replace('<worksheet ', '<worksheet xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ');
  const antes = ['<legacyDrawing', '<tableParts', '<extLst', '</worksheet>'].map(t => sheetXml.indexOf(t)).filter(i => i >= 0).sort((a, b) => a - b)[0];
  sheetXml = sheetXml.slice(0, antes) + `<drawing r:id="${RID}"/>` + sheetXml.slice(antes);
  zip.file(alvo, sheetXml);
  zip.file('xl/drawings/drawing1.xml', drawingXml());
  const ct = await zip.file('[Content_Types].xml').async('string');
  zip.file('[Content_Types].xml', ct.replace('</Types>', '<Override PartName="/xl/drawings/drawing1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/></Types>'));
  bytes = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  fs.writeFileSync(saida, bytes);
  console.log('gerado', saida, bytes.length, 'bytes');
  return saida;
}

function drawingXml() {
  let id = 2;
  const ancora = (f) => `<xdr:twoCellAnchor><xdr:from><xdr:col>${f.c}</xdr:col><xdr:colOff>95250</xdr:colOff><xdr:row>${f.r}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from>`
    + `<xdr:to><xdr:col>${f.tc ?? f.c}</xdr:col><xdr:colOff>330200</xdr:colOff><xdr:row>${f.tr ?? f.r}</xdr:row><xdr:rowOff>213995</xdr:rowOff></xdr:to>`
    + `<xdr:sp macro="" textlink=""><xdr:nvSpPr><xdr:cNvPr id="${id++}" name="${f.name || f.prst + ' ' + id}"/><xdr:cNvSpPr/></xdr:nvSpPr>`
    + `<xdr:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="235000" cy="214000"/></a:xfrm><a:prstGeom prst="${f.prst}"><a:avLst/></a:prstGeom>`
    + (f.prst === 'triangle' || f.legenda ? '<a:noFill/>' : '<a:solidFill><a:srgbClr val="FFFFFF"><a:alpha val="0"/></a:srgbClr></a:solidFill>')
    + `<a:ln w="28575"><a:solidFill><a:srgbClr val="${f.prst === 'triangle' ? 'FF0000' : '0070C0'}"/></a:solidFill></a:ln></xdr:spPr></xdr:sp><xdr:clientData/></xdr:twoCellAnchor>`;
  // decoração do cabeçalho (retângulo com "i IＬＵ", como no arquivo real) e uma linha: não são marcadores
  const retangulo = `<xdr:twoCellAnchor><xdr:from><xdr:col>1</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>6</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from><xdr:to><xdr:col>1</xdr:col><xdr:colOff>100</xdr:colOff><xdr:row>7</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to>`
    + `<xdr:sp macro="" textlink=""><xdr:nvSpPr><xdr:cNvPr id="${id++}" name="Rectangle 2"/><xdr:cNvSpPr/></xdr:nvSpPr><xdr:spPr><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/></xdr:spPr>`
    + `<xdr:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:t>i IＬＵ</a:t></a:r></a:p></xdr:txBody></xdr:sp><xdr:clientData/></xdr:twoCellAnchor>`;
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">'
    + retangulo + FORMAS.map(ancora).join('') + '</xdr:wsDr>';
}
function letra(c) { let s = ''; for (; c > 0; c = Math.floor((c - 1) / 26)) s = String.fromCharCode(65 + (c - 1) % 26) + s; return s; }

if (require.main === module) gerar().catch(e => { console.error(e); process.exit(1); });
module.exports = { gerar, SAIDA, PESSOAS, OPS, GRAFIA_VARIANTE: 'PEDRO EXEMPLO ALVSE' };
