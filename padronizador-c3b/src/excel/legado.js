// Formatos legados que não são "uma tabela por aba". Cada detector reconhece o padrão pelo conteúdo
// (nunca por coordenadas fixas) e gera uma aba virtual já em formato de tabela, que segue o fluxo normal
// (mapeamento → normalização → validação). O arquivo de origem nunca é alterado.
//  • Histórico com uma aba por colaborador (+ abas Modelo/Exemplo ignoradas com motivo)
//  • Planejamento em matriz: operações nas linhas, pessoas nas colunas
(typeof module === 'object' ? require('../modulo') : C3BModulo)('excel/legado', ['core/util', 'core/dicionario', 'core/parsers', 'core/mapeamento', 'core/aliases'], (U, D, P, M, A) => {
  'use strict';

  const TEMPLATE = /^(modelo|exemplo|template|instrucao|instrucoes|como preencher|padrao|base|em branco|示例|模板)(\s|\d|$)/;
  const ROTULOS = {
    nome: ['nome', 'colaborador', 'funcionario', 'operador', '姓名'],
    matricula: ['matricula', 'matr', 'registro', 're', 'id', '工号'],
    equipe: ['equipe', 'time', '班组'],
    funcao: ['funcao', 'cargo', '职务'],
  };

  // Procura pares "Rótulo: valor" nas primeiras linhas (o valor pode estar na mesma célula ou à direita)
  function camposDoTopo(aba, ateLinha) {
    const achados = {};
    for (let r = 0; r < Math.min(ateLinha, aba.valores.length); r++) {
      const l = aba.valores[r];
      for (let c = 0; c < l.length; c++) {
        const v = l[c];
        if (typeof v !== 'string') continue;
        const m = v.match(/^\s*([^:：]{2,30})[:：]\s*(.*)$/);
        const rotulo = U.dobrar(m ? m[1] : v);
        for (const [campo, rots] of Object.entries(ROTULOS)) {
          if (achados[campo] || !rots.some(x => rotulo === x || rotulo.startsWith(x + ' '))) continue;
          let valor = m && m[2].trim() ? m[2].trim() : null;
          if (!valor) for (let k = c + 1; k < l.length; k++) if (l[k] != null && l[k] !== '' && String(l[k]).trim() !== v.trim()) { valor = l[k]; break; }
          if (valor != null) achados[campo] = { valor: String(valor).trim(), textoFmt: aba.textos && aba.textos.get(`${r},${l.indexOf(valor)}`), linha: r + 1 };
        }
      }
    }
    return achados;
  }

  // ---------- histórico: uma aba por colaborador ----------
  function detectarHistoricoPorAba(analise) {
    const candidatas = [], ignoradas = [];
    for (const aba of analise.abas) {
      if (!aba.linhas) continue;
      const cab = M.detectarCabecalho(aba);
      if (cab.linha < 1) continue;
      const colunas = M.colunasDaAba(aba, cab, { amostra: 20 });
      const mapa = M.mapearColunas(colunas, 'HISTORY', { motor: motorBasico() });
      const temEvento = mapa.some(m => m.campo === 'event_date') && mapa.some(m => ['new_level', 'ref_descricao', 'ref_estacao'].includes(m.campo));
      if (!temEvento) continue;
      const topo = camposDoTopo(aba, cab.linha);
      const nomeAba = U.dobrar(aba.nome);
      const ehTemplate = TEMPLATE.test(nomeAba);
      const matriculaValida = topo.matricula && /\d/.test(topo.matricula.valor) && !/^x+$|^0+$|^\.+$|^_+$/i.test(topo.matricula.valor);
      const temDados = aba.valores.slice(cab.inicioDados).some(l => l.filter(v => v != null && v !== '').length >= 2);
      if (ehTemplate && (!matriculaValida || !temDados)) { ignoradas.push({ nome: aba.nome, motivo: `modelo/exemplo: nome "${aba.nome}" e ${!matriculaValida ? 'sem matrícula válida' : 'sem registros'}` }); continue; }
      if (ehTemplate) { candidatas.push({ aba, cab, mapa, topo, aviso: `A aba "${aba.nome}" parece modelo, mas tem matrícula e registros: foi incluída. Confira.` }); continue; }
      candidatas.push({ aba, cab, mapa, topo });
    }
    // O padrão exige pelo menos 2 abas de colaborador com a mesma estrutura
    const comPessoa = candidatas.filter(c => c.topo.matricula || c.topo.nome);
    if (comPessoa.length < 2) return null;
    const colunasSaida = ['Matrícula', 'Nome', 'Equipe', ...new Set(comPessoa.flatMap(c => c.cab.cabecalhos.filter(Boolean)))];
    const grade = [colunasSaida];
    const textos = new Map();
    const origem = [];
    for (const c of comPessoa) {
      const idx = Object.fromEntries(c.cab.cabecalhos.map((h, i) => [h, i]));
      for (let r = c.cab.inicioDados; r < c.aba.valores.length; r++) {
        const l = c.aba.valores[r];
        if (l.filter(v => v != null && v !== '').length < 2) continue;
        const linha = [c.topo.matricula ? c.topo.matricula.valor : null, c.topo.nome ? c.topo.nome.valor : c.aba.nome, c.topo.equipe ? c.topo.equipe.valor : null];
        for (const h of colunasSaida.slice(3)) linha.push(idx[h] != null ? l[idx[h]] : null);
        if (c.topo.matricula && c.topo.matricula.textoFmt) textos.set(`${grade.length},0`, c.topo.matricula.textoFmt);
        grade.push(linha);
        origem.push(`${c.aba.nome}!L${r + 1}`);
      }
    }
    return {
      tipo: 'HISTORICO_POR_ABA', schema: 'HISTORY', consumidas: comPessoa.map(c => c.aba.nome), ignoradas,
      avisos: comPessoa.filter(c => c.aviso).map(c => c.aviso),
      aba: abaVirtual(`[Histórico: ${comPessoa.length} colaboradores]`, grade, textos, origem),
      layout: { tipo: 'HISTORICO_POR_ABA', cabecalhoEventos: comPessoa[0].cab.cabecalhos.filter(Boolean), rotulosTopo: Object.keys(comPessoa[0].topo) },
    };
  }

  // ---------- planejamento em matriz: operações × pessoas ----------
  function detectarPlanejamentoMatriz(aba) {
    if (!aba.linhas || aba.linhas < 3 || aba.colunas < 4) return null;
    const g = aba.valores;
    const pareceNome = v => typeof v === 'string' && /[a-zà-ú一-鿿]{2,}/i.test(v) && !/[:：]/.test(v) && v.length <= 40 && !P.estacaoEmTexto(v) && !M.ehTermo(v);
    const pareceMatricula = v => v != null && /^\d{3,10}$/.test(String(v).trim());
    const pareceCelula = v => v == null || v === '' || v instanceof Date || typeof v === 'number' || /^[iILU]$/.test(String(v).trim()) || /^[iILU]\s*[-→>]+\s*[iILU]$/.test(String(v).trim()) || U.parseData(v).status !== 'INVALIDO' || /^(ok|x|✓|concluido|planejado|em treinamento)$/i.test(U.dobrar(v));
    // linha de pessoas: sequência de ≥3 nomes (ou matrículas) seguidos
    let melhor = null;
    for (let r = 0; r < Math.min(20, g.length); r++) {
      for (let c0 = 0; c0 < g[r].length; c0++) {
        let c = c0; while (c < g[r].length && (pareceNome(g[r][c]) || pareceMatricula(g[r][c]))) c++;
        const n = c - c0;
        if (n >= 3 && (!melhor || n > melhor.n)) melhor = { r, c0, c1: c, n };
      }
    }
    if (!melhor) return null;
    // coluna de operações: à esquerda das pessoas, com estações em ≥50% das linhas abaixo
    let colEst = -1, colOp = -1, colZh = -1;
    const abaixo = g.slice(melhor.r + 1).filter(l => l.some(v => v != null));
    for (let c = 0; c < melhor.c0; c++) {
      const vals = abaixo.map(l => l[c]).filter(v => v != null && v !== '');
      if (!vals.length) continue;
      const est = vals.filter(v => P.estacaoEmTexto(v)).length / vals.length;
      const zh = vals.filter(v => U.CJK.test(String(v))).length / vals.length;
      if (est >= 0.5 && colEst < 0) colEst = c;
      else if (zh >= 0.5 && colZh < 0) colZh = c;
      else if (vals.filter(v => typeof v === 'string' && v.length > 4).length / vals.length >= 0.5 && colOp < 0) colOp = c;
    }
    if (colEst < 0 && colOp < 0) return null;
    // matrícula logo abaixo/acima dos nomes (se houver)
    let linhaMatr = null;
    for (const r of [melhor.r + 1, melhor.r - 1]) if (g[r] && g[r].slice(melhor.c0, melhor.c1).filter(pareceMatricula).length >= melhor.n * 0.6) linhaMatr = r;
    // As células da grade (abaixo dos nomes e das matrículas) precisam parecer planejamento (níveis, datas, marcas)
    const celulas = g.slice(Math.max(melhor.r, linhaMatr ?? -1) + 1).flatMap(l => l.slice(melhor.c0, melhor.c1));
    const preenchidas = celulas.filter(v => v != null && v !== '');
    if (!preenchidas.length || preenchidas.filter(pareceCelula).length / preenchidas.length < 0.7) return null;
    const pessoas = [];
    for (let c = melhor.c0; c < melhor.c1; c++) pessoas.push({ c, nome: pareceNome(g[melhor.r][c]) ? g[melhor.r][c] : null, matricula: linhaMatr != null ? g[linhaMatr][c] : pareceMatricula(g[melhor.r][c]) ? g[melhor.r][c] : null,
      textoFmt: linhaMatr != null && aba.textos ? aba.textos.get(`${linhaMatr},${c}`) : null });
    const grade = [['Matrícula', 'Nome', 'Estação', 'Operação', '工序', 'Nível atual', 'Nível alvo', 'Data planejada', 'Status', 'Valor original']];
    const textos = new Map(), origem = [];
    const inicio = Math.max(melhor.r, linhaMatr ?? -1) + 1;
    for (let r = inicio; r < g.length; r++) {
      const l = g[r];
      const est = colEst >= 0 ? l[colEst] : null, op = colOp >= 0 ? l[colOp] : null, zh = colZh >= 0 ? l[colZh] : null;
      if (est == null && op == null) continue;
      for (const p of pessoas) {
        const v = l[p.c];
        if (v == null || v === '') continue;
        const cel = interpretarCelula(v);
        if (p.textoFmt) textos.set(`${grade.length},0`, p.textoFmt);
        grade.push([p.matricula, p.nome, est, op, zh, cel.atual, cel.alvo, cel.data, cel.status, v instanceof Date ? v.toISOString().slice(0, 10) : v]);
        origem.push(`${aba.nome}!${String.fromCharCode(65 + Math.min(25, p.c))}${r + 1}`);
      }
    }
    if (grade.length < 2) return null;
    return {
      tipo: 'PLANEJAMENTO_MATRIZ', schema: 'TRAINING', consumidas: [aba.nome], ignoradas: [], avisos: linhaMatr == null ? ['Não achei matrículas junto aos nomes: as pessoas precisarão ser identificadas pela matrícula no mapeamento.'] : [],
      aba: abaVirtual(`[Planejamento: ${aba.nome}]`, grade, textos, origem),
      layout: { tipo: 'PLANEJAMENTO_MATRIZ', linhaPessoas: melhor.r + 1, linhaMatriculas: linhaMatr != null ? linhaMatr + 1 : null, colunaEstacao: colEst + 1, colunaOperacao: colOp + 1, pessoas: pessoas.length },
    };
  }
  // "L" → alvo L; "I→L" → atual I, alvo L; data → data planejada; "Concluído" → status
  function interpretarCelula(v) {
    if (v instanceof Date || typeof v === 'number') { const d = U.parseData(v); return { data: d.valor, alvo: null, atual: null, status: null }; }
    const s = String(v).trim();
    let m = s.match(/^([iILU])\s*[-→>]+\s*([iILU])$/);
    if (m) return { atual: m[1], alvo: m[2], data: null, status: null };
    if (/^[iILU]$/.test(s)) return { alvo: s, atual: null, data: null, status: null };
    const d = U.parseData(s);
    if (d.status !== 'INVALIDO') return { data: d.valor, alvo: null, atual: null, status: null };
    return { status: s, alvo: null, atual: null, data: null };
  }

  function abaVirtual(nome, grade, textos, origem) {
    return { nome, indice: -1, visivel: true, virtual: true, linhas: grade.length, colunas: grade[0].length, dimensao: `${grade.length}×${grade[0].length} (gerada)`,
      valores: grade, textos, mescladas: [], celulasDeMescla: new Set(), formulas: 0, tabelas: [], celulasPreenchidas: 0, celulasVazias: 0, origemLinhas: origem };
  }
  let _motor = null;
  const motorBasico = () => _motor || (_motor = A.criarMotor());

  // Classifica abas que não viram base oficial (escala, revezamento): ficam de fora com o motivo
  function classificarAuxiliar(aba) {
    const n = U.dobrar(aba.nome);
    if (/escala|revezamento|rodizio|轮岗|排班/.test(n)) return 'Escala/revezamento: é gerado pelo C3B a partir das bases; não é importado como base oficial.';
    if (/grafico|dashboard|resumo|indicador|kpi/.test(n)) return 'Resumo/indicador: o C3B calcula a partir das bases.';
    return null;
  }

  return { detectarHistoricoPorAba, detectarPlanejamentoMatriz, interpretarCelula, camposDoTopo, classificarAuxiliar };
}, typeof module === 'object' ? module : null);
