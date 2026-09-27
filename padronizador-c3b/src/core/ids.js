// IDs estáveis: nunca derivados da descrição textual. Determinísticos quando o dado permite
// (employee_id pela matrícula; eventos pelo conteúdo) e persistentes (operações pelo registro do catálogo).
(typeof module === 'object' ? require('../modulo') : C3BModulo)('core/ids', ['core/util'], (U) => {
  'use strict';

  const limparId = s => String(s).toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const employeeId = matricula => matricula ? 'EMP-' + limparId(matricula) : null;
  const stationId = (modelId, base) => modelId && base ? `${modelId}-${limparId(base)}` : null;
  const skillRecordId = (emp, op) => emp && op ? `SKL-${emp}-${op}` : null;
  const dataCompacta = d => String(d || '').slice(0, 10).replace(/-/g, '') || '00000000';
  const eventId = e => 'EVT-' + dataCompacta(e.event_date) + '-' + U.hashCurto(JSON.stringify([
    e.employee_id, e.operation_id, e.event_type, e.previous_level || '', e.new_level || '',
    e.previous_titularity || '', e.new_titularity || '', e.event_date || '']), 10);
  const trainingId = t => 'TRN-' + U.hashCurto(JSON.stringify([t.employee_id, t.operation_id, t.target_level || '', t.planned_date || '']), 10);
  const attendanceId = a => `ATT-${dataCompacta(a.date)}-${a.employee_id}-${a.shift || 'SEM_TURNO'}`;
  const installationId = m => 'C3B-INST-' + U.hashCurto(JSON.stringify([m.empresa, m.unidade, m.equipe, m.created_at]), 10);

  // Chave natural da operação: modelo + estação + lado + posição + (código, ou a descrição sem acento/pontuação).
  // "C16 L1" e "C16-L1" viram a mesma chave, então recebem o mesmo operation_id.
  function chaveNaturalOperacao(o) {
    const ident = o.codigo_operacao ? 'COD:' + U.dobrar(o.codigo_operacao).replace(/ /g, '') : 'DESC:' + U.dobrar(o.descricao_pt || o.descricao_zh || '');
    return [o.model_id, o.station_base, o.side || '', o.position || '', ident].join('|');
  }
  const prefixoOperacao = o => `${o.model_id}-${limparId(o.station_base)}` + (o.side || o.position ? `-${o.side || ''}${o.position || ''}` : '');

  // Registro de operações: lembra quais IDs já existem (do 02 oficial) e quais chaves foram unificadas
  // pelo usuário (aliases OPERACAO). Novos IDs recebem a próxima sequência do prefixo.
  function registroOperacoes({ existentes = [], aliasesOperacao = [] } = {}) {
    const porChave = new Map(), seqs = new Map(), ids = new Set();
    for (const o of existentes) {
      if (!o.operation_id) continue;
      ids.add(o.operation_id);
      const m = String(o.operation_id).match(/^(.*)-(\d{3,})$/);
      if (m) seqs.set(m[1], Math.max(seqs.get(m[1]) || 0, +m[2]));
      if (o.model_id && (o.station_base || o.estacao)) porChave.set(chaveNaturalOperacao({ ...o, station_base: o.station_base || o.estacao }), o.operation_id);
    }
    for (const a of aliasesOperacao) if (a.active !== false) porChave.set(a.original_value, a.normalized_value);
    function obter(o) {
      const k = chaveNaturalOperacao(o);
      if (porChave.has(k)) return { operation_id: porChave.get(k), novo: false, chave: k };
      const p = prefixoOperacao(o);
      const n = (seqs.get(p) || 0) + 1;
      seqs.set(p, n);
      const id = `${p}-${String(n).padStart(3, '0')}`;
      porChave.set(k, id); ids.add(id);
      return { operation_id: id, novo: true, chave: k };
    }
    return { obter, unificar: (chave, operation_id) => porChave.set(chave, operation_id), existe: id => ids.has(id), chaveNatural: chaveNaturalOperacao };
  }

  // Lote de importação: IMPORT-AAAAMMDD-NNN (contador por dia guardado na configuração)
  function batchId(contadores, data = U.relogio.agora()) {
    const dia = data.toISOString().slice(0, 10).replace(/-/g, '');
    contadores[dia] = (contadores[dia] || 0) + 1;
    return `IMPORT-${dia}-${String(contadores[dia]).padStart(3, '0')}`;
  }

  return { limparId, employeeId, stationId, skillRecordId, eventId, trainingId, attendanceId, installationId, chaveNaturalOperacao, prefixoOperacao, registroOperacoes, batchId };
}, typeof module === 'object' ? module : null);
