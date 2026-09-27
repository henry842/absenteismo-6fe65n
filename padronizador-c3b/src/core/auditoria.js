// Lote de importação (ImportBatch): estados de uma transação lógica, contagens, tempos e relatório.
// Dados de um lote só entram no pacote oficial no COMMITTING → COMPLETED.
(typeof module === 'object' ? require('../modulo') : C3BModulo)('core/auditoria', ['core/util', 'core/ids', 'core/validar'], (U, ID, V) => {
  'use strict';

  const ESTADOS = ['DRAFT', 'ANALYZING', 'MAPPED', 'VALIDATED', 'READY', 'COMMITTING', 'COMPLETED', 'FAILED', 'CANCELLED'];
  const PERMITIDAS = {
    DRAFT: ['ANALYZING', 'CANCELLED', 'FAILED'], ANALYZING: ['MAPPED', 'CANCELLED', 'FAILED'], MAPPED: ['MAPPED', 'VALIDATED', 'ANALYZING', 'CANCELLED', 'FAILED'],
    VALIDATED: ['MAPPED', 'VALIDATED', 'READY', 'CANCELLED', 'FAILED'], READY: ['MAPPED', 'VALIDATED', 'COMMITTING', 'CANCELLED', 'FAILED'],
    COMMITTING: ['COMPLETED', 'FAILED'], COMPLETED: [], FAILED: [], CANCELLED: [],
  };

  function novoLote({ contadores, arquivo, executadoPor = 'usuario', modo = 'IMPORTACAO' }) {
    return {
      import_batch_id: ID.batchId(contadores), estado: 'DRAFT', modo, arquivo: arquivo ? { nome: arquivo.nome, tamanho: arquivo.tamanho, hash: arquivo.hash, formato: arquivo.formato } : null,
      executado_por: executadoPor, iniciado_em: U.agoraISO(), finalizado_em: null, transicoes: [], abas: [], tempos: {}, erro: null,
    };
  }
  function transicao(lote, estado, detalhe = '') {
    if (!ESTADOS.includes(estado)) throw new Error('Estado desconhecido: ' + estado);
    if (!PERMITIDAS[lote.estado].includes(estado)) throw new Error(`Transição inválida: ${lote.estado} → ${estado}.`);
    lote.transicoes.push({ de: lote.estado, para: estado, em: U.agoraISO(), detalhe });
    lote.estado = estado;
    if (['COMPLETED', 'FAILED', 'CANCELLED'].includes(estado)) lote.finalizado_em = U.agoraISO();
    return lote;
  }

  // Resumo de uma aba processada no lote
  function resumoAba({ aba, schema, registros, ignoradas, log, issues, duplicidades = 0 }) {
    const naoRec = log.filter(l => ['UNKNOWN', 'NAO_RESOLVIDO'].includes(l.status)).length;
    const corrigidos = log.filter(l => l.decision === 'USUARIO' || (l.status === 'OK' && l.original_value != null && String(l.original_value) !== String(l.normalized_value))).length;
    return { aba, schema, encontrados: registros.length + ignoradas.length, importados: registros.length, ignorados: ignoradas.length,
      corrigidos, naoReconhecidos: naoRec, duplicidades, severidades: V.contar(issues) };
  }

  function relatorioTexto(lote) {
    const L = [lote.import_batch_id, '', `Arquivo: ${lote.arquivo ? lote.arquivo.nome : '(cadastro manual)'}`, `Modo: ${lote.modo}`, `Estado: ${lote.estado}`];
    for (const a of lote.abas) {
      L.push('', `Aba: ${a.aba} → ${a.schema}`, `Registros encontrados: ${a.encontrados}`, `Importados: ${a.importados}`, `Ignorados: ${a.ignorados}`,
        `Corrigidos: ${a.corrigidos}`, `Não reconhecidos: ${a.naoReconhecidos}`, `Duplicidades: ${a.duplicidades}`,
        `Avisos: ${a.severidades.WARNING} · Erros: ${a.severidades.ERROR} · Bloqueios: ${a.severidades.BLOCKING}`);
    }
    L.push('', `Executado por: ${lote.executado_por}`, `Início: ${lote.iniciado_em}`, `Fim: ${lote.finalizado_em || '—'}`);
    if (lote.erro) L.push('', `Erro: ${lote.erro}`);
    return L.join('\n');
  }

  return { ESTADOS, novoLote, transicao, resumoAba, relatorioTexto };
}, typeof module === 'object' ? module : null);
