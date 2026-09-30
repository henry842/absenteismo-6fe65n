// Monta a pasta dist/ só com os arquivos do site (sem testes, planilhas, vídeo nem rascunhos) e gera o _headers da Cloudflare.
// Uso: node cloudflare/montar.js
const fs = require('node:fs');
const path = require('node:path');

const RAIZ = path.join(__dirname, '..');
const DIST = path.join(RAIZ, 'dist');

// Tudo o que o navegador precisa. Se o index.html ou o sw.js passarem a usar outro arquivo, testes/publicacao.test.js avisa.
const ARQUIVOS = [
  'index.html', 'estilo.css', 'app.js', 'painel.js', 'lideres.js', 'leitor.js', 'excel.js', 'sincronia.js', 'acesso.js', 'config.js',
  'sw.js', 'manifest.webmanifest', 'apple-touch-icon.png', 'icone-192.png', 'icone-512.png', 'icone-maskable-512.png',
];

// A mesma política de segurança do <meta> do index.html, agora também como cabeçalho (o cabeçalho ainda proíbe ser aberto dentro de outro site).
function politicaDoHtml(html) {
  const m = html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/);
  if (!m) throw new Error('index.html sem Content-Security-Policy');
  return m[1];
}

function cabecalhos(html) {
  return `/*
  Content-Security-Policy: ${politicaDoHtml(html)}; frame-ancestors 'none'
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Referrer-Policy: no-referrer
  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=(), bluetooth=()
  Strict-Transport-Security: max-age=31536000
  X-Robots-Tag: noindex, nofollow
`;
}

function montar() {
  fs.rmSync(DIST, { recursive: true, force: true });
  fs.mkdirSync(DIST, { recursive: true });
  for (const f of ARQUIVOS) fs.copyFileSync(path.join(RAIZ, f), path.join(DIST, f));
  fs.writeFileSync(path.join(DIST, '_headers'), cabecalhos(fs.readFileSync(path.join(RAIZ, 'index.html'), 'utf8')));
  console.log(`dist/ pronto: ${ARQUIVOS.length} arquivos + _headers`);
}

module.exports = { ARQUIVOS, cabecalhos, politicaDoHtml };
if (require.main === module) montar();
