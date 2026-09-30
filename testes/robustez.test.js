// Proteções da revisão de segurança/integridade: zip bomba, lixeira (nada some de vez), quem gravou,
// conflito de sincronização entre aparelhos. Nomes e matrículas inventados.
const test = require('node:test');
const assert = require('node:assert/strict');
const zlib = require('node:zlib');
const L = require('../leitor.js');
const X = require('../excel.js');
const S = require('../sincronia.js');

// .xlsx com um arquivo "comprimido" (método 8) que se expande até `tamanho` bytes
function zipComprimido(nome, tamanho) {
  const comprimido = zlib.deflateRawSync(Buffer.alloc(tamanho, 0x41));
  const z = X.zipar([{ nome, conteudo: new Uint8Array(comprimido) }]);
  const v = new DataView(z.buffer, z.byteOffset, z.byteLength);
  for (let i = z.length - 22; i >= 0; i--) {
    if (v.getUint32(i, true) === 0x02014b50) { v.setUint16(i + 10, 8, true); break; } // central: método deflate
  }
  return z;
}

test('Excel: "zip bomba" (arquivo pequeno que vira 70 MB) é recusado sem travar', async () => {
  const bomba = zipComprimido('xl/workbook.xml', 70 * 1024 * 1024);
  assert.ok(bomba.length < 200 * 1024, `a bomba tem só ${bomba.length} bytes`);
  await assert.rejects(X.deszipar(bomba), /grande demais/);
  await assert.rejects(X.lerBackupDoExcel(bomba), /grande demais/);
  // arquivo comprimido normal continua funcionando
  const ok = await X.deszipar(zipComprimido('a.txt', 1000));
  assert.equal(ok['a.txt'].length, 1000);
});

test('Excel: zip com ponteiros fora do arquivo é recusado', async () => {
  const z = X.zipar([{ nome: 'a.txt', conteudo: 'oi' }]);
  const v = new DataView(z.buffer, z.byteOffset, z.byteLength);
  for (let i = z.length - 22; i >= 0; i--) if (v.getUint32(i, true) === 0x02014b50) { v.setUint32(i + 20, 0x7fffffff, true); break; }
  await assert.rejects(X.deszipar(z), /corrompido/);
});

const msg = (time, efetivo, presentes, pessoas = []) => L.lerMensagens(
  [`Absenteísmo ${time} 29/09/2026`, `Total de pessoas: ${efetivo}`, `Presentes: ${presentes}`,
    ...pessoas.flatMap(([n, id, mot]) => [`Nome: ${n}`, `Matrícula: ${id}`, `Motivo: ${mot}`])].join('\n'), { ano: 2026 })[0];

test('quem gravou fica registrado no lançamento (e passa pela limpeza da base)', () => {
  const b = L.gravar(L.baseVazia(), msg('C1B', 10, 9, [['Ana Teste', '1000001', 'Atestado médico']]), '2026-09-29T18:00:00Z', 'supervisor@exemplo.com');
  const f = b.fechamentos['2026-09-29|C1B'];
  assert.equal(f.confirmadoPor, 'supervisor@exemplo.com');
  assert.equal(f.confirmadoEm, '2026-09-29T18:00:00Z');
  assert.equal(L.sanearBase(b).fechamentos['2026-09-29|C1B'].confirmadoPor, 'supervisor@exemplo.com');
});

test('lixeira: apagar guarda cópia; restaurar volta igual; o que estava no lugar vai para a lixeira', () => {
  let b = L.gravar(L.baseVazia(), msg('C1B', 10, 9, [['Ana Teste', '1000001', 'Atestado médico']]), '2026-09-29T18:00:00Z', 'a@exemplo.com');
  const original = b.fechamentos['2026-09-29|C1B'];
  let lx = L.paraLixeira([], original, 'apagado', 'a@exemplo.com', '2026-09-30T10:00:00Z');
  delete b.fechamentos['2026-09-29|C1B'];
  assert.equal(lx.length, 1);
  assert.equal(lx[0].motivo, 'apagado'); assert.equal(lx[0].apagadoPor, 'a@exemplo.com');
  // outro lançamento do mesmo time/dia gravado depois
  b = L.gravar(b, msg('C1B', 10, 10), '2026-09-30T11:00:00Z', 'a@exemplo.com');
  const r = L.restaurarDaLixeira(b, lx, lx[0].id, 'a@exemplo.com', '2026-09-30T12:00:00Z');
  assert.deepEqual(r.base.fechamentos['2026-09-29|C1B'], original);
  assert.equal(r.lixeira.length, 1, 'o que estava no lugar foi para a lixeira');
  assert.equal(r.lixeira[0].motivo, 'substituido');
  assert.equal(r.lixeira[0].fechamento.presentes, 10);
});

test('lixeira: expira em 30 dias, limita a 500 itens e ignora lixo', () => {
  const f = L.gravar(L.baseVazia(), msg('C2B', 5, 5), '2026-09-01T10:00:00Z').fechamentos['2026-09-29|C2B'];
  let lx = [];
  for (let i = 0; i < 520; i++) lx = L.paraLixeira(lx, f, 'apagar-tudo', '', `2026-09-30T10:${String(i % 60).padStart(2, '0')}:${String(Math.floor(i / 60)).padStart(2, '0')}Z`);
  assert.equal(lx.length, 500);
  const velho = { ...lx[0], id: 'velho', apagadoEm: '2026-08-01T00:00:00Z' };
  assert.equal(L.limparLixeira([velho], '2026-09-30T12:00:00Z').length, 0, 'mais de 30 dias sai');
  assert.deepEqual(L.limparLixeira([null, 'x', { id: 'y', apagadoEm: '2026-09-30', fechamento: { data: 'ontem' } }], '2026-09-30T12:00:00Z'), []);
  const estranho = L.limparLixeira([{ ...lx[0], motivo: 'rm -rf', fechamento: { ...f, pessoas: [{ nome: '<img src=x onerror=alert(1)>', motivo: 'Hackear' }] } }], '2026-09-30T12:00:00Z');
  assert.equal(estranho[0].motivo, 'apagado');
  assert.equal(estranho[0].fechamento.pessoas[0].motivo, 'Outros', 'motivo fora da lista vira Outros');
});

test('sincronização: mesmo lançamento mudado em dois aparelhos → fica o daqui e o de lá volta como conflito', () => {
  const base = L.gravar(L.baseVazia(), msg('C3B', 40, 39, [['Bia Teste', '1000002', 'Férias']]), '2026-09-29T18:00:00Z');
  const k = '2026-09-29|C3B';
  const espelho = S.mapaDaBase(base);                         // o que o servidor tinha na última sincronia
  const aqui = JSON.parse(JSON.stringify(base)); aqui.fechamentos[k].presentes = 38;       // mudado aqui, ainda não subiu
  const la = JSON.parse(JSON.stringify(base.fechamentos[k])); la.presentes = 37;            // mudado no outro aparelho
  const r = S.aplicarRemotos(aqui, espelho, [{ chave: k, dados: la }], { [k]: true });
  assert.equal(r.base.fechamentos[k].presentes, 38, 'vale o daqui');
  assert.equal(r.conflitos.length, 1);
  assert.equal(r.conflitos[0].dados.presentes, 37, 'o de lá não se perde');
  // se o servidor não mudou desde a última sincronia, não é conflito
  assert.equal(S.aplicarRemotos(aqui, espelho, [{ chave: k, dados: base.fechamentos[k] }], { [k]: true }).conflitos.length, 0);
  // sem pendência aqui, o de lá entra normalmente
  const r2 = S.aplicarRemotos(base, espelho, [{ chave: k, dados: la }], {});
  assert.equal(r2.base.fechamentos[k].presentes, 37); assert.equal(r2.conflitos.length, 0);
});
