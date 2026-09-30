// Excel com os dados dos líderes, leitor de planilhas e proteção contra arquivos malformados.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const L = require('../leitor.js');
const D = require('../lideres.js');
const X = require('../excel.js');

const lancs = [
  { data: '2026-09-30', time: 'C3B', tipo: 'atraso', matricula: '9000300', nome: 'Carlos', motivo: 'Atraso sem justificativa', justificativa: '', hora_prevista: '14:00:00', hora_chegada: null },
  { data: '2026-09-30', time: 'C3B', tipo: 'ausencia', matricula: '9000301', nome: 'Diana', motivo: 'Atestado médico', justificativa: '2 dias' },
  { data: '2026-09-30', time: 'C3B', tipo: 'saida', matricula: '9000302', nome: 'Eva', motivo: 'Saúde', justificativa: '', hora_saida: '16:30:00' },
];
const envios = [{ data: '2026-09-30', time: 'C3B', efetivo: 41, enviado_em: '2026-09-30T17:40:00Z' }];

test('a exportação leva os lançamentos dos líderes em abas próprias e os relatórios incluem os líderes', () => {
  const base = L.baseVazia();
  const completa = D.mesclarBase(base, lancs, envios, ['C3B']);
  const abas = X.abasDaBase(base, { baseCompleta: completa, lancamentos: lancs, envios });
  assert.deepEqual(abas.map(a => a.nome), ['Resumo por dia', 'Por time', 'Ausências', 'Reincidência 30 dias', 'Lançamentos dos líderes', 'Envios dos times', '_backup']);
  const resumo = abas[0].linhas[0];
  assert.deepEqual([resumo[0], resumo[3], resumo[5]], ['2026-09-30', 41, 2]);       // efetivo e ausentes vêm do envio do líder
  const det = abas[4].linhas;
  assert.equal(det.length, 3);
  assert.ok(det.some(l => l[5] === 'Carlos' && l[12] === 'Aguardando chegada'));
  assert.ok(det.some(l => l[5] === 'Eva' && l[3] === 'Saída antecipada' && l[11] === '16:30'));
});

test('o backup do Excel guarda só a base do supervisor (nunca mistura os dados dos líderes)', async () => {
  const base = L.baseVazia();
  for (const m of L.lerMensagens('*Absenteísmo C1B 24/09/2026*\nTotal de pessoas: 10\nTotal presente: 9\nNome: Ana Teste\nID: 1000001\nMotivo: Atestado', { ano: 2026 })) Object.assign(base, L.gravar(base, m));
  const completa = D.mesclarBase(base, lancs, envios, ['C3B']);
  const bytes = X.gerarExcel(base, new Date(2026, 8, 30), { baseCompleta: completa, lancamentos: lancs, envios });
  const volta = await X.lerBackupDoExcel(bytes);
  assert.deepEqual(Object.keys(volta.fechamentos), ['2026-09-24|C1B']);
});

test('lerPlanilhas devolve as abas visíveis como texto e ignora o backup escondido', async () => {
  const base = L.baseVazia();
  const bytes = X.gerarExcel(base, new Date(2026, 8, 30), { baseCompleta: D.mesclarBase(base, lancs, envios, []), lancamentos: lancs, envios });
  const abas = await X.lerPlanilhas(bytes);
  assert.ok(abas.map(a => a.nome).includes('Lançamentos dos líderes'));
  assert.ok(!abas.some(a => a.nome === '_backup'));
  const det = abas.find(a => a.nome === 'Lançamentos dos líderes');
  assert.equal(det.linhas[0][0], 'Data');
  assert.ok(det.linhas.some(l => l.includes('Carlos') && l.includes('Aguardando chegada')));
});

test('lerPlanilhas: números viram texto sem ".0" e células vazias não quebram', async () => {
  const bytes = X.gerarXlsx([{ nome: 'c1b', colunas: [{ titulo: 'Name', tipo: 't' }, { titulo: 'Id', tipo: 'n' }, { titulo: 'Team', tipo: 't' }], linhas: [['Ana Souza', 9017253, 'C1B'], ['Bia Lima', null, 'C1B']] }]);
  const [aba] = await X.lerPlanilhas(bytes);
  assert.deepEqual(aba.linhas, [['Name', 'Id', 'Team'], ['Ana Souza', '9017253', 'C1B'], ['Bia Lima', '', 'C1B']]);
});

test('arquivo que não é Excel, corrompido ou com entradas demais é recusado com mensagem clara', async () => {
  await assert.rejects(() => X.lerPlanilhas(new TextEncoder().encode('isto não é um zip')), /Não é um arquivo Excel/);
  const bom = X.gerarXlsx([{ nome: 'a', colunas: [{ titulo: 'x', tipo: 't' }], linhas: [] }]);
  const quebrado = bom.slice(0, bom.length - 40);          // corta o final do zip
  await assert.rejects(() => X.lerPlanilhas(quebrado));
  // zip que declara entradas demais
  const muitos = X.zipar(Array.from({ length: 501 }, (_, i) => ({ nome: 'f' + i + '.xml', conteudo: 'x' })));
  await assert.rejects(() => X.lerPlanilhas(muitos), /arquivos demais/);
});

test('bomba de compressão: um arquivo minúsculo que incha demais é interrompido', async () => {
  // 40 MB de zeros comprimidos com deflate cabem em ~40 KB; o limite por arquivo é 30 MB
  const zeros = new Uint8Array(40 * 1024 * 1024);
  const comprimido = new Uint8Array(await new Response(new Blob([zeros]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer());
  assert.ok(comprimido.length < 200 * 1024);
  const nome = new TextEncoder().encode('xl/workbook.xml');
  const loc = new DataView(new ArrayBuffer(30));
  loc.setUint32(0, 0x04034b50, true); loc.setUint16(8, 8, true); loc.setUint32(18, comprimido.length, true); loc.setUint32(22, zeros.length, true); loc.setUint16(26, nome.length, true);
  const cen = new DataView(new ArrayBuffer(46));
  cen.setUint32(0, 0x02014b50, true); cen.setUint16(10, 8, true); cen.setUint32(20, comprimido.length, true); cen.setUint32(24, zeros.length, true); cen.setUint16(28, nome.length, true);
  const partes = [new Uint8Array(loc.buffer), nome, comprimido];
  const posCentral = partes.reduce((s, p) => s + p.length, 0);
  const fim = new DataView(new ArrayBuffer(22));
  fim.setUint32(0, 0x06054b50, true); fim.setUint16(8, 1, true); fim.setUint16(10, 1, true); fim.setUint32(12, 46 + nome.length, true); fim.setUint32(16, posCentral, true);
  const todos = partes.concat([new Uint8Array(cen.buffer), nome, new Uint8Array(fim.buffer)]);
  const zip = new Uint8Array(todos.reduce((s, p) => s + p.length, 0));
  let o = 0; for (const p of todos) { zip.set(p, o); o += p.length; }
  await assert.rejects(() => X.lerPlanilhas(zip), /grande demais/);
});

// Opcional: com a planilha real do RH (fora do repositório): C3B_PLANILHA_REAL=caminho node --test testes/excel-lideres.test.js
test('planilha real do RH (só roda se C3B_PLANILHA_REAL apontar para o arquivo)', { skip: !process.env.C3B_PLANILHA_REAL }, async () => {
  const abas = await X.lerPlanilhas(new Uint8Array(fs.readFileSync(process.env.C3B_PLANILHA_REAL)));
  const r = D.interpretarPlanilha(abas, []);
  const porTime = {}; r.registros.forEach(x => { porTime[x.time] = (porTime[x.time] || 0) + 1; });
  console.log('planilha real:', r.registros.length, 'pessoas;', JSON.stringify(porTime), '| avisos:', r.avisos.join(' / '));
  assert.ok(r.registros.length > 200);
  assert.ok(!JSON.stringify(r.registros).match(/\d{3}\.\d{3}\.\d{3}-\d{2}/));      // nenhum CPF
});
