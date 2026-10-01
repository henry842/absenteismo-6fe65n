// Telas novas: o líder lança ausências e atrasos do time; o supervisor recebe tudo e cuida da equipe.
// Fala direto com o banco (Supabase). As regras de quem pode ver e gravar o quê ficam no banco (RLS).
(function () {
  'use strict';
  const D = window.Lideres;
  const L = window.Leitor;
  const $ = s => document.querySelector(s);
  let ctx = null;   // ajudantes que o app.js passa (ic, esc, aviso, copiar, hoje, vazio)
  let supa = null, perfil = null;
  let prazo = null; // hora limite de envio, igual para todos (ex.: "16:00")

  const DIAS = 90;  // quanto histórico o supervisor carrega de início (o resto vem sob demanda)
  // Aba Equipe do líder: o que está aberto na tela e o histórico do time (últimos 90 dias) para os indicadores
  function novoEquipe() { return { busca: '', filtro: 'todos', aberto: null, periodo: 30, cadastro: false, form: { nome: '', matricula: '', cargo: '', turno: '' }, editando: null, formEd: { nome: '', cargo: '', turno: '' }, ocupado: false, verTudo: false }; }
  function novoHist() { return { lancs: [], envios: [], desde: null, tudo: false, carregado: false, carregando: false, tentou: false, falhou: false, offline: false }; }
  const est = { funcs: [], lancs: [], envios: [], lideres: [], ok: false, desde: null, credenciais: [], filtroEquipe: '', buscaEquipe: '', soProblemas: false, dataRec: null, editandoFunc: null, importacao: null, auditoria: null };
  const lider = { dia: null, aba: 'ausencia', sel: { ausencia: null, atraso: null, saida: null }, manual: { ausencia: false, atraso: false, saida: false }, editando: null, modoEd: null, motivo: '', outro: '', horaChegou: '', funcs: [], lancs: [], envio: null, fila: [], offline: false, sessaoExpirada: false, equipe: novoEquipe(), hist: novoHist() };

  const esc = s => ctx.esc(s);
  const ic = (n, x) => ctx.ic(n, x);
  const soDigitos = s => String(s || '').replace(/\D/g, '').slice(0, 20);
  const hmAgora = iso => { try { return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); } catch (e) { return ''; } };
  const dataHoraBR = iso => { try { const d = new Date(iso); return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); } catch (e) { return ''; } };
  const somarDias = (iso, n) => { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  const diaSemana = iso => { const s = L.DIAS_SEMANA[L.diaDaSemana(iso)]; return s.charAt(0).toUpperCase() + s.slice(1); };
  const ehData = s => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
  const novoId = () => (window.crypto && crypto.randomUUID ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = crypto.getRandomValues(new Uint8Array(1))[0] % 16; return (c === 'x' ? r : (r & 3) | 8).toString(16); }));

  function ligar(ajudantes) { ctx = ajudantes; }

  // Mensagem de erro do banco em português simples
  function falha(e) {
    const t = String((e && (e.message || e.details)) || e || '');
    if (e && e.code === '23505') return 'Essa pessoa já foi lançada nesse dia. Use "Hoje" para editar.';
    if (e && e.code === '54000') return 'Limite de lançamentos do dia atingido para este time.';
    if (/row-level security|permission denied/i.test(t)) return 'Sem permissão para isso (ou o dia é antigo demais para alterar).';
    if (/fetch|network|failed to/i.test(t)) return 'Sem internet. Conecte-se e tente de novo.';
    return 'Não deu certo: ' + t;
  }

  async function paginar(consulta) {
    const saida = [];
    for (let i = 0; ; i += 1000) {
      const { data, error } = await consulta(i, i + 999);
      if (error) throw error;
      saida.push(...data);
      if (data.length < 1000) break;
    }
    return saida;
  }

  // ---------- Guarda neste aparelho: fila offline, cópia do que o líder viu, textos editados ----------
  // Tudo isso é apagado ao sair da conta (aparelho compartilhado não fica com nomes de funcionários).
  // 'motivos' (motivos próprios do líder e o já selecionado) não tem nome de ninguém: fica mesmo depois de sair da conta
  const CH = { fila: 'absenteismo.fila.', cache: 'absenteismo.lider.', ultimo: 'absenteismo.lider.ultimo', texto: 'absenteismo.textoSuperior.', motivos: 'absenteismo.motivos.' };
  const ls = {
    ler(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    gravar(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } },
    apagar(k) { try { localStorage.removeItem(k); } catch (e) { /* sem problema */ } },
    chaves(prefixo) { const r = []; try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith(prefixo)) r.push(k); } } catch (e) { /* ok */ } return r; },
  };
  const lerJSON = (k, padrao) => { try { const v = JSON.parse(ls.ler(k)); return v == null ? padrao : v; } catch (e) { return padrao; } };

  function limparDadosLocais() {
    [CH.fila, CH.cache, CH.texto].forEach(p => ls.chaves(p).forEach(k => ls.apagar(k)));
  }

  // Motivos que o líder cadastrou em Ajustes e o que já vem selecionado ao lançar (por login, neste aparelho)
  const chaveMotivos = () => CH.motivos + perfil.user_id;
  const prefsMotivos = () => D.sanearPrefsMotivos(lerJSON(chaveMotivos(), null));
  const guardarPrefsMotivos = p => ls.gravar(chaveMotivos(), JSON.stringify(D.sanearPrefsMotivos(p)));

  const chaveCache = uid => CH.cache + uid;
  function lerCache(uid) {
    const c = lerJSON(chaveCache(uid), null);
    const ok = c && typeof c === 'object';
    return { perfil: ok && c.perfil && typeof c.perfil === 'object' ? c.perfil : null, funcs: ok && Array.isArray(c.funcs) ? c.funcs : [],
      dias: ok && c.dias && typeof c.dias === 'object' ? c.dias : {}, prazo: ok && typeof c.prazo === 'string' ? c.prazo : null,
      hist: ok && c.hist && typeof c.hist === 'object' && Array.isArray(c.hist.lancs) ? { desde: typeof c.hist.desde === 'string' ? c.hist.desde : '', tudo: !!c.hist.tudo, lancs: c.hist.lancs, envios: Array.isArray(c.hist.envios) ? c.hist.envios : [] } : null };
  }
  function mudarCache(uid, fn) {
    const c = lerCache(uid); fn(c);
    const dias = Object.keys(c.dias).sort();
    while (dias.length > 5) delete c.dias[dias.shift()];
    ls.gravar(chaveCache(uid), JSON.stringify(c));
  }

  // ---------- Perfil (líder ou supervisor) ----------
  // Devolve o perfil, null se a conta não tem acesso, e lança erro se não deu para consultar.
  // Líder sem internet abre com o último perfil guardado neste aparelho.
  async function carregarPerfil(cliente, usuario) {
    supa = cliente;
    try {
      const { data, error } = await supa.from('perfis').select('user_id,papel,usuario,nome,time,entrada_turno,ativo').eq('user_id', usuario.id).maybeSingle();
      if (error) throw error;
      perfil = data && data.ativo ? data : null;
      // outra pessoa neste aparelho: some a cópia dos dados de quem usou antes (a fila de envio dela continua, para não perder lançamentos)
      ls.chaves(CH.cache).filter(k => k !== chaveCache(usuario.id)).forEach(k => ls.apagar(k));
      if (perfil && perfil.papel === 'lider') { mudarCache(usuario.id, c => { c.perfil = perfil; }); ls.gravar(CH.ultimo, usuario.id); }
      return perfil;
    } catch (err) {
      if (D.erroDeRede(err, navigator.onLine)) {
        const c = lerCache(usuario.id);
        if (c.perfil && c.perfil.papel === 'lider' && c.perfil.user_id === usuario.id && c.perfil.ativo) { perfil = Object.assign({}, c.perfil); return perfil; }
      }
      throw err;
    }
  }
  // Líder que já usou este aparelho e está sem internet (a sessão pode ter vencido): abre com o que ficou guardado
  const ultimoLider = () => { const uid = ls.ler(CH.ultimo); return uid && lerCache(uid).perfil ? uid : null; };

  function emModoLider(sim) {
    document.body.classList.toggle('modo-lider', !!sim);
    $('#areaLider').hidden = !sim;
  }
  function sair() {
    emModoLider(false);
    document.body.classList.remove('modo-supervisor');
    $('#areaLider').innerHTML = '';
    limparDadosLocais();
    perfil = null; prazo = null;
    Object.assign(est, { funcs: [], lancs: [], envios: [], lideres: [], ok: false, desde: null, credenciais: [], importacao: null, auditoria: null });
    Object.assign(lider, { dia: null, aba: 'ausencia', sel: { ausencia: null, atraso: null, saida: null }, manual: { ausencia: false, atraso: false, saida: false }, editando: null, modoEd: null, motivo: '', outro: '', horaChegou: '', funcs: [], lancs: [], envio: null, fila: [], offline: false, sessaoExpirada: false, equipe: novoEquipe(), hist: novoHist() });
  }

  // ---------- Texto para o superior editado: guardado aqui e sincronizado entre os aparelhos do supervisor ----------
  const chaveTexto = data => CH.texto + data;
  const textoEditado = data => ls.ler(chaveTexto(data));                 // null = usando o texto automático
  function guardarTextoEditado(data, texto) { ls.gravar(chaveTexto(data), texto); ls.gravar(chaveTexto(data) + '.pend', 'up'); agendarEnvioTextos(); }
  function apagarTextoEditado(data) { ls.apagar(chaveTexto(data)); ls.gravar(chaveTexto(data) + '.pend', 'del'); agendarEnvioTextos(); }
  let timerTextos = null;
  const agendarEnvioTextos = () => { clearTimeout(timerTextos); timerTextos = setTimeout(enviarTextos, 900); };
  async function enviarTextos() {
    if (!perfil || perfil.papel !== 'supervisor' || !supa) return;
    for (const k of ls.chaves(CH.texto).filter(x => x.endsWith('.pend'))) {
      const data = k.slice(CH.texto.length, -5);
      if (!ehData(data)) { ls.apagar(k); continue; }
      const tipo = ls.ler(k);
      try {
        const r = tipo === 'up'
          ? await supa.from('textos_editados').upsert({ data, texto: (ls.ler(chaveTexto(data)) || '').slice(0, 20000), atualizado_em: new Date().toISOString() }, { onConflict: 'user_id,data' })
          : await supa.from('textos_editados').delete().eq('data', data);
        if (r.error) throw r.error;
        ls.apagar(k);
      } catch (err) { break; } // sem internet ou recusado: tenta de novo na próxima atualização
    }
  }
  // Traz os textos editados em outros aparelhos (o que ainda não subiu daqui não é sobrescrito)
  async function puxarTextos() {
    if (!perfil || perfil.papel !== 'supervisor' || !supa) return false;
    await enviarTextos();
    const desde = somarDias(ctx.hoje(), -45);
    const { data, error } = await supa.from('textos_editados').select('data,texto').gte('data', desde);
    if (error || !Array.isArray(data)) return false;
    let mudou = false;
    const remotos = new Set();
    for (const r of data) {
      if (!ehData(r.data)) continue;
      remotos.add(r.data);
      if (ls.ler(chaveTexto(r.data) + '.pend')) continue;
      if (ls.ler(chaveTexto(r.data)) !== r.texto) { ls.gravar(chaveTexto(r.data), r.texto); mudou = true; }
    }
    for (const k of ls.chaves(CH.texto).filter(x => !x.endsWith('.pend'))) {   // apagado em outro aparelho
      const data = k.slice(CH.texto.length);
      if (ehData(data) && data >= desde && !remotos.has(data) && !ls.ler(k + '.pend')) { ls.apagar(k); mudou = true; }
    }
    return mudou;
  }

  // ---------- Prazo de envio (igual para todos) ----------
  async function salvarPrazo(hhmm) {
    if (!perfil || perfil.papel !== 'supervisor') throw new Error('Só supervisor pode mudar o prazo.');
    const r = hhmm ? await supa.from('parametros').upsert({ chave: 'hora_limite', valor: hhmm }, { onConflict: 'chave' }) : await supa.from('parametros').delete().eq('chave', 'hora_limite');
    if (r.error) throw r.error;
    prazo = hhmm || null;
  }

  // =====================================================================
  //  LÍDER
  // =====================================================================
  async function abrirLider() {
    emModoLider(true);
    lider.dia = ctx.hoje();
    lider.aba = 'ausencia';
    carregarFila();
    desenharLiderCasca();
    await recarregarLider();
  }

  // ---- fila offline: o que o líder faz sem internet fica guardado aqui e sobe sozinho quando o sinal volta ----
  const chaveFila = () => CH.fila + perfil.user_id;
  const opValida = o => !!o && typeof o === 'object' && ['ins', 'upd', 'del', 'env', 'envdel'].includes(o.op) && ehData(o.dia)
    && o.time === perfil.time && !!o.dados && typeof o.dados === 'object';
  function carregarFila() {
    const f = lerJSON(chaveFila(), []);
    lider.fila = Array.isArray(f) ? f.filter(opValida) : [];
  }
  function guardarFila() {
    if (lider.fila.length) ls.gravar(chaveFila(), JSON.stringify(lider.fila)); else ls.apagar(chaveFila());
  }
  const pendentesLider = () => (perfil && perfil.papel === 'lider' ? lider.fila.length : 0);

  async function enviarOp(op) {
    let r;
    if (op.op === 'ins') r = await supa.from('lancamentos').upsert(op.dados, { onConflict: 'id' }); // "upsert": repetir o envio não duplica
    else if (op.op === 'upd') r = await supa.from('lancamentos').update(op.dados.mudar).eq('id', op.dados.id);
    else if (op.op === 'del') r = await supa.from('lancamentos').delete().eq('id', op.dados.id);
    else if (op.op === 'env') r = await supa.from('envios').upsert(op.dados, { onConflict: 'data,time' });
    else r = await supa.from('envios').delete().eq('data', op.dia).eq('time', op.time);
    if (r && r.error) throw r.error;
  }

  let drenando = false;
  async function drenarFila() {
    if (drenando || !perfil || perfil.papel !== 'lider' || !supa) return;
    if (!lider.fila.length) { atualizarStatusLider(); return; }
    drenando = true;
    const recusados = [];
    try {
      while (lider.fila.length) {
        const op = lider.fila[0];
        try {
          await enviarOp(op);
          lider.fila.shift(); guardarFila(); lider.offline = false; lider.sessaoExpirada = false;
        } catch (err) {
          if (D.erroDeSessao(err)) { lider.sessaoExpirada = true; break; }
          if (D.erroDeRede(err, navigator.onLine)) { lider.offline = true; break; }
          lider.fila.shift(); guardarFila(); recusados.push(falha(err)); // o servidor recusou: não adianta insistir
        }
      }
    } finally { drenando = false; }
    if (recusados.length) {
      ctx.aviso(recusados[0] + (recusados.length > 1 ? ` (+${recusados.length - 1})` : ''));
      await recarregarLider();      // mostra o que o servidor realmente tem
    } else desenharLiderPainel();
  }

  // Faz na tela na hora, guarda na fila e tenta enviar
  async function executar(op) {
    op.id = novoId(); op.time = perfil.time;
    const r = D.aplicarFila(lider.lancs, lider.envio, [op], op.dia, perfil.time);
    lider.lancs = r.lancs; lider.envio = r.envio;
    lider.fila = D.compactarFila(lider.fila.concat([op])); guardarFila();
    desenharLiderPainel();
    await drenarFila();
    return lider.fila.length === 0;   // true = já está no servidor
  }

  async function recarregarLider() {
    const uid = perfil.user_id, dia = lider.dia;
    try {
      const pedidos = [
        supa.from('lancamentos').select('*').eq('data', dia).eq('time', perfil.time).order('criado_em'),
        supa.from('envios').select('*').eq('data', dia).eq('time', perfil.time).maybeSingle(),
        supa.from('parametros').select('valor').eq('chave', 'hora_limite').maybeSingle(),
      ];
      if (!lider.funcs.length) pedidos.push(supa.from('funcionarios').select('id,matricula,nome,cargo,turno,ativo,criado_em').eq('time', perfil.time).eq('ativo', true).order('nome').limit(1000));
      const [l, e, p, f] = await Promise.all(pedidos);
      for (const r of [l, e, p, f]) if (r && r.error) throw r.error;
      lider.lancs = l.data; lider.envio = e.data; lider.offline = false;
      prazo = p.data && typeof p.data.valor === 'string' ? p.data.valor : null;
      if (f) lider.funcs = f.data;
      mudarCache(uid, c => { c.dias[dia] = { lancs: l.data, envio: e.data }; if (f) c.funcs = f.data; c.prazo = prazo; });
    } catch (err) {
      if (D.erroDeRede(err, navigator.onLine)) {
        // sem internet: mostra o que ficou guardado neste aparelho
        lider.offline = true;
        const c = lerCache(uid), d = c.dias[dia];
        lider.lancs = d && Array.isArray(d.lancs) ? d.lancs : []; lider.envio = d && d.envio ? d.envio : null;
        if (!lider.funcs.length) lider.funcs = c.funcs;
        prazo = c.prazo;
      } else ctx.aviso(falha(err));
    }
    const r = D.aplicarFila(lider.lancs, lider.envio, lider.fila, dia, perfil.time);
    lider.lancs = r.lancs; lider.envio = r.envio;
    desenharLiderPainel();
    drenarFila();
  }

  function desenharLiderCasca() {
    const min = somarDias(ctx.hoje(), -7), max = ctx.hoje();
    $('#areaLider').innerHTML = `
      <div class="envolve lider">
        <div class="cabeca">
          <div><h2>Time ${esc(perfil.time)}</h2><p id="liderSub"></p></div>
          <label class="datas"><span>Dia</span><input type="date" id="liderDia" value="${esc(lider.dia)}" min="${min}" max="${max}"></label>
        </div>
        <div id="liderStatus"></div>
        <div id="liderPainel"></div>
      </div>`;
    const raiz = $('#areaLider');
    raiz.onclick = cliqueLider; raiz.onchange = mudouLider; raiz.oninput = digitouLider;
  }

  // O que cada tipo de lançamento pede na tela
  const TIPOS = {
    ausencia: { titulo: 'Registrar ausência ou atraso', sub: 'A pessoa não veio, ou vai chegar atrasada. Escolha o motivo: se for atraso, toque em Chegou quando ela chegar.', icone: 'user', cor: '', botao: 'Lançar ausência', ph: 'Ex.: atestado de 2 dias' },
    saida: { titulo: 'Registrar saída antecipada', sub: 'A pessoa veio trabalhar, mas precisou sair mais cedo.', icone: 'sair', cor: 'laranja', botao: 'Lançar saída antecipada', ph: 'Ex.: filho doente' },
  };
  const doTipo = t => lider.lancs.filter(l => l.tipo === t);
  const presencaDoDia = () => lider.lancs.filter(l => l.tipo !== 'saida'); // ausência + atraso: o que entra na conta

  // Avisos no topo de todas as abas: sem internet / guardado neste aparelho / sessão vencida / prazo de envio
  function htmlStatusLider() {
    const n = lider.fila.length, semNet = lider.offline || !navigator.onLine;
    const partes = [];
    if (lider.sessaoExpirada && n) partes.push(`<div class="caixa-aviso vermelho">${ic('alertCircle')}<span><b>Sua sessão expirou.</b> Toque em Sair e entre de novo para enviar os ${n} lançamento${n > 1 ? 's' : ''} guardado${n > 1 ? 's' : ''} neste aparelho.</span></div>`);
    else if (n) partes.push(`<div class="caixa-aviso amarelo">${ic('nuvemOff')}<span><b>${n} lançamento${n > 1 ? 's' : ''} guardado${n > 1 ? 's' : ''} neste aparelho.</b> ${semNet ? 'Sem internet: enviam sozinhos quando o sinal voltar.' : 'Enviando…'}</span><button class="botao neutro p" data-acao-lider="tentarAgora">Tentar agora</button></div>`);
    else if (semNet) partes.push(`<div class="caixa-aviso info">${ic('nuvemOff')}<span><b>Sem internet.</b> Você vê o que já estava carregado, e o que lançar fica guardado e sobe sozinho.</span></div>`);
    if (prazo && !lider.envio && lider.dia === ctx.hoje()) {
      const passou = D.passouDoPrazo(prazo, lider.dia, ctx.hoje());
      partes.push(passou
        ? `<div class="caixa-aviso vermelho">${ic('clock')}<span><b>O prazo de envio (${esc(D.hm(prazo))}) já passou.</b> Envie o quanto antes.</span></div>`
        : `<div class="caixa-aviso info">${ic('clock')}<span>Prazo para enviar o time: <b>${esc(D.hm(prazo))}</b>.</span></div>`);
    }
    return partes.join('');
  }
  const atualizarStatusLider = () => { const el = $('#liderStatus'); if (el) el.innerHTML = htmlStatusLider(); };

  function desenharLiderPainel() {
    const dia = lider.dia;
    $('#liderSub').textContent = `${diaSemana(dia)}, ${L.dataBR(dia)}${lider.envio ? ' · enviado às ' + hmAgora(lider.envio.enviado_em) : ' · ainda não enviado'}`;
    document.querySelectorAll('#abas [data-aba-lider]').forEach(b => {
      if (b.dataset.abaLider === lider.aba) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
    const n = lider.lancs.length; const c = $('#liderContador'); c.textContent = n; c.hidden = !n;
    const pend = lider.lancs.filter(D.atrasoPendente).length; const ca = $('#liderContadorAtraso'); ca.textContent = pend; ca.hidden = !pend;
    atualizarStatusLider();
    const p = $('#liderPainel');
    const ativo = document.activeElement, foco = ativo && /^eq-/.test(ativo.id || '') ? { id: ativo.id, ini: ativo.selectionStart, fim: ativo.selectionEnd } : null;   // quem digita na aba Equipe não perde o cursor
    if (lider.aba === 'equipe') garantirHistorico();
    if (lider.aba === 'ausencia') p.innerHTML = htmlCompleto() + htmlAguardando() + htmlLancar('ausencia') + htmlJaLancados();
    else if (lider.aba === 'saida') p.innerHTML = htmlLancar('saida');
    else if (lider.aba === 'hoje') p.innerHTML = htmlHoje();
    else if (lider.aba === 'equipe') p.innerHTML = htmlEquipeLider();
    else p.innerHTML = htmlAjustes();
    if (foco) { const el = document.getElementById(foco.id); if (el) { el.focus(); try { el.setSelectionRange(foco.ini, foco.fim); } catch (x) { /* campo sem cursor */ } } }
    atualizarPresentes();
    if (lider.aba === 'ausencia') atualizarCamposMotivo();
  }

  // Time completo: um toque avisa os supervisores que ninguém faltou nem atrasou
  function htmlCompleto() {
    if (presencaDoDia().length) return '';
    if (lider.envio) return `
      <div class="cartao fecho completo">
        <div class="fecho-topo">
          <span class="fecho-icone">${ic('check')}</span>
          <div class="fecho-txt"><b>Time 100% presente</b><span>Enviado às ${esc(hmAgora(lider.envio.enviado_em))}. Se alguém faltar ou atrasar, é só lançar abaixo.</span></div>
          <button class="botao neutro p" data-acao-lider="desfazer">Desfazer envio</button>
        </div>
      </div>`;
    return `
      <div class="cartao">
        <div class="cartao-topo"><div class="ladrilho p verde">${ic('checkCircle')}</div>
          <div><h3>Time completo hoje?</h3><p>Ninguém faltou nem atrasou. Um toque e os supervisores já sabem.</p></div></div>
        <button class="botao g" style="width:100%" data-acao-lider="cem">${ic('check')}Time 100% presente</button>
      </div>`;
  }

  // Atrasos lançados e ainda sem a chegada ficam no alto da tela, esperando o toque em Chegou.
  // Os supervisores já contam essas pessoas como atrasadas; a hora é só para o líder.
  const ordemPorNome = (a, b) => a.nome.localeCompare(b.nome, 'pt');
  function htmlAguardando() {
    const pend = lider.lancs.filter(D.atrasoPendente).sort(ordemPorNome);
    if (!pend.length) return '';
    return `<div class="cartao cartao-aguardando">
      <div class="cartao-topo"><div class="ladrilho p amarelo">${ic('clock')}</div>
        <div><h3>Em atraso (${pend.length})</h3><p>Os supervisores já contam essas pessoas. Quando ela chegar, toque em Chegou para guardar a hora.</p></div></div>
      ${pend.map(itemLancamento).join('')}</div>`;
  }
  // O que já foi lançado (ausências e atrasos que já chegaram), logo abaixo do formulário
  function htmlJaLancados() {
    const itens = lider.lancs.filter(l => l.tipo !== 'saida' && !D.atrasoPendente(l)).sort(ordemPorNome);
    if (!itens.length) return '';
    return `<div class="cartao"><div class="cartao-topo"><div><h3>Já lançados (${itens.length})</h3></div></div>${itens.map(itemLancamento).join('')}</div>`;
  }

  // Lista única de motivos. Escolher um motivo de atraso lança um atraso. "Outro" deixa o líder digitar o motivo.
  function htmlMotivoDaAusencia() {
    const prefs = prefsMotivos();
    const atual = lider.motivo || D.motivoInicial(prefs);
    const grupos = D.gruposDeMotivos(prefs).map(g => `<optgroup label="${esc(g.grupo)}">${g.itens.map(m => `<option value="${esc(m.texto)}"${m.texto === atual ? ' selected' : ''}>${esc(m.texto)}</option>`).join('')}</optgroup>`).join('');
    const outro = atual === D.OUTRO;
    const entrada = D.hm(perfil.entrada_turno);
    return `<select id="lf-motivo">${grupos}<option value="${D.OUTRO}"${outro ? ' selected' : ''}>Outro (digitar o motivo)…</option></select>
      <div id="lf-outro-box" ${outro ? '' : 'hidden'} style="margin-top:.5rem">
        <label class="rotulo" for="lf-outro">Escreva o motivo</label>
        <input id="lf-outro" maxlength="${D.MAX_MOTIVO}" autocomplete="off" value="${esc(lider.outro)}" placeholder="Ex.: consulta médica">
        <div class="contagem-car" style="text-align:left">Se começar com “Atraso”, conta como atraso.</div>
      </div>
      <div id="lf-atraso-box" hidden style="margin-top:.75rem">
        ${entrada
          ? `<input type="hidden" id="lf-prev" value="${esc(entrada)}"><div class="contagem-car" style="text-align:left;margin-bottom:.5rem">Turno às <b>${esc(entrada)}</b> (mude em Ajustes).</div>`
          : `<label class="rotulo" for="lf-prev">Horário do turno</label><input type="time" id="lf-prev" style="max-width:11rem">
             <div class="caixa-aviso amarelo">${ic('alert')}<span>O horário do turno ainda não foi definido. Preencha aqui (ou em Ajustes, para já vir preenchido).</span></div>`}
        <label class="rotulo" for="lf-cheg">Chegou às <span style="color:var(--fraco)">(só se já chegou; senão toque em Chegou depois)</span></label>
        <input type="time" id="lf-cheg" style="max-width:11rem">
        <div id="lf-atraso" class="atraso-min"></div>
      </div>`;
  }

  function htmlLancar(tipo) {
    const t = TIPOS[tipo];
    const ehSaida = tipo === 'saida';
    const s = lider.sel[tipo], manual = lider.manual[tipo];
    let escolha;
    if (manual) {
      escolha = `
        <div class="campos-2">
          <div><label class="rotulo" for="lf-nome">Nome</label><input id="lf-nome" maxlength="120" autocomplete="off"></div>
          <div><label class="rotulo" for="lf-mat">Matrícula</label><input id="lf-mat" inputmode="numeric" maxlength="20" autocomplete="off"></div>
        </div>
        <button class="link" data-acao-lider="voltarBusca">Buscar na lista do time</button>`;
    } else if (s) {
      escolha = `
        <div class="escolhida">
          <div class="quem"><b>${esc(s.nome)}</b><span>${esc(s.cargo || '')}</span></div>
          <div class="mat"><label class="rotulo" for="lf-mat">Matrícula</label><input id="lf-mat" inputmode="numeric" maxlength="20" value="${esc(s.matricula)}" placeholder="${s.matricula ? '' : 'sem matrícula: digite'}"></div>
          <button class="botao neutro p" data-acao-lider="trocar">Trocar</button>
        </div>`;
    } else {
      escolha = `
        <label class="rotulo" for="lf-busca">Nome ou matrícula</label>
        <div class="com-icone">${ic('search')}<input id="lf-busca" autocomplete="off" placeholder="Comece a digitar o nome…"></div>
        <div id="lf-resultados" class="resultados"></div>
        <button class="link" data-acao-lider="manual">Não está na lista? Digitar nome e matrícula</button>`;
    }
    const pronto = manual || s;
    let corpo = '';
    if (pronto) {
      const hora = ehSaida ? `
        <label class="rotulo" for="lf-saida">Saiu às</label>
        <div class="linha" style="flex-wrap:nowrap"><input type="time" id="lf-saida" style="max-width:11rem"><button class="botao sec" data-acao-lider="agora" type="button">Agora</button></div>` : '';
      const motivo = ehSaida
        ? `<select id="lf-motivo">${D.MOTIVOS_SAIDA.map(m => `<option>${esc(m)}</option>`).join('')}</select>`
        : htmlMotivoDaAusencia();
      corpo = `
        <div style="margin-top:.75rem">${hora}
          <label class="rotulo" for="lf-motivo" ${hora ? 'style="margin-top:.75rem"' : ''}>Motivo</label>
          ${motivo}
          <label class="rotulo" for="lf-just" style="margin-top:.75rem">Justificativa <span style="color:var(--fraco)">(opcional)</span></label>
          <textarea id="lf-just" maxlength="500" style="min-height:4.5rem;font-family:inherit" placeholder="${t.ph}"></textarea>
          <button class="botao g" style="width:100%;margin-top:.75rem" data-acao-lider="lancar">${ic('plus')}${t.botao}</button>
        </div>`;
    }
    return `<div class="cartao">
      <div class="cartao-topo"><div class="ladrilho p ${t.cor}">${ic(t.icone)}</div>
        <div><h3>${t.titulo}</h3><p>${t.sub}</p></div></div>
      ${escolha}${corpo}</div>`;
  }

  function atualizarMinutosAtraso() {
    const alvo = $('#lf-atraso'); if (!alvo) return;
    const prev = ($('#lf-prev') || {}).value, cheg = ($('#lf-cheg') || {}).value;
    const min = D.minutosDeAtraso(prev, cheg);
    let classe = 'atraso-min', txt = '';
    if (min) { classe += ' ok'; txt = `Atraso de ${D.textoAtraso(min)}`; }
    else if (prev && cheg) { classe += ' ruim'; txt = 'A chegada precisa ser depois do horário do turno.'; }
    else if (prev) { classe += ' neutro'; txt = 'Sem hora de chegada: fica em “Em atraso” e os supervisores já contam. Toque em Chegou quando a pessoa chegar.'; }
    alvo.className = classe; alvo.textContent = txt;
  }

  // Mostra o que o motivo escolhido pede: o campo para escrever (Outro) e os horários (atraso)
  function atualizarCamposMotivo() {
    const sel = $('#lf-motivo'); if (!sel || lider.aba !== 'ausencia') return;
    lider.motivo = sel.value;
    const digitado = $('#lf-outro'); if (digitado) lider.outro = digitado.value;
    const caixaOutro = $('#lf-outro-box'); if (caixaOutro) caixaOutro.hidden = sel.value !== D.OUTRO;
    const r = D.escolherMotivo(sel.value, lider.outro, prefsMotivos());
    const ehAtraso = !r.erro && r.tipo === 'atraso';
    const caixa = $('#lf-atraso-box'); if (caixa) caixa.hidden = !ehAtraso;
    const botao = document.querySelector('[data-acao-lider="lancar"]');
    if (botao) botao.innerHTML = ic('plus') + (ehAtraso ? 'Lançar atraso' : 'Lançar ausência');
    if (ehAtraso) atualizarMinutosAtraso();
  }

  // Uma linha da lista (Em atraso, Já lançados e Hoje)
  function itemLancamento(l) {
    if (lider.editando === l.id) return htmlEdicao(l);
    const pend = D.atrasoPendente(l);
    const min = D.minutosDeAtraso(l.hora_prevista, l.hora_chegada);
    let detalhe = `<span class="etiqueta">${esc(l.motivo)}</span>`;
    if (l.tipo === 'atraso') detalhe = pend
      ? `<span class="etiqueta aguardando">Em atraso</span> <span class="etiqueta">${esc(l.motivo)}</span> turno às ${esc(D.hm(l.hora_prevista))}`
      : `${detalhe} chegou ${esc(D.hm(l.hora_chegada))}${min ? ' (' + esc(D.textoAtraso(min)) + ')' : ''}`;
    if (l.tipo === 'saida') detalhe += ` saiu ${esc(D.hm(l.hora_saida))}`;
    let acoes;
    if (pend) acoes = `<button class="botao p" data-acao-lider="editar" title="A pessoa chegou: guardar a hora">${ic('check')}Chegou</button>`;
    else if (l.tipo === 'ausencia') acoes = `<button class="botao sec p" data-acao-lider="editar">${l.justificativa || l.motivo !== 'Sem justificativa' ? 'Editar' : 'Justificar'}</button>
          <button class="botao neutro p" data-acao-lider="converter" title="A pessoa chegou depois: passa a atraso">${ic('clock')}Chegou</button>`;
    else acoes = `<button class="botao sec p" data-acao-lider="editar">Editar</button>`;
    return `<div class="item-lanc${pend ? ' aguard' : ''}" data-id="${esc(l.id)}">
        <div class="txt"><b>${esc(l.nome)}</b> <span class="mat-txt">${esc(l.matricula || 'sem matrícula')}</span>
          <div class="det">${detalhe}
          ${l.justificativa ? `<div class="just">${esc(l.justificativa)}</div>` : ''}</div></div>
        <div class="acoes">${acoes}
          <button class="botao perigo p icone" data-acao-lider="apagar" title="Excluir" aria-label="Excluir lançamento">${ic('trash')}</button></div></div>`;
  }

  function listaLancados(tipo) {
    const itens = doTipo(tipo).sort((a, b) => (D.atrasoPendente(b) - D.atrasoPendente(a)) || a.nome.localeCompare(b.nome, 'pt'));
    if (!itens.length) return `<div class="vazio-lista">Nenhum${tipo === 'ausencia' ? 'a ausência' : tipo === 'atraso' ? ' atraso' : 'a saída antecipada'} lançado(a).</div>`;
    return itens.map(itemLancamento).join('');
  }

  // Edição de uma linha. Em atraso: "Chegou" já vem com a hora de agora (o líder pode acertar).
  function htmlEdicao(l) {
    const converter = lider.modoEd === 'converter' && l.tipo === 'ausencia';
    const pend = D.atrasoPendente(l);
    const todos = D.todosOsMotivos(prefsMotivos());
    const tipoAlvo = converter ? 'atraso' : l.tipo;
    const motivos = tipoAlvo === 'saida' ? D.MOTIVOS_SAIDA.slice() : todos.filter(m => m.tipo === tipoAlvo).map(m => m.texto);
    const motivoAtual = converter ? 'Atraso sem justificativa' : l.motivo;
    if (!motivos.includes(motivoAtual)) motivos.unshift(motivoAtual);   // motivo escrito pelo líder que não está na lista
    const agora = lider.horaChegou || horaAgora();
    let horas = '';
    if (converter) horas = `<div class="campos-2" style="margin-top:.5rem"><div><label class="rotulo">Horário do turno</label><input type="time" data-ed="prev" value="${esc(D.hm(perfil.entrada_turno))}"></div>
        <div><label class="rotulo">Chegou às</label><input type="time" data-ed="cheg" value="${esc(agora)}"></div></div>`;
    else if (l.tipo === 'atraso') horas = `<div class="campos-2" style="margin-top:.5rem"><div><label class="rotulo">Horário do turno</label><input type="time" data-ed="prev" value="${esc(D.hm(l.hora_prevista))}"></div>
        <div><label class="rotulo">Chegou às</label><input type="time" data-ed="cheg" value="${esc(pend ? agora : D.hm(l.hora_chegada))}"></div></div>`;
    else if (l.tipo === 'saida') horas = `<div style="margin-top:.5rem"><label class="rotulo">Saiu às</label><input type="time" data-ed="saida" value="${esc(D.hm(l.hora_saida))}" style="max-width:11rem"></div>`;
    const titulo = converter ? 'Chegou depois do horário' : pend ? 'Chegou' : '';
    const botao = converter || pend ? 'Confirmar chegada' : 'Salvar';
    return `<div class="item-lanc editando" data-id="${esc(l.id)}"><div class="txt" style="flex:1">
      <b>${esc(l.nome)}</b> <span class="mat-txt">${esc(l.matricula || 'sem matrícula')}</span>
      ${titulo ? `<div class="det" style="font-weight:600">${titulo}</div>` : ''}${horas}
      <label class="rotulo" style="margin-top:.5rem">Motivo</label>
      <select data-ed="motivo">${motivos.map(m => `<option${m === motivoAtual ? ' selected' : ''}>${esc(m)}</option>`).join('')}</select>
      <label class="rotulo" style="margin-top:.5rem">Justificativa</label>
      <textarea data-ed="just" maxlength="500" style="min-height:4rem;font-family:inherit">${esc(l.justificativa)}</textarea>
      <div class="linha" style="margin-top:.5rem"><button class="botao p" data-acao-lider="salvarEd">${ic('save')}${botao}</button>
        <button class="botao neutro p" data-acao-lider="cancelarEd">Cancelar</button></div></div></div>`;
  }

  function htmlHoje() {
    const aus = doTipo('ausencia').length, atr = doTipo('atraso').length, sai = doTipo('saida').length;
    const pend = lider.lancs.filter(D.atrasoPendente).length;
    const padrao = lider.envio ? lider.envio.efetivo : lider.funcs.length;
    const ehHoje = lider.dia === ctx.hoje();
    const enviado = !!lider.envio;
    const cem = enviado && !presencaDoDia().length;
    const titulo = cem ? 'Time 100% presente · enviado às ' + esc(hmAgora(lider.envio.enviado_em))
      : enviado ? 'Enviado às ' + esc(hmAgora(lider.envio.enviado_em)) : 'Ainda não enviado';
    const linhaHero = enviado ? 'Os supervisores já têm o fechamento de ' + L.dataBR(lider.dia) + '.' : 'Confira a lista e envie no fim da página.';
    return `
      <div class="cartao fecho ${enviado ? 'completo' : ''}">
        <div class="fecho-topo">
          <span class="fecho-icone">${ic(enviado ? 'check' : 'clock')}</span>
          <div class="fecho-txt"><b>${titulo}</b><span>${linhaHero}</span></div>
        </div>
      </div>
      ${pend ? `<div class="caixa-aviso amarelo">${ic('clock')}<span><b>${pend} atraso${pend > 1 ? 's' : ''} em aberto.</b> Os supervisores já contam. Quando a pessoa chegar, toque em Chegou na aba Ausência.</span></div>` : ''}
      <div class="kpis kpis-lider">
        <div class="kpi"><div class="rot">Ausências</div><div class="valor">${aus}</div></div>
        <div class="kpi"><div class="rot">Atrasos</div><div class="valor">${atr}</div></div>
        <div class="kpi"><div class="rot">Saídas</div><div class="valor">${sai}</div></div>
      </div>
      <div class="cartao"><div class="cartao-topo"><div><h3>Ausências</h3></div></div>${listaLancados('ausencia')}</div>
      <div class="cartao"><div class="cartao-topo"><div><h3>Atrasos</h3></div></div>${listaLancados('atraso')}</div>
      <div class="cartao"><div class="cartao-topo"><div><h3>Saídas antecipadas</h3></div></div>${listaLancados('saida')}</div>
      <div class="cartao">
        <div class="cartao-topo">
          <div><h3>${enviado ? 'Atualizar envio' : 'Enviar aos supervisores'}</h3><p>${enviado ? 'Lançou mais alguém? Atualize para os supervisores verem.' : 'Os lançamentos já aparecem para eles. O envio marca o time como fechado do dia.'}</p></div></div>
        <label class="rotulo" for="lf-efetivo">Total de pessoas do time ${ehHoje ? 'hoje' : 'nesse dia'}</label>
        <input type="number" id="lf-efetivo" min="0" max="1000" inputmode="numeric" value="${padrao}" style="max-width:10rem">
        <div class="contagem-car" style="text-align:left">Presentes: <b id="lf-presentes"></b></div>
        <button class="botao g" style="width:100%;margin-top:.75rem" data-acao-lider="enviar">${ic('checkCircle')}${enviado ? 'Atualizar envio' : 'Enviar aos supervisores'}</button>
      </div>`;
  }

  function htmlAjustes() {
    const h = D.hm(perfil.entrada_turno);
    const prefs = prefsMotivos();
    const grupos = D.gruposDeMotivos(prefs).map(g => `<optgroup label="${esc(g.grupo)}">${g.itens.map(m => `<option value="${esc(m.texto)}"${m.texto === prefs.padrao ? ' selected' : ''}>${esc(m.texto)}</option>`).join('')}</optgroup>`).join('');
    const meus = prefs.proprios.length
      ? `<ul class="lista-motivos">${prefs.proprios.map(m => `<li><span>${esc(m.texto)}${m.atraso ? ' <span class="etiqueta aguardando">atraso</span>' : ''}${m.texto === prefs.padrao ? ' <span class="etiqueta">já selecionado</span>' : ''}</span>
          <button class="botao neutro p" data-acao-lider="removerMotivo" data-motivo="${esc(m.texto)}">Remover</button></li>`).join('')}</ul>`
      : '<div class="vazio-lista">Você ainda não cadastrou nenhum motivo.</div>';
    return `<div class="cartao">
      <div class="cartao-topo"><div class="ladrilho p">${ic('clock')}</div>
        <div><h3>Horário do turno</h3><p>Usado para calcular os atrasos. Já vem preenchido ao lançar um atraso.</p></div></div>
      <label class="rotulo" for="aj-hora">Entrada do turno</label>
      <div class="linha"><input type="time" id="aj-hora" value="${esc(h)}" style="max-width:180px"><button class="botao" data-acao-lider="salvarHora">${ic('save')}Salvar</button></div>
    </div>
    <div class="cartao">
      <div class="cartao-topo"><div class="ladrilho p amarelo">${ic('bulb')}</div>
        <div><h3>Motivos ao lançar</h3><p>Escolha o motivo que já vem selecionado na tela Ausência e cadastre motivos seus: eles entram na lista. Ficam salvos neste aparelho.</p></div></div>
      <label class="rotulo" for="aj-padrao">Motivo que já vem selecionado</label>
      <select id="aj-padrao"><option value=""${prefs.padrao ? '' : ' selected'}>O primeiro da lista (${esc(D.MOTIVOS_AUSENCIA[0])})</option>${grupos}</select>
      <div class="sub-tit">Meus motivos</div>
      ${meus}
      <label class="rotulo" for="aj-novo">Novo motivo</label>
      <input id="aj-novo" maxlength="${D.MAX_MOTIVO}" autocomplete="off" placeholder="Ex.: consulta médica">
      <label class="opcao" style="margin-top:.5rem"><input type="checkbox" id="aj-novo-atraso"> É um atraso (a pessoa vai chegar depois)</label>
      <label class="opcao"><input type="checkbox" id="aj-novo-padrao" checked> Deixar já selecionado ao lançar</label>
      <button class="botao" style="margin-top:.5rem" data-acao-lider="addMotivo">${ic('plus')}Adicionar motivo</button>
    </div>
    <div class="cartao"><div class="cartao-topo"><div class="ladrilho p">${ic('users')}</div><div><h3>Meu time</h3>
      <p>${esc(perfil.time)} · ${lider.funcs.length} pessoas cadastradas${perfil.nome ? ' · ' + esc(perfil.nome) : ''}. Veja todos e cadastre quem faltar na aba Equipe. Se algum dado estiver errado, avise o supervisor.</p></div></div></div>`;
  }

  // Motivos próprios (Ajustes)
  function adicionarMotivo() {
    const prefs = prefsMotivos();
    const texto = D.limparMotivo(($('#aj-novo') || {}).value);
    if (!texto) return ctx.aviso('Escreva o motivo.');
    if (D.motivoExiste(texto, prefs)) return ctx.aviso('Esse motivo já está na lista.');
    if (prefs.proprios.length >= D.MAX_MOTIVOS_PROPRIOS) return ctx.aviso(`Você já tem ${D.MAX_MOTIVOS_PROPRIOS} motivos. Remova algum para cadastrar outro.`);
    prefs.proprios.push({ texto, atraso: $('#aj-novo-atraso').checked || D.pareceAtraso(texto) });
    if ($('#aj-novo-padrao').checked) prefs.padrao = texto;
    guardarPrefsMotivos(prefs); lider.motivo = '';
    desenharLiderPainel(); ctx.aviso(`Motivo “${texto}” adicionado${prefs.padrao === texto ? ' e já selecionado ao lançar' : ''}.`);
  }
  function removerMotivo(texto) {
    const prefs = prefsMotivos();
    prefs.proprios = prefs.proprios.filter(m => m.texto !== texto);
    if (prefs.padrao === texto) prefs.padrao = '';
    guardarPrefsMotivos(prefs); lider.motivo = '';
    desenharLiderPainel(); ctx.aviso('Motivo removido.');
  }
  function mudarMotivoPadrao(texto) {
    const prefs = prefsMotivos(); prefs.padrao = texto;
    guardarPrefsMotivos(prefs); lider.motivo = '';
    ctx.aviso(texto ? `Já vem selecionado: ${texto}.` : 'Volta a vir o primeiro da lista.');
  }

  function digitouLider(e) {
    if (e.target.id === 'lf-busca') {
      const achados = D.buscarFuncionarios(lider.funcs, e.target.value, { excluir: D.excluirDaBusca(lider.lancs, lider.aba), max: 8 });
      const alvo = $('#lf-resultados');
      if (!e.target.value.trim()) { alvo.innerHTML = ''; return; }
      alvo.innerHTML = achados.length
        ? achados.map(f => `<button class="res" data-acao-lider="escolher" data-id="${esc(f.id)}"><b>${esc(f.nome)}</b><span>${esc(f.matricula || 'sem matrícula')}</span></button>`).join('')
        : `<div class="sem-res">Ninguém encontrado (ou já lançado hoje).</div>`;
    } else if (e.target.id === 'lf-mat') e.target.value = soDigitos(e.target.value);
    else if (e.target.id === 'lf-prev' || e.target.id === 'lf-cheg') atualizarMinutosAtraso();
    else if (e.target.id === 'lf-outro') atualizarCamposMotivo();
    else if (e.target.id === 'lf-efetivo') atualizarPresentes();
    else if (e.target.id === 'eq-busca') { lider.equipe.busca = e.target.value; atualizarListaEquipe(); }
    else if (e.target.id === 'eq-mat') { e.target.value = soDigitos(e.target.value); lider.equipe.form.matricula = e.target.value; }
    else if (e.target.id === 'eq-nome') lider.equipe.form.nome = e.target.value;
    else if (e.target.id === 'eq-cargo') lider.equipe.form.cargo = e.target.value;
    else if (e.target.id === 'eq-turno') lider.equipe.form.turno = e.target.value;
    else if (e.target.id === 'eq-ed-nome') lider.equipe.formEd.nome = e.target.value;
    else if (e.target.id === 'eq-ed-cargo') lider.equipe.formEd.cargo = e.target.value;
    else if (e.target.id === 'eq-ed-turno') lider.equipe.formEd.turno = e.target.value;
  }

  function atualizarPresentes() {
    const el = $('#lf-presentes'); if (!el) return;
    const ef = +$('#lf-efetivo').value || 0;
    el.textContent = Math.max(0, ef - presencaDoDia().length); // quem saiu mais cedo veio trabalhar: continua presente
  }

  function mudouLider(e) {
    if (e.target.id === 'liderDia') {
      if (!e.target.value) return;
      lider.dia = e.target.value; lider.editando = null; lider.modoEd = null; lider.motivo = ''; lider.outro = '';
      lider.sel = { ausencia: null, atraso: null, saida: null };
      recarregarLider();
    } else if (e.target.id === 'lf-prev' || e.target.id === 'lf-cheg') atualizarMinutosAtraso();
    else if (e.target.id === 'lf-motivo') atualizarCamposMotivo();
    else if (e.target.id === 'aj-padrao') mudarMotivoPadrao(e.target.value);
    else if (e.target.id === 'eq-filtro') { lider.equipe.filtro = e.target.value; atualizarListaEquipe(); }
  }

  const horaAgora = () => { const d = new Date(); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
  const avisoGuardado = (noServidor, texto) => ctx.aviso(noServidor ? texto : 'Guardado neste aparelho: envia sozinho quando a internet voltar.');

  async function cliqueLider(e) {
    const b = e.target.closest('[data-acao-lider]'); if (!b) return;
    const acao = b.dataset.acaoLider, tipo = lider.aba;
    const dono = b.closest('[data-id]');
    const idItem = dono ? dono.dataset.id : null;
    if (acao === 'escolher') {
      const f = lider.funcs.find(x => x.id === b.dataset.id);
      if (f) { lider.sel[tipo] = f; desenharLiderPainel(); const m = $('#lf-motivo'); if (m) m.focus(); }
    } else if (acao === 'trocar') { lider.sel[tipo] = null; desenharLiderPainel(); const i = $('#lf-busca'); if (i) i.focus(); }
    else if (acao === 'manual') { lider.manual[tipo] = true; lider.sel[tipo] = null; desenharLiderPainel(); $('#lf-nome').focus(); }
    else if (acao === 'voltarBusca') { lider.manual[tipo] = false; desenharLiderPainel(); }
    else if (acao === 'agora') { $('#lf-saida').value = horaAgora(); }
    else if (acao === 'lancar') await lancar(tipo, b);
    else if (acao === 'editar') { lider.editando = idItem; lider.modoEd = null; lider.horaChegou = horaAgora(); desenharLiderPainel(); }
    else if (acao === 'converter') { lider.editando = idItem; lider.modoEd = 'converter'; lider.horaChegou = horaAgora(); desenharLiderPainel(); }
    else if (acao === 'addMotivo') adicionarMotivo();
    else if (acao === 'abrirPessoa') abrirPessoa(b.dataset.fid);
    else if (acao === 'voltarEquipe') { lider.equipe.aberto = null; lider.equipe.editando = null; desenharLiderPainel(); window.scrollTo(0, 0); }
    else if (acao === 'editarPessoa') abrirEdicao();
    else if (acao === 'cancelarEdicaoPessoa') { lider.equipe.editando = null; desenharLiderPainel(); }
    else if (acao === 'salvarPessoa') await salvarCorrecao();
    else if (acao === 'periodo') mudarPeriodo(+b.dataset.dias);
    else if (acao === 'verTudoHist') { lider.equipe.verTudo = !lider.equipe.verTudo; desenharLiderPainel(); }
    else if (acao === 'recarregarHist') { carregarHistorico(lider.equipe.periodo === 0, true); desenharLiderPainel(); }
    else if (acao === 'abrirCadastro') abrirCadastro();
    else if (acao === 'fecharCadastro') { lider.equipe.cadastro = false; desenharLiderPainel(); }
    else if (acao === 'cadastrar') await cadastrarColaborador();
    else if (acao === 'lancarDaPessoa') lancarDaPessoa(b.dataset.tipo);
    else if (acao === 'removerMotivo') removerMotivo(b.dataset.motivo);
    else if (acao === 'cancelarEd') { lider.editando = null; lider.modoEd = null; desenharLiderPainel(); }
    else if (acao === 'salvarEd') await salvarEdicao(idItem, b);
    else if (acao === 'apagar') {
      const l = lider.lancs.find(x => x.id === idItem); if (!l) return;
      if (!confirm(`Excluir o lançamento de ${l.nome}?`)) return;
      const ok = await executar({ op: 'del', dia: lider.dia, dados: { id: idItem } });
      avisoGuardado(ok, 'Lançamento excluído.');
    } else if (acao === 'enviar') await enviar(b);
    else if (acao === 'cem') await enviarCem(b);
    else if (acao === 'desfazer') await desfazerEnvio();
    else if (acao === 'tentarAgora') { lider.sessaoExpirada = false; await drenarFila(); if (lider.fila.length) ctx.aviso('Ainda sem conexão. Tente de novo em instantes.'); }
    else if (acao === 'salvarHora') {
      const h = $('#aj-hora').value;
      if (!h) return ctx.aviso('Escolha o horário.');
      const { error } = await supa.rpc('salvar_horario_turno', { h });
      if (error) return ctx.aviso(falha(error));
      perfil.entrada_turno = h; mudarCache(perfil.user_id, c => { c.perfil = perfil; }); ctx.aviso('Horário do turno salvo.');
    }
  }

  async function lancar(tipo, botao) {
    const manual = lider.manual[tipo], s = lider.sel[tipo];
    if (!manual && !s) return;   // segundo toque no mesmo botão, depois do primeiro já ter lançado
    const nome = (manual ? $('#lf-nome').value : s.nome).replace(/\s+/g, ' ').trim();
    const matricula = soDigitos($('#lf-mat').value);
    if (!nome) return ctx.aviso('Digite o nome.');
    // Na tela Ausência o motivo decide o tipo: motivo de atraso lança um atraso
    let motivo = $('#lf-motivo').value, tipoLanc = tipo;
    if (tipo === 'ausencia') {
      const r = D.escolherMotivo(motivo, ($('#lf-outro') || {}).value, prefsMotivos());
      if (r.erro) return ctx.aviso(r.erro);
      motivo = r.motivo; tipoLanc = r.tipo;
    }
    const linha = { id: novoId(), data: lider.dia, time: perfil.time, tipo: tipoLanc, matricula, nome, motivo, justificativa: $('#lf-just').value.trim() };
    if (tipoLanc === 'atraso') {
      linha.hora_prevista = ($('#lf-prev') || {}).value || null; linha.hora_chegada = ($('#lf-cheg') || {}).value || null;
      if (!linha.hora_prevista) return ctx.aviso('Preencha o horário do turno.');
      // sem hora de chegada = em atraso; com hora, precisa ser depois do turno
      if (linha.hora_chegada && !D.minutosDeAtraso(linha.hora_prevista, linha.hora_chegada)) return ctx.aviso('A chegada precisa ser depois do horário do turno.');
    }
    if (tipo === 'saida') {
      linha.hora_saida = $('#lf-saida').value || null;
      if (!linha.hora_saida) return ctx.aviso('Informe a hora que a pessoa saiu (ou toque em Agora).');
    }
    lider.sel[tipo] = null; lider.manual[tipo] = false; lider.motivo = ''; lider.outro = '';
    const ok = await executar({ op: 'ins', dia: lider.dia, dados: linha });
    const primeiro = nome.split(' ')[0];
    avisoGuardado(ok, D.atrasoPendente(linha) ? `${primeiro}: atraso lançado. Toque em Chegou quando chegar.` : `${primeiro} lançado(a).`);
    const i = $('#lf-busca'); if (i) i.focus();
  }

  async function salvarEdicao(id, botao) {
    const l = lider.lancs.find(x => x.id === id); if (!l) return;
    const card = botao.closest('.item-lanc');
    const campo = k => (card.querySelector(`[data-ed="${k}"]`) || {}).value;
    const converter = lider.modoEd === 'converter' && l.tipo === 'ausencia';
    const mudar = { motivo: campo('motivo'), justificativa: (campo('just') || '').trim() };
    if (converter || l.tipo === 'atraso') {
      mudar.hora_prevista = campo('prev') || null; mudar.hora_chegada = campo('cheg') || null;
      if (!mudar.hora_prevista) return ctx.aviso('Preencha o horário do turno.');
      if (mudar.hora_chegada && !D.minutosDeAtraso(mudar.hora_prevista, mudar.hora_chegada)) return ctx.aviso('A chegada precisa ser depois do horário do turno. Se a pessoa chegou no horário, exclua o lançamento.');
      if (converter) mudar.tipo = 'atraso';
    }
    if (l.tipo === 'saida') {
      mudar.hora_saida = campo('saida') || null;
      if (!mudar.hora_saida) return ctx.aviso('Informe a hora da saída.');
    }
    lider.editando = null; lider.modoEd = null;
    const eraPendente = D.atrasoPendente(l);   // antes de salvar: depois de salvar a chegada ele deixa de estar pendente
    const ok = await executar({ op: 'upd', dia: lider.dia, dados: { id, mudar } });
    avisoGuardado(ok, converter ? (mudar.hora_chegada ? 'Passou a atraso. Chegada guardada.' : 'Passou a atraso: em atraso até você tocar em Chegou.') : (eraPendente && mudar.hora_chegada ? 'Chegada guardada.' : 'Salvo.'));
  }

  async function enviar(botao) {
    const efetivo = Math.floor(+$('#lf-efetivo').value);
    if (!(efetivo >= 0 && efetivo <= 1000)) return ctx.aviso('Digite o total de pessoas do time.');
    if (efetivo < presencaDoDia().length) return ctx.aviso(`O total (${efetivo}) é menor que as ausências e atrasos (${presencaDoDia().length}). Confira.`);
    const ok = await executar({ op: 'env', dia: lider.dia, dados: { data: lider.dia, time: perfil.time, efetivo, enviado_em: new Date().toISOString() } });
    avisoGuardado(ok, 'Enviado aos supervisores.');
  }

  // Time 100%: envia o dia sem ausências, com o total do cadastro do time
  async function enviarCem(botao) {
    const efetivo = lider.funcs.length;
    if (!efetivo) return ctx.aviso('O time não tem ninguém cadastrado. Informe o total na aba Hoje.');
    if (presencaDoDia().length) return ctx.aviso('Já existem ausências ou atrasos lançados.');
    if (!confirm(`Enviar o ${perfil.time} como 100% presente (${efetivo} pessoas, ninguém faltou nem atrasou)?`)) return;
    const ok = await executar({ op: 'env', dia: lider.dia, dados: { data: lider.dia, time: perfil.time, efetivo, enviado_em: new Date().toISOString() } });
    avisoGuardado(ok, 'Time 100% presente enviado aos supervisores.');
  }

  async function desfazerEnvio() {
    if (!confirm('Desfazer o envio? O time volta a aparecer como pendente para os supervisores.')) return;
    const ok = await executar({ op: 'envdel', dia: lider.dia, dados: {} });
    avisoGuardado(ok, 'Envio desfeito.');
  }

  // =====================================================================
  //  LÍDER · EQUIPE: todos os colaboradores do time, perfil com indicadores e cadastro de colaborador novo
  // =====================================================================
  // Só lê (lançamentos, envios e funcionários do próprio time) e cadastra gente nova: nada aqui apaga nem altera lançamentos.
  const DIAS_HIST = 90;   // histórico carregado de início; "Tudo" busca o resto
  const EM_DIA = ['no domingo', 'na segunda-feira', 'na terça-feira', 'na quarta-feira', 'na quinta-feira', 'na sexta-feira', 'no sábado'];
  const ROTULO_TIPO = { ausencia: 'Ausência', atraso: 'Atraso', saida: 'Saída antecipada' };
  const pctBR = n => (Math.round(n * 10) / 10).toFixed(1).replace('.', ',').replace(',0', '') + '%';
  const diasTxt = n => (n === 1 ? '1 dia' : n + ' dias');
  const dataCadastro = iso => { try { return new Date(iso).toLocaleDateString('pt-BR'); } catch (e) { return ''; } };
  // O histórico do servidor com o dia aberto na tela trocado pelo que o líder vê agora (inclui o que ainda está na fila)
  const lancsDoTime = () => lider.hist.lancs.filter(l => l.data !== lider.dia).concat(lider.lancs);
  const enviosDoTime = () => lider.hist.envios.filter(e => e.data !== lider.dia).concat(lider.envio ? [lider.envio] : []);
  // Escolheu "Tudo" mas só os últimos 90 dias estão carregados (carregando, ou sem internet): os números são dos 90 dias
  const periodoEfetivo = () => (lider.equipe.periodo === 0 && !lider.hist.tudo ? DIAS_HIST : lider.equipe.periodo);
  const desenharEquipeNaTela = () => { if (perfil && perfil.papel === 'lider' && lider.aba === 'equipe') desenharLiderPainel(); };
  const garantirHistorico = () => { if (!lider.hist.tentou) carregarHistorico(false); };

  async function carregarHistorico(tudo, forcar) {
    const h = lider.hist;
    if (h.carregando) return;
    if (!forcar && h.carregado && (h.tudo || !tudo)) return;       // já tem o que precisa
    h.carregando = true; h.falhou = false; h.tentou = true;
    const desde = tudo ? '' : somarDias(ctx.hoje(), -(DIAS_HIST - 1));
    try {
      const [l, e] = await Promise.all([
        paginar((a, b) => { let q = supa.from('lancamentos').select('id,data,tipo,matricula,nome,motivo,justificativa,hora_prevista,hora_chegada,hora_saida,criado_em').eq('time', perfil.time); if (desde) q = q.gte('data', desde); return q.order('data', { ascending: false }).order('id').range(a, b); }),
        paginar((a, b) => { let q = supa.from('envios').select('data,efetivo,enviado_em').eq('time', perfil.time); if (desde) q = q.gte('data', desde); return q.order('data', { ascending: false }).range(a, b); }),
      ]);
      Object.assign(h, { lancs: l, envios: e, desde, tudo: !!tudo, carregado: true, offline: false });
      mudarCache(perfil.user_id, c => { c.hist = l.length <= 3000 ? { desde, tudo: !!tudo, lancs: l, envios: e } : null; });
    } catch (err) {
      const semNet = D.erroDeRede(err, navigator.onLine), guardado = lerCache(perfil.user_id).hist;
      if (!h.carregado && semNet && guardado) Object.assign(h, { lancs: guardado.lancs, envios: guardado.envios, desde: guardado.desde, tudo: !!guardado.tudo, carregado: true, offline: true });
      else if (!h.carregado) h.falhou = true;
      else ctx.aviso(semNet ? 'Sem internet: mostrando o histórico que já estava carregado.' : falha(err));
    } finally { h.carregando = false; }
    desenharEquipeNaTela();
  }

  // Cada colaborador com a situação no dia aberto e os números dos últimos 30 dias (quando o histórico já chegou)
  function dadosDaLista() {
    const h = lider.hist, hoje = ctx.hoje();
    const doDia = D.lancamentosPorPessoa(lider.funcs, lider.lancs);
    const todos = h.carregado ? lancsDoTime() : null;
    const historico = todos ? D.lancamentosPorPessoa(lider.funcs, todos) : null;
    const envios = todos ? enviosDoTime() : [];
    const numeros = f => {
      if (!historico) return null;
      const dele = historico.get(f.id);
      return D.kpisDaPessoa(dele, D.diasComMovimento(todos, envios, hoje, 30, D.inicioDaPessoa(f, dele)), hoje, 30);
    };
    return lider.funcs.slice().sort(ordemPorNome).map(f => ({ f, sit: D.situacaoNoDia(doDia.get(f.id)), k: numeros(f) }));
  }

  const chipSituacao = s => (s ? `<span class="chip ${s.tipo}">${esc(s.rotulo)}</span>` : '');

  function linhasDaEquipe(itens) {
    const e = lider.equipe;
    let lista = itens;
    if (e.busca.trim()) { const achados = new Set(D.buscarFuncionarios(lider.funcs, e.busca, { max: 1000 }).map(f => f.id)); lista = lista.filter(x => achados.has(x.f.id)); }
    if (e.filtro === 'fora') lista = lista.filter(x => x.sit);
    else if (e.filtro === 'ocorrencia') lista = lista.filter(x => x.k && x.k.diasAusente > 0);
    else if (e.filtro === 'semmat') lista = lista.filter(x => !x.f.matricula);
    if (!lista.length) return `<div class="vazio-lista">${lider.funcs.length ? 'Ninguém encontrado com esse filtro.' : 'Nenhum colaborador cadastrado ainda. Toque em Adicionar colaborador.'}</div>`;
    return lista.map(({ f, sit, k }) => {
      const partes = [];
      if (k && k.ausencias) partes.push(k.ausencias + (k.ausencias === 1 ? ' ausência' : ' ausências'));
      if (k && k.atrasos) partes.push(k.atrasos + (k.atrasos === 1 ? ' atraso' : ' atrasos'));
      if (k && k.saidas) partes.push(k.saidas + (k.saidas === 1 ? ' saída' : ' saídas'));
      const mini = partes.length ? `<span class="mini">${partes.join(' · ')} em 30 dias</span>` : '';
      return `<button class="pessoa" type="button" data-acao-lider="abrirPessoa" data-fid="${esc(f.id)}">
        <span class="avatar-p">${esc(D.iniciais(f.nome))}</span>
        <span class="pessoa-txt"><b>${esc(f.nome)}</b><span>${esc([f.matricula || 'sem matrícula', f.cargo, f.turno].filter(Boolean).join(' · '))}</span>${mini}</span>
        <span class="pessoa-fim">${chipSituacao(sit)}${ic('chevron')}</span></button>`;
    }).join('');
  }
  function atualizarListaEquipe() { const el = $('#eq-lista'); if (el) el.innerHTML = linhasDaEquipe(dadosDaLista()); }

  function htmlEquipeLider() {
    const e = lider.equipe;
    const aberta = e.aberto && lider.funcs.find(x => x.id === e.aberto);
    if (aberta) return htmlPerfilPessoa(aberta);
    e.aberto = null;
    const hoje = ctx.hoje(), dia = D.resumoDoTime(lider.lancs, lider.envio), itens = dadosDaLista();
    const comOcorrencia = lider.hist.carregado ? itens.filter(x => x.k && x.k.diasAusente > 0).length : '…';
    const filtros = [['todos', 'Todos'], ['fora', lider.dia === hoje ? 'Ausentes ou atrasados hoje' : 'Ausentes ou atrasados no dia'], ['ocorrencia', 'Com ocorrência (30 dias)'], ['semmat', 'Sem matrícula']]
      .map(([v, t]) => `<option value="${v}"${e.filtro === v ? ' selected' : ''}>${t}</option>`).join('');
    return `
      <div class="kpis kpis-equipe kpis-lider">
        <div class="kpi"><div class="rot">Colaboradores</div><div class="valor">${lider.funcs.length}</div></div>
        <div class="kpi"><div class="rot">Ausências e atrasos</div><div class="valor">${dia.conta}</div><div class="det">${lider.dia === hoje ? 'hoje' : esc(L.dataBR(lider.dia))}</div></div>
        <div class="kpi"><div class="rot">Em atraso agora</div><div class="valor">${dia.pendentes.length}</div></div>
        <div class="kpi"><div class="rot">Com ocorrência</div><div class="valor">${comOcorrencia}</div><div class="det">nos últimos 30 dias</div></div>
      </div>
      ${e.cadastro ? htmlCadastro() : ''}
      <div class="cartao">
        <div class="cartao-topo"><div class="ladrilho p">${ic('users')}</div><div><h3>Colaboradores do time</h3><p>Toque em uma pessoa para ver o perfil e os indicadores dela.</p></div><span class="espaco"></span>
          ${e.cadastro ? '' : `<button class="botao" data-acao-lider="abrirCadastro">${ic('plus')}Adicionar colaborador</button>`}</div>
        <div class="filtros-pessoas">
          <div class="com-icone">${ic('search')}<input id="eq-busca" autocomplete="off" placeholder="Buscar por nome ou matrícula" value="${esc(e.busca)}" aria-label="Buscar colaborador"></div>
          <select id="eq-filtro" aria-label="Filtrar colaboradores">${filtros}</select>
        </div>
        <div id="eq-lista">${linhasDaEquipe(itens)}</div>
      </div>`;
  }

  // Sugestões (cargos e turnos que o time já usa) para os campos de cadastro e de correção
  const opcoesDe = campo => [...new Set(lider.funcs.map(x => String(x[campo] || '').trim()).filter(Boolean))].sort().map(v => `<option value="${esc(v)}"></option>`).join('');

  function htmlCadastro() {
    const e = lider.equipe, f = e.form;
    const cargos = opcoesDe('cargo'), turnos = opcoesDe('turno');
    return `<div class="cartao">
      <div class="cartao-topo"><div class="ladrilho p verde">${ic('plus')}</div><div><h3>Adicionar colaborador</h3>
        <p>A pessoa entra na lista do time ${esc(perfil.time)} na hora. Depois é só lançar ausência, atraso ou saída dela, como as outras.</p></div></div>
      <div class="cadastro-campos">
        <div class="largo"><label class="rotulo" for="eq-nome">Nome completo</label><input id="eq-nome" maxlength="${D.MAX_NOME}" autocomplete="off" value="${esc(f.nome)}"></div>
        <div><label class="rotulo" for="eq-mat">Matrícula <span style="color:var(--fraco)">(se já tiver)</span></label><input id="eq-mat" inputmode="numeric" maxlength="${D.MAX_MATRICULA}" autocomplete="off" value="${esc(f.matricula)}"></div>
        <div><label class="rotulo" for="eq-cargo">Cargo</label><input id="eq-cargo" list="eq-cargos" maxlength="${D.MAX_CARGO}" autocomplete="off" value="${esc(f.cargo)}"><datalist id="eq-cargos">${cargos}</datalist></div>
        <div><label class="rotulo" for="eq-turno">Turno</label><input id="eq-turno" list="eq-turnos" maxlength="${D.MAX_TURNO}" autocomplete="off" value="${esc(f.turno)}"><datalist id="eq-turnos">${turnos}</datalist></div>
      </div>
      <div class="linha" style="margin-top:.75rem">
        <button class="botao g" data-acao-lider="cadastrar"${e.ocupado ? ' disabled' : ''}>${ic('check')}${e.ocupado ? 'Cadastrando…' : 'Cadastrar colaborador'}</button>
        <button class="botao neutro" data-acao-lider="fecharCadastro">Cancelar</button>
      </div>
    </div>`;
  }

  // Uma linha do histórico da pessoa
  function itemHistorico(l) {
    let detalhe = '';
    if (l.tipo === 'atraso') {
      const min = D.minutosDeAtraso(l.hora_prevista, l.hora_chegada);
      detalhe = D.atrasoPendente(l) ? ` Em atraso (turno às ${esc(D.hm(l.hora_prevista))}).` : ` Chegou ${esc(D.hm(l.hora_chegada))}${min ? ' (' + esc(D.textoAtraso(min)) + ' de atraso)' : ''}.`;
    } else if (l.tipo === 'saida') detalhe = ` Saiu ${esc(D.hm(l.hora_saida))}.`;
    return `<div class="item-hist"><div class="dt"><b>${esc(L.dataBR(l.data))}</b><span>${esc(diaSemana(l.data))}</span></div>
      <div class="txt"><span class="etiqueta${l.tipo === 'ausencia' ? ' vermelha' : l.tipo === 'saida' ? ' laranja' : ''}">${ROTULO_TIPO[l.tipo] || 'Registro'}</span> <span class="etiqueta neutra">${esc(l.motivo)}</span>${detalhe}
        ${l.justificativa ? `<div class="just">${esc(l.justificativa)}</div>` : ''}</div></div>`;
  }

  // Os números do perfil (cartões, motivos, dias da semana, histórico) para o período escolhido
  function htmlIndicadores(k, per) {
    const h = lider.hist, e = lider.equipe;
    const avisos = [];
    if (h.offline) avisos.push(`<div class="caixa-aviso info">${ic('nuvemOff')}<span>Sem internet: mostrando o histórico guardado neste aparelho.</span></div>`);
    if (e.periodo === 0 && !h.tudo) avisos.push(`<div class="caixa-aviso info">${ic('clock')}<span>${h.carregando ? 'Carregando todo o histórico…' : `Mostrando os últimos ${DIAS_HIST} dias.`}</span></div>`);
    if (!k.taxaValida) avisos.push(`<div class="caixa-aviso info">${ic('info')}<span>O % de absenteísmo aparece com ${D.MIN_DIAS_TAXA} dias de registro desde que a pessoa entrou no sistema (por enquanto são ${k.diasBase}). Os números abaixo já valem.</span></div>`);
    const semFaltar = k.diasSemFaltar == null ? ['—', 'nenhuma ausência ou atraso no período']
      : k.diasSemFaltar === 0 ? ['0', `faltou ou atrasou em ${L.dataBR(k.ultima.data)}`] : [String(k.diasSemFaltar), `desde ${L.dataBR(k.ultima.data)}`];
    const tiles = `<div class="kpis kpis-perfil kpis-lider">
      <div class="kpi destaque"><div class="rot">Absenteísmo</div><div class="valor">${k.taxa == null ? '—' : pctBR(k.taxa)}</div><div class="det">${diasTxt(k.diasAusente)} com ausência ou atraso em ${diasTxt(k.diasBase)}</div></div>
      <div class="kpi"><div class="rot">Ausências</div><div class="valor">${k.ausencias}</div><div class="det">${k.ausencias === 1 ? 'dia sem vir trabalhar' : 'dias sem vir trabalhar'}</div></div>
      <div class="kpi"><div class="rot">Atrasos</div><div class="valor">${k.atrasos}</div><div class="det">${k.atrasoMedia != null ? 'média de ' + D.textoAtraso(k.atrasoMedia) : k.atrasos ? 'sem hora de chegada ainda' : 'nenhum no período'}</div></div>
      <div class="kpi"><div class="rot">Saídas antecipadas</div><div class="valor">${k.saidas}</div><div class="det">não contam como falta</div></div>
      <div class="kpi"><div class="rot">Dias sem faltar</div><div class="valor">${semFaltar[0]}</div><div class="det">${semFaltar[1]}</div></div>
      <div class="kpi"><div class="rot">Dias presente</div><div class="valor">${k.presentes}</div><div class="det">de ${diasTxt(k.diasBase)} registrados</div></div>
    </div>`;
    const motivos = k.motivos.length ? `<div class="cartao"><div class="cartao-topo"><div><h3>Motivos</h3><p>O que mais aparece nos lançamentos dele(a).</p></div></div>
      ${k.motivos.slice(0, 8).map(m => `<div class="motivo-linha"><span>${esc(m.motivo)}</span><b>${m.n}</b><div class="trilho"><div class="enche" style="width:${Math.max(4, Math.round(m.pct))}%"></div></div></div>`).join('')}</div>` : '';
    const nomesDia = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const semana = k.diasAusente ? `<div class="cartao"><div class="cartao-topo"><div><h3>Dias da semana</h3>
      <p>${k.diaTopo ? `Costuma faltar ou atrasar ${EM_DIA[k.diaTopo.dia]} (${k.diaTopo.n} vezes).` : 'Ainda não há um dia da semana que se repita.'}</p></div></div>
      <div class="semana">${[1, 2, 3, 4, 5, 6, 0].map(d => `<div${k.diaTopo && k.diaTopo.dia === d ? ' class="topo"' : ''}><b>${k.semana[d]}</b>${nomesDia[d]}</div>`).join('')}</div></div>` : '';
    const lista = e.verTudo ? k.historico : k.historico.slice(0, 15);
    const historico = `<div class="cartao"><div class="cartao-topo"><div><h3>Histórico (${k.historico.length})</h3><p>Ausências, atrasos e saídas lançadas, da mais recente para a mais antiga.</p></div></div>
      ${lista.length ? lista.map(itemHistorico).join('') : '<div class="vazio-lista">Nenhuma ausência, atraso ou saída neste período.</div>'}
      ${k.historico.length > 15 ? `<button class="link" data-acao-lider="verTudoHist">${e.verTudo ? 'Mostrar só os 15 mais recentes' : `Ver todos os ${k.historico.length}`}</button>` : ''}</div>`;
    return avisos.join('') + tiles + motivos + semana + historico;
  }

  function htmlPerfilPessoa(f) {
    const e = lider.equipe, h = lider.hist, hoje = ctx.hoje(), per = periodoEfetivo();
    const todos = lancsDoTime();
    const dele = D.lancamentosPorPessoa([f], todos).get(f.id);
    const k = D.kpisDaPessoa(dele, D.diasComMovimento(todos, enviosDoTime(), hoje, per, D.inicioDaPessoa(f, dele)), hoje, per);
    const sit = D.situacaoNoDia(D.lancamentosPorPessoa([f], lider.lancs).get(f.id));
    const entrada = D.hm(perfil.entrada_turno);
    const segmentos = [[30, '30 dias'], [90, '90 dias'], [0, 'Tudo']].map(([d, t]) => `<button type="button" data-acao-lider="periodo" data-dias="${d}" aria-pressed="${e.periodo === d}">${t}</button>`).join('');
    let indicadores;
    if (h.carregando && !h.carregado) indicadores = `<div class="caixa-aviso info">${ic('clock')}<span>Carregando o histórico…</span></div>`;
    else if (h.falhou && !h.carregado) indicadores = `<div class="caixa-aviso vermelho">${ic('alertCircle')}<span>Não foi possível carregar o histórico${navigator.onLine ? '' : ' (sem internet)'}.</span><button class="botao neutro p" data-acao-lider="recarregarHist">Tentar de novo</button></div>`;
    else indicadores = htmlIndicadores(k, per);
    return `
      <button class="link voltar" data-acao-lider="voltarEquipe">${ic('chevron')}Voltar para a equipe</button>
      <div class="cartao">
        <div class="perfil-topo"><span class="avatar-p g">${esc(D.iniciais(f.nome))}</span>
          <div><h3>${esc(f.nome)}</h3><div class="chips">${chipSituacao(sit) || '<span class="chip ok">Sem ocorrência</span>'}</div></div></div>
        ${e.editando === f.id ? htmlFormEdicao(f) : `<dl class="dados">
          <div><dt>Matrícula</dt><dd>${f.matricula ? esc(f.matricula) : 'não informada'}</dd></div>
          <div><dt>Cargo</dt><dd>${esc(f.cargo || '—')}</dd></div>
          <div><dt>Turno</dt><dd>${esc(f.turno || '—')}</dd></div>
          <div><dt>Time</dt><dd>${esc(perfil.time)}</dd></div>
          ${entrada ? `<div><dt>Entrada do turno</dt><dd>${esc(entrada)}</dd></div>` : ''}
          <div><dt>No sistema desde</dt><dd>${esc(dataCadastro(f.criado_em) || '—')}</dd></div>
          <div><dt>Situação</dt><dd>Ativo</dd></div>
        </dl>
        <div class="linha" style="margin-top:.75rem">
          <button class="botao" data-acao-lider="lancarDaPessoa" data-tipo="ausencia">${ic('user')}Lançar ausência ou atraso</button>
          <button class="botao sec" data-acao-lider="lancarDaPessoa" data-tipo="saida">${ic('sair')}Lançar saída antecipada</button>
          <button class="botao neutro" data-acao-lider="editarPessoa">${ic('edit')}Editar dados</button>
        </div>`}
      </div>
      <div class="linha entre"><h3 style="margin:0">Indicadores</h3><div class="segmentos" role="group" aria-label="Período">${segmentos}</div></div>
      ${indicadores}`;
  }

  // Corrigir nome, cargo e turno de quem é do time. Matrícula, time e situação só o supervisor muda (o banco também barra).
  function htmlFormEdicao(f) {
    const e = lider.equipe, d = e.formEd;
    const cargos = opcoesDe('cargo'), turnos = opcoesDe('turno');
    return `<div class="cadastro-campos" style="margin-top:.75rem">
        <div class="largo"><label class="rotulo" for="eq-ed-nome">Nome completo</label><input id="eq-ed-nome" maxlength="${D.MAX_NOME}" autocomplete="off" value="${esc(d.nome)}"></div>
        <div><label class="rotulo" for="eq-ed-cargo">Cargo</label><input id="eq-ed-cargo" list="eq-cargos" maxlength="${D.MAX_CARGO}" autocomplete="off" value="${esc(d.cargo)}"><datalist id="eq-cargos">${cargos}</datalist></div>
        <div><label class="rotulo" for="eq-ed-turno">Turno</label><input id="eq-ed-turno" list="eq-turnos" maxlength="${D.MAX_TURNO}" autocomplete="off" value="${esc(d.turno)}"><datalist id="eq-turnos">${turnos}</datalist></div>
        <div class="largo"><label class="rotulo" for="eq-ed-mat">Matrícula</label><input id="eq-ed-mat" value="${esc(f.matricula || 'não informada')}" disabled>
          <div class="contagem-car" style="text-align:left">Matrícula, time e situação só o supervisor altera.</div></div>
      </div>
      <div class="linha" style="margin-top:.75rem">
        <button class="botao g" data-acao-lider="salvarPessoa"${e.ocupado ? ' disabled' : ''}>${ic('save')}${e.ocupado ? 'Salvando…' : 'Salvar'}</button>
        <button class="botao neutro" data-acao-lider="cancelarEdicaoPessoa">Cancelar</button>
      </div>`;
  }

  function abrirEdicao() {
    const e = lider.equipe, f = lider.funcs.find(x => x.id === e.aberto);
    if (!f) return;
    e.editando = f.id; e.formEd = { nome: f.nome || '', cargo: f.cargo || '', turno: f.turno || '' };
    desenharLiderPainel();
    const i = $('#eq-ed-nome'); if (i) i.focus();
  }

  // Mensagem do banco ao corrigir, em português simples
  function falhaDaCorrecao(err) {
    const t = String((err && (err.message || err.details)) || '');
    if (err && err.code === '42501' && /só pode corrigir/.test(t)) return t;
    if ((err && err.code === '42501') || /row-level security|permission denied/i.test(t)) return 'Sem permissão para corrigir os dados dessa pessoa.';
    return falha(err);
  }

  async function salvarCorrecao() {
    const e = lider.equipe, f = lider.funcs.find(x => x.id === e.editando);
    if (!f || e.ocupado) return;
    if (!navigator.onLine) return ctx.aviso('Sem internet: para corrigir os dados é preciso estar conectado.');
    const r = D.validarCorrecao(e.formEd, lider.funcs, f);
    if (r.erro) return ctx.aviso(r.erro);
    if (r.semMudanca) { e.editando = null; desenharLiderPainel(); return ctx.aviso('Nada foi alterado.'); }
    if (r.quebraHistorico && !confirm(`${f.nome} não tem matrícula. Os lançamentos antigos dela continuam no nome anterior e deixam de aparecer neste perfil. O ideal é pedir ao supervisor para cadastrar a matrícula antes de trocar o nome. Trocar o nome mesmo assim?`)) return;
    if (r.aviso && !confirm(r.aviso.replace('Cadastrar outra pessoa com o mesmo nome?', 'Salvar mesmo assim?'))) return;
    e.ocupado = true; desenharLiderPainel();
    try {
      const { data, error } = await supa.from('funcionarios').update({ nome: r.dados.nome, cargo: r.dados.cargo, turno: r.dados.turno }).eq('id', f.id)
        .select('id,matricula,nome,cargo,turno,ativo,criado_em').maybeSingle();
      if (error) throw error;
      // sem a regra no banco ele não dá erro: só não altera ninguém (nenhuma linha volta)
      if (!data) { ctx.aviso('A correção de dados pelo líder ainda não foi liberada no banco. Peça ao supervisor para ativar (é uma configuração única) e tente de novo.'); return; }
      lider.funcs = lider.funcs.map(x => (x.id === data.id ? data : x)).sort(ordemPorNome);
      mudarCache(perfil.user_id, c => { c.funcs = lider.funcs; });
      e.editando = null;
      ctx.aviso(`Dados de ${data.nome.split(' ')[0]} atualizados.`);
    } catch (err) { ctx.aviso(falhaDaCorrecao(err)); }
    finally { e.ocupado = false; desenharLiderPainel(); }
  }

  function abrirPessoa(fid) {
    if (!lider.funcs.some(x => x.id === fid)) return;
    lider.equipe.aberto = fid; lider.equipe.verTudo = false; lider.equipe.editando = null;
    desenharLiderPainel(); window.scrollTo(0, 0);
  }
  function mudarPeriodo(dias) {
    if (![30, 90, 0].includes(dias)) return;
    lider.equipe.periodo = dias; lider.equipe.verTudo = false;
    if (dias === 0) carregarHistorico(true);
    desenharLiderPainel();
  }
  function lancarDaPessoa(tipo) {
    const f = lider.funcs.find(x => x.id === lider.equipe.aberto);
    if (!f || !TIPOS[tipo]) return;
    if (D.excluirDaBusca(lider.lancs, tipo).has(D.chaveDaPessoa(f))) return ctx.aviso(`${f.nome.split(' ')[0]} já foi lançado(a) ${lider.dia === ctx.hoje() ? 'hoje' : 'nesse dia'}. Use a aba Hoje para editar.`);
    lider.aba = tipo; lider.sel[tipo] = f; lider.manual[tipo] = false; lider.motivo = ''; lider.outro = ''; lider.editando = null;
    desenharLiderPainel(); window.scrollTo(0, 0);
  }

  function abrirCadastro() {
    const e = lider.equipe;
    e.form = { nome: '', matricula: '', cargo: D.valorMaisComum(lider.funcs, 'cargo', 'Operador'), turno: D.valorMaisComum(lider.funcs, 'turno', '2° Turno') };
    e.cadastro = true;
    desenharLiderPainel();
    const i = $('#eq-nome'); if (i) i.focus();
  }

  // Mensagem do banco ao cadastrar, em português simples
  function falhaDoCadastro(err) {
    const t = String((err && (err.message || err.details)) || '');
    if (err && err.code === '23505') return /matr/i.test(t) ? t : 'Já existe um colaborador igual neste time.';
    if (err && err.code === '54000') return t;
    if ((err && err.code === '42501') || /row-level security|permission denied/i.test(t)) return 'O cadastro de colaborador pelo líder ainda não foi liberado no banco. Peça ao supervisor para ativar (é uma configuração única) e tente de novo.';
    return falha(err);
  }

  async function cadastrarColaborador() {
    const e = lider.equipe;
    if (e.ocupado) return;
    if (!navigator.onLine) return ctx.aviso('Sem internet: para cadastrar um colaborador é preciso estar conectado.');
    const r = D.validarNovoColaborador(e.form, lider.funcs);
    if (r.erro) return ctx.aviso(r.erro);
    if (r.aviso && !confirm(r.aviso)) return;
    e.ocupado = true; desenharLiderPainel();
    try {
      const { data, error } = await supa.from('funcionarios').insert({ nome: r.dados.nome, matricula: r.dados.matricula, cargo: r.dados.cargo, turno: r.dados.turno, time: perfil.time })
        .select('id,matricula,nome,cargo,turno,ativo,criado_em').single();
      if (error) throw error;
      lider.funcs = lider.funcs.concat([data]).sort(ordemPorNome);
      mudarCache(perfil.user_id, c => { c.funcs = lider.funcs; });
      e.cadastro = false; e.form = { nome: '', matricula: '', cargo: '', turno: '' }; e.busca = ''; e.filtro = 'todos'; e.aberto = data.id;
      ctx.aviso(`${data.nome.split(' ')[0]} cadastrado(a) no time.` + (lider.envio && lider.dia === ctx.hoje() ? ' Você já enviou hoje: para o total do time incluir essa pessoa, atualize o envio na aba Hoje.' : ''));
    } catch (err) { ctx.aviso(falhaDoCadastro(err)); }
    finally { e.ocupado = false; desenharLiderPainel(); window.scrollTo(0, 0); }
  }

  // =====================================================================
  //  SUPERVISOR
  // =====================================================================
  const ABAS = ['recebidos', 'equipe'];

  async function prepararSupervisor() {
    document.body.classList.add('modo-supervisor');
    return atualizar();
  }

  const desdePadrao = () => somarDias(ctx.hoje(), -DIAS);

  let atualizando = null;
  // Recarrega os últimos 90 dias (o que já foi buscado de mais antigo continua na memória)
  function atualizar() {
    if (!perfil || perfil.papel !== 'supervisor' || !supa) return Promise.resolve(false);
    if (atualizando) return atualizando;
    atualizando = (async () => {
      try {
        const desde = desdePadrao();
        const [funcs, lancs, envios, lids, params] = await Promise.all([
          paginar((a, b) => supa.from('funcionarios').select('id,matricula,nome,time,cargo,turno,ativo').order('time').order('nome').range(a, b)),
          paginar((a, b) => supa.from('lancamentos').select('*').gte('data', desde).order('data').order('criado_em').range(a, b)),
          paginar((a, b) => supa.from('envios').select('*').gte('data', desde).order('data').range(a, b)),
          supa.from('perfis').select('usuario,nome,time,ativo,entrada_turno').eq('papel', 'lider').order('time'),
          supa.from('parametros').select('chave,valor'),
        ]);
        if (lids.error) throw lids.error;
        const antes = JSON.stringify([est.lancs, est.envios, est.lideres, prazo]);
        const velhosL = est.lancs.filter(l => l.data < desde), velhosE = est.envios.filter(e => e.data < desde);
        const hora = params.data && params.data.find(p => p.chave === 'hora_limite');
        prazo = hora && typeof hora.valor === 'string' ? hora.valor : null;
        Object.assign(est, { funcs, lancs: velhosL.concat(lancs), envios: velhosE.concat(envios), lideres: lids.data, ok: true });
        if (!est.desde || est.desde > desde) est.desde = desde;
        const mudouTexto = await puxarTextos().catch(() => false);
        return mudouTexto || antes !== JSON.stringify([est.lancs, est.envios, est.lideres, prazo]);
      } catch (err) { console.error('Painel (atualizar)', err); return false; }
      finally { atualizando = null; }
    })();
    return atualizando;
  }

  // Busca dias mais antigos sob demanda (histórico, exportações). Devolve null se já está carregado.
  let carregandoAntigos = null;
  function garantirDesde(iso) {
    if (!perfil || perfil.papel !== 'supervisor' || !supa || !est.ok || !ehData(iso)) return null;
    if (est.desde && iso >= est.desde) return null;
    if (carregandoAntigos) return carregandoAntigos.then(() => garantirDesde(iso) || false);
    carregandoAntigos = (async () => {
      try {
        const ate = est.desde || desdePadrao();
        const [l, e] = await Promise.all([
          paginar((a, b) => supa.from('lancamentos').select('*').gte('data', iso).lt('data', ate).order('data').order('criado_em').range(a, b)),
          paginar((a, b) => supa.from('envios').select('*').gte('data', iso).lt('data', ate).order('data').range(a, b)),
        ]);
        est.lancs = l.concat(est.lancs); est.envios = e.concat(est.envios); est.desde = iso;
        return true;
      } catch (err) { console.error('Painel (histórico)', err); return false; }
      finally { carregandoAntigos = null; }
    })();
    return carregandoAntigos;
  }
  // Tudo o que os líderes já lançaram (para exportar e para buscar uma pessoa em todo o histórico)
  async function carregarTudo() {
    const p = garantirDesde('2000-01-01'); if (p) await p;
    return dadosCarregados();
  }
  const dadosCarregados = () => ({ lancs: est.lancs.slice(), envios: est.envios.slice(), completo: !!est.desde && est.desde <= '2000-01-01' });
  const ehSupervisor = () => !!perfil && perfil.papel === 'supervisor';

  function contagensExtras(data) {
    if (!est.ok) return [];
    const d = est.lancs.filter(l => l.data === data);
    return [
      { rotulo: 'Atrasos', valor: d.filter(l => l.tipo === 'atraso').length },
      { rotulo: 'Saídas antecipadas', valor: d.filter(l => l.tipo === 'saida').length },
    ];
  }
  const timesDosLideres = () => est.lideres.filter(l => l.ativo).map(l => l.time);
  const temDados = () => est.ok && (est.lancs.length || est.envios.length || timesDosLideres().length);

  // Base do supervisor + o que os líderes enviaram (só para exibir; nada disso é salvo na base dele)
  function mesclar(base) {
    if (!temDados()) return base;
    return D.mesclarBase(base, est.lancs, est.envios, timesDosLideres());
  }
  const ehDeLider = (data, time) => est.envios.some(e => e.data === data && e.time === time);

  function desenhar(aba) { if (aba === 'recebidos') desenharRecebidos(); else if (aba === 'equipe') desenharEquipe(); }
  const redesenharAtual = () => {
    const foco = document.activeElement;
    if (foco && foco.matches && foco.matches('[data-texto-area]')) return; // não interrompe a edição do texto
    const id = ((document.querySelector('section.aba.ativa') || {}).id || '').replace('aba-', ''); if (ABAS.includes(id)) desenhar(id); };

  // ---------- Recebidos ----------
  function desenharRecebidos() {
    const alvo = $('#conteudoRecebidos');
    if (!est.ok) { alvo.innerHTML = `<div class="cartao">${ctx.vazio('nuvem', 'Carregando os lançamentos dos líderes…')}</div>`; return; }
    if (!est.dataRec) est.dataRec = ctx.hoje();
    const data = est.dataRec;
    const times = [...new Set(timesDosLideres().concat(est.funcs.map(f => f.time)))].sort(D.ordenarTimes);
    const esperados = timesDosLideres().length ? timesDosLideres() : times;
    const doDia = est.lancs.filter(l => l.data === data);
    const env = {}; est.envios.filter(e => e.data === data).forEach(e => { env[e.time] = e; });
    const todosTimes = [...new Set(esperados.concat(Object.keys(env), doDia.map(l => l.time)))].sort(D.ordenarTimes);
    const resumo = {}; todosTimes.forEach(t => { resumo[t] = D.resumoDoTime(doDia.filter(l => l.time === t), env[t]); });
    const enviados = todosTimes.filter(t => env[t]);
    const lidPorTime = {}; est.lideres.filter(l => l.ativo).forEach(l => { lidPorTime[l.time] = l; });
    const faltam = todosTimes.filter(t => !env[t]);
    const completo = todosTimes.length > 0 && !faltam.length;
    const passouPrazo = faltam.length > 0 && D.passouDoPrazo(prazo, data, ctx.hoje());
    const cobranca = D.textoCobranca(data, faltam, prazo);

    // Destaque: um segmento por time. Cor + texto (a legenda abaixo diz o mesmo com palavras)
    const estadoDoTime = t => env[t] ? 'ok' : doDia.some(l => l.time === t) ? 'andamento' : 'falta';
    const segs = todosTimes.map((t, i) => `<span class="seg ${estadoDoTime(t)}" style="--i:${i}" title="${esc(t)}"></span>`).join('');
    const chips = todosTimes.map(t => {
      const r = resumo[t], n = doDia.filter(l => l.time === t).length;
      if (env[t]) return `<span class="chip ok">${esc(t)} ${ic('check')} ${r.cem ? '100% · ' : ''}${hmAgora(env[t].enviado_em)}</span>`;
      if (n) return `<span class="chip andamento">${esc(t)} em andamento (${n})</span>`;
      return `<span class="chip falta">${esc(t)} pendente${passouPrazo ? ' · passou do prazo' : ''}</span>`;
    }).join('');

    const cartoes = todosTimes.map(t => {
      const meus = doDia.filter(l => l.time === t);
      const r = resumo[t];
      const e = env[t];
      const status = e ? `<span class="selo verde">${ic('checkCircle')}Enviado ${hmAgora(e.enviado_em)}</span>`
        : meus.length ? `<span class="selo amarelo">${ic('clock')}Em andamento</span>` : `<span class="selo vermelho">${ic('xCircle')}Não enviou</span>`;
      const extras = r.cem ? `<span class="selo verde">${ic('check')}100% presente</span>` : '';
      const l = lidPorTime[t];
      const tabAus = r.aus.length ? `<div class="tabela-rolar"><table class="cinza"><thead><tr><th>Nome</th><th>Matrícula</th><th>Motivo</th><th>Justificativa</th></tr></thead><tbody>${
        r.aus.map(x => `<tr><td>${esc(x.nome)}</td><td>${esc(x.matricula)}</td><td>${esc(x.motivo)}</td><td>${esc(x.justificativa)}</td></tr>`).join('')}</tbody></table></div>` : '';
      const atrasos = r.atr.slice().sort((a, b) => a.nome.localeCompare(b.nome, 'pt'));
      const tabAtr = atrasos.length ? `<div class="tabela-rolar"><table class="cinza"><thead><tr><th>Nome</th><th>Matrícula</th><th>Motivo</th><th>Justificativa</th></tr></thead><tbody>${
        atrasos.map(x => `<tr><td>${esc(x.nome)}</td><td>${esc(x.matricula)}</td><td>${esc(x.motivo)}</td><td>${esc(x.justificativa)}</td></tr>`).join('')}</tbody></table></div>` : '';
      const tabSai = r.saidas.length ? `<div class="tabela-rolar"><table class="cinza"><thead><tr><th>Nome</th><th>Matrícula</th><th>Saiu às</th><th>Motivo</th><th>Justificativa</th></tr></thead><tbody>${
        r.saidas.slice().sort((a, b) => a.nome.localeCompare(b.nome, 'pt')).map(x => `<tr><td>${esc(x.nome)}</td><td>${esc(x.matricula)}</td><td>${esc(D.hm(x.hora_saida))}</td><td>${esc(x.motivo)}</td><td>${esc(x.justificativa)}</td></tr>`).join('')}</tbody></table></div>` : '';
      const sub = titulo => `<div class="sub-tit">${titulo}</div>`;
      // Abre sozinho o time que tem o que ler; o resto fica recolhido (menos rolagem)
      return `<details class="cartao time-cartao" ${meus.length || r.cem ? 'open' : ''}>
        <summary>
          <div><h3>${esc(t)}</h3><p>${l ? 'Líder: ' + esc(l.nome || l.usuario) : 'Sem login de líder'}${e ? ` · ${r.cem ? '100% presente' : `${r.conta} de ${e.efetivo} (${L.pct(r.conta, e.efetivo)})`}` : ''}</p></div>
          <span class="espaco"></span>${extras}${status}
        </summary>
        <div class="corpo">
        ${meus.length ? (r.aus.length ? sub(`Ausências (${r.aus.length})`) + tabAus : '')
            + (atrasos.length ? sub(`Atrasos (${atrasos.length})`) + tabAtr : '')
            + (r.saidas.length ? sub(`Saídas antecipadas (${r.saidas.length})`) + tabSai : '')
          : `<div class="vazio-lista">${e ? 'Sem ausências nem atrasos: time completo.' : 'Nada lançado ainda.'}</div>`}
        </div>
      </details>`;
    }).join('');

    const texto = D.textoPorTime(data, est.lancs, est.envios, esperados);
    const titulo = completo ? 'Todos os times enviaram'
      : faltam.length ? `Faltam ${faltam.length}: ${faltam.slice(0, 4).join(', ')}${faltam.length > 4 ? '…' : ''}` : 'Nenhum time cadastrado';
    alvo.innerHTML = `
      <div class="cartao fecho ${completo ? 'completo' : ''}">
        <div class="fecho-topo">
          <div class="fecho-num">${enviados.length}<small>/${todosTimes.length}</small></div>
          <div class="fecho-txt"><b>${esc(titulo)}</b><span>times enviaram o fechamento de ${L.dataBR(data)}${prazo && data === ctx.hoje() ? ` · prazo ${esc(D.hm(prazo))}` : ''}</span></div>
        </div>
        <div class="segs" role="img" aria-label="${enviados.length} de ${todosTimes.length} times enviaram">${segs}</div>
        <div class="chips">${chips}</div>
      </div>
      ${passouPrazo ? `<div class="caixa-aviso vermelho">${ic('clock')}<span><b>Passou do prazo de envio (${esc(D.hm(prazo))}).</b> Faltam: ${esc(faltam.join(', '))}.</span><span class="linha"><button class="botao neutro p" id="btnRecCobrar">${ic('copy')}Copiar cobrança</button><button class="botao p" id="btnRecCobrarWhats">${ic('message')}Cobrar no WhatsApp</button></span></div>` : ''}
      ${ctx.indicadoresHTML(ctx.resumoDoDia(data), contagensExtras(data))}
      ${cartoes}
      <div class="cartao nao-imprimir" style="border-color:var(--azul-borda)">
        <div class="cartao-topo"><div><h3>Texto para o superior</h3><p>No modelo da chefia, com os times que já enviaram. Os nomes seguem a opção da tela Fechamento.</p></div>
          <div class="linha"><button class="botao neutro" id="btnRecFechamento">${ic('chart')}Ver fechamento do dia</button><button class="botao neutro" id="btnRecWhats">${ic('message')}Enviar no WhatsApp</button><button class="botao" id="btnRecSuperior">${ic('copy')}Copiar texto para o superior</button></div></div>
        ${ctx.textoSuperiorHTML(data)}</div>
      <div class="cartao nao-imprimir">
        <div class="cartao-topo"><div><h3>Relação por time</h3><p>Tudo o que os líderes enviaram, time por time, com o detalhe de cada pessoa.</p></div>
          <div class="linha"><button class="botao sec" id="btnRecCopiar">${ic('copy')}Copiar relação</button></div></div>
        <pre class="whats">${esc(texto)}</pre></div>`;
    ctx.ligarTextoSuperior(alvo, data, desenharRecebidos);
    $('#btnRecSuperior').onclick = async () => ctx.aviso(await ctx.copiar(ctx.textoSuperiorAtual(data)) ? 'Texto copiado. É só colar na conversa com o superior.' : 'Não consegui copiar.');
    $('#btnRecCopiar').onclick = async () => ctx.aviso(await ctx.copiar(texto) ? 'Relação copiada. É só colar na conversa.' : 'Não consegui copiar.');
    $('#btnRecWhats').onclick = () => ctx.abrirWhatsApp(ctx.textoSuperiorAtual(data));
    const bCobrar = $('#btnRecCobrar');
    if (bCobrar) {
      bCobrar.onclick = async () => ctx.aviso(await ctx.copiar(cobranca) ? 'Cobrança copiada. Cole no grupo.' : 'Não consegui copiar.');
      $('#btnRecCobrarWhats').onclick = () => ctx.abrirWhatsApp(cobranca);
    }
    $('#btnRecFechamento').onclick = () => { $('#dataDia').value = data; ctx.irPara('dia'); };
  }

  function ligarRecebidos() {
    $('#dataRecebidos').addEventListener('change', e => { if (e.target.value) { est.dataRec = e.target.value; desenharRecebidos(); } });
    $('#btnRecAtualizar').addEventListener('click', async () => { await atualizar(); desenharRecebidos(); ctx.aviso('Atualizado.'); });
  }
  function sincronizarDataRecebidos() { if (!est.dataRec) est.dataRec = ctx.hoje(); $('#dataRecebidos').value = est.dataRec; }

  // ---------- Equipe (logins dos líderes e funcionários) ----------
  async function chamarAdmin(corpo) {
    const { data, error } = await supa.functions.invoke('admin-lideres', { body: corpo });
    if (error) {
      let msg = error.message;
      try { const j = await error.context.json(); if (j && j.erro) msg = j.erro; } catch (e) { /* mantém a mensagem */ }
      throw new Error(msg);
    }
    if (data && data.erro) throw new Error(data.erro);
    return data;
  }

  const sugestaoUsuario = t => String(t).toLowerCase().replace(/[^a-z0-9]/g, '');
  const nomeDoTeamLeader = t => est.funcs.filter(f => f.time === t && /leader/i.test(f.cargo) && f.ativo).map(f => f.nome).join(' / ');

  function desenharEquipe() {
    const alvo = $('#conteudoEquipe');
    if (!est.ok) { alvo.innerHTML = `<div class="cartao">${ctx.vazio('nuvem', 'Carregando…')}</div>`; return; }
    const times = [...new Set(est.funcs.map(f => f.time))].sort(D.ordenarTimes);
    const lidPorTime = {}; est.lideres.forEach(l => { if (l.ativo) lidPorTime[l.time] = l; });
    const inativos = est.lideres.filter(l => !l.ativo);
    const semLogin = times.filter(t => !lidPorTime[t]);

    const cred = est.credenciais.length ? `
      <div class="cartao" style="border-color:var(--verde-borda);background:var(--verde-claro)">
        <div class="cartao-topo"><div class="ladrilho p verde">${ic('checkCircle')}</div><div><h3>Logins criados: copie e entregue agora</h3>
          <p>As senhas aparecem só aqui e só uma vez. Depois disso, só dá para gerar uma senha nova.</p></div></div>
        <pre class="whats">${esc(est.credenciais.map(c => `Time ${c.time}\nUsuário: ${c.usuario}\nSenha: ${c.senha}`).join('\n\n'))}</pre>
        <div class="linha" style="margin-top:10px"><button class="botao" data-acao-eq="copiarCred">${ic('copy')}Copiar tudo</button>
          <button class="botao neutro" data-acao-eq="fecharCred">Já copiei, fechar</button></div>
      </div>` : '';

    const linhas = times.map(t => {
      const l = lidPorTime[t];
      const n = est.funcs.filter(f => f.time === t && f.ativo).length;
      if (l) return `<tr><td><b>${esc(t)}</b></td><td class="num">${n}</td><td>${esc(l.usuario)}${l.nome ? `<br><span style="color:var(--fraco);font-size:.8125rem">${esc(l.nome)}</span>` : ''}</td>
        <td>${l.entrada_turno ? esc(D.hm(l.entrada_turno)) : '<span style="color:var(--fraco)">não definido</span>'}</td>
        <td class="num"><button class="botao sec p" data-acao-eq="novaSenha" data-usuario="${esc(l.usuario)}">Nova senha</button>
          <button class="botao perigo p" data-acao-eq="desativar" data-usuario="${esc(l.usuario)}">Desativar</button></td></tr>`;
      return `<tr><td><b>${esc(t)}</b></td><td class="num">${n}</td>
        <td colspan="2"><div class="linha"><input data-novo-usuario="${esc(t)}" value="${esc(sugestaoUsuario(t))}" style="max-width:150px" aria-label="Usuário do ${esc(t)}"></div></td>
        <td class="num"><button class="botao p" data-acao-eq="criar" data-time="${esc(t)}">Criar login</button></td></tr>`;
    }).join('');

    const p = D.problemasCadastro(est.funcs);
    const nProb = p.duplicadas.reduce((s, d) => s + d.pessoas.length, 0) + p.semMatricula.length + p.curtas.length;
    const chaveProb = new Set([...p.duplicadas.flatMap(d => d.pessoas), ...p.semMatricula, ...p.curtas].map(f => f.id));
    const busca = est.buscaEquipe, filtro = est.filtroEquipe;
    let lista = est.funcs.filter(f => (!filtro || f.time === filtro) && (!est.soProblemas || chaveProb.has(f.id)));
    if (busca) lista = D.buscarFuncionarios(lista, busca, { max: 500 });
    const total = lista.length; lista = lista.slice(0, 120);
    const dup = new Set(p.duplicadas.map(d => d.matricula));

    alvo.innerHTML = `${cred}
      <div class="cartao">
        <div class="cartao-topo"><div class="ladrilho p">${ic('users')}</div><div><h3>Logins dos líderes</h3><p>Cada time tem o seu login. O líder entra só com o usuário e a senha, e só vê o time dele.</p></div><span class="espaco"></span>
          ${semLogin.length ? `<button class="botao" data-acao-eq="criarTodos">${ic('plus')}Criar os ${semLogin.length} logins que faltam</button>` : ''}</div>
        <div class="tabela-rolar"><table class="cinza"><thead><tr><th>Time</th><th class="num">Pessoas</th><th>Usuário</th><th>Turno</th><th></th></tr></thead><tbody>${linhas}</tbody></table></div>
        ${inativos.length ? `<div style="margin-top:10px;color:var(--suave);font-size:.875rem">Desativados: ${inativos.map(l => `${esc(l.usuario)} (${esc(l.time)}) <button class="link" data-acao-eq="reativar" data-usuario="${esc(l.usuario)}">reativar</button>`).join(' · ')}</div>` : ''}
      </div>
      <div class="cartao">
        <div class="cartao-topo"><div class="ladrilho p ${nProb ? 'amarelo' : 'verde'}">${ic(nProb ? 'alert' : 'checkCircle')}</div><div><h3>Funcionários</h3>
          <p>${est.funcs.filter(f => f.ativo).length} ativos em ${times.length} times.${nProb ? ` <b>${nProb}</b> com matrícula para corrigir (repetida, em branco ou curta).` : ' Cadastro sem pendências.'}</p></div></div>
        <div class="filtros-eq">
          <select id="eqTime"><option value="">Todos os times</option>${times.map(t => `<option${t === filtro ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select>
          <div class="com-icone">${ic('search')}<input id="eqBusca" value="${esc(busca)}" placeholder="Buscar nome ou matrícula"></div>
          <label class="so-prob"><input type="checkbox" id="eqProb" ${est.soProblemas ? 'checked' : ''}> Só com problema</label>
        </div>
        <div class="tabela-rolar"><table class="cinza"><thead><tr><th>Nome</th><th>Matrícula</th><th>Time</th><th>Cargo</th><th></th></tr></thead><tbody>
          ${lista.map(f => est.editandoFunc === f.id
            ? `<tr class="editando" data-fid="${esc(f.id)}"><td><input data-ef="nome" value="${esc(f.nome)}"></td><td><input data-ef="matricula" inputmode="numeric" value="${esc(f.matricula)}"></td>
                <td><select data-ef="time">${times.map(t => `<option${t === f.time ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select></td><td>${esc(f.cargo)}</td>
                <td class="num"><button class="botao p" data-acao-eq="salvarFunc">Salvar</button> <button class="botao neutro p" data-acao-eq="cancelarFunc">Cancelar</button></td></tr>`
            : `<tr data-fid="${esc(f.id)}" style="${f.ativo ? '' : 'opacity:.5'}"><td>${esc(f.nome)}</td>
                <td>${f.matricula ? esc(f.matricula) : '<span class="etiqueta">sem matrícula</span>'}${dup.has(f.matricula) ? ' <span class="etiqueta" style="background:var(--vermelho-claro);color:var(--vermelho)">repetida</span>' : (f.matricula && f.matricula.length < 7 ? ' <span class="etiqueta">curta</span>' : '')}</td>
                <td>${esc(f.time)}</td><td>${esc(f.cargo)}</td>
                <td class="num"><button class="botao sec p" data-acao-eq="editarFunc">Editar</button> <button class="botao ${f.ativo ? 'perigo' : 'neutro'} p" data-acao-eq="${f.ativo ? 'desligar' : 'religar'}">${f.ativo ? 'Desativar' : 'Reativar'}</button></td></tr>`).join('')}
        </tbody></table></div>
        ${total > lista.length ? `<div style="color:var(--fraco);margin-top:8px">Mostrando ${lista.length} de ${total}. Use a busca ou o filtro de time.</div>` : ''}
        <details style="margin-top:14px"><summary style="cursor:pointer;font-weight:600">Adicionar funcionário</summary>
          <div class="campos-add"><input id="nfNome" placeholder="Nome" maxlength="120"><input id="nfMat" placeholder="Matrícula" inputmode="numeric" maxlength="20">
            <select id="nfTime">${times.map(t => `<option>${esc(t)}</option>`).join('')}</select>
            <button class="botao" data-acao-eq="addFunc">${ic('plus')}Adicionar</button></div></details>
      </div>
      ${htmlImportar()}
      ${htmlAuditoria()}`;
  }

  // ---------- Atualizar o cadastro pela planilha do RH ----------
  function htmlImportar() {
    const cab = `<div class="cartao-topo"><div class="ladrilho p">${ic('upload')}</div><div><h3>Atualizar cadastro pelo Excel</h3>
      <p>Escolha a planilha do RH (uma aba por time ou uma só). O sistema compara com o cadastro e mostra o que muda antes de aplicar. CPF e telefone da planilha são ignorados.</p></div></div>`;
    const im = est.importacao;
    if (!im) return `<div class="cartao">${cab}<label class="botao sec"><input type="file" id="arqCadastro" accept=".xlsx" hidden>${ic('folder')}Escolher planilha (.xlsx)</label></div>`;
    const c = im.cmp;
    const bloco = (titulo, itens) => itens.length ? `<details class="detalhe-imp"><summary>${titulo} (${itens.length})</summary><ul>${itens.slice(0, 60).map(x => `<li>${x}</li>`).join('')}${itens.length > 60 ? `<li>… e mais ${itens.length - 60}</li>` : ''}</ul></details>` : '';
    const nada = !c.novos.length && !c.alterados.length && !(im.desativar && c.ausentes.length);
    const tile = (rot, v) => `<div class="ind${v ? '' : ' zero'}"><div class="rot">${rot}</div><div class="valor">${v}</div></div>`;
    return `<div class="cartao">${cab}
      <div class="caixa-aviso info">${ic('fileText')}<span>Arquivo: <b>${esc(im.arquivo)}</b> · ${im.total} pessoas lidas.</span></div>
      ${im.avisos.map(a => `<div class="caixa-aviso amarelo">${ic('alert')}<span>${esc(a)}</span></div>`).join('')}
      <div class="ind-grade" style="margin:.75rem 0">${tile('Novas', c.novos.length)}${tile('Alteradas', c.alterados.length)}${tile('Sem mudança', c.iguais)}${tile('Fora da planilha', c.ausentes.length)}</div>
      ${bloco('Novas pessoas', c.novos.map(n => `${esc(n.nome)} (${esc(n.matricula || 'sem matrícula')}) · ${esc(n.time)}`))}
      ${bloco('Alterações', c.alterados.map(a => `<b>${esc(a.atual.nome)}</b>: ${a.mudancas.map(m => esc(m)).join('; ')}`))}
      ${bloco('Cadastradas que não estão na planilha', c.ausentes.map(a => `${esc(a.nome)} (${esc(a.matricula || 'sem matrícula')}) · ${esc(a.time)}`))}
      ${c.ausentes.length ? `<label class="opcao" style="margin-top:.5rem"><input type="checkbox" id="impDesativar" ${im.desativar ? 'checked' : ''}> Desativar as ${c.ausentes.length} pessoas que não estão na planilha</label>` : ''}
      <div class="linha" style="margin-top:.75rem"><button class="botao" data-acao-eq="aplicarImp" ${nada ? 'disabled' : ''}>${ic('check')}Aplicar alterações</button><button class="botao neutro" data-acao-eq="cancelarImp">Cancelar</button></div>
    </div>`;
  }

  async function lerCadastroPlanilha(arq) {
    if (!/\.xlsx$/i.test(arq.name)) return ctx.aviso('Escolha um arquivo Excel (.xlsx).');
    if (arq.size > 5 * 1024 * 1024) return ctx.aviso('Arquivo grande demais (mais de 5 MB).');
    try {
      const abas = await window.Excel.lerPlanilhas(new Uint8Array(await arq.arrayBuffer()));
      const r = D.interpretarPlanilha(abas, [...new Set(est.funcs.map(f => f.time))]);
      if (!r.registros.length) return ctx.aviso('Não encontrei pessoas nessa planilha.');
      est.importacao = { arquivo: arq.name.slice(0, 80), total: r.registros.length, avisos: r.avisos.slice(0, 10), cmp: D.compararCadastro(est.funcs, r.registros), desativar: false };
      desenharEquipe();
    } catch (err) { ctx.aviso('Não consegui ler a planilha: ' + (err && err.message ? err.message : 'erro')); }
  }

  async function aplicarImportacao(botao) {
    const im = est.importacao; if (!im) return;
    const c = im.cmp, desativar = im.desativar ? c.ausentes : [];
    const total = c.novos.length + c.alterados.length + desativar.length;
    if (!confirm(`Aplicar no cadastro?\n\n• ${c.novos.length} pessoa(s) nova(s)\n• ${c.alterados.length} alteração(ões)\n• ${desativar.length} desativação(ões)\n\nTudo fica no registro de alterações.`)) return;
    botao.disabled = true;
    let erros = 0;
    try {
      for (let i = 0; i < c.novos.length; i += 100) {
        const lote = c.novos.slice(i, i + 100).map(n => ({ nome: n.nome, matricula: n.matricula, time: n.time, cargo: n.cargo || '', turno: n.turno || '' }));
        const { error } = await supa.from('funcionarios').insert(lote);
        if (error) { erros += lote.length; console.error('Importar (novos)', error); }
      }
      for (let i = 0; i < c.alterados.length; i += 10) {
        const rs = await Promise.all(c.alterados.slice(i, i + 10).map(a => supa.from('funcionarios').update(a.mudar).eq('id', a.atual.id)));
        erros += rs.filter(r => r.error).length;
      }
      for (let i = 0; i < desativar.length; i += 100) {
        const ids = desativar.slice(i, i + 100).map(a => a.id);
        const { error } = await supa.from('funcionarios').update({ ativo: false }).in('id', ids);
        if (error) { erros += ids.length; console.error('Importar (desativar)', error); }
      }
    } finally { botao.disabled = false; }
    est.importacao = null;
    await atualizar(); desenharEquipe();
    ctx.aviso(erros ? `Aplicado, mas ${erros} item(ns) deram erro. Confira o cadastro.` : `Cadastro atualizado (${total} ${total > 1 ? 'alterações' : 'alteração'}).`);
  }

  // ---------- Registro de alterações ----------
  const semAcento = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  function linhasAuditoria() {
    const a = est.auditoria; if (!a) return [];
    const b = semAcento(a.busca);
    return a.linhas.filter(l => (!a.time || l.time === a.time) && (!b || semAcento(l.texto + ' ' + l.quem).includes(b)));
  }
  function htmlTabelaAuditoria() {
    const linhas = linhasAuditoria();
    if (!linhas.length) return '<div class="vazio-lista">Nada encontrado.</div>';
    return `<div class="tabela-rolar" style="max-height:26rem;overflow-y:auto"><table class="cinza"><thead><tr><th>Quando</th><th>Quem</th><th>Time</th><th>O que aconteceu</th></tr></thead><tbody>${
      linhas.slice(0, 200).map(l => `<tr><td style="white-space:nowrap">${esc(dataHoraBR(l.quando))}</td><td>${esc(l.quem)}</td><td>${esc(l.time)}</td><td>${esc(l.texto)}</td></tr>`).join('')}</tbody></table></div>${
      linhas.length > 200 ? `<div class="contagem-car" style="text-align:left">Mostrando 200 de ${linhas.length}. Use os filtros.</div>` : ''}`;
  }
  function htmlAuditoria() {
    const a = est.auditoria;
    const cab = `<div class="cartao-topo"><div class="ladrilho p">${ic('history')}</div><div><h3>Registro de alterações</h3>
      <p>Quem lançou, alterou ou apagou o quê, e quando. Só supervisores veem, e ninguém consegue editar este registro.</p></div></div>`;
    if (!a) return `<div class="cartao">${cab}<button class="botao sec" data-acao-eq="carregarAud">${ic('download')}Carregar registro</button></div>`;
    const times = [...new Set(a.linhas.map(l => l.time).filter(Boolean))].sort(D.ordenarTimes);
    return `<div class="cartao">${cab}
      <div class="filtros-eq" style="grid-template-columns:minmax(0,12.5rem) minmax(0,1fr) auto">
        <select id="audTime" aria-label="Filtrar por time"><option value="">Todos os times</option>${times.map(t => `<option${t === a.time ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select>
        <div class="com-icone">${ic('search')}<input id="audBusca" value="${esc(a.busca)}" placeholder="Buscar pessoa, quem fez ou o quê" aria-label="Buscar no registro"></div>
        <button class="botao neutro" data-acao-eq="carregarAud">${ic('nuvem')}Atualizar</button>
      </div>
      <div id="auditoriaLista">${htmlTabelaAuditoria()}</div></div>`;
  }
  async function carregarAuditoria() {
    const { data, error } = await supa.from('auditoria').select('quando,usuario,acao,tabela,registro,time,antes,depois').order('quando', { ascending: false }).limit(500);
    if (error) throw error;
    est.auditoria = { linhas: data.map(D.descreverAuditoria), time: est.auditoria ? est.auditoria.time : '', busca: est.auditoria ? est.auditoria.busca : '' };
  }


  function ligarEquipe() {
    const raiz = $('#conteudoEquipe');
    raiz.addEventListener('change', e => {
      if (e.target.id === 'eqTime') { est.filtroEquipe = e.target.value; desenharEquipe(); }
      else if (e.target.id === 'eqProb') { est.soProblemas = e.target.checked; desenharEquipe(); }
      else if (e.target.id === 'arqCadastro') { const arq = e.target.files[0]; e.target.value = ''; if (arq) lerCadastroPlanilha(arq); }
      else if (e.target.id === 'impDesativar' && est.importacao) { est.importacao.desativar = e.target.checked; desenharEquipe(); }
      else if (e.target.id === 'audTime' && est.auditoria) { est.auditoria.time = e.target.value; $('#auditoriaLista').innerHTML = htmlTabelaAuditoria(); }
    });
    raiz.addEventListener('input', e => {
      if (e.target.id === 'audBusca' && est.auditoria) { est.auditoria.busca = e.target.value; $('#auditoriaLista').innerHTML = htmlTabelaAuditoria(); return; }
      if (e.target.id !== 'eqBusca') return;
      est.buscaEquipe = e.target.value;
      clearTimeout(ligarEquipe.t);
      ligarEquipe.t = setTimeout(() => { desenharEquipe(); const i = $('#eqBusca'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }, 250);
    });
    raiz.addEventListener('click', async e => {
      const b = e.target.closest('[data-acao-eq]'); if (!b) return;
      const acao = b.dataset.acaoEq;
      const fid = (b.closest('[data-fid]') || { dataset: {} }).dataset.fid;
      try {
        if (acao === 'criar') await criarLogin(b.dataset.time, ($(`[data-novo-usuario="${CSS.escape(b.dataset.time)}"]`) || {}).value, b);
        else if (acao === 'criarTodos') await criarTodos(b);
        else if (acao === 'novaSenha') {
          if (!confirm(`Gerar uma senha nova para ${b.dataset.usuario}? A senha antiga deixa de valer.`)) return;
          b.disabled = true;
          const r = await chamarAdmin({ acao: 'redefinir', usuario: b.dataset.usuario });
          est.credenciais = [r]; desenharEquipe(); window.scrollTo(0, 0);
        } else if (acao === 'desativar') {
          if (!confirm(`Desativar o login ${b.dataset.usuario}? O líder deixa de conseguir entrar. Os lançamentos ficam guardados.`)) return;
          await chamarAdmin({ acao: 'desativar', usuario: b.dataset.usuario }); await atualizar(); desenharEquipe();
        } else if (acao === 'reativar') { await chamarAdmin({ acao: 'reativar', usuario: b.dataset.usuario }); await atualizar(); desenharEquipe(); }
        else if (acao === 'aplicarImp') await aplicarImportacao(b);
        else if (acao === 'cancelarImp') { est.importacao = null; desenharEquipe(); }
        else if (acao === 'carregarAud') { b.disabled = true; await carregarAuditoria(); desenharEquipe(); }
        else if (acao === 'copiarCred') ctx.aviso(await ctx.copiar(est.credenciais.map(c => `Time ${c.time}\nUsuário: ${c.usuario}\nSenha: ${c.senha}`).join('\n\n')) ? 'Copiado.' : 'Não consegui copiar.');
        else if (acao === 'fecharCred') { est.credenciais = []; desenharEquipe(); }
        else if (acao === 'editarFunc') { est.editandoFunc = fid; desenharEquipe(); }
        else if (acao === 'cancelarFunc') { est.editandoFunc = null; desenharEquipe(); }
        else if (acao === 'salvarFunc') {
          const tr = b.closest('tr'), v = k => tr.querySelector(`[data-ef="${k}"]`).value;
          const nome = v('nome').replace(/\s+/g, ' ').trim(); if (!nome) return ctx.aviso('O nome não pode ficar vazio.');
          const { error } = await supa.from('funcionarios').update({ nome, matricula: soDigitos(v('matricula')), time: v('time') }).eq('id', fid);
          if (error) throw error;
          est.editandoFunc = null; await atualizar(); desenharEquipe(); ctx.aviso('Salvo.');
        } else if (acao === 'desligar' || acao === 'religar') {
          const f = est.funcs.find(x => x.id === fid);
          if (acao === 'desligar' && !confirm(`Desativar ${f.nome}? Ele(a) some da lista de busca dos líderes e do efetivo.`)) return;
          const { error } = await supa.from('funcionarios').update({ ativo: acao === 'religar' }).eq('id', fid);
          if (error) throw error;
          await atualizar(); desenharEquipe();
        } else if (acao === 'addFunc') {
          const nome = $('#nfNome').value.replace(/\s+/g, ' ').trim(); if (!nome) return ctx.aviso('Digite o nome.');
          const { error } = await supa.from('funcionarios').insert({ nome, matricula: soDigitos($('#nfMat').value), time: $('#nfTime').value, cargo: 'Operador', turno: '2° Turno' });
          if (error) throw error;
          await atualizar(); desenharEquipe(); ctx.aviso(`${nome} adicionado(a).`);
        }
      } catch (err) { ctx.aviso(falha(err)); if (b.isConnected) b.disabled = false; }
    });
  }

  async function criarLogin(time, usuario, botao) {
    botao.disabled = true;
    const r = await chamarAdmin({ acao: 'criar', time, usuario: String(usuario || '').trim().toLowerCase(), nome: nomeDoTeamLeader(time) });
    est.credenciais.push(r);
    await atualizar(); desenharEquipe(); window.scrollTo(0, 0);
  }
  async function criarTodos(botao) {
    const times = [...new Set(est.funcs.map(f => f.time))].filter(t => !est.lideres.some(l => l.ativo && l.time === t)).sort(D.ordenarTimes);
    if (!confirm(`Criar ${times.length} login(s): ${times.join(', ')}?\n\nO usuário de cada um é o nome do time em minúsculas. As senhas aparecem uma vez só.`)) return;
    botao.disabled = true;
    const feitos = [], erros = [];
    for (const t of times) {
      try { feitos.push(await chamarAdmin({ acao: 'criar', time: t, usuario: sugestaoUsuario(t), nome: nomeDoTeamLeader(t) })); }
      catch (e) { erros.push(`${t}: ${e.message}`); }
    }
    est.credenciais = est.credenciais.concat(feitos);
    await atualizar(); desenharEquipe(); window.scrollTo(0, 0);
    if (erros.length) alert('Alguns não foram criados:\n\n' + erros.join('\n'));
  }

  function iniciarTelas() {
    ligarRecebidos(); ligarEquipe();
    // As abas do líder ficam na barra de navegação do app (embaixo no celular, na lateral no computador)
    $('#abas').addEventListener('click', e => {
      const b = e.target.closest('[data-aba-lider]');
      if (!b || !perfil || perfil.papel !== 'lider') return;
      lider.aba = b.dataset.abaLider; lider.editando = null;
      if (lider.aba === 'equipe') { lider.equipe.aberto = null; lider.equipe.editando = null; }   // tocar na aba volta para a lista
      desenharLiderPainel(); window.scrollTo(0, 0);
    });
    document.addEventListener('visibilitychange', () => { if (!document.hidden && perfil && perfil.papel === 'lider') recarregarLider(); });
    window.addEventListener('online', () => { if (perfil && perfil.papel === 'lider') { lider.sessaoExpirada = false; recarregarLider(); } });
    window.addEventListener('offline', () => { if (perfil && perfil.papel === 'lider') { lider.offline = true; desenharLiderPainel(); } });
    setInterval(() => { if (!document.hidden && perfil && perfil.papel === 'lider' && lider.fila.length) drenarFila(); }, 30000);
    setInterval(async () => {
      if (document.hidden || !perfil) return;
      if (perfil.papel === 'supervisor') { if (await atualizar()) { redesenharAtual(); ctx.aoReceberDosLideres && ctx.aoReceberDosLideres(); } }
    }, 60000);
  }

  window.Painel = {
    ligar, iniciarTelas, carregarPerfil, abrirLider, prepararSupervisor, atualizar, desenhar, sincronizarDataRecebidos,
    mesclar, ehDeLider, sair, ABAS, temDados,
    contagensExtras, garantirDesde, carregarTudo, dadosCarregados, ehSupervisor, salvarPrazo, pendentesLider, ultimoLider,
    textoEditado, guardarTextoEditado, apagarTextoEditado, get prazo() { return prazo; },
    totalCadastro: () => (est.ok ? est.funcs.filter(f => f.ativo).length : 0),
    blocoExtras: data => (est.ok ? D.blocoExtras(data, est.lancs) : ''),
    get perfil() { return perfil; },
  };
})();
