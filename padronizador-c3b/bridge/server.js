// Bridge local C3B (teste real do LocalBridgeAdapter): expõe UMA pasta do computador para a página do
// Padronizador, só em 127.0.0.1 e só com o token. Uso:
//   node bridge/server.js <pasta> [porta]        (token em C3B_BRIDGE_TOKEN ou gerado e mostrado na tela)
// Rotas: GET /ping, GET /files?dir=, GET /file?path=, PUT /file?path=, POST /dir?path=, GET /exists?path=,
//        GET /meta?path=, POST /backup?path=&dest=
const http = require('http'), crypto = require('crypto'), path = require('path'), fs = require('fs');
const { NodeFsAdapter } = require('../src/storage/adaptadores.js');

function criarBridge({ pasta, porta = 47833, token = crypto.randomBytes(18).toString('hex') }) {
  if (!pasta) throw new Error('Informe a pasta: node bridge/server.js <pasta>');
  fs.mkdirSync(pasta, { recursive: true });
  const disco = NodeFsAdapter(pasta);
  const origemPermitida = o => !o || o === 'null' || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(o);
  const server = http.createServer(async (req, res) => {
    const origem = req.headers.origin;
    if (origemPermitida(origem)) {
      res.setHeader('Access-Control-Allow-Origin', origem || '*');
      res.setHeader('Access-Control-Allow-Headers', 'X-C3B-Token, Content-Type');
      res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, POST, OPTIONS');
    }
    if (req.method === 'OPTIONS') { res.writeHead(origemPermitida(origem) ? 204 : 403); return res.end(); }
    const json = (st, o) => { res.writeHead(st, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(o)); };
    if (!origemPermitida(origem)) return json(403, { erro: 'Origem não permitida' });
    if (req.headers['x-c3b-token'] !== token) return json(401, { erro: 'Token inválido' });
    const u = new URL(req.url, 'http://127.0.0.1');
    const q = k => u.searchParams.get(k) || '';
    try {
      if (req.method === 'GET' && u.pathname === '/ping') return json(200, { ok: true, pasta: disco.raiz, versao: 1 });
      if (req.method === 'GET' && u.pathname === '/files') return json(200, await disco.listFiles(q('dir')));
      if (req.method === 'GET' && u.pathname === '/file') { const b = await disco.readFile(q('path')); res.writeHead(200, { 'Content-Type': 'application/octet-stream' }); return res.end(Buffer.from(b)); }
      if (req.method === 'GET' && u.pathname === '/exists') return json(200, { existe: await disco.fileExists(q('path')) });
      if (req.method === 'GET' && u.pathname === '/meta') return json(200, await disco.getMetadata(q('path')));
      if (req.method === 'POST' && u.pathname === '/dir') { await disco.createDirectory(q('path')); return json(200, { ok: true }); }
      if (req.method === 'POST' && u.pathname === '/backup') return json(200, await disco.backupFile(q('path'), q('dest')));
      if (req.method === 'PUT' && u.pathname === '/file') {
        const partes = []; let tam = 0;
        for await (const p of req) { tam += p.length; if (tam > 60 * 1024 * 1024) return json(413, { erro: 'Arquivo maior que 60 MB' }); partes.push(p); }
        return json(200, await disco.writeFile(q('path'), new Uint8Array(Buffer.concat(partes))));
      }
      return json(404, { erro: 'Rota desconhecida' });
    } catch (e) { return json(400, { erro: e.message }); }
  });
  return { server, token, iniciar: () => new Promise(r => server.listen(porta, '127.0.0.1', () => r(server.address().port))), parar: () => new Promise(r => server.close(r)) };
}

if (require.main === module) {
  const [pasta, porta] = process.argv.slice(2);
  const b = criarBridge({ pasta: pasta && path.resolve(pasta), porta: porta ? +porta : 47833, token: process.env.C3B_BRIDGE_TOKEN || undefined });
  b.iniciar().then(p => console.log(`Bridge C3B em http://127.0.0.1:${p}\nPasta: ${path.resolve(pasta)}\nToken: ${b.token}\n(cole a URL e o token em Configurações > Armazenamento)`));
}
module.exports = { criarBridge };
