// Sincronização dos dados com a conta do usuário (Supabase), para celular e PC verem o mesmo.
// Cada lançamento vira um registro na tabela "registros" (chave = "data|time"), mais "config" e "cadastro".
// O aparelho guarda tudo localmente (funciona sem internet) e envia só o que mudou.
(function (raiz) {
  'use strict';

  // ---------- Regras (funções puras, testadas em testes/sincronia.test.js) ----------

  // Base → { chave: texto JSON } de cada parte que é sincronizada
  function mapaDaBase(base) {
    const m = {};
    for (const [k, f] of Object.entries(base.fechamentos || {})) m[k] = JSON.stringify(f);
    m.config = JSON.stringify(base.config || {});
    m.cadastro = JSON.stringify(base.cadastro || {});
    return m;
  }

  // Chaves que mudaram desde o que o servidor já tem (espelho). Chave que sumiu = apagada.
  function chavesMudadas(espelho, base) {
    const atual = mapaDaBase(base);
    const mudou = [];
    for (const [k, v] of Object.entries(atual)) if (espelho[k] !== v) mudou.push(k);
    for (const k of Object.keys(espelho)) if (!(k in atual) && espelho[k] !== null) mudou.push(k);
    return mudou;
  }

  // Linhas para enviar: dados atuais, ou null se a chave foi apagada
  function linhasParaEnviar(base, chaves) {
    const atual = mapaDaBase(base);
    return chaves.map(k => ({ chave: k, dados: k in atual ? JSON.parse(atual[k]) : null }));
  }

  // Aplica o que veio do servidor. O que foi mudado aqui e ainda não subiu (pendente) vence.
  // Devolve { base, espelho, mudou }
  function aplicarRemotos(base, espelho, linhas, pendentes) {
    const nova = JSON.parse(JSON.stringify(base));
    const esp = Object.assign({}, espelho);
    let mudou = false;
    for (const l of linhas) {
      if (pendentes && pendentes[l.chave]) continue;
      const texto = l.dados == null ? null : JSON.stringify(l.dados);
      esp[l.chave] = texto;
      if (l.chave === 'config') {
        if (texto !== JSON.stringify(nova.config)) { nova.config = Object.assign({}, nova.config, l.dados || {}); mudou = true; }
      } else if (l.chave === 'cadastro') {
        if (texto !== JSON.stringify(nova.cadastro)) { nova.cadastro = l.dados || {}; mudou = true; }
      } else if (l.dados == null) {
        if (nova.fechamentos[l.chave]) { delete nova.fechamentos[l.chave]; mudou = true; }
      } else if (texto !== JSON.stringify(nova.fechamentos[l.chave])) {
        nova.fechamentos[l.chave] = l.dados; mudou = true;
      }
    }
    return { base: nova, espelho: esp, mudou };
  }

  const Regras = { mapaDaBase, chavesMudadas, linhasParaEnviar, aplicarRemotos };
  if (typeof module !== 'undefined' && module.exports) { module.exports = Regras; return; }

  // ---------- No navegador ----------
  const estadoVazio = () => ({ usuario: null, email: null, ultimaPuxada: null, espelho: {}, pendentes: {} });

  function lerEstado(CHAVE_SINC) {
    try { return Object.assign(estadoVazio(), JSON.parse(localStorage.getItem(CHAVE_SINC)) || {}); }
    catch (e) { return estadoVazio(); }
  }

  // opcoes: { url, chave, pegarBase(), trocarBase(base), aoMudarEstado(info), aoReceber() }
  // (cliente e chaveEstado só são passados nos testes)
  function criar(opcoes) {
    const CHAVE_SINC = opcoes.chaveEstado || 'absenteismo.sinc';
    const supa = opcoes.cliente || (raiz.supabase && raiz.supabase.createClient
      ? raiz.supabase.createClient(opcoes.url, opcoes.chave, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } })
      : null);
    let est = lerEstado(CHAVE_SINC);
    let enviando = false, deNovo = false, timer = null, puxando = null;
    let info = { estado: 'parado', hora: null, erro: null };

    const guardar = () => { try { localStorage.setItem(CHAVE_SINC, JSON.stringify(est)); } catch (e) { /* cheio */ } };
    const avisar = (estado, extra) => {
      info = Object.assign({ estado, hora: info.hora, erro: null, pendentes: Object.keys(est.pendentes).length }, extra || {});
      opcoes.aoMudarEstado && opcoes.aoMudarEstado(info);
    };

    async function enviar() {
      if (!supa || !est.usuario) return;
      if (enviando) { deNovo = true; return; }
      const chaves = Object.keys(est.pendentes);
      if (!chaves.length) return;
      if (!navigator.onLine) { avisar('offline'); return; }
      enviando = true; avisar('enviando');
      try {
        const base = opcoes.pegarBase();
        const linhas = linhasParaEnviar(base, chaves).map(l => Object.assign({ user_id: est.usuario }, l));
        for (let i = 0; i < linhas.length; i += 200) {
          const { error } = await supa.from('registros').upsert(linhas.slice(i, i + 200), { onConflict: 'user_id,chave' });
          if (error) throw error;
        }
        const atual = mapaDaBase(opcoes.pegarBase());
        for (const l of linhas) {
          const texto = l.dados == null ? null : JSON.stringify(l.dados);
          est.espelho[l.chave] = texto;
          // Se mudou de novo enquanto enviava, continua pendente
          if ((atual[l.chave] ?? null) === texto) delete est.pendentes[l.chave];
        }
        guardar();
        avisar('ok', { hora: new Date() });
      } catch (e) {
        console.error('Sincronia (enviar)', e);
        avisar(navigator.onLine ? 'erro' : 'offline', { erro: e.message || String(e) });
      } finally {
        enviando = false;
        if (deNovo) { deNovo = false; enviar(); }
      }
    }

    async function puxar() {
      if (!supa || !est.usuario) return false;
      if (puxando) return puxando;
      if (!navigator.onLine) { avisar('offline'); return false; }
      puxando = (async () => {
        try {
          let mudouAlgo = false;
          for (;;) {
            let q = supa.from('registros').select('chave,dados,atualizado_em').order('atualizado_em', { ascending: true }).limit(500);
            if (est.ultimaPuxada) q = q.gt('atualizado_em', est.ultimaPuxada);
            const { data, error } = await q;
            if (error) throw error;
            if (!data.length) break;
            const r = aplicarRemotos(opcoes.pegarBase(), est.espelho, data, est.pendentes);
            est.espelho = r.espelho;
            est.ultimaPuxada = data[data.length - 1].atualizado_em;
            if (r.mudou) { opcoes.trocarBase(r.base); mudouAlgo = true; }
            guardar();
            if (data.length < 500) break;
          }
          if (mudouAlgo && opcoes.aoReceber) opcoes.aoReceber();
          avisar(Object.keys(est.pendentes).length ? 'enviando' : 'ok', { hora: new Date() });
          return mudouAlgo;
        } catch (e) {
          console.error('Sincronia (puxar)', e);
          avisar(navigator.onLine ? 'erro' : 'offline', { erro: e.message || String(e) });
          return false;
        } finally { puxando = null; }
      })();
      return puxando;
    }

    async function sincronizar() { await enviar(); await puxar(); }

    // Chamado sempre que a base local é salva
    function marcarMudancas() {
      if (!est.usuario) return;
      for (const k of chavesMudadas(est.espelho, opcoes.pegarBase())) est.pendentes[k] = true;
      guardar();
      avisar(navigator.onLine ? 'enviando' : 'offline');
      clearTimeout(timer);
      timer = setTimeout(enviar, 800);
    }

    // Primeira vez desta conta neste aparelho
    async function prepararUsuario(usuario, dadosLocaisPerguntar) {
      const mesmo = est.usuario === usuario.id;
      if (!mesmo) {
        const anterior = est.usuario;
        const temLocal = Object.keys(opcoes.pegarBase().fechamentos || {}).length > 0;
        est = estadoVazio();
        est.usuario = usuario.id; est.email = usuario.email;
        if (temLocal && !anterior && await dadosLocaisPerguntar()) {
          // Dados de antes do login: sobem para a conta
          for (const k of Object.keys(mapaDaBase(opcoes.pegarBase()))) est.pendentes[k] = true;
        } else {
          opcoes.trocarBase(null); // começa limpo; vem tudo da conta
        }
        guardar();
      }
      await sincronizar();
    }

    function esquecer() { est = estadoVazio(); try { localStorage.removeItem(CHAVE_SINC); } catch (e) { /* ok */ } }

    return {
      supa, disponivel: !!supa,
      get estado() { return est; },
      get info() { return info; },
      marcarMudancas, enviar, puxar, sincronizar, prepararUsuario, esquecer,
      pendentes: () => Object.keys(est.pendentes).length,
    };
  }

  raiz.Sincronia = Object.assign({ criar }, Regras);
})(typeof window !== 'undefined' ? window : globalThis);
