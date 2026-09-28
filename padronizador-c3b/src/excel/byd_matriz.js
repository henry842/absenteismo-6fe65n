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
// Cor do bloco: só metadado técnico (fill_state/fill_rgb). "L verde" e "L amarelo" são apenas L: a cor não entra
//   em nível, KPI, cobertura, risco ou decisão.
// Pessoas: a mesma pessoa com grafias diferentes só é unida por alias PESSOA confirmado (deduplicação assistida).
// Resíduo conhecido deste perfil ("c" nas células de habilidade): vai para o log técnico, sem pendência nem nível.
// Datas não definem designação. Nada é corrigido em silêncio: combinações incomuns viram pendências.
(typeof module === 'object' ? require('../modulo') : C3BModulo)('excel/byd_matriz',
  ['core/util', 'core/ids', 'core/parsers', 'core/aliases', 'core/pessoas', 'excel/byd_drawings'], (U, ID, P, AL, PS, BD) => {
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

  // ---------- configuração do perfil ----------
  // residuosConhecidos: valores que aparecem nas células de habilidade e são sabidamente lixo de automação antiga
  // DESTE perfil (confirmado pelo usuário: "c"). Não é regra global: só vale dentro dos blocos da Matriz BYD.
  const CONFIG = { residuosConhecidos: ['c'], limiteSimilaridadePessoas: PS.LIMITE };

  // ---------- extração completa ----------
  // bytes: .xlsx original. pessoas: Cadastro (01) opcional (matrícula pelo nome). aliasesUsuario: inclui PESSOA
  // (grafias confirmadas como a mesma pessoa). decisoes: decisões anteriores (PESSOAS_DIFERENTES não volta a perguntar).
  async function extrairMatrizBYD(bytes, { ExcelJS: lib = null, JSZip = null, pessoas = [], aliasesUsuario = [], modelosExtras = [], decisoes = [],
    arquivo = 'matriz.xlsx', abas: soAbas = null, esperado = null, residuosConhecidos = CONFIG.residuosConhecidos } = {}) {
    const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    const wb = new (obterExcelJS(lib)).Workbook();
    await wb.xlsx.load(u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength));
    const desenhos = await BD.lerFormas(u8, { JSZip });
    const motor = AL.criarMotor({ aliasesUsuario, modelosExtras });
    const registroOps = ID.registroOperacoes({ aliasesOperacao: aliasesUsuario.filter(a => a.entity_type === 'OPERACAO') });
    const residuos = new Set(residuosConhecidos.map(String));
    const pendencias = [], origem = [], registros = [], abasOut = [], operacoesOut = [];
    const pend = (severidade, codigo, mensagem, extra = {}) => pendencias.push({ categoria: PS.categoriaDe(codigo, { severidade }), severidade, codigo, mensagem, ...extra });
    const pessoaPorNome = new Map();
    for (const p of pessoas) { const k = U.dobrar(p.nome); pessoaPorNome.set(k, pessoaPorNome.has(k) ? null : p); }

    // 1ª passada: layout de cada aba de modelo
    const folhas = [];
    for (const ws of wb.worksheets) {
      if (soAbas && !soAbas.includes(ws.name)) continue;
      const C = leitorCelulas(ws);
      if (RE_EXEMPLO.test(U.dobrar(ws.name))) { if (lerLayout(ws, C)) pend('INFO', 'ABA_EXEMPLO_IGNORADA', `Aba "${ws.name}" é exemplo/modelo de preenchimento: não entra na base.`, { sheet: ws.name }); continue; }
      const lay = lerLayout(ws, C);
      if (lay && lay.operadores.length && lay.operacoes.length) folhas.push({ ws, C, lay, sheet: ws.name });
    }

    // Pessoas: grafia da Matriz → nome canônico (alias PESSOA confirmado) → employee_id único em todas as abas
    const pessoasPorId = new Map();
    for (const { lay, sheet } of folhas) for (const o of lay.operadores) {
      const canonico = motor.nomeCanonico(o.nome) || o.nome;
      const k = U.dobrar(canonico);
      const achada = pessoaPorNome.get(k) || pessoaPorNome.get(U.dobrar(o.nome));
      o.nome_na_matriz = o.nome; o.nome = canonico;
      o.employee_id = achada ? achada.employee_id : `EMP-SEMMATR-${U.hashCurto(k, 8)}`;
      o.employee_id_status = achada ? 'RESOLVIDO_POR_NOME' : 'SEM_MATRICULA';
      o.matricula = achada ? achada.matricula : null;
      if (!pessoasPorId.has(o.employee_id)) pessoasPorId.set(o.employee_id, { employee_id: o.employee_id, employee_id_status: o.employee_id_status, matricula: o.matricula, nome: canonico, papel: null, nomes_na_matriz: [], abas: [] });
      const p = pessoasPorId.get(o.employee_id);
      if (!p.nomes_na_matriz.includes(o.nome_na_matriz)) p.nomes_na_matriz.push(o.nome_na_matriz);
      if (!p.abas.includes(sheet)) p.abas.push(sheet);
      p.papel = p.papel || o.papel;
      origem.push({ purpose: 'OPERATOR_NAME', sheet, cell: ref(lay.linhaNomes, o.startCol), employee_id: o.employee_id, raw_value: o.nome_na_matriz });
    }
    for (const p of pessoasPorId.values()) {
      if (p.nomes_na_matriz.length > 1 || U.dobrar(p.nomes_na_matriz[0]) !== U.dobrar(p.nome))
        pend('INFO', 'PESSOAS_UNIFICADAS', `"${p.nomes_na_matriz.join('" e "')}" tratados como uma pessoa (${p.nome}) por alias confirmado.`, { employee_id: p.employee_id });
      // Configuração pendente (não é erro de leitura): o que a Matriz não informa sobre a pessoa
      const faltam = [!p.matricula && 'matrícula', !p.papel && 'função', 'turno'].filter(Boolean);
      p.configuracao_pendente = faltam.join(', ');
      pend('WARNING', 'CONFIGURACAO_PESSOA', `${p.nome}: falta ${p.configuracao_pendente}${!p.matricula ? ` (ID provisório ${p.employee_id}, derivado do nome)` : ''}. A Matriz não traz esses dados; complete no Cadastro (01).`, { employee_id: p.employee_id });
    }
    // Possível mesma pessoa: SÓ sugestão; une apenas com alias confirmado
    const pessoasParecidas = PS.encontrarPessoasParecidas([...pessoasPorId.values()].map(p => ({ nome: p.nome, employee_id: p.employee_id, abas: p.abas })), { decisoes, limite: CONFIG.limiteSimilaridadePessoas })
      .map(par => ({ ...par, sugestao_canonico: par.a.abas.length >= par.b.abas.length ? par.a.nome : par.b.nome }));
    for (const par of pessoasParecidas)
      pend('WARNING', 'POSSIVEL_MESMA_PESSOA', `Possível mesma pessoa: "${par.a.nome}" (${par.a.abas.join(', ')}) e "${par.b.nome}" (${par.b.abas.join(', ')}) — ${par.similaridade}% parecidos. Confirme "mesma pessoa" ou "pessoas diferentes"; nada foi unido automaticamente.`, { par: par.par });

    for (const { ws, C, lay, sheet } of folhas) {
      // Modelo: nome da aba (a própria planilha declara em "BASE DE DADOS": Modelo 车型 = nome da aba)
      const mod = motor.normalizar('MODELO', sheet);
      const model_id = mod.status === 'OK' ? mod.normalizado : ID.limparId(sheet);
      if (mod.status !== 'OK') pend('WARNING', 'MODELO_DA_ABA', `Aba "${sheet}": modelo "${model_id}" ainda não está no Dicionário; usado o nome da aba. Cadastre o modelo em Dicionário › Modelos.`, { sheet });
      if (lay.operadores.some(o => !o.rotuloOk)) pend('WARNING', 'LAYOUT_ROTULO', `Aba "${sheet}": ${lay.operadores.filter(o => !o.rotuloOk).length} bloco(s) de pessoa sem os rótulos "Dia/Mês" e "Nível de habilidade" esperados.`, { sheet });
      if (lay.operadores.some(o => o.lMarkerFonte !== 'FORMULA')) pend('INFO', 'MARCADOR_POR_DESLOCAMENTO', `Aba "${sheet}": posição do marcador L deduzida pelo deslocamento (+2,+2) em ${lay.operadores.filter(o => o.lMarkerFonte !== 'FORMULA').length} bloco(s), sem confirmação pela fórmula de resumo.`, { sheet });
      const tema = desenhos.tema;
      // Operações
      const vistasNaAba = new Map();
      for (const op of lay.operacoes) {
        const it = interpretarOperacao(op.rotulo);
        Object.assign(op, it);
        const e = it.estacao;
        if (e.station_base) op.operation_id = registroOps.obter({ model_id, station_base: e.station_base, side: e.side, position: e.position, codigo_operacao: null, descricao_pt: it.descricao_pt, descricao_zh: it.descricao_zh }).operation_id;
        else {
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
      // Formas → bloco pessoa × operação (pela âncora; nunca pelo nome da forma). Chave pelo BLOCO (coluna), não pela pessoa:
      // a unificação de grafias acontece depois, na mescla dos blocos.
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
        const chave = `${op.startRow}|${o.startCol}|${f.tipo}`;
        const dup = formasPorBloco.has(chave);
        if (!dup) formasPorBloco.set(chave, base);
        origem.push({ ...base, purpose: f.tipo === 'ellipse' ? 'CURRENT_OPERATOR_MARKER' : 'TRAINING_MARKER', employee_id: o.employee_id, operation_id: op.operation_id, dedup: dup ? 'DUPLICATA_SOBREPOSTA' : null });
        if (dup) pend('INFO', 'FORMA_DUPLICADA', `Aba "${sheet}": ${f.prst} "${f.shape_name}" sobreposta a outra do mesmo tipo no bloco ${ref(op.startRow, o.startCol)}; contada uma vez.`, { sheet, employee_id: o.employee_id, operation_id: op.operation_id });
      }
      // Blocos (um por coluna de pessoa × operação), depois mesclados por employee_id × operation_id
      const blocos = [];
      for (const op of lay.operacoes) for (const o of lay.operadores) {
        const lCell = ref(op.lRow, o.lMarkerCol);
        const marcador = C.valor(op.lRow, o.lMarkerCol);
        const temL = marcador === 1 || String(marcador).trim() === '1';
        const extras = [];
        for (let r = op.startRow; r <= op.endRow; r++) for (let c = o.startCol + 1; c <= o.endCol; c++) {
          if (r === op.lRow && c === o.lMarkerCol) continue;
          const cell = ws.getCell(r, c);
          if (cell.isMerged && cell.master && cell.master.address !== cell.address) continue;
          const v = C.valor(r, c);
          if (v == null || String(v).trim() === '') continue;
          const txt = v instanceof Date ? v.toISOString().slice(0, 10) : String(v);
          if (residuos.has(txt.trim())) { origem.push({ purpose: 'KNOWN_RESIDUE_IGNORED', sheet, cell: ref(r, c), employee_id: o.employee_id, operation_id: op.operation_id, raw_value: txt }); continue; }
          extras.push({ cell: ref(r, c), valor: txt });
        }
        const valoresData = [];
        for (let r = op.startRow; r <= op.endRow; r++) { const cell = ws.getCell(r, o.startCol); if (cell.isMerged && cell.master && cell.master.address !== cell.address) continue; valoresData.push(C.valor(r, o.startCol)); }
        const datas = datasDoBloco(valoresData);
        const fill = estadoDoFill(C.fill(op.lRow, o.lMarkerCol), tema);
        const circ = formasPorBloco.get(`${op.startRow}|${o.startCol}|ellipse`), tri = formasPorBloco.get(`${op.startRow}|${o.startCol}|triangle`);
        blocos.push({ op, o, lCell, marcador, temL, extras, datas, fill, circ, tri, bloco: `${sheet}!${ref(op.startRow, o.startCol)}:${ref(op.endRow, o.endCol)}` });
        if (temL) origem.push({ purpose: 'L_MARKER', sheet, cell: lCell, employee_id: o.employee_id, operation_id: op.operation_id, raw_value: String(marcador), l_marker_source: o.lMarkerFonte });
        if (datas.dates_raw) origem.push({ purpose: 'DATE_CELL', sheet, cell: ref(op.startRow, o.startCol), employee_id: o.employee_id, operation_id: op.operation_id, raw_value: datas.dates_raw });
        if (fill.fill_state !== 'NONE') origem.push({ purpose: 'FILL_METADATA', sheet, cell: lCell, employee_id: o.employee_id, operation_id: op.operation_id, raw_value: fill.fill_rgb, fill_state: fill.fill_state, fill_source: fill.fill_source });
        for (const x of extras) origem.push({ purpose: 'UNRECOGNIZED_VALUE', sheet, cell: x.cell, employee_id: o.employee_id, operation_id: op.operation_id, raw_value: x.valor });
      }
      const grupos = new Map();
      for (const b of blocos) { const k = `${b.o.employee_id}|${b.op.operation_id}`; if (!grupos.has(k)) grupos.set(k, []); grupos.get(k).push(b); }
      for (const grupo of grupos.values()) {
        const b0 = grupo[0], o = b0.o, op = b0.op;
        if (grupo.length > 1) pend('WARNING', 'PESSOA_REPETIDA_NA_ABA', `Aba "${sheet}": ${o.nome} aparece em ${grupo.length} colunas (${grupo.map(b => b.bloco).join(', ')}) para a operação ${op.operation_id}. Blocos somados: L se houver marcador em algum; formas de todos.`, { sheet, employee_id: o.employee_id, operation_id: op.operation_id });
        const temL = grupo.some(b => b.temL), lb = grupo.find(b => b.temL) || b0;
        const circ = (grupo.find(b => b.circ) || {}).circ, tri = (grupo.find(b => b.tri) || {}).tri;
        const has_circle = !!circ, has_triangle = !!tri;
        const datasTodas = [...new Set(grupo.flatMap(b => b.datas.datas))].sort();
        const extras = grupo.flatMap(b => b.extras);
        const reg = {
          sheet, model_id, employee_id: o.employee_id, employee_id_status: o.employee_id_status, matricula: o.matricula, nome: o.nome, nome_na_matriz: [...new Set(grupo.map(b => b.o.nome_na_matriz))].join(' | '), papel: o.papel,
          operation_id: op.operation_id, operation_no: op.numero, station_code: op.station_code, descricao_zh: op.descricao_zh, descricao_pt: op.descricao_pt,
          // Nível: SÓ o marcador válido da Matriz. A cor nunca entra aqui.
          skill_level: temL ? 'L' : 'NAO_IDENTIFICADO', skill_level_source: temL ? `MARCADOR_1:${sheet}!${lb.lCell}` : null, l_marker_raw: lb.marcador == null ? null : String(lb.marcador),
          // Designação: SÓ as formas. Independente do nível.
          assignment_status: has_circle && has_triangle ? 'FUTURO_TITULAR' : has_circle ? 'TITULAR' : has_triangle ? 'EM_TREINAMENTO' : 'SEM_DESIGNACAO',
          has_circle, has_triangle, is_current_operator: has_circle, is_training_planned: has_triangle, is_future_holder: has_circle && has_triangle,
          dates_raw: grupo.map(b => b.datas.dates_raw).filter(Boolean).join(' | ') || null, first_date: datasTodas[0] || null, latest_date: datasTodas[datasTodas.length - 1] || null,
          source_block: grupo.map(b => b.bloco).join(' + '), source_l_cell: `${sheet}!${lb.lCell}`,
          source_circle_anchor: circ ? `${circ.drawing_file}#${circ.shape_name}@${circ.anchor_a1}` : null,
          source_triangle_anchor: tri ? `${tri.drawing_file}#${tri.shape_name}@${tri.anchor_a1}` : null,
          unrecognized_values: extras.length ? extras.map(x => `${x.cell}=${x.valor}`).join('; ') : null, review_flags: [],
          // Metadado técnico (oculto na Base Operacional): cor da célula. Não entra em nível, KPI, cobertura ou risco.
          fill_state: lb.fill.fill_state, fill_rgb: lb.fill.fill_rgb, fill_source: lb.fill.fill_source,
        };
        const bloco = reg.source_block, r0 = { sheet, employee_id: reg.employee_id, operation_id: reg.operation_id, cell: bloco };
        for (const b of grupo) if (b.marcador != null && !b.temL) { reg.review_flags.push('MARCADOR_DIFERENTE_DE_1'); pend('WARNING', 'MARCADOR_NAO_RECONHECIDO', `${b.bloco}: a célula do marcador L (${b.lCell}) tem "${b.marcador}", não 1. Nível não identificado.`, r0); }
        if (extras.length) { reg.review_flags.push('VALOR_NAO_RECONHECIDO'); pend('WARNING', 'VALOR_NAO_RECONHECIDO', `${bloco}: valor(es) sem regra definida no bloco (${reg.unrecognized_values}). Preservado(s), sem interpretação.`, r0); }
        const invalidas = grupo.flatMap(b => b.datas.invalidas);
        if (invalidas.length) { reg.review_flags.push('DATA_INVALIDA'); pend('WARNING', 'DATA_INVALIDA', `${bloco}: data não reconhecida "${invalidas.join(' | ')}".`, r0); }
        if (has_circle && has_triangle && temL) { reg.review_flags.push('CIRCULO_TRIANGULO_E_L'); pend('WARNING', 'CIRCULO_TRIANGULO_E_L', `${bloco}: ○ + △ + marcador L. Preservado como FUTURO_TITULAR com nível L; revisar.`, r0); }
        else if (has_circle && !has_triangle && !temL) { reg.review_flags.push('CIRCULO_SEM_L'); pend('WARNING', 'CIRCULO_SEM_L', `${bloco}: ○ (operador atual) sem marcador L. Nada foi corrigido; revisar.`, r0); }
        else if (has_triangle && !has_circle && temL) { reg.review_flags.push('TRIANGULO_COM_L'); pend('WARNING', 'TRIANGULO_COM_L', `${bloco}: △ (treinamento programado) em quem já tem marcador L. Nada foi corrigido; revisar.`, r0); }
        reg.review_flags = reg.review_flags.join(',') || null;
        registros.push(reg);
      }
      // Conferência: total de L por pessoa lido × resultado salvo da fórmula "Número L proficiente" da própria planilha
      if (lay.linhaResumo) for (const o of lay.operadores) {
        const esperadoL = C.valor(lay.linhaResumo, o.startCol);
        const lido = blocos.filter(b => b.o === o && b.temL).length;
        if (typeof esperadoL === 'number' && esperadoL !== lido) pend('WARNING', 'TOTAL_L_DIFERENTE', `Aba "${sheet}", ${o.nome}: ${lido} marcador(es) L lido(s), mas o resultado salvo da fórmula (${ref(lay.linhaResumo, o.startCol)}) é ${esperadoL}. Se a fórmula referencia as mesmas células, o valor salvo está desatualizado (planilha salva sem recalcular); os marcadores lidos são os que valem.`, { sheet, employee_id: o.employee_id });
        o.totalLFormula = typeof esperadoL === 'number' ? esperadoL : null;
      }
      abasOut.push({ sheet, model_id, drawing_file: infoDesenho.drawing_file, sheet_file: infoDesenho.sheet_file, blocos: blocos.length,
        layout: { linhaNomes: lay.linhaNomes, linhaRotulos: lay.linhaRotulos, linhaResumo: lay.linhaResumo, largura: lay.largura, altura: lay.altura,
          operadores: lay.operadores.map(o => ({ nome: o.nome, nome_na_matriz: o.nome_na_matriz, employee_id: o.employee_id, startCol: o.startCol, endCol: o.endCol, lMarkerCol: o.lMarkerCol, lMarkerFonte: o.lMarkerFonte, papel: o.papel, totalLFormula: o.totalLFormula ?? null })),
          operacoes: lay.operacoes.map(o => ({ numero: o.numero, operation_id: o.operation_id, startRow: o.startRow, endRow: o.endRow, lRow: o.lRow, lRowFonte: o.lRowFonte })) } });
    }
    const conta = (arr, f) => arr.filter(f).length;
    const resumo = abasOut.map(a => {
      const rs = registros.filter(r => r.sheet === a.sheet);
      return { sheet: a.sheet, model_id: a.model_id, pessoas: new Set(rs.map(r => r.employee_id)).size, operacoes: a.layout.operacoes.length, combinacoes: rs.length,
        nivel_L: conta(rs, r => r.skill_level === 'L'), titulares: conta(rs, r => r.assignment_status === 'TITULAR'), em_treinamento: conta(rs, r => r.assignment_status === 'EM_TREINAMENTO'),
        futuros_titulares: conta(rs, r => r.assignment_status === 'FUTURO_TITULAR'), com_data: conta(rs, r => r.dates_raw),
        problemas_de_dados: conta(pendencias, p => p.sheet === a.sheet && p.categoria === 'PROBLEMA_DE_DADOS') };
    });
    const pessoasOut = [...pessoasPorId.values()].map(p => ({ ...p, nomes_na_matriz: p.nomes_na_matriz.join(' | '), abas: p.abas.join(',') }));
    const habilidadesAtuais = registros.filter(ehAtual);
    const saida = { perfil: PERFIL, arquivo, gerado_em: U.agoraISO(), config: { residuosConhecidos: [...residuos] }, abas: abasOut, pessoas: pessoasOut, operacoes: operacoesOut,
      registros, habilidadesAtuais, treinamentos: registros.filter(r => r.is_training_planned), origem, pendencias, pessoasParecidas, resumo };
    saida.validacaoFinal = validacaoFinal(saida, esperado, residuos);
    return saida;
  }
  // Habilidade "atual" = bloco com informação de negócio: nível, forma, data ou valor a revisar. A cor não conta.
  const ehAtual = r => r.skill_level === 'L' || r.has_circle || r.has_triangle || !!r.dates_raw || !!r.unrecognized_values;

  // Validação final da importação (sanity check). esperado: { modelos, operacoes, pessoas } opcional (arquivo de referência).
  function validacaoFinal(r, esperado, residuos) {
    const itens = [];
    const add = (item, obtido, ok, detalhe = '') => itens.push({ item, obtido, esperado: null, ok: !!ok, detalhe });
    const comEsperado = (item, obtido, chave) => itens.push({ item, obtido, esperado: esperado && esperado[chave] != null ? esperado[chave] : null, ok: !esperado || esperado[chave] == null || esperado[chave] === obtido, detalhe: '' });
    comEsperado('Modelos', new Set(r.abas.map(a => a.model_id)).size, 'modelos');
    comEsperado('Operações', r.operacoes.length, 'operacoes');
    comEsperado('Pessoas únicas', r.pessoas.length, 'pessoas');
    const residuoComoHabilidade = r.registros.filter(x => x.skill_level === 'L' && residuos.has(String(x.l_marker_raw))).length
      + r.registros.filter(x => (x.unrecognized_values || '').split('; ').some(v => residuos.has(v.split('=').slice(1).join('=')))).length;
    add('Nenhum resíduo conhecido ("' + [...residuos].join('", "') + '") como habilidade ou pendência', residuoComoHabilidade, residuoComoHabilidade === 0, `${r.origem.filter(o => o.purpose === 'KNOWN_RESIDUE_IGNORED').length} ocorrência(s) no log técnico`);
    const nivelSemMarcador = r.registros.filter(x => (x.skill_level === 'L') !== (x.l_marker_raw === '1')).length;
    add('Nenhum nível derivado de cor (L somente com marcador 1)', nivelSemMarcador, nivelSemMarcador === 0,
      `${r.registros.filter(x => x.skill_level === 'L' && x.fill_state !== 'GREEN').length} L sem fundo verde; ${r.registros.filter(x => x.skill_level !== 'L' && x.fill_state === 'GREEN').length} fundo verde sem L`);
    const blocosComForma = tipo => new Set(r.origem.filter(o => o.purpose === tipo && !o.dedup).map(o => `${o.sheet}|${o.employee_id}|${o.operation_id}`)).size;
    const circ = blocosComForma('CURRENT_OPERATOR_MARKER'), tri = blocosComForma('TRAINING_MARKER');
    const ok = circ === r.registros.filter(x => x.has_circle).length && tri === r.registros.filter(x => x.has_triangle).length;
    add('○ e △ preservados (formas da grade = designações)', `${circ} ○ · ${tri} △`, ok, `${r.registros.filter(x => x.has_circle).length} com ○ · ${r.registros.filter(x => x.has_triangle).length} com △`);
    const celulasL = new Set(r.origem.filter(o => o.purpose === 'L_MARKER').map(o => `${o.sheet}!${o.cell}`));
    const semOrigem = r.habilidadesAtuais.filter(x => !x.source_block || (x.skill_level === 'L' && !celulasL.has(x.source_l_cell)) || (x.has_circle && !x.source_circle_anchor) || (x.has_triangle && !x.source_triangle_anchor)).length;
    add('Todas as habilidades com origem rastreável na Matriz', semOrigem, semOrigem === 0, `${r.habilidadesAtuais.length} habilidade(s) atuais verificadas`);
    add('Nenhuma "possível mesma pessoa" pendente', r.pessoasParecidas.length, r.pessoasParecidas.length === 0, r.pessoasParecidas.map(p => `${p.a.nome} ⇄ ${p.b.nome}`).join('; '));
    return itens;
  }

  return { PERFIL, CONFIG, ehMatrizBYD, extrairMatrizBYD, interpretarOperacao, estadoDoFill, datasDoBloco, ehAtual, validacaoFinal, RGB_VERDE, RGB_AMARELO };
}, typeof module === 'object' ? module : null);
