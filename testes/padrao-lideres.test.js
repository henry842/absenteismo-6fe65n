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
  assert.deepEqual([ms[0].time, ms[0].data, ms[0].turno, ms[0].efetivo, ms[0].presentes, ms[0].ausentes], ['C3B', '2026-09-29', '2º turno', 30, 27, 3]);
  assert.deepEqual(L.conferir(ms[0]), { status: 'verde', problemas: [] });
  const [x] = L.lerMensagens('Absenteísmo C3B 29/09/2026\nTotal de pessoas: 5\nPresentes: 4\nNome: Ana Exemplo\nMatrícula: 1000301\nMotivo: Outros – doação de sangue', { ano: 2026 });
  assert.deepEqual(L.conferir(x), { status: 'verde', problemas: [] });
});

test('"Sem atraso", "Nenhum" e motivos soltos não viram nome de pessoa', () => {
  for (const s of ['Sem Atraso', 'Nenhum ausente', 'Atestado médico', 'Sem justificativa']) assert.equal(L.pareceNome(s), null, s);
  assert.equal(L.pareceNome('Maria da Luz dos Santos'), 'Maria da Luz dos Santos');
});

// Tira os blocos de exemplo do padrão completo (entre as linhas ━━━ de "EXEMPLO …")
function exemplos(texto) {
  const partes = texto.split(/━+\n\*✅ EXEMPLO[^\n]*\n━+\n/).slice(1);
  return partes.map(p => p.split(/\n\n━/)[0]);
}

test('padrão completo: dois exemplos (com e sem ausentes) lidos sem aviso, motivos explicados, CORREÇÃO', () => {
  const o = L.textoOrientacao('2026-09-30', 'C5B');
  assert.ok(!/\{TIME\}|\{DATA\}/.test(o), 'marcadores trocados');
  for (const trecho of ['QUAL MOTIVO USAR', 'ERROU?', 'CORREÇÃO – Absenteísmo C5B 30/09/2026', 'EVITE', '1º turno, 2º turno'])
    assert.ok(o.includes(trecho), trecho);
  const ex = exemplos(o);
  assert.equal(ex.length, 2);
  for (const e of ex) {
    const ms = L.lerMensagens(e, { ano: 2026 });
    assert.equal(ms.length, 1, e);
    assert.equal(ms[0].time, 'C5B'); assert.equal(ms[0].data, '2026-09-30');
    assert.deepEqual(L.conferir(ms[0], null, { naoContam: ['Férias'] }), { status: 'verde', problemas: [] });
  }
});

test('texto do padrão editável: {TIME}/{DATA} trocados, fica na config e passa pela limpeza da base', () => {
  const meu = 'Bom dia, líderes do {TIME}!\nMandem o absenteísmo de {data} neste formato.';
  assert.equal(L.textoOrientacao('2026-09-30', 'C2B', meu), 'Bom dia, líderes do C2B!\nMandem o absenteísmo de 30/09/2026 neste formato.');
  assert.equal(L.textoOrientacao('2026-09-30', 'C2B', '   '), L.textoOrientacao('2026-09-30', 'C2B'), 'vazio = texto original');
  const b = L.baseVazia(); b.config.textoPadrao = meu;
  assert.equal(L.sanearBase(JSON.parse(JSON.stringify(b))).config.textoPadrao, meu);
  assert.equal(L.sanearBase({ config: { textoPadrao: 'x'.repeat(9000) } }).config.textoPadrao.length, 8000);
  assert.equal(L.sanearBase({ config: { textoPadrao: { mal: 1 } } }).config.textoPadrao, undefined);
  // "Voltar ao original" grava '' (não apaga a chave): outro aparelho com o texto antigo não o traz de volta
  const S = require('../sincronia.js');
  const aparelhoA = L.baseVazia(); aparelhoA.config.textoPadrao = meu;
  const espelho = S.mapaDaBase(aparelhoA);
  const aparelhoB = JSON.parse(JSON.stringify(aparelhoA)); aparelhoB.config.textoPadrao = '';
  const r = S.aplicarRemotos(aparelhoA, espelho, S.linhasParaEnviar(aparelhoB, ['config']), {});
  assert.equal(r.base.config.textoPadrao, '');
  assert.equal(L.textoOrientacao('2026-09-30', 'C2B', r.base.config.textoPadrao), L.textoOrientacao('2026-09-30', 'C2B'));
});

test('CORREÇÃO colada junto com a mensagem original: fica só a correção', () => {
  const t = ['[30/09/2026, 15:40:00] ~ Lider: *Absenteísmo C2B 30/09/2026*', 'Total de pessoas: 30', 'Presentes: 29', 'Ausentes: 1',
    'Nome: Jairo Exemplo', 'Matrícula: 1000108', 'Motivo: Atestado médico',
    '[30/09/2026, 15:52:00] ~ Lider: *CORREÇÃO – Absenteísmo C2B 30/09/2026*', 'Total de pessoas: 30', 'Presentes: 28', 'Ausentes: 2',
    'Nome: Jairo Exemplo', 'Matrícula: 1000108', 'Motivo: Atestado médico', '',
    'Nome: Jonas Teste', 'Matrícula: 1000110', 'Motivo: Atraso roteiro',
    '[30/09/2026, 15:53:00] ~ Outro: *Absenteísmo C3B 30/09/2026*', 'Total de pessoas: 40', 'Presentes: 40', 'Ausentes: 0'].join('\n');
  const ms = L.lerMensagens(t, { ano: 2026 });
  assert.deepEqual(ms.map(m => [m.time, m.presentes]), [['C2B', 28], ['C3B', 40]]);
  const c = L.conferir(ms[0]);
  assert.equal(c.status, 'verde');
  assert.match(c.problemas[0].texto, /CORREÇÃO: substituiu/);
});

test('corrigir lançamento gravado: volta para a Conferência e, ao gravar, substitui (mesmo mudando time ou data)', () => {
  let base = L.baseVazia();
  for (const m of L.lerMensagens(COLADO, { ano: 2026 })) base = L.gravar(base, m, '2026-09-29T18:00:00Z');
  assert.equal(Object.keys(base.fechamentos).length, 6);
  // C5B lançado errado: era do C6B e presentes 14
  const m = L.mensagemDoFechamento(base.fechamentos['2026-09-29|C5B']);
  assert.equal(m.substitui, '2026-09-29|C5B');
  assert.deepEqual(m.pessoas.map(p => [p.nome, p.matricula, p.motivo]), [['Anselmo Martins Teste', '1000102', 'Atraso roteiro']]);
  let c = L.conferir(m, base, { naoContam: ['Férias'] });
  assert.equal(c.status, 'verde');
  assert.match(c.problemas[0].texto, /Corrigindo o lançamento já gravado/);
  m.time = 'C6B';
  c = L.conferir(m, base, {});
  assert.ok(!c.problemas.some(p => /já está como ausente/.test(p.texto)), 'não acusa a própria pessoa do lançamento original');
  base = L.gravar(base, m);
  assert.equal(base.fechamentos['2026-09-29|C5B'], undefined, 'o original sai');
  assert.equal(base.fechamentos['2026-09-29|C6B'].pessoas[0].matricula, '1000102');
  assert.equal(Object.keys(base.fechamentos).length, 6, 'não duplica');
});
