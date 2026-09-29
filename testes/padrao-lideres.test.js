// Mensagens reais do grupo de 29/09/2026 (nomes e matrículas trocados por fictícios, mesma estrutura)
// e o padrão de mensagem para os líderes.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const L = require('../leitor.js');

const COLADO = fs.readFileSync(path.join(__dirname, 'colado-29-09.txt'), 'utf8');
const TIMES = ['C1B', 'C2B', 'C3B', 'C4B', 'C5B', 'C7B'];
const ler = (opcoes = {}) => L.lerMensagens(COLADO, { ano: 2026, ...opcoes });
const doTime = (ms, t) => ms.find(m => m.time === t);

test('29/09: seis mensagens, uma por time, todas com a data certa', () => {
  const ms = ler();
  assert.deepEqual(ms.map(m => m.time), ['C7B', 'C3B', 'C5B', 'C1B', 'C2B', 'C4B']);
  assert.ok(ms.every(m => m.data === '2026-09-29'));
  assert.deepEqual(ms.map(m => L.conferir(m, null, {}).status), ['verde', 'verde', 'amarelo', 'verde', 'verde', 'vermelho']);
});

test('"C5-" sem letra: completa pela lista de times (info) ou pelos outros times colados (amarelo)', () => {
  const pelaLista = doTime(ler({ times: TIMES }), 'C5B');
  assert.deepEqual(pelaLista.timeCompletado, { de: 'C5', para: 'C5B', fonte: 'lista' });
  const c = L.conferir(pelaLista, null, { times: TIMES });
  assert.equal(c.status, 'verde');
  assert.match(c.problemas[0].texto, /entendi C5B \(único C5 da lista/);
  const peloLote = doTime(ler(), 'C5B');
  assert.equal(peloLote.timeCompletado.fonte, 'lote');
  assert.equal(L.conferir(peloLote, null, {}).status, 'amarelo');
  // duas letras possíveis na lista: não adivinha
  const [m] = L.lerMensagens('*Absenteísmo C5-\n29/09/2026\nTotal de pessoas: 10\nPresentes: 10', { ano: 2026, times: ['C5A', 'C5B'] });
  assert.equal(m.time, 'C5'); assert.equal(m.timeIncompleto, true);
});

test('C1B: pessoa de férias fora do total não deixa o cartão vermelho; "Nome Fulano" sem dois pontos', () => {
  const m = doTime(ler(), 'C1B');
  assert.deepEqual([m.efetivo, m.presentes, m.ausentes], [29, 25, 4]);
  assert.equal(m.pessoas[1].nome, 'Alisson Teste');
  assert.deepEqual(m.pessoas.map(p => p.motivo), ['Férias', 'Atraso roteiro', 'Sem justificativa', 'Sem justificativa', 'Sem justificativa']);
  const c = L.conferir(m, null, { naoContam: ['Férias'] });
  assert.equal(c.status, 'verde');
  assert.match(c.problemas[0].texto, /Cristiano Exemplo \(Férias\) não entrou no total de pessoas\. Os outros 4 batem/);
  // o % continua certo: 4 faltas que contam em 29
  const base = L.gravar(L.baseVazia(), m, '2026-09-29T18:00:00Z');
  assert.equal(L.faltasDoFechamento(base.fechamentos['2026-09-29|C1B'], ['Férias']), 4);
  // se Férias não estiver fora do %, a diferença volta a ser erro
  assert.equal(L.conferir(m, null, { naoContam: [] }).status, 'vermelho');
});

test('C4B: marcadores "•", seções por motivo ("ATRASOS: Fulano") e dica de qual número está errado', () => {
  const m = doTime(ler(), 'C4B');
  assert.deepEqual([m.efetivo, m.presentes, m.ausentes], [29, 30, 1]);
  assert.deepEqual(m.pessoas.map(p => [p.nome, p.matricula, p.motivo]), [['Eliane dos Exemplo', '1000109', 'Atraso motivo pessoal']]);
  assert.ok(!m.linhasIgnoradas.some(l => /Exemplo/.test(l)));
  const c = L.conferir(m, null, {});
  assert.equal(c.status, 'vermelho');
  assert.equal(c.problemas.filter(p => p.nivel === 'vermelho').length, 1, 'um erro só, sem repetir a mesma conta');
  assert.match(c.problemas[0].texto, /o total deveria ser 31 ou os presentes 28/);
  assert.ok(c.problemas.some(p => /veio só "ATRASOS"/.test(p.texto)));
  assert.ok(!c.problemas.some(p => /sem nome|sem motivo/.test(p.texto)));
});

test('seções: nomes embaixo do motivo e "Outros motivos"', () => {
  const t = ['ABSENTEÍSMO C9B 29/09/2026', 'Total de pessoas: 20', 'Presentes: 17', 'Ausentes: 3', '',
    'ATESTADO MÉDICO:', 'Ana Exemplo - 1000201', 'Bruno Teste', 'Matrícula: 1000202', '',
    'OUTROS MOTIVOS DE AUSÊNCIA:', 'Caio Modelo - 1000203', '', 'FÉRIAS:', 'Sem férias'].join('\n');
  const [m] = L.lerMensagens(t, { ano: 2026 });
  assert.deepEqual(m.pessoas.map(p => [p.nome, p.matricula, p.motivo]),
    [['Ana Exemplo', '1000201', 'Atestado médico'], ['Bruno Teste', '1000202', 'Atestado médico'], ['Caio Modelo', '1000203', 'Outros']]);
  assert.equal(L.conferir(m, null, {}).status, 'verde');
});

test('padrão completo para o grupo: tem as regras, os motivos e o exemplo é lido sem nenhum aviso', () => {
  const o = L.textoOrientacao('2026-09-29', 'C3B');
  for (const trecho of ['PADRÃO DA MENSAGEM', 'Time completo, com a letra', 'inclusive quem está de férias', 'Tem que dar o mesmo número de nomes', ...L.MOTIVOS])
    assert.ok(o.includes(trecho), trecho);
  const ms = L.lerMensagens(L.exemploPadrao('2026-09-29', 'C3B'), { ano: 2026 });
  assert.equal(ms.length, 1);
  assert.deepEqual([ms[0].time, ms[0].data, ms[0].turno, ms[0].efetivo, ms[0].presentes, ms[0].ausentes], ['C3B', '2026-09-29', '2º turno', 30, 28, 2]);
  assert.deepEqual(L.conferir(ms[0]), { status: 'verde', problemas: [] });
  const [x] = L.lerMensagens('Absenteísmo C3B 29/09/2026\nTotal de pessoas: 5\nPresentes: 4\nNome: Ana Exemplo\nMatrícula: 1000301\nMotivo: Outros – doação de sangue', { ano: 2026 });
  assert.deepEqual(L.conferir(x), { status: 'verde', problemas: [] });
});

test('"Sem atraso", "Nenhum" e motivos soltos não viram nome de pessoa', () => {
  for (const s of ['Sem Atraso', 'Nenhum ausente', 'Atestado médico', 'Sem justificativa']) assert.equal(L.pareceNome(s), null, s);
  assert.equal(L.pareceNome('Maria da Luz dos Santos'), 'Maria da Luz dos Santos');
});
