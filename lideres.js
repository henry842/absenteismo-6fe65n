// Regras do lançamento pelos líderes (funções puras, testadas em testes/lideres.test.js).
// O líder lança ausências, atrasos e saídas antecipadas do time dele; os supervisores recebem tudo organizado.
(function (raiz) {
  'use strict';

  const DOMINIO = 'lider.absenteismo.app';
  // Os motivos de ausência e atraso são os mesmos do leitor do WhatsApp: o texto para o superior continua igual.
  const MOTIVOS_AUSENCIA = ['Sem justificativa', 'Atestado médico', 'Afastamento INSS', 'Turno ADM', 'Férias', 'Outros'];
  // "Sem justificativa" vem primeiro: quando o atraso é lançado antes da pessoa chegar, ainda não se sabe o motivo.
  const MOTIVOS_ATRASO = ['Atraso sem justificativa', 'Atraso roteiro', 'Atraso motivo pessoal'];
  const MOTIVOS_SAIDA = ['Motivo pessoal', 'Saúde', 'Liberado pela chefia', 'Outros'];
  // No modelo que os líderes já mandam no WhatsApp, quem chegou atrasado entra na conta de ausentes.
  // Quem saiu mais cedo veio trabalhar: aparece nos relatórios, mas não entra no % de absenteísmo.
  const ATRASO_CONTA_COMO_AUSENTE = true;
  const SAIDA_CONTA_COMO_AUSENTE = false;

  const dobrar = s => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
  const ordenarTimes = (a, b) => String(a).localeCompare(String(b), 'pt', { numeric: true });
  const porNome = (a, b) => dobrar(a.nome).localeCompare(dobrar(b.nome));

  // "c2b" -> "c2b@lider.absenteismo.app"; quem digita e-mail (supervisor) fica como está
  function emailDoUsuario(s) {
    const t = String(s || '').trim().toLowerCase();
    return t.includes('@') ? t : t.replace(/\s+/g, '') + '@' + DOMINIO;
  }

  const hm = s => (s ? String(s).slice(0, 5) : '');
  function minutosDoDia(h) {
    const m = /^(\d{1,2}):(\d{2})/.exec(String(h || ''));
    return m ? +m[1] * 60 + +m[2] : null;
  }
  // Minutos de atraso, ou null se a hora estiver faltando ou a pessoa não chegou depois do horário
  function minutosDeAtraso(previsto, chegada) {
    const a = minutosDoDia(previsto), b = minutosDoDia(chegada);
    if (a == null || b == null || b <= a) return null;
    return b - a;
  }
  function textoAtraso(min) {
    if (min == null) return '';
    return min < 60 ? `${min} min` : `${Math.floor(min / 60)}h${String(min % 60).padStart(2, '0')}`;
  }
  // Atraso lançado antes da pessoa chegar: fica "em atraso" até o líder tocar em Chegou. Só o líder usa essa hora;
  // para o supervisor o que vale é a pessoa ter atrasado (ela já conta como ausente desde o lançamento).
  const atrasoPendente = l => !!l && l.tipo === 'atraso' && !l.hora_chegada;

  // ---------- Motivos que o líder escolhe ao lançar ----------
  // Ausência e atraso saem da mesma lista: escolher um motivo de atraso lança um atraso.
  // O líder também pode cadastrar motivos próprios em Ajustes e digitar um motivo na hora ("Outro").
  const OUTRO = '__outro__';            // valor da opção "Outro (digitar)" na lista
  const MAX_MOTIVO = 60;                // o banco aceita até 60 letras
  const MAX_MOTIVOS_PROPRIOS = 20;
  const GRUPOS_DE_MOTIVO = ['Ausência', 'Atraso', 'Meus motivos'];
  const limparMotivo = t => String(t == null ? '' : t).replace(/\s+/g, ' ').trim().slice(0, MAX_MOTIVO);
  const pareceAtraso = t => /^atras/.test(dobrar(t));      // "Atraso ônibus", "Atrasado" contam como atraso
  const ehMotivoDoSistema = t => MOTIVOS_AUSENCIA.concat(MOTIVOS_ATRASO).some(m => dobrar(m) === dobrar(t));

  // Todos os motivos, na ordem da lista: os do sistema e depois os do líder. prefs = { proprios: [{ texto, atraso }], padrao }
  function todosOsMotivos(prefs) {
    const proprios = (prefs && prefs.proprios) || [];
    return [
      ...MOTIVOS_AUSENCIA.map(texto => ({ texto, tipo: 'ausencia', grupo: GRUPOS_DE_MOTIVO[0] })),
      ...MOTIVOS_ATRASO.map(texto => ({ texto, tipo: 'atraso', grupo: GRUPOS_DE_MOTIVO[1] })),
      ...proprios.map(m => ({ texto: m.texto, tipo: m.atraso ? 'atraso' : 'ausencia', grupo: GRUPOS_DE_MOTIVO[2] })),
    ];
  }
  const gruposDeMotivos = prefs => {
    const todos = todosOsMotivos(prefs);
    return GRUPOS_DE_MOTIVO.map(grupo => ({ grupo, itens: todos.filter(m => m.grupo === grupo) })).filter(g => g.itens.length);
  };
  // O que o aparelho guardou pode estar velho ou mexido: só entra o que é válido
  function sanearPrefsMotivos(x) {
    const saida = { proprios: [], padrao: '' };
    if (!x || typeof x !== 'object') return saida;
    const vistos = new Set();
    for (const p of Array.isArray(x.proprios) ? x.proprios : []) {
      const texto = limparMotivo(p && p.texto), k = dobrar(texto);
      if (!texto || vistos.has(k) || ehMotivoDoSistema(texto)) continue;
      vistos.add(k);
      saida.proprios.push({ texto, atraso: !!(p && p.atraso) || pareceAtraso(texto) });
      if (saida.proprios.length >= MAX_MOTIVOS_PROPRIOS) break;
    }
    const padrao = limparMotivo(x.padrao);
    saida.padrao = padrao && todosOsMotivos(saida).some(m => dobrar(m.texto) === dobrar(padrao)) ? padrao : '';
    return saida;
  }
  // Motivo que já vem selecionado: o que o líder definiu em Ajustes, senão o primeiro da lista
  const motivoInicial = prefs => (prefs && prefs.padrao) || MOTIVOS_AUSENCIA[0];
  const motivoExiste = (texto, prefs) => todosOsMotivos(prefs).some(m => dobrar(m.texto) === dobrar(texto));
  // O que foi escolhido na lista (ou digitado em "Outro") vira { motivo, tipo }, ou { erro }
  function escolherMotivo(selecao, digitado, prefs) {
    const texto = limparMotivo(selecao === OUTRO ? digitado : selecao);
    if (!texto) return { erro: 'Digite o motivo.' };
    const achado = todosOsMotivos(prefs).find(m => dobrar(m.texto) === dobrar(texto));
    return achado ? { motivo: achado.texto, tipo: achado.tipo } : { motivo: texto, tipo: pareceAtraso(texto) ? 'atraso' : 'ausencia' };
  }
  // Motivo como o relatório dos supervisores conhece (os do sistema ficam como são). O motivo que o líder escreveu
  // conta como "Outros" (ou "Atraso motivo pessoal", se for atraso) e o texto dele segue por extenso ao lado.
  function motivoDoRelatorio(l) {
    if (MOTIVOS_AUSENCIA.includes(l.motivo) || MOTIVOS_ATRASO.includes(l.motivo)) return l.motivo;
    return l.tipo === 'atraso' ? 'Atraso motivo pessoal' : 'Outros';
  }

  const chaveDaPessoa = f => (f.matricula ? String(f.matricula) : dobrar(f.nome));

  // Quem já foi lançado no dia não aparece de novo na busca.
  // Ausência e atraso são excludentes entre si e com a saída; a saída antecipada só exclui quem faltou.
  function excluirDaBusca(lancs, tipo) {
    const tipos = tipo === 'saida' ? ['ausencia', 'saida'] : ['ausencia', 'atraso', 'saida'];
    return new Set((lancs || []).filter(l => tipos.includes(l.tipo)).map(chaveDaPessoa));
  }

  function buscarFuncionarios(funcs, termo, opcoes) {
    const t = dobrar(termo);
    if (!t) return [];
    const excluir = (opcoes && opcoes.excluir) || new Set();
    const max = (opcoes && opcoes.max) || 8;
    const soDigitos = /^\d+$/.test(t);
    const palavras = t.split(' ');
    const achados = [];
    for (const f of funcs) {
      if (f.ativo === false || excluir.has(chaveDaPessoa(f))) continue;
      const nome = dobrar(f.nome);
      let pontos = 0;
      if (soDigitos) { if (f.matricula && f.matricula.includes(t)) pontos = f.matricula.startsWith(t) ? 2 : 1; }
      else if (palavras.every(p => nome.includes(p))) pontos = nome.startsWith(t) ? 3 : 2;
      if (pontos) achados.push({ f, pontos });
    }
    achados.sort((a, b) => b.pontos - a.pontos || dobrar(a.f.nome).localeCompare(dobrar(b.f.nome)));
    return achados.slice(0, max).map(x => x.f);
  }

  // Problemas do cadastro que o supervisor precisa arrumar: matrícula repetida, em branco ou curta
  function problemasCadastro(funcs) {
    const ativos = funcs.filter(f => f.ativo !== false);
    const porMat = {};
    for (const f of ativos) if (f.matricula) (porMat[f.matricula] = porMat[f.matricula] || []).push(f);
    return {
      duplicadas: Object.entries(porMat).filter(([, l]) => l.length > 1).map(([matricula, pessoas]) => ({ matricula, pessoas })),
      semMatricula: ativos.filter(f => !f.matricula),
      curtas: ativos.filter(f => f.matricula && f.matricula.length < 7),
    };
  }

  // Números de um time num dia. "cem" = time 100% presente: enviou e ninguém faltou nem atrasou.
  function resumoDoTime(lancsDoTime, envio) {
    const aus = lancsDoTime.filter(l => l.tipo === 'ausencia');
    const atr = lancsDoTime.filter(l => l.tipo === 'atraso');
    const saidas = lancsDoTime.filter(l => l.tipo === 'saida');
    const pendentes = atr.filter(atrasoPendente);
    const conta = aus.length + (ATRASO_CONTA_COMO_AUSENTE ? atr.length : 0) + (SAIDA_CONTA_COMO_AUSENTE ? saidas.length : 0);
    return { aus, atr, saidas, pendentes, conta, cem: !!envio && !aus.length && !atr.length };
  }

  // ---------- Dos lançamentos para o formato dos fechamentos do sistema ----------
  // Só vira fechamento o time que o líder "enviou" (informou o efetivo do dia).
  // O texto que vai ao lado do nome. Sem horário: para o supervisor importa quem atrasou, não a hora que chegou.
  // O motivo que o líder escreveu (fora da lista do sistema), ou '' se ele escolheu um da lista
  const motivoEscrito = l => (motivoDoRelatorio(l) !== l.motivo ? l.motivo : '');
  function descricaoDaPessoa(l) {
    return [motivoEscrito(l), l.justificativa].filter(Boolean).join(' – ');
  }

  function contaNaAusencia(l) {
    return l.tipo === 'ausencia' || (l.tipo === 'atraso' && ATRASO_CONTA_COMO_AUSENTE) || (l.tipo === 'saida' && SAIDA_CONTA_COMO_AUSENTE);
  }

  function lancamentosParaFechamentos(lancs, envios) {
    const porTimeDia = {};
    for (const l of lancs || []) (porTimeDia[l.data + '|' + l.time] = porTimeDia[l.data + '|' + l.time] || []).push(l);
    const saida = {};
    for (const e of envios || []) {
      const k = e.data + '|' + e.time;
      const pessoas = (porTimeDia[k] || []).filter(contaNaAusencia).sort(porNome)
        .map(l => ({ matricula: l.matricula || '', nome: l.nome, motivo: motivoDoRelatorio(l), motivoOriginal: descricaoDaPessoa(l), motivoEscrito: motivoEscrito(l) }));
      const efetivo = Math.max(0, +e.efetivo || 0);
      const ausentes = Math.min(pessoas.length, efetivo);
      saida[k] = {
        data: e.data, time: e.time, turno: null, efetivo, presentes: efetivo - ausentes, ausentes,
        pessoas, texto: '', confirmadoEm: e.enviado_em || '', origem: 'lider',
      };
    }
    return saida;
  }

  // Cópia da base com os times dos líderes por cima (nada disso é salvo na base do supervisor)
  function mesclarBase(base, lancs, envios, timesDosLideres) {
    const fechamentos = Object.assign({}, base.fechamentos, lancamentosParaFechamentos(lancs, envios));
    const config = Object.assign({}, base.config);
    if (timesDosLideres && timesDosLideres.length) config.times = timesDosLideres.slice().sort(ordenarTimes);
    return Object.assign({}, base, { fechamentos, config });
  }

  // ---------- Textos ----------
  function dataBR(iso) { const [a, m, d] = String(iso).split('-'); return `${d}/${m}/${a}`; }
  const pct = (a, b) => (b ? (a / b * 100).toFixed(1).replace('.', ',') : '0,0') + '%';
  const quem = l => `${l.nome} (${l.matricula || 'sem matrícula'})`;
  const motivoTxt = l => `${l.motivo}${l.justificativa ? ': ' + l.justificativa : ''}`;

  const linhaAtraso = l => `• ${quem(l)} – ${motivoTxt(l)}`;
  const linhaSaida = l => `• ${quem(l)} – saiu ${hm(l.hora_saida)} – ${motivoTxt(l)}`;

  // Relação organizada por time, para o supervisor repassar ao superior
  function textoPorTime(data, lancs, envios, times) {
    const doDia = (lancs || []).filter(l => l.data === data);
    const env = {};
    for (const e of envios || []) if (e.data === data) env[e.time] = e;
    const todos = [...new Set(times.concat(Object.keys(env), doDia.map(l => l.time)))].sort(ordenarTimes);
    const L = [`*ABSENTEÍSMO POR TIME – ${dataBR(data)}*`];
    let efetivo = 0, ausentes = 0, nSaidas = 0;
    const pendentes = [];
    for (const t of todos) {
      const e = env[t];
      const r = resumoDoTime(doDia.filter(l => l.time === t), e);
      if (!e) pendentes.push(t);
      if (e) { efetivo += e.efetivo; ausentes += r.conta; }
      nSaidas += r.saidas.length;
      L.push('', `*${t}*` + (e ? (r.cem ? ` – 100% presente (${e.efetivo} de ${e.efetivo})` : ` – ${r.conta} de ${e.efetivo} (${pct(r.conta, e.efetivo)})`) : ' – ainda não enviou'));
      if (!r.aus.length && !r.atr.length && !r.saidas.length) { if (e) L.push('Sem ausências nem atrasos.'); continue; }
      if (r.aus.length) { L.push('Ausências:'); r.aus.slice().sort(porNome).forEach(l => L.push(`• ${quem(l)} – ${motivoTxt(l)}`)); }
      if (r.atr.length) { L.push('Atrasos:'); r.atr.slice().sort(porNome).forEach(l => L.push(linhaAtraso(l))); }
      if (r.saidas.length) { L.push('Saídas antecipadas:'); r.saidas.slice().sort(porNome).forEach(l => L.push(linhaSaida(l))); }
    }
    const resumo = [`Efetivo: ${efetivo} · Ausentes/atrasos: ${ausentes} (${pct(ausentes, efetivo)})`];
    if (nSaidas) resumo.push(`Saídas antecipadas: ${nSaidas}`);
    L.splice(1, 0, '', ...resumo);
    if (pendentes.length) L.push('', `*Ainda não enviaram:* ${pendentes.join(', ')}`);
    return L.join('\n');
  }

  // Trecho que o "texto para o superior" do WhatsApp não tem: saídas antecipadas (os atrasos já entram no texto como ausentes)
  function blocoExtras(data, lancs) {
    const doDia = (lancs || []).filter(l => l.data === data);
    const saidas = doDia.filter(l => l.tipo === 'saida').sort((a, b) => ordenarTimes(a.time, b.time) || porNome(a, b));
    const L = [];
    if (saidas.length) {
      L.push('', `Saídas antecipadas: ${saidas.length}`);
      saidas.forEach(l => L.push(`${l.nome} – ID ${l.matricula || '?'} – Equipe ${l.time} – saiu ${hm(l.hora_saida)} – ${motivoTxt(l)}`));
    }
    return L.join('\n');
  }

  // ---------- Prazo de envio ----------
  // O prazo só vale para o dia de hoje: depois da hora limite, quem não enviou está atrasado no envio.
  function passouDoPrazo(prazo, dataISO, hojeISO, agora) {
    if (!prazo || dataISO !== hojeISO) return false;
    const limite = minutosDoDia(prazo);
    const d = agora || new Date();
    return limite != null && d.getHours() * 60 + d.getMinutes() >= limite;
  }

  function textoCobranca(data, faltam, prazo) {
    if (!faltam || !faltam.length) return '';
    return [
      `*Absenteísmo ${dataBR(data)}*`,
      `Ainda falta enviar: *${faltam.join(', ')}*`,
      prazo ? `O prazo de envio era ${hm(prazo)}.` : '',
      'Por favor, enviem assim que possível. Obrigado!',
    ].filter(Boolean).join('\n');
  }

  // ---------- WhatsApp ----------
  // O link do WhatsApp aceita textos de tamanho limitado; acima disso o texto vai por cópia.
  const LIMITE_LINK_WHATS = 6000;
  const cabeNoLink = texto => encodeURIComponent(String(texto)).length <= LIMITE_LINK_WHATS;
  const whatsappUrl = texto => 'https://wa.me/?text=' + encodeURIComponent(String(texto));

  // ---------- CSV dos lançamentos (mesmo cuidado do CSV do leitor com fórmulas do Excel) ----------
  function celulaCsv(v) {
    let s = String(v == null ? '' : v);
    if (typeof v !== 'number' && /^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }
  const NOME_TIPO = { ausencia: 'Ausência', atraso: 'Atraso', saida: 'Saída antecipada' };
  const DIAS = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
  const diaDaSemanaISO = iso => DIAS[new Date(iso + 'T12:00:00Z').getUTCDay()];

  // Uma linha por lançamento, com tudo: também vale para a aba do Excel
  function linhasLancamentos(lancs) {
    return (lancs || []).slice().sort((a, b) => a.data.localeCompare(b.data) || ordenarTimes(a.time, b.time) || porNome(a, b)).map(l => {
      const min = minutosDeAtraso(l.hora_prevista, l.hora_chegada);
      const situacao = l.tipo === 'atraso' ? (atrasoPendente(l) ? 'Aguardando chegada' : 'Chegou') : '';
      return [l.data, diaDaSemanaISO(l.data), l.time, NOME_TIPO[l.tipo] || l.tipo, l.matricula || '', l.nome, l.motivo, l.justificativa || '',
        hm(l.hora_prevista), hm(l.hora_chegada), min == null ? '' : min, hm(l.hora_saida), situacao, l.criado_em || ''];
    });
  }
  const CABECALHO_LANCAMENTOS = ['Data', 'Dia da semana', 'Time', 'Tipo', 'Matrícula', 'Nome', 'Motivo', 'Justificativa',
    'Horário do turno', 'Chegada', 'Atraso (min)', 'Saída', 'Situação', 'Registrado em'];
  function csvLancamentos(lancs) {
    const linhas = linhasLancamentos(lancs).map(l => { const c = l.slice(); c[0] = dataBR(c[0]); return c; });
    return '﻿' + [CABECALHO_LANCAMENTOS].concat(linhas).map(l => l.map(celulaCsv).join(';')).join('\r\n');
  }
  const CABECALHO_ENVIOS = ['Data', 'Time', 'Efetivo informado', 'Enviado em'];
  const linhasEnvios = envios => (envios || []).slice().sort((a, b) => a.data.localeCompare(b.data) || ordenarTimes(a.time, b.time))
    .map(e => [e.data, e.time, e.efetivo, e.enviado_em || '']);

  // ---------- Fila offline do líder ----------
  // Cada operação: { id, op: 'ins'|'upd'|'del'|'env'|'envdel', dia, time, dados }
  // Menos operações = menos chance de erro: apagar o que ainda nem subiu cancela os dois; editar o que ainda
  // nem subiu muda o próprio lançamento; só o último envio do dia vale.
  function compactarFila(fila) {
    const saida = [];
    for (const op of fila || []) {
      if (op.op === 'upd' || op.op === 'del') {
        const i = saida.findIndex(x => x.op === 'ins' && x.dados.id === op.dados.id);
        if (i >= 0) {
          if (op.op === 'del') saida.splice(i, 1);
          else saida[i] = Object.assign({}, saida[i], { dados: Object.assign({}, saida[i].dados, op.dados.mudar) });
          continue;
        }
        if (op.op === 'upd') {
          const j = saida.findIndex(x => x.op === 'upd' && x.dados.id === op.dados.id);
          if (j >= 0) { saida[j] = Object.assign({}, saida[j], { dados: { id: op.dados.id, mudar: Object.assign({}, saida[j].dados.mudar, op.dados.mudar) } }); continue; }
        }
      }
      if (op.op === 'env' || op.op === 'envdel') {
        const j = saida.findIndex(x => (x.op === 'env' || x.op === 'envdel') && x.dia === op.dia && x.time === op.time);
        if (j >= 0) saida.splice(j, 1);
      }
      saida.push(op);
    }
    return saida;
  }

  // Aplica operações pendentes por cima do que veio do servidor, só as do dia e do time em tela
  function aplicarFila(lancs, envio, fila, dia, time) {
    let l = (lancs || []).slice(), e = envio || null;
    for (const op of fila || []) {
      if (op.dia !== dia || op.time !== time) continue;
      if (op.op === 'ins') { l = l.filter(x => x.id !== op.dados.id).concat([Object.assign({}, op.dados)]); }
      else if (op.op === 'upd') l = l.map(x => (x.id === op.dados.id ? Object.assign({}, x, op.dados.mudar) : x));
      else if (op.op === 'del') l = l.filter(x => x.id !== op.dados.id);
      else if (op.op === 'env') e = Object.assign({}, e || {}, op.dados);
      else if (op.op === 'envdel') e = null;
    }
    return { lancs: l, envio: e };
  }

  // Erro de rede (vale tentar de novo) ou recusa do servidor (não adianta insistir)?
  function erroDeRede(err, online) {
    if (online === false) return true;
    const t = String((err && (err.message || err.details)) || err || '');
    return /failed to fetch|networkerror|network request|load failed|timeout|fetch/i.test(t) && !(err && err.code);
  }
  function erroDeSessao(err) {
    const t = String((err && (err.message || err.details)) || '');
    return !!err && (err.status === 401 || err.code === 'PGRST301' || /jwt|not authenticated|invalid claim/i.test(t));
  }

  // ---------- Registro de alterações (auditoria) em português ----------
  const CAMPOS_LANC = { motivo: 'motivo', justificativa: 'justificativa', hora_prevista: 'horário do turno', hora_chegada: 'chegada', hora_saida: 'saída', tipo: 'tipo' };
  const CAMPOS_FUNC = { nome: 'nome', matricula: 'matrícula', time: 'time', cargo: 'cargo', turno: 'turno' };
  function diferencas(antes, depois, campos) {
    const v = x => (x == null || x === '' ? '—' : String(x).slice(0, 40));
    const norm = (k, x) => (/^hora_/.test(k) ? hm(x) : x);
    return Object.keys(campos).filter(k => norm(k, (antes || {})[k]) !== norm(k, (depois || {})[k]))
      .map(k => `${campos[k]}: ${v(norm(k, antes[k]))} → ${v(norm(k, depois[k]))}`);
  }
  function descreverAuditoria(a) {
    const antes = a.antes || {}, depois = a.depois || {}, d = a.depois || a.antes || {};
    const quem = a.usuario || 'sistema';
    let texto = '';
    if (a.tabela === 'lancamentos') {
      const tipo = { ausencia: 'ausência', atraso: 'atraso', saida: 'saída antecipada' }[d.tipo] || 'lançamento';
      const pessoa = `${d.nome || '?'}${d.matricula ? ' (' + d.matricula + ')' : ''}`;
      if (a.acao === 'INSERT') texto = `Lançou ${tipo} de ${pessoa}`;
      else if (a.acao === 'DELETE') texto = `Apagou ${tipo} de ${pessoa}`;
      else { const df = diferencas(antes, depois, CAMPOS_LANC); texto = `Alterou ${tipo} de ${pessoa}${df.length ? ': ' + df.join('; ') : ''}`; }
    } else if (a.tabela === 'envios') {
      if (a.acao === 'INSERT') texto = `Enviou o time (efetivo ${d.efetivo})`;
      else if (a.acao === 'DELETE') texto = 'Desfez o envio do time';
      else texto = `Atualizou o envio (efetivo ${antes.efetivo} → ${depois.efetivo})`;
    } else if (a.tabela === 'funcionarios') {
      const pessoa = `${d.nome || '?'}${d.matricula ? ' (' + d.matricula + ')' : ''}`;
      if (a.acao === 'INSERT') texto = `Cadastrou ${pessoa} no ${d.time}`;
      else if (a.acao === 'DELETE') texto = `Removeu ${pessoa} do cadastro`;
      else if (antes.ativo !== depois.ativo && !diferencas(antes, depois, CAMPOS_FUNC).length) texto = `${depois.ativo ? 'Reativou' : 'Desativou'} ${pessoa}`;
      else { const df = diferencas(antes, depois, CAMPOS_FUNC); if (antes.ativo !== depois.ativo) df.push(depois.ativo ? 'reativado' : 'desativado'); texto = `Alterou o cadastro de ${pessoa}: ${df.join('; ')}`; }
    } else if (a.tabela === 'perfis') {
      if (a.acao === 'INSERT') texto = `Criou o login ${d.usuario}${d.time ? ' do time ' + d.time : ''}`;
      else if (a.acao === 'DELETE') texto = `Removeu o login ${d.usuario}`;
      else if (antes.ativo !== depois.ativo) texto = `${depois.ativo ? 'Reativou' : 'Desativou'} o login ${d.usuario}`;
      else if (antes.entrada_turno !== depois.entrada_turno) texto = `Definiu o horário do turno de ${d.usuario}: ${hm(depois.entrada_turno) || '—'}`;
      else texto = `Alterou o login ${d.usuario}`;
    } else if (a.tabela === 'parametros') {
      texto = d.chave === 'hora_limite' ? `Definiu o prazo de envio: ${d.valor}` : `Alterou a configuração ${d.chave}`;
    } else texto = `${a.acao} em ${a.tabela}`;
    return { quando: a.quando, quem, time: a.time || '', texto };
  }

  // ---------- Importar cadastro de funcionários de uma planilha ----------
  const limpar = (s, max) => String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
  const soNumeros = s => String(s == null ? '' : s).replace(/\D/g, '');
  const ehMatricula = s => /^\d{4,9}$/.test(String(s || '').trim());

  // Lê as abas como o Excel do RH manda (cabeçalho às vezes desalinhado): acha as colunas pelo conteúdo.
  // Só entram nome, matrícula, time, cargo e turno. CPF, telefone e o resto NUNCA são lidos.
  function interpretarPlanilha(abas, timesConhecidos) {
    const registros = [], avisos = [];
    const conhecidos = {}; (timesConhecidos || []).forEach(t => { conhecidos[dobrar(t)] = t; });
    for (const aba of abas || []) {
      const linhas = (aba.linhas || []).slice(0, 5000);
      if (!linhas.length) continue;
      // cabeçalho: primeira linha (das 5 primeiras) com pelo menos 3 títulos conhecidos
      const TITULOS = /(^|\W)(name|nome|team|equipe|time|posi|cargo|turno|group|id|matr|sex)/;
      let iCab = -1;
      for (let i = 0; i < Math.min(5, linhas.length); i++) if (linhas[i].filter(c => TITULOS.test(dobrar(c))).length >= 3) { iCab = i; break; }
      const cab = iCab >= 0 ? linhas[iCab].map(c => dobrar(c)) : [];
      const dados = linhas.slice(iCab + 1).filter(l => l.some(c => String(c).trim() !== ''));
      if (!dados.length) continue;
      const nCols = Math.min(30, Math.max(...dados.map(l => l.length)));
      const col = i => dados.map(l => String(l[i] == null ? '' : l[i]).trim()).filter(Boolean);
      const taxa = (i, fn) => { const c = col(i); return c.length ? c.filter(fn).length / c.length : 0; };
      const achar = re => { for (let i = 0; i < nCols; i++) if (re.test(cab[i] || '')) return i; return -1; };
      // matrícula: a coluna em que quase tudo tem 4 a 9 dígitos (o cabeçalho pode estar trocado com "sexo")
      let iMat = -1, melhor = 0.5;
      for (let i = 0; i < nCols; i++) { const t = taxa(i, ehMatricula); if (t > melhor || (t === melhor && iMat >= 0 && /matr|(^|\W)id($|\W)/.test(cab[i] || ''))) { melhor = t; iMat = i; } }
      // nome: coluna do cabeçalho "name/nome"; senão a primeira em que a maioria tem 2+ palavras só de letras
      let iNome = achar(/(^|\W)(name|nome)/);
      if (iNome < 0) for (let i = 0; i < nCols; i++) if (i !== iMat && taxa(i, s => /^[a-zà-ÿ' .-]{5,}$/i.test(s) && s.includes(' ')) > 0.6) { iNome = i; break; }
      let iTime = achar(/(^|\W)(team|equipe|time)($|\W)/);
      const iCargo = achar(/posi|cargo/);
      const iTurno = achar(/turno/);
      if (iNome < 0) { avisos.push(`Aba "${aba.nome}": não achei a coluna de nomes. Ignorada.`); continue; }
      let nSem = 0;
      for (const l of dados) {
        const nome = limpar(l[iNome], 120);
        if (nome.length < 3 || /^\d+$/.test(nome)) continue;
        let time = iTime >= 0 ? limpar(l[iTime], 60).toUpperCase() : limpar(aba.nome, 60).toUpperCase();
        if (!time) time = limpar(aba.nome, 60).toUpperCase();
        time = conhecidos[dobrar(time)] || time;
        const matricula = iMat >= 0 && ehMatricula(l[iMat]) ? soNumeros(l[iMat]) : '';
        if (!matricula) nSem++;
        registros.push({ nome, matricula, time, cargo: iCargo >= 0 ? limpar(l[iCargo], 60) : '', turno: iTurno >= 0 ? limpar(l[iTurno], 30) : '', aba: aba.nome });
      }
      if (nSem) avisos.push(`Aba "${aba.nome}": ${nSem} pessoa(s) sem matrícula válida.`);
    }
    return { registros: registros.slice(0, 3000), avisos };
  }

  // Compara a planilha com o cadastro atual: quem é novo, quem mudou, quem sumiu.
  function compararCadastro(atuais, novos) {
    const usados = new Set();
    const porMat = {}, porNome = {};
    for (const a of atuais) {
      if (a.matricula) (porMat[a.matricula] = porMat[a.matricula] || []).push(a);
      (porNome[dobrar(a.nome)] = porNome[dobrar(a.nome)] || []).push(a);
    }
    const livre = lista => (lista || []).filter(a => !usados.has(a.id));
    const res = { novos: [], alterados: [], iguais: 0, ausentes: [], reativar: [] };
    for (const n of novos) {
      let alvo = null;
      const mesmoNome = livre(porNome[dobrar(n.nome)]);
      if (n.matricula) {
        const porM = livre(porMat[n.matricula]);
        alvo = porM.find(a => dobrar(a.nome) === dobrar(n.nome)) || (porM.length === 1 && !mesmoNome.length ? porM[0] : null)
          || mesmoNome.find(a => !a.matricula) || null;   // quem estava sem matrícula ganha a matrícula
      } else if (mesmoNome.length === 1) alvo = mesmoNome[0];
      else alvo = mesmoNome.find(a => a.time === n.time) || null;
      if (!alvo) { res.novos.push(n); continue; }
      usados.add(alvo.id);
      const mudancas = [];
      if (dobrar(alvo.nome) !== dobrar(n.nome)) mudancas.push(`nome: ${alvo.nome} → ${n.nome}`);
      if (n.matricula && alvo.matricula !== n.matricula) mudancas.push(`matrícula: ${alvo.matricula || '—'} → ${n.matricula}`);
      if (alvo.time !== n.time) mudancas.push(`time: ${alvo.time} → ${n.time}`);
      if (n.cargo && alvo.cargo !== n.cargo) mudancas.push(`cargo: ${alvo.cargo || '—'} → ${n.cargo}`);
      if (n.turno && alvo.turno !== n.turno) mudancas.push(`turno: ${alvo.turno || '—'} → ${n.turno}`);
      const volta = alvo.ativo === false;
      if (volta) mudancas.push('reativar');
      if (!mudancas.length) { res.iguais++; continue; }
      const mudar = {};
      if (dobrar(alvo.nome) !== dobrar(n.nome)) mudar.nome = n.nome;
      if (n.matricula && alvo.matricula !== n.matricula) mudar.matricula = n.matricula;
      if (alvo.time !== n.time) mudar.time = n.time;
      if (n.cargo && alvo.cargo !== n.cargo) mudar.cargo = n.cargo;
      if (n.turno && alvo.turno !== n.turno) mudar.turno = n.turno;
      if (volta) mudar.ativo = true;
      res.alterados.push({ atual: alvo, mudancas, mudar });
    }
    res.ausentes = atuais.filter(a => a.ativo !== false && !usados.has(a.id));
    return res;
  }

  // ---------- Senha, backup e inatividade ----------
  const SENHA_MINIMA = 4;
  // Motivo de a senha ser fraca, ou '' se serve. Mínimo de 4 caracteres; só barra o que qualquer um adivinha.
  // A regra final de tamanho é a do Supabase (Authentication > Minimum password length).
  function senhaFraca(senha, usuario) {
    const s = String(senha || '');
    if (s.length < SENHA_MINIMA) return `Use pelo menos ${SENHA_MINIMA} caracteres.`;
    if (s.length > 72) return 'Senha longa demais (máximo 72 caracteres).';
    if (/^(.)\1+$/.test(s)) return 'Não use o mesmo caractere repetido (como 0000).';
    const b = dobrar(s), u = dobrar(usuario || '').replace(/@.*$/, '');
    if (u.length >= 2 && b.includes(u)) return 'A senha não pode conter o seu usuário.';
    if (/^(0123|1234|2345|3456|4567|5678|6789|9876|8765|7654|6543|5432|4321|3210|abcd|qwer|senha|admin|teste|password|absenteismo)/.test(b)) return 'Essa senha é fácil de adivinhar (como 1234 ou senha). Escolha outra.';
    return '';
  }
  const diasSemBackup = (ultimoMs, agoraMs) => (Number.isFinite(ultimoMs) ? Math.max(0, Math.floor((agoraMs - ultimoMs) / 86400000)) : null);
  const deveSairPorInatividade = (ultimaAtividadeMs, agoraMs, limiteMin) => agoraMs - ultimaAtividadeMs >= limiteMin * 60000;

  // ---------- Equipe: perfil do colaborador e KPIs ----------
  const MIN_DIAS_TAXA = 5;          // com menos dias de histórico o % engana (uma falta em um dia seria 100%)
  const MAX_NOME = 120, MAX_CARGO = 60, MAX_TURNO = 30, MAX_MATRICULA = 20;
  const MAX_COLABORADORES = 500;    // o banco também trava nesse número, por time
  const NOMES_DIA = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
  const somarDiasIso = (iso, n) => { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  const diasEntre = (de, ate) => Math.round((Date.parse(ate + 'T12:00:00Z') - Date.parse(de + 'T12:00:00Z')) / 86400000);
  const diaDaSemanaIso = iso => new Date(iso + 'T12:00:00Z').getUTCDay();   // 0 = domingo
  const limpaTexto = s => String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();

  // "Maria Souza Lima" -> "ML"
  function iniciais(nome) {
    const p = limpaTexto(nome).split(' ').filter(Boolean);
    if (!p.length) return '?';
    const a = Array.from(p[0])[0], b = p.length > 1 ? Array.from(p[p.length - 1])[0] : '';
    return (a + b).toUpperCase();
  }

  // Os lançamentos guardam matrícula e nome (não o id da pessoa). É a mesma regra do banco para "uma vez por dia":
  // vale a matrícula quando os dois têm; senão vale o nome (sem acento nem maiúscula).
  // Devolve um Map: id do colaborador -> lançamentos dele.
  function lancamentosPorPessoa(funcs, lancs) {
    const porMat = new Map(), porNome = new Map();
    const guarda = (m, k, v) => { const l = m.get(k); if (l) l.push(v); else m.set(k, [v]); };
    for (const l of lancs || []) {
      if (l.matricula) guarda(porMat, String(l.matricula), l);
      guarda(porNome, dobrar(l.nome), l);
    }
    const saida = new Map();
    for (const f of funcs || []) {
      const nome = porNome.get(dobrar(f.nome)) || [];
      saida.set(f.id, f.matricula ? (porMat.get(String(f.matricula)) || []).concat(nome.filter(l => !l.matricula)) : nome);
    }
    return saida;
  }

  // O que a pessoa está hoje (ou no dia aberto): ausente, em atraso/atrasou, saiu mais cedo, ou null (sem ocorrência)
  function situacaoNoDia(lancsDaPessoa) {
    const l = lancsDaPessoa || [];
    if (l.some(x => x.tipo === 'ausencia')) return { tipo: 'falta', rotulo: 'Ausente' };
    const atr = l.find(x => x.tipo === 'atraso');
    if (atr) return atrasoPendente(atr) ? { tipo: 'andamento', rotulo: 'Em atraso' } : { tipo: 'andamento', rotulo: 'Atrasou' };
    if (l.some(x => x.tipo === 'saida')) return { tipo: 'saida', rotulo: 'Saiu mais cedo' };
    return null;
  }

  const periodoDe = (hoje, dias) => ({ de: dias > 0 ? somarDiasIso(hoje, -(dias - 1)) : '', ate: hoje });
  const dentroDe = (data, p) => data <= p.ate && (!p.de || data >= p.de);
  // Quantos dias o time teve movimento no período (enviou o dia ou lançou alguém): é a base do %
  function diasComMovimento(lancs, envios, hoje, dias, aPartirDe) {
    const p = periodoDe(hoje, dias), vistos = new Set();
    if (aPartirDe && aPartirDe > p.de) p.de = aPartirDe;      // quem entrou depois só conta os dias desde que entrou
    for (const l of lancs || []) if (dentroDe(l.data, p)) vistos.add(l.data);
    for (const e of envios || []) if (dentroDe(e.data, p)) vistos.add(e.data);
    return vistos.size;
  }

  // Desde quando contar os dias de uma pessoa: o dia em que ela entrou no sistema, ou o primeiro lançamento dela se for mais antigo.
  // Sem nenhuma das duas datas, conta tudo ('').
  function inicioDaPessoa(f, ocorrencias) {
    const datas = (ocorrencias || []).map(l => l.data);
    const d = f && f.criado_em ? new Date(f.criado_em) : null;
    if (d && !isNaN(d)) datas.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
    return datas.length ? datas.reduce((a, b) => (a < b ? a : b)) : '';
  }

  // Números de uma pessoa no período (dias: 30, 90 ou 0 = tudo). "ocorrencias" = lançamentos dela; diasBase = diasComMovimento
  function kpisDaPessoa(ocorrencias, diasBase, hoje, dias) {
    const p = periodoDe(hoje, dias);
    const lista = (ocorrencias || []).filter(l => dentroDe(l.data, p))
      .sort((a, b) => (a.data < b.data ? 1 : a.data > b.data ? -1 : String(b.criado_em || '').localeCompare(String(a.criado_em || ''))));
    const aus = lista.filter(l => l.tipo === 'ausencia'), atr = lista.filter(l => l.tipo === 'atraso'), sai = lista.filter(l => l.tipo === 'saida');
    const contam = lista.filter(contaNaAusencia);
    const diasAusente = new Set(contam.map(l => l.data)).size;
    const minutos = atr.map(l => minutosDeAtraso(l.hora_prevista, l.hora_chegada)).filter(m => m != null);
    const taxaValida = diasBase >= MIN_DIAS_TAXA;
    const ultima = contam[0] || null;
    const motivos = new Map();
    for (const l of lista) { const k = dobrar(l.motivo); const m = motivos.get(k) || { motivo: l.motivo, n: 0 }; m.n++; motivos.set(k, m); }
    const semana = [0, 0, 0, 0, 0, 0, 0];
    for (const l of contam) semana[diaDaSemanaIso(l.data)]++;
    const topo = Math.max(...semana);
    return {
      de: p.de, diasBase, ausencias: aus.length, atrasos: atr.length, saidas: sai.length, diasAusente,
      presentes: Math.max(0, diasBase - diasAusente),
      taxa: taxaValida ? diasAusente / diasBase * 100 : null, taxaValida,
      atrasoMinutos: minutos.reduce((s, m) => s + m, 0), atrasoMedia: minutos.length ? Math.round(minutos.reduce((s, m) => s + m, 0) / minutos.length) : null,
      ultima, diasSemFaltar: ultima ? Math.max(0, diasEntre(ultima.data, hoje)) : null,
      motivos: [...motivos.values()].sort((a, b) => b.n - a.n || dobrar(a.motivo).localeCompare(dobrar(b.motivo))).map(m => ({ motivo: m.motivo, n: m.n, pct: m.n / lista.length * 100 })),
      semana, diaTopo: topo >= 2 ? { dia: semana.indexOf(topo), nome: NOMES_DIA[semana.indexOf(topo)], n: topo } : null,
      historico: lista,
    };
  }

  // O valor mais comum de um campo no time (para já vir preenchido ao cadastrar), ou o padrão
  function valorMaisComum(funcs, campo, padrao) {
    const n = new Map();
    for (const f of funcs || []) { const v = limpaTexto(f[campo]); if (v) n.set(v, (n.get(v) || 0) + 1); }
    let melhor = padrao || '', max = 0;
    for (const [v, q] of n) if (q > max) { melhor = v; max = q; }
    return melhor;
  }

  // Confere o colaborador novo antes de mandar ao banco. aviso = pergunta para confirmar (nome igual ao de alguém do time)
  function validarNovoColaborador(d, funcs) {
    const nome = limpaTexto(d && d.nome), cargo = limpaTexto(d && d.cargo), turno = limpaTexto(d && d.turno);
    const matricula = String((d && d.matricula) || '').replace(/\D/g, '');
    const ativos = (funcs || []).filter(f => f.ativo !== false);
    const res = { erro: '', aviso: '', dados: { nome, matricula, cargo, turno } };
    if (!nome) res.erro = 'Digite o nome do colaborador.';
    else if (nome.length < 3 || !/\p{L}{2}/u.test(nome)) res.erro = 'Digite o nome completo do colaborador.';
    else if (nome.length > MAX_NOME) res.erro = 'Nome longo demais (máximo ' + MAX_NOME + ' letras).';
    else if (matricula.length > MAX_MATRICULA) res.erro = 'Matrícula longa demais (máximo ' + MAX_MATRICULA + ' números).';
    else if (cargo.length > MAX_CARGO) res.erro = 'Cargo longo demais (máximo ' + MAX_CARGO + ' letras).';
    else if (turno.length > MAX_TURNO) res.erro = 'Turno longo demais (máximo ' + MAX_TURNO + ' letras).';
    else if (ativos.length >= MAX_COLABORADORES) res.erro = 'O time já tem ' + MAX_COLABORADORES + ' colaboradores, que é o limite.';
    if (res.erro) return res;
    const mesmaMat = matricula && ativos.find(f => f.matricula === matricula);
    if (mesmaMat) { res.erro = 'A matrícula ' + matricula + ' já é de ' + mesmaMat.nome + '.'; return res; }
    const mesmoNome = ativos.find(f => dobrar(f.nome) === dobrar(nome));
    if (mesmoNome) res.aviso = 'Já existe ' + mesmoNome.nome + (mesmoNome.matricula ? ' (matrícula ' + mesmoNome.matricula + ')' : '') + ' neste time. Cadastrar outra pessoa com o mesmo nome?';
    return res;
  }

  const Lideres = {
    MIN_DIAS_TAXA, MAX_NOME, MAX_CARGO, MAX_TURNO, MAX_MATRICULA, MAX_COLABORADORES, NOMES_DIA,
    iniciais, lancamentosPorPessoa, situacaoNoDia, diasComMovimento, inicioDaPessoa, kpisDaPessoa, valorMaisComum, validarNovoColaborador,
    SENHA_MINIMA, senhaFraca, diasSemBackup, deveSairPorInatividade,
    DOMINIO, MOTIVOS_AUSENCIA, MOTIVOS_ATRASO, MOTIVOS_SAIDA, ATRASO_CONTA_COMO_AUSENTE, SAIDA_CONTA_COMO_AUSENTE,
    emailDoUsuario, hm, minutosDoDia, minutosDeAtraso, textoAtraso, atrasoPendente, chaveDaPessoa, excluirDaBusca,
    buscarFuncionarios, problemasCadastro, resumoDoTime, descricaoDaPessoa, lancamentosParaFechamentos, mesclarBase,
    textoPorTime, blocoExtras, ordenarTimes,
    OUTRO, MAX_MOTIVO, MAX_MOTIVOS_PROPRIOS, limparMotivo, pareceAtraso, todosOsMotivos, gruposDeMotivos, sanearPrefsMotivos, motivoInicial, motivoExiste, escolherMotivo, motivoDoRelatorio,
    passouDoPrazo, textoCobranca, cabeNoLink, whatsappUrl, LIMITE_LINK_WHATS, celulaCsv, linhasLancamentos, CABECALHO_LANCAMENTOS, csvLancamentos,
    CABECALHO_ENVIOS, linhasEnvios, compactarFila, aplicarFila, erroDeRede, erroDeSessao, descreverAuditoria, interpretarPlanilha, compararCadastro,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = Lideres;
  else raiz.Lideres = Lideres;
})(typeof window !== 'undefined' ? window : globalThis);
