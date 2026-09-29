// Cadastro sem planilha: linhas digitadas, dados colados do Excel, edição em massa e carga inicial da matriz.
// Tudo passa pela mesma normalização e validação da importação (mesmas regras, mesmo log).
(typeof module === 'object' ? require('../modulo') : C3BModulo)('features/cadastro',
  ['core/util', 'core/dicionario', 'core/auditoria', 'core/mapeamento', 'core/normalizar', 'core/historico', 'features/importacao', 'excel/csv'],
  (U, D, AU, M, N, H, IMP, CSV) => {
  'use strict';

  // Sessão de importação a partir de uma grade já em memória (digitação ou colagem)
  function sessaoDeGrade({ pacote, grade, nome, schemaId = null, usuario = 'usuario', origem = 'CADASTRO_MANUAL', cabecalhoNaPrimeiraLinha = null }) {
    const lote = AU.novoLote({ contadores: pacote.config.contadores, arquivo: { nome: origem, tamanho: 0, hash: '', formato: 'manual' }, executadoPor: usuario, modo: 'IMPORTACAO' });
    AU.transicao(lote, 'ANALYZING', origem);
    const aba = { nome, indice: 0, visivel: true, linhas: grade.length, colunas: Math.max(0, ...grade.map(l => l.length)), dimensao: '', valores: grade.map(l => l.map(v => (v === '' ? null : v))),
      textos: new Map(), mescladas: [], celulasDeMescla: new Set(), formulas: 0, tabelas: [], celulasPreenchidas: 0, celulasVazias: 0 };
    const cab = cabecalhoNaPrimeiraLinha === false ? { linha: -1, linhas: [], cabecalhos: aba.valores[0].map((_, i) => `Coluna ${i + 1}`), inicioDados: 0, confianca: 1 }
      : cabecalhoNaPrimeiraLinha === true ? { linha: 0, linhas: [0], cabecalhos: aba.valores[0].map(v => (v == null ? null : String(v))), inicioDados: 1, confianca: 1 } : M.detectarCabecalho(aba);
    const sessao = { lote, modo: 'IMPORTACAO', pacote, usuario, token: U.tokenCancelamento(), motor: IMP.motorDoPacote(pacote), trabalhos: {}, decisoesDuplicidade: [],
      analise: { arquivo: { nome: origem, formato: 'manual' }, abas: [aba] },
      abas: [{ nome, visivel: true, linhas: aba.linhas, colunas: aba.colunas, cabecalho: cab, deteccao: { ranking: [] }, schema: schemaId, selecionada: true, amostra: aba.valores.slice(0, 8), tipos: [] }] };
    AU.transicao(lote, 'MAPPED', 'grade em memória');
    return sessao;
  }

  // Linhas digitadas no formulário: [{ matricula, nome, ... }] com as chaves = field_id
  function sessaoManual({ pacote, schemaId, linhas, usuario = 'usuario' }) {
    const campos = D.camposMapeaveis(schemaId).map(c => c.field_id).filter(f => linhas.some(l => l[f] != null && l[f] !== ''));
    const grade = [campos].concat(linhas.map(l => campos.map(f => l[f] ?? null)));
    const s = sessaoDeGrade({ pacote, grade, nome: 'CADASTRO_MANUAL', schemaId, usuario, cabecalhoNaPrimeiraLinha: true });
    const t = IMP.mapear(s, 'CADASTRO_MANUAL', schemaId);
    // No formulário, cada coluna já é o campo: mapeamento exato decidido pelo usuário
    t.mapeamento.forEach((m, i) => Object.assign(m, { campo: campos[i], decisao: 'USUARIO', confianca: 1, motivos: ['cadastro manual'] }));
    return s;
  }

  // Texto copiado do Excel (colunas separadas por TAB) ou CSV colado
  function sessaoColada({ pacote, texto, schemaId = null, usuario = 'usuario' }) {
    const sep = texto.includes('\t') ? '\t' : CSV.detectarSeparador(texto);
    const grade = CSV.parse(texto.replace(/\r\n/g, '\n').replace(/\n+$/, ''), sep);
    return sessaoDeGrade({ pacote, grade, nome: 'COLADO', schemaId, usuario, origem: 'DADOS_COLADOS' });
  }

  // ---------- edição em massa ----------
  // Prévia: mostra antes → depois de cada registro, com o valor já normalizado (ex.: "T2" → TURNO_2)
  function previaEmMassa(pacote, schemaId, chaves, campo, valorBruto) {
    const c = D.campo(schemaId, campo);
    if (!c || c.origem !== 'arquivo' || !c.editable) throw new Error(`O campo ${campo} não pode ser editado em massa.`);
    const motor = IMP.motorDoPacote(pacote);
    const n = N.normalizarValor(c, valorBruto, { motor });
    if (n.status === 'UNKNOWN') throw new Error(`"${valorBruto}" não é um valor reconhecido para ${c.label_pt}.` + (n.sugestao ? ` Você quis dizer ${n.sugestao}?` : ''));
    const chave = D.schema(schemaId).chave[0];
    const alvo = new Set(chaves);
    const itens = pacote.bases[schemaId].filter(r => alvo.has(r[chave])).map(r => ({ chave: r[chave], antes: r[campo] ?? null, depois: n.normalizado }));
    return { campo, valor: n.normalizado, regra: n.regra, itens, mudam: itens.filter(i => String(i.antes) !== String(i.depois)).length };
  }
  function aplicarEmMassa(pacote, schemaId, previa, { usuario = 'usuario' } = {}) {
    const chave = D.schema(schemaId).chave[0];
    const alvo = new Map(previa.itens.map(i => [i.chave, i]));
    const agora = U.agoraISO();
    let n = 0;
    for (const r of pacote.bases[schemaId]) if (alvo.has(r[chave]) && String(r[previa.campo]) !== String(previa.valor)) {
      pacote.logs.push({ em: agora, acao: 'EDICAO_EM_MASSA', schema: schemaId, registro: r[chave], campo: previa.campo, de: r[previa.campo] ?? null, para: previa.valor, usuario });
      r[previa.campo] = previa.valor;
      if ('updated_at' in r || D.campo(schemaId, 'updated_at')) { r.updated_at = agora; r.updated_by = usuario; }
      n++;
    }
    return { alterados: n };
  }

  // ---------- carga inicial da matriz (marcação em massa) ----------
  // Cada par pessoa × operação vira registro na Matriz e evento no Histórico (CARGA_INICIAL / mudança).
  function marcarMatriz(pacote, { employee_ids, operation_ids, nivel, titularidade = null, data, responsavel = 'implantador', observacao = null }) {
    const pessoas = new Set(pacote.bases.PEOPLE.map(p => p.employee_id)), ops = new Set(pacote.bases.OPERATIONS.map(o => o.operation_id));
    const faltam = employee_ids.filter(e => !pessoas.has(e)).concat(operation_ids.filter(o => !ops.has(o)));
    if (faltam.length) throw new Error(`Não existem no pacote: ${faltam.slice(0, 5).join(', ')}${faltam.length > 5 ? '…' : ''}`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(data || ''))) throw new Error('Informe a data da habilidade (AAAA-MM-DD).');
    let novos = 0, alterados = 0, eventos = 0;
    for (const e of employee_ids) for (const o of operation_ids) {
      const existia = pacote.bases.SKILLS.some(s => s.employee_id === e && s.operation_id === o);
      const r = H.registrarHabilidade(pacote, { employee_id: e, operation_id: o, new_level: nivel, new_titularity: titularidade, event_date: data,
        responsible_name: responsavel, observation: observacao, event_type: existia ? undefined : 'CARGA_INICIAL', source: 'CARGA_INICIAL_MATRIZ' });
      if (existia) alterados++; else novos++;
      if (r.eventoNovo) eventos++;
    }
    return { novos, alterados, eventos };
  }

  return { sessaoDeGrade, sessaoManual, sessaoColada, previaEmMassa, aplicarEmMassa, marcarMatriz };
}, typeof module === 'object' ? module : null);
