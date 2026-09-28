// Sessão de importação: arquivo → abas → schema → mapeamento → normalização → validação → prévia → commit.
// Os dados ficam na sessão (rascunho) até o commit; nada entra no pacote oficial antes disso.
// Modos: 'ANALISE' (só diagnostica, nunca grava), 'SIMULACAO' (mostra o que mudaria, não grava), 'IMPORTACAO'.
(typeof module === 'object' ? require('../modulo') : C3BModulo)('features/importacao',
  ['core/util', 'core/dicionario', 'core/aliases', 'core/ids', 'core/mapeamento', 'core/perfis', 'core/normalizar', 'core/validar',
    'core/qualidade', 'core/duplicidades', 'core/conflitos', 'core/historico', 'core/auditoria', 'excel/leitor', 'excel/legado', 'excel/byd_matriz'],
  (U, D, AL, ID, M, PF, N, V, Q, DU, CF, H, AU, L, LG, BYD) => {
  'use strict';

  const ORDEM = ['PEOPLE', 'OPERATIONS', 'SKILLS', 'HISTORY', 'TRAINING', 'ATTENDANCE'];

  function motorDoPacote(pacote) {
    return AL.criarMotor({ aliasesUsuario: pacote.config.aliases, modelosExtras: pacote.config.modelosExtras, valoresExtras: pacote.config.valoresExtras });
  }

  // 1. Ler e analisar o arquivo
  async function iniciar({ bytes, nome, modificado = null, pacote, modo = 'IMPORTACAO', usuario = 'usuario', token = U.tokenCancelamento(), progresso = () => {}, ExcelJS = null, JSZip = null }) {
    const lote = AU.novoLote({ contadores: pacote.config.contadores, arquivo: null, executadoPor: usuario, modo });
    const t0 = Date.now();
    AU.transicao(lote, 'ANALYZING', nome);
    const sessao = { lote, modo, pacote, usuario, token, motor: motorDoPacote(pacote), abas: [], trabalhos: {}, decisoesDuplicidade: [] };
    try {
      const analise = await L.analisarArquivo(bytes, nome, { token, progresso, modificado, ExcelJS });
      lote.arquivo = { nome, tamanho: analise.arquivo.tamanho, hash: analise.arquivo.hash, formato: analise.arquivo.formato };
      sessao.analise = analise;
      const perfis = pacote.config.perfis || [];
      for (const aba of analise.abas) {
        token.verificar();
        // Matriz de habilidades BYD: layout próprio (blocos pessoa × operação + formas ○ △), lida pelo perfil BYD
        const byd = BYD.ehMatrizBYD(aba);
        if (byd) {
          sessao.abas.push({ nome: aba.nome, visivel: aba.visivel, linhas: aba.linhas, colunas: aba.colunas, dimensao: aba.dimensao, formulas: aba.formulas, mescladas: aba.mescladas.length,
            tabelas: aba.tabelas, cabecalho: { linha: byd.linhaNomes - 1, linhas: [byd.linhaNomes - 1], cabecalhos: [], inicioDados: byd.linhaRotulos, confianca: 1 }, deteccao: { ranking: [], perfil: null },
            schemaSugerido: null, schema: null, selecionada: false, auxiliar: true, byd,
            motivoIgnorada: `Matriz de habilidades BYD (${byd.perfil}): lida no painel "Matriz BYD" (nível, ○ titular, △ treinamento, cor).`, amostra: aba.valores.slice(0, 8), tipos: [] });
          continue;
        }
        const cab = M.detectarCabecalho(aba);
        const det = aba.linhas ? PF.detectarSchema(aba, cab, { motor: sessao.motor, perfis }) : { ranking: [], perfil: null };
        const melhor = det.ranking[0];
        const auxiliar = !aba.visivel || /^(modelo|exemplo|template|instru|legenda|listas?( de)? (valores|opcoes|suspensa)|config|parametro|menu|capa)/i.test(U.dobrar(aba.nome)) || aba.linhas < 2;
        sessao.abas.push({
          nome: aba.nome, visivel: aba.visivel, linhas: aba.linhas, colunas: aba.colunas, dimensao: aba.dimensao, formulas: aba.formulas,
          mescladas: aba.mescladas.length, tabelas: aba.tabelas, preenchidas: aba.celulasPreenchidas, vazias: aba.celulasVazias,
          cabecalho: cab, deteccao: det, schemaSugerido: melhor && melhor.nota >= 0.35 ? melhor.schema : null, auxiliar,
          selecionada: !auxiliar && !!(melhor && melhor.nota >= 0.35), schema: melhor && melhor.nota >= 0.35 ? melhor.schema : null,
          perfilCompativel: det.perfil && det.perfil.compatibilidade >= 0.7 ? det.perfil : null,
          amostra: aba.valores.slice(0, 8), tipos: tiposPorColuna(aba, cab),
        });
      }
      detectarLegados(sessao);
      if (sessao.abas.some(a => a.byd)) {
        progresso(96, 'Lendo formas ○ △ da Matriz BYD');
        const t1 = Date.now();
        sessao.byd = await BYD.extrairMatrizBYD(bytes, { ExcelJS, JSZip, pessoas: pacote.bases.PEOPLE, aliasesUsuario: pacote.config.aliases, modelosExtras: pacote.config.modelosExtras, arquivo: nome });
        sessao.byd.hash_origem = analise.arquivo.hash;
        lote.tempos.byd_ms = Date.now() - t1;
      }
      lote.tempos.analise_ms = Date.now() - t0;
      AU.transicao(lote, 'MAPPED', 'abas analisadas');
      return sessao;
    } catch (e) {
      AU.transicao(lote, e.name === 'Cancelado' ? 'CANCELLED' : 'FAILED', e.message);
      lote.erro = e.message; lote.comoResolver = e.comoResolver || null;
      sessao.erro = e;
      return sessao;
    }
  }
  // Formatos legados: gera abas virtuais em formato de tabela e tira as abas de origem da seleção
  function detectarLegados(sessao) {
    const analise = sessao.analise;
    const achados = [];
    const hist = LG.detectarHistoricoPorAba(analise);
    if (hist) achados.push(hist);
    for (const aba of analise.abas) { const pl = LG.detectarPlanejamentoMatriz(aba); if (pl) achados.push(pl); }
    for (const a of achados) {
      analise.abas.push(a.aba);
      const cab = M.detectarCabecalho(a.aba);
      sessao.abas.push({ nome: a.aba.nome, visivel: true, virtual: true, legado: { tipo: a.tipo, consumidas: a.consumidas, avisos: a.avisos, layout: a.layout },
        linhas: a.aba.linhas, colunas: a.aba.colunas, dimensao: a.aba.dimensao, formulas: 0, mescladas: 0, tabelas: [], cabecalho: cab,
        deteccao: { ranking: [{ schema: a.schema, nome: D.schema(a.schema).nome_pt, nota: 0.9, motivos: [`formato ${a.tipo}`] }], perfil: null },
        schemaSugerido: a.schema, schema: a.schema, selecionada: true, auxiliar: false, amostra: a.aba.valores.slice(0, 8), tipos: tiposPorColuna(a.aba, cab),
        sugestoesValorFixo: a.tipo === 'PLANEJAMENTO_MATRIZ' ? { status: 'PLANEJADO' } : null });
      for (const nome of a.consumidas) { const i = sessao.abas.find(x => x.nome === nome && !x.virtual); if (i) Object.assign(i, { selecionada: false, consumidaPor: a.aba.nome }); }
      for (const ig of a.ignoradas) { const i = sessao.abas.find(x => x.nome === ig.nome); if (i) Object.assign(i, { selecionada: false, auxiliar: true, motivoIgnorada: ig.motivo }); }
    }
    for (const i of sessao.abas) if (!i.virtual && !i.consumidaPor && !i.byd) {
      const motivo = LG.classificarAuxiliar({ nome: i.nome });
      if (motivo) Object.assign(i, { selecionada: false, auxiliar: true, motivoIgnorada: motivo });
    }
  }
  function tiposPorColuna(aba, cab) {
    const ini = cab.inicioDados ?? cab.linha + 1;
    return (cab.cabecalhos || []).map((h, c) => {
      const cont = {};
      for (let r = ini; r < Math.min(aba.valores.length, ini + 200); r++) { const t = L.tipoValor(aba.valores[r][c]); cont[t] = (cont[t] || 0) + 1; }
      const tipo = Object.entries(cont).filter(([t]) => t !== 'vazio').sort((a, b) => b[1] - a[1])[0];
      return { coluna: h, tipo: tipo ? tipo[0] : 'vazio', vazias: cont.vazio || 0 };
    });
  }
  const abaBruta = (sessao, nome) => sessao.analise.abas.find(a => a.nome === nome);

  // Troca a linha de cabeçalho escolhida pelo usuário (1-based)
  function definirCabecalho(sessao, nomeAba, linhas1) {
    const aba = abaBruta(sessao, nomeAba), info = sessao.abas.find(a => a.nome === nomeAba);
    const linhas = linhas1.map(n => n - 1).sort((a, b) => a - b);
    const larg = Math.max(...linhas.map(r => (aba.valores[r] || []).length));
    const cabecalhos = [];
    for (let c = 0; c < larg; c++) {
      const partes = [];
      for (const r of linhas) { const v = (aba.valores[r] || [])[c]; if (v != null && v !== '' && !partes.includes(String(v).trim())) partes.push(String(v).trim()); }
      cabecalhos.push(partes.join(' / ') || null);
    }
    info.cabecalho = { linha: linhas[0], linhas, cabecalhos, inicioDados: linhas[linhas.length - 1] + 1, confianca: 1, escolhidoPeloUsuario: true };
    delete sessao.trabalhos[nomeAba];
    return info.cabecalho;
  }

  // 2. Mapear uma aba para um schema (com perfil, se houver)
  function mapear(sessao, nomeAba, schemaId, { perfil = null } = {}) {
    const aba = abaBruta(sessao, nomeAba), info = sessao.abas.find(a => a.nome === nomeAba);
    if (!D.schema(schemaId).importavel) throw new Error(`A base ${schemaId} não é importável.`);
    info.schema = schemaId;
    const cab = perfil && perfil.header_rows && !info.cabecalho.escolhidoPeloUsuario ? definirCabecalho(sessao, nomeAba, perfil.header_rows) : info.cabecalho;
    const colunas = M.colunasDaAba(aba, cab);
    const mapeamento = M.mapearColunas(colunas, schemaId, { motor: sessao.motor, perfil });
    const t = sessao.trabalhos[nomeAba] = { aba: nomeAba, schema: schemaId, colunas, mapeamento, valoresFixos: { ...((perfil && perfil.fixed_values) || {}) }, decisoes: perfilParaDecisoes(perfil), perfil: perfil ? perfil.profile_id : null };
    return t;
  }
  const perfilParaDecisoes = perfil => {
    const d = {};
    for (const [campo, regras] of Object.entries((perfil && perfil.normalization_rules) || {})) {
      d[campo] = {};
      for (const [orig, valor] of Object.entries(regras)) d[campo][U.dobrar(orig)] = valor === '__IGNORAR__' ? { acao: 'IGNORAR' } : { acao: 'CORRIGIR', valor };
    }
    return d;
  };

  // Correção manual de uma coluna: campo = null para desmarcar; incluirNaoUtilizado para forçar coluna LGPD
  function corrigirMapeamento(sessao, nomeAba, indice, campo) {
    const t = sessao.trabalhos[nomeAba];
    for (const m of t.mapeamento) if (campo && m.campo === campo && m.indice !== indice) Object.assign(m, { campo: null, decisao: 'NAO_MAPEADO', confianca: 0 });
    const m = t.mapeamento.find(x => x.indice === indice);
    Object.assign(m, campo ? { campo, decisao: 'USUARIO', confianca: 1, motivos: ['escolhido pelo usuário'] } : { campo: null, decisao: 'IGNORADO', confianca: 0, motivos: ['desmarcado pelo usuário'] });
    delete t.resultado;
    return t;
  }
  function definirValorFixo(sessao, nomeAba, campo, valor) {
    const t = sessao.trabalhos[nomeAba];
    if (valor == null || valor === '') delete t.valoresFixos[campo]; else t.valoresFixos[campo] = valor;
    delete t.resultado;
  }
  // De/para: decisão sobre um valor original (CORRIGIR com valor, IGNORAR). criarAlias grava regra persistente.
  function decidirValor(sessao, nomeAba, campo, original, { acao, valor = null, criarAlias = false }) {
    const t = sessao.trabalhos[nomeAba];
    const c = D.campo(t.schema, campo);
    if (!['CORRIGIR', 'CONFIRMAR', 'IGNORAR'].includes(acao)) throw new Error('Ação inválida: ' + acao);
    t.decisoes[campo] = t.decisoes[campo] || {};
    t.decisoes[campo][U.dobrar(original)] = { acao, valor };
    if (criarAlias && acao !== 'IGNORAR') {
      const entidade = c && c.allowed_values ? c.allowed_values : campo === 'modelo' ? 'MODELO' : null;
      if (!entidade) throw new Error(`O campo ${campo} não usa lista de valores; não dá para criar alias.`);
      const a = sessao.motor.adicionar(entidade, original, valor, sessao.usuario);
      if (!sessao.pacote.config.aliases.some(x => x.alias_id === a.alias_id)) sessao.pacote.config.aliases.push(a);
    }
    delete t.resultado;
  }

  // 3. Normalizar e validar uma aba
  async function processar(sessao, nomeAba, { progresso = () => {} } = {}) {
    const t = sessao.trabalhos[nomeAba];
    const aba = abaBruta(sessao, nomeAba), info = sessao.abas.find(a => a.nome === nomeAba);
    const pacote = sessao.pacote;
    const catalogo = catalogoDaSessao(sessao);
    const registroOps = ID.registroOperacoes({ existentes: pacote.bases.OPERATIONS, aliasesOperacao: pacote.config.aliases.filter(a => a.entity_type === 'OPERACAO') });
    const t0 = Date.now();
    const r = await N.normalizarAba({ schemaId: t.schema, aba, cab: info.cabecalho, mapeamento: t.mapeamento, valoresFixos: t.valoresFixos, decisoes: t.decisoes,
      motor: sessao.motor, registroOps, catalogo, pessoas: pessoasDaSessao(sessao), contexto: { arquivo: sessao.lote.arquivo && sessao.lote.arquivo.nome, usuario: sessao.usuario, batchId: sessao.lote.import_batch_id },
      token: sessao.token, progresso });
    const issues = V.validarDataset(t.schema, r.registros, { mapeamento: t.mapeamento, ignoradas: r.ignoradas });
    const oficiais = r.registros.map(x => N.registroOficial(t.schema, x));
    let duplicidades = [];
    if (t.schema === 'OPERATIONS') duplicidades = DU.encontrarDuplicidades(oficiais, { existentes: pacote.bases.OPERATIONS, decisoes: pacote.config.decisoes });
    t.resultado = { ...r, issues, oficiais, duplicidades, registroOps, tempo_ms: Date.now() - t0,
      qualidade: Q.calcularQualidade(t.schema, oficiais, { issues, bases: { ...pacote.bases, ...basesDaSessao(sessao) } }) };
    if (sessao.lote.estado === 'MAPPED' || sessao.lote.estado === 'VALIDATED' || sessao.lote.estado === 'READY') AU.transicao(sessao.lote, 'VALIDATED', nomeAba);
    return t.resultado;
  }
  function basesDaSessao(sessao) {
    const b = {};
    for (const t of Object.values(sessao.trabalhos)) if (t.resultado) b[t.schema] = (b[t.schema] || []).concat(t.resultado.oficiais);
    return b;
  }
  function pessoasDaSessao(sessao) {
    const daSessao = Object.values(sessao.trabalhos).filter(t => t.schema === 'PEOPLE' && t.resultado).flatMap(t => t.resultado.oficiais).filter(p => p.employee_id);
    return sessao.pacote.bases.PEOPLE.concat(daSessao.filter(p => !sessao.pacote.bases.PEOPLE.some(x => x.employee_id === p.employee_id)));
  }
  function catalogoDaSessao(sessao) {
    const daSessao = Object.values(sessao.trabalhos).filter(t => t.schema === 'OPERATIONS' && t.resultado).flatMap(t => t.resultado.oficiais);
    return sessao.pacote.bases.OPERATIONS.concat(daSessao.filter(o => o.operation_id && !sessao.pacote.bases.OPERATIONS.some(x => x.operation_id === o.operation_id)));
  }

  // Decisão sobre um par de operações parecidas (altera o estado real da sessão e persiste alias/decisão)
  function decidirDuplicidade(sessao, nomeAba, indicePar, escolha) {
    const t = sessao.trabalhos[nomeAba];
    const par = t.resultado.duplicidades[indicePar];
    const r = DU.aplicarDecisao(t.resultado.oficiais, par, escolha, { usuario: sessao.usuario, registroOps: t.resultado.registroOps });
    sessao.pacote.config.decisoes.push(r.decisao);
    if (r.alias) {
      const a = sessao.motor.adicionar('OPERACAO', r.alias.original_value, r.alias.normalized_value, sessao.usuario);
      if (!sessao.pacote.config.aliases.some(x => x.alias_id === a.alias_id)) sessao.pacote.config.aliases.push(a);
      t.resultado.oficiais = r.operacoes;
      t.resultado.unificadas = (t.resultado.unificadas || []).concat([{ removida: r.removida, mantida: r.mantida }]);
    }
    t.resultado.duplicidades.splice(indicePar, 1);
    t.resultado.qualidade = Q.calcularQualidade('OPERATIONS', t.resultado.oficiais, { issues: t.resultado.issues, bases: sessao.pacote.bases });
    return r;
  }

  // 4. Prévia do commit: o que será adicionado/alterado/mantido em cada base, avisos e bloqueios
  function previa(sessao) {
    const pacote = sessao.pacote;
    const futuras = JSON.parse(JSON.stringify(pacote.bases));
    const porBase = {};
    const trabalhos = Object.values(sessao.trabalhos).filter(t => t.resultado).sort((a, b) => ORDEM.indexOf(a.schema) - ORDEM.indexOf(b.schema));
    for (const t of trabalhos) {
      const chave = D.schema(t.schema).chave[0];
      const validos = t.resultado.oficiais.filter(o => o[chave]);
      const semChave = t.resultado.oficiais.length - validos.length;
      // Chave repetida no arquivo: fica a PRIMEIRA ocorrência (a repetição já é apontada como erro DUPLICADO)
      const vistos = new Set(), unicos = validos.filter(o => !vistos.has(o[chave]) && vistos.add(o[chave]));
      const comp = CF.compararVersoes(futuras[t.schema], unicos, chave);
      futuras[t.schema] = CF.aplicarComparacao(t.schema, futuras[t.schema], comp, { ausentes: 'MANTER' });
      const eventosNovos = t.schema === 'SKILLS' ? eventosDaMatriz(pacote.bases.SKILLS, comp, sessao) : [];
      if (eventosNovos.length) futuras.HISTORY = futuras.HISTORY.concat(eventosNovos.filter(e => !futuras.HISTORY.some(h => h.event_id === e.event_id)));
      porBase[t.schema] = { aba: t.aba, adicionados: comp.adicionados.length, alterados: comp.alterados.length, inalterados: comp.inalterados.length,
        ausentesNoNovo: comp.ausentesNoNovo.length, semChave, repetidos: validos.length - unicos.length, eventosHistorico: eventosNovos.length, comparacao: comp };
    }
    const issuesRef = V.validarPacote(futuras);
    const issues = trabalhos.flatMap(t => t.resultado.issues).concat(issuesRef);
    const cont = V.contar(issues);
    return { porBase, futuras, issues, contagem: cont, bloqueado: cont.BLOCKING > 0 };
  }
  // Mudança de nível na matriz importada vira evento no histórico (Matriz + Histórico)
  function eventosDaMatriz(atuais, comp, sessao) {
    const ev = [];
    const agora = U.agoraISO();
    const mk = (novo, antigo, tipo) => {
      const e = { event_type: tipo, employee_id: novo.employee_id, operation_id: novo.operation_id, previous_level: antigo ? antigo.skill_level : null, new_level: novo.skill_level,
        previous_titularity: antigo ? antigo.titularidade : null, new_titularity: novo.titularidade, event_date: novo.skill_date || agora.slice(0, 10),
        responsible_id: null, responsible_name: sessao.usuario, observation: 'Gerado pela importação da matriz', source: novo.source, import_batch_id: sessao.lote.import_batch_id, created_at: agora };
      e.event_id = ID.eventId(e); return e;
    };
    for (const n of comp.adicionados) if (n.skill_level && n.skill_level !== 'UNKNOWN') ev.push(mk(n, null, (atuais || []).length ? 'NOVA_HABILIDADE' : 'CARGA_INICIAL'));
    for (const a of comp.alterados) if (a.campos.includes('skill_level') || a.campos.includes('titularidade'))
      ev.push(mk(a.depois, a.antes, a.campos.includes('skill_level') ? 'MUDANCA_NIVEL' : 'MUDANCA_TITULARIDADE'));
    return ev;
  }

  // 5. Commit: aplica a prévia ao pacote (só em modo IMPORTACAO, sem bloqueios ou com decisão administrativa)
  function confirmar(sessao, { ausentes = {}, override = null } = {}) {
    if (sessao.modo !== 'IMPORTACAO') throw new Error(`Modo ${sessao.modo}: nada é aplicado às bases.`);
    if (!Object.values(sessao.trabalhos).some(t => t.resultado)) throw new Error('Nenhuma aba foi processada ainda: escolha as abas, confira o mapeamento e processe antes de confirmar.');
    const p = previa(sessao);
    if (p.bloqueado && !(override && override.motivo)) throw new Error(`${p.contagem.BLOCKING} bloqueio(s) impedem a confirmação. Resolva ou registre uma decisão administrativa.`);
    if (sessao.lote.estado === 'VALIDATED') AU.transicao(sessao.lote, 'READY');
    AU.transicao(sessao.lote, 'COMMITTING');
    const pacote = sessao.pacote;
    try {
      const antes = JSON.parse(JSON.stringify(pacote.bases));
      for (const [schema, info] of Object.entries(p.porBase)) {
        const politica = ausentes[schema] || 'MANTER';
        pacote.bases[schema] = CF.aplicarComparacao(schema, pacote.bases[schema], info.comparacao, { ausentes: politica });
        if (schema === 'SKILLS') H.anexarEventos(pacote.bases.HISTORY, eventosDaMatriz(antes.SKILLS, info.comparacao, sessao));
      }
      if (override && override.motivo) pacote.config.decisoes.push({ tipo: 'LIBERACAO_BLOQUEIO', detalhe: `${sessao.lote.import_batch_id}: ${override.motivo}`, decidido_por: sessao.usuario, decidido_em: U.agoraISO() });
      sessao.lote.abas = Object.values(sessao.trabalhos).filter(t => t.resultado).map(t => AU.resumoAba({ aba: t.aba, schema: t.schema, registros: t.resultado.registros,
        ignoradas: t.resultado.ignoradas, log: t.resultado.log, issues: t.resultado.issues, duplicidades: t.resultado.issues.filter(i => i.codigo === 'DUPLICADO').length }));
      AU.transicao(sessao.lote, 'COMPLETED');
      pacote.lotes.push(resumoLote(sessao));
      return { ok: true, previa: p, lote: sessao.lote };
    } catch (e) {
      AU.transicao(sessao.lote, 'FAILED', e.message);
      throw e;
    }
  }
  function cancelar(sessao, motivo = 'cancelado pelo usuário') {
    if (sessao.token) sessao.token.cancelar();
    if (!['COMPLETED', 'FAILED', 'CANCELLED', 'COMMITTING'].includes(sessao.lote.estado)) AU.transicao(sessao.lote, 'CANCELLED', motivo);
    return sessao.lote;
  }
  // Resumo guardado no pacote (histórico de importações e "Arquivos recentes")
  function resumoLote(sessao) {
    const abas = sessao.lote.abas.length ? sessao.lote.abas : Object.values(sessao.trabalhos).filter(t => t.resultado).map(t => AU.resumoAba({ aba: t.aba, schema: t.schema,
      registros: t.resultado.registros, ignoradas: t.resultado.ignoradas, log: t.resultado.log, issues: t.resultado.issues }));
    return { import_batch_id: sessao.lote.import_batch_id, estado: sessao.lote.estado, modo: sessao.modo, arquivo: sessao.lote.arquivo, executado_por: sessao.usuario,
      iniciado_em: sessao.lote.iniciado_em, finalizado_em: sessao.lote.finalizado_em || U.agoraISO(), abas,
      log: Object.values(sessao.trabalhos).filter(t => t.resultado).flatMap(t => t.resultado.log.map(l => ({ aba: t.aba, ...l }))),
      issues: Object.values(sessao.trabalhos).filter(t => t.resultado).flatMap(t => t.resultado.issues) };
  }
  // Encerrar análise/simulação: registra o lote sem mexer nas bases
  function encerrarSemGravar(sessao) {
    if (sessao.lote.estado === 'VALIDATED' || sessao.lote.estado === 'MAPPED') { sessao.lote.abas = resumoLote(sessao).abas; AU.transicao(sessao.lote, 'CANCELLED', `modo ${sessao.modo}: nada foi gravado`); }
    const r = resumoLote(sessao);
    sessao.pacote.lotes.push(r);
    return r;
  }

  return { iniciar, definirCabecalho, mapear, corrigirMapeamento, definirValorFixo, decidirValor, processar, decidirDuplicidade, previa, confirmar, cancelar, encerrarSemGravar, motorDoPacote, ORDEM };
}, typeof module === 'object' ? module : null);
