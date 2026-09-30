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
  assert.deepEqual(ms.map(m => m.time), ['SUB MONTAGEM TURNO B', 'C5B', 'C7B', 'C1B']);
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
  assert.deepEqual(ms.map(m => m.time), ['SUB MONTAGEM TURNO B', 'C5B', 'C7B', 'C1B']);
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
  assert.deepEqual(linhas.slice(0, 15), [
    'ABSENTEÍSMO SUB MONTAGEM TURNO B 24/09/26',
    '',
    '* Efetivo previsto: 90 colaboradores',
    '* Atestados médicos: 8',
    '* Atraso de roteiro: 0',
    '* Atraso por motivo pessoal: 0',
    '* Atraso sem justificativa: 0',
    '* Total de ausentes: 8',
    '* Faltas: 8',
    '* Faltas sem justificativa: 0',
    '* Afastamento INSS: 0',
    '* Turno ADM: 0',
    '* Férias: 0',
    '* Total presente: 82 colaboradores',
    '',
  ]);
  assert.deepEqual(linhas.slice(15, 19), ['Walter Teste', 'ID: 1000001', 'Equipe: C1B', 'Motivo: Atestado médico']);
  // O próprio sistema lê esse texto de volta sem avisos
  const [volta] = L.lerMensagens(txt, { ano: 2026 });
  assert.equal(volta.time, 'SUB MONTAGEM TURNO B');
  assert.deepEqual([volta.efetivo, volta.presentes, volta.ausentes, volta.pessoas.length], [90, 82, 8, 8]);
  assert.deepEqual([...new Set(volta.pessoas.map(p => p.equipe))], ['C1B', 'C5B', 'C7B']);
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
  assert.ok(sem.endsWith('* Total presente: 70 colaboradores'));
  assert.equal(sem, com.split('\n').slice(0, 14).join('\n'));
});

test('texto para o superior: cabeçalho padrão, Total de ausentes e Faltas (Férias não conta no %)', () => {
  const base = L.baseVazia(); base.config.naoContam = ['Férias'];
  const ms = L.lerMensagens('*Absenteísmo C1B 24/09/2026*\n*Total de pessoas:* 20\n*Presentes:* 17\n*Ausentes:* 3\n\n*Nome:* Ana Teste\n*Matrícula:* 1000001\n*Motivo:* Atestado médico\n\n*Nome:* Bia Teste\n*Matrícula:* 1000002\n*Motivo:* Sem justificativa\n\n*Nome:* Cai Teste\n*Matrícula:* 1000003\n*Motivo:* Férias', { ano: 2026 });
  let b = base; for (const m of ms) b = L.gravar(b, m);
  const txt = L.textoSuperior(L.resumoDoDia(b, '2026-09-24'), undefined, { comNomes: false });
  const linhas = txt.split('\n');
  assert.equal(linhas[0], 'ABSENTEÍSMO CHASSI/SUB-MONTAGEM 24/09/26'); // área padrão quando nada foi configurado
  assert.ok(linhas.includes('* Total de ausentes: 3'));
  assert.ok(linhas.includes('* Faltas: 2')); // a pessoa de férias não conta
  assert.ok(linhas.includes('* Férias: 1'));
  assert.ok(linhas.includes('* Faltas sem justificativa: 1'));
  assert.equal(linhas[linhas.length - 1], '* Total presente: 17 colaboradores');
});

test('o indicador de cada linha do texto é o mesmo que a tela mostra', () => {
  let b = L.baseVazia();
  for (const m of L.lerMensagens(COLADO, { ano: 2026 }).slice(2)) b = L.gravar(b, m);
  const r = L.resumoDoDia(b, '2026-09-24');
  const ind = L.indicadores(r);
  assert.deepEqual(ind.map(i => i.rotulo), ['Efetivo previsto', 'Atestados médicos', 'Atraso de roteiro', 'Atraso por motivo pessoal', 'Atraso sem justificativa',
    'Total de ausentes', 'Faltas', 'Faltas sem justificativa', 'Afastamento INSS', 'Turno ADM', 'Férias', 'Total presente']);
  const txt = L.textoSuperior(r, 'X', { comNomes: false }).split('\n');
  for (const i of ind) assert.ok(txt.includes(`* ${i.rotulo}: ${i.valor}${i.unidade ? ' ' + i.unidade : ''}`), i.rotulo);
});

test('lendo de volta: "Total de ausentes" vale mais que "Faltas"', () => {
  const txt = ['ABSENTEÍSMO CHASSI/SUB-MONTAGEM 29/09/26', '', '* Efetivo previsto: 297 colaboradores', '* Atestados médicos: 5', '* Atraso de roteiro: 9',
    '* Atraso por motivo pessoal: 2', '* Atraso sem justificativa: 0', '* Total de ausentes: 19', '* Faltas: 18', '* Faltas sem justificativa: 5',
    '* Afastamento INSS: 0', '* Turno ADM: 0', '* Férias: 1', '* Total presente: 278 colaboradores'].join('\n');
  const [m] = L.lerMensagens(txt, { ano: 2026 });
  assert.deepEqual([m.efetivo, m.presentes, m.ausentes], [297, 278, 19]);
});

test('efetivo previsto ajustado: o texto e os indicadores usam o valor; presentes = previsto − ausentes', () => {
  let b = L.baseVazia();
  for (const m of L.lerMensagens(COLADO, { ano: 2026 }).slice(2)) b = L.gravar(b, m); // C7B e C1B
  const r = L.resumoDoDia(b, '2026-09-24');
  assert.equal(L.comEfetivoPrevisto(r, null), r);            // sem ajuste: nada muda
  assert.equal(L.comEfetivoPrevisto(r, r.efetivo), r);
  const aj = L.comEfetivoPrevisto(r, 297);
  assert.deepEqual([aj.efetivo, aj.efetivoAuto, aj.ausentes, aj.presentes], [297, r.efetivo, r.ausentes, 297 - r.ausentes]);
  assert.ok(Math.abs(aj.absenteismo - r.faltasQueContam / 297) < 1e-9);
  const linhas = L.textoSuperior(aj, 'X', { comNomes: false }).split('\n');
  assert.ok(linhas.includes('* Efetivo previsto: 297 colaboradores'));
  assert.equal(linhas[linhas.length - 1], `* Total presente: ${297 - r.ausentes} colaboradores`);
  assert.equal(L.comEfetivoPrevisto(r, 3).presentes >= 0, true); // valor menor que os ausentes não dá presentes negativos
});

test('a configuração do efetivo previsto passa pela limpeza (só valores válidos entram)', () => {
  const ok = L.sanearBase({ fechamentos: {}, config: { efetivoModo: 'fixo', efetivoFixo: '297' } });
  assert.equal(ok.config.efetivoModo, 'fixo'); assert.equal(ok.config.efetivoFixo, 297);
  const ruim = L.sanearBase({ fechamentos: {}, config: { efetivoModo: 'hackeado', efetivoFixo: -5 } });
  assert.equal(ruim.config.efetivoModo, undefined); assert.equal(ruim.config.efetivoFixo, undefined);
  const enorme = L.sanearBase({ fechamentos: {}, config: { efetivoModo: 'cadastro', efetivoFixo: 1e9 } });
  assert.equal(enorme.config.efetivoModo, 'cadastro'); assert.equal(enorme.config.efetivoFixo, undefined);
});
