const test = require('node:test');
const assert = require('node:assert/strict');
const D = require('../lideres.js');

test('senha: mínimo de 4 caracteres; recusa só o que qualquer um adivinha', () => {
  assert.equal(D.SENHA_MINIMA, 4);
  assert.match(D.senhaFraca('abc', 'c1b'), /pelo menos 4/);
  assert.match(D.senhaFraca('', 'c1b'), /pelo menos 4/);
  assert.match(D.senhaFraca('0000', 'c1b'), /repetido/);
  assert.match(D.senhaFraca('aaaaaaaa', 'c1b'), /repetido/);
  assert.match(D.senhaFraca('1234', 'c1b'), /adivinhar/);
  assert.match(D.senhaFraca('4321', 'c1b'), /adivinhar/);
  assert.match(D.senhaFraca('senha', 'c1b'), /adivinhar/);
  assert.match(D.senhaFraca('Absenteismo2026', 'c1b'), /adivinhar/);
  assert.match(D.senhaFraca('meuc1b9', 'c1b'), /usuário/);
  assert.match(D.senhaFraca('x'.repeat(73) + '1', 'c1b'), /longa demais/);
});

test('senha: aceita de 4 caracteres para cima, simples ou longa', () => {
  assert.equal(D.senhaFraca('7391', 'c1b'), '');
  assert.equal(D.senhaFraca('Vaso', 'egfpb'), '');
  assert.equal(D.senhaFraca('ab7k', 'c1b'), '');
  assert.equal(D.senhaFraca('Tigre7-azul-lento', 'c1b'), '');
  assert.equal(D.senhaFraca('cafe com leite forte', 'c1b'), '');
  assert.equal(D.senhaFraca('Vaso9Verde!', 'exemplo@gmail.com'), '');
});

test('backup: conta os dias; sem registro devolve null', () => {
  const dia = 86400000, agora = Date.UTC(2026, 8, 30);
  assert.equal(D.diasSemBackup(agora - 3 * dia - 5000, agora), 3);
  assert.equal(D.diasSemBackup(agora, agora), 0);
  assert.equal(D.diasSemBackup(agora + dia, agora), 0);       // relógio adiantado não dá número negativo
  assert.equal(D.diasSemBackup(NaN, agora), null);
  assert.equal(D.diasSemBackup(null, agora), null);
});

test('inatividade: sai no limite exato, não antes', () => {
  const min = 60000, agora = Date.UTC(2026, 8, 30, 12);
  assert.equal(D.deveSairPorInatividade(agora - 29 * min, agora, 30), false);
  assert.equal(D.deveSairPorInatividade(agora - 30 * min, agora, 30), true);
  assert.equal(D.deveSairPorInatividade(agora - 90 * min, agora, 30), true);
});
