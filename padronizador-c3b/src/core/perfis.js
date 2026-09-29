// Detecção de schema de uma aba e perfis de importação (CRUD, compatibilidade, exportar/importar).
(typeof module === 'object' ? require('../modulo') : C3BModulo)('core/perfis', ['core/util', 'core/dicionario', 'core/mapeamento'], (U, D, M) => {
  'use strict';

  // Qual base a aba representa? Nota = cobertura dos campos obrigatórios e recomendados + dica pelo nome da aba.
  function detectarSchema(aba, cab, { motor, perfis = [] } = {}) {
    const colunas = M.colunasDaAba(aba, cab, { amostra: 30 });
    const nomeAba = U.dobrar(aba.nome);
    const ranking = D.SCHEMAS.filter(s => s.importavel).map(s => {
      const mapa = M.mapearColunas(colunas, s.id, { motor });
      const campos = D.camposMapeaveis(s.id);
      const peso = c => (c.required ? 2 : c.recommended ? 1 : 0.3);
      const total = campos.reduce((t, c) => t + peso(c), 0);
      const achado = mapa.filter(m => m.campo).reduce((t, m) => t + peso(campos.find(c => c.field_id === m.campo)) * m.confianca, 0);
      let nota = total ? achado / total : 0;
      const motivos = [`${mapa.filter(m => m.campo).length} colunas reconhecidas`];
      if ((s.dicasAba || []).some(d => nomeAba.includes(U.dobrar(d)))) { nota += 0.15; motivos.push(`nome da aba "${aba.nome}"`); }
      // Sem nenhum campo de identificação, não é essa base
      const ident = { PEOPLE: ['matricula'], OPERATIONS: ['estacao', 'descricao_pt', 'codigo_operacao'], SKILLS: ['skill_level'],
        HISTORY: ['event_date', 'new_level'], TRAINING: ['target_level', 'planned_date', 'status'], ATTENDANCE: ['date', 'status'] }[s.id] || [];
      if (ident.length && !mapa.some(m => ident.includes(m.campo))) { nota *= 0.4; motivos.push('sem as colunas que identificam essa base'); }
      return { schema: s.id, nome: s.nome_pt, nota: +Math.min(1, nota).toFixed(2), motivos };
    }).sort((a, b) => b.nota - a.nota);
    const perfil = melhorPerfil(perfis, aba, cab);
    if (perfil && perfil.compatibilidade >= 0.7) {
      const r = ranking.find(x => x.schema === perfil.perfil.schema);
      if (r) { r.nota = Math.max(r.nota, perfil.compatibilidade); r.motivos.unshift(`perfil "${perfil.perfil.profile_name}" (${Math.round(perfil.compatibilidade * 100)}%)`); }
      ranking.sort((a, b) => b.nota - a.nota);
    }
    return { ranking, perfil };
  }

  // ---------- perfis ----------
  function criarPerfis(lista = []) {
    const perfis = lista.map(p => ({ ...p }));
    let seq = perfis.reduce((m, p) => Math.max(m, +(String(p.profile_id).match(/(\d+)$/) || [0, 0])[1]), 0);
    const agora = () => U.agoraISO();
    function criar({ profile_name, schema, sheet_name_pattern = '', header_row = null, header_rows = null, column_mapping = {}, normalization_rules = {}, fixed_values = {}, layout = null }) {
      if (!profile_name || !String(profile_name).trim()) throw new Error('Dê um nome ao perfil.');
      D.schema(schema);
      const p = { profile_id: `PRF-${String(++seq).padStart(4, '0')}`, profile_name: String(profile_name).trim(), schema, sheet_name_pattern,
        header_row, header_rows, column_mapping, normalization_rules, fixed_values, layout, created_at: agora(), updated_at: agora(), version: 1 };
      perfis.push(p);
      return p;
    }
    function obter(id) { return perfis.find(p => p.profile_id === id) || null; }
    function editar(id, campos) {
      const p = obter(id); if (!p) throw new Error('Perfil não encontrado: ' + id);
      Object.assign(p, campos, { profile_id: p.profile_id, created_at: p.created_at, updated_at: agora(), version: (p.version || 1) + 1 });
      return p;
    }
    function duplicar(id) { const p = obter(id); if (!p) throw new Error('Perfil não encontrado: ' + id); return criar({ ...JSON.parse(JSON.stringify(p)), profile_name: p.profile_name + ' (cópia)' }); }
    function excluir(id) { const i = perfis.findIndex(p => p.profile_id === id); if (i < 0) return false; perfis.splice(i, 1); return true; }
    function exportar(id) { const p = id ? obter(id) : null; return JSON.stringify(id ? p : perfis, null, 2); }
    function importar(json) {
      const dados = typeof json === 'string' ? JSON.parse(json) : json;
      const lista = Array.isArray(dados) ? dados : [dados];
      return lista.map(p => {
        if (!p || !p.profile_name || !p.schema) throw new Error('Arquivo de perfil inválido: falta profile_name ou schema.');
        return criar({ ...p });
      });
    }
    return { listar: () => perfis.slice(), criar, obter, editar, duplicar, excluir, exportar, importar };
  }

  // Perfil a partir do mapeamento aprovado numa importação
  function perfilDoMapeamento(nome, schema, aba, cab, mapeamento, valoresFixos = {}, regras = {}) {
    const column_mapping = {};
    for (const m of mapeamento) {
      const k = U.dobrar(m.cabecalho);
      if (!k) continue;
      if (m.campo) column_mapping[k] = m.campo;
      else if (m.decisao === 'IGNORADO') column_mapping[k] = '__IGNORAR__';
    }
    return { profile_name: nome, schema, sheet_name_pattern: aba.nome, header_row: cab.linha + 1, header_rows: cab.linhas.map(r => r + 1),
      column_mapping, normalization_rules: regras, fixed_values: valoresFixos };
  }

  // Compatibilidade de um perfil com uma aba: cabeçalhos em comum (80%) + nome da aba (20%)
  function compatibilidade(perfil, aba, cab) {
    const doPerfil = new Set(Object.keys(perfil.column_mapping || {}));
    const daAba = new Set((cab.cabecalhos || []).map(U.dobrar).filter(Boolean));
    if (!doPerfil.size || !daAba.size) return 0;
    const inter = [...doPerfil].filter(h => daAba.has(h)).length;
    const jacc = inter / new Set([...doPerfil, ...daAba]).size;
    const cobertura = inter / doPerfil.size;
    let nome = 0;
    if (perfil.sheet_name_pattern) {
      const pad = U.dobrar(perfil.sheet_name_pattern);
      nome = pad === U.dobrar(aba.nome) ? 1 : U.similaridade(pad, aba.nome);
    }
    return +(Math.max(jacc, cobertura * 0.95) * 0.8 + nome * 0.2).toFixed(2);
  }
  function melhorPerfil(perfis, aba, cab) {
    let melhor = null;
    for (const p of perfis) { const c = compatibilidade(p, aba, cab); if (!melhor || c > melhor.compatibilidade) melhor = { perfil: p, compatibilidade: c }; }
    return melhor;
  }

  return { detectarSchema, criarPerfis, perfilDoMapeamento, compatibilidade, melhorPerfil };
}, typeof module === 'object' ? module : null);
