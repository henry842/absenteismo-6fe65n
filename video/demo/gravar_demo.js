// Grava os microvídeos do app de absenteísmo: abre o app de verdade (servidor local + Supabase simulado),
// executa cada cena (cliques, digitação, rolagem) e captura a tela pelo screencast do Chromium.
// Uso: node gravar_demo.js [id-da-cena ...]   (sem argumentos grava todas)
// Precisa do app servido em http://localhost:8765 (python3 -m http.server 8765 na raiz do repositório).
const fs = require('fs'), path = require('path');
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
const CENAS = require('./cenas.js');
const URL_APP = process.env.APP_URL || 'http://localhost:8765/';
const SAIDA = path.join(__dirname, 'quadros');
const AGORA = new Date('2026-09-25T08:10:00-03:00'); // sexta-feira de manhã, dia do fechamento

async function prepararEstado(page, estado) {
  await page.evaluate(({ estado }) => {
    localStorage.clear();
    const L = window.Leitor;
    let base = window.__gerarDemo({ ate: '2026-09-24', semanas: 5 });
    if (estado === 'dia-gravado') {
      base.config.apelidos = { 'faltou sem avisar': 'Sem justificativa', 'busquei o filho na escola': 'Atraso motivo pessoal' };
      for (const m of L.lerMensagens(window.__mensagensDoDia('2026-09-25'), { ano: 2026, apelidos: base.config.apelidos })) {
        if (m.time === 'C3B') { m.presentes = 38; m.ausentes = 2; }
        base = L.gravar(base, m);
      }
    }
    localStorage.setItem('absenteismo.v1', JSON.stringify(base));
    // Mesmo usuário já usado neste aparelho: ao entrar, o app não pergunta sobre dados antigos
    localStorage.setItem('absenteismo.sinc', JSON.stringify({ usuario: 'demo-lider', email: 'lider.demo@exemplo.com', ultimaPuxada: null, espelho: {}, pendentes: {} }));
    if (estado !== 'deslogado') localStorage.setItem('demo.logado', 'sim');
  }, { estado });
}

function ajudantes(page) {
  const loc = sel => (typeof sel === 'string' ? page.locator(sel) : sel).first();
  const esperar = ms => page.waitForTimeout(ms);
  const caixa = async sel => { const b = await loc(sel).boundingBox(); if (!b) throw new Error('sem caixa: ' + sel); return b; };
  const h = {
    page, esperar, loc,
    async titulo(num, nome, sub, ms = 2600) {
      await page.evaluate(({ num, nome, sub }) => {
        window.__demo.montar(); const t = document.getElementById('demo-tit');
        t.querySelector('small').textContent = num; t.querySelector('strong').textContent = nome; t.querySelector('span').textContent = sub || '';
        t.style.transition = 'none'; t.style.opacity = 1;
      }, { num, nome, sub });
      await esperar(ms);
      await page.evaluate(() => { const t = document.getElementById('demo-tit'); t.style.transition = ''; t.style.opacity = 0; });
      await esperar(600);
    },
    async fim(texto, ms = 2200) {
      await h.leg(''); await h.dest(null);
      await page.evaluate(({ texto }) => {
        const t = document.getElementById('demo-tit');
        t.querySelector('small').textContent = 'Absenteísmo dos times'; t.querySelector('strong').textContent = texto; t.querySelector('span').textContent = '';
        t.style.opacity = 1;
      }, { texto });
      await esperar(ms);
    },
    async leg(texto, opcoes = {}) {
      await page.evaluate(({ texto, topo }) => {
        window.__demo.montar(); const l = document.getElementById('demo-leg');
        l.classList.toggle('topo', !!topo); l.textContent = texto; l.style.opacity = texto ? 1 : 0;
      }, { texto, topo: !!opcoes.topo });
      if (opcoes.ms) await esperar(opcoes.ms);
    },
    async rolar(sel, bloco = 'center') {
      // Desconta o que fica grudado no topo (menu das etapas), para o destaque não ficar escondido
      await loc(sel).evaluate((el, bloco) => {
        const fixo = [...document.querySelectorAll('body *')].filter(x => /sticky|fixed/.test(getComputedStyle(x).position) && x.getBoundingClientRect().top <= 1 && x.offsetHeight < innerHeight / 3 && !x.id.startsWith('demo'))
          .reduce((m, x) => Math.max(m, x.getBoundingClientRect().bottom), 0);
        const r = el.getBoundingClientRect();
        const livre = innerHeight - fixo;
        let alvo = bloco === 'start' || r.height > livre - 40 ? r.top - fixo - 14 : r.top - fixo - (livre - r.height) / 2;
        window.scrollTo({ top: scrollY + alvo, behavior: 'smooth' });
      }, bloco);
      await esperar(1000);
    },
    async topo() { await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' })); await esperar(800); },
    async dest(sel, folga = 6) {
      if (!sel) { await page.evaluate(() => { const d = document.getElementById('demo-dest'); if (d) d.style.opacity = 0; }); return; }
      const b = await caixa(sel);
      await page.evaluate(({ b, folga }) => {
        const d = document.getElementById('demo-dest');
        Object.assign(d.style, { left: b.x - folga + 'px', top: b.y - folga + 'px', width: b.width + 2 * folga + 'px', height: b.height + 2 * folga + 'px', opacity: 1 });
      }, { b, folga });
      await esperar(550);
    },
    async cursor(sel) {
      const b = await caixa(sel);
      await page.evaluate(({ x, y }) => {
        const c = document.getElementById('demo-cur');
        if (c.style.opacity !== '1') { c.style.transition = 'none'; c.style.left = (x + 180) + 'px'; c.style.top = (y + 120) + 'px'; c.getBoundingClientRect(); c.style.transition = ''; }
        c.style.opacity = 1; c.style.left = x + 'px'; c.style.top = y + 'px';
      }, { x: b.x + b.width / 2, y: b.y + b.height / 2 });
      await esperar(800);
      return b;
    },
    async esconderCursor() { await page.evaluate(() => { const c = document.getElementById('demo-cur'); if (c) c.style.opacity = 0; }); },
    async clicar(sel, opcoes = {}) {
      if (opcoes.rolar !== false) await loc(sel).scrollIntoViewIfNeeded();
      const b = await h.cursor(sel);
      await page.evaluate(({ x, y }) => {
        const o = document.createElement('div'); o.className = 'demo-ond';
        Object.assign(o.style, { left: x - 12 + 'px', top: y - 12 + 'px' }); document.body.appendChild(o); setTimeout(() => o.remove(), 950);
      }, { x: b.x + b.width / 2, y: b.y + b.height / 2 });
      await loc(sel).click();
      await esperar(opcoes.depois ?? 700);
    },
    async digitar(sel, texto, atraso = 55) {
      await h.clicar(sel, { depois: 200 });
      await page.keyboard.type(texto, { delay: atraso });
      await esperar(300);
    },
    async limparEDigitar(sel, texto, atraso = 60) {
      await h.clicar(sel, { depois: 150 });
      await page.keyboard.press('Control+A'); await page.keyboard.press('Backspace');
      await page.keyboard.type(texto, { delay: atraso });
      await loc(sel).evaluate(el => el.dispatchEvent(new Event('change', { bubbles: true })));
      await esperar(400);
    },
    async colar(sel, texto) {
      await h.clicar(sel, { depois: 250 });
      await loc(sel).evaluate((el, t) => { el.value = t; el.dispatchEvent(new Event('input', { bubbles: true })); }, texto);
      await esperar(900);
    },
    async escolher(sel, valor) {
      await h.clicar(sel, { depois: 250 });
      await loc(sel).selectOption(valor);
      await esperar(700);
    },
  };
  return h;
}

async function gravarCena(browser, cena) {
  const movel = !!cena.movel;
  const vp = movel ? { width: 390, height: 844 } : { width: 1440, height: 810 };
  const dsf = movel ? 2 : 4 / 3;
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: dsf, locale: 'pt-BR', timezoneId: 'America/Bahia',
    isMobile: movel, hasTouch: movel, acceptDownloads: true });
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: new URL(URL_APP).origin });
  await ctx.route(/cdn\.jsdelivr\.net/, r => r.abort());
  await ctx.addInitScript({ path: path.join(__dirname, 'ambiente.js') });
  await ctx.addInitScript({ path: path.join(__dirname, 'dados.js') });
  const page = await ctx.newPage();
  await page.clock.install({ time: AGORA }); await page.clock.resume();
  page.on('pageerror', e => console.error('[erro na página]', cena.id, e.message));
  await page.goto(URL_APP);
  await prepararEstado(page, cena.estado || 'historico');
  await page.reload(); await page.waitForTimeout(1500);
  await page.evaluate(() => window.__demo.montar());

  const pasta = path.join(SAIDA, cena.id);
  fs.rmSync(pasta, { recursive: true, force: true }); fs.mkdirSync(pasta, { recursive: true });
  const cdp = await ctx.newCDPSession(page);
  const quadros = [];
  cdp.on('Page.screencastFrame', f => {
    const nome = `f${String(quadros.length).padStart(6, '0')}.jpg`;
    quadros.push([f.metadata.timestamp, nome]);
    fs.writeFileSync(path.join(pasta, nome), Buffer.from(f.data, 'base64'));
    cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {});
  });
  // um pixel que pisca mantém os quadros chegando com a tela parada
  await page.evaluate(() => { const d = document.createElement('div'); d.style.cssText = 'position:fixed;right:0;bottom:0;width:1px;height:1px;z-index:2147483647';
    document.body.appendChild(d); let k = 0; (function t() { d.style.background = (k++ % 2) ? '#f5f7fa' : '#f5f7fb'; requestAnimationFrame(t); })(); });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 90, maxWidth: Math.round(vp.width * dsf), maxHeight: Math.round(vp.height * dsf), everyNthFrame: 2 });
  await page.waitForTimeout(300);
  const inicio = Date.now() / 1000;
  await cena.rodar(ajudantes(page));
  const fim = Date.now() / 1000;
  await cdp.send('Page.stopScreencast');
  fs.writeFileSync(path.join(pasta, 'quadros.json'), JSON.stringify({ inicio, fim, quadros: quadros.filter(q => q[0] <= fim) }));
  await ctx.close();
  console.log(`${cena.id}: ${(fim - inicio).toFixed(1)} s, ${quadros.length} quadros`);
}

(async () => {
  const pedidas = process.argv.slice(2);
  const browser = await chromium.launch();
  for (const cena of CENAS.filter(c => !pedidas.length || pedidas.includes(c.id))) await gravarCena(browser, cena);
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
