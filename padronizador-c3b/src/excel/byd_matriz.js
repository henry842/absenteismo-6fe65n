// Perfil BYD_SKILL_MATRIX_V1: "Planejamento de Treinamento de Habilidades" (uma aba por modelo: EQE, HA2H, SA6H...).
// Layout real (confirmado no arquivo de referência):
//   linha "Nome do operador 作业员姓名": um bloco de 4 colunas por pessoa (1ª coluna = Dia/Mês, 3 colunas = nível)
//   coluna A/B a partir de "Nome de Posto 岗位名称": um bloco de 4 linhas por operação (nº, texto 中文 + "C14 FZ1 - descrição")
//   marcador numérico oculto 1 (fonte branca) em (início+2, início+2) = nível L. A fórmula da linha
//   "Número L proficiente" (=SUM(E11+E15+...)) lista exatamente essas células e é usada para confirmar o layout.
//   ○ e △ NÃO são valores de célula: são formas (ellipse / triangle) em xl/drawings/drawingN.xml, ancoradas no bloco.
// Duas dimensões INDEPENDENTES por pessoa × operação:
//   skill_level        L (marcador 1) | NAO_IDENTIFICADO — a interpretação oficial i/I/L/U não muda
//   assignment_status  ○ só = TITULAR · △ só = EM_TREINAMENTO · ○+△ = FUTURO_TITULAR · nenhuma = SEM_DESIGNACAO
// Cor do bloco: lida da célula (fill_state GREEN/YELLOW/OTHER/NONE + fill_rgb), sem significado atribuído.
// Datas não definem designação. Nada é corrigido em silêncio: combinações incomuns viram pendências.
(typeof module === 'object' ? require('../modulo') : C3BModulo)('excel/byd_matriz',
  ['core/util', 'core/ids', 'core/parsers', 'core/aliases', 'excel/byd_drawings'], (U, ID, P, AL, BD) => {
  'use strict';

  const PERFIL = 'BYD_SKILL_MATRIX_V1';
  const obterExcelJS = x => x || (typeof ExcelJS !== 'undefined' ? ExcelJS : require('exceljs'));
  const RGB_VERDE = 'FF92D050', RGB_AMARELO = 'FFFFFF00';
  const RE_NOMES = /nome do operador|作业员姓名/i, RE_POSTO = /nome de posto|岗位名称/i, RE_DIA = /dia|日/i, RE_NIVEL = /n[ií]vel de habilidade|技.{0,2}能/i;
  const RE_EXEMPLO = /^(exemplo|example|modelo|template|范例|示例)/;
  const RE_RESUMO = /n[uú]mero l proficiente|各作业员/i;
  const letra = c => { let s = ''; for (; c > 0; c = Math.floor((c - 1) / 26)) s = String.fromCharCode(65 + (c - 1) % 26) + s; return s; };
  const ref = (r, c) => `${letra(c)}${r}`;
  const colDeLetra = s => [...s.toUpperCase()].reduce((t, ch) => t * 26 + ch.charCodeAt(0) - 64, 0);

  // ---------- detecção rápida (sobre a análise do leitor: valores 0-based) ----------
  function ehMatrizBYD(aba) {
    if (!aba || !aba.valores) return null;
    for (let r = 0; r < Math.min(15, aba.valores.length); r++) {
      const linha = aba.valores[r] || [];
      const c = [0, 1].find(i => typeof linha[i] === 'string' && RE_NOMES.test(linha[i]));
      if (c == null) continue;
      for (let r2 = r + 1; r2 < Math.min(r + 5, aba.valores.length); r2++) {
        const l2 = aba.valores[r2] || [];
        if (l2.some(v => typeof v === 'string' && RE_NIVEL.test(v)) && l2.some(v => typeof v === 'string' && RE_DIA.test(v))) return { perfil: PERFIL, linhaNomes: r + 1, linhaRotulos: r2 + 1 };
      }
    }
    return null;
  }

  // ---------- leitura de células com ExcelJS (1-based) ----------
  function leitorCelulas(ws) {
    const bruto = (r, c) => { const cell = ws.getCell(r, c); return cell.isMerged && cell.master ? cell.master : cell; };
    const valor = (r, c) => {
      const v = bruto(r, c).value;
      if (v == null) return null;
      if (typeof v === 'object' && !(v instanceof Date)) {
        if ('result' in v || 'formula' in v || 'sharedFormula' in v) return v.result ?? null;
        if (v.richText) return v.richText.map(t => t.text).join('');
        if ('text' in v) return v.text;
        if ('error' in v) return null;
      }
      return typeof v === 'string' && !v.trim() ? null : v;
    };
    const formula = (r, c) => { const v = ws.getCell(r, c).value; return v && typeof v === 'object' ? v.formula || v.sharedFormula || null : null; };
    return { valor, formula, fill: (r, c) => ws.getCell(r, c).fill || null, celula: (r, c) => ws.getCell(r, c) };
  }

  function estadoDoFill(fill, tema) {
    if (!fill || fill.type !== 'pattern' || !fill.pattern || fill.pattern === 'none') return { fill_state: 'NONE', fill_rgb: null, fill_source: 'SEM_PREENCHIMENTO' };
    const fg = fill.fgColor || {};
    let rgb = null, fonte = 'RGB';
    if (fg.argb) rgb = fg.argb.toUpperCase().padStart(8, 'F');
    else if (fg.theme != null) { rgb = BD.corDoTema(tema, fg.theme, fg.tint || 0); fonte = `TEMA:${fg.theme}${fg.tint ? `/${fg.tint}` : ''}`; }
    else if (fg.indexed != null) { fonte = `INDEXADA:${fg.indexed}`; rgb = fg.indexed === 64 ? null : null; }
    if (!rgb) return { fill_state: fg.indexed === 64 ? 'NONE' : 'OTHER', fill_rgb: null, fill_source: fonte };
    const k = rgb.slice(-6);
    // Branco sólido é o "sem cor" desta planilha (o fundo padrão dela é a cor de tema 0 = branco)
    const estado = rgb === RGB_VERDE ? 'GREEN' : rgb === RGB_AMARELO ? 'YELLOW' : k === 'FFFFFF' ? 'NONE' : 'OTHER';
    return { fill_state: estado, fill_rgb: rgb, fill_source: fonte };
  }

  // Datas do bloco: "12/08/2026\n14/08/2026", Date, número serial
  function datasDoBloco(valores) {
    const brutos = [], datas = [], invalidas = [];
    for (const v of valores) {
      if (v == null || v === '') continue;
      if (v instanceof Date) { brutos.push(v.toISOString().slice(0, 10)); datas.push(v.toISOString().slice(0, 10)); continue; }
      const s = String(v).trim();
      if (!s) continue;
      brutos.push(s);
      const achados = s.match(/\d{4}-\d{1,2}-\d{1,2}|\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}/g) || (typeof v === 'number' ? [v] : []);
      if (!achados.length) { invalidas.push(s); continue; }
      for (const a of achados) { const d = U.parseData(a, { formatoColuna: 'DMY' }); if (d.valor) datas.push(d.valor); else invalidas.push(String(a)); }
    }
    const ord = [...new Set(datas)].sort();
    return { dates_raw: brutos.length ? brutos.join(' | ') : null, first_date: ord[0] || null, latest_date: ord[ord.length - 1] || null, datas: ord, invalidas };
  }

  // Rótulo da operação: linha(s) em chinês + "C14 FZ1 - descrição em português"
  function interpretarOperacao(texto) {
    const linhas = String(texto || '').split(/\r?\n/).map(s => s.replace(/\s+/g, ' ').trim()).filter(Boolean);
    let station_code = null, descricao_pt = null;
    const zh = [];
    for (const l of linhas) {
      const m = !station_code && l.match(/^(C\s*\d{1,3}\s*[A-Z]{0,2}\s*\d{0,2})\s*[-–—]\s*(.*)$/i);
      if (m) { station_code = m[1].replace(/\s+/g, ' ').trim().toUpperCase(); descricao_pt = m[2].trim() || null; } else zh.push(l);
    }
    const est = station_code ? P.parseEstacao(station_code) : (P.estacaoEmTexto(linhas.join(' ')) || { status: 'UNKNOWN' });
    return { station_code, descricao_pt, descricao_zh: zh.join(' ') || null, estacao: est };
  }

  // Layout de uma aba: operadores, operações, marcador L e fim da grade
  function lerLayout(ws, C) {
    const maxR = ws.rowCount, maxC = ws.columnCount;
    let linhaNomes = null, linhaRotulos = null;
    for (let r = 1; r <= Math.min(15, maxR) && !linhaNomes; r++) for (const c of [1, 2]) if (RE_NOMES.test(String(C.valor(r, c) || ''))) { linhaNomes = r; break; }
    if (!linhaNomes) return null;
    for (let r = linhaNomes + 1; r <= linhaNomes + 4; r++) if (RE_POSTO.test(String(C.valor(r, 1) || '')) || RE_NIVEL.test(String(C.valor(r, 4) || ''))) { linhaRotulos = r; break; }
    linhaRotulos = linhaRotulos || linhaNomes + 2;
    let linhaResumo = null;
    for (let r = linhaRotulos + 1; r <= maxR; r++) if (RE_RESUMO.test(String(C.valor(r, 1) || ''))) { linhaResumo = r; break; }
    const fimGrade = (linhaResumo || maxR + 1) - 1;
    // Operadores: nomes na linha de nomes, cada um no início de um bloco com "Dia/Mês" na linha de rótulos
    const operadores = [];
    for (let c = 3; c <= maxC; c++) {
      const cell = ws.getCell(linhaNomes, c);
      if (cell.isMerged && cell.master && cell.master.address !== cell.address) continue;
      const nome = C.valor(linhaNomes, c);
      if (typeof nome !== 'string' || !nome.trim() || /^=/.test(nome)) continue;
      operadores.push({ startCol: c, nome: nome.replace(/\s+/g, ' ').trim(), rotuloOk: RE_DIA.test(String(C.valor(linhaRotulos, c) || '')) && RE_NIVEL.test(String(C.valor(linhaRotulos, c + 1) || '')) });
    }
    const passos = operadores.slice(1).map((o, i) => o.startCol - operadores[i].startCol);
    const largura = moda(passos) || 4;
    // Operações: nº na coluna A e texto na coluna B, entre os rótulos e a linha "Número L proficiente"
    const operacoes = [];
    for (let r = linhaRotulos + 1; r <= fimGrade; r++) {
      const a = ws.getCell(r, 1);
      if (a.isMerged && a.master && a.master.address !== a.address) continue;
      const num = C.valor(r, 1), txt = C.valor(r, 2);
      if (num == null || txt == null || !/^\d+$/.test(String(num).trim())) continue;
      operacoes.push({ startRow: r, numero: +String(num).trim(), rotulo: String(txt) });
    }
    const alturas = operacoes.slice(1).map((o, i) => o.startRow - operacoes[i].startRow);
    const altura = moda(alturas) || 4;
    operacoes.forEach((o, i) => { o.endRow = Math.min(i + 1 < operacoes.length ? operacoes[i + 1].startRow - 1 : o.startRow + altura - 1, fimGrade); });
    // Marcador L: pela fórmula da linha de resumo (=SUM(E11+E15+...)); senão, deslocamento +2/+2
    for (const o of operadores) {
      const f = linhaResumo ? C.formula(linhaResumo, o.startCol) : null;
      const refs = f ? [...f.matchAll(/\$?([A-Z]{1,3})\$?(\d+)/g)].map(m => ({ col: colDeLetra(m[1]), row: +m[2] })) : [];
      const cols = [...new Set(refs.map(x => x.col))];
      o.lMarkerCol = cols.length === 1 ? cols[0] : o.startCol + 2;
      o.lMarkerFonte = cols.length === 1 ? 'FORMULA' : 'DESLOCAMENTO';
      o.lRowsFormula = new Set(refs.map(x => x.row));
      o.endCol = o.startCol + largura - 1;
    }
    for (const op of operacoes) {
      const daFormula = operadores.map(o => [...o.lRowsFormula].find(r => r >= op.startRow && r <= op.endRow)).find(Boolean);
      op.lRow = daFormula || op.startRow + 2;
      op.lRowFonte = daFormula ? 'FORMULA' : 'DESLOCAMENTO';
    }
    // Papel pelo cabeçalho acima dos nomes (ex.: "Técnico 技术员", "Lider de equipe 领班")
    const papeis = [];
    for (let r = 1; r < linhaNomes; r++) for (let c = 3; c <= maxC; c++) {
      const v = String(C.valor(r, c) || '');
      const papel = /t[ée]cnico|技术员/i.test(v) ? 'TECNICO' : /l[ií]der|领班/i.test(v) ? 'LIDER' : null;
      if (!papel) continue;
      const cell = ws.getCell(r, c); if (cell.isMerged && cell.master && cell.master.address !== cell.address) continue;
      const fim = operadores.find(o => o.startCol > c && papeis.every(p => p.col !== o.startCol)) ;
      papeis.push({ col: c, papel, ate: null });
    }
    papeis.sort((a, b) => a.col - b.col);
    papeis.forEach((p, i) => { p.ate = i + 1 < papeis.length ? papeis[i + 1].col - 1 : maxC; });
    const limiteResumo = (() => { for (let c = 3; c <= maxC; c++) if (/profici[eê]ncia de n[ií]vel l|熟练/i.test(String(C.valor(2, c) || ''))) return c; return maxC + 1; })();
    for (const o of operadores) { const p = papeis.find(x => o.startCol >= x.col && o.startCol <= x.ate && x.col < limiteResumo); o.papel = p ? p.papel : null; }
    return { linhaNomes, linhaRotulos, linhaResumo, fimGrade, largura, altura, operadores: operadores.filter(o => o.startCol < limiteResumo), operacoes };
  }
  const moda = arr => { const c = {}; let m = null; for (const x of arr) { c[x] = (c[x] || 0) + 1; if (m == null || c[x] > c[m]) m = x; } return m == null ? null : +m; };

  // ---------- extração completa ----------
  // bytes: .xlsx original. pessoas: Cadastro (01) opcional, para achar a matrícula pelo nome.
  async function extrairMatrizBYD(bytes, { ExcelJS: lib = null, JSZip = null, pessoas = [], aliasesUsuario = [], modelosExtras = [], arquivo = 'matriz.xlsx', abas: soAbas = null } = {}) {
    const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    const wb = new (obterExcelJS(lib)).Workbook();
    await wb.xlsx.load(u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength));
    const desenhos = await BD.lerFormas(u8, { JSZip });
    const motor = AL.criarMotor({ aliasesUsuario, modelosExtras });
    const registroOps = ID.registroOperacoes({ aliasesOperacao: aliasesUsuario.filter(a => a.entity_type === 'OPERACAO') });
    const pendencias = [], origem = [], registros = [], abasOut = [], operadoresPorId = new Map(), operacoesOut = [];
    const pend = (severidade, codigo, mensagem, extra = {}) => pendencias.push({ severidade, codigo, mensagem, ...extra });
    const pessoaPorNome = new Map();
    for (const p of pessoas) { const k = U.dobrar(p.nome); pessoaPorNome.set(k, pessoaPorNome.has(k) ? null : p); }

    for (const ws of wb.worksheets) {
      if (soAbas && !soAbas.includes(ws.name)) continue;
      if (RE_EXEMPLO.test(U.dobrar(ws.name))) { if (lerLayout(ws, leitorCelulas(ws))) pend('INFO', 'ABA_EXEMPLO_IGNORADA', `Aba "${ws.name}" é exemplo/modelo de preenchimento: não entra na base.`, { sheet: ws.name }); continue; }
      const C = leitorCelulas(ws);
      const lay = lerLayout(ws, C);
      if (!lay || !lay.operadores.length || !lay.operacoes.length) continue;
      const sheet = ws.name;
      // Modelo: nome da aba (a própria planilha declara em "BASE DE DADOS": Modelo 车型 = nome da aba)
      const mod = motor.normalizar('MODELO', sheet);
      const model_id = mod.status === 'OK' ? mod.normalizado : ID.limparId(sheet);
      if (mod.status !== 'OK') pend('INFO', 'MODELO_DA_ABA', `Aba "${sheet}": modelo "${model_id}" não está no Dicionário; usado o nome da aba como modelo.`, { sheet });
      if (lay.operadores.some(o => !o.rotuloOk)) pend('WARNING', 'LAYOUT_ROTULO', `Aba "${sheet}": ${lay.operadores.filter(o => !o.rotuloOk).length} bloco(s) de pessoa sem os rótulos "Dia/Mês" e "Nível de habilidade" esperados.`, { sheet });
      if (lay.operadores.some(o => o.lMarkerFonte !== 'FORMULA')) pend('INFO', 'MARCADOR_POR_DESLOCAMENTO', `Aba "${sheet}": posição do marcador L deduzida pelo deslocamento (+2,+2) em ${lay.operadores.filter(o => o.lMarkerFonte !== 'FORMULA').length} bloco(s), sem confirmação pela fórmula de resumo.`, { sheet });
      const tema = desenhos.tema;
      // Pessoas
      for (const o of lay.operadores) {
        const k = U.dobrar(o.nome);
        const achada = pessoaPorNome.get(k);
        o.employee_id = achada ? achada.employee_id : `EMP-SEMMATR-${U.hashCurto(k, 8)}`;
        o.employee_id_status = achada ? 'RESOLVIDO_POR_NOME' : 'SEM_MATRICULA';
        o.matricula = achada ? achada.matricula : null;
        if (!operadoresPorId.has(o.employee_id)) {
          operadoresPorId.set(o.employee_id, { employee_id: o.employee_id, employee_id_status: o.employee_id_status, matricula: o.matricula, nome: o.nome, papel: o.papel, abas: [] });
          if (!achada) pend('WARNING', 'MATRICULA_AUSENTE', `"${o.nome}" não tem matrícula na Matriz. ID provisório ${o.employee_id} (derivado do nome); ligue ao Cadastro (01) para usar a matrícula.`, { sheet, employee_id: o.employee_id, cell: ref(lay.linhaNomes, o.startCol) });
        }
        operadoresPorId.get(o.employee_id).abas.push(sheet);
        origem.push({ purpose: 'OPERATOR_NAME', sheet, cell: ref(lay.linhaNomes, o.startCol), employee_id: o.employee_id, raw_value: o.nome });
      }
      // Operações
      const vistasNaAba = new Map();
      for (const op of lay.operacoes) {
        const it = interpretarOperacao(op.rotulo);
        Object.assign(op, it);
        const e = it.estacao;
        if (e.station_base) {
          const r = registroOps.obter({ model_id, station_base: e.station_base, side: e.side, position: e.position, codigo_operacao: null, descricao_pt: it.descricao_pt, descricao_zh: it.descricao_zh });
          op.operation_id = r.operation_id;
        } else {
          op.operation_id = `${model_id}-SEMESTACAO-${U.hashCurto(U.dobrar(op.rotulo), 6)}`;
          pend('WARNING', 'ESTACAO_NAO_IDENTIFICADA', `Aba "${sheet}", operação nº ${op.numero}: estação não encontrada no texto "${op.rotulo.replace(/\s+/g, ' ').slice(0, 80)}".`, { sheet, cell: ref(op.startRow, 2) });
        }
        if (vistasNaAba.has(op.operation_id)) {
          pend('WARNING', 'OPERACAO_REPETIDA', `Aba "${sheet}": operações nº ${vistasNaAba.get(op.operation_id)} e nº ${op.numero} têm a mesma estação e descrição (${op.operation_id}). Mantidas separadas pelo nº.`, { sheet, operation_id: op.operation_id });
          op.operation_id = `${op.operation_id}-N${op.numero}`;
        }
        vistasNaAba.set(op.operation_id, op.numero);
        operacoesOut.push({ sheet, model_id, operation_id: op.operation_id, operation_no: op.numero, station_code: op.station_code, station_base: e.station_base || null, side: e.side || null, position: e.position || null,
          descricao_zh: op.descricao_zh, descricao_pt: op.descricao_pt, source_cell: ref(op.startRow, 2), block_rows: `${op.startRow}-${op.endRow}`, l_row: op.lRow });
        origem.push({ purpose: 'OPERATION_LABEL', sheet, cell: ref(op.startRow, 2), operation_id: op.operation_id, raw_value: op.rotulo });
      }
      // Formas → bloco pessoa × operação (pela âncora; nunca pelo nome da forma)
      const infoDesenho = desenhos.abas[sheet] || { formas: [], drawing_file: null };
      const formasPorBloco = new Map();
      for (const f of infoDesenho.formas) {
        const centro = BD.celulaCentral(f);
        if (!centro) continue;
        const row = centro.row + 1, col = centro.col + 1;
        const op = lay.operacoes.find(x => row >= x.startRow && row <= x.endRow);
        const o = lay.operadores.find(x => col >= x.startCol && col <= x.endCol);
        const base = { sheet, drawing_file: f.drawing_file, shape_id: f.shape_id, shape_name: f.shape_name, shape_type: f.prst,
          anchor_from_row: f.from ? f.from.row : null, anchor_from_col: f.from ? f.from.col : null, anchor_to_row: f.to ? f.to.row : null, anchor_to_col: f.to ? f.to.col : null,
          anchor_a1: f.from ? `${ref(f.from.row + 1, f.from.col + 1)}${f.to ? ':' + ref(f.to.row + 1, f.to.col + 1) : ''}` : null };
        if (f.tipo === 'outro') { if (op && o) origem.push({ ...base, purpose: 'UNRECOGNIZED_SHAPE', employee_id: o.employee_id, operation_id: op.operation_id, raw_value: f.texto }); continue; }
        if (!op || !o) {
          const legenda = lay.linhaResumo && row >= lay.linhaResumo;
          origem.push({ ...base, purpose: legenda ? 'LEGEND_SHAPE_IGNORED' : 'SHAPE_OUTSIDE_GRID', raw_value: f.texto });
          if (!legenda) pend('WARNING', 'FORMA_FORA_DA_GRADE', `Aba "${sheet}": ${f.prst} "${f.shape_name}" em ${base.anchor_a1} não cai em nenhum bloco pessoa × operação. Ignorada.`, { sheet, shape_name: f.shape_name });
          continue;
        }
        if (f.hidden) { origem.push({ ...base, purpose: 'HIDDEN_SHAPE_IGNORED', employee_id: o.employee_id, operation_id: op.operation_id }); pend('WARNING', 'FORMA_OCULTA', `Aba "${sheet}": ${f.prst} oculta "${f.shape_name}" em ${base.anchor_a1} não foi contada.`, { sheet }); continue; }
        const chave = `${sheet}|${op.operation_id}|${o.employee_id}|${f.tipo}`;
        const dup = formasPorBloco.has(chave);
        if (!dup) formasPorBloco.set(chave, base);
        origem.push({ ...base, purpose: f.tipo === 'ellipse' ? 'CURRENT_OPERATOR_MARKER' : 'TRAINING_MARKER', employee_id: o.employee_id, operation_id: op.operation_id, dedup: dup ? 'DUPLICATA_SOBREPOSTA' : null });
        if (dup) pend('INFO', 'FORMA_DUPLICADA', `Aba "${sheet}": ${f.prst} "${f.shape_name}" sobreposta a outra do mesmo tipo no bloco ${ref(op.startRow, o.startCol)}; contada uma vez.`, { sheet, employee_id: o.employee_id, operation_id: op.operation_id });
      }
      // Blocos
      let nBlocos = 0;
      for (const op of lay.operacoes) for (const o of lay.operadores) {
        nBlocos++;
        const lCell = ref(op.lRow, o.lMarkerCol);
        const marcador = C.valor(op.lRow, o.lMarkerCol);
        const temL = marcador === 1 || String(marcador).trim() === '1';
        const extras = [];
        for (let r = op.startRow; r <= op.endRow; r++) for (let c = o.startCol + 1; c <= o.endCol; c++) {
          if (r === op.lRow && c === o.lMarkerCol) continue;
          const cell = ws.getCell(r, c);
          if (cell.isMerged && cell.master && cell.master.address !== cell.address) continue;
          const v = C.valor(r, c);
          if (v != null && String(v).trim() !== '') extras.push({ cell: ref(r, c), valor: v instanceof Date ? v.toISOString().slice(0, 10) : String(v) });
        }
        const valoresData = [];
        for (let r = op.startRow; r <= op.endRow; r++) { const cell = ws.getCell(r, o.startCol); if (cell.isMerged && cell.master && cell.master.address !== cell.address) continue; valoresData.push(C.valor(r, o.startCol)); }
        const datas = datasDoBloco(valoresData);
        const fill = estadoDoFill(C.fill(op.lRow, o.lMarkerCol), tema);
        const estadosArea = new Set();
        for (let r = op.startRow; r <= op.endRow; r++) for (let c = o.startCol + 1; c <= o.endCol; c++) estadosArea.add(estadoDoFill(C.fill(r, c), tema).fill_rgb || 'NONE');
        const circ = formasPorBloco.get(`${sheet}|${op.operation_id}|${o.employee_id}|ellipse`), tri = formasPorBloco.get(`${sheet}|${op.operation_id}|${o.employee_id}|triangle`);
        const has_circle = !!circ, has_triangle = !!tri;
        const assignment_status = has_circle && has_triangle ? 'FUTURO_TITULAR' : has_circle ? 'TITULAR' : has_triangle ? 'EM_TREINAMENTO' : 'SEM_DESIGNACAO';
        const skill_level = temL ? 'L' : 'NAO_IDENTIFICADO';
        const bloco = `${sheet}!${ref(op.startRow, o.startCol)}:${ref(op.endRow, o.endCol)}`;
        const reg = {
          sheet, model_id, employee_id: o.employee_id, employee_id_status: o.employee_id_status, matricula: o.matricula, nome: o.nome, papel: o.papel,
          operation_id: op.operation_id, operation_no: op.numero, station_code: op.station_code, descricao_zh: op.descricao_zh, descricao_pt: op.descricao_pt,
          skill_level, skill_level_source: temL ? `MARCADOR_1:${lCell}` : null, assignment_status, has_circle, has_triangle,
          is_current_operator: has_circle, is_training_planned: has_triangle, is_future_holder: has_circle && has_triangle,
          fill_state: fill.fill_state, fill_rgb: fill.fill_rgb, fill_source: fill.fill_source, fill_mixed: estadosArea.size > 1,
          dates_raw: datas.dates_raw, first_date: datas.first_date, latest_date: datas.latest_date,
          source_block: bloco, source_l_cell: `${sheet}!${lCell}`,
          source_circle_anchor: circ ? `${circ.drawing_file}#${circ.shape_name}@${circ.anchor_a1}` : null,
          source_triangle_anchor: tri ? `${tri.drawing_file}#${tri.shape_name}@${tri.anchor_a1}` : null,
          unrecognized_values: extras.length ? extras.map(x => `${x.cell}=${x.valor}`).join('; ') : null, review_flags: [],
        };
        if (marcador != null && !temL) { reg.review_flags.push('MARCADOR_DIFERENTE_DE_1'); pend('WARNING', 'MARCADOR_NAO_RECONHECIDO', `${bloco}: a célula do marcador L (${lCell}) tem "${marcador}", não 1. Nível não identificado.`, blocoRef(reg)); }
        if (extras.length) { reg.review_flags.push('VALOR_NAO_RECONHECIDO'); pend('WARNING', 'VALOR_NAO_RECONHECIDO', `${bloco}: valor(es) sem regra definida no bloco (${reg.unrecognized_values}). Preservado(s), sem interpretação.`, blocoRef(reg)); }
        if (datas.invalidas.length) { reg.review_flags.push('DATA_INVALIDA'); pend('WARNING', 'DATA_INVALIDA', `${bloco}: data não reconhecida "${datas.invalidas.join(' | ')}".`, blocoRef(reg)); }
        if (has_circle && has_triangle && temL) { reg.review_flags.push('CIRCULO_TRIANGULO_E_L'); pend('WARNING', 'CIRCULO_TRIANGULO_E_L', `${bloco}: ○ + △ + marcador L. Preservado como FUTURO_TITULAR com nível L; revisar.`, blocoRef(reg)); }
        else if (has_circle && !has_triangle && !temL) { reg.review_flags.push('CIRCULO_SEM_L'); pend('WARNING', 'CIRCULO_SEM_L', `${bloco}: ○ (operador atual) sem marcador L. Nada foi corrigido; revisar.`, blocoRef(reg)); }
        else if (has_triangle && !has_circle && temL) { reg.review_flags.push('TRIANGULO_COM_L'); pend('WARNING', 'TRIANGULO_COM_L', `${bloco}: △ (treinamento programado) em quem já tem marcador L. Nada foi corrigido; revisar.`, blocoRef(reg)); }
        if (temL) origem.push({ purpose: 'L_MARKER', sheet, cell: lCell, employee_id: o.employee_id, operation_id: op.operation_id, raw_value: String(marcador), l_marker_source: o.lMarkerFonte });
        if (datas.dates_raw) origem.push({ purpose: 'DATE_CELL', sheet, cell: ref(op.startRow, o.startCol), employee_id: o.employee_id, operation_id: op.operation_id, raw_value: datas.dates_raw });
        if (fill.fill_state !== 'NONE') origem.push({ purpose: 'FILL', sheet, cell: lCell, employee_id: o.employee_id, operation_id: op.operation_id, raw_value: fill.fill_rgb, fill_state: fill.fill_state, fill_source: fill.fill_source });
        for (const x of extras) origem.push({ purpose: 'UNRECOGNIZED_VALUE', sheet, cell: x.cell, employee_id: o.employee_id, operation_id: op.operation_id, raw_value: x.valor });
        reg.review_flags = reg.review_flags.join(',') || null;
        registros.push(reg);
      }
      // Conferência: total de L por pessoa lido × resultado da fórmula "Número L proficiente" da própria planilha
      if (lay.linhaResumo) for (const o of lay.operadores) {
        const esperado = C.valor(lay.linhaResumo, o.startCol);
        const lido = registros.filter(r => r.sheet === sheet && r.employee_id === o.employee_id && r.skill_level === 'L').length;
        if (typeof esperado === 'number' && esperado !== lido) pend('WARNING', 'TOTAL_L_DIFERENTE', `Aba "${sheet}", ${o.nome}: ${lido} marcador(es) L lido(s), mas o resultado salvo da fórmula (${ref(lay.linhaResumo, o.startCol)}) é ${esperado}. Se a fórmula referencia as mesmas células, o valor salvo está desatualizado (planilha salva sem recalcular); os marcadores lidos são os que valem.`, { sheet, employee_id: o.employee_id });
        o.totalLFormula = typeof esperado === 'number' ? esperado : null;
      }
      abasOut.push({ sheet, model_id, drawing_file: infoDesenho.drawing_file, sheet_file: infoDesenho.sheet_file, blocos: nBlocos,
        layout: { linhaNomes: lay.linhaNomes, linhaRotulos: lay.linhaRotulos, linhaResumo: lay.linhaResumo, largura: lay.largura, altura: lay.altura,
          operadores: lay.operadores.map(o => ({ nome: o.nome, employee_id: o.employee_id, startCol: o.startCol, endCol: o.endCol, lMarkerCol: o.lMarkerCol, lMarkerFonte: o.lMarkerFonte, papel: o.papel, totalLFormula: o.totalLFormula ?? null })),
          operacoes: lay.operacoes.map(o => ({ numero: o.numero, operation_id: o.operation_id, startRow: o.startRow, endRow: o.endRow, lRow: o.lRow, lRowFonte: o.lRowFonte })) } });
    }
    const conta = (arr, f) => arr.filter(f).length;
    const resumo = abasOut.map(a => {
      const rs = registros.filter(r => r.sheet === a.sheet);
      return { sheet: a.sheet, model_id: a.model_id, operadores: a.layout.operadores.length, operacoes: a.layout.operacoes.length, blocos: rs.length,
        nivel_L: conta(rs, r => r.skill_level === 'L'), titulares: conta(rs, r => r.assignment_status === 'TITULAR'), em_treinamento: conta(rs, r => r.assignment_status === 'EM_TREINAMENTO'),
        futuros_titulares: conta(rs, r => r.assignment_status === 'FUTURO_TITULAR'), fill_green: conta(rs, r => r.fill_state === 'GREEN'), fill_yellow: conta(rs, r => r.fill_state === 'YELLOW'),
        fill_other: conta(rs, r => r.fill_state === 'OTHER'), com_data: conta(rs, r => r.dates_raw), pendencias: conta(pendencias, p => p.sheet === a.sheet && p.severidade !== 'INFO') };
    });
    return { perfil: PERFIL, arquivo, gerado_em: U.agoraISO(), abas: abasOut, operadores: [...operadoresPorId.values()], operacoes: operacoesOut,
      registros, habilidadesAtuais: registros.filter(ehAtual), origem, pendencias, resumo };

    function blocoRef(reg) { return { sheet: reg.sheet, employee_id: reg.employee_id, operation_id: reg.operation_id, cell: reg.source_block }; }
  }
  // Habilidade "atual" = bloco com alguma informação real (nível, forma, data ou cor)
  const ehAtual = r => r.skill_level === 'L' || r.has_circle || r.has_triangle || !!r.dates_raw || r.fill_state !== 'NONE' || !!r.unrecognized_values;

  return { PERFIL, ehMatrizBYD, extrairMatrizBYD, interpretarOperacao, estadoDoFill, datasDoBloco, ehAtual, RGB_VERDE, RGB_AMARELO };
}, typeof module === 'object' ? module : null);
