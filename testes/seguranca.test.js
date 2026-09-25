// Ataques contra os dados: backup "envenenado", nomes reservados do JavaScript, formato errado.
const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../leitor.js');

const XSS = '<img src=x onerror=alert(1)>';

test('backup envenenado: data, números e textos são limpos', () => {
  const b = L.sanearBase({
    fechamentos: {
      'x': { data: '2026-09-24', time: 'C1B', efetivo: '29', presentes: 26, pessoas: [{ matricula: '12a34', nome: 'Ana', motivo: 'Atestado médico' }] },
      'y': { data: XSS, time: 'C2B', efetivo: 10, presentes: 9, pessoas: [] },                 // data inválida: some
      'z': { data: '2026-09-24', time: 'C3B', efetivo: XSS, presentes: { a: 1 }, pessoas: 'nao-lista' },
      'w': { data: '2026-09-24', time: 'C4B', efetivo: 10, presentes: 99, pessoas: [{ nome: { toString: 1 }, motivo: XSS }, 'lixo'] },
    },
    config: { times: ['C1B', 5, null, { a: 1 }], naoContam: ['Férias', XSS], meta: XSS, area: 'SUB' },
    cadastro: { '123': { nome: 'Ana', time: 'C1B', visto: XSS }, '__proto__': { nome: 'x' }, 'abc': { nome: 'y' } },
  });
  assert.deepEqual(Object.keys(b.fechamentos).sort(), ['2026-09-24|C1B', '2026-09-24|C3B', '2026-09-24|C4B']);
  const c1 = b.fechamentos['2026-09-24|C1B'];
  assert.deepEqual([c1.efetivo, c1.presentes, c1.ausentes], [29, 26, 3]);
  assert.equal(c1.pessoas[0].matricula, '1234');
  const c3 = b.fechamentos['2026-09-24|C3B'];
  assert.deepEqual([c3.efetivo, c3.presentes, c3.pessoas.length], [0, 0, 0]);
  const c4 = b.fechamentos['2026-09-24|C4B'];
  assert.equal(c4.presentes, 10); // não pode ter mais presentes que o total
  assert.equal(c4.pessoas.length, 1);
  assert.deepEqual([c4.pessoas[0].nome, c4.pessoas[0].motivo], ['', 'Outros']);
  assert.deepEqual(b.config.times, ['C1B', '5']);
  assert.deepEqual(b.config.naoContam, ['Férias']);
  assert.equal(b.config.meta, null);
  assert.deepEqual(Object.keys(b.cadastro), ['123']);
  assert.equal(b.cadastro['123'].visto, null);
  // nada do ataque sobrou em nenhum campo que vira número/data
  assert.doesNotMatch(JSON.stringify(Object.values(b.fechamentos).map(f => [f.data, f.efetivo, f.presentes, f.ausentes])), /</);
});

test('base comum passa pela limpeza sem perder nada', () => {
  let b = L.baseVazia();
  const txt = '*Absenteísmo C1B 24/09/2026*\n*Turno:* 2\nTotal de pessoas: 29\nTotal presente: 27\nNome: Ana Teste\nID: 1000001\nMotivo: Atestado\nNome: Bia Teste\nID: 1000002\nMotivo: Férias';
  for (const m of L.lerMensagens(txt, { ano: 2026 })) b = L.gravar(b, m, '2026-09-24T10:00:00Z');
  b.config = Object.assign(b.config, { times: ['C1B'], meta: 0.05, area: 'SUB MONTAGEM TURNO B', apelidos: { viagem: 'Sem justificativa' } });
  assert.deepEqual(L.sanearBase(JSON.parse(JSON.stringify(b))), b);
});

test('nomes reservados do JavaScript não quebram nada', () => {
  // motivo "constructor" / "__proto__" escrito pelo líder
  for (const palavra of ['constructor', '__proto__', 'toString', 'hasOwnProperty']) {
    assert.deepEqual(L.normalizarMotivo(palavra, {}), { motivo: 'Outros', reconhecido: false }, palavra);
  }
  const b = L.sanearBase({ config: { apelidos: JSON.parse('{"__proto__": "Sem justificativa", "constructor": "Sem justificativa", "viagem": "Sem justificativa", "x": "<img>"}') } });
  assert.deepEqual(Object.keys(b.config.apelidos), ['viagem']);
  assert.equal(({}).polluted, undefined);
  // pessoa chamada "Constructor" em várias faltas: alerta de reincidência continua funcionando
  let base = L.baseVazia();
  for (const d of ['2026-09-20', '2026-09-21', '2026-09-22']) {
    const [a, m, dd] = d.split('-');
    for (const msg of L.lerMensagens(`*Absenteísmo C1B ${dd}/${m}/${a}*\nTotal de pessoas: 5\nTotal presente: 4\nNome: Constructor\nMotivo: Atestado`, { ano: 2026 })) base = L.gravar(base, msg);
  }
  const alertas = L.alertasReincidencia(base, '2026-09-22', 30, 3);
  assert.equal(alertas.length, 1);
  assert.equal(alertas[0].total, 3);
});
