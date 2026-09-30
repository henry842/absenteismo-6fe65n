const test = require('node:test');
const assert = require('node:assert/strict');
const D = require('../lideres.js');

test('senha: curta, repetida, com o usuário, óbvia ou só números são recusadas', () => {
  assert.match(D.senhaFraca('abc123', 'c1b'), /pelo menos 10/);
  assert.match(D.senhaFraca('aaaaaaaaaaaa', 'c1b'), /repetido/);
  assert.match(D.senhaFraca('minhaC1Bsenha9', 'c1b'), /usuário/);
  assert.match(D.senhaFraca('1234567890abc', 'c1b'), /adivinhar/);
  assert.match(D.senhaFraca('Absenteismo2026', 'c1b'), /adivinhar/);
  assert.match(D.senhaFraca('8473920156', 'c1b'), /Misture/);          // 10 números
  assert.match(D.senhaFraca('x'.repeat(73) + '1', 'c1b'), /longa demais/);
});

test('senha: aceita as boas, inclusive frase longa só com letras', () => {
  assert.equal(D.senhaFraca('Tigre7-azul-lento', 'c1b'), '');
  assert.equal(D.senhaFraca('cafe com leite forte', 'c1b'), '');
  assert.equal(D.senhaFraca('Vaso9Verde!', 'egfpb'), '');
  assert.equal(D.senhaFraca('Vaso9Verde!', 'exemplo@gmail.com'), '');
});

test('segundo passo: só supervisor; sem fator cadastra, com fator pede o código até chegar em aal2', () => {
  assert.equal(D.decidirSegundoPasso('lider', 0, 'aal1'), 'ok');
  assert.equal(D.decidirSegundoPasso('supervisor', 0, 'aal1'), 'cadastrar');
  assert.equal(D.decidirSegundoPasso('supervisor', 1, 'aal1'), 'codigo');
  assert.equal(D.decidirSegundoPasso('supervisor', 1, 'aal2'), 'ok');
  assert.equal(D.decidirSegundoPasso('supervisor', 2, undefined), 'codigo');
});

test('código: aceita 6 dígitos com espaço ou traço; recusa o resto', () => {
  assert.equal(D.limparCodigo(' 123 456 '), '123456');
  assert.equal(D.limparCodigo('123-456'), '123456');
  assert.ok(D.codigoValido('123 456'));
  assert.ok(!D.codigoValido('12345'));
  assert.ok(!D.codigoValido('1234567'));
  assert.ok(!D.codigoValido('abcdef'));
  assert.ok(!D.codigoValido(null));
});

test('QR: vira imagem quando é um desenho simples; recusa script e coisas estranhas', () => {
  const bom = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10"/><path d="M1 1h2v2H1z"/></svg>';
  const url = D.imagemDoQr('data:image/svg+xml;utf-8,' + bom);
  assert.match(url, /^data:image\/svg\+xml;charset=utf-8,%3Csvg/);
  assert.ok(D.imagemDoQr(bom).startsWith('data:image/svg+xml;charset=utf-8,'));
  assert.ok(D.imagemDoQr('data:image/svg+xml;utf-8,' + encodeURIComponent(bom)));     // já codificado
  assert.equal(D.imagemDoQr(bom.replace('<rect', '<script>alert(1)</script><rect')), '');
  assert.equal(D.imagemDoQr(bom.replace('<rect', '<rect onload="x()"')), '');
  assert.equal(D.imagemDoQr('<html><svg></svg>'), '');
  assert.equal(D.imagemDoQr('https://exemplo.com/qr.png'), '');
  assert.equal(D.imagemDoQr(''), '');
  assert.equal(D.imagemDoQr('<svg>' + 'a'.repeat(31000) + '</svg>'), '');
});

test('chave manual: grupos de 4; recusa o que não for base32', () => {
  assert.equal(D.formatarChave('jbswy3dpehpk3pxp'), 'JBSW Y3DP EHPK 3PXP');
  assert.equal(D.formatarChave('JBSWY3DPEH'), 'JBSW Y3DP EH');
  assert.equal(D.formatarChave('<script>'), '');
  assert.equal(D.formatarChave('ABC'), '');
  assert.equal(D.formatarChave(null), '');
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
