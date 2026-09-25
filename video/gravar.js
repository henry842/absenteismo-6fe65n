// Grava o vídeo das telas do C3B com destaques e legendas, via screencast do Chromium.
// Uso: node gravar.js <pt|zh>   (usa audio/<lang>/duracoes.json se existir; senão estima pelo texto)
// O HTML das telas fica em entrada/C3B_Todas_as_Telas.html (ou na variável C3B_HTML).
const fs = require('fs'), path = require('path');
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
const lang = process.argv[2] || 'pt';
const HTML = 'file://' + path.resolve(process.env.C3B_HTML || path.join(__dirname, 'entrada', 'C3B_Todas_as_Telas.html'));
const roteiro = JSON.parse(fs.readFileSync(path.join(__dirname, 'roteiro.json'), 'utf8'));
const durFile = path.join(__dirname, 'audio', lang, 'duracoes.json');
const durReal = fs.existsSync(durFile) ? JSON.parse(fs.readFileSync(durFile, 'utf8')) : null;
const estima = t => lang === 'zh' ? t.replace(/[^一-鿿]/g, '').length / 4.3 + 0.9
                                  : t.split(/\s+/).length / 2.6 + 0.9;
const dur = it => durReal ? durReal[it.id] : Math.max(3.5, estima(it[lang]));
const outDir = path.join(__dirname, 'frames_' + lang);
fs.rmSync(outDir, { recursive: true, force: true }); fs.mkdirSync(outDir);

const CSS = `
#hl{position:fixed;z-index:9998;border:3px solid #1ccc61;border-radius:12px;pointer-events:none;
 box-shadow:0 0 0 4px #1ccc6155,0 0 0 9999px rgba(0,20,15,.55);opacity:0;
 transition:all .55s cubic-bezier(.4,0,.2,1)}
#app-root{transition:transform .8s cubic-bezier(.4,0,.2,1);position:relative}
#cap{position:fixed;left:50%;transform:translateX(-50%);bottom:34px;z-index:10000;max-width:1500px;
 background:rgba(0,37,30,.92);color:#fff;border-left:5px solid #1ccc61;border-radius:10px;padding:14px 26px;
 font:600 27px/1.4 'Segoe UI','WenQuanYi Zen Hei',Arial,sans-serif;text-align:center;opacity:0;transition:opacity .3s, bottom .4s}
#cap.top{bottom:auto;top:30px}
#fade{position:fixed;inset:0;background:#003c30;z-index:10001;opacity:0;pointer-events:none;transition:opacity .45s}
#card{position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:18px;
 background:radial-gradient(circle at 50% 45%,rgba(0,108,82,.93),rgba(0,37,30,.97));color:#fff;opacity:0;transition:opacity .6s;
 font-family:'Segoe UI','WenQuanYi Zen Hei',Arial,sans-serif}
#card img{width:150px;height:150px;border-radius:50%}
#card h1{font-size:88px;letter-spacing:-2px;margin:0}#card p{font-size:34px;margin:0;opacity:.9}
.ripple{position:fixed;z-index:9999;width:22px;height:22px;border-radius:50%;background:#1ccc61;pointer-events:none;
 animation:rp 1s ease-out forwards}@keyframes rp{0%{transform:scale(.4);opacity:.95}100%{transform:scale(3.2);opacity:0}}
#cursor{position:fixed;z-index:10000;width:26px;height:26px;pointer-events:none;transition:all .9s cubic-bezier(.4,0,.2,1);opacity:0}`;

const TITULO = { pt: 'Central de Habilidades · BYD Camaçari', zh: '技能管理中心 · 比亚迪卡马萨里' };

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await page.goto(HTML + '#tela-1'); await page.waitForTimeout(1000);

  const setup = async () => page.evaluate(({ CSS, titulo }) => {
    if (document.getElementById('hl')) return;
    document.getElementById('hl-style')?.remove();
    const st = document.createElement('style'); st.id = 'hl-style'; st.textContent = CSS; document.head.appendChild(st);
    const root = document.getElementById('app-root');
    const logo = (document.querySelector('.brand-mark img') || {}).src || '';
    document.body.insertAdjacentHTML('beforeend', `<div id="cap"></div><div id="fade"></div>
      <div id="card"><img src="${logo}"><h1>C3B</h1><p>${titulo}</p></div>`);
    document.body.insertAdjacentHTML('beforeend', `<div id="hl"></div>
      <svg id="cursor" viewBox="0 0 24 24"><path d="M3 2l7 19 2.5-8.5L21 10z" fill="#fff" stroke="#102039" stroke-width="1.6"/></svg>`);
  }, { CSS, titulo: TITULO[lang] });

  const irPara = async n => {
    await page.evaluate(() => { document.getElementById('fade').style.opacity = 1; });
    await page.waitForTimeout(500);
    await page.evaluate(n => { location.hash = '#tela-' + n; }, n);
    await page.waitForTimeout(700);
    await setup();
    await page.evaluate(() => { const f = document.getElementById('fade'); f.style.transition = 'none'; f.style.opacity = 1;
      requestAnimationFrame(() => { f.style.transition = ''; f.style.opacity = 0; }); });
    await page.waitForTimeout(450);
  };

  // Destaca a união dos alvos (ou cada alvo em sequência quando "passo")
  const destacar = (alvos, zoom) => page.evaluate(({ alvos, zoom }) => {
    const find = a => [...document.querySelectorAll(a.sel)].filter(e => !a.has || e.innerText.includes(a.has))
      .filter(e => e.getBoundingClientRect().width > 0);
    const els = alvos.flatMap(a => { const f = find(a); return a.all ? f : f.slice(-1).length && a.has ? [f.sort((x, y) => x.getBoundingClientRect().width * x.getBoundingClientRect().height - y.getBoundingClientRect().width * y.getBoundingClientRect().height)[0]] : f.slice(0, 1); });
    if (!els.length) return 'NENHUM ALVO ' + JSON.stringify(alvos);
    const root = document.getElementById('app-root');
    const z0 = root.getBoundingClientRect().width / root.offsetWidth; // zoom atual
    const o0 = (root.style.transformOrigin || '0px 0px').split(' ').map(parseFloat);
    // coordenadas sem zoom
    const rs = els.map(e => { const r = e.getBoundingClientRect();
      return { left: o0[0] + (r.left - o0[0]) / z0, top: o0[1] + (r.top - o0[1]) / z0, right: o0[0] + (r.right - o0[0]) / z0, bottom: o0[1] + (r.bottom - o0[1]) / z0 }; });
    let x = Math.min(...rs.map(r => r.left)) - 8, y = Math.min(...rs.map(r => r.top)) - 8;
    let w = Math.max(...rs.map(r => r.right)) - x + 8, h = Math.max(...rs.map(r => r.bottom)) - y + 8;
    const cx = x + w / 2, cy = y + h / 2, z = zoom || 1;
    root.style.transformOrigin = `${cx}px ${cy}px`;
    root.style.transform = zoom ? `scale(${zoom})` : '';
    w *= z; h *= z; x = cx - w / 2; y = cy - h / 2;
    const hl = document.getElementById('hl');
    Object.assign(hl.style, { left: x + 'px', top: y + 'px', width: w + 'px', height: h + 'px', opacity: 1 });
    const cap = document.getElementById('cap'); cap.classList.toggle('top', y + h > 820);
    return 'ok';
  }, { alvos, zoom });

  const legenda = t => page.evaluate(t => { const c = document.getElementById('cap'); c.textContent = t; c.style.opacity = t ? 1 : 0; }, t);
  const cartela = on => page.evaluate(on => { document.getElementById('card').style.opacity = on ? 1 : 0;
    const hl = document.getElementById('hl'); if (hl) hl.style.opacity = 0; document.getElementById('app-root').style.transform = ''; }, on);
  const clicar = c => page.evaluate(c => {
    const e = [...document.querySelectorAll(c.sel)].find(e => e.innerText.includes(c.has)); if (!e) return;
    const root = document.body, r = e.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const cur = document.getElementById('cursor');
    Object.assign(cur.style, { transition: 'none', left: (cx + 260) + 'px', top: (cy + 160) + 'px', opacity: 1 });
    requestAnimationFrame(() => { cur.style.transition = ''; cur.style.left = cx + 'px'; cur.style.top = cy + 'px'; });
    setTimeout(() => { const d = document.createElement('div'); d.className = 'ripple';
      Object.assign(d.style, { left: cx - 11 + 'px', top: cy - 11 + 'px' }); root.appendChild(d);
      setTimeout(() => d.remove(), 1100); }, 1000);
    setTimeout(() => { cur.style.opacity = 0; }, 2300);
  }, c);

  // Screencast: frames JPEG com timestamp
  const cdp = await page.context().newCDPSession(page);
  const frames = [];
  cdp.on('Page.screencastFrame', async f => {
    const i = frames.length; frames.push(f.metadata.timestamp);
    fs.writeFileSync(path.join(outDir, `f${String(i).padStart(6, '0')}.jpg`), Buffer.from(f.data, 'base64'));
    cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {});
  });
  await setup();
  await cartela(true);
  await page.waitForTimeout(300);
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: 1920, maxHeight: 1080, everyNthFrame: 1 });
  // Mantém frames chegando mesmo com tela parada (um pixel que pisca)
  await page.evaluate(() => { const d = document.createElement('div'); d.style.cssText = 'position:fixed;right:0;bottom:0;width:1px;height:1px;z-index:99999';
    document.body.appendChild(d); let k = 0; (function t() { d.style.background = (k++ % 2) ? '#00251e' : '#00251f'; requestAnimationFrame(t); })(); });
  await page.waitForTimeout(400);
  const t0 = Date.now() / 1000;
  const tempos = [];
  let telaAtual = 1;
  for (const it of roteiro) {
    const d = dur(it);
    if (it.tela !== telaAtual) { await irPara(it.tela); telaAtual = it.tela;
      await page.evaluate(() => { const b = document.createElement('div'); b.style.cssText = 'position:fixed;right:0;bottom:0;width:1px;height:1px;z-index:99999';
        document.body.appendChild(b); let k = 0; (function t() { b.style.background = (k++ % 2) ? '#00251e' : '#00251f'; requestAnimationFrame(t); })(); }); }
    const ini = Date.now() / 1000 - t0;
    tempos.push({ id: it.id, ini, dur: d });
    await legenda(it[lang]);
    if (it.alvo === 'intro') { await cartela(true); await page.waitForTimeout(Math.min(3500, d * 500));
      await cartela(false); await page.waitForTimeout(d * 1000 - Math.min(3500, d * 500)); }
    else if (it.alvo === 'final') { await cartela(false); await page.waitForTimeout(d * 450); await cartela(true); await page.waitForTimeout(d * 550 + 1500); }
    else if (it.passo) {
      for (const a of it.alvo) { const r = await destacar([a], it.zoom); if (r !== 'ok') console.error(it.id, r); await page.waitForTimeout(d * 1000 / it.alvo.length); }
    } else {
      const r = await destacar(it.alvo, it.zoom); if (r !== 'ok') console.error(it.id, r);
      if (it.clique) { await page.waitForTimeout(Math.min(1500, d * 300)); await clicar(it.clique); await page.waitForTimeout(d * 1000 - Math.min(1500, d * 300)); }
      else await page.waitForTimeout(d * 1000);
    }
    // corta a espera pelo tempo real gasto nos comandos, para não acumular atraso
    const drift = (Date.now() / 1000 - t0) - (ini + d);
    if (drift < 0) await page.waitForTimeout(-drift * 1000);
  }
  await legenda('');
  await page.waitForTimeout(500);
  const tFim = Date.now() / 1000;
  await cdp.send('Page.stopScreencast');
  await browser.close();

  // Lista de concat do ffmpeg com duração real de cada frame, começando em t0
  const lines = [];
  // timestamps do screencast e Date.now estão ambos em segundos desde a época
  const start = t0, end = tFim;
  const idx = frames.map((ts, i) => ({ ts, i })).filter(f => f.ts <= end);
  let first = idx.findIndex(f => f.ts > start); if (first > 0) first--;
  const use = idx.slice(Math.max(first, 0));
  for (let k = 0; k < use.length; k++) {
    const a = Math.max(use[k].ts, start), b = k + 1 < use.length ? use[k + 1].ts : end;
    if (b - a <= 0) continue;
    lines.push(`file 'f${String(use[k].i).padStart(6, '0')}.jpg'`, `duration ${(b - a).toFixed(4)}`);
  }
  lines.push(lines[lines.length - 2]);
  fs.writeFileSync(path.join(outDir, 'lista.txt'), lines.join('\n'));
  fs.writeFileSync(path.join(__dirname, `tempos_${lang}.json`), JSON.stringify({ total: end - start, itens: tempos }, null, 1));
  console.log(lang, 'frames:', frames.length, 'total:', (end - start).toFixed(1) + 's', 'duracoes', durReal ? 'reais' : 'estimadas');
})();
