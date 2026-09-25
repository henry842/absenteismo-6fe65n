// Rodar: node --test testes/
// Os formatos copiam as mensagens reais do grupo; nomes e matrículas são inventados.
const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../leitor.js');

const C1B = `*Boa tarde!*
*24/09/2026*
*C1-B*

*Quantidade total = 29*
*Quantidade atestado = 3*
*Quantidade atraso roteiro = 0*
*Atraso motivo pessoal = 0*
*Sem justificativa = 0*
*Afastamento por INSS = 0*
*Turno ADM = 0*
*Total presente = 26*

*Nome: Ana Teste*
*Matrícula: 1000001*
*Motivo: Atestado médico*

*Nome: Bruno Exemplo*
*Matrícula: 1000002*
*Motivo: Atestado médico*

*Nome: Carla Modelo*
*Matrícula: 1000003*
*Motivo: Atestado médico*`;

const C5_E_C7B = `*Boa tarde*
*Absenteísmo C5-
*24/09/2026*
*2° turno*

*Previstas: 15*
*Presentes: 12*

Nome: DANIEL DOS SANTOS FICTICIO
Matricula: 1000004
Motivo: Atestado Medico

Nome: Elaine Costa Dos Inventada
Matrícula: 1000005
Motivo: atestado médico

Nome: Fabio Exemplo
Matrícula: 1000006
Motivo: atestado médico


*Absenteísmo C7B 24/09/2026*

Total de pessoas: 46
Total presente: 44
Ausentes: 2

Nome: Gabriel Teste
ID: 1000007
Motivo: Atestado médico

Nome: Helena Exemplo
ID: 1000008
Motivo: Atestado médico`;

test('C1-B: lê cabeçalho, contagens e 3 pessoas', () => {
  const [m, ...resto] = L.lerMensagens(C1B, { ano: 2026 });
  assert.equal(resto.length, 0);
  assert.equal(m.time, 'C1B');
  assert.equal(m.data, '2026-09-24');
  assert.equal(m.efetivo, 29);
  assert.equal(m.presentes, 26);
  assert.equal(m.ausentes, 3);
  assert.equal(m.contagens['Atestado médico'], 3);
  assert.equal(m.contagens['Turno ADM'], 0);
  assert.equal(m.pessoas.length, 3);
  assert.deepEqual(m.pessoas[0], {
    nome: 'Ana Teste', matricula: '1000001', motivoOriginal: 'Atestado médico',
    motivo: 'Atestado médico', motivoReconhecido: true,
  });
  assert.equal(L.conferir(m).status, 'verde');
});

test('C5 e C7B colados juntos viram duas mensagens', () => {
  const ms = L.lerMensagens(C5_E_C7B, { ano: 2026 });
  assert.equal(ms.length, 2);
  const [c5, c7] = ms;

  assert.equal(c5.time, 'C5');
  assert.equal(c5.timeIncompleto, true);
  assert.equal(c5.turno, '2º turno');
  assert.equal(c5.data, '2026-09-24');
  assert.equal(c5.efetivo, 15);
  assert.equal(c5.presentes, 12);
  assert.equal(c5.ausentes, 3);
  assert.equal(c5.pessoas.length, 3);
  assert.equal(c5.pessoas[0].nome, 'Daniel dos Santos Ficticio');
  assert.ok(c5.pessoas.every(p => p.motivo === 'Atestado médico'));
  const conf5 = L.conferir(c5);
  assert.equal(conf5.status, 'amarelo');
  assert.match(conf5.problemas[0].texto, /incompleto/);

  assert.equal(c7.time, 'C7B');
  assert.equal(c7.data, '2026-09-24');
  assert.equal(c7.efetivo, 46);
  assert.equal(c7.presentes, 44);
  assert.equal(c7.ausentes, 2);
  assert.deepEqual(c7.pessoas.map(p => p.matricula), ['1000007', '1000008']);
  assert.equal(L.conferir(c7).status, 'verde');
});

test('fechamento do dia com os 3 times: 90 / 82 / 8 = 8,9%', () => {
  let base = L.baseVazia();
  for (const m of L.lerMensagens(C1B + '\n\n' + C5_E_C7B, { ano: 2026 })) base = L.gravar(base, m);
  const r = L.resumoDoDia(base, '2026-09-24');
  assert.deepEqual(r.recebidos, ['C1B', 'C5', 'C7B']);
  assert.equal(r.efetivo, 90);
  assert.equal(r.presentes, 82);
  assert.equal(r.ausentes, 8);
  assert.equal(L.pct(r.faltasQueContam, r.efetivo), '8,9%');
  assert.equal(r.porMotivo['Atestado médico'], 8);
  const txt = L.textoWhatsApp(r);
  assert.match(txt, /\*Absenteísmo:\* 8,9%/);
  assert.match(txt, /C7B: 2 de 46/);
  assert.doesNotMatch(txt, /Ana Teste/);
  assert.match(L.textoWhatsApp(r, { comNomes: true }), /Ana Teste \(1000001\)/);
});

test('conta que não fecha fica vermelha', () => {
  const [m] = L.lerMensagens(C1B.replace('Total presente = 26', 'Total presente = 25'), { ano: 2026 });
  const c = L.conferir(m);
  assert.equal(c.status, 'vermelho');
  assert.ok(c.problemas.some(p => /lista 3 nome/.test(p.texto)));
});

test('contagem do cabeçalho diferente da lista fica vermelha', () => {
  const [m] = L.lerMensagens(C1B.replace('Quantidade atestado = 3', 'Quantidade atestado = 2'), { ano: 2026 });
  const c = L.conferir(m);
  assert.equal(c.status, 'vermelho');
  assert.ok(c.problemas.some(p => /Atestado médico: 2/.test(p.texto)));
});

test('sem data fica amarelo', () => {
  const [m] = L.lerMensagens(C1B.replace('*24/09/2026*\n', ''), { ano: 2026 });
  assert.equal(m.data, null);
  const c = L.conferir(m);
  assert.equal(c.status, 'amarelo');
  assert.ok(c.problemas.some(p => /não tem data/.test(p.texto)));
});

test('colar o mesmo time/dia de novo avisa e não duplica', () => {
  const [m] = L.lerMensagens(C1B, { ano: 2026 });
  let base = L.gravar(L.baseVazia(), m);
  const c = L.conferir(m, base);
  assert.equal(c.status, 'amarelo');
  assert.ok(c.problemas.some(p => /já foi lançado/.test(p.texto)));
  base = L.gravar(base, m);
  assert.equal(Object.keys(base.fechamentos).length, 1);
  assert.equal(L.resumoDoDia(base, '2026-09-24').ausentes, 3);
});

test('mesma matrícula ausente em dois times no mesmo dia fica vermelho', () => {
  const [m] = L.lerMensagens(C1B, { ano: 2026 });
  const base = L.gravar(L.baseVazia(), m);
  const [outro] = L.lerMensagens(C1B.replace('C1-B', 'C2A'), { ano: 2026 });
  const c = L.conferir(outro, base);
  assert.equal(c.status, 'vermelho');
  assert.ok(c.problemas.some(p => /já está como ausente no C1B/.test(p.texto)));
});

test('prefixo de cópia do WhatsApp é ignorado', () => {
  const colado = C5_E_C7B.split('\n').slice(19).map((l, i) => i === 0 ? '[24/09/2026 14:02] Líder Sete: ' + l : l).join('\n');
  const [m] = L.lerMensagens(colado, { ano: 2026 });
  assert.equal(m.time, 'C7B');
  assert.equal(m.pessoas.length, 2);
});

test('motivos com escrita variada', () => {
  const casos = {
    'Atestado Medico': 'Atestado médico',
    'atest.': 'Atestado médico',
    'Atraso do ônibus / roteiro': 'Atraso roteiro',
    'atraso': 'Atraso motivo pessoal',
    'Falta injustificada': 'Sem justificativa',
    'Afastado INSS': 'Afastamento INSS',
    'turno adm': 'Turno ADM',
  };
  for (const [bruto, esperado] of Object.entries(casos)) assert.equal(L.normalizarMotivo(bruto).motivo, esperado, bruto);
  const r = L.normalizarMotivo('viagem');
  assert.equal(r.motivo, 'Outros');
  assert.equal(r.reconhecido, false);
  assert.equal(L.normalizarMotivo('viagem', { viagem: 'Sem justificativa' }).motivo, 'Sem justificativa');
});

test('CSV de ausências abre no Excel com ; e acentos', () => {
  const [m] = L.lerMensagens(C1B, { ano: 2026 });
  const csv = L.csvAusencias(L.gravar(L.baseVazia(), m));
  assert.ok(csv.startsWith('﻿Data;Time;'));
  assert.match(csv, /24\/09\/2026;C1B;;1000001;Ana Teste;Atestado médico/);
});

test('CSV não deixa "nome" virar fórmula no Excel', () => {
  const txt = '*Absenteísmo C1B 24/09/2026*\nTotal de pessoas: 3\nTotal presente: 1\nNome: =HYPERLINK("http://mal.invalid")\nID: 1\nMotivo: +cmd|calc\nNome: @SUM(A1)\nID: 2\nMotivo: -1+1';
  let b = L.baseVazia();
  for (const m of L.lerMensagens(txt, { ano: 2026 })) b = L.gravar(b, m);
  const linhas = L.csvAusencias(b).split('\r\n').slice(1);
  for (const l of linhas) for (const cel of l.split(';')) assert.doesNotMatch(cel.replace(/^"/, ''), /^[=+\-@]/, cel);
  assert.match(linhas[0], /"'=hyperlink/i);
});
