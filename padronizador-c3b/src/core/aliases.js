// Motor de aliases: transforma valores escritos de qualquer jeito no código oficial do Dicionário.
// Regras: alias do usuário (persistido em 07_Configuracoes > ALIASES) > alias embutido > sugestão por
// similaridade (NÃO aplicada sozinha) > UNKNOWN. Nunca devolve um valor inventado.
(typeof module === 'object' ? require('../modulo') : C3BModulo)('core/aliases', ['core/util', 'core/dicionario'], (U, D) => {
  'use strict';

  const LIMITE_SUGESTAO = 0.86;

  function criarMotor({ aliasesUsuario = [], modelosExtras = [], valoresExtras = {} } = {}) {
    const usuario = aliasesUsuario.map(a => ({ ...a }));
    const modelos = D.MODELOS.map(m => ({ ...m })).concat(modelosExtras.map(m => ({ ...m, aliases: m.aliases || [] })));
    const enums = {};
    for (const [nome, vals] of Object.entries(D.ENUMS)) enums[nome] = vals.concat(valoresExtras[nome] || []);
    let seq = usuario.reduce((m, a) => Math.max(m, +(String(a.alias_id).match(/(\d+)$/) || [0, 0])[1]), 0);

    const chaveSemEspaco = s => U.dobrar(s).replace(/ /g, '');

    function buscarUsuario(entidade, original) {
      const k = U.dobrar(original);
      return usuario.find(a => a.active !== false && a.entity_type === entidade && U.dobrar(a.original_value) === k);
    }

    // Nível de habilidade: diferencia maiúscula (i = treinamento, I = independente)
    function normalizarNivel(bruto) {
      const s = String(bruto).trim();
      if (D.ehNivel(s)) return { normalizado: s, regra: 'NIVEL_EXATO', confianca: 1, status: 'OK' };
      // "L (Proficiente)", "U - Orientação": o código vem na frente
      const m = s.match(/^([iILU])\s*[-(–:]/);
      if (m) return { normalizado: m[1], regra: 'NIVEL_PREFIXO', confianca: 0.97, status: 'OK' };
      if (s === 'l' || s === 'u') return { normalizado: s.toUpperCase(), regra: 'NIVEL_CAIXA', confianca: 0.9, status: 'REVISAR' };
      const k = U.dobrar(s);
      const palavras = { 'fase de treinamento': 'i', 'treinamento': 'i', 'fase independente': 'I', 'independente': 'I',
        'fase de trabalho': 'L', 'proficiente': 'L', 'proficiencia': 'L', 'fase de orientacao': 'U', 'orientacao': 'U', 'orientador': 'U' };
      if (palavras[k]) return { normalizado: palavras[k], regra: 'NIVEL_PALAVRA', confianca: 0.95, status: 'OK' };
      return null;
    }

    // entidade: nome de um enum (FUNCAO, TURNO...) ou MODELO
    function normalizar(entidade, bruto) {
      const original = U.valorCelula(bruto);
      if (U.vazio(original)) return { original: original ?? null, normalizado: null, regra: 'VAZIO', confianca: 1, status: 'VAZIO' };
      const orig = String(original).trim();
      const u = buscarUsuario(entidade, orig);
      if (u) return { original: orig, normalizado: u.normalized_value, regra: 'ALIAS_USUARIO:' + u.alias_id, confianca: 1, status: 'OK' };
      if (entidade === 'MODELO') return normalizarModelo(orig);
      if (entidade === 'SKILL_LEVEL') {
        const n = normalizarNivel(orig);
        if (n) return { original: orig, ...n };
      }
      const vals = enums[entidade];
      if (!vals) throw new Error('Entidade sem valores no Dicionário: ' + entidade);
      if (entidade !== 'SKILL_LEVEL') {
        const k = U.dobrar(orig), ks = chaveSemEspaco(orig);
        for (const v of vals) {
          if (U.dobrar(v.codigo) === k || chaveSemEspaco(v.codigo) === ks) return { original: orig, normalizado: v.codigo, regra: 'CODIGO_' + entidade, confianca: 1, status: 'OK' };
          const i = v.aliases.findIndex(a => U.dobrar(a) === k || chaveSemEspaco(a) === ks);
          if (i >= 0) return { original: orig, normalizado: v.codigo, regra: `ALIAS_${entidade}_${String(i + 1).padStart(3, '0')}`, confianca: 1, status: 'OK' };
        }
      }
      // Sugestão por similaridade: mostrada para revisão, nunca aplicada sozinha
      let melhor = null;
      for (const v of vals) for (const a of [v.codigo, v.pt, ...v.aliases]) {
        if (!a || String(a).length < 3) continue;
        const sim = U.similaridade(orig, a);
        if (!melhor || sim > melhor.sim) melhor = { sim, codigo: v.codigo };
      }
      if (melhor && melhor.sim >= LIMITE_SUGESTAO)
        return { original: orig, normalizado: null, sugestao: melhor.codigo, regra: 'SIMILARIDADE', confianca: +melhor.sim.toFixed(2), status: 'UNKNOWN' };
      return { original: orig, normalizado: null, regra: 'NAO_RECONHECIDO', confianca: 0, status: 'UNKNOWN' };
    }

    function normalizarModelo(orig) {
      const ks = chaveSemEspaco(orig);
      for (const m of modelos) {
        if (chaveSemEspaco(m.model_id) === ks) return { original: orig, normalizado: m.model_id, regra: 'MODELO_CODIGO', confianca: 1, status: 'OK' };
        if ((m.aliases || []).some(a => chaveSemEspaco(a) === ks)) return { original: orig, normalizado: m.model_id, regra: 'MODELO_ALIAS', confianca: 1, status: 'OK' };
      }
      return { original: orig, normalizado: null, regra: 'MODELO_DESCONHECIDO', confianca: 0, status: 'UNKNOWN' };
    }

    function adicionar(entity_type, original_value, normalized_value, created_by = 'usuario') {
      const existente = buscarUsuario(entity_type, original_value);
      if (existente) { existente.normalized_value = normalized_value; existente.active = true; return existente; }
      const a = { alias_id: `ALS-${String(++seq).padStart(5, '0')}`, entity_type, original_value: String(original_value).trim(),
        normalized_value, created_at: U.agoraISO(), created_by, active: true };
      usuario.push(a);
      return a;
    }
    // Pessoa: alias confirmado pelo usuário (grafia variante → nome canônico). Nunca criado por similaridade sozinho.
    function nomeCanonico(nome) { const u = buscarUsuario('PESSOA', nome); return u ? u.normalized_value : null; }
    function definirAtivo(alias_id, ativo) { const a = usuario.find(x => x.alias_id === alias_id); if (a) a.active = !!ativo; return a; }
    function editar(alias_id, campos) { const a = usuario.find(x => x.alias_id === alias_id); if (a) Object.assign(a, campos); return a; }
    function adicionarModelo(model_id, aliases = [], created_by = 'admin') {
      const id = String(model_id).toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (!id) throw new Error('Código de modelo vazio.');
      if (!modelos.some(m => m.model_id === id)) modelos.push({ model_id: id, nome: id, aliases, criado_por: created_by });
      return id;
    }
    function adicionarValor(entidade, codigo, pt, zh = '') {
      const c = String(codigo).toUpperCase().replace(/\s+/g, '_');
      if (!enums[entidade]) throw new Error('Entidade inexistente: ' + entidade);
      if (!enums[entidade].some(v => v.codigo === c)) enums[entidade].push({ codigo: c, pt: pt || c, zh, aliases: [], extra: true });
      return c;
    }

    return {
      normalizar, nomeCanonico, adicionar, definirAtivo, editar, adicionarModelo, adicionarValor,
      listar: () => usuario.slice(),
      modelos: () => modelos.slice(),
      valores: entidade => (enums[entidade] || []).slice(),
      valoresExtras: () => Object.fromEntries(Object.entries(enums).map(([k, v]) => [k, v.filter(x => x.extra)]).filter(([, v]) => v.length)),
      modelosExtras: () => modelos.filter(m => !D.MODELOS.some(b => b.model_id === m.model_id)),
    };
  }

  return { criarMotor, LIMITE_SUGESTAO };
}, typeof module === 'object' ? module : null);
