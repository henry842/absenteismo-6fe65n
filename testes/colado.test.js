// O texto que o supervisor cola: várias mensagens copiadas do grupo de uma vez,
// cada uma com o prefixo "[data, hora] ~Nome:". Nomes e matrículas inventados.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const L = require('../leitor.js');

const COLADO = fs.readFileSync(path.join(__dirname, 'colado-do-grupo.txt'), 'utf8');

test('texto colado do grupo vira 4 mensagens, uma por time', () => {
  const ms = L.lerMensagens(COLADO, { ano: 2026 });
  assert.deepEqual(ms.map(m => m.time), ['SUB MONTAGEM TURNO B', 'C5', 'C7B', 'C1B']);
  assert.ok(ms.every(m => m.data === '2026-09-24'));
  assert.deepEqual(ms.map(m => L.conferir(m).status), ['amarelo', 'amarelo', 'verde', 'verde']);
});

test('SUB MONTAGEM: lista com "- ", "90 colaboradores", nome sem "Nome:" e "ID" sem dois pontos', () => {
  const [m] = L.lerMensagens(COLADO, { ano: 2026 });
  assert.equal(m.turno, 'Turno B');
  assert.deepEqual([m.efetivo, m.presentes], [90, 86]);
  assert.equal(m.ausentes, 0); // a linha "Faltas: 0" (total de quem faltou) veio errada
  assert.equal(m.contagens['Atestado médico'], 2);
  assert.equal(m.contagens['Sem justificativa'], 2); // "Faltas sem justificativa: 2"
  assert.equal(m.contagens['Férias'], 0);
  assert.equal(m.contagens['Atraso sem justificativa'], 0);
  assert.deepEqual(m.pessoas.map(p => [p.nome, p.matricula, p.motivo]), [
    ['Joao Exemplo da Silva', '1000011', 'Sem justificativa'],
    ['Maria Teste dos Santos', '1000012', 'Atestado médico'],
    ['Otavio Conceição', '1000013', 'Atestado médico'],
    ['Gabriel Modelo', '1000014', 'Sem justificativa'],
  ]);
});

test('mensagem sem data usa a data do WhatsApp e avisa', () => {
  const t = '[23/09/2026, 17:02:10] ~Lider: *Absenteísmo C7B*\nTotal de pessoas: 46\nTotal presente: 46';
  const [m] = L.lerMensagens(t, { ano: 2026 });
  assert.equal(m.data, '2026-09-23');
  const c = L.conferir(m);
  assert.equal(c.status, 'verde');
  assert.match(c.problemas[0].texto, /usei a data do WhatsApp \(23\/09\/2026\)/);
});

test('cópia pelo celular (formato "24/09/2026 16:58 - Nome:") também separa as mensagens', () => {
  const t = COLADO.replace(/ ?\[(\d\d\/\d\d\/\d{4}), (\d\d:\d\d):\d\d\] ~Lider Um: /g, '$1 $2 - Lider Um: ');
  const ms = L.lerMensagens(t, { ano: 2026 });
  assert.deepEqual(ms.map(m => m.time), ['SUB MONTAGEM TURNO B', 'C5', 'C7B', 'C1B']);
});

test('nome do time digitado é padronizado', () => {
  assert.equal(L.normalizarTime('c1-b'), 'C1B');
  assert.equal(L.normalizarTime(' C 5 - A '), 'C5A');
  assert.equal(L.normalizarTime('Sub  montagem turno b'), 'SUB MONTAGEM TURNO B');
  assert.equal(L.normalizarTime('Pré-montagem'), 'PRE-MONTAGEM');
});

test('Férias não conta no % por padrão', () => {
  const t = '*Absenteísmo C7B 24/09/2026*\nTotal de pessoas: 40\nTotal presente: 38\nNome: Ana Teste\nID: 1000001\nMotivo: Férias\nNome: Bia Teste\nID: 1000002\nMotivo: Atestado';
  let b = L.baseVazia();
  for (const m of L.lerMensagens(t, { ano: 2026 })) b = L.gravar(b, m);
  const r = L.resumoDoDia(b, '2026-09-24');
  assert.equal(r.ausentes, 2);
  assert.equal(L.pct(r.faltasQueContam, r.efetivo), '2,5%');
});

test('"Faltas" é o total de quem faltou: se só ela está errada, fica amarelo pedindo revisão', () => {
  const [m] = L.lerMensagens(COLADO, { ano: 2026 });
  const c = L.conferir(m);
  assert.equal(c.status, 'amarelo');
  assert.deepEqual(c.problemas.map(p => p.texto), ['A linha "Faltas" diz 0, mas faltaram 4 (90 − 86) e a lista tem 4 nome(s). Confira com o líder.']);
  // Ao gravar, vale a conta (90 − 86 = 4)
  const r = L.resumoDoDia(L.gravar(L.baseVazia(), m), '2026-09-24');
  assert.equal(r.ausentes, 4);
});

test('"Faltas" certa fica verde; se nem a lista bate, fica vermelho', () => {
  const certo = COLADO.replace('- Faltas: 0', '- Faltas: 4');
  assert.equal(L.conferir(L.lerMensagens(certo, { ano: 2026 })[0]).status, 'verde');
  const [m] = L.lerMensagens(certo.replace('Total presente: 86', 'Total presente: 85'), { ano: 2026 });
  const c = L.conferir(m);
  assert.equal(c.status, 'vermelho');
  assert.ok(c.problemas.some(p => /A conta não fecha: 90 − 85 = 5, mas a linha "Faltas" diz 4/.test(p.texto)));
});

test('linha com número que o sistema não entendeu pede revisão', () => {
  const t = '*Absenteísmo C7B 24/09/2026*\nTotal de pessoas: 46\nTotal presente: 46\nBanco de horas 3 pessoas';
  const c = L.conferir(L.lerMensagens(t, { ano: 2026 })[0]);
  assert.equal(c.status, 'amarelo');
  assert.match(c.problemas[0].texto, /Não entendi esta linha: "Banco de horas 3 pessoas"/);
});

test('texto para o superior junta todos os times no modelo da SUB MONTAGEM', () => {
  let b = L.baseVazia();
  const ms = L.lerMensagens(COLADO.replace('- Faltas: 0', '- Faltas: 4'), { ano: 2026 }).slice(1); // C5, C7B, C1B
  ms[0].time = 'C5B';
  for (const m of ms) b = L.gravar(b, m);
  const txt = L.textoSuperior(L.resumoDoDia(b, '2026-09-24'), 'Sub Montagem Turno B');
  const linhas = txt.split('\n');
  assert.deepEqual(linhas.slice(0, 14), [
    'ABSENTEÍSMO SUB MONTAGEM TURNO B 24/09/26',
    '',
    '- Efetivo previsto: 90 colaboradores',
    '- Atestados médicos: 8',
    '- Atraso de roteiro: 0',
    '- Atraso por motivo pessoal: 0',
    '- Atraso sem justificativa: 0',
    '- Faltas: 8',
    '- Faltas sem justificativa: 0',
    '- Afastamento INSS: 0',
    '- Turno ADM: 0',
    '- Férias: 0',
    '- Total presente: 82 colaboradores',
    '',
  ]);
  assert.deepEqual(linhas.slice(14, 17), ['Walter Teste', 'ID: 1000001', 'Motivo: Atestado médico']);
  // O próprio sistema lê esse texto de volta sem avisos
  const [volta] = L.lerMensagens(txt, { ano: 2026 });
  assert.equal(volta.time, 'SUB MONTAGEM TURNO B');
  assert.deepEqual([volta.efetivo, volta.presentes, volta.ausentes, volta.pessoas.length], [90, 82, 8, 8]);
  assert.equal(L.conferir(volta).status, 'verde');
});

test('texto para o superior sem nomes: só os números', () => {
  let b = L.baseVazia();
  for (const m of L.lerMensagens(COLADO, { ano: 2026 }).slice(2)) b = L.gravar(b, m); // C7B e C1B
  const r = L.resumoDoDia(b, '2026-09-24');
  const com = L.textoSuperior(r, 'Sub Montagem Turno B');
  const sem = L.textoSuperior(r, 'Sub Montagem Turno B', { comNomes: false });
  assert.match(com, /Walter Teste\nID: 1000001/);
  assert.doesNotMatch(sem, /Walter Teste|ID:|Motivo:/);
  assert.ok(sem.endsWith('- Total presente: 70 colaboradores'));
  assert.equal(sem, com.split('\n').slice(0, 13).join('\n'));
});
