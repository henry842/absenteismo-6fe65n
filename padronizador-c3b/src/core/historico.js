// Matriz + Histórico: registrar uma habilidade atualiza o estado atual (03 Matriz) e cria um evento
// no histórico (04), que é só de acréscimo (append-only). Reler a mesma informação não duplica o evento.
(typeof module === 'object' ? require('../modulo') : C3BModulo)('core/historico', ['core/util', 'core/ids'], (U, ID) => {
  'use strict';

  // pacote.bases.SKILLS e pacote.bases.HISTORY (arrays de registros oficiais). Muda o pacote recebido.
  function registrarHabilidade(pacote, m) {
    const obrig = ['employee_id', 'operation_id', 'event_date'];
    for (const f of obrig) if (!m[f]) throw new Error(`registrarHabilidade: falta ${f}.`);
    if (m.new_level != null && !['i', 'I', 'L', 'U'].includes(m.new_level)) throw new Error(`Nível inválido: "${m.new_level}". Use i, I, L ou U.`);
    const skills = pacote.bases.SKILLS = pacote.bases.SKILLS || [];
    const hist = pacote.bases.HISTORY = pacote.bases.HISTORY || [];
    const id = ID.skillRecordId(m.employee_id, m.operation_id);
    const agora = U.agoraISO();
    let reg = skills.find(s => s.skill_record_id === id);
    const anterior = reg ? { level: reg.skill_level, titularity: reg.titularidade } : { level: null, titularity: null };
    const novoNivel = m.new_level ?? anterior.level;
    const novaTit = m.new_titularity ?? anterior.titularity;
    const tipo = !reg ? 'NOVA_HABILIDADE' : anterior.level !== novoNivel ? 'MUDANCA_NIVEL' : anterior.titularity !== novaTit ? 'MUDANCA_TITULARIDADE' : 'AVALIACAO';
    if (!reg) {
      reg = { skill_record_id: id, employee_id: m.employee_id, operation_id: m.operation_id, skill_level: novoNivel, titularidade: novaTit ?? null,
        certificacao: m.certificacao ?? null, skill_date: m.event_date, last_evaluation_date: m.event_date, status: 'ATIVO', updated_at: agora, updated_by: m.responsible_name || m.updated_by || 'padronizador', source: m.source || 'REGISTRO_HABILIDADE' };
      skills.push(reg);
    } else {
      // Só avança o estado atual se o evento não for mais antigo que o último registrado
      if (!reg.skill_date || m.event_date >= reg.skill_date) {
        reg.skill_level = novoNivel; reg.titularidade = novaTit ?? null;
        if (anterior.level !== novoNivel) reg.skill_date = m.event_date;
        reg.last_evaluation_date = m.event_date;
      }
      if (m.certificacao) reg.certificacao = m.certificacao;
      reg.updated_at = agora; reg.updated_by = m.responsible_name || m.updated_by || reg.updated_by;
    }
    const evento = {
      event_type: m.event_type || tipo, employee_id: m.employee_id, operation_id: m.operation_id,
      previous_level: anterior.level, new_level: novoNivel, previous_titularity: anterior.titularity, new_titularity: novaTit ?? null,
      event_date: m.event_date, responsible_id: m.responsible_id || null, responsible_name: m.responsible_name || null,
      observation: m.observation || null, source: m.source || 'REGISTRO_HABILIDADE', import_batch_id: m.import_batch_id || null, created_at: agora,
    };
    evento.event_id = ID.eventId(evento);
    const r = anexarEventos(hist, [evento]);
    return { registro: reg, evento, eventoNovo: r.adicionados === 1 };
  }

  // Acrescenta eventos sem nunca apagar ou reescrever os existentes. Evento com o mesmo event_id é o mesmo fato.
  function anexarEventos(historico, novos) {
    const ids = new Set(historico.map(e => e.event_id));
    let adicionados = 0, repetidos = 0;
    for (const e of novos) {
      if (!e.event_id) continue;
      if (ids.has(e.event_id)) { repetidos++; continue; }
      historico.push(e); ids.add(e.event_id); adicionados++;
    }
    return { adicionados, repetidos };
  }

  // Estado da matriz a partir do histórico (útil para conferência: a matriz bate com o último evento?)
  function matrizDoHistorico(historico) {
    const ult = new Map();
    for (const e of historico.slice().sort((a, b) => (a.event_date || '').localeCompare(b.event_date || '') || (a.created_at || '').localeCompare(b.created_at || ''))) {
      if (!e.employee_id || !e.operation_id) continue;
      ult.set(ID.skillRecordId(e.employee_id, e.operation_id), e);
    }
    return ult;
  }

  return { registrarHabilidade, anexarEventos, matrizDoHistorico };
}, typeof module === 'object' ? module : null);
