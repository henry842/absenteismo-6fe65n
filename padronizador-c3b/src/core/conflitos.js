// Motor de conflitos (3 vias) e comparação de versões.
// Conflito: desde a última sincronização, o Excel e o sistema mudaram o mesmo campo para valores diferentes.
// Nunca aplica "a última gravação vence" em silêncio: o conflito é devolvido para decisão.
(typeof module === 'object' ? require('../modulo') : C3BModulo)('core/conflitos', ['core/util', 'core/dicionario'], (U, D) => {
  'use strict';

  const igual = (a, b) => (a ?? null) === (b ?? null) || String(a ?? '') === String(b ?? '');
  const CAMPOS_IGNORADOS = new Set(['updated_at', 'updated_by', 'source', 'created_at', 'import_batch_id']);

  // base / excel / sistema: arrays de registros oficiais. chave: campo identificador.
  function detectarConflitos(base, excel, sistema, chave) {
    const mapa = arr => new Map((arr || []).map(r => [r[chave], r]));
    const B = mapa(base), E = mapa(excel), S = mapa(sistema);
    const chaves = new Set([...B.keys(), ...E.keys(), ...S.keys()]);
    const mesclado = [], conflitos = [];
    for (const k of chaves) {
      if (k == null) continue;
      const b = B.get(k), e = E.get(k), s = S.get(k);
      if (!e && !s) continue;                       // removido dos dois lados
      if (!b) {                                     // novo: veio de um lado ou dos dois
        if (e && s && !registrosIguais(e, s)) conflitos.push(...camposDiferentes(k, {}, e, s));
        mesclado.push({ ...(e || {}), ...(s || {}) });
        continue;
      }
      const r = { ...b };
      for (const campo of new Set([...Object.keys(b), ...Object.keys(e || {}), ...Object.keys(s || {})])) {
        if (CAMPOS_IGNORADOS.has(campo)) { r[campo] = (s || e || b)[campo]; continue; }
        const vb = b[campo], ve = e ? e[campo] : vb, vs = s ? s[campo] : vb;
        const mudouE = !igual(ve, vb), mudouS = !igual(vs, vb);
        if (mudouE && mudouS && !igual(ve, vs)) conflitos.push({ conflito_id: `CNF-${U.hashCurto(k + '|' + campo, 8)}`, chave: k, campo, base: vb ?? null, excel: ve ?? null, sistema: vs ?? null });
        r[campo] = mudouS ? vs : mudouE ? ve : vb;
      }
      mesclado.push(r);
    }
    return { mesclado, conflitos };
  }
  const registrosIguais = (a, b) => Object.keys({ ...a, ...b }).every(c => CAMPOS_IGNORADOS.has(c) || igual(a[c], b[c]));
  const camposDiferentes = (k, b, e, s) => Object.keys({ ...e, ...s }).filter(c => !CAMPOS_IGNORADOS.has(c) && !igual(e[c], s[c]))
    .map(c => ({ conflito_id: `CNF-${U.hashCurto(k + '|' + c, 8)}`, chave: k, campo: c, base: null, excel: e[c] ?? null, sistema: s[c] ?? null }));

  // decisoes: { conflito_id: 'EXCEL' | 'SISTEMA' | { manual: valor } }
  // aplicarSemelhantes: repete a decisão para conflitos do mesmo campo com o mesmo par de valores.
  function resolverConflitos(mesclado, conflitos, decisoes, chave, { aplicarSemelhantes = false } = {}) {
    const finais = { ...decisoes };
    if (aplicarSemelhantes) {
      for (const c of conflitos) if (finais[c.conflito_id]) {
        for (const o of conflitos) if (!finais[o.conflito_id] && o.campo === c.campo && igual(o.excel, c.excel) && igual(o.sistema, c.sistema)) finais[o.conflito_id] = finais[c.conflito_id];
      }
    }
    const pendentes = [];
    const porChave = new Map(mesclado.map(r => [r[chave], r]));
    for (const c of conflitos) {
      const d = finais[c.conflito_id];
      if (!d) { pendentes.push(c); continue; }
      const r = porChave.get(c.chave);
      r[c.campo] = d === 'EXCEL' ? c.excel : d === 'SISTEMA' ? c.sistema : d.manual;
    }
    return { registros: mesclado, pendentes, aplicadas: conflitos.length - pendentes.length };
  }

  // Comparação antes de gravar: o que entra, o que muda, o que não mudou e o que sumiu (nunca apagado sozinho)
  function compararVersoes(existentes, novos, chave) {
    const E = new Map((existentes || []).map(r => [r[chave], r]));
    const vistos = new Set();
    const adicionados = [], alterados = [], inalterados = [];
    for (const n of novos) {
      const k = n[chave];
      if (k == null) continue;
      vistos.add(k);
      const e = E.get(k);
      if (!e) { adicionados.push(n); continue; }
      const campos = Object.keys({ ...e, ...n }).filter(c => !CAMPOS_IGNORADOS.has(c) && !igual(e[c], n[c]));
      if (campos.length) alterados.push({ chave: k, antes: e, depois: n, campos });
      else inalterados.push(n);
    }
    const ausentesNoNovo = [...E.values()].filter(e => !vistos.has(e[chave]));
    return { adicionados, alterados, inalterados, ausentesNoNovo };
  }

  // Monta a nova versão da base. ausentes: 'MANTER' | 'DESATIVAR' (soft delete). Histórico: só acrescenta.
  function aplicarComparacao(schemaId, existentes, comp, { ausentes = 'MANTER', aceitarAlterados = true } = {}) {
    const s = D.schema(schemaId), chave = s.chave[0];
    if (s.master_mode === 'APPEND_ONLY') return (existentes || []).concat(comp.adicionados);
    const alt = new Map(comp.alterados.map(a => [a.chave, a.depois]));
    const out = [];
    for (const e of existentes || []) {
      const k = e[chave];
      if (alt.has(k) && aceitarAlterados) { out.push({ ...e, ...alt.get(k) }); continue; }
      if (comp.ausentesNoNovo.includes(e) && ausentes === 'DESATIVAR') { out.push(desativar(schemaId, e)); continue; }
      out.push(e);
    }
    return out.concat(comp.adicionados);
  }
  function desativar(schemaId, r) {
    const campo = { PEOPLE: ['status', 'INATIVO'], OPERATIONS: ['ativa', 'NAO'], SKILLS: ['status', 'INATIVO'] }[schemaId];
    return campo ? { ...r, [campo[0]]: campo[1], updated_at: U.agoraISO(), source: (r.source || '') + ' · desativado (não veio no novo arquivo)' } : r;
  }

  return { detectarConflitos, resolverConflitos, compararVersoes, aplicarComparacao };
}, typeof module === 'object' ? module : null);
