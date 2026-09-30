// Garante que a pasta publicada na Cloudflare tem tudo o que o site usa e nada que não deveria ir.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { ARQUIVOS, cabecalhos, politicaDoHtml } = require('../cloudflare/montar.js');

const RAIZ = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(RAIZ, 'index.html'), 'utf8');
const sw = fs.readFileSync(path.join(RAIZ, 'sw.js'), 'utf8');
const local = u => u && !/^(https?:|data:|#|mailto:|tel:)/.test(u) ? u.replace(/^\.\//, '').split(/[?#]/)[0] : null;

test('todo arquivo que o index.html usa vai para a publicação e existe', () => {
  const usados = [...html.matchAll(/\b(?:src|href)="([^"]+)"/g)].map(m => local(m[1])).filter(Boolean);
  assert.ok(usados.length >= 8);
  for (const u of usados) {
    assert.ok(ARQUIVOS.includes(u), `${u} está no index.html mas não na lista de publicação`);
    assert.ok(fs.existsSync(path.join(RAIZ, u)), `${u} não existe`);
  }
});

test('todo arquivo guardado pelo service worker (uso offline) vai para a publicação', () => {
  const lista = sw.match(/const ARQUIVOS = \[([\s\S]*?)\];/)[1];
  const guardados = [...lista.matchAll(/'([^']+)'/g)].map(m => local(m[1])).filter(u => u && u !== '');
  for (const u of guardados) if (u !== './' && u !== '') assert.ok(ARQUIVOS.includes(u), `${u} está no sw.js mas não na publicação`);
});

test('a publicação nunca leva planilha, CSV, JSON de dados, testes nem pastas de trabalho', () => {
  for (const f of ARQUIVOS) {
    assert.doesNotMatch(f, /\.(xlsx?|csv)$/i, f);
    assert.doesNotMatch(f, /(^|\/)(testes|docs|video|padronizador|\.git|\.claude)/i, f);
    if (/\.json$/i.test(f)) assert.fail('JSON na publicação: ' + f);
    assert.ok(!f.includes('..'), f);
  }
});

test('os cabeçalhos repetem a política do HTML e proíbem ser aberto dentro de outro site', () => {
  const h = cabecalhos(html);
  assert.ok(h.includes(politicaDoHtml(html)));
  assert.match(h, /frame-ancestors 'none'/);
  assert.match(h, /X-Content-Type-Options: nosniff/);
  assert.match(h, /X-Frame-Options: DENY/);
  assert.match(h, /Referrer-Policy: no-referrer/);
  assert.match(h, /Strict-Transport-Security: max-age=\d+/);
  assert.doesNotMatch(h, /unsafe-eval|script-src[^;]*unsafe-inline/);
});

test('o manifesto envia o cookie de acesso (necessário atrás do Cloudflare Access)', () => {
  assert.match(html, /<link rel="manifest" href="manifest\.webmanifest" crossorigin="use-credentials">/);
});

test('a versão mostrada na tela é a mesma do cache offline (mudou o sistema, mude os dois)', () => {
  const cfg = fs.readFileSync(path.join(RAIZ, 'config.js'), 'utf8');
  const naTela = (cfg.match(/versao: 'v(\d+)/) || [])[1];
  const nocache = (sw.match(/absenteismo-v(\d+)/) || [])[1];
  assert.ok(naTela && nocache, 'versão não encontrada');
  assert.equal(naTela, nocache);
});
