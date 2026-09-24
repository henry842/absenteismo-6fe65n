// Leitor das mensagens de absenteísmo do WhatsApp.
// Funções puras: recebem texto/objetos e devolvem objetos. Usado pela página e pelos testes.
(function (raiz) {
  'use strict';

  const MOTIVOS = [
    'Atestado médico',
    'Atraso roteiro',
    'Atraso motivo pessoal',
    'Sem justificativa',
    'Afastamento INSS',
    'Turno ADM',
    'Atraso sem justificativa',
    'Férias',
    'Outros',
  ];

  // Ordem importa: o primeiro que casar vence.
  const REGRAS_MOTIVO = [
    [/ferias/, 'Férias'],
    [/atraso.*(roteiro|onibus|rota|fretado|transporte)|(roteiro|onibus|fretado).*atras/, 'Atraso roteiro'],
    [/atras.*(sem justific|injustific|nao justific)/, 'Atraso sem justificativa'],
    [/atraso|atrasad/, 'Atraso motivo pessoal'],
    [/inss|afastad|afastamento|licenca/, 'Afastamento INSS'],
    [/sem justific|injustific|nao justific|falta sem|^faltas?$/, 'Sem justificativa'],
    [/atest|medic|consulta|declaracao/, 'Atestado médico'],
    [/\badm\b|administrativ/, 'Turno ADM'],
  ];

  // Minúsculas, sem acento, espaços simples.
  function dobrar(s) {
    return String(s || '')
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  }

  // Prefixo que o WhatsApp põe ao copiar várias mensagens:
  // "[24/09/2026, 16:58:48] ~Fulano: " (computador) ou "24/09/2026 16:58 - Fulano: " (celular)
  const PREFIXOS_WHATS = [
    /^\s*\[(\d{1,2}[\/.]\d{1,2}(?:[\/.]\d{2,4})?),?\s+\d{1,2}:\d{2}(?::\d{2})?\]\s*[^:]{1,60}:\s*/,
    /^\s*(\d{1,2}\/\d{1,2}\/\d{2,4}),?\s+\d{1,2}:\d{2}\s+-\s+[^:]{1,60}:\s*/,
  ];
  function prefixoWhats(linha) {
    for (const re of PREFIXOS_WHATS) {
      const m = String(linha).match(re);
      if (m) return { data: m[1], tamanho: m[0].length };
    }
    return null;
  }

  // Tira prefixo de cópia do WhatsApp, marcador de lista "- " e a formatação *negrito* _itálico_ ~riscado~.
  function limparLinha(linha) {
    const p = prefixoWhats(linha);
    return String(linha).slice(p ? p.tamanho : 0)
      .replace(/[*_~]/g, '')
      .replace(/[‎‏‪-‮﻿]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/^[-–•·]\s+/, '');
  }

  function nomeBonito(s) {
    const minusculas = ['da', 'de', 'do', 'das', 'dos', 'e'];
    return String(s || '').trim().replace(/\s+/g, ' ').toLowerCase()
      .split(' ')
      .map((p, i) => (i > 0 && minusculas.includes(p)) ? p : p.charAt(0).toUpperCase() + p.slice(1))
      .join(' ');
  }

  function normalizarMotivo(bruto, apelidos) {
    const d = dobrar(bruto).replace(/[.,;!]+$/g, '');
    if (!d) return { motivo: 'Outros', reconhecido: false };
    if (apelidos && apelidos[d]) return { motivo: apelidos[d], reconhecido: true };
    for (const m of MOTIVOS) if (dobrar(m) === d) return { motivo: m, reconhecido: true };
    for (const [re, m] of REGRAS_MOTIVO) if (re.test(d)) return { motivo: m, reconhecido: true };
    return { motivo: 'Outros', reconhecido: false };
  }

  function acharData(linha, anoPadrao) {
    const m = linha.match(/(?:^|[^\d])(\d{1,2})[\/.\-](\d{1,2})(?:[\/.\-](\d{2,4}))?(?![\d])/);
    if (!m) return null;
    const dia = +m[1], mes = +m[2];
    if (dia < 1 || dia > 31 || mes < 1 || mes > 12) return null;
    let ano = m[3] ? +m[3] : anoPadrao;
    if (ano < 100) ano += 2000;
    return `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
  }

  // "C1-B" → {time:'C1B'}; "C5-" → {time:'C5', incompleto:true}; "C7B" → {time:'C7B'}
  function acharTime(linha) {
    const d = dobrar(linha);
    const m = d.match(/(?:^|[^a-z0-9])c\s?(\d{1,2})\s?([-–]?)\s?([a-z])?(?![a-z0-9])/);
    if (!m) return null;
    const letra = m[3] ? m[3].toUpperCase() : '';
    return {
      time: `C${+m[1]}${letra}`,
      bruto: linha,
      incompleto: !letra && m[2] !== '',
    };
  }

  // Time escrito por extenso no título: "ABSENTEÍSMO SUB MONTAGEM TURNO B 24/09/26" → "SUB MONTAGEM TURNO B"
  function timeDoTitulo(linha) {
    const t = String(linha).normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/\b(bom dia|boa tarde|boa noite)\b[!,.]*/ig, '')
      .replace(/absente\w*/ig, '')
      .replace(/\d{1,2}[\/.\-]\d{1,2}(?:[\/.\-]\d{2,4})?/g, '')
      .replace(/\b(do dia|dia|data)\b/ig, '')
      .replace(/^[\s\-–:|,.]+|[\s\-–:|,.]+$/g, '')
      .replace(/^d[aoe]s?\s+/i, '')
      .replace(/\s+/g, ' ').trim().toUpperCase();
    return t ? { time: t, bruto: linha, incompleto: false } : null;
  }

  // Padroniza o nome do time digitado: "c1-b" → "C1B"; "Sub  montagem turno b" → "SUB MONTAGEM TURNO B"
  function normalizarTime(s) {
    const t = String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[*_~]/g, '')
      .replace(/\s+/g, ' ').trim().toUpperCase().replace(/^[-–\s]+|[-–\s]+$/g, '');
    if (/^C\s?\d{1,2}\s?[-–]?\s?[A-Z]?$/.test(t)) return t.replace(/[\s\-–]/g, '').replace(/^C0*(\d)/, 'C$1');
    return t;
  }

  function acharTurno(linha) {
    const d = dobrar(linha);
    const m = d.match(/(\d)\s?[°ºo]?\s?turno|turno\s?[:=]?\s?(\d|[a-c]\b)/);
    if (!m) return null;
    const v = m[1] || m[2];
    return /\d/.test(v) ? `${v}º turno` : `Turno ${v.toUpperCase()}`;
  }

  // Linha que parece só um nome de pessoa (sem "Nome:"): "Maria da Luz dos Santos", "Joao Silva -"
  function pareceNome(linha) {
    const t = linha.replace(/[\s\-–:|,.]+$/, '').trim();
    if (!/^[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ'. ]+$/.test(t) || t.length > 70) return null;
    return t.split(' ').length >= 2 ? t : null;
  }

  function campoContagem(chave) {
    const k = chave.replace(/^(quantidade|qtd|qtde|quant)\.?\s*(de\s+)?/, '').trim();
    if (/present/.test(k)) return { campo: 'presentes' };
    if (/ausent|^faltas?$|^total de faltas$|^total faltas$/.test(k)) return { campo: 'ausentes' };
    if (/previst|efetivo|^total$|total de pessoas|total pessoas|quadro|^pessoas$|colaboradores/.test(k)) return { campo: 'efetivo' };
    const mot = normalizarMotivo(k);
    if (mot.reconhecido) return { campo: 'contagem', motivo: mot.motivo };
    return null;
  }

  function novaMensagem() {
    return {
      data: null, time: null, timeBruto: null, timeIncompleto: false, turno: null,
      efetivo: null, presentes: null, ausentes: null,
      contagens: {}, pessoas: [], linhasIgnoradas: [], texto: [],
    };
  }

  function temConteudo(m) {
    return m.time || m.efetivo != null || m.presentes != null || m.pessoas.length;
  }

  // Lê um bloco colado (uma ou várias mensagens) e devolve a lista de mensagens.
  function lerMensagens(texto, opcoes) {
    const anoPadrao = (opcoes && opcoes.ano) || new Date().getFullYear();
    const apelidos = (opcoes && opcoes.apelidos) || {};
    const mensagens = [];
    let cur = novaMensagem();
    let pessoa = null;
    let nomeSolto = null; // nome sem "Nome:", esperando a linha do ID

    const fecharPessoa = () => {
      if (pessoa && (pessoa.nome || pessoa.matricula || pessoa.motivoOriginal)) cur.pessoas.push(pessoa);
      pessoa = null;
    };
    const fecharMensagem = () => {
      fecharPessoa();
      if (temConteudo(cur)) mensagens.push(cur);
      cur = novaMensagem();
      nomeSolto = null;
    };
    const pessoaAtual = () => {
      if (!pessoa) pessoa = { nome: '', matricula: '', motivoOriginal: '', motivo: 'Outros', motivoReconhecido: false };
      if (!pessoa.nome && nomeSolto) { pessoa.nome = nomeBonito(nomeSolto); nomeSolto = null; }
      return pessoa;
    };

    for (const original of String(texto || '').split(/\r?\n/)) {
      // Cada prefixo "[data, hora] Fulano:" é o começo de uma mensagem nova
      const pre = prefixoWhats(original);
      if (pre) {
        if (temConteudo(cur) || pessoa) fecharMensagem();
        cur.dataWhats = acharData(pre.data, anoPadrao);
      }
      const linha = limparLinha(original);
      if (!linha) continue;

      const kv = linha.match(/^([^:=]{1,40}?)\s*[:=]\s*(.*)$/);
      const chave = kv ? dobrar(kv[1]) : '';
      const valor = kv ? kv[2].trim() : '';
      // "ID 1234567" (sem os dois pontos)
      const idSolto = !kv && linha.match(/^(?:id|matr[ií]cula|matr|mat|re|registro|crach[aá])\.?\s+(\d{4,})$/i);

      // Campos da pessoa
      if (kv && /^nome( completo)?$|^colaborador(a)?$|^funcionari/.test(chave)) {
        fecharPessoa();
        pessoaAtual().nome = nomeBonito(valor);
        cur.texto.push(original);
        continue;
      }
      if (idSolto || (kv && /^(matricula|matr|mat|id|re|registro|cracha)\.?$/.test(chave))) {
        const p = (pessoa && !pessoa.matricula && !nomeSolto) ? pessoa : (fecharPessoa(), pessoaAtual());
        p.matricula = (idSolto ? idSolto[1] : valor).replace(/\D/g, '');
        cur.texto.push(original);
        continue;
      }
      if (kv && /^(motivo|justificativa)$/.test(chave)) {
        const p = (pessoa && !pessoa.motivoOriginal) ? pessoa : (fecharPessoa(), pessoaAtual());
        p.motivoOriginal = valor;
        const n = normalizarMotivo(valor, apelidos);
        p.motivo = n.motivo;
        p.motivoReconhecido = n.reconhecido;
        cur.texto.push(original);
        continue;
      }

      // Contagens do cabeçalho (valor numérico, às vezes com "colaboradores" depois)
      const numero = kv && valor.match(/^(\d{1,4})\s*(?:colaboradore?s?|pessoas?|funcion[aá]ri[oa]s?|func\.?)?\.?$/i);
      if (numero) {
        const c = campoContagem(chave);
        if (c) {
          if (pessoa || cur.pessoas.length) fecharMensagem();
          const n = +numero[1];
          if (c.campo === 'contagem') cur.contagens[c.motivo] = (cur.contagens[c.motivo] || 0) + n;
          else cur[c.campo] = n;
          if (c.campo === 'ausentes') cur.ausentesRotulo = kv[1].trim();
          cur.texto.push(original);
          continue;
        }
      }

      // Pessoa numa linha só: "João Silva - 1234567 - Atestado"
      const umaLinha = !kv && linha.match(/^([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ .']+?)\s*[-–|]\s*(\d{5,})\s*(?:[-–|]\s*(.+))?$/);
      if (umaLinha) {
        fecharPessoa();
        const n = normalizarMotivo(umaLinha[3] || '', apelidos);
        cur.pessoas.push({
          nome: nomeBonito(umaLinha[1]), matricula: umaLinha[2],
          motivoOriginal: umaLinha[3] || '', motivo: n.motivo, motivoReconhecido: n.reconhecido,
        });
        cur.texto.push(original);
        continue;
      }

      // Cabeçalho: saudação, título, data, time, turno
      const data = acharData(linha, anoPadrao);
      const saudacao = /^(bom dia|boa tarde|boa noite|ola|oi)\b/.test(dobrar(linha));
      const titulo = /absente/.test(dobrar(linha));
      const time = acharTime(linha) || (titulo ? timeDoTitulo(linha) : null);
      const turno = acharTurno(linha);

      if (data || time || turno || saudacao || titulo) {
        const jaTemPessoas = cur.pessoas.length > 0 || pessoa;
        const outroTime = time && cur.time && time.time !== cur.time;
        const outraData = data && cur.data && data !== cur.data;
        const cabecalhoDepoisDeNumeros = (saudacao || titulo) && (cur.efetivo != null || cur.presentes != null);
        if (jaTemPessoas || outroTime || outraData || cabecalhoDepoisDeNumeros) fecharMensagem();
        if (data) cur.data = data;
        if (time) { cur.time = time.time; cur.timeBruto = time.bruto; cur.timeIncompleto = time.incompleto; }
        if (turno) cur.turno = turno;
        cur.texto.push(original);
        continue;
      }

      const nome = !kv && pareceNome(linha);
      if (nome) {
        if (pessoa && pessoa.matricula) fecharPessoa();
        nomeSolto = nome;
      } else cur.linhasIgnoradas.push(linha);
      cur.texto.push(original);
    }
    fecharMensagem();

    for (const m of mensagens) {
      m.texto = m.texto.join('\n');
      if (!m.data && m.dataWhats) { m.data = m.dataWhats; m.dataDoWhats = true; }
      completarNumeros(m);
    }
    return mensagens;
  }

  // Se vieram 2 dos 3 números, calcula o terceiro.
  function completarNumeros(m) {
    m.ausentesInformado = m.ausentes != null;
    if (m.ausentes == null && m.efetivo != null && m.presentes != null) m.ausentes = m.efetivo - m.presentes;
    if (m.presentes == null && m.efetivo != null && m.ausentes != null) { m.presentes = m.efetivo - m.ausentes; m.presentesCalculado = true; }
    if (m.efetivo == null && m.presentes != null && m.ausentes != null) { m.efetivo = m.presentes + m.ausentes; m.efetivoCalculado = true; }
    return m;
  }

  function contarPorMotivo(pessoas) {
    const c = {};
    for (const p of pessoas) c[p.motivo] = (c[p.motivo] || 0) + 1;
    return c;
  }

  // Confere uma mensagem. `base` (opcional) é o que já está salvo, para checar duplicidade.
  // Devolve { status: 'verde'|'amarelo'|'vermelho', problemas: [{nivel, texto}] }
  function conferir(m, base, config) {
    const problemas = [];
    const add = (nivel, texto) => problemas.push({ nivel, texto });
    const times = (config && config.times) || [];

    if (!m.time) add('vermelho', 'Não achei o time na mensagem.');
    else if (m.timeIncompleto) add('amarelo', `Time veio incompleto ("${m.timeBruto}"). Confira a letra do time.`);
    else if (times.length && !times.includes(m.time)) add('amarelo', `O time ${m.time} não está na lista de times dos Ajustes.`);

    if (!m.data) add('amarelo', 'A mensagem não tem data. Confira a data.');
    else if (m.dataDoWhats) add('info', `A mensagem não tinha data; usei a data do WhatsApp (${dataBR(m.data)}).`);

    if (m.efetivo == null) add('vermelho', 'Falta o total de pessoas (efetivo).');
    if (m.presentes == null) add('vermelho', 'Falta o número de presentes.');

    if (m.efetivo != null && m.presentes != null) {
      if (m.presentes > m.efetivo) add('vermelho', `Presentes (${m.presentes}) é maior que o total (${m.efetivo}).`);
      const falta = m.efetivo - m.presentes;
      const listaBate = falta === m.pessoas.length;
      if (m.ausentesInformado && falta !== m.ausentes) {
        const rotulo = m.ausentesRotulo || 'Ausentes';
        // Se a conta e a lista de nomes concordam, provavelmente só a linha "Faltas" foi digitada errada
        add(listaBate ? 'amarelo' : 'vermelho', listaBate
          ? `A linha "${rotulo}" diz ${m.ausentes}, mas faltaram ${falta} (${m.efetivo} − ${m.presentes}) e a lista tem ${m.pessoas.length} nome(s). Confira com o líder.`
          : `A conta não fecha: ${m.efetivo} − ${m.presentes} = ${falta}, mas a linha "${rotulo}" diz ${m.ausentes}.`);
      }
      if (!listaBate)
        add('vermelho', `Faltaram ${falta} pessoas pela conta, mas a mensagem lista ${m.pessoas.length} nome(s).`);
    }

    for (const l of m.linhasIgnoradas || []) {
      if (/\d/.test(l)) add('amarelo', `Não entendi esta linha: "${l}". Confira se tem informação importante.`);
    }

    const porMotivo = contarPorMotivo(m.pessoas);
    for (const [mot, n] of Object.entries(m.contagens)) {
      if ((porMotivo[mot] || 0) !== n)
        add('vermelho', `O cabeçalho diz ${mot}: ${n}, mas a lista tem ${porMotivo[mot] || 0}.`);
    }

    const vistas = {};
    m.pessoas.forEach((p, i) => {
      const quem = p.nome || `Pessoa ${i + 1}`;
      if (!p.matricula) add('amarelo', `${quem}: sem matrícula.`);
      else if (vistas[p.matricula]) add('vermelho', `Matrícula ${p.matricula} aparece duas vezes nesta mensagem.`);
      else vistas[p.matricula] = true;
      if (!p.nome) add('amarelo', `Matrícula ${p.matricula || '?'}: sem nome.`);
      if (!p.motivoOriginal) add('amarelo', `${quem}: sem motivo.`);
      else if (!p.motivoReconhecido) add('amarelo', `${quem}: motivo "${p.motivoOriginal}" não reconhecido (ficou como Outros).`);
    });

    if (base && m.time && m.data) {
      const chave = chaveFechamento(m.data, m.time);
      if (base.fechamentos && base.fechamentos[chave])
        add('amarelo', `O ${m.time} de ${dataBR(m.data)} já foi lançado. Se confirmar, substitui o anterior.`);
      for (const f of Object.values(base.fechamentos || {})) {
        if (f.data !== m.data || f.time === m.time) continue;
        for (const p of f.pessoas) {
          if (p.matricula && vistas[p.matricula])
            add('vermelho', `Matrícula ${p.matricula} já está como ausente no ${f.time} neste mesmo dia.`);
        }
      }
      for (const p of m.pessoas) {
        const cad = base.cadastro && base.cadastro[p.matricula];
        if (cad && p.nome && dobrar(cad.nome) !== dobrar(p.nome))
          add('amarelo', `Matrícula ${p.matricula} veio como "${p.nome}", mas antes estava como "${cad.nome}".`);
        if (cad && cad.time && cad.time !== m.time)
          add('amarelo', `${p.nome || p.matricula}: costuma ser do ${cad.time} (visto em ${dataBR(cad.visto)}). Mudou de time?`);
      }

      const normal = efetivoNormal(base, m.time, m.data);
      if (normal != null && m.efetivo != null && Math.abs(m.efetivo - normal) > Math.max(3, normal * 0.2))
        add('amarelo', `Total de pessoas (${m.efetivo}) bem diferente do normal do ${m.time} (${normal}). Erro de digitação?`);

      for (const p of m.pessoas) {
        if (!p.matricula) continue;
        const antes = ausenciasDaPessoa(base, p.matricula, somarDias(m.data, -30), somarDias(m.data, -1));
        if (antes.length >= 2)
          add('info', `${p.nome || p.matricula}: ${antes.length + 1}ª ausência em 30 dias (antes: ${antes.map(a => dataBR(a.data).slice(0, 5)).join(', ')}).`);
      }
    }

    // 'info' só informa; não muda a cor do cartão.
    const status = problemas.some(p => p.nivel === 'vermelho') ? 'vermelho'
      : problemas.some(p => p.nivel === 'amarelo') ? 'amarelo' : 'verde';
    return { status, problemas };
  }

  // Mediana do total de pessoas dos últimos 10 lançamentos do time (outros dias). Precisa de 3+.
  function efetivoNormal(base, time, excetoData) {
    const vs = Object.values(base.fechamentos || {})
      .filter(f => f.time === time && f.data !== excetoData)
      .sort((a, b) => b.data.localeCompare(a.data))
      .slice(0, 10).map(f => f.efetivo).sort((a, b) => a - b);
    if (vs.length < 3) return null;
    const meio = Math.floor(vs.length / 2);
    return vs.length % 2 ? vs[meio] : Math.round((vs[meio - 1] + vs[meio]) / 2);
  }

  function ausenciasDaPessoa(base, matricula, de, ate) {
    const r = [];
    for (const f of Object.values(base.fechamentos || {})) {
      if (f.data < de || f.data > ate) continue;
      for (const p of f.pessoas) if (p.matricula === matricula) r.push({ data: f.data, time: f.time, motivo: p.motivo, nome: p.nome });
    }
    return r.sort((a, b) => a.data.localeCompare(b.data));
  }

  function somarDias(iso, n) {
    const d = new Date(iso + 'T12:00:00Z');
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  }

  const DIAS_SEMANA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  function diaDaSemana(iso) { return new Date(iso + 'T12:00:00Z').getUTCDay(); }

  // Faltas que entram no %: pessoas cujo motivo conta + ausentes sem nome informado.
  function faltasDoFechamento(f, naoContam) {
    const contam = f.pessoas.filter(p => !(naoContam || []).includes(p.motivo)).length;
    return contam + Math.max(0, f.ausentes - f.pessoas.length);
  }

  function chaveFechamento(data, time) { return `${data}|${time}`; }

  function dataBR(iso) {
    if (!iso) return '';
    const [a, m, d] = iso.split('-');
    return `${d}/${m}/${a}`;
  }

  function pct(parte, todo) {
    if (!todo) return '0,0%';
    return (parte / todo * 100).toFixed(1).replace('.', ',') + '%';
  }

  // Grava a mensagem conferida na base (devolve uma base nova, não altera a original).
  function gravar(base, m, agora) {
    const nova = JSON.parse(JSON.stringify(base || baseVazia()));
    const f = {
      data: m.data, time: m.time, turno: m.turno || null,
      efetivo: m.efetivo, presentes: m.presentes, ausentes: m.efetivo - m.presentes,
      pessoas: m.pessoas.map(p => ({ matricula: p.matricula, nome: p.nome, motivo: p.motivo, motivoOriginal: p.motivoOriginal })),
      texto: m.texto || '',
      confirmadoEm: agora || new Date().toISOString(),
    };
    nova.fechamentos[chaveFechamento(m.data, m.time)] = f;
    for (const p of f.pessoas) {
      if (!p.matricula) continue;
      nova.cadastro[p.matricula] = { nome: p.nome || (nova.cadastro[p.matricula] || {}).nome || '', time: m.time, visto: m.data };
    }
    return nova;
  }

  function baseVazia() {
    return { versao: 1, fechamentos: {}, cadastro: {}, config: { times: [], naoContam: ['Férias'], apelidos: {}, meta: null } };
  }

  // Números do dia (geral + por time + por motivo)
  function resumoDoDia(base, data) {
    const naoContam = (base.config && base.config.naoContam) || [];
    const fs = Object.values(base.fechamentos || {}).filter(f => f.data === data)
      .sort((a, b) => a.time.localeCompare(b.time, 'pt', { numeric: true }));
    const r = { data, times: [], efetivo: 0, presentes: 0, ausentes: 0, faltasQueContam: 0, porMotivo: {}, recebidos: [], pendentes: [] };
    const todos = Object.values(base.fechamentos || {});
    for (const f of fs) {
      const faltas = faltasDoFechamento(f, naoContam);
      // Último lançamento do mesmo time antes desta data (ontem, ou sexta se hoje é segunda)
      const ant = todos.filter(x => x.time === f.time && x.data < data).sort((a, b) => b.data.localeCompare(a.data))[0];
      const anterior = ant ? { data: ant.data, ausentes: ant.ausentes, faltas: faltasDoFechamento(ant, naoContam), efetivo: ant.efetivo } : null;
      r.times.push({ time: f.time, turno: f.turno, efetivo: f.efetivo, presentes: f.presentes, ausentes: f.ausentes, faltas, pessoas: f.pessoas, anterior });
      r.efetivo += f.efetivo; r.presentes += f.presentes; r.ausentes += f.ausentes; r.faltasQueContam += faltas;
      for (const p of f.pessoas) r.porMotivo[p.motivo] = (r.porMotivo[p.motivo] || 0) + 1;
      r.recebidos.push(f.time);
    }
    const esperados = (base.config && base.config.times) || [];
    r.pendentes = esperados.filter(t => !r.recebidos.includes(t));
    r.esperados = esperados.length || r.recebidos.length;
    r.absenteismo = r.efetivo ? r.faltasQueContam / r.efetivo : 0;
    r.meta = (base.config && base.config.meta) || null;
    return r;
  }

  function seta(agora, antes) { return agora > antes ? '↑' : agora < antes ? '↓' : '='; }

  function acimaDaMeta(faltas, efetivo, meta) { return !!(meta && efetivo && faltas / efetivo > meta); }

  function pctMeta(meta) { return (meta * 100).toFixed(1).replace('.', ',').replace(',0', '') + '%'; }

  // Texto pronto para colar no grupo.
  function textoWhatsApp(r, opcoes) {
    const comNomes = opcoes && opcoes.comNomes;
    const L = [];
    L.push(`*ABSENTEÍSMO – ${dataBR(r.data)}*`);
    L.push(`Times recebidos: ${r.recebidos.length}/${r.esperados}`);
    L.push('');
    L.push(`*Efetivo:* ${r.efetivo}`);
    L.push(`*Presentes:* ${r.presentes}`);
    L.push(`*Ausentes:* ${r.ausentes}`);
    L.push(`*Absenteísmo:* ${pct(r.faltasQueContam, r.efetivo)}${r.meta ? ` (meta ${pctMeta(r.meta)})` : ''}`);
    L.push('');
    L.push('*Por time*');
    for (const t of r.times) {
      let linha = `${t.time}: ${t.ausentes} de ${t.efetivo} (${pct(t.faltas, t.efetivo)})`;
      if (t.anterior) linha += ` · antes ${t.anterior.ausentes} ${seta(t.ausentes, t.anterior.ausentes)}`;
      if (acimaDaMeta(t.faltas, t.efetivo, r.meta)) linha += ' ⚠️';
      L.push(linha);
    }
    const motivos = Object.entries(r.porMotivo).sort((a, b) => b[1] - a[1]);
    if (motivos.length) {
      L.push('');
      L.push('*Por motivo*');
      for (const [m, n] of motivos) L.push(`${m}: ${n}`);
    }
    if (r.pendentes.length) {
      L.push('');
      L.push(`*Pendentes:* ${r.pendentes.join(', ')}`);
    }
    if (comNomes) {
      for (const t of r.times) {
        if (!t.pessoas.length) continue;
        L.push('');
        L.push(`*${t.time}*`);
        for (const p of t.pessoas) L.push(`${p.nome} (${p.matricula}) – ${p.motivo}`);
      }
    }
    return L.join('\n');
  }

  // Todas as ausências de uma pessoa (busca por matrícula ou parte do nome).
  function historicoPessoa(base, busca) {
    const b = dobrar(busca);
    if (!b) return [];
    const linhas = [];
    for (const f of Object.values(base.fechamentos || {})) {
      for (const p of f.pessoas) {
        if ((p.matricula && p.matricula.includes(b)) || dobrar(p.nome).includes(b))
          linhas.push({ data: f.data, time: f.time, matricula: p.matricula, nome: p.nome, motivo: p.motivo });
      }
    }
    return linhas.sort((x, y) => y.data.localeCompare(x.data));
  }

  // Fechamento do dia no formato que o supervisor manda para o superior
  // (o mesmo modelo da mensagem "ABSENTEÍSMO SUB MONTAGEM TURNO B").
  // "Faltas" é o total de quem faltou; as outras linhas são os motivos.
  function textoSuperior(r, area) {
    const [a, m, d] = r.data.split('-');
    const c = {};
    for (const t of r.times) for (const p of t.pessoas) c[p.motivo] = (c[p.motivo] || 0) + 1;
    const n = mot => c[mot] || 0;
    const L = [
      `ABSENTEÍSMO ${area ? String(area).trim().toUpperCase() + ' ' : ''}${d}/${m}/${a.slice(2)}`,
      '',
      `- Efetivo previsto: ${r.efetivo} colaboradores`,
      `- Atestados médicos: ${n('Atestado médico')}`,
      `- Atraso de roteiro: ${n('Atraso roteiro')}`,
      `- Atraso por motivo pessoal: ${n('Atraso motivo pessoal')}`,
      `- Atraso sem justificativa: ${n('Atraso sem justificativa')}`,
      `- Faltas: ${r.ausentes}`,
      `- Faltas sem justificativa: ${n('Sem justificativa')}`,
      `- Afastamento INSS: ${n('Afastamento INSS')}`,
      `- Turno ADM: ${n('Turno ADM')}`,
      `- Férias: ${n('Férias')}`,
    ];
    if (n('Outros')) L.push(`- Outros: ${n('Outros')}`);
    L.push(`- Total presente: ${r.presentes} colaboradores`);
    for (const t of r.times) for (const p of t.pessoas) {
      L.push('', p.nome || '(sem nome)', `ID: ${p.matricula || '?'}`, `Motivo: ${p.motivo}`);
    }
    return L.join('\n');
  }

  // Texto para cobrar no grupo quem ainda não mandou.
  function textoCobranca(r) {
    if (!r.pendentes.length) return '';
    return [
      `*Absenteísmo ${dataBR(r.data)}*`,
      `Ainda falta enviar: *${r.pendentes.join(', ')}*`,
      'Por favor, mandem assim que possível. Obrigado!',
    ].join('\n');
  }

  // Modelo para os líderes copiarem. Está no formato que o leitor entende sem avisos.
  function textoModelo(data, time) {
    return [
      `*Absenteísmo ${time || 'C?'} ${dataBR(data)}*`,
      '*Turno:* ',
      '',
      '*Total de pessoas:* ',
      '*Presentes:* ',
      '*Ausentes:* ',
      '',
      '*Nome:* ',
      '*Matrícula:* ',
      '*Motivo:* ',
    ].join('\n');
  }

  // Números de um período (de/até inclusive, datas ISO).
  function resumoPeriodo(base, de, ate) {
    const naoContam = (base.config && base.config.naoContam) || [];
    const fs = Object.values(base.fechamentos || {}).filter(f => f.data >= de && f.data <= ate);
    const p = {
      de, ate, meta: (base.config && base.config.meta) || null,
      dias: [...new Set(fs.map(f => f.data))].sort(),
      times: [...new Set(fs.map(f => f.time))].sort((a, b) => a.localeCompare(b, 'pt', { numeric: true })),
      efetivo: 0, faltas: 0, ausentes: 0, porMotivo: {}, porTime: {}, porDia: {}, porDiaSemana: [], celulas: {},
    };
    const semana = DIAS_SEMANA.map(nome => ({ nome, efetivo: 0, faltas: 0, lancamentos: 0 }));
    for (const f of fs) {
      const faltas = faltasDoFechamento(f, naoContam);
      p.efetivo += f.efetivo; p.faltas += faltas; p.ausentes += f.ausentes;
      const t = p.porTime[f.time] = p.porTime[f.time] || { efetivo: 0, faltas: 0, ausentes: 0, dias: 0 };
      t.efetivo += f.efetivo; t.faltas += faltas; t.ausentes += f.ausentes; t.dias++;
      const d = p.porDia[f.data] = p.porDia[f.data] || { efetivo: 0, faltas: 0 };
      d.efetivo += f.efetivo; d.faltas += faltas;
      const s = semana[diaDaSemana(f.data)];
      s.efetivo += f.efetivo; s.faltas += faltas; s.lancamentos++;
      p.celulas[chaveFechamento(f.data, f.time)] = { efetivo: f.efetivo, faltas };
      for (const x of f.pessoas) p.porMotivo[x.motivo] = (p.porMotivo[x.motivo] || 0) + 1;
    }
    p.porDiaSemana = semana.filter(s => s.lancamentos);
    return p;
  }

  // Pessoas com `minimo`+ ausências nos `dias` dias até `ate`. Marca quando repetem o mesmo dia da semana.
  function alertasReincidencia(base, ate, dias, minimo) {
    dias = dias || 30; minimo = minimo || 3;
    const de = somarDias(ate, -(dias - 1));
    const porPessoa = {};
    for (const f of Object.values(base.fechamentos || {})) {
      if (f.data < de || f.data > ate) continue;
      for (const x of f.pessoas) {
        const k = x.matricula || dobrar(x.nome);
        if (!k) continue;
        const a = porPessoa[k] = porPessoa[k] || { matricula: x.matricula, nome: x.nome, time: f.time, datas: [], motivos: {} };
        a.datas.push(f.data); a.motivos[x.motivo] = (a.motivos[x.motivo] || 0) + 1;
        if (f.data >= (a.ultima || '')) { a.ultima = f.data; a.time = f.time; a.nome = x.nome || a.nome; }
      }
    }
    return Object.values(porPessoa).filter(a => a.datas.length >= minimo).map(a => {
      a.datas.sort();
      const contaDia = {};
      for (const d of a.datas) contaDia[diaDaSemana(d)] = (contaDia[diaDaSemana(d)] || 0) + 1;
      const [dia, n] = Object.entries(contaDia).sort((x, y) => y[1] - x[1])[0];
      a.total = a.datas.length;
      a.padraoDia = n >= 2 && n / a.total >= 0.6 ? DIAS_SEMANA[dia] : null;
      return a;
    }).sort((x, y) => y.total - x.total || x.nome.localeCompare(y.nome));
  }

  // Resumo do período pronto para colar no grupo.
  function textoPeriodo(p, alertas) {
    const L = [];
    L.push(`*ABSENTEÍSMO – ${dataBR(p.de)} a ${dataBR(p.ate)}*`);
    L.push(`Dias lançados: ${p.dias.length}`);
    L.push('');
    L.push(`*Absenteísmo do período:* ${pct(p.faltas, p.efetivo)}${p.meta ? ` (meta ${pctMeta(p.meta)})` : ''}`);
    L.push(`*Total de ausências:* ${p.ausentes}`);
    L.push('');
    L.push('*Por time*');
    const ts = p.times.slice().sort((a, b) => (p.porTime[b].faltas / p.porTime[b].efetivo) - (p.porTime[a].faltas / p.porTime[a].efetivo));
    for (const t of ts) {
      const x = p.porTime[t];
      L.push(`${t}: ${pct(x.faltas, x.efetivo)} (${x.ausentes} ausências)${acimaDaMeta(x.faltas, x.efetivo, p.meta) ? ' ⚠️' : ''}`);
    }
    const motivos = Object.entries(p.porMotivo).sort((a, b) => b[1] - a[1]);
    if (motivos.length) {
      L.push('');
      L.push('*Por motivo*');
      for (const [m, n] of motivos) L.push(`${m}: ${n}`);
    }
    if (p.porDiaSemana.length > 1) {
      const pior = p.porDiaSemana.slice().sort((a, b) => b.faltas / b.efetivo - a.faltas / a.efetivo)[0];
      L.push('');
      L.push(`*Dia com mais falta:* ${pior.nome} (${pct(pior.faltas, pior.efetivo)})`);
    }
    if (alertas && alertas.length) {
      L.push('');
      L.push(`*Atenção:* ${alertas.length} pessoa(s) com 3 ou mais ausências em 30 dias`);
    }
    return L.join('\n');
  }

  // Uma linha por ausência, para abrir no Excel (separador ; e BOM para acentos).
  function csvAusencias(base) {
    const esc = v => {
      const s = String(v == null ? '' : v);
      return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const L = [['Data', 'Time', 'Turno', 'Matrícula', 'Nome', 'Motivo', 'Motivo escrito pelo líder'].join(';')];
    const fs = Object.values(base.fechamentos || {}).sort((a, b) => a.data.localeCompare(b.data) || a.time.localeCompare(b.time, 'pt', { numeric: true }));
    for (const f of fs) for (const p of f.pessoas)
      L.push([dataBR(f.data), f.time, f.turno || '', p.matricula, p.nome, p.motivo, p.motivoOriginal].map(esc).join(';'));
    return '﻿' + L.join('\r\n');
  }

  function csvFechamentos(base) {
    const L = [['Data', 'Time', 'Turno', 'Efetivo', 'Presentes', 'Ausentes', 'Absenteísmo'].join(';')];
    const fs = Object.values(base.fechamentos || {}).sort((a, b) => a.data.localeCompare(b.data) || a.time.localeCompare(b.time, 'pt', { numeric: true }));
    for (const f of fs) L.push([dataBR(f.data), f.time, f.turno || '', f.efetivo, f.presentes, f.ausentes, pct(f.ausentes, f.efetivo)].join(';'));
    return '﻿' + L.join('\r\n');
  }

  const Leitor = {
    MOTIVOS, dobrar, limparLinha, prefixoWhats, timeDoTitulo, normalizarTime, pareceNome, normalizarMotivo, acharData, acharTime, acharTurno,
    lerMensagens, completarNumeros, conferir, gravar, baseVazia, chaveFechamento,
    resumoDoDia, textoWhatsApp, historicoPessoa, csvAusencias, csvFechamentos, dataBR, pct, nomeBonito,
    DIAS_SEMANA, diaDaSemana, somarDias, faltasDoFechamento, efetivoNormal, ausenciasDaPessoa,
    seta, acimaDaMeta, pctMeta, textoSuperior, textoCobranca, textoModelo, resumoPeriodo, alertasReincidencia, textoPeriodo,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = Leitor;
  else raiz.Leitor = Leitor;
})(typeof window !== 'undefined' ? window : globalThis);
