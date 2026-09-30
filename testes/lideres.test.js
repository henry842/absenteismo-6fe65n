// Regras do lançamento pelos líderes: busca, atraso, cadastro, fechamento e texto por time.
const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../leitor.js');
const D = require('../lideres.js');

const funcs = [
  { nome: 'Renner de Lima dos Santos', matricula: '9017253', time: 'C1B' },
  { nome: 'JAQUELINE SANTOS DE JESUS', matricula: '9020359', time: 'C1B' },
  { nome: 'José Exemplo Cruz Souza', matricula: '1000008', time: 'C1B' },
  { nome: 'Sem Matricula Silva', matricula: '', time: 'C1B' },
];

test('login por usuário vira e-mail interno; e-mail fica como está', () => {
  assert.equal(D.emailDoUsuario(' C2B '), 'c2b@lider.absenteismo.app');
  assert.equal(D.emailDoUsuario('EG+FPB'.replace('+', '')), 'egfpb@lider.absenteismo.app');
  assert.equal(D.emailDoUsuario('Chefe@Empresa.com'), 'chefe@empresa.com');
});

test('atraso: minutos entre o horário do turno e a chegada', () => {
  assert.equal(D.minutosDeAtraso('14:00', '14:25'), 25);
  assert.equal(D.minutosDeAtraso('14:00:00', '15:05:00'), 65);
  assert.equal(D.minutosDeAtraso('14:00', '14:00'), null);
  assert.equal(D.minutosDeAtraso('14:00', '13:50'), null);
  assert.equal(D.minutosDeAtraso('', '14:10'), null);
  assert.equal(D.textoAtraso(25), '25 min');
  assert.equal(D.textoAtraso(65), '1h05');
});

test('busca por nome (sem acento, qualquer ordem) e por matrícula', () => {
  assert.deepEqual(D.buscarFuncionarios(funcs, 'jose souza').map(f => f.matricula), ['1000008']);
  assert.deepEqual(D.buscarFuncionarios(funcs, 'JAQUE').map(f => f.matricula), ['9020359']);
  assert.deepEqual(D.buscarFuncionarios(funcs, '9017').map(f => f.nome), ['Renner de Lima dos Santos']);
  assert.deepEqual(D.buscarFuncionarios(funcs, ''), []);
  assert.deepEqual(D.buscarFuncionarios(funcs, 'santos').length, 2);
});

test('busca esconde quem já foi lançado no dia (com ou sem matrícula)', () => {
  const excluir = new Set(['9017253', D.chaveDaPessoa(funcs[3])]);
  assert.deepEqual(D.buscarFuncionarios(funcs, 'santos', { excluir }).map(f => f.matricula), ['9020359']);
  assert.deepEqual(D.buscarFuncionarios(funcs, 'silva', { excluir }), []);
});

test('cadastro: aponta matrícula repetida, em branco e curta', () => {
  const p = D.problemasCadastro([
    { nome: 'A', matricula: '1000040' }, { nome: 'B', matricula: '1000040' },
    { nome: 'C', matricula: '' }, { nome: 'D', matricula: '5087' }, { nome: 'E', matricula: '9000001' },
    { nome: 'F', matricula: '1000040', ativo: false },
  ]);
  assert.equal(p.duplicadas.length, 1);
  assert.deepEqual(p.duplicadas[0].pessoas.map(x => x.nome), ['A', 'B']);
  assert.deepEqual(p.semMatricula.map(x => x.nome), ['C']);
  assert.deepEqual(p.curtas.map(x => x.nome), ['D']);
});

const lancs = [
  { data: '2026-09-30', time: 'C1B', tipo: 'ausencia', matricula: '9017253', nome: 'Renner de Lima', motivo: 'Atestado médico', justificativa: 'CID informado' },
  { data: '2026-09-30', time: 'C1B', tipo: 'atraso', matricula: '9020359', nome: 'Jaqueline Santos', motivo: 'Atraso roteiro', justificativa: '', hora_prevista: '14:00:00', hora_chegada: '14:25:00' },
  { data: '2026-09-30', time: 'C2B', tipo: 'ausencia', matricula: '8798553', nome: 'Marivan Rocha', motivo: 'Sem justificativa', justificativa: '' },
  { data: '2026-09-29', time: 'C1B', tipo: 'ausencia', matricula: '1000008', nome: 'Jose Exemplo', motivo: 'Férias', justificativa: '' },
];
const envios = [
  { data: '2026-09-30', time: 'C1B', efetivo: 23, enviado_em: '2026-09-30T17:40:00Z' },
  { data: '2026-09-29', time: 'C1B', efetivo: 23, enviado_em: '2026-09-29T17:40:00Z' },
];

test('só o time enviado vira fechamento; atraso entra como ausente (modelo do WhatsApp)', () => {
  const f = D.lancamentosParaFechamentos(lancs, envios);
  assert.deepEqual(Object.keys(f).sort(), ['2026-09-29|C1B', '2026-09-30|C1B']);
  const c1 = f['2026-09-30|C1B'];
  assert.equal(c1.efetivo, 23); assert.equal(c1.ausentes, 2); assert.equal(c1.presentes, 21);
  assert.deepEqual(c1.pessoas.map(p => p.motivo).sort(), ['Atestado médico', 'Atraso roteiro']);
  // o supervisor conta quem atrasou; a hora em que chegou é só do líder e não vai no texto
  assert.equal(c1.pessoas.find(p => p.motivo === 'Atraso roteiro').motivoOriginal, '');
});

test('time enviado sem nenhuma ausência conta como recebido, todo mundo presente', () => {
  const f = D.lancamentosParaFechamentos([], [{ data: '2026-09-30', time: 'C3B', efetivo: 41 }]);
  assert.equal(f['2026-09-30|C3B'].presentes, 41);
  assert.equal(f['2026-09-30|C3B'].ausentes, 0);
});

test('o fechamento dos líderes passa pelos relatórios que já existiam', () => {
  const base = D.mesclarBase(L.baseVazia(), lancs, envios, ['C2B', 'C1B']);
  const r = L.resumoDoDia(base, '2026-09-30');
  assert.deepEqual(r.recebidos, ['C1B']);
  assert.deepEqual(r.pendentes, ['C2B']); // C2B lançou mas ainda não enviou
  assert.equal(r.ausentes, 2);
  assert.equal(r.times[0].anterior.ausentes, 1); // comparação com o dia anterior funciona
  assert.match(L.textoSuperior(r, 'SUB MONTAGEM TURNO B'), /Atestados médicos: 1/);
  assert.match(L.textoSuperior(r, 'SUB MONTAGEM TURNO B'), /Atraso de roteiro: 1/);
});

test('mesclar não altera a base do supervisor e o dado do líder vence o colado', () => {
  let b = L.baseVazia();
  const m = L.lerMensagens('*Absenteísmo C1B 30/09/2026*\nTotal de pessoas: 10\nTotal presente: 10', { ano: 2026 })[0];
  b = L.gravar(b, m);
  const copia = JSON.stringify(b);
  const mesclada = D.mesclarBase(b, lancs, envios, []);
  assert.equal(JSON.stringify(b), copia);
  assert.equal(mesclada.fechamentos['2026-09-30|C1B'].efetivo, 23);
  assert.deepEqual(mesclada.config.times, []);
});

test('texto por time: organizado, com pendentes e totais', () => {
  const t = D.textoPorTime('2026-09-30', lancs, envios, ['C1B', 'C2B', 'C3B']);
  assert.match(t, /ABSENTEÍSMO POR TIME – 30\/09\/2026/);
  assert.match(t, /Efetivo: 23 · Ausentes\/atrasos: 2 \(8,7%\)/);
  assert.match(t, /\*C1B\* – 2 de 23 \(8,7%\)/);
  assert.match(t, /• Renner de Lima \(9017253\) – Atestado médico: CID informado/);
  assert.match(t, /• Jaqueline Santos \(9020359\) – Atraso roteiro/);
  assert.doesNotMatch(t, /14:25|chegou/);
  assert.match(t, /\*C2B\* – ainda não enviou/);
  assert.match(t, /Ainda não enviaram:\* C2B, C3B/);
});

// ---------- Atraso aguardando chegada, saída antecipada e time 100% ----------
const pendente = { data: '2026-09-30', time: 'C3B', tipo: 'atraso', matricula: '9000300', nome: 'Carlos Pendente', motivo: 'Atraso sem justificativa', justificativa: '', hora_prevista: '14:00:00', hora_chegada: null };
const saida = { data: '2026-09-30', time: 'C3B', tipo: 'saida', matricula: '9000301', nome: 'Diana Saiu', motivo: 'Saúde', justificativa: 'Mal-estar', hora_prevista: null, hora_chegada: null, hora_saida: '16:30:00' };

test('atraso sem hora de chegada fica aguardando; com hora, deixa de ficar', () => {
  assert.equal(D.atrasoPendente(pendente), true);
  assert.equal(D.atrasoPendente({ ...pendente, hora_chegada: '14:20:00' }), false);
  assert.equal(D.atrasoPendente({ ...pendente, tipo: 'ausencia' }), false);
  assert.equal(D.minutosDeAtraso(pendente.hora_prevista, pendente.hora_chegada), null);
});

test('atraso ainda sem chegada já conta como ausente no fechamento, sem hora nem aviso de "aguardando"', () => {
  const f = D.lancamentosParaFechamentos([pendente], [{ data: '2026-09-30', time: 'C3B', efetivo: 41 }])['2026-09-30|C3B'];
  assert.equal(f.ausentes, 1);
  assert.equal(f.pessoas[0].motivo, 'Atraso sem justificativa');
  assert.equal(f.pessoas[0].motivoOriginal, '');
  // chegar depois não muda nada para o supervisor: continua contando como atraso
  const chegou = D.lancamentosParaFechamentos([{ ...pendente, hora_chegada: '14:40:00' }], [{ data: '2026-09-30', time: 'C3B', efetivo: 41 }])['2026-09-30|C3B'];
  assert.deepEqual(chegou, f);
});

test('saída antecipada não entra no % (a pessoa veio), mas aparece nos textos', () => {
  const f = D.lancamentosParaFechamentos([saida], [{ data: '2026-09-30', time: 'C3B', efetivo: 41 }])['2026-09-30|C3B'];
  assert.equal(f.ausentes, 0); assert.equal(f.pessoas.length, 0); assert.equal(f.presentes, 41);
  const t = D.textoPorTime('2026-09-30', [saida], [{ data: '2026-09-30', time: 'C3B', efetivo: 41 }], ['C3B']);
  assert.match(t, /Saídas antecipadas: 1/);
  assert.match(t, /• Diana Saiu \(9000301\) – saiu 16:30 – Saúde: Mal-estar/);
  assert.match(t, /\*C3B\* – 100% presente \(41 de 41\)/);
});

test('texto por time: os atrasos saem por ordem de nome, com o motivo, sem hora e sem aviso de chegada', () => {
  const chegou = { ...pendente, matricula: '9000302', nome: 'Ana Chegou', hora_chegada: '14:10:00' };
  const t = D.textoPorTime('2026-09-30', [chegou, pendente], [{ data: '2026-09-30', time: 'C3B', efetivo: 41 }], ['C3B']);
  assert.ok(t.indexOf('Ana Chegou') < t.indexOf('Carlos Pendente'));
  assert.match(t, /• Carlos Pendente \(9000300\) – Atraso sem justificativa/);
  assert.match(t, /Ausentes\/atrasos: 2/);
  assert.doesNotMatch(t, /aguardando|chegou 14|turno às|14:10/i);
});

test('time 100% presente: enviou e ninguém faltou nem atrasou (saída não tira o 100%)', () => {
  const envio = { data: '2026-09-30', time: 'C4B', efetivo: 23 };
  assert.equal(D.resumoDoTime([], envio).cem, true);
  assert.equal(D.resumoDoTime([{ ...saida, time: 'C4B' }], envio).cem, true);
  assert.equal(D.resumoDoTime([pendente], envio).cem, false);
  assert.equal(D.resumoDoTime([], null).cem, false); // ainda não enviou
  const t = D.textoPorTime('2026-09-30', [], [envio], ['C4B']);
  assert.match(t, /\*C4B\* – 100% presente \(23 de 23\)/);
});

test('busca: quem já foi lançado some; quem faltou não pode sair mais cedo', () => {
  const lancsDia = [{ ...pendente }, { ...saida }, { tipo: 'ausencia', matricula: '9000999', nome: 'Faltou' }];
  const ausAtr = D.excluirDaBusca(lancsDia, 'ausencia');
  assert.ok(ausAtr.has('9000300') && ausAtr.has('9000301') && ausAtr.has('9000999'));
  const paraSaida = D.excluirDaBusca(lancsDia, 'saida');
  assert.ok(!paraSaida.has('9000300')); // quem está atrasado pode sair mais cedo
  assert.ok(paraSaida.has('9000301') && paraSaida.has('9000999'));
});

test('extras do texto para o superior: só as saídas antecipadas (atraso já entra no texto como ausente)', () => {
  const l = [pendente, saida, { ...pendente, data: '2026-09-29', matricula: '1' }];
  const b = D.blocoExtras('2026-09-30', l);
  assert.doesNotMatch(b, /Atrasos|aguardando|Carlos Pendente/);
  assert.match(b, /Saídas antecipadas: 1/);
  assert.match(b, /Diana Saiu – ID 9000301 – Equipe C3B – saiu 16:30 – Saúde: Mal-estar/);
  assert.equal(D.blocoExtras('2026-09-28', l), '');
  assert.equal(D.blocoExtras('2026-09-30', [pendente]), '');
  assert.equal(D.pendenciasDoDia, undefined);   // não há mais aviso de "o texto muda quando o líder registrar a chegada"
});

// ---------- Motivos: atraso é um motivo da mesma lista; o líder cadastra os dele e pode digitar ----------
const prefs = D.sanearPrefsMotivos({ proprios: [{ texto: 'Consulta médica', atraso: false }, { texto: 'Trânsito', atraso: true }], padrao: 'Consulta médica' });

test('lista de motivos: ausência, atraso e os do líder, nessa ordem', () => {
  assert.deepEqual(D.gruposDeMotivos(prefs).map(g => g.grupo), ['Ausência', 'Atraso', 'Meus motivos']);
  assert.deepEqual(D.gruposDeMotivos(D.sanearPrefsMotivos(null)).map(g => g.grupo), ['Ausência', 'Atraso']);
  const todos = D.todosOsMotivos(prefs);
  assert.equal(todos.find(m => m.texto === 'Atraso roteiro').tipo, 'atraso');
  assert.equal(todos.find(m => m.texto === 'Atestado médico').tipo, 'ausencia');
  assert.equal(todos.find(m => m.texto === 'Trânsito').tipo, 'atraso');
  assert.equal(todos.find(m => m.texto === 'Consulta médica').tipo, 'ausencia');
});

test('motivo que já vem selecionado: o que o líder definiu em Ajustes, senão o primeiro da lista', () => {
  assert.equal(D.motivoInicial(prefs), 'Consulta médica');
  assert.equal(D.motivoInicial(D.sanearPrefsMotivos(null)), 'Sem justificativa');
  assert.equal(D.motivoInicial(D.sanearPrefsMotivos({ padrao: 'Atraso roteiro' })), 'Atraso roteiro');
});

test('escolher motivo: o motivo decide se lança ausência ou atraso; "Outro" aceita texto digitado', () => {
  assert.deepEqual(D.escolherMotivo('Atestado médico', '', prefs), { motivo: 'Atestado médico', tipo: 'ausencia' });
  assert.deepEqual(D.escolherMotivo('Atraso roteiro', '', prefs), { motivo: 'Atraso roteiro', tipo: 'atraso' });
  assert.deepEqual(D.escolherMotivo('Trânsito', '', prefs), { motivo: 'Trânsito', tipo: 'atraso' });          // motivo próprio marcado como atraso
  assert.deepEqual(D.escolherMotivo(D.OUTRO, '  doação   de sangue ', prefs), { motivo: 'doação de sangue', tipo: 'ausencia' });
  assert.deepEqual(D.escolherMotivo(D.OUTRO, 'Atraso do ônibus', prefs), { motivo: 'Atraso do ônibus', tipo: 'atraso' });   // começou com "Atraso"
  assert.deepEqual(D.escolherMotivo(D.OUTRO, 'ferias', prefs), { motivo: 'Férias', tipo: 'ausencia' });       // texto igual a um da lista usa o da lista
  assert.ok(D.escolherMotivo(D.OUTRO, '   ', prefs).erro);
  assert.equal(D.escolherMotivo(D.OUTRO, 'x'.repeat(200), prefs).motivo.length, D.MAX_MOTIVO);              // o banco aceita até 60
});

test('motivos guardados no aparelho: só entra o que é válido (sem repetido, sem os do sistema, no máximo 20)', () => {
  const p = D.sanearPrefsMotivos({
    proprios: [{ texto: ' Consulta ' }, { texto: 'consulta' }, { texto: 'Férias' }, { texto: '' }, null, { texto: 'Atraso trânsito' }, 'lixo'],
    padrao: 'não existe',
  });
  assert.deepEqual(p.proprios, [{ texto: 'Consulta', atraso: false }, { texto: 'Atraso trânsito', atraso: true }]);
  assert.equal(p.padrao, '');
  const muitos = D.sanearPrefsMotivos({ proprios: Array.from({ length: 50 }, (_, i) => ({ texto: 'Motivo ' + i })) });
  assert.equal(muitos.proprios.length, D.MAX_MOTIVOS_PROPRIOS);
  assert.deepEqual(D.sanearPrefsMotivos('qualquer coisa'), { proprios: [], padrao: '' });
  assert.equal(D.motivoExiste('CONSULTA MEDICA', prefs), true);
  assert.equal(D.motivoExiste('Outra coisa', prefs), false);
});

test('motivo escrito pelo líder chega ao relatório do supervisor como Outros (ou atraso pessoal), com o texto dele ao lado', () => {
  const aus = { data: '2026-09-30', time: 'C3B', tipo: 'ausencia', matricula: '9000400', nome: 'Eva Consulta', motivo: 'Consulta médica', justificativa: 'exame de rotina' };
  const atr = { data: '2026-09-30', time: 'C3B', tipo: 'atraso', matricula: '9000401', nome: 'Beto Trânsito', motivo: 'Trânsito', justificativa: '', hora_prevista: '14:00:00', hora_chegada: null };
  assert.equal(D.motivoDoRelatorio(aus), 'Outros');
  assert.equal(D.motivoDoRelatorio(atr), 'Atraso motivo pessoal');
  assert.equal(D.motivoDoRelatorio({ tipo: 'atraso', motivo: 'Atraso roteiro' }), 'Atraso roteiro');
  const f = D.lancamentosParaFechamentos([aus, atr], [{ data: '2026-09-30', time: 'C3B', efetivo: 30 }])['2026-09-30|C3B'];
  assert.equal(f.ausentes, 2);
  assert.deepEqual(f.pessoas.map(p => [p.nome, p.motivo, p.motivoOriginal]), [
    ['Beto Trânsito', 'Atraso motivo pessoal', 'Trânsito'],
    ['Eva Consulta', 'Outros', 'Consulta médica – exame de rotina'],
  ]);
  // no texto para o chefe vai o motivo que o líder escreveu, mas não a justificativa (pode ter dado de saúde)
  const tb = L.textoSuperior(L.resumoDoDia(D.mesclarBase(L.baseVazia(), [aus, atr], [{ data: '2026-09-30', time: 'C3B', efetivo: 30 }], ['C3B']), '2026-09-30'), 'SUB MONTAGEM');
  assert.match(tb, /Motivo: Outros – Consulta médica\n?/);
  assert.match(tb, /Motivo: Atraso motivo pessoal – Trânsito/);
  assert.doesNotMatch(tb, /exame de rotina/);
  // e os indicadores do texto para o superior contam as duas pessoas
  const base = D.mesclarBase(L.baseVazia(), [aus, atr], [{ data: '2026-09-30', time: 'C3B', efetivo: 30 }], ['C3B']);
  const ind = Object.fromEntries(L.indicadores(L.resumoDoDia(base, '2026-09-30')).map(i => [i.chave, i.valor]));
  assert.equal(ind.ausentes, 2); assert.equal(ind.atrasoPessoal, 1); assert.equal(ind.outros, 1); assert.equal(ind.presentes, 28);
});

// ---------- Prazo, cobrança, WhatsApp, CSV ----------
test('prazo de envio: só vale hoje e só depois da hora limite', () => {
  const hoje = '2026-09-30';
  const as = (h, m) => new Date(2026, 8, 30, h, m);
  assert.equal(D.passouDoPrazo('16:00', hoje, hoje, as(15, 59)), false);
  assert.equal(D.passouDoPrazo('16:00', hoje, hoje, as(16, 0)), true);
  assert.equal(D.passouDoPrazo('16:00:00', hoje, hoje, as(17, 30)), true);
  assert.equal(D.passouDoPrazo('16:00', '2026-09-29', hoje, as(17, 30)), false); // dia passado não tem "prazo"
  assert.equal(D.passouDoPrazo(null, hoje, hoje, as(23, 0)), false);
});

test('cobrança dos times que não enviaram', () => {
  const t = D.textoCobranca('2026-09-30', ['C4B', 'C5B'], '16:00');
  assert.match(t, /\*Absenteísmo 30\/09\/2026\*/);
  assert.match(t, /Ainda falta enviar: \*C4B, C5B\*/);
  assert.match(t, /O prazo de envio era 16:00\./);
  assert.equal(D.textoCobranca('2026-09-30', [], '16:00'), '');
});

test('link do WhatsApp: codifica o texto e avisa quando é grande demais', () => {
  const t = 'ABSENTEÍSMO 30/09/26\n* Faltas: 2 & 3';
  assert.equal(D.whatsappUrl(t), 'https://wa.me/?text=' + encodeURIComponent(t));
  assert.ok(!D.whatsappUrl(t).includes('\n'));
  assert.equal(D.cabeNoLink('curto'), true);
  assert.equal(D.cabeNoLink('ã'.repeat(3000)), false);
});

test('CSV dos lançamentos: completo, em ordem e protegido contra fórmulas do Excel', () => {
  const l = [
    { data: '2026-09-30', time: 'C3B', tipo: 'atraso', matricula: '9000300', nome: 'Carlos', motivo: 'Atraso sem justificativa', justificativa: '', hora_prevista: '14:00:00', hora_chegada: null },
    { data: '2026-09-29', time: 'C1B', tipo: 'ausencia', matricula: '', nome: '=HYPERLINK("http://x")', motivo: 'Outros', justificativa: 'a;b "c"' },
    { data: '2026-09-30', time: 'C1B', tipo: 'saida', matricula: '1', nome: 'Diana', motivo: 'Saúde', justificativa: '', hora_saida: '16:30:00' },
  ];
  const linhas = D.csvLancamentos(l).replace('﻿', '').split('\r\n');
  assert.equal(linhas[0], 'Data;Dia da semana;Time;Tipo;Matrícula;Nome;Motivo;Justificativa;Horário do turno;Chegada;Atraso (min);Saída;Situação;Registrado em');
  assert.match(linhas[1], /^29\/09\/2026;terça-feira;C1B;Ausência;;"'=HYPERLINK\(""http:\/\/x""\)";Outros;"a;b ""c"""/);
  assert.match(linhas[2], /^30\/09\/2026;quarta-feira;C1B;Saída antecipada;1;Diana;Saúde;;;;;16:30;;/);
  assert.match(linhas[3], /^30\/09\/2026;quarta-feira;C3B;Atraso;9000300;Carlos;Atraso sem justificativa;;14:00;;;;Aguardando chegada;/);
  assert.equal(D.linhasEnvios([{ data: '2026-09-30', time: 'C2B', efetivo: 30 }])[0].join('|'), '2026-09-30|C2B|30|');
});

// ---------- Fila offline ----------
const ins = (id, dia = '2026-09-30', time = 'C1B', extra = {}) => ({ id: 'op-' + id, op: 'ins', dia, time, dados: Object.assign({ id, data: dia, time, tipo: 'ausencia', nome: 'Pessoa ' + id, motivo: 'Outros', justificativa: '' }, extra) });
const upd = (id, mudar, dia = '2026-09-30', time = 'C1B') => ({ id: 'op-u' + id, op: 'upd', dia, time, dados: { id, mudar } });
const del = (id, dia = '2026-09-30', time = 'C1B') => ({ id: 'op-d' + id, op: 'del', dia, time, dados: { id } });

test('fila offline: editar o que ainda não subiu muda o próprio lançamento', () => {
  const f = D.compactarFila([ins('a'), upd('a', { motivo: 'Férias' }), upd('a', { justificativa: 'ok' })]);
  assert.equal(f.length, 1);
  assert.equal(f[0].op, 'ins'); assert.equal(f[0].dados.motivo, 'Férias'); assert.equal(f[0].dados.justificativa, 'ok');
});

test('fila offline: apagar o que ainda não subiu cancela os dois; editar duas vezes o que já existe junta as edições', () => {
  assert.deepEqual(D.compactarFila([ins('a'), del('a')]), []);
  const f = D.compactarFila([upd('z', { motivo: 'A' }), upd('z', { justificativa: 'B' }), del('y')]);
  assert.equal(f.length, 2);
  assert.deepEqual(f[0].dados.mudar, { motivo: 'A', justificativa: 'B' });
  assert.equal(f[1].op, 'del');
});

test('fila offline: só o último envio do dia vale', () => {
  const env = (efetivo, dia = '2026-09-30') => ({ id: 'e' + efetivo, op: 'env', dia, time: 'C1B', dados: { data: dia, time: 'C1B', efetivo } });
  const f = D.compactarFila([env(20), env(22), { id: 'x', op: 'envdel', dia: '2026-09-30', time: 'C1B', dados: {} }, env(25), env(30, '2026-09-29')]);
  assert.deepEqual(f.map(o => o.dados.efetivo || o.op), [25, 30]);
});

test('fila offline: aplica por cima do que veio do servidor, só do dia e do time em tela', () => {
  const servidor = [{ id: 's1', data: '2026-09-30', time: 'C1B', tipo: 'ausencia', nome: 'Do servidor', motivo: 'Outros', justificativa: '' }];
  const fila = [ins('a'), upd('s1', { justificativa: 'editado offline' }), ins('b', '2026-09-29'), ins('c', '2026-09-30', 'C2B'), del('a'),
    { id: 'e', op: 'env', dia: '2026-09-30', time: 'C1B', dados: { data: '2026-09-30', time: 'C1B', efetivo: 23, enviado_em: 'agora' } }];
  const r = D.aplicarFila(servidor, null, fila, '2026-09-30', 'C1B');
  assert.deepEqual(r.lancs.map(x => x.id), ['s1']);            // "a" entrou e saiu; "b" é de outro dia; "c" de outro time
  assert.equal(r.lancs[0].justificativa, 'editado offline');
  assert.equal(r.envio.efetivo, 23);
  assert.equal(D.aplicarFila(servidor, r.envio, [{ id: 'd', op: 'envdel', dia: '2026-09-30', time: 'C1B', dados: {} }], '2026-09-30', 'C1B').envio, null);
});

test('erro de rede (tenta de novo) x recusa do servidor (não adianta insistir)', () => {
  assert.equal(D.erroDeRede({ message: 'TypeError: Failed to fetch', code: '' }, true), true);
  assert.equal(D.erroDeRede({ message: 'qualquer coisa' }, false), true);                 // aparelho sem internet
  assert.equal(D.erroDeRede({ message: 'duplicate key', code: '23505' }, true), false);    // o servidor respondeu: recusou
  assert.equal(D.erroDeRede({ message: 'new row violates row-level security policy', code: '42501' }, true), false);
  assert.equal(D.erroDeSessao({ message: 'JWT expired', status: 401 }), true);
  assert.equal(D.erroDeSessao({ message: 'duplicate key', code: '23505' }), false);
});

// ---------- Registro de alterações em português ----------
test('auditoria descrita em português', () => {
  const lanc = (o) => Object.assign({ tabela: 'lancamentos', time: 'C1B', usuario: 'c1b', quando: '2026-09-30T18:00:00Z' }, o);
  const base = { tipo: 'atraso', nome: 'Carlos', matricula: '9000300', motivo: 'Atraso sem justificativa', justificativa: '', hora_prevista: '14:00:00', hora_chegada: null };
  assert.equal(D.descreverAuditoria(lanc({ acao: 'INSERT', depois: base })).texto, 'Lançou atraso de Carlos (9000300)');
  assert.equal(D.descreverAuditoria(lanc({ acao: 'DELETE', antes: base })).texto, 'Apagou atraso de Carlos (9000300)');
  const alt = D.descreverAuditoria(lanc({ acao: 'UPDATE', antes: base, depois: Object.assign({}, base, { hora_chegada: '14:25:00', motivo: 'Atraso roteiro' }) }));
  assert.equal(alt.texto, 'Alterou atraso de Carlos (9000300): motivo: Atraso sem justificativa → Atraso roteiro; chegada: — → 14:25');
  assert.equal(alt.quem, 'c1b');
  assert.equal(D.descreverAuditoria({ tabela: 'envios', acao: 'INSERT', depois: { efetivo: 23 }, usuario: null }).quem, 'sistema');
  assert.equal(D.descreverAuditoria({ tabela: 'envios', acao: 'UPDATE', antes: { efetivo: 23 }, depois: { efetivo: 25 } }).texto, 'Atualizou o envio (efetivo 23 → 25)');
  assert.equal(D.descreverAuditoria({ tabela: 'envios', acao: 'DELETE', antes: { efetivo: 23 } }).texto, 'Desfez o envio do time');
  assert.equal(D.descreverAuditoria({ tabela: 'funcionarios', acao: 'UPDATE', antes: { nome: 'Ana', matricula: '', time: 'C1B', ativo: true }, depois: { nome: 'Ana', matricula: '9000001', time: 'C1B', ativo: true } }).texto, 'Alterou o cadastro de Ana (9000001): matrícula: — → 9000001');
  assert.equal(D.descreverAuditoria({ tabela: 'funcionarios', acao: 'UPDATE', antes: { nome: 'Ana', matricula: '1', time: 'C1B', ativo: true }, depois: { nome: 'Ana', matricula: '1', time: 'C1B', ativo: false } }).texto, 'Desativou Ana (1)');
  assert.equal(D.descreverAuditoria({ tabela: 'parametros', acao: 'INSERT', depois: { chave: 'hora_limite', valor: '16:00' } }).texto, 'Definiu o prazo de envio: 16:00');
  assert.equal(D.descreverAuditoria({ tabela: 'perfis', acao: 'UPDATE', antes: { usuario: 'c3b', entrada_turno: null, ativo: true }, depois: { usuario: 'c3b', entrada_turno: '15:30:00', ativo: true } }).texto, 'Definiu o horário do turno de c3b: 15:30');
});

// ---------- Importar cadastro ----------
const cab = ['姓名Name', '性别Sex', '工号Id', 'Turnos', 'Transporte', '', '工段Group', '班组Team', '岗位Position', 'Phone'];
const linhaRH = (nome, mat, time, cargo = 'Operador') => [nome, mat, 'Masculino', '2° Turno', '214', '824.211.105-72', 'Chassis', time, cargo, '71983595865'];

test('importar cadastro: acha as colunas pelo conteúdo, ignora CPF e telefone', () => {
  const r = D.interpretarPlanilha([{ nome: 'c1b', linhas: [cab, linhaRH('Renner de Lima', '9017253', 'C1B'), linhaRH('  JAQUELINE   SANTOS ', '9020359', 'c1b', 'Team Leader'), linhaRH('Sem Matricula', '', 'C1B'), ['', '', '', '', '', '', '', '', '', '']] },
    { nome: 'c6b', linhas: [cab, linhaRH('Nayana Milena', '9055898', 'EG+FPB')] }], ['C1B']);
  assert.deepEqual(r.registros.map(x => [x.nome, x.matricula, x.time, x.cargo]), [
    ['Renner de Lima', '9017253', 'C1B', 'Operador'],
    ['JAQUELINE SANTOS', '9020359', 'C1B', 'Team Leader'],   // "c1b" foi ajustado ao time que já existe
    ['Sem Matricula', '', 'C1B', 'Operador'],
    ['Nayana Milena', '9055898', 'EG+FPB', 'Operador'],
  ]);
  assert.ok(!JSON.stringify(r.registros).match(/824\.211|71983595865/));               // CPF e telefone nunca entram
  assert.ok(r.avisos.some(a => /1 pessoa\(s\) sem matrícula/.test(a)));
});

test('importar cadastro: novos, alterados, sem mudança e quem saiu da planilha', () => {
  const atuais = [
    { id: '1', nome: 'Ana Souza', matricula: '9000001', time: 'C1B', cargo: 'Operador', turno: '2° Turno', ativo: true },
    { id: '2', nome: 'Bia Lima', matricula: '', time: 'C1B', cargo: 'Operador', turno: '2° Turno', ativo: true },
    { id: '3', nome: 'Caio Reis', matricula: '9000003', time: 'C1B', cargo: 'Operador', turno: '2° Turno', ativo: true },
    { id: '4', nome: 'Duda Melo', matricula: '9000004', time: 'C1B', cargo: 'Operador', turno: '2° Turno', ativo: false },
    { id: '5', nome: 'Edu Igual', matricula: '1000040', time: 'C3B', cargo: '', turno: '', ativo: true },
    { id: '6', nome: 'Edi Igual', matricula: '1000040', time: 'C4B', cargo: '', turno: '', ativo: true },
  ];
  const novos = [
    { nome: 'ANA SOUZA', matricula: '9000001', time: 'C2B', cargo: 'Operador', turno: '2° Turno' },     // trocou de time
    { nome: 'Bia Lima', matricula: '9000002', time: 'C1B', cargo: 'Operador', turno: '2° Turno' },      // ganhou matrícula
    { nome: 'Caio Reis', matricula: '9000003', time: 'C1B', cargo: 'Operador', turno: '2° Turno' },     // igual
    { nome: 'Duda Melo', matricula: '9000004', time: 'C1B', cargo: 'Operador', turno: '2° Turno' },     // voltou
    { nome: 'Fabi Nova', matricula: '9000009', time: 'C5B', cargo: 'Operador', turno: '2° Turno' },     // nova
    { nome: 'Edu Igual', matricula: '1000040', time: 'C3B', cargo: '', turno: '' },                     // matrícula repetida: acha pelo nome
  ];
  const c = D.compararCadastro(atuais, novos);
  assert.deepEqual(c.novos.map(x => x.nome), ['Fabi Nova']);
  assert.equal(c.iguais, 2);  // Caio e Edu
  const por = id => c.alterados.find(a => a.atual.id === id);
  assert.deepEqual(por('1').mudar, { time: 'C2B' });
  assert.deepEqual(por('2').mudar, { matricula: '9000002' });
  assert.deepEqual(por('4').mudar, { ativo: true });
  assert.deepEqual(c.ausentes.map(a => a.id), ['6']);       // Edi Igual (ativo) não está na planilha
});
