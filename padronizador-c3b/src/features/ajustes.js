// Camada de Ajustes Manuais C3B.
//   MATRIZ ORIGINAL → base importada (extração, nunca editada) → AJUSTES MANUAIS (overrides) → VALOR EFETIVO → C3B calcula KPIs
// Um ajuste nunca apaga a origem: guarda valor original, novo valor, motivo, responsável e data, e pode ser desfeito.
// Como os ajustes ficam FORA da base importada, sobrevivem a cada releitura da Matriz. Quando a Matriz passa a dizer
// o mesmo que o ajuste, a reconciliação avisa: "o ajuste não é mais necessário" → encerrar ou manter.
// Dois tipos:  LOCAL  — só corrige a Base Operacional/C3B (ex.: nome escrito errado)
//              OFICIAL — mudança real de habilidade: vira evento no Histórico oficial e pendência para a Matriz oficial.
(typeof module === 'object' ? require('../modulo') : C3BModulo)('features/ajustes', ['core/util', 'core/ids'], (U, ID) => {
  'use strict';

  const NIVEIS = ['i', 'I', 'L', 'U', 'NAO_IDENTIFICADO'];
  const DESIGNACOES = ['TITULAR', 'EM_TREINAMENTO', 'FUTURO_TITULAR', 'SEM_DESIGNACAO'];
  const CAMPOS_PESSOA = { nome: 'Nome', matricula: 'Matrícula', funcao: 'Função', turno: 'Turno', status: 'Status', observacao: 'Observação' };
  const CAMPOS_HABILIDADE = { skill_level: 'Nível', assignment_status: 'Designação', operation_id: 'Operação vinculada', observacao: 'Observação', registro: 'Registro' };
  const ENUM_DO_CAMPO = { funcao: 'FUNCAO', turno: 'TURNO', status: 'STATUS_PESSOA' };
  const pad = (n, t = 5) => String(n).padStart(t, '0');
  const iguais = (a, b) => (a ?? null) === (b ?? null) || String(a ?? '') === String(b ?? '');
  const chave = (emp, op) => `${emp}|${op}`;
  const designacaoBooleans = s => ({ has_circle: s === 'TITULAR' || s === 'FUTURO_TITULAR', has_triangle: s === 'EM_TREINAMENTO' || s === 'FUTURO_TITULAR',
    is_current_operator: s === 'TITULAR' || s === 'FUTURO_TITULAR', is_training_planned: s === 'EM_TREINAMENTO' || s === 'FUTURO_TITULAR', is_future_holder: s === 'FUTURO_TITULAR' });
  // Bloco com informação real (mesma regra da Base Operacional; a cor não conta)
  const temInfo = r => !!r && (NIVEIS.includes(r.skill_level) && r.skill_level !== 'NAO_IDENTIFICADO' || r.has_circle || r.has_triangle || !!r.dates_raw || !!r.unrecognized_values);

  function novoEstado() { return { versao: 1, seq: 0, seqLog: 0, seqEvt: 0, overrides: [], log: [], historico_oficial: [] }; }
  const ativos = estado => (estado ? estado.overrides.filter(o => o.active) : []);

  // ---------- valores da FONTE (Matriz importada) ----------
  function fontePessoa(p, campo) {
    if (!p) return undefined;
    return { nome: p.nome, matricula: p.matricula || null, funcao: p.papel || null, turno: null, status: null, observacao: null }[campo];
  }
  const fonteRegistro = (r, emp, op) => r.registros.find(x => x.employee_id === emp && x.operation_id === op) || null;
  function fonteHabilidade(reg, campo) {
    if (campo === 'skill_level') return reg ? reg.skill_level : 'NAO_IDENTIFICADO';
    if (campo === 'assignment_status') return reg ? reg.assignment_status : 'SEM_DESIGNACAO';
    if (campo === 'registro') return temInfo(reg) ? 'COM_REGISTRO' : 'SEM_REGISTRO';
    if (campo === 'operation_id') return reg ? reg.operation_id : null;
    return null;
  }

  // ---------- criar ----------
  // d: { tipo: 'PESSOA'|'HABILIDADE', employee_id (da origem), operation_id?, field, new_value, reason, created_by, scope: 'LOCAL'|'OFICIAL' }
  function criarAjuste(estado, r, d, { motor = null, agora = U.agoraISO() } = {}) {
    const motivo = String(d.reason || '').trim();
    if (!motivo) throw new Error('Informe o motivo do ajuste (fica registrado).');
    const por = String(d.created_by || '').trim() || 'usuario';
    const scope = d.scope === 'OFICIAL' ? 'OFICIAL' : 'LOCAL';
    const efetivoAntes = aplicar(r, estado);
    let o;
    if (d.tipo === 'PESSOA') {
      if (!(d.field in CAMPOS_PESSOA)) throw new Error(`Campo de pessoa desconhecido: ${d.field}`);
      if (scope === 'OFICIAL') throw new Error('Alteração oficial vale para habilidades; dados da pessoa são ajuste local.');
      const p = r.pessoas.find(x => x.employee_id === d.employee_id);
      if (!p) throw new Error(`Pessoa ${d.employee_id} não existe na base importada.`);
      const novo = validarValorPessoa(d.field, d.new_value, motor);
      const antes = efetivoAntes.pessoas.find(x => x.source_employee_id === d.employee_id)[d.field] ?? null;
      if (iguais(antes, novo)) throw new Error(`${CAMPOS_PESSOA[d.field]} já é "${novo ?? '—'}".`);
      o = base(estado, { employee_id: d.employee_id, operation_id: null, entity_type: 'PERSON', field: d.field, action: 'UPDATE', original_value: fontePessoa(p, d.field), new_value: novo });
      o._antes = antes;
    } else if (d.tipo === 'HABILIDADE') {
      if (!(d.field in CAMPOS_HABILIDADE)) throw new Error(`Campo de habilidade desconhecido: ${d.field}`);
      if (!r.pessoas.some(x => x.employee_id === d.employee_id)) throw new Error(`Pessoa ${d.employee_id} não existe na base importada.`);
      const op = r.operacoes.find(x => x.operation_id === d.operation_id);
      if (!op) throw new Error(`Operação ${d.operation_id} não existe na Matriz importada.`);
      if (scope === 'OFICIAL' && !['skill_level', 'assignment_status', 'registro'].includes(d.field)) throw new Error('Alteração oficial vale para nível, designação ou remoção de registro.');
      const reg = fonteRegistro(r, d.employee_id, d.operation_id);
      const ef = efetivoAntes.registros.find(x => x.source_employee_id === d.employee_id && x.operation_id === d.operation_id);
      let novo, action;
      if (d.field === 'registro') {
        if (!ef || ef.desconsiderado || !temInfoEfetiva(ef)) throw new Error('Não há registro efetivo para remover nessa operação.');
        novo = 'SEM_REGISTRO'; action = 'REMOVE';
      } else if (d.field === 'skill_level') {
        if (!NIVEIS.includes(d.new_value)) throw new Error(`Nível inválido: "${d.new_value}". Use i, I, L, U ou NAO_IDENTIFICADO (i ≠ I).`);
        novo = d.new_value; action = temInfoEfetiva(ef) ? 'UPDATE' : 'ADD';
      } else if (d.field === 'assignment_status') {
        if (!DESIGNACOES.includes(d.new_value)) throw new Error(`Designação inválida: "${d.new_value}". Use ${DESIGNACOES.join(', ')}.`);
        novo = d.new_value; action = temInfoEfetiva(ef) ? 'UPDATE' : 'ADD';
      } else if (d.field === 'operation_id') {
        const alvo = r.operacoes.find(x => x.operation_id === d.new_value);
        if (!alvo) throw new Error(`Operação de destino ${d.new_value} não existe na Matriz importada.`);
        if (d.new_value === d.operation_id) throw new Error('A operação de destino é a mesma.');
        if (!ef || !temInfoEfetiva(ef)) throw new Error('Não há habilidade efetiva nessa operação para mover.');
        const noAlvo = efetivoAntes.registros.find(x => x.source_employee_id === d.employee_id && x.operation_id === d.new_value);
        if (noAlvo && temInfoEfetiva(noAlvo)) throw new Error(`A pessoa já tem habilidade em ${d.new_value}. Remova ou corrija essa antes de mover.`);
        novo = d.new_value; action = 'UPDATE';
      } else { novo = String(d.new_value ?? '').trim() || null; action = 'UPDATE'; }
      const antes = d.field === 'registro' ? 'COM_REGISTRO' : d.field === 'operation_id' ? d.operation_id : ef ? ef[d.field] ?? null : fonteHabilidade(null, d.field);
      if (d.field !== 'registro' && iguais(antes, novo)) throw new Error(`${CAMPOS_HABILIDADE[d.field]} já é "${novo}".`);
      o = base(estado, { employee_id: d.employee_id, operation_id: d.operation_id, entity_type: 'SKILL', field: d.field, action, original_value: fonteHabilidade(reg, d.field), new_value: novo, source_sheet: op.sheet });
      o._antes = antes;
    } else throw new Error('Tipo de ajuste inválido: ' + d.tipo);
    const antes = o._antes; delete o._antes;
    Object.assign(o, { reason: motivo, created_by: por, created_at: agora, scope });
    // um ajuste ativo por alvo/campo: o anterior é substituído (não apagado)
    for (const x of ativos(estado)) if (x.entity_type === o.entity_type && x.employee_id === o.employee_id && x.operation_id === o.operation_id && x.field === o.field) {
      Object.assign(x, { active: false, closed_at: agora, closed_by: por, close_reason: `SUBSTITUIDO por ${o.override_id}` });
      registrarLog(estado, x, 'SUBSTITUIDO', { de: x.new_value, para: o.new_value, por, em: agora, motivo: `substituído por ${o.override_id}` });
    }
    estado.overrides.push(o);
    registrarLog(estado, o, 'CRIADO', { de: antes, para: o.new_value, por, em: agora, motivo });
    if (scope === 'OFICIAL') {
      const reg = fonteRegistro(r, o.employee_id, o.operation_id);
      estado.historico_oficial.push({ event_id: `HOF-${pad(++estado.seqEvt)}`, override_id: o.override_id, employee_id: o.employee_id, operation_id: o.operation_id, field: o.field,
        event_type: { skill_level: 'MUDANCA_NIVEL', assignment_status: 'MUDANCA_DESIGNACAO', registro: 'REMOCAO_REGISTRO' }[o.field],
        previous_value: antes, new_value: o.new_value, event_date: agora.slice(0, 10), responsible: por, reason: motivo, status_matriz: 'PENDENTE_NA_MATRIZ',
        alvo_matriz: alvoNaMatriz(reg, o, r), created_at: agora });
    }
    return o;
  }
  function base(estado, campos) {
    return { override_id: `OVR-${pad(++estado.seq)}`, operation_id: null, source_sheet: null, ...campos, reason: null, created_by: null, created_at: null, active: true, scope: 'LOCAL',
      closed_at: null, closed_by: null, close_reason: null, kept_source: null };
  }
  function validarValorPessoa(campo, valor, motor) {
    const v = valor == null ? '' : String(valor).trim();
    if (campo === 'observacao') return v || null;
    if (!v) throw new Error(`${CAMPOS_PESSOA[campo]} não pode ficar vazio.`);
    if (campo === 'matricula') { if (!/^[0-9A-Za-z-]{1,20}$/.test(v)) throw new Error(`Matrícula inválida: "${v}".`); return v; }
    if (campo === 'nome') return v.replace(/\s+/g, ' ');
    const enumNome = ENUM_DO_CAMPO[campo];
    if (enumNome && motor) {
      const n = motor.normalizar(enumNome, v);
      if (n.status !== 'OK') throw new Error(`"${v}" não é um valor de ${CAMPOS_PESSOA[campo]} no Dicionário${n.sugestao ? ` (parece ${n.sugestao})` : ''}. Cadastre o valor no Dicionário ou escolha da lista.`);
      return n.normalizado;
    }
    return v;
  }
  function alvoNaMatriz(reg, o, r) {
    if (!reg) { const op = r.operacoes.find(x => x.operation_id === o.operation_id); return `${op ? op.sheet : ''}: bloco da pessoa na operação ${o.operation_id} (sem registro hoje)`; }
    if (o.field === 'skill_level') return `${reg.source_l_cell}: marcador de nível (hoje "${reg.l_marker_raw ?? 'vazio'}")`;
    if (o.field === 'assignment_status') return `${reg.source_block}: formas ○/△ (hoje ${reg.assignment_status})`;
    return `${reg.source_block}: marcador e formas do bloco`;
  }
  function registrarLog(estado, o, evento, { de, para, por, em, motivo }) {
    estado.log.push({ log_id: `LOG-${pad(++estado.seqLog)}`, override_id: o.override_id, evento, employee_id: o.employee_id, operation_id: o.operation_id, field: o.field,
      de: de ?? null, para: para ?? null, por, em, motivo: motivo || null, scope: o.scope });
  }
  const temInfoEfetiva = r => !!r && !r.desconsiderado && (['i', 'I', 'L', 'U'].includes(r.skill_level) || r.assignment_status !== 'SEM_DESIGNACAO' || !!r.dates_raw || !!r.unrecognized_values);

  // ---------- aplicar: fonte + ajustes ativos → valor efetivo ----------
  function aplicar(r, estado) {
    const lista = ativos(estado).slice().sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)) || a.override_id.localeCompare(b.override_id));
    const pessoas = r.pessoas.map(p => ({ ...p, source_employee_id: p.employee_id, source_nome: p.nome, funcao: p.papel || null, turno: null, status: null, observacao: null, override_ids: [] }));
    const pPorId = new Map(pessoas.map(p => [p.employee_id, p]));
    for (const o of lista.filter(x => x.entity_type === 'PERSON')) {
      const p = pPorId.get(o.employee_id);
      if (!p) continue;
      p[o.field] = o.new_value; p.override_ids.push(o.override_id);
    }
    for (const p of pessoas) {
      if (p.override_ids.length && p.matricula && !r.pessoas.find(x => x.employee_id === p.source_employee_id).matricula) { p.employee_id = ID.employeeId(p.matricula); p.employee_id_status = 'MATRICULA_POR_AJUSTE'; }
      p.override_ids = p.override_ids.join(',') || null;
    }
    const regs = new Map();
    for (const x of r.registros) regs.set(chave(x.employee_id, x.operation_id), { ...x, source_employee_id: x.employee_id, source_skill_level: x.skill_level, source_assignment_status: x.assignment_status,
      source_operation_id: x.operation_id, observacao: null, desconsiderado: false, origem_efetiva: temInfo(x) ? 'MATRIZ' : 'SEM_REGISTRO', override_ids: [], ultima_atualizacao: x.latest_date || null });
    for (const o of lista.filter(x => x.entity_type === 'SKILL')) {
      let row = regs.get(chave(o.employee_id, o.operation_id));
      if (!row) {
        const op = r.operacoes.find(x => x.operation_id === o.operation_id), p = r.pessoas.find(x => x.employee_id === o.employee_id);
        if (!op || !p) continue;
        row = { sheet: op.sheet, model_id: op.model_id, employee_id: o.employee_id, source_employee_id: o.employee_id, nome: p.nome, papel: p.papel, operation_id: op.operation_id, source_operation_id: null,
          operation_no: op.operation_no, station_code: op.station_code, descricao_zh: op.descricao_zh, descricao_pt: op.descricao_pt, skill_level: 'NAO_IDENTIFICADO', assignment_status: 'SEM_DESIGNACAO',
          ...designacaoBooleans('SEM_DESIGNACAO'), source_skill_level: 'SEM_REGISTRO', source_assignment_status: 'SEM_REGISTRO', source_block: null, dates_raw: null, first_date: null, latest_date: null,
          observacao: null, desconsiderado: false, origem_efetiva: 'AJUSTE', override_ids: [], ultima_atualizacao: null };
        regs.set(chave(o.employee_id, o.operation_id), row);
      }
      if (o.field === 'skill_level') row.skill_level = o.new_value;
      else if (o.field === 'assignment_status') Object.assign(row, { assignment_status: o.new_value }, designacaoBooleans(o.new_value));
      else if (o.field === 'observacao') row.observacao = o.new_value;
      else if (o.field === 'registro') Object.assign(row, { desconsiderado: true, skill_level: 'SEM_REGISTRO', assignment_status: 'SEM_DESIGNACAO' }, designacaoBooleans('SEM_DESIGNACAO'));
      else if (o.field === 'operation_id') {
        const alvo = r.operacoes.find(x => x.operation_id === o.new_value);
        if (!alvo) continue;
        regs.delete(chave(o.employee_id, o.operation_id));
        const vazio = regs.get(chave(o.employee_id, alvo.operation_id));
        Object.assign(row, { sheet: alvo.sheet, model_id: alvo.model_id, operation_id: alvo.operation_id, operation_no: alvo.operation_no, station_code: alvo.station_code, descricao_zh: alvo.descricao_zh, descricao_pt: alvo.descricao_pt });
        if (vazio) row.substituiu_bloco = vazio.source_block;
        regs.set(chave(o.employee_id, alvo.operation_id), row);
      }
      row.override_ids.push(o.override_id);
      row.origem_efetiva = row.source_block ? 'MATRIZ+AJUSTE' : 'AJUSTE';
      const d = String(o.created_at || '').slice(0, 10);
      if (d && (!row.ultima_atualizacao || d > row.ultima_atualizacao)) row.ultima_atualizacao = d;
    }
    const registros = [...regs.values()];
    for (const x of registros) {
      const p = pPorId.get(x.source_employee_id);
      if (p) { x.employee_id = p.employee_id; x.nome = p.nome; x.employee_id_status = p.employee_id_status; x.matricula = p.matricula || null; }
      x.override_ids = x.override_ids.join(',') || null;
    }
    const habilidadesAtuais = registros.filter(x => temInfo(x) || x.override_ids);
    const valido = x => !x.desconsiderado;
    const conta = (arr, f) => arr.filter(f).length;
    const resumo = r.resumo.map(s => {
      const rs = registros.filter(x => x.sheet === s.sheet && valido(x));
      return { ...s, pessoas: new Set(rs.map(x => x.employee_id)).size, combinacoes: rs.length, nivel_L: conta(rs, x => x.skill_level === 'L'),
        titulares: conta(rs, x => x.assignment_status === 'TITULAR'), em_treinamento: conta(rs, x => x.assignment_status === 'EM_TREINAMENTO'), futuros_titulares: conta(rs, x => x.assignment_status === 'FUTURO_TITULAR'),
        com_data: conta(rs, x => x.dates_raw), ajustes_ativos: conta(registros.filter(x => x.sheet === s.sheet), x => x.override_ids) };
    });
    return { pessoas, registros, habilidadesAtuais, treinamentos: registros.filter(x => valido(x) && x.is_training_planned), resumo, ativos: ativos(estado).length };
  }

  // ---------- reconciliação depois de reler a Matriz ----------
  function reconciliar(r, estado) {
    const out = [];
    for (const o of ativos(estado)) {
      let atual, situacao = null;
      if (o.entity_type === 'PERSON') {
        const p = r.pessoas.find(x => x.employee_id === o.employee_id);
        if (!p) { out.push(sug(o, 'ORFAO', null, 'A pessoa não aparece mais na Matriz importada.')); continue; }
        atual = fontePessoa(p, o.field);
      } else {
        if (!r.operacoes.some(x => x.operation_id === o.operation_id) || !r.pessoas.some(x => x.employee_id === o.employee_id)) { out.push(sug(o, 'ORFAO', null, 'A pessoa ou a operação não aparece mais na Matriz importada.')); continue; }
        if (o.field === 'operation_id') {
          const velho = fonteRegistro(r, o.employee_id, o.operation_id), novo = fonteRegistro(r, o.employee_id, o.new_value);
          atual = temInfo(novo) && !temInfo(velho) ? o.new_value : o.operation_id;
        } else if (o.field === 'observacao') continue;
        else atual = fonteHabilidade(fonteRegistro(r, o.employee_id, o.operation_id), o.field);
      }
      if (o.kept_source != null && o.kept_source === JSON.stringify(atual ?? null)) continue;
      if (iguais(atual, o.new_value)) situacao = 'NAO_MAIS_NECESSARIO';
      else if (!iguais(atual, o.original_value)) situacao = 'FONTE_MUDOU';
      if (situacao) out.push(sug(o, situacao, atual, situacao === 'NAO_MAIS_NECESSARIO'
        ? `A Matriz agora diz o mesmo que o ajuste (${rot(o)} = ${o.new_value}). O ajuste ${o.override_id} não é mais necessário.`
        : `A Matriz mudou desde o ajuste ${o.override_id}: era "${o.original_value ?? '—'}", agora é "${atual ?? '—'}"; o ajuste diz "${o.new_value}". Revise.`));
    }
    return out;
  }
  const rot = o => (o.entity_type === 'PERSON' ? CAMPOS_PESSOA : CAMPOS_HABILIDADE)[o.field] || o.field;
  const sug = (o, situacao, fonte_atual, mensagem) => ({ override_id: o.override_id, override: o, situacao, fonte_atual, mensagem });

  // Encerrar (não é mais necessário) ou desfazer. O ajuste fica no histórico, inativo.
  function encerrar(estado, override_id, { por = 'usuario', motivo = '', tipo = 'ENCERRADO', agora = U.agoraISO() } = {}) {
    const o = estado.overrides.find(x => x.override_id === override_id);
    if (!o) throw new Error(`Ajuste ${override_id} não encontrado.`);
    if (!o.active) throw new Error(`O ajuste ${override_id} já está inativo (${o.close_reason}).`);
    Object.assign(o, { active: false, closed_at: agora, closed_by: por, close_reason: tipo + (motivo ? `: ${motivo}` : '') });
    registrarLog(estado, o, tipo, { de: o.new_value, para: tipo === 'DESFEITO' ? o.original_value : o.new_value, por, em: agora, motivo });
    if (o.scope === 'OFICIAL') {
      const ev = estado.historico_oficial.find(e => e.override_id === override_id && e.status_matriz === 'PENDENTE_NA_MATRIZ');
      if (tipo === 'ENCERRADO' && ev) ev.status_matriz = 'APLICADO_NA_MATRIZ';
      if (tipo === 'DESFEITO') {
        if (ev) ev.status_matriz = 'ESTORNADO';
        estado.historico_oficial.push({ event_id: `HOF-${pad(++estado.seqEvt)}`, override_id, employee_id: o.employee_id, operation_id: o.operation_id, field: o.field, event_type: 'ESTORNO',
          previous_value: o.new_value, new_value: o.original_value, event_date: agora.slice(0, 10), responsible: por, reason: motivo || 'alteração oficial desfeita', status_matriz: 'NAO_SE_APLICA', alvo_matriz: null, created_at: agora });
      }
    }
    return o;
  }
  const desfazer = (estado, id, opcoes = {}) => encerrar(estado, id, { ...opcoes, tipo: 'DESFEITO' });
  // Manter: não pergunta de novo enquanto a Matriz continuar com o mesmo valor
  function manter(estado, override_id, fonte_atual, { por = 'usuario', agora = U.agoraISO() } = {}) {
    const o = estado.overrides.find(x => x.override_id === override_id);
    if (!o) throw new Error(`Ajuste ${override_id} não encontrado.`);
    o.kept_source = JSON.stringify(fonte_atual ?? null);
    registrarLog(estado, o, 'MANTIDO', { de: fonte_atual, para: o.new_value, por, em: agora, motivo: 'mantido após releitura da Matriz' });
    return o;
  }
  const historico = (estado, employee_id = null) => (estado ? estado.log.filter(l => !employee_id || l.employee_id === employee_id) : []);

  // ---------- serialização (abas AJUSTES_MANUAIS / LOG_AJUSTES / HISTORICO_OFICIAL) ----------
  const COLUNAS = {
    AJUSTES_MANUAIS: ['override_id', 'employee_id', 'operation_id', 'entity_type', 'field', 'action', 'original_value', 'new_value', 'reason', 'created_by', 'created_at', 'active',
      'scope', 'source_sheet', 'closed_at', 'closed_by', 'close_reason', 'kept_source'],
    LOG_AJUSTES: ['log_id', 'override_id', 'evento', 'employee_id', 'operation_id', 'field', 'de', 'para', 'por', 'em', 'motivo', 'scope'],
    HISTORICO_OFICIAL: ['event_id', 'override_id', 'employee_id', 'operation_id', 'field', 'event_type', 'previous_value', 'new_value', 'event_date', 'responsible', 'reason', 'status_matriz', 'alvo_matriz', 'created_at'],
  };
  const paraLinhas = estado => ({ AJUSTES_MANUAIS: (estado || novoEstado()).overrides, LOG_AJUSTES: (estado || novoEstado()).log, HISTORICO_OFICIAL: (estado || novoEstado()).historico_oficial });
  function deLinhas({ AJUSTES_MANUAIS = [], LOG_AJUSTES = [], HISTORICO_OFICIAL = [] } = {}) {
    const txt = v => (v === '' || v === undefined ? null : v);
    const bool = v => v === true || v === 1 || /^(true|verdadeiro|sim|1)$/i.test(String(v));
    const e = novoEstado();
    e.overrides = AJUSTES_MANUAIS.filter(o => o.override_id).map(o => ({ ...Object.fromEntries(COLUNAS.AJUSTES_MANUAIS.map(k => [k, txt(o[k])])), active: bool(o.active) }));
    e.log = LOG_AJUSTES.filter(l => l.log_id).map(l => Object.fromEntries(COLUNAS.LOG_AJUSTES.map(k => [k, txt(l[k])])));
    e.historico_oficial = HISTORICO_OFICIAL.filter(h => h.event_id).map(h => Object.fromEntries(COLUNAS.HISTORICO_OFICIAL.map(k => [k, txt(h[k])])));
    const maior = (arr, campo) => arr.reduce((m, x) => Math.max(m, +(String(x[campo]).match(/(\d+)$/) || [0, 0])[1]), 0);
    e.seq = maior(e.overrides, 'override_id'); e.seqLog = maior(e.log, 'log_id'); e.seqEvt = maior(e.historico_oficial, 'event_id');
    return e;
  }

  return { novoEstado, criarAjuste, aplicar, reconciliar, encerrar, desfazer, manter, historico, paraLinhas, deLinhas, ativos,
    NIVEIS, DESIGNACOES, CAMPOS_PESSOA, CAMPOS_HABILIDADE, COLUNAS };
}, typeof module === 'object' ? module : null);
