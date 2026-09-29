// Quality Score: nota de 0 a 100 calculada só a partir dos dados (reproduzível: mesmos dados, mesma nota).
// Metodologia (pesos):
//   Campos obrigatórios preenchidos   25   células obrigatórias preenchidas e reconhecidas / total
//   IDs / chaves válidos              20   registros com ID gerado e no formato / total
//   Valores reconhecidos              15   valores de listas (enum) reconhecidos / valores de lista preenchidos
//   Duplicidades                      15   1 − registros com chave repetida / total
//   Integridade referencial           15   referências que existem na base de destino / referências
//   Campos recomendados                5   células recomendadas preenchidas / total
//   Ambiguidades                       5   1 − itens ambíguos (datas, interpretações a confirmar) / total
// Base sem registros não recebe nota (status "Não iniciado"), para não ser confundida com erro.
(typeof module === 'object' ? require('../modulo') : C3BModulo)('core/qualidade', ['core/dicionario'], (D) => {
  'use strict';

  const PESOS = [
    ['obrigatorios', 'Campos obrigatórios preenchidos', 25], ['ids', 'IDs / chaves válidos', 20], ['reconhecidos', 'Valores reconhecidos', 15],
    ['duplicidades', 'Duplicidades', 15], ['integridade', 'Integridade referencial', 15], ['recomendados', 'Campos recomendados', 5], ['ambiguidades', 'Ambiguidades', 5],
  ];
  const STATUS = { AUSENTE: 'Ausente', NAO_INICIADO: 'Não iniciado', PARCIAL: 'Parcial', VALIDO: 'Válido', COM_AVISOS: 'Com avisos', BLOQUEADO: 'Bloqueado' };
  const PADRAO_ID = { employee_id: /^EMP-[A-Z0-9-]+$/, operation_id: /^[A-Z0-9]+-[A-Z0-9]+(-[A-Z0-9]+)?-\d{3,}$/, skill_record_id: /^SKL-/, event_id: /^EVT-\d{8}-[0-9A-F]+$/, training_id: /^TRN-/, attendance_id: /^ATT-/ };

  // registros: registros oficiais (objetos com os campos do schema) ou null quando a base não existe
  function calcularQualidade(schemaId, registros, { issues = [], bases = {} } = {}) {
    if (registros == null) return { nota: null, status: 'AUSENTE', rotulo: STATUS.AUSENTE, componentes: [], resumo: [] };
    if (!registros.length) return { nota: null, status: 'NAO_INICIADO', rotulo: STATUS.NAO_INICIADO, componentes: [], resumo: [] };
    const s = D.schema(schemaId), campos = D.camposSaida(schemaId);
    const n = registros.length;
    const cheio = v => v != null && v !== '' && v !== 'UNKNOWN';
    const razao = (a, b) => (b ? a / b : 1);
    const obrig = campos.filter(c => c.required), recom = campos.filter(c => c.recommended && !c.required), enums = campos.filter(c => c.allowed_values);
    let ok = 0; for (const r of registros) for (const c of obrig) if (cheio(r[c.field_id])) ok++;
    const cObrig = razao(ok, n * obrig.length);
    const chave = s.chave[0];
    const padrao = PADRAO_ID[chave];
    const idsOk = chave ? registros.filter(r => r[chave] && (!padrao || padrao.test(r[chave]))).length : n;
    const cIds = razao(idsOk, n);
    let enumCheios = 0, enumOk = 0;
    for (const r of registros) for (const c of enums) { const v = r[c.field_id]; if (v != null && v !== '') { enumCheios++; if (v !== 'UNKNOWN') enumOk++; } }
    const cRec = razao(enumOk, enumCheios);
    const vistos = new Set(); let dup = 0;
    if (chave) for (const r of registros) { const k = r[chave]; if (!k) continue; if (vistos.has(k)) dup++; else vistos.add(k); }
    const cDup = 1 - razao(dup, n);
    const rels = D.RELACOES.filter(x => x.de === schemaId);
    let refs = 0, refsOk = 0;
    for (const rel of rels) {
      const destino = new Set((bases[rel.para] || []).map(x => x[rel.campoPara]));
      for (const r of registros) { if (!r[rel.campo]) continue; refs++; if (destino.has(r[rel.campo])) refsOk++; }
    }
    const cInt = razao(refsOk, refs);
    let recOk = 0; for (const r of registros) for (const c of recom) if (cheio(r[c.field_id])) recOk++;
    const cRecom = razao(recOk, n * recom.length);
    const ambig = issues.filter(i => i.schema === schemaId && ['DATA_AMBIGUA', 'CONFIRMAR_INTERPRETACAO', 'POSSIVEL_DUPLICIDADE', 'LADO_DIVERGENTE'].includes(i.codigo)).length;
    const cAmb = Math.max(0, 1 - ambig / n);
    const val = { obrigatorios: cObrig, ids: cIds, reconhecidos: cRec, duplicidades: cDup, integridade: cInt, recomendados: cRecom, ambiguidades: cAmb };
    const componentes = PESOS.map(([k, nome, peso]) => ({ chave: k, nome, peso, obtido: +(val[k] * peso).toFixed(1), percentual: Math.round(val[k] * 100) }));
    const nota = Math.round(componentes.reduce((t, c) => t + c.obtido, 0));
    const doSchema = issues.filter(i => i.schema === schemaId);
    const bloq = doSchema.some(i => i.severidade === 'BLOCKING');
    const avisos = doSchema.some(i => i.severidade === 'ERROR' || i.severidade === 'WARNING') || enumOk < enumCheios || dup > 0;
    const status = bloq ? 'BLOQUEADO' : nota < 60 ? 'PARCIAL' : avisos ? 'COM_AVISOS' : 'VALIDO';
    return { nota, status, rotulo: STATUS[status], componentes, resumo: resumo(schemaId, registros, { dup, refs, refsOk, chave }) };
  }

  function resumo(schemaId, registros, { dup, refs, refsOk, chave }) {
    const linhas = [];
    const campos = D.camposSaida(schemaId).filter(c => c.origem === 'arquivo' && (c.required || c.recommended));
    const n = registros.length;
    linhas.push({ icone: '✓', nivel: 'ok', texto: `${n} registro(s)` });
    for (const c of campos) {
      const vazios = registros.filter(r => r[c.field_id] == null || r[c.field_id] === '').length;
      const unknown = registros.filter(r => r[c.field_id] === 'UNKNOWN').length;
      if (!vazios && !unknown) linhas.push({ icone: '✓', nivel: 'ok', texto: `${n} ${c.label_pt.toLowerCase()} válido(s)` });
      if (vazios) linhas.push({ icone: c.required ? '✕' : '⚠', nivel: c.required ? 'erro' : 'aviso', texto: `${vazios} ${c.label_pt.toLowerCase()} ausente(s)` });
      if (unknown) linhas.push({ icone: '⚠', nivel: 'aviso', texto: `${unknown} ${c.label_pt.toLowerCase()} não reconhecido(s)` });
    }
    if (dup) linhas.push({ icone: '✕', nivel: 'erro', texto: `${dup} ${chave} duplicado(s)` });
    if (refs) linhas.push(refs === refsOk ? { icone: '✓', nivel: 'ok', texto: 'nenhuma referência quebrada' } : { icone: '✕', nivel: 'erro', texto: `${refs - refsOk} referência(s) quebrada(s)` });
    return linhas;
  }

  // Saúde do pacote inteiro: média das bases que têm nota (bases opcionais não iniciadas não pesam)
  function saudePacote(porBase) {
    const comNota = Object.entries(porBase).filter(([id, q]) => q.nota != null);
    const obrigAusentes = Object.entries(porBase).filter(([id, q]) => q.status === 'AUSENTE' && D.schema(id).obrigatoria && D.schema(id).importavel !== false).length;
    if (!comNota.length) return { nota: null, obrigatoriasAusentes: obrigAusentes };
    const media = comNota.reduce((t, [, q]) => t + q.nota, 0) / comNota.length;
    return { nota: Math.round(media * (1 - 0.1 * obrigAusentes)), obrigatoriasAusentes: obrigAusentes };
  }

  return { calcularQualidade, saudePacote, PESOS, STATUS };
}, typeof module === 'object' ? module : null);
