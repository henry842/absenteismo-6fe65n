// Duplicidade de operações: similaridade calculada campo a campo (modelo, estação, lado, posição, código,
// descrição, torque/soquete). Nunca une sozinho: a decisão é humana ("mesma", "diferentes", "revisar depois")
// e altera o estado real (a operação repetida passa a usar o ID da outra e um alias é gravado).
(typeof module === 'object' ? require('../modulo') : C3BModulo)('core/duplicidades', ['core/util', 'core/ids'], (U, ID) => {
  'use strict';

  const PESOS = { modelo: 0.15, estacao: 0.15, lado: 0.1, posicao: 0.05, codigo: 0.15, descricao: 0.25, caracteristicas: 0.15 };
  const LIMITE = 0.75;

  function compararOperacoes(a, b) {
    const comp = {};
    comp.modelo = a.model_id && b.model_id ? (a.model_id === b.model_id ? 1 : 0) : null;
    comp.estacao = a.estacao && b.estacao ? (a.estacao === b.estacao ? 1 : 0) : null;
    comp.lado = a.lado && b.lado ? (a.lado === b.lado ? 1 : 0) : (a.lado || b.lado ? 0.5 : null);
    comp.posicao = a.posicao && b.posicao ? (String(a.posicao) === String(b.posicao) ? 1 : 0) : (a.posicao || b.posicao ? 0.5 : null);
    comp.codigo = a.codigo_operacao && b.codigo_operacao ? (U.dobrar(a.codigo_operacao).replace(/ /g, '') === U.dobrar(b.codigo_operacao).replace(/ /g, '') ? 1 : 0) : null;
    const dPt = a.descricao_pt && b.descricao_pt ? U.similaridade(a.descricao_pt, b.descricao_pt) : null;
    const dZh = a.descricao_zh && b.descricao_zh ? U.similaridade(a.descricao_zh, b.descricao_zh) : null;
    comp.descricao = dPt == null && dZh == null ? null : Math.max(dPt || 0, dZh || 0);
    const car = [];
    if (a.torque != null && b.torque != null) car.push(Math.abs(a.torque - b.torque) <= 0.5 ? 1 : 0);
    if (a.soquete && b.soquete) car.push(U.dobrar(a.soquete).replace(/ /g, '') === U.dobrar(b.soquete).replace(/ /g, '') ? 1 : 0);
    comp.caracteristicas = car.length ? car.reduce((x, y) => x + y, 0) / car.length : null;
    let soma = 0, pesos = 0;
    for (const [k, p] of Object.entries(PESOS)) if (comp[k] != null) { soma += comp[k] * p; pesos += p; }
    let geral = pesos ? soma / pesos : 0;
    const bloqueios = [];
    // Códigos diferentes, torques diferentes ou lados diferentes: textos parecidos não bastam
    if (comp.codigo === 0) { geral = Math.min(geral, 0.6); bloqueios.push('códigos de operação diferentes'); }
    if (comp.lado === 0) { geral = Math.min(geral, 0.6); bloqueios.push('lados diferentes'); }
    if (comp.caracteristicas === 0) { geral = Math.min(geral, 0.7); bloqueios.push('torque/soquete diferentes'); }
    // Mesma estação não basta: sem código igual, a descrição precisa ser parecida
    if (comp.codigo !== 1 && (comp.descricao == null || comp.descricao < 0.6)) { geral = Math.min(geral, 0.6); bloqueios.push('descrições diferentes'); }
    const pct = x => (x == null ? null : Math.round(x * 100));
    return { geral: pct(geral), componentes: Object.fromEntries(Object.entries(comp).map(([k, v]) => [k, pct(v)])), bloqueios };
  }

  // Pares candidatos dentro do conjunto (e contra o catálogo existente). Só compara mesma estação e modelo.
  function encontrarDuplicidades(operacoes, { existentes = [], decisoes = [] } = {}) {
    const decididos = new Set(decisoes.filter(d => d.tipo === 'OPERACOES_DIFERENTES').map(d => d.detalhe));
    const todos = existentes.map(o => ({ ...o, _existente: true })).concat(operacoes);
    const grupos = new Map();
    for (const o of todos) { if (!o.model_id || !o.estacao) continue; const k = o.model_id + '|' + o.estacao; if (!grupos.has(k)) grupos.set(k, []); grupos.get(k).push(o); }
    const pares = [];
    for (const g of grupos.values()) for (let i = 0; i < g.length; i++) for (let j = i + 1; j < g.length; j++) {
      const a = g[i], b = g[j];
      if (a._existente && b._existente) continue;
      if (a.operation_id && a.operation_id === b.operation_id) continue;
      const par = parChave(a, b);
      if (decididos.has(par)) continue;
      const c = compararOperacoes(a, b);
      if (c.geral >= LIMITE * 100) pares.push({ par, a, b, ...c });
    }
    return pares.sort((x, y) => y.geral - x.geral);
  }
  const parChave = (a, b) => [a.operation_id || ID.chaveNaturalOperacao({ ...a, station_base: a.estacao, side: a.lado, position: a.posicao }), b.operation_id || ID.chaveNaturalOperacao({ ...b, station_base: b.estacao, side: b.lado, position: b.posicao })].sort().join(' ⇄ ');

  // Aplica a decisão. "MESMA": B passa a usar o operation_id de A, dados vazios de A são completados por B,
  // e um alias OPERACAO (chave natural de B → ID de A) é devolvido para ser persistido.
  // Retorna { operacoes, alias, decisao } sem mexer no array original.
  function aplicarDecisao(operacoes, par, escolha, { usuario = 'usuario', registroOps = null } = {}) {
    const decisao = { tipo: { MESMA: 'OPERACOES_UNIFICADAS', DIFERENTES: 'OPERACOES_DIFERENTES', DEPOIS: 'OPERACOES_REVISAR_DEPOIS' }[escolha], detalhe: par.par, decidido_por: usuario, decidido_em: U.agoraISO() };
    if (!decisao.tipo) throw new Error('Decisão inválida: ' + escolha);
    if (escolha !== 'MESMA') return { operacoes, alias: null, decisao };
    // A que fica: a que já existia no catálogo oficial, senão a primeira
    const [fica, sai] = par.b._existente && !par.a._existente ? [par.b, par.a] : [par.a, par.b];
    const chaveSai = ID.chaveNaturalOperacao({ ...sai, station_base: sai.estacao, side: sai.lado, position: sai.posicao });
    const novas = [];
    let completou = null;
    for (const o of operacoes) {
      if (o.operation_id === sai.operation_id && !sai._existente) {
        // completa campos vazios da que fica
        const alvo = operacoes.find(x => x.operation_id === fica.operation_id) || null;
        if (alvo) { completou = alvo; for (const [k, v] of Object.entries(o)) if ((alvo[k] == null || alvo[k] === '') && v != null && v !== '') alvo[k] = v; }
        else novas.push({ ...o, operation_id: fica.operation_id });
        continue;
      }
      novas.push(o);
    }
    if (registroOps) registroOps.unificar(chaveSai, fica.operation_id);
    const alias = { entity_type: 'OPERACAO', original_value: chaveSai, normalized_value: fica.operation_id, created_by: usuario };
    return { operacoes: novas, alias, decisao, removida: sai.operation_id, mantida: fica.operation_id, completou: !!completou };
  }

  return { compararOperacoes, encontrarDuplicidades, aplicarDecisao, PESOS, LIMITE };
}, typeof module === 'object' ? module : null);
