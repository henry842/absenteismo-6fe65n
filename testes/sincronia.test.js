// Regras da sincronização entre aparelhos (sem internet: só as funções puras).
const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../leitor.js');
const S = require('../sincronia.js');

function baseCom(...times) {
  let b = L.baseVazia();
  for (const t of times) {
    const txt = `*Absenteísmo ${t} 24/09/2026*\nTotal de pessoas: 10\nTotal presente: 9\nNome: Ana Teste\nID: 1000001\nMotivo: Atestado`;
    for (const m of L.lerMensagens(txt, { ano: 2026 })) b = L.gravar(b, m, '2026-09-24T10:00:00Z');
  }
  return b;
}

test('base nova: tudo é enviado (lançamentos, config e cadastro)', () => {
  const b = baseCom('C1B', 'C7B');
  assert.deepEqual(S.chavesMudadas({}, b).sort(), ['2026-09-24|C1B', '2026-09-24|C7B', 'cadastro', 'config']);
});

test('depois de enviado, nada muda até alterar algo', () => {
  const b = baseCom('C1B');
  const espelho = S.mapaDaBase(b);
  assert.deepEqual(S.chavesMudadas(espelho, b), []);
  b.config.meta = 0.05;
  assert.deepEqual(S.chavesMudadas(espelho, b), ['config']);
});

test('lançamento apagado vai como "dados: null"', () => {
  const b = baseCom('C1B', 'C7B');
  const espelho = S.mapaDaBase(b);
  delete b.fechamentos['2026-09-24|C7B'];
  const ch = S.chavesMudadas(espelho, b);
  assert.deepEqual(ch, ['2026-09-24|C7B']);
  assert.deepEqual(S.linhasParaEnviar(b, ch), [{ chave: '2026-09-24|C7B', dados: null }]);
  // Já apagado no servidor: não reenvia
  espelho['2026-09-24|C7B'] = null;
  assert.deepEqual(S.chavesMudadas(espelho, b), []);
});

test('o que vem do outro aparelho entra na base', () => {
  const celular = baseCom('C1B', 'C7B');
  const pc = L.baseVazia();
  const linhas = S.linhasParaEnviar(celular, Object.keys(S.mapaDaBase(celular)));
  const r = S.aplicarRemotos(pc, {}, linhas, {});
  assert.equal(r.mudou, true);
  assert.deepEqual(Object.keys(r.base.fechamentos).sort(), ['2026-09-24|C1B', '2026-09-24|C7B']);
  assert.equal(r.base.cadastro['1000001'].nome, 'Ana Teste');
  // Espelho igual ao que o servidor tem → nada para reenviar
  assert.deepEqual(S.chavesMudadas(r.espelho, r.base), []);
});

test('apagado no outro aparelho some aqui também', () => {
  const b = baseCom('C1B', 'C7B');
  const r = S.aplicarRemotos(b, S.mapaDaBase(b), [{ chave: '2026-09-24|C7B', dados: null }], {});
  assert.equal(r.mudou, true);
  assert.deepEqual(Object.keys(r.base.fechamentos), ['2026-09-24|C1B']);
});

test('mudança local ainda não enviada não é sobrescrita pelo servidor', () => {
  const b = baseCom('C1B');
  b.fechamentos['2026-09-24|C1B'].efetivo = 12; // corrigido aqui, sem internet
  const doServidor = [{ chave: '2026-09-24|C1B', dados: Object.assign({}, b.fechamentos['2026-09-24|C1B'], { efetivo: 10 }) }];
  const r = S.aplicarRemotos(b, {}, doServidor, { '2026-09-24|C1B': true });
  assert.equal(r.mudou, false);
  assert.equal(r.base.fechamentos['2026-09-24|C1B'].efetivo, 12);
});

test('config do servidor mantém campos novos que o aparelho ainda não conhecia', () => {
  const b = L.baseVazia();
  const r = S.aplicarRemotos(b, {}, [{ chave: 'config', dados: { times: ['C1B'], area: 'SUB MONTAGEM TURNO B' } }], {});
  assert.deepEqual(r.base.config.times, ['C1B']);
  assert.equal(r.base.config.area, 'SUB MONTAGEM TURNO B');
  assert.deepEqual(r.base.config.naoContam, ['Férias']);
});
