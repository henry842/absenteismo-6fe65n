// Detecção de cabeçalho e mapeamento de colunas para os campos de um schema.
// O mapeamento combina: nome da coluna (normalizado, aliases, tokens, similaridade Jaro-Winkler/Levenshtein),
// análise dos valores da coluna e perfis de importação salvos. Nada é mapeado sozinho abaixo de 80%.
(typeof module === 'object' ? require('../modulo') : C3BModulo)('core/mapeamento', ['core/util', 'core/dicionario', 'core/parsers'], (U, D, P) => {
  'use strict';

  const LIMITES = { AUTO: 0.95, REVISAR: 0.80 };
  const CRITICOS = new Set(['employee_id', 'matricula', 'operation_id', 'modelo', 'estacao', 'lado', 'skill_level', 'ref_matricula', 'ref_estacao', 'ref_modelo', 'new_level']);

  // Todos os termos conhecidos de cabeçalho (qualquer schema), para reconhecer a linha de cabeçalho
  let _termos = null;
  function termosConhecidos() {
    if (_termos) return _termos;
    _termos = new Set();
    for (const s of D.SCHEMAS) for (const c of s.campos.concat(s.entrada || [])) {
      [c.field_id.replace(/_/g, ' '), c.label_pt, ...c.aliases].forEach(t => { const k = U.dobrar(t); if (k) _termos.add(k); });
    }
    for (const n of D.NAO_UTILIZADOS) n.padroes.forEach(p => _termos.add(U.dobrar(p)));
    return _termos;
  }
  const ehTermo = v => { const k = U.dobrar(v); return k && (termosConhecidos().has(k) || [...termosConhecidos()].some(t => t.length > 3 && (k === t || k.startsWith(t + ' ') || k.endsWith(' ' + t)))); };
  const ehTextoDeCabecalho = v => typeof v === 'string' && v.trim() && !/^-?\d+([.,]\d+)?$/.test(v.trim()) && v.length <= 80;

  // Procura a linha (ou duas linhas) de cabeçalho entre as primeiras 40 linhas da aba.
  function detectarCabecalho(aba, { maxLinhas = 40 } = {}) {
    const g = aba.valores;
    if (!g.length) return { linha: -1, linhas: [], confianca: 0, cabecalhos: [], motivo: 'Aba vazia' };
    let melhor = null;
    const limite = Math.min(g.length, maxLinhas);
    for (let r = 0; r < limite; r++) {
      const linha = g[r];
      const preenchidas = linha.filter(v => v != null && v !== '');
      if (preenchidas.length < 2) continue;
      const textos = preenchidas.filter(ehTextoDeCabecalho);
      const distintos = new Set(textos.map(t => U.dobrar(t))).size;
      const acertos = textos.filter(ehTermo).length;
      const razaoTexto = textos.length / preenchidas.length;
      // Linhas seguintes devem parecer dados: mais números/datas ou textos variados
      const abaixo = g.slice(r + 1, r + 6).filter(l => l.some(v => v != null));
      const pareceDados = abaixo.length ? abaixo.filter(l => l.filter(v => v != null).length >= Math.max(1, preenchidas.length * 0.3)).length / abaixo.length : 0;
      const nota = acertos * 3 + distintos * 0.6 + razaoTexto * 2 + pareceDados * 2 - (distintos < textos.length * 0.6 ? 2 : 0);
      if (!melhor || nota > melhor.nota) melhor = { r, nota, acertos, distintos, preenchidas: preenchidas.length };
    }
    if (!melhor) return { linha: -1, linhas: [], confianca: 0, cabecalhos: [], motivo: 'Nenhuma linha com pelo menos 2 células preenchidas' };
    let linhas = [melhor.r];
    // Cabeçalho em duas linhas: a de baixo também é texto e tem termos conhecidos
    const prox = g[melhor.r + 1];
    if (prox) {
      const pv = prox.filter(v => v != null);
      const pt = pv.filter(ehTextoDeCabecalho);
      const pa = pt.filter(ehTermo).length;
      const temMescla = (aba.mescladas || []).some(m => { const [a] = m.split(':'); return +a.replace(/^[A-Z]+/, '') - 1 === melhor.r; });
      if (pv.length && pt.length / pv.length >= 0.8 && pa >= 1 && (temMescla || pa >= melhor.acertos)) linhas = [melhor.r, melhor.r + 1];
    }
    const cabecalhos = [];
    const larg = Math.max(...linhas.map(r => g[r].length));
    for (let c = 0; c < larg; c++) {
      const partes = [];
      for (const r of linhas) { const v = g[r][c]; if (v != null && v !== '' && !partes.includes(String(v).trim())) partes.push(String(v).trim()); }
      cabecalhos.push(partes.join(' / ') || null);
    }
    const confianca = Math.min(1, 0.35 + melhor.acertos * 0.15 + (melhor.distintos >= 3 ? 0.2 : 0));
    return { linha: melhor.r, linhas, confianca: +confianca.toFixed(2), cabecalhos, inicioDados: linhas[linhas.length - 1] + 1 };
  }

  // Colunas da aba a partir de um cabeçalho escolhido: nome, amostra de valores e estatísticas
  function colunasDaAba(aba, cab, { amostra = 60 } = {}) {
    const ini = cab.inicioDados ?? cab.linha + 1;
    const cols = [];
    for (let c = 0; c < cab.cabecalhos.length; c++) {
      const valores = [], textos = [];
      let vazias = 0;
      for (let r = ini; r < aba.valores.length; r++) {
        const v = aba.valores[r][c];
        if (v == null || v === '') { vazias++; continue; }
        if (valores.length < amostra) { valores.push(v); textos.push(aba.textos && aba.textos.get(`${r},${c}`)); }
      }
      cols.push({ indice: c, cabecalho: cab.cabecalhos[c], amostra: valores, textosFormatados: textos, vazias, total: aba.valores.length - ini });
    }
    return cols;
  }

  function campoNaoUtilizado(cabecalho) {
    const k = U.dobrar(cabecalho);
    if (!k) return null;
    for (const n of D.NAO_UTILIZADOS) for (const p of n.padroes) {
      const kp = U.dobrar(p);
      if (k === kp || k.split(' ').includes(kp) && kp.length >= 3 || (kp.includes(' ') && k.includes(kp))) return n.tipo;
    }
    return null;
  }

  // Nota do nome da coluna contra um campo (0..1) e o motivo
  function notaCabecalho(cabecalho, campo) {
    const k = U.dobrar(cabecalho);
    if (!k) return { nota: 0, motivo: 'Coluna sem nome' };
    const termos = [campo.field_id.replace(/^ref_/, '').replace(/_/g, ' '), campo.label_pt, ...campo.aliases].map(U.dobrar).filter(Boolean);
    const ks = k.replace(/ /g, '');
    let melhor = { nota: 0, motivo: '' };
    // Rótulo bilíngue ("Nome 姓名", "Matrícula 工号"): todas as partes são nomes do mesmo campo
    const partes = k.split(' ');
    if (partes.length >= 2) {
      const cobertas = new Set();
      for (const t of termos) { const tt = t.split(' '); for (let i = 0; i + tt.length <= partes.length; i++) if (tt.every((x, j) => partes[i + j] === x)) tt.forEach((_, j) => cobertas.add(i + j)); }
      if (cobertas.size === partes.length && termos.some(t => U.CJK.test(t)) && partes.some(p => U.CJK.test(p))) melhor = { nota: 0.98, motivo: 'rótulo bilíngue (português + chinês)' };
    }
    for (const t of termos) {
      let nota = 0, motivo = '';
      if (k === t) { nota = 0.99; motivo = `nome igual a "${t}"`; }
      else if (ks === t.replace(/ /g, '')) { nota = 0.98; motivo = `igual a "${t}" sem espaços`; }
      else {
        const tk = new Set(k.split(' ')), tt = t.split(' ');
        const contem = tt.every(x => tk.has(x));
        if (contem && tt.length >= 1 && t.length >= 2) {
          const extra = tk.size - tt.length;
          nota = Math.max(0.84, 0.95 - 0.04 * extra); motivo = `contém "${t}"`;
          if (t.length <= 2) nota -= 0.12; // termos muito curtos (ex.: "re", "op") pesam menos
        } else {
          const sim = U.similaridade(k, t);
          if (sim >= 0.75) { nota = sim * 0.95; motivo = `parecido com "${t}" (${Math.round(sim * 100)}%)`; }
        }
      }
      if (nota > melhor.nota) melhor = { nota, motivo };
    }
    return melhor;
  }

  // Ajuste pela análise dos valores (-0.4..+0.05). Campos críticos exigem que os valores concordem.
  function analisarValores(amostra, campo, motor) {
    const vals = amostra.filter(v => v != null && v !== '').slice(0, 40);
    if (!vals.length) return { ajuste: 0, motivo: 'coluna sem valores', concorda: null };
    const frac = f => vals.filter(f).length / vals.length;
    const pareceNome = v => typeof v === 'string' && /[a-zà-ú一-鿿]{2,}/i.test(v) && !/^\d/.test(v);
    const tipo = campo.data_type;
    if (tipo === 'matricula') {
      const r = frac(v => /^[0-9A-Za-z][0-9A-Za-z.\-/]{0,14}$/.test(String(v).trim()) && /\d/.test(String(v)));
      return r >= 0.8 ? { ajuste: 0.04, motivo: `${Math.round(r * 100)}% parecem matrícula`, concorda: true }
        : r >= 0.5 ? { ajuste: -0.05, motivo: `${Math.round(r * 100)}% parecem matrícula`, concorda: null }
        : { ajuste: -0.35, motivo: `só ${Math.round(r * 100)}% parecem matrícula`, concorda: false };
    }
    if (campo.field_id === 'nome' || campo.field_id === 'ref_nome' || campo.field_id === 'responsible_name') {
      const r = frac(pareceNome);
      return r >= 0.7 ? { ajuste: 0.03, motivo: `${Math.round(r * 100)}% parecem nomes`, concorda: true } : { ajuste: -0.3, motivo: 'valores não parecem nomes', concorda: false };
    }
    if (tipo === 'data') {
      const r = frac(v => U.parseData(v).status !== 'INVALIDO');
      return r >= 0.7 ? { ajuste: 0.04, motivo: `${Math.round(r * 100)}% são datas`, concorda: true } : { ajuste: -0.3, motivo: 'valores não são datas', concorda: false };
    }
    if (tipo === 'numero') {
      const r = frac(v => U.parseNumero(v).status === 'OK');
      return r >= 0.7 ? { ajuste: 0.03, motivo: `${Math.round(r * 100)}% são números`, concorda: true } : { ajuste: -0.25, motivo: 'valores não são números', concorda: false };
    }
    if (campo.field_id === 'estacao' || campo.field_id === 'ref_estacao') {
      const r = frac(v => P.parseEstacao(v).station_base);
      return r >= 0.7 ? { ajuste: 0.04, motivo: `${Math.round(r * 100)}% são estações`, concorda: true } : { ajuste: -0.35, motivo: 'valores não parecem estações', concorda: false };
    }
    if (campo.field_id === 'modelo' || campo.field_id === 'ref_modelo') {
      const r = frac(v => motor.normalizar('MODELO', v).status === 'OK');
      return r >= 0.6 ? { ajuste: 0.04, motivo: `${Math.round(r * 100)}% são modelos conhecidos`, concorda: true } : { ajuste: -0.1, motivo: 'modelos não reconhecidos (podem ser novos)', concorda: r > 0 };
    }
    if (campo.allowed_values) {
      const r = frac(v => motor.normalizar(campo.allowed_values, v).status === 'OK');
      if (r >= 0.6) return { ajuste: 0.05, motivo: `${Math.round(r * 100)}% dos valores reconhecidos`, concorda: true };
      if (r === 0) return { ajuste: -0.15, motivo: 'nenhum valor reconhecido', concorda: false };
      return { ajuste: 0, motivo: `${Math.round(r * 100)}% dos valores reconhecidos`, concorda: null };
    }
    return { ajuste: 0, motivo: '', concorda: null };
  }

  // Mapeia as colunas para um schema. Resultado por coluna:
  // { indice, cabecalho, campo, confianca, decisao: AUTO|REVISAR|PERFIL|USUARIO|NAO_MAPEADO|NAO_UTILIZADO, motivos, alternativas }
  function mapearColunas(colunas, schemaId, { motor, perfil = null } = {}) {
    const campos = D.camposMapeaveis(schemaId);
    const candidatos = [];
    const resultado = colunas.map(col => ({ indice: col.indice, cabecalho: col.cabecalho, campo: null, confianca: 0, decisao: 'NAO_MAPEADO', motivos: [], alternativas: [] }));
    for (const [i, col] of colunas.entries()) {
      const naoUsado = campoNaoUtilizado(col.cabecalho);
      if (naoUsado) {
        Object.assign(resultado[i], { decisao: 'NAO_UTILIZADO', tipoNaoUtilizado: naoUsado, motivos: [`${naoUsado}: campo não utilizado pelo schema C3B (minimização de dados). Fica de fora por padrão.`] });
        continue;
      }
      // Perfil salvo tem prioridade para a mesma coluna
      const doPerfil = perfil && perfil.column_mapping && perfil.column_mapping[U.dobrar(col.cabecalho)];
      if (doPerfil && campos.some(c => c.field_id === doPerfil)) { candidatos.push({ i, campo: doPerfil, nota: 1, motivos: [`perfil "${perfil.profile_name}"`], decisao: 'PERFIL' }); continue; }
      if (doPerfil === '__IGNORAR__') { Object.assign(resultado[i], { decisao: 'IGNORADO', motivos: [`ignorada pelo perfil "${perfil.profile_name}"`] }); continue; }
      for (const campo of campos) {
        const h = notaCabecalho(col.cabecalho, campo);
        if (h.nota < 0.6) continue;
        const v = analisarValores(col.amostra, campo, motor);
        let nota = Math.min(0.99, h.nota + v.ajuste);
        const motivos = [h.motivo, v.motivo].filter(Boolean);
        if (CRITICOS.has(campo.field_id) && v.concorda === false) { nota = Math.min(nota, 0.79); motivos.push('campo crítico: valores não confirmam'); }
        candidatos.push({ i, campo: campo.field_id, nota, motivos });
      }
    }
    // Atribuição gulosa: melhor nota primeiro, cada campo e cada coluna uma vez só
    candidatos.sort((a, b) => b.nota - a.nota);
    const camposUsados = new Set(), colsUsadas = new Set();
    for (const c of candidatos) {
      const r = resultado[c.i];
      if (!r.alternativas.some(a => a.campo === c.campo)) r.alternativas.push({ campo: c.campo, confianca: +c.nota.toFixed(2) });
      if (colsUsadas.has(c.i) || camposUsados.has(c.campo)) continue;
      if (c.nota < LIMITES.REVISAR) continue;
      colsUsadas.add(c.i); camposUsados.add(c.campo);
      Object.assign(r, { campo: c.campo, confianca: +c.nota.toFixed(2), motivos: c.motivos,
        decisao: c.decisao || (c.nota >= LIMITES.AUTO ? 'AUTO' : 'REVISAR') });
    }
    for (const r of resultado) r.alternativas = r.alternativas.sort((a, b) => b.confianca - a.confianca).slice(0, 4);
    return resultado;
  }

  // Resumo para a tela: campos obrigatórios que ficaram sem coluna
  function camposFaltando(mapeamento, schemaId, valoresFixos = {}) {
    const mapeados = new Set(mapeamento.filter(m => m.campo).map(m => m.campo).concat(Object.keys(valoresFixos)));
    const precisa = D.camposMapeaveis(schemaId).filter(c => c.required && c.origem === 'arquivo');
    return precisa.filter(c => !mapeados.has(c.field_id)).map(c => c.field_id);
  }

  return { detectarCabecalho, colunasDaAba, mapearColunas, camposFaltando, campoNaoUtilizado, notaCabecalho, ehTermo, LIMITES, CRITICOS };
}, typeof module === 'object' ? module : null);
