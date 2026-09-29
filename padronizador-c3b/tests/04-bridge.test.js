// Bridge local: servidor real em 127.0.0.1, token obrigatório, origem controlada, sem path traversal,
// e o LocalBridgeAdapter gravando/diagnosticando uma instalação completa através dele.
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('fs'), path = require('path');
const { S, pastaTemp } = require('./ajuda.js');
const { criarBridge } = require('../bridge/server.js');

test('bridge: segurança e contrato do StorageAdapter', async (t) => {
  const pasta = pastaTemp('bridge');
  const b = criarBridge({ pasta, porta: 0, token: 'segredo-de-teste' });
  const porta = await b.iniciar();
  t.after(() => b.parar());
  const url = `http://127.0.0.1:${porta}`;

  await t.test('sem token → 401', async () => {
    assert.equal((await fetch(url + '/ping')).status, 401);
    assert.equal((await fetch(url + '/ping', { headers: { 'X-C3B-Token': 'errado' } })).status, 401);
  });
  await t.test('origem externa → 403', async () => {
    assert.equal((await fetch(url + '/ping', { headers: { 'X-C3B-Token': 'segredo-de-teste', Origin: 'https://site-malicioso.com' } })).status, 403);
  });
  await t.test('path traversal é recusado', async () => {
    const r = await fetch(url + '/file?path=' + encodeURIComponent('../../etc/passwd'), { headers: { 'X-C3B-Token': 'segredo-de-teste' } });
    assert.equal(r.status, 400); assert.match((await r.json()).erro, /não permitido|fora da pasta/);
  });

  const st = S.armazenamento.LocalBridgeAdapter({ url, token: 'segredo-de-teste' });
  await t.test('ping e operações básicas', async () => {
    assert.equal((await st.ping()).ok, true);
    await st.createDirectory('C3B/BACKUP');
    await st.writeFile('C3B/teste.txt', new TextEncoder().encode('olá 你好'));
    assert.equal(new TextDecoder().decode(await st.readFile('C3B/teste.txt')), 'olá 你好');
    assert.equal(await st.fileExists('C3B/teste.txt'), true);
    assert.equal(await st.fileExists('C3B/nao.txt'), false);
    await st.backupFile('C3B/teste.txt', 'C3B/BACKUP/teste.txt');
    assert.ok((await st.listFiles('C3B')).some(f => f.nome === 'teste.txt'));
    assert.equal((await st.getMetadata('C3B/teste.txt')).tamanho, Buffer.byteLength('olá 你好'));
  });
  await t.test('instalação completa gravada pelo bridge e diagnosticada', async () => {
    const r = await S.createInstallation(st, 'C3B', { empresa: 'BYD' }, {});
    assert.equal(r.ok, true, r.erro);
    assert.ok(fs.existsSync(path.join(pasta, 'C3B', '00_Manifesto_C3B.xlsx')));
    r.pacote.bases.PEOPLE = [{ employee_id: 'EMP-000001', matricula: '000001', nome: 'Ana', equipe: 'C3B', status: 'ATIVO' }];
    const g = await S.writePackage(st, 'C3B', r.pacote, { modo: 'ATUALIZAR', bases: ['PEOPLE'] });
    assert.equal(g.ok, true); assert.ok(g.resultados[0].backup, 'backup feito pelo bridge');
    const d = await S.diagnoseInstallation(st, 'C3B');
    assert.equal(d.reconhecida, true); assert.equal(d.bases.find(x => x.schema === 'PEOPLE').registros, 1);
  });
});
