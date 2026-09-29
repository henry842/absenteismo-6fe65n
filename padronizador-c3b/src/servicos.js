// API pública do Padronizador C3B. É o que o sistema principal C3B deve chamar no futuro.
// Não depende do HTML: roda no navegador (window.C3B.servicos) e no Node (require('./src/servicos.js')).
(typeof module === 'object' ? require('./modulo') : C3BModulo)('servicos',
  ['core/util', 'core/dicionario', 'core/aliases', 'core/mapeamento', 'core/perfis', 'core/normalizar', 'core/validar', 'core/qualidade',
    'core/conflitos', 'core/historico', 'excel/leitor', 'excel/escritor', 'features/instalacao', 'features/importacao', 'features/cadastro', 'features/relatorios', 'storage/adaptadores', 'excel/byd_drawings', 'excel/byd_matriz', 'excel/byd_base', 'core/pessoas', 'features/ajustes'],
  (U, D, AL, M, PF, N, V, Q, CF, H, L, W, INST, IMP, CAD, REL, ST, BDR, BYM, BYB, PSS, AJ) => {
  'use strict';
  return {
    // leitura e interpretação
    analyzeWorkbook: (bytes, nome, opcoes) => L.analisarArquivo(bytes, nome, opcoes),
    detectHeader: aba => M.detectarCabecalho(aba),
    detectSchema: (aba, cabecalho, opcoes) => PF.detectarSchema(aba, cabecalho || M.detectarCabecalho(aba), opcoes),
    mapColumns: (aba, cabecalho, schemaId, opcoes) => M.mapearColunas(M.colunasDaAba(aba, cabecalho), schemaId, opcoes),
    normalizeDataset: parametros => N.normalizarAba(parametros),
    validateDataset: (schemaId, registros, opcoes) => V.validarDataset(schemaId, registros, opcoes),
    validatePackage: bases => V.validarPacote(bases),
    calculateQualityScore: (schemaId, registros, opcoes) => Q.calcularQualidade(schemaId, registros, opcoes),
    // geração e instalação
    generateOfficialWorkbook: (schemaId, registros, meta, opcoes) => W.gerarBaseOficial(schemaId, registros, meta, opcoes),
    verifyWorkbook: (bytes, schemaId, registros, opcoes) => W.verificarArquivo(bytes, schemaId, registros, opcoes),
    readOfficialWorkbook: (bytes, opcoes) => W.lerArquivoOficial(bytes, opcoes),
    createInstallation: (storage, raiz, meta, opcoes) => INST.criarInstalacao(storage, raiz, meta, opcoes),
    diagnoseInstallation: (storage, raiz, opcoes) => INST.diagnosticarInstalacao(storage, raiz, opcoes),
    loadInstallation: (storage, raiz, opcoes) => INST.carregarInstalacao(storage, raiz, opcoes),
    writePackage: (storage, raiz, pacote, opcoes) => INST.gravarPacote(storage, raiz, pacote, opcoes),
    listVersions: (storage, raiz, schemaId, opcoes) => INST.listarVersoes(storage, raiz, schemaId, opcoes),
    restoreVersion: (storage, raiz, pacote, schemaId, caminho, opcoes) => INST.restaurarVersao(storage, raiz, pacote, schemaId, caminho, opcoes),
    compareVersions: (existentes, novos, chave) => CF.compararVersoes(existentes, novos, chave),
    compareFiles: (storage, a, b, opcoes) => INST.compararArquivos(storage, a, b, opcoes),
    // sincronização futura
    detectConflicts: (base, excel, sistema, chave) => CF.detectarConflitos(base, excel, sistema, chave),
    resolveConflicts: (mesclado, conflitos, decisoes, chave, opcoes) => CF.resolverConflitos(mesclado, conflitos, decisoes, chave, opcoes),
    registerSkill: (pacote, mudanca) => H.registrarHabilidade(pacote, mudanca),
    // Matriz de habilidades BYD (BYD_SKILL_MATRIX_V1): nível, designação (○ △ em formas do Excel), cor e origem
    byd: { detectar: BYM.ehMatrizBYD, extrair: (bytes, opcoes) => BYM.extrairMatrizBYD(bytes, opcoes), lerFormas: (bytes, opcoes) => BDR.lerFormas(bytes, opcoes),
      gerarBaseOperacional: (r, opcoes) => BYB.gerarBaseOperacional(r, opcoes), verificarBaseOperacional: (bytes, r, opcoes) => BYB.verificarBaseOperacional(bytes, r, opcoes), ehAtual: BYM.ehAtual, CONFIG: BYM.CONFIG,
      lerBaseOperacional: (bytes, opcoes) => BYB.lerBaseOperacional(bytes, opcoes), lerAjustesDaBase: (bytes, opcoes) => BYB.lerAjustesDaBase(bytes, opcoes), PERFIL: BYM.PERFIL },
    // Camada de Ajustes Manuais: fonte (Matriz) → ajustes → valor efetivo (nunca edita a base importada)
    ajustes: AJ,
    // importação guiada e cadastro
    importacao: IMP, cadastro: CAD, pessoas: PSS, relatorios: REL, armazenamento: ST, dicionario: D, aliases: AL, perfis: PF,
    createPackage: (meta, usuario) => INST.criarPacote(meta, usuario),
    util: U,
  };
}, typeof module === 'object' ? module : null);
