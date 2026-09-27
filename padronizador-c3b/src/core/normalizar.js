// Normalização: aplica o mapeamento às linhas da aba e produz registros no formato oficial do schema,
// com o detalhe de cada transformação (valor original, valor normalizado, regra, confiança, decisão).
// Valor não reconhecido vira UNKNOWN (enum) ou fica vazio (null); nunca um valor operacional inventado.
(typeof module === 'object' ? require('../modulo') : C3BModulo)('core/normalizar',
  ['core/util', 'core/dicionario', 'core/parsers', 'core/ids'], (U, D, P, ID) => {
  'use strict';

  const UNKNOWN = 'UNKNOWN';

  // Procura a operação no catálogo a partir do que a planilha traz (código, estação, descrição).
  // Só aceita automaticamente quando não há dúvida; senão devolve sugestão para revisão.
  function resolverOperacao(catalogo, ref, motor) {
    const modelo = ref.modelo ? motor.normalizar('MODELO', ref.modelo).normalizado : null;
    let cands = catalogo.filter(o => !modelo || o.model_id === modelo);
    const cod = ref.codigo ? U.dobrar(ref.codigo).replace(/ /g, '') : '';
    if (cod) {
      const porCod = cands.filter(o => o.codigo_operacao && U.dobrar(o.codigo_operacao).replace(/ /g, '') === cod);
      if (porCod.length === 1) return { operation_id: porCod[0].operation_id, status: 'OK', regra: 'REF_CODIGO_OPERACAO', confianca: 1 };
      if (porCod.length > 1) cands = porCod;
    }
    const est = ref.estacao ? P.parseEstacao(ref.estacao) : ref.descricao ? P.estacaoEmTexto(ref.descricao) || {} : {};
    if (est.station_base) {
      cands = cands.filter(o => o.estacao === est.station_base && (!est.side || !o.lado || o.lado === est.side) && (!est.position || !o.posicao || o.posicao === est.position));
    }
    if (ref.descricao) {
      const txt = String(ref.descricao);
      let melhor = null;
      for (const o of cands) {
        const s = Math.max(U.similaridade(txt, o.descricao_pt || ''), U.similaridade(txt, o.descricao_zh || ''), U.similaridade(txt, `${o.estacao}${o.lado || ''}${o.posicao || ''} ${o.descricao_pt || ''}`));
        if (!melhor || s > melhor.s) melhor = { s, o };
      }
      if (melhor && melhor.s >= 0.9) return { operation_id: melhor.o.operation_id, status: 'OK', regra: 'REF_DESCRICAO', confianca: +melhor.s.toFixed(2) };
      if (melhor && melhor.s >= 0.7) return { operation_id: null, status: 'NAO_RESOLVIDO', sugestao: melhor.o.operation_id, regra: 'REF_DESCRICAO_PARECIDA', confianca: +melhor.s.toFixed(2) };
    }
    if (est.station_base && est.side && cands.length === 1) return { operation_id: cands[0].operation_id, status: 'OK', regra: 'REF_ESTACAO_UNICA', confianca: 0.95 };
    return { operation_id: null, status: 'NAO_RESOLVIDO', regra: cands.length > 1 ? 'REF_AMBIGUA' : 'REF_NAO_ENCONTRADA', confianca: 0, candidatos: cands.slice(0, 5).map(o => o.operation_id) };
  }

  // Parâmetros:
  //  schemaId, aba, cab (cabeçalho), mapeamento [{indice, campo}], valoresFixos {campo: valor}
  //  decisoes {campo: {valorOriginalDobrado: {acao: 'CORRIGIR'|'IGNORAR', valor}}}  (de/para confirmado pelo usuário)
  //  motor (aliases), registroOps (ids.registroOperacoes), catalogo (operações existentes), contexto {arquivo, usuario, batchId}
  async function normalizarAba(p) {
    const { schemaId, aba, cab, mapeamento, valoresFixos = {}, decisoes = {}, motor, registroOps, catalogo = [], pessoas = [], contexto = {}, token = null, progresso = () => {} } = p;
    const campos = D.camposMapeaveis(schemaId);
    const porCampo = {};
    for (const m of mapeamento) if (m.campo && !['NAO_UTILIZADO', 'IGNORADO'].includes(m.decisao)) porCampo[m.campo] = m.indice;
    const ini = cab.inicioDados ?? cab.linha + 1;
    const formatoDatas = {};
    for (const c of campos) if (c.data_type === 'data' && porCampo[c.field_id] != null)
      formatoDatas[c.field_id] = U.formatoDatasColuna(aba.valores.slice(ini).map(l => l[porCampo[c.field_id]]));
    const agora = U.agoraISO();
    const registros = [], log = [], ignoradas = [];
    const cabecalhoRepetido = new Set(cab.cabecalhos.map(U.dobrar).filter(Boolean));
    for (let r = ini; r < aba.valores.length; r++) {
      if ((r - ini) % 300 === 0) { await U.respirar(); if (token) token.verificar(); progresso(Math.round(100 * (r - ini) / Math.max(1, aba.valores.length - ini))); }
      const linha = aba.valores[r];
      const celulas = Object.entries(porCampo).map(([campo, c]) => [campo, linha[c]]);
      if (celulas.every(([, v]) => v == null || v === '')) { ignoradas.push({ linha: r + 1, motivo: 'linha vazia' }); continue; }
      if (celulas.filter(([, v]) => v != null).every(([, v]) => cabecalhoRepetido.has(U.dobrar(v)))) { ignoradas.push({ linha: r + 1, motivo: 'cabeçalho repetido' }); continue; }
      // Linha de total/soma (comum no fim das planilhas legadas): não é um registro
      const primeira = linha.find(v => v != null && v !== '');
      if (typeof primeira === 'string' && /^(total|totais|soma|subtotal|合计|总计)\b/.test(U.dobrar(primeira))) { ignoradas.push({ linha: r + 1, motivo: `linha de total ("${primeira}")` }); continue; }
      const reg = { _linha: r + 1, _origem: `${contexto.arquivo || 'arquivo'}#${aba.nome}!L${r + 1}`, valores: {}, detalhes: {} };
      const anotar = (campo, d) => {
        reg.detalhes[campo] = d;
        if (d.original != null && d.original !== '' && String(d.original) !== String(d.normalizado ?? '') || ['UNKNOWN', 'AMBIGUO', 'REVISAR', 'NAO_RESOLVIDO'].includes(d.status) || d.decisao === 'USUARIO')
          log.push({ row_id: r + 1, field: campo, original_value: d.original ?? null, normalized_value: d.normalizado ?? null, rule: d.regra || '', confidence: d.confianca ?? 1, decision: d.decisao || (d.status === 'OK' ? 'AUTO' : 'PENDENTE'), status: d.status });
      };
      for (const campo of campos) {
        const f = campo.field_id;
        let bruto, fixo = false;
        if (porCampo[f] != null) bruto = linha[porCampo[f]];
        if ((bruto == null || bruto === '') && f in valoresFixos) { bruto = valoresFixos[f]; fixo = true; }
        else if (porCampo[f] == null) continue;
        const textoFmt = porCampo[f] != null && aba.textos ? aba.textos.get(`${r},${porCampo[f]}`) : null;
        let d = normalizarValor(campo, bruto, { motor, textoFmt, formatoColuna: formatoDatas[f] });
        if (aba.celulasDeMescla && porCampo[f] != null && aba.celulasDeMescla.has(`${r},${porCampo[f]}`)) d.mescla = true;
        const dec = decisoes[f] && decisoes[f][U.dobrar(bruto)];
        if (dec) d = dec.acao === 'IGNORAR' ? { original: d.original, normalizado: null, regra: 'IGNORADO_PELO_USUARIO', confianca: 1, status: 'VAZIO', decisao: 'USUARIO' }
          : { original: d.original, normalizado: dec.valor, regra: dec.acao === 'CONFIRMAR' ? 'CONFIRMADO_PELO_USUARIO' : 'CORRIGIDO_PELO_USUARIO', confianca: 1, status: 'OK', decisao: dec.acao === 'CONFIRMAR' ? 'CONFIRMED_BY_USER' : 'USUARIO' };
        if (fixo) Object.assign(d, { regra: porCampo[f] != null ? 'VALOR_FIXO_USUARIO (célula vazia)' : 'VALOR_FIXO_USUARIO', decisao: 'USUARIO' });
        reg.valores[f] = d.normalizado ?? null;
        anotar(f, d);
      }
      completarSchema(schemaId, reg, { motor, registroOps, catalogo, pessoas, contexto, agora, anotar, decisoes });
      registros.push(reg);
    }
    progresso(100);
    return { registros, log, ignoradas };
  }

  // Um valor de um campo → { original, normalizado, regra, confianca, status }
  function normalizarValor(campo, bruto, { motor, textoFmt = null, formatoColuna = 'INDEFINIDO' } = {}) {
    const original = U.valorCelula(bruto);
    const orig = original instanceof Date ? original.toISOString().slice(0, 10) : original;
    if (U.vazio(original)) return { original: null, normalizado: null, regra: 'VAZIO', confianca: 1, status: 'VAZIO' };
    switch (campo.data_type) {
      case 'matricula': {
        const m = P.parseMatricula(bruto, { textoFormatado: textoFmt, eraNumero: typeof original === 'number' });
        if (m.status !== 'OK') return { original: orig, normalizado: null, regra: 'MATRICULA_INVALIDA', confianca: 0, status: 'UNKNOWN' };
        return { original: orig, normalizado: m.valor, regra: textoFmt ? 'MATRICULA_FORMATO_EXCEL' : 'MATRICULA_TEXTO', confianca: 1, status: 'OK', avisoNumero: typeof original === 'number' && !textoFmt };
      }
      case 'enum': case 'booleano': {
        const r = motor.normalizar(campo.allowed_values, original);
        if (r.status === 'UNKNOWN') return { ...r, original: orig, normalizado: UNKNOWN };
        return { ...r, original: orig };
      }
      case 'data': {
        const r = U.parseData(original, { formatoColuna });
        return { original: orig, normalizado: r.valor, regra: r.regra, confianca: r.status === 'OK' ? 1 : r.status === 'AMBIGUO' ? 0.6 : 0, status: r.status === 'OK' ? 'OK' : r.status === 'AMBIGUO' ? 'AMBIGUO' : 'UNKNOWN' };
      }
      case 'numero': {
        const r = U.parseNumero(original);
        return { original: orig, normalizado: r.valor, regra: r.status === 'OK' ? (r.unidade ? 'NUMERO_COM_UNIDADE' : 'NUMERO') : 'NUMERO_INVALIDO', confianca: r.status === 'OK' ? 1 : 0, status: r.status === 'OK' ? 'OK' : 'UNKNOWN', unidade: r.unidade };
      }
      default: {
        const s = String(original).replace(/\s+/g, ' ').trim();
        return { original: orig, normalizado: s, regra: s === String(original) ? 'TEXTO' : 'TEXTO_ESPACOS', confianca: 1, status: 'OK' };
      }
    }
  }

  // Campos derivados e IDs de cada schema
  function completarSchema(schemaId, reg, { motor, registroOps, catalogo, pessoas = [], contexto, agora, anotar, decisoes = {} }) {
    const decisaoRef = (campo, original) => decisoes[campo] && decisoes[campo][U.dobrar(original)];
    const v = reg.valores;
    const meta = () => { v.updated_at = agora; v.updated_by = contexto.usuario || 'padronizador'; v.source = reg._origem; };
    // Pessoa: pela matrícula (chave). Sem matrícula, só pelo nome quando ele é único no Cadastro — e marcado para confirmar.
    const pessoaDaRef = () => {
      if (v.ref_matricula) return ID.employeeId(v.ref_matricula);
      if (v.ref_nome) {
        const dec = decisaoRef('employee_id', v.ref_nome);
        if (dec) { anotar('employee_id', { original: v.ref_nome, normalizado: dec.acao === 'IGNORAR' ? null : dec.valor, regra: dec.acao === 'CONFIRMAR' ? 'CONFIRMADO_PELO_USUARIO' : 'CORRIGIDO_PELO_USUARIO', confianca: 1, status: 'OK', decisao: dec.acao === 'CONFIRMAR' ? 'CONFIRMED_BY_USER' : 'USUARIO' }); return dec.acao === 'IGNORAR' ? null : dec.valor; }
        const achados = pessoas.filter(x => U.dobrar(x.nome) === U.dobrar(v.ref_nome));
        if (achados.length === 1) { anotar('employee_id', { original: v.ref_nome, normalizado: achados[0].employee_id, regra: 'REF_NOME_UNICO', confianca: 0.9, status: 'REVISAR' }); return achados[0].employee_id; }
        anotar('employee_id', { original: v.ref_nome, normalizado: null, regra: achados.length ? 'REF_NOME_AMBIGUO' : 'REF_NOME_NAO_ENCONTRADO', confianca: 0, status: 'NAO_RESOLVIDO_PESSOA' });
      }
      return null;
    };
    const opDaRef = () => {
      if (!v.ref_estacao && !v.ref_codigo_operacao && !v.ref_descricao) return { operation_id: null, status: 'VAZIO', regra: 'SEM_REFERENCIA' };
      const dec = decisaoRef('operation_id', [v.ref_modelo, v.ref_estacao, v.ref_codigo_operacao, v.ref_descricao].filter(Boolean).join(' · '));
      if (dec) return dec.acao === 'IGNORAR' ? { operation_id: null, status: 'VAZIO', regra: 'IGNORADO_PELO_USUARIO' } : { operation_id: dec.valor, status: 'OK', regra: dec.acao === 'CONFIRMAR' ? 'CONFIRMADO_PELO_USUARIO' : 'CORRIGIDO_PELO_USUARIO', confianca: 1, decisao: 'USUARIO' };
      return resolverOperacao(catalogo, { modelo: v.ref_modelo, estacao: v.ref_estacao, codigo: v.ref_codigo_operacao, descricao: v.ref_descricao }, motor);
    };
    const anotarRef = (campo, r, original) => anotar(campo, { original, normalizado: r.operation_id ?? r.valor ?? null, regra: r.regra, confianca: r.confianca ?? 1, status: r.status, sugestao: r.sugestao, decisao: r.decisao, candidatos: r.candidatos });
    if (schemaId === 'PEOPLE') {
      v.employee_id = v.matricula ? ID.employeeId(v.matricula) : null;
      meta();
    } else if (schemaId === 'OPERATIONS') {
      const mod = v.modelo ? motor.normalizar('MODELO', v.modelo) : { normalizado: null, status: 'VAZIO' };
      v.model_id = mod.status === 'OK' ? mod.normalizado : v.modelo ? UNKNOWN : null;
      if (v.modelo) { anotar('model_id', { ...mod, normalizado: v.model_id }); if (mod.status === 'OK') v.modelo = mod.normalizado; }
      const est = P.parseEstacao(v.estacao);
      if (v.estacao && reg.detalhes.estacao && reg.detalhes.estacao.decisao) { est.status = 'OK'; est.confianca = 1; est.regra = reg.detalhes.estacao.regra; }
      if (v.estacao) anotar('estacao', { original: reg.detalhes.estacao.original ?? est.original, normalizado: est.normalizado || null, regra: est.regra, confianca: est.confianca, status: est.status, decisao: reg.detalhes.estacao.decisao || (est.status === 'OK' ? 'AUTO' : 'PENDENTE') });
      const ladoColuna = v.lado && v.lado !== UNKNOWN ? v.lado : null;
      if (ladoColuna && est.side && ladoColuna !== est.side) reg.conflitoLado = { coluna: ladoColuna, estacao: est.side };
      v.estacao = est.station_base || (v.estacao ? UNKNOWN : null);
      v.lado = ladoColuna || est.side || (v.lado === UNKNOWN ? UNKNOWN : null);
      v.posicao = v.posicao != null && v.posicao !== '' ? String(v.posicao).replace(/^0+(?=\d)/, '') : est.position;
      v.station_id = v.model_id && v.model_id !== UNKNOWN && est.station_base ? ID.stationId(v.model_id, est.station_base) : null;
      reg.estacaoParse = est;
      if (v.station_id && registroOps) {
        const o = registroOps.obter({ model_id: v.model_id, station_base: est.station_base, side: v.lado !== UNKNOWN ? v.lado : null, position: v.posicao, codigo_operacao: v.codigo_operacao, descricao_pt: v.descricao_pt, descricao_zh: v.descricao_zh });
        v.operation_id = o.operation_id; reg.chaveNatural = o.chave; reg.idNovo = o.novo;
      } else v.operation_id = null;
      meta();
    } else if (schemaId === 'SKILLS') {
      v.employee_id = pessoaDaRef();
      const op = opDaRef(); v.operation_id = op.operation_id; if (op.status !== 'VAZIO') anotarRef('operation_id', op, [v.ref_modelo, v.ref_estacao, v.ref_codigo_operacao, v.ref_descricao].filter(Boolean).join(' · '));
      if (!v.status && v.skill_level && v.skill_level !== UNKNOWN) { v.status = 'ATIVO'; anotar('status', { original: null, normalizado: 'ATIVO', regra: 'REGISTRO_COM_NIVEL', confianca: 1, status: 'OK' }); }
      v.skill_record_id = ID.skillRecordId(v.employee_id, v.operation_id);
      meta();
    } else if (schemaId === 'HISTORY') {
      v.employee_id = pessoaDaRef();
      const op = opDaRef(); v.operation_id = op.operation_id; if (op.status !== 'VAZIO') anotarRef('operation_id', op, [v.ref_estacao, v.ref_codigo_operacao, v.ref_descricao].filter(Boolean).join(' · '));
      if (!v.event_type) {
        const t = !v.previous_level && v.new_level ? 'NOVA_HABILIDADE' : v.previous_level && v.new_level && v.previous_level !== v.new_level ? 'MUDANCA_NIVEL' : v.new_titularity && v.new_titularity !== v.previous_titularity ? 'MUDANCA_TITULARIDADE' : 'AVALIACAO';
        v.event_type = t; anotar('event_type', { original: null, normalizado: t, regra: 'TIPO_DERIVADO_DOS_NIVEIS', confianca: 1, status: 'OK' });
      }
      v.event_id = v.employee_id && v.operation_id && v.event_date ? ID.eventId(v) : null;
      v.source = reg._origem; v.import_batch_id = contexto.batchId || null; v.created_at = agora;
    } else if (schemaId === 'TRAINING') {
      v.employee_id = pessoaDaRef();
      const op = opDaRef(); v.operation_id = op.operation_id; if (op.status !== 'VAZIO') anotarRef('operation_id', op, [v.ref_estacao, v.ref_codigo_operacao, v.ref_descricao].filter(Boolean).join(' · '));
      const o = catalogo.find(x => x.operation_id === v.operation_id);
      v.model_id = o ? o.model_id : null; v.station_id = o ? o.station_id : null;
      v.training_id = v.employee_id && v.operation_id ? ID.trainingId(v) : null;
      v.updated_at = agora; v.updated_by = contexto.usuario || 'padronizador';
    } else if (schemaId === 'ATTENDANCE') {
      v.employee_id = pessoaDaRef();
      v.attendance_id = v.employee_id && v.date ? ID.attendanceId(v) : null;
      meta();
    }
  }

  // Registro final (só os campos do schema, na ordem oficial)
  function registroOficial(schemaId, reg) {
    const out = {};
    for (const c of D.camposSaida(schemaId)) out[c.field_id] = reg.valores[c.field_id] ?? null;
    return out;
  }

  return { normalizarAba, normalizarValor, resolverOperacao, registroOficial, UNKNOWN };
}, typeof module === 'object' ? module : null);
