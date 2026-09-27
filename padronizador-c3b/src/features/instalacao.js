// Pacote Oficial de Bases C3B: estado em memória, criação da instalação, gravação segura
// (ler atual → comparar → validar → backup → gravar → reler → verificar → log), diagnóstico de pasta,
// versões (BACKUP) e restauração.
(typeof module === 'object' ? require('../modulo') : C3BModulo)('features/instalacao',
  ['core/util', 'core/dicionario', 'core/ids', 'core/validar', 'core/qualidade', 'core/conflitos', 'excel/escritor'],
  (U, D, ID, V, Q, CF, W) => {
  'use strict';

  const BASES = ['PEOPLE', 'OPERATIONS', 'SKILLS', 'HISTORY', 'TRAINING', 'ATTENDANCE'];
  const PASTAS = ['BACKUP', 'EXPORTACOES', 'RELATORIOS', 'LOGS'];
  const junta = (raiz, ...p) => U.caminhoSeguro(...[raiz, ...p].filter(Boolean));

  function criarPacote(meta = {}, usuario = 'implantador') {
    const agora = U.agoraISO();
    const manifesto = { schema_version: D.SCHEMA_VERSION, system_version: D.SYSTEM_VERSION, empresa: meta.empresa || '', unidade: meta.unidade || '',
      area: meta.area || '', secao: meta.secao || '', equipe: meta.equipe || '', lider: meta.lider || '', supervisor: meta.supervisor || '',
      turno_padrao: meta.turno_padrao || '', created_at: agora, updated_at: agora, created_by: usuario };
    manifesto.installation_id = meta.installation_id || ID.installationId(manifesto);
    return {
      manifesto,
      bases: Object.fromEntries(BASES.map(b => [b, []])),
      config: { aliases: [], perfis: [], modelosExtras: meta.modelos ? meta.modelos.map(m => ({ model_id: m, nome: m, aliases: [] })) : [], valoresExtras: {}, decisoes: [], contadores: {},
        sync: Object.fromEntries(D.SCHEMAS.map(s => [s.id, s.master_mode])), geral: {} },
      arquivos: {}, lotes: [], logs: [],
    };
  }

  // ---------- 07_Configuracoes: estado ⇄ abas ----------
  function configParaAbas(pacote) {
    const c = pacote.config;
    return {
      GERAL: [
        { chave: 'installation_id', valor: pacote.manifesto.installation_id, descricao: 'Identificador da instalação' },
        { chave: 'schema_version', valor: D.SCHEMA_VERSION, descricao: 'Versão dos schemas' },
        { chave: 'contadores_lote', valor: JSON.stringify(c.contadores || {}), descricao: 'Sequência dos lotes de importação por dia' },
        { chave: 'valores_extras', valor: JSON.stringify(c.valoresExtras || {}), descricao: 'Valores criados pelo administrador nas listas do Dicionário' },
        ...Object.entries(c.geral || {}).map(([chave, valor]) => ({ chave, valor, descricao: '' })),
      ],
      MODELOS: D.MODELOS.concat(c.modelosExtras || []).map(m => ({ model_id: m.model_id, nome: m.nome || m.model_id, aliases: (m.aliases || []).join('|'), ativo: 'SIM' })),
      TURNOS: D.ENUMS.TURNO.concat((c.valoresExtras || {}).TURNO || []).map(t => ({ codigo: t.codigo, nome_pt: t.pt, nome_zh: t.zh, aliases: (t.aliases || []).join('|') })),
      SKILL_LEVELS: D.NIVEIS,
      ALIASES: c.aliases || [],
      IMPORT_PROFILES: (c.perfis || []).map(p => ({ ...p, header_row: p.header_row ?? '', column_mapping: p.column_mapping, normalization_rules: p.normalization_rules, fixed_values: p.fixed_values })),
      VALIDATION_RULES: [
        { rule_id: 'VR-001', schema: 'TODOS', field: '(obrigatórios)', severity: 'ERROR', description: 'Campo obrigatório vazio' },
        { rule_id: 'VR-002', schema: 'TODOS', field: '(listas)', severity: 'WARNING', description: 'Valor não reconhecido fica UNKNOWN e pede revisão' },
        { rule_id: 'VR-003', schema: 'TODOS', field: '(chave)', severity: 'ERROR', description: 'Chave duplicada' },
        { rule_id: 'VR-004', schema: 'SKILLS/HISTORY/TRAINING/ATTENDANCE', field: 'employee_id/operation_id', severity: 'BLOCKING', description: 'Referência inexistente em outra base' },
        { rule_id: 'VR-005', schema: 'TODOS', field: '(datas)', severity: 'WARNING', description: 'Data ambígua (dia/mês × mês/dia)' },
      ],
      COVERAGE_RULES: [{ rule_id: 'CR-001', descricao: 'Mínimo de pessoas L/U por operação ativa', valor: (c.geral || {}).minimo_cobertura || '' }],
      SYNC_SETTINGS: D.SCHEMAS.map(s => ({ schema: s.id, base_id: s.base, master_mode: (c.sync || {})[s.id] || s.master_mode, descricao: s.nome_pt })),
      DECISOES: (c.decisoes || []).map((d, i) => ({ decision_id: d.decision_id || `DEC-${String(i + 1).padStart(5, '0')}`, ...d })),
    };
  }
  function abasParaConfig(abas) {
    const json = v => { if (v == null || v === '') return {}; if (typeof v === 'object') return v; try { return JSON.parse(v); } catch (e) { return {}; } };
    const geral = {};
    let contadores = {}, valoresExtras = {};
    for (const l of abas.GERAL || []) {
      if (l.chave === 'contadores_lote') contadores = json(l.valor);
      else if (l.chave === 'valores_extras') valoresExtras = json(l.valor);
      else if (!['installation_id', 'schema_version'].includes(l.chave)) geral[l.chave] = l.valor;
    }
    const base = new Set(D.MODELOS.map(m => m.model_id));
    return {
      aliases: (abas.ALIASES || []).map(a => ({ ...a, active: !['NAO', 'FALSE', 'false', '0', false].includes(a.active) })),
      perfis: (abas.IMPORT_PROFILES || []).map(p => ({ ...p, header_row: p.header_row === '' ? null : +p.header_row, column_mapping: json(p.column_mapping), normalization_rules: json(p.normalization_rules), fixed_values: json(p.fixed_values), version: +p.version || 1 })),
      modelosExtras: (abas.MODELOS || []).filter(m => !base.has(m.model_id)).map(m => ({ model_id: m.model_id, nome: m.nome, aliases: String(m.aliases || '').split('|').filter(Boolean) })),
      valoresExtras,
      decisoes: abas.DECISOES || [],
      contadores,
      sync: Object.fromEntries((abas.SYNC_SETTINGS || []).map(s => [s.schema, s.master_mode])),
      geral,
    };
  }

  // ---------- gravação segura de uma base ----------
  function nomeBackup(arquivo, dataVersion) {
    return arquivo.replace(/\.xlsx$/i, '') + `__${U.carimbo()}__v${dataVersion}.xlsx`;
  }
  // Nunca sobrescreve um backup: se já existe um com o mesmo nome (mesmo segundo), acrescenta _2, _3...
  async function caminhoBackupLivre(storage, raiz, arquivo, dataVersion) {
    const base = nomeBackup(arquivo, dataVersion);
    let c = junta(raiz, 'BACKUP', base), n = 1;
    while (await storage.fileExists(c)) c = junta(raiz, 'BACKUP', base.replace(/\.xlsx$/, `_${++n}.xlsx`));
    return c;
  }

  async function lerSeExistir(storage, caminho, opcoes) {
    if (!storage.suportaLeitura) return { existe: null };
    if (!(await storage.fileExists(caminho))) return { existe: false };
    const bytes = await storage.readFile(caminho);
    try { return { existe: true, bytes, lido: await W.lerArquivoOficial(bytes, opcoes) }; }
    catch (e) { return { existe: true, bytes, erroLeitura: e.message }; }
  }

  // Grava uma base do pacote no armazenamento. Só marca cada etapa como feita se ela realmente aconteceu.
  async function gravarBase(storage, raiz, pacote, schemaId, { usuario = 'padronizador', batchId = '', override = null, ExcelJS = null } = {}) {
    const s = D.schema(schemaId);
    const caminho = junta(raiz, s.arquivo);
    const etapas = [];
    const etapa = (nome, ok, detalhe, pulado = false) => { etapas.push({ etapa: nome, ok, detalhe, pulado }); return ok; };
    const opcoes = { ExcelJS };
    // 1. ler o atual
    const atual = await lerSeExistir(storage, caminho, opcoes);
    const versaoAtual = atual.lido && atual.lido.meta ? +atual.lido.meta.data_version || 0 : (pacote.arquivos[schemaId] || {}).data_version || 0;
    etapa('Ler arquivo atual', true, atual.existe === null ? 'armazenamento não permite leitura (modo downloads)' : atual.existe ? `v${versaoAtual}, ${(atual.lido && atual.lido.registros || []).length} registros` : 'ainda não existe', atual.existe === null);
    // 2. comparar
    const chave = s.chave[0];
    const novos = pacote.bases[schemaId] || [];
    const comp = chave ? CF.compararVersoes(atual.lido && atual.lido.registros || [], novos, chave) : null;
    etapa('Comparar', true, comp ? `${comp.adicionados.length} adicionados · ${comp.alterados.length} alterados · ${comp.inalterados.length} inalterados · ${comp.ausentesNoNovo.length} ausentes no novo` : '—');
    if (comp && schemaId === 'HISTORY' && comp.ausentesNoNovo.length)
      return falhar(`O histórico é só de acréscimo: ${comp.ausentesNoNovo.length} evento(s) do arquivo atual não estão no pacote. Nada foi gravado.`);
    // 3. validar
    const issues = V.validarPacote(pacote.bases).filter(i => i.schema === schemaId);
    const bloqueios = issues.filter(i => i.severidade === 'BLOCKING');
    if (bloqueios.length && !(override && override.motivo)) return falhar(`${bloqueios.length} bloqueio(s): ${bloqueios[0].mensagem}`, 'Validar');
    etapa('Validar', true, bloqueios.length ? `${bloqueios.length} bloqueio(s) liberado(s) por decisão administrativa: "${override.motivo}"` : 'sem bloqueios');
    // 4. backup
    let backup = null;
    if (atual.existe) {
      if (storage.suportaDiretorios) {
        await storage.createDirectory(junta(raiz, 'BACKUP'));
        backup = await caminhoBackupLivre(storage, raiz, s.arquivo, versaoAtual);
        await storage.backupFile(caminho, backup);
        const confere = await storage.fileExists(backup);
        if (!confere) return falhar('O backup não foi encontrado depois de copiado. Nada foi gravado.', 'Backup');
        etapa('Backup', true, backup);
      } else etapa('Backup', false, 'armazenamento sem pastas: backup automático indisponível', true);
    } else etapa('Backup', true, atual.existe === null ? 'indisponível no modo downloads' : 'não havia arquivo anterior', true);
    // 5. gravar
    const dataVersion = versaoAtual + 1;
    const meta = { data_version: dataVersion, installation_id: pacote.manifesto.installation_id, import_batch_id: batchId, updated_by: usuario, sync_origin: 'PADRONIZADOR', restored_from: override && override.restored_from };
    const bytes = await W.gerarBaseOficial(schemaId, novos, meta, { ExcelJS });
    // 6. verificar antes de entregar (sempre) e depois de gravar (quando dá para reler)
    const pre = await W.verificarArquivo(bytes, schemaId, novos, opcoes);
    if (!pre.ok) return falhar('O arquivo gerado não passou na verificação: ' + pre.checks.filter(c => !c.ok).map(c => `${c.nome} (${c.detalhe})`).join('; '), 'Gerar XLSX');
    etapa('Gerar XLSX', true, `${bytes.length} bytes, ${novos.length} registros`);
    await storage.writeFile(caminho, bytes);
    etapa('Gravar', true, storage.id === 'download' ? `${s.arquivo} enviado para os downloads do navegador` : caminho);
    if (storage.suportaLeitura) {
      const relido = await storage.readFile(caminho);
      const pos = await W.verificarArquivo(relido, schemaId, novos, opcoes);
      if (!pos.ok) return falhar('Arquivo gravado não confere ao reler: ' + pos.checks.filter(c => !c.ok).map(c => c.nome).join(', '), 'Reler e verificar');
      etapa('Reler e verificar', true, pos.checks.map(c => c.nome).join(' · '));
    } else etapa('Reler e verificar', true, 'verificado em memória antes do download (o navegador não permite reler a pasta de downloads)', true);
    const hash = await U.sha256(bytes);
    const q = Q.calcularQualidade(schemaId, novos, { issues, bases: pacote.bases });
    pacote.arquivos[schemaId] = { base_id: s.id, base_name: s.nome_pt, file_name: s.arquivo, schema_version: D.SCHEMA_VERSION, data_version: dataVersion,
      required: s.obrigatoria, status: q.status, record_count: novos.length, last_validated_at: U.agoraISO(), hash, content_hash: W.hashConteudo(schemaId, novos), last_modified: U.agoraISO() };
    // 7. log
    const log = { em: U.agoraISO(), acao: 'GRAVAR_BASE', schema: schemaId, arquivo: caminho, data_version: dataVersion, hash, backup, batch: batchId, usuario,
      comparacao: comp && { adicionados: comp.adicionados.length, alterados: comp.alterados.length, inalterados: comp.inalterados.length, ausentes: comp.ausentesNoNovo.length }, override: override || null };
    pacote.logs.push(log);
    etapa('Registrar log', true, 'log em memória' + (await gravarLog(storage, raiz, log) ? ' e em LOGS/' : ''));
    return { ok: true, schemaId, caminho, dataVersion, hash, backup, etapas, comparacao: comp, bytes };

    function falhar(msg, nome = 'Comparar') { etapa(nome, false, msg); return { ok: false, schemaId, caminho, etapas, erro: msg }; }
  }

  async function gravarLog(storage, raiz, log) {
    if (!storage.suportaDiretorios || storage.id === 'download') return false;
    await storage.createDirectory(junta(raiz, 'LOGS'));
    await storage.writeFile(junta(raiz, 'LOGS', `log_${U.carimbo()}_${log.schema}_${U.hashCurto(JSON.stringify(log), 6)}.json`), new TextEncoder().encode(JSON.stringify(log, null, 2)));
    return true;
  }

  async function gravarArquivoSimples(storage, raiz, pacote, schemaId, gerar, opcoes) {
    const s = D.schema(schemaId);
    const caminho = junta(raiz, s.arquivo);
    const atual = await lerSeExistir(storage, caminho, opcoes);
    const versaoAtual = atual.lido && atual.lido.meta ? +atual.lido.meta.data_version || 0 : (pacote.arquivos[schemaId] || {}).data_version || 0;
    let backup = null;
    if (atual.existe && storage.suportaDiretorios) { await storage.createDirectory(junta(raiz, 'BACKUP')); backup = await caminhoBackupLivre(storage, raiz, s.arquivo, versaoAtual); await storage.backupFile(caminho, backup); }
    const bytes = await gerar(versaoAtual + 1);
    const pre = await W.verificarArquivo(bytes, schemaId, [], opcoes);
    if (!pre.ok) return { ok: false, erro: 'verificação falhou', etapas: pre.checks };
    await storage.writeFile(caminho, bytes);
    let relidoOk = null;
    if (storage.suportaLeitura) relidoOk = (await W.verificarArquivo(await storage.readFile(caminho), schemaId, [], opcoes)).ok;
    const hash = await U.sha256(bytes);
    pacote.arquivos[schemaId] = { base_id: s.id, base_name: s.nome_pt, file_name: s.arquivo, schema_version: D.SCHEMA_VERSION, data_version: versaoAtual + 1, required: s.obrigatoria,
      status: 'VALIDO', record_count: 0, last_validated_at: U.agoraISO(), hash, last_modified: U.agoraISO() };
    return { ok: relidoOk !== false, caminho, backup, dataVersion: versaoAtual + 1, hash, relido: relidoOk, bytes };
  }

  // Grava bases selecionadas + Configurações + Manifesto (sempre por último, com os hashes).
  // modo: 'COMPLETO' | 'AUSENTES' (só arquivos que não existem) | 'ATUALIZAR' (lista em "bases")
  async function gravarPacote(storage, raiz, pacote, { bases = BASES, modo = 'COMPLETO', usuario = 'padronizador', batchId = '', override = null, ExcelJS = null } = {}) {
    const resultados = [];
    // Nunca mistura instalações: se a pasta já tem o Manifesto de OUTRA instalação, não grava nada
    if (storage.suportaLeitura) {
      const man = junta(raiz, D.schema('MANIFEST').arquivo);
      if (await storage.fileExists(man)) {
        let outro = null;
        try { const lido = await W.lerArquivoOficial(await storage.readFile(man), { ExcelJS }); outro = lido.manifesto && lido.manifesto.installation_id; } catch (e) { outro = null; }
        if (outro && outro !== pacote.manifesto.installation_id)
          return { ok: false, resultados, erro: `A pasta "${raiz || '(raiz)'}" já contém outra instalação (${outro}). Nada foi gravado. Escolha outra subpasta em Configurações ou abra essa instalação.` };
      }
    }
    if (storage.suportaDiretorios) { await storage.createDirectory(raiz); for (const p of PASTAS) await storage.createDirectory(junta(raiz, p)); }
    let alvo = modo === 'COMPLETO' ? BASES : bases;
    if (modo === 'AUSENTES') {
      if (!storage.suportaLeitura) throw new Error('Para gerar só os arquivos ausentes é preciso um armazenamento que leia a pasta (pasta escolhida ou Bridge).');
      const faltam = [];
      for (const b of BASES) if (!(await storage.fileExists(junta(raiz, D.schema(b).arquivo)))) faltam.push(b);
      alvo = faltam;
    }
    for (const b of alvo) resultados.push(await gravarBase(storage, raiz, pacote, b, { usuario, batchId, override, ExcelJS }));
    const falhas = resultados.filter(r => !r.ok);
    if (falhas.length) return { ok: false, resultados, erro: `${falhas.length} base(s) não gravada(s): ${falhas.map(f => `${D.schema(f.schemaId).base} (${f.erro})`).join('; ')}` };
    const cfg = await gravarArquivoSimples(storage, raiz, pacote, 'CONFIG', v => W.gerarConfiguracoes(configParaAbas(pacote), { ExcelJS, data_version: v, installation_id: pacote.manifesto.installation_id }), { ExcelJS });
    pacote.manifesto.updated_at = U.agoraISO();
    const arquivos = D.SCHEMAS.filter(s => s.id !== 'MANIFEST').map(s => ({ ...(pacote.arquivos[s.id] || { base_id: s.id, base_name: s.nome_pt, file_name: s.arquivo, schema_version: D.SCHEMA_VERSION, required: s.obrigatoria, status: 'AUSENTE' }) }));
    const man = await gravarArquivoSimples(storage, raiz, pacote, 'MANIFEST', v => W.gerarManifesto(pacote.manifesto, arquivos, { ExcelJS, data_version: v }), { ExcelJS });
    return { ok: cfg.ok && man.ok, resultados, configuracao: cfg, manifesto: man };
  }

  async function criarInstalacao(storage, raiz, meta, { usuario = 'implantador', ExcelJS = null, pacote = null } = {}) {
    const p = pacote || criarPacote(meta, usuario);
    const r = await gravarPacote(storage, raiz, p, { modo: 'COMPLETO', usuario, ExcelJS });
    return { ...r, pacote: p };
  }

  // ---------- leitura e diagnóstico de uma pasta ----------
  async function carregarInstalacao(storage, raiz = '', { ExcelJS = null } = {}) {
    if (!storage.suportaLeitura) throw new Error('Este armazenamento não permite ler a pasta. Escolha uma pasta (Chrome/Edge) ou use o Bridge local.');
    const lista = (await storage.listFiles(raiz)).filter(f => f.tipo === 'arquivo' && /\.(xlsx|xlsm)$/i.test(f.nome) && !f.nome.startsWith('~$'));
    const achados = {}, naoReconhecidos = [], erros = [];
    for (const f of lista) {
      const caminho = junta(raiz, f.nome);
      try {
        const bytes = await storage.readFile(caminho);
        const lido = await W.lerArquivoOficial(bytes, { ExcelJS });
        if (!lido.reconhecido) { naoReconhecidos.push(f.nome); continue; }
        const hash = await U.sha256(bytes);
        // arquivo oficial com o nome padrão tem prioridade sobre cópias renomeadas
        const atual = achados[lido.schemaId];
        if (!atual || f.nome === D.schema(lido.schemaId).arquivo) achados[lido.schemaId] = { ...lido, arquivo: f.nome, caminho, hash, tamanho: f.tamanho, modificado: f.modificado };
      } catch (e) { erros.push({ arquivo: f.nome, erro: e.message }); }
    }
    const man = achados.MANIFEST;
    const pacote = criarPacote(man ? man.manifesto : {}, man ? man.manifesto.created_by : 'implantador');
    if (man) Object.assign(pacote.manifesto, man.manifesto);
    if (achados.CONFIG) pacote.config = { ...pacote.config, ...abasParaConfig(achados.CONFIG.abas) };
    for (const b of BASES) if (achados[b]) pacote.bases[b] = achados[b].registros;
    const doManifesto = man ? Object.fromEntries(man.arquivos.map(a => [a.base_id, a])) : {};
    for (const [id, a] of Object.entries(achados)) pacote.arquivos[id] = { ...(doManifesto[id] || {}), file_name: a.arquivo, data_version: +a.meta.data_version || 1, hash_atual: a.hash, record_count: (a.registros || []).length };
    return { pacote, achados, naoReconhecidos, erros, doManifesto };
  }

  async function diagnosticarInstalacao(storage, raiz = '', opcoes = {}) {
    const c = await carregarInstalacao(storage, raiz, opcoes);
    const { pacote, achados, doManifesto } = c;
    const issuesPacote = V.validarPacote(pacote.bases);
    const bases = [];
    for (const s of D.SCHEMAS) {
      const a = achados[s.id];
      const linha = { schema: s.id, base: s.base, nome: s.nome_pt, arquivoEsperado: s.arquivo, obrigatoria: s.obrigatoria, alertas: [] };
      if (!a) { Object.assign(linha, { encontrado: false, status: s.id === 'ATTENDANCE' || !s.obrigatoria ? 'NAO_INICIADO' : 'AUSENTE', nota: null }); bases.push(linha); continue; }
      linha.encontrado = true; linha.arquivo = a.arquivo; linha.dataVersion = +a.meta.data_version || 1;
      if (a.arquivo !== s.arquivo) linha.alertas.push({ nivel: 'aviso', texto: `Arquivo com outro nome (${a.arquivo}); reconhecido pelo conteúdo.` });
      const m = doManifesto[s.id];
      if (m && m.hash && m.hash !== a.hash) linha.alertas.push({ nivel: 'aviso', texto: 'Alterado fora do Padronizador desde a última gravação (hash diferente do Manifesto).' });
      if (s.id === 'MANIFEST' || s.id === 'CONFIG') { Object.assign(linha, { status: 'VALIDO', nota: null, registros: null }); bases.push(linha); continue; }
      const regs = a.registros || [];
      const q = Q.calcularQualidade(s.id, regs, { issues: issuesPacote, bases: pacote.bases });
      Object.assign(linha, { registros: regs.length, nota: q.nota, status: q.status, qualidade: q });
      if (s.id === 'OPERATIONS') { const semTakt = regs.filter(r => r.takt_seconds == null).length; if (semTakt) linha.alertas.push({ nivel: 'aviso', texto: `${semTakt} sem takt` }); }
      if (s.id === 'HISTORY' && regs.length) {
        const pessoas = new Set(regs.map(r => r.employee_id)).size, total = pacote.bases.PEOPLE.length;
        linha.coberturaPessoas = `${pessoas} de ${total} colaboradores`;
        if (total && pessoas < total) { linha.alertas.push({ nivel: 'aviso', texto: `parcial: ${pessoas} colaboradores com histórico (de ${total})` }); if (linha.status === 'VALIDO' || linha.status === 'COM_AVISOS') linha.status = 'PARCIAL'; }
      }
      const quebradas = issuesPacote.filter(i => i.schema === s.id && i.severidade === 'BLOCKING');
      if (quebradas.length) linha.alertas.push({ nivel: 'erro', texto: `${quebradas.length} referência(s) quebrada(s)` });
      bases.push(linha);
    }
    const saude = Q.saudePacote(Object.fromEntries(bases.filter(b => !['MANIFEST', 'CONFIG'].includes(b.schema)).map(b => [b.schema, { nota: b.nota, status: b.status }])));
    const ausentes = bases.filter(b => !b.encontrado).map(b => b.schema);
    return { reconhecida: !!achados.MANIFEST, installation_id: pacote.manifesto.installation_id, manifesto: pacote.manifesto, bases, saude, ausentes,
      naoReconhecidos: c.naoReconhecidos, erros: c.erros, issues: issuesPacote, pacote };
  }

  // ---------- versões ----------
  async function listarVersoes(storage, raiz, schemaId, opcoes = {}) {
    const s = D.schema(schemaId);
    const prefixo = s.arquivo.replace(/\.xlsx$/i, '') + '__';
    const versoes = [];
    for (const f of await storage.listFiles(junta(raiz, 'BACKUP'))) {
      if (f.tipo !== 'arquivo' || !f.nome.startsWith(prefixo)) continue;
      const m = f.nome.match(/__(\d{8}_\d{6})__v(\d+)(?:_\d+)?\.xlsx$/);
      versoes.push({ versao: m ? +m[2] : null, carimbo: m ? m[1] : '', arquivo: junta(raiz, 'BACKUP', f.nome), nome: f.nome, tamanho: f.tamanho, atual: false });
    }
    const atual = junta(raiz, s.arquivo);
    if (await storage.fileExists(atual)) {
      const lido = await W.lerArquivoOficial(await storage.readFile(atual), opcoes);
      versoes.push({ versao: +lido.meta.data_version || null, arquivo: atual, nome: s.arquivo, atual: true, registros: (lido.registros || []).length });
    }
    return versoes.sort((a, b) => (a.versao || 0) - (b.versao || 0) || String(a.carimbo).localeCompare(String(b.carimbo)));
  }
  async function compararArquivos(storage, caminhoA, caminhoB, opcoes = {}) {
    const [a, b] = [await W.lerArquivoOficial(await storage.readFile(caminhoA), opcoes), await W.lerArquivoOficial(await storage.readFile(caminhoB), opcoes)];
    if (a.schemaId !== b.schemaId) throw new Error('Os arquivos são de bases diferentes.');
    const chave = D.schema(a.schemaId).chave[0];
    const c = CF.compararVersoes(a.registros, b.registros, chave);
    return { schemaId: a.schemaId, versaoA: a.meta.data_version, versaoB: b.meta.data_version, ...c };
  }
  // Restaura uma versão: faz backup do estado atual, grava o conteúdo antigo como nova versão e verifica.
  async function restaurarVersao(storage, raiz, pacote, schemaId, caminhoBackup, { usuario = 'implantador', ExcelJS = null } = {}) {
    const antigo = await W.lerArquivoOficial(await storage.readFile(caminhoBackup), { ExcelJS });
    if (antigo.schemaId !== schemaId) throw new Error(`O arquivo escolhido é da base ${antigo.schemaId}, não ${schemaId}.`);
    const anterior = pacote.bases[schemaId];
    pacote.bases[schemaId] = antigo.registros;
    const r = await gravarBase(storage, raiz, pacote, schemaId, { usuario, ExcelJS, override: { motivo: `restauração da v${antigo.meta.data_version}`, restored_from: `v${antigo.meta.data_version}` } });
    if (!r.ok) pacote.bases[schemaId] = anterior;
    return { ...r, restauradaDe: +antigo.meta.data_version };
  }

  return { BASES, PASTAS, criarPacote, configParaAbas, abasParaConfig, gravarBase, gravarPacote, criarInstalacao, carregarInstalacao, diagnosticarInstalacao, listarVersoes, compararArquivos, restaurarVersao, nomeBackup };
}, typeof module === 'object' ? module : null);
