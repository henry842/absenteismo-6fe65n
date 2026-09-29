// Deduplicação assistida de pessoas (universal: Matriz BYD, Cadastro, qualquer importação com nomes).
// Nomes muito parecidos viram SUGESTÃO "Possível mesma pessoa → confirmar / pessoas diferentes".
// Nunca une sozinho pela similaridade: só um alias PESSOA confirmado pelo usuário une duas grafias.
// Categorias de pendência (para não misturar configuração pendente com erro de leitura).
(typeof module === 'object' ? require('../modulo') : C3BModulo)('core/pessoas', ['core/util'], (U) => {
  'use strict';

  const LIMITE = 0.88;
  const chavePar = (a, b) => [U.dobrar(a), U.dobrar(b)].sort().join(' ⇄ ');

  // itens: [{ nome, ...qualquer contexto }]; nomes iguais após dobrar() já são a mesma chave e não geram par.
  // decisoes: decisões já tomadas (tipo PESSOAS_DIFERENTES) — o par não volta a ser sugerido.
  function encontrarPessoasParecidas(itens, { decisoes = [], limite = LIMITE } = {}) {
    const diferentes = new Set(decisoes.filter(d => d.tipo === 'PESSOAS_DIFERENTES').map(d => d.detalhe));
    const porChave = new Map();
    for (const it of itens) { const k = U.dobrar(it.nome); if (k && !porChave.has(k)) porChave.set(k, it); }
    const lista = [...porChave.values()];
    const pares = [];
    for (let i = 0; i < lista.length; i++) for (let j = i + 1; j < lista.length; j++) {
      const a = lista[i], b = lista[j];
      const sim = U.similaridade(a.nome, b.nome);
      if (sim < limite) continue;
      const par = chavePar(a.nome, b.nome);
      if (diferentes.has(par)) continue;
      pares.push({ par, a, b, similaridade: Math.round(sim * 100) });
    }
    return pares.sort((x, y) => y.similaridade - x.similaridade);
  }

  // Decisão humana. MESMA: devolve o alias PESSOA (variante → canônico) a gravar; DIFERENTES: só a decisão.
  function decidirPessoas(par, escolha, { canonico = null, usuario = 'usuario' } = {}) {
    const agora = U.agoraISO();
    if (escolha === 'DIFERENTES') return { decisao: { tipo: 'PESSOAS_DIFERENTES', detalhe: par.par, decidido_por: usuario, decidido_em: agora }, alias: null };
    if (escolha !== 'MESMA') throw new Error('Decisão inválida: ' + escolha);
    const fica = canonico || par.a.nome;
    if (U.dobrar(fica) !== U.dobrar(par.a.nome) && U.dobrar(fica) !== U.dobrar(par.b.nome)) throw new Error(`O nome canônico precisa ser um dos dois: "${par.a.nome}" ou "${par.b.nome}".`);
    const variante = U.dobrar(fica) === U.dobrar(par.a.nome) ? par.b.nome : par.a.nome;
    return { decisao: { tipo: 'PESSOAS_UNIFICADAS', detalhe: `${variante} → ${fica}`, decidido_por: usuario, decidido_em: agora },
      alias: { entity_type: 'PESSOA', original_value: variante, normalized_value: fica } };
  }

  // ---------- categorias de pendência ----------
  const CATEGORIAS = {
    CONFIGURACAO_PENDENTE: 'Configuração pendente',   // matrícula, função, turno, modelo a cadastrar
    PROBLEMA_DE_DADOS: 'Problema de dados',           // duplicidade, operação inválida, referência quebrada, leitura
    AVISO: 'Aviso',                                    // informação opcional ausente
    INFORMACAO: 'Informação técnica',                  // registro do que foi feito (sem ação necessária)
  };
  const POR_CODIGO = {
    CONFIGURACAO_PESSOA: 'CONFIGURACAO_PENDENTE', MATRICULA_AUSENTE: 'CONFIGURACAO_PENDENTE', MODELO_DA_ABA: 'CONFIGURACAO_PENDENTE',
    RECOMENDADO_VAZIO: 'AVISO', MATRICULA_NUMERO: 'AVISO',
    LGPD_IGNORADO: 'INFORMACAO', LINHA_IGNORADA: 'INFORMACAO', FORMA_DUPLICADA: 'INFORMACAO', ABA_EXEMPLO_IGNORADA: 'INFORMACAO',
    MARCADOR_POR_DESLOCAMENTO: 'INFORMACAO', PESSOAS_UNIFICADAS: 'INFORMACAO', RESIDUO_IGNORADO: 'INFORMACAO',
  };
  const CAMPOS_CONFIG = new Set(['matricula', 'funcao', 'turno', 'equipe', 'status']);
  function categoriaDe(codigo, { campo = null, severidade = null } = {}) {
    if (POR_CODIGO[codigo]) return POR_CODIGO[codigo];
    if (codigo === 'OBRIGATORIO_VAZIO' && CAMPOS_CONFIG.has(campo)) return 'CONFIGURACAO_PENDENTE';
    if (severidade === 'INFO') return 'INFORMACAO';
    return 'PROBLEMA_DE_DADOS';
  }

  return { encontrarPessoasParecidas, decidirPessoas, chavePar, categoriaDe, CATEGORIAS, LIMITE };
}, typeof module === 'object' ? module : null);
