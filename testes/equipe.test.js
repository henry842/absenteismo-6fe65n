// Aba Equipe do líder: vínculo lançamento↔pessoa, KPIs do perfil e cadastro de colaborador novo. Só dados inventados.
const test = require('node:test');
const assert = require('node:assert/strict');
const D = require('../lideres.js');

const HOJE = '2026-09-30';                       // quarta-feira
const lanc = (data, tipo, nome, matricula, extra) => Object.assign({ id: `${data}|${nome}|${tipo}`, data, time: 'T1', tipo, nome, matricula, motivo: 'Sem justificativa', justificativa: '' }, extra);
const ana = { id: 'f1', nome: 'Ana Exemplo Prado', matricula: '1000001', cargo: 'Operador', turno: '2° Turno', ativo: true };
const bia = { id: 'f2', nome: 'Bia Modelo Reis', matricula: '', cargo: 'Operador', turno: '2° Turno', ativo: true };
const caio = { id: 'f3', nome: 'Caio Teste Lima', matricula: '1000003', cargo: 'Suporte', turno: '2° Turno', ativo: true };

test('iniciais: primeira e última palavra, sem espaço sobrando', () => {
  assert.equal(D.iniciais('Maria Souza Lima'), 'ML');
  assert.equal(D.iniciais('  joão   da silva '), 'JS');
  assert.equal(D.iniciais('Prado'), 'P');
  assert.equal(D.iniciais('   '), '?');
  assert.equal(D.iniciais(null), '?');
});

test('lançamentos por pessoa: a matrícula manda; sem matrícula vale o nome (sem acento nem maiúscula)', () => {
  const lancs = [
    lanc('2026-09-29', 'ausencia', 'Ana Exemplo Prado', '1000001'),
    lanc('2026-09-30', 'atraso', 'ANA EXEMPLO PRADO', ''),              // digitado sem matrícula: ainda é a Ana
    lanc('2026-09-30', 'ausencia', 'Ana Exemplo Prado', '2222222'),    // mesmo nome, outra matrícula: outra pessoa
    lanc('2026-09-30', 'ausencia', 'Bía Modelo Reis', '7777777'),      // a Bia não tem matrícula: vale o nome
    lanc('2026-09-30', 'saida', 'Fulano Qualquer', '9999999'),
  ];
  const m = D.lancamentosPorPessoa([ana, bia, caio], lancs);
  assert.deepEqual(m.get('f1').map(l => l.tipo).sort(), ['atraso', 'ausencia']);
  assert.ok(!m.get('f1').some(l => l.matricula === '2222222'));
  assert.equal(m.get('f2').length, 1);
  assert.equal(m.get('f3').length, 0);
});

test('lançamentos por pessoa: listas vazias não quebram', () => {
  assert.equal(D.lancamentosPorPessoa([], null).size, 0);
  assert.deepEqual(D.lancamentosPorPessoa([ana], undefined).get('f1'), []);
});

test('situação no dia: ausente vence atraso, que vence saída; nada = sem ocorrência', () => {
  assert.equal(D.situacaoNoDia([]), null);
  assert.equal(D.situacaoNoDia(undefined), null);
  assert.deepEqual(D.situacaoNoDia([{ tipo: 'saida' }]), { tipo: 'saida', rotulo: 'Saiu mais cedo' });
  assert.deepEqual(D.situacaoNoDia([{ tipo: 'atraso', hora_chegada: null }, { tipo: 'saida' }]), { tipo: 'andamento', rotulo: 'Em atraso' });
  assert.deepEqual(D.situacaoNoDia([{ tipo: 'atraso', hora_chegada: '08:10:00' }]), { tipo: 'andamento', rotulo: 'Atrasou' });
  assert.deepEqual(D.situacaoNoDia([{ tipo: 'atraso' }, { tipo: 'ausencia' }]), { tipo: 'falta', rotulo: 'Ausente' });
});

test('dias com movimento: dia enviado ou com lançamento conta uma vez; respeita o período', () => {
  const lancs = [lanc('2026-09-30', 'ausencia', 'A', '1'), lanc('2026-09-30', 'atraso', 'B', '2'), lanc('2026-09-28', 'ausencia', 'A', '1'), lanc('2026-06-01', 'ausencia', 'A', '1')];
  const envios = [{ data: '2026-09-30', efetivo: 20 }, { data: '2026-09-29', efetivo: 20 }];
  assert.equal(D.diasComMovimento(lancs, envios, HOJE, 30), 3);   // 28, 29 e 30
  assert.equal(D.diasComMovimento(lancs, envios, HOJE, 0), 4);    // tudo: junho também
  assert.equal(D.diasComMovimento(lancs, envios, HOJE, 1), 1);    // só hoje
  assert.equal(D.diasComMovimento(null, null, HOJE, 30), 0);
});

test('KPIs: sem histórico suficiente o % fica em branco, mas as contagens aparecem', () => {
  const k = D.kpisDaPessoa([lanc(HOJE, 'ausencia', 'Ana Exemplo Prado', '1000001')], 1, HOJE, 30);
  assert.equal(k.taxa, null); assert.equal(k.taxaValida, false);
  assert.equal(k.ausencias, 1); assert.equal(k.diasAusente, 1); assert.equal(k.diasBase, 1);
  assert.equal(k.diasSemFaltar, 0);
});

test('KPIs: taxa = dias com ausência ou atraso ÷ dias com movimento; saída não entra na conta', () => {
  const o = [
    lanc('2026-09-28', 'ausencia', 'Ana', '1', { motivo: 'Atestado médico' }),
    lanc('2026-09-29', 'atraso', 'Ana', '1', { motivo: 'Atraso roteiro', hora_prevista: '14:00:00', hora_chegada: '14:20:00' }),
    lanc('2026-09-30', 'saida', 'Ana', '1', { motivo: 'Saúde', hora_saida: '17:00:00' }),
    lanc('2026-09-22', 'atraso', 'Ana', '1', { motivo: 'Atraso roteiro', hora_prevista: '14:00:00', hora_chegada: '14:40:00' }),
  ];
  const k = D.kpisDaPessoa(o, 10, HOJE, 30);
  assert.equal(k.ausencias, 1); assert.equal(k.atrasos, 2); assert.equal(k.saidas, 1);
  assert.equal(k.diasAusente, 3);                       // ausência + 2 atrasos; a saída não conta
  assert.equal(k.taxa, 30); assert.equal(k.presentes, 7);
  assert.equal(k.atrasoMinutos, 60); assert.equal(k.atrasoMedia, 30);
  assert.equal(k.diasSemFaltar, 1);                     // última falta/atraso: dia 29
  assert.equal(k.ultima.data, '2026-09-29');
  assert.equal(k.motivos[0].motivo, 'Atraso roteiro'); assert.equal(k.motivos[0].n, 2);
  assert.equal(k.historico.length, 4);
  assert.deepEqual(k.historico.map(l => l.data), ['2026-09-30', '2026-09-29', '2026-09-28', '2026-09-22']);   // mais recente primeiro
});

test('KPIs: atraso ainda sem hora de chegada conta, mas não entra na média de minutos', () => {
  const o = [lanc(HOJE, 'atraso', 'Ana', '1', { hora_prevista: '14:00:00', hora_chegada: null })];
  const k = D.kpisDaPessoa(o, 6, HOJE, 30);
  assert.equal(k.atrasos, 1); assert.equal(k.diasAusente, 1); assert.equal(k.atrasoMedia, null); assert.equal(k.atrasoMinutos, 0);
});

test('KPIs: o período corta o que é mais velho (30 dias) e "tudo" traz tudo', () => {
  const o = [lanc('2026-09-30', 'ausencia', 'Ana', '1'), lanc('2026-09-01', 'ausencia', 'Ana', '1'), lanc('2026-08-31', 'ausencia', 'Ana', '1')];   // 30 dias: de 01/09 a 30/09
  assert.equal(D.kpisDaPessoa(o, 10, HOJE, 30).ausencias, 2);      // 31/08 já é o 31º dia para trás
  assert.equal(D.kpisDaPessoa(o, 10, HOJE, 0).ausencias, 3);
  assert.equal(D.kpisDaPessoa(o, 10, HOJE, 90).ausencias, 3);
});

test('KPIs: sem nenhuma ocorrência, a pessoa nunca faltou no período', () => {
  const k = D.kpisDaPessoa([], 12, HOJE, 30);
  assert.equal(k.taxa, 0); assert.equal(k.diasAusente, 0); assert.equal(k.presentes, 12);
  assert.equal(k.ultima, null); assert.equal(k.diasSemFaltar, null); assert.equal(k.motivos.length, 0); assert.equal(k.diaTopo, null);
  assert.equal(k.historico.length, 0);
});

test('KPIs: dia da semana que mais se repete só aparece com 2 ou mais ocorrências', () => {
  const seg = ['2026-09-14', '2026-09-21', '2026-09-28'].map(d => lanc(d, 'ausencia', 'Ana', '1'));
  const k = D.kpisDaPessoa(seg.concat(lanc('2026-09-30', 'atraso', 'Ana', '1', { hora_prevista: '14:00', hora_chegada: '14:05' })), 15, HOJE, 30);
  assert.deepEqual(k.diaTopo, { dia: 1, nome: 'segunda-feira', n: 3 });
  assert.equal(k.semana[1], 3); assert.equal(k.semana[3], 1);
  assert.equal(D.kpisDaPessoa([seg[0], lanc('2026-09-30', 'ausencia', 'Ana', '1')], 15, HOJE, 30).diaTopo, null);
});

test('KPIs: várias ocorrências no mesmo dia contam um dia só', () => {
  const o = [lanc('2026-09-30', 'atraso', 'Ana', '1', { hora_prevista: '14:00', hora_chegada: '14:30' }), lanc('2026-09-30', 'ausencia', 'Ana', '1')];
  assert.equal(D.kpisDaPessoa(o, 6, HOJE, 30).diasAusente, 1);
});

test('KPIs: percentuais dos motivos somam 100', () => {
  const o = ['Atestado médico', 'Atestado médico', 'Férias', 'Sem justificativa'].map((m, i) => lanc('2026-09-2' + (i + 1), 'ausencia', 'Ana', '1', { motivo: m }));
  const k = D.kpisDaPessoa(o, 8, HOJE, 30);
  assert.equal(k.motivos[0].motivo, 'Atestado médico');
  assert.equal(Math.round(k.motivos.reduce((s, m) => s + m.pct, 0)), 100);
});

test('valor mais comum do time (para já vir preenchido no cadastro)', () => {
  assert.equal(D.valorMaisComum([ana, bia, caio], 'cargo', 'X'), 'Operador');
  assert.equal(D.valorMaisComum([], 'turno', '2° Turno'), '2° Turno');
  assert.equal(D.valorMaisComum([{ turno: '' }], 'turno', 'P'), 'P');
});

test('cadastro: nome obrigatório e com cara de nome', () => {
  assert.match(D.validarNovoColaborador({ nome: '' }, []).erro, /nome/i);
  assert.match(D.validarNovoColaborador({ nome: '  ' }, []).erro, /nome/i);
  assert.match(D.validarNovoColaborador({ nome: 'A' }, []).erro, /completo/);
  assert.match(D.validarNovoColaborador({ nome: '12345' }, []).erro, /completo/);
  assert.match(D.validarNovoColaborador({ nome: 'x'.repeat(121) }, []).erro, /longo/);
});

test('cadastro: arruma os espaços e deixa só números na matrícula', () => {
  const r = D.validarNovoColaborador({ nome: '  Dora   Nova  Souza ', matricula: ' 10-000 0a9 ', cargo: ' Operador ', turno: '2° Turno' }, []);
  assert.equal(r.erro, ''); assert.equal(r.aviso, '');
  assert.deepEqual(r.dados, { nome: 'Dora Nova Souza', matricula: '1000009', cargo: 'Operador', turno: '2° Turno' });
});

test('cadastro: matrícula é opcional, mas não pode repetir a de quem já está no time', () => {
  assert.equal(D.validarNovoColaborador({ nome: 'Dora Nova Souza', matricula: '' }, [ana]).erro, '');
  const r = D.validarNovoColaborador({ nome: 'Dora Nova Souza', matricula: '1000001' }, [ana]);
  assert.match(r.erro, /1000001 já é de Ana Exemplo Prado/);
  // quem foi desligado (inativo) não trava a matrícula
  assert.equal(D.validarNovoColaborador({ nome: 'Dora Nova Souza', matricula: '1000001' }, [Object.assign({}, ana, { ativo: false })]).erro, '');
});

test('cadastro: nome igual ao de alguém do time pede confirmação (pode ser homônimo)', () => {
  const r = D.validarNovoColaborador({ nome: 'ANA exemplo prado', matricula: '5555555' }, [ana]);
  assert.equal(r.erro, '');
  assert.match(r.aviso, /Já existe Ana Exemplo Prado \(matrícula 1000001\)/);
  assert.equal(D.validarNovoColaborador({ nome: 'Bia Modelo Reis' }, [bia]).aviso.includes('matrícula'), false);
});

test('cadastro: campos com tamanho demais são recusados antes de ir ao banco', () => {
  assert.match(D.validarNovoColaborador({ nome: 'Dora Nova', cargo: 'c'.repeat(61) }, []).erro, /Cargo/);
  assert.match(D.validarNovoColaborador({ nome: 'Dora Nova', turno: 't'.repeat(31) }, []).erro, /Turno/);
  assert.match(D.validarNovoColaborador({ nome: 'Dora Nova', matricula: '1'.repeat(21) }, []).erro, /Matrícula/);
});

test('cadastro: o time tem limite de colaboradores (o banco também trava)', () => {
  const muitos = Array.from({ length: D.MAX_COLABORADORES }, (_, i) => ({ id: 'x' + i, nome: 'Pessoa ' + i, matricula: String(1000000 + i), ativo: true }));
  assert.match(D.validarNovoColaborador({ nome: 'Dora Nova' }, muitos).erro, /limite/);
  assert.equal(D.validarNovoColaborador({ nome: 'Dora Nova' }, muitos.slice(1)).erro, '');
});

test('início da pessoa: o dia em que entrou no sistema, ou o primeiro lançamento se for mais antigo', () => {
  const entrou = { criado_em: '2026-09-20T15:00:00Z' };
  assert.equal(D.inicioDaPessoa(entrou, []), '2026-09-20');
  assert.equal(D.inicioDaPessoa(entrou, [lanc('2026-09-10', 'ausencia', 'A', '1'), lanc('2026-09-25', 'ausencia', 'A', '1')]), '2026-09-10');
  assert.equal(D.inicioDaPessoa({}, [lanc('2026-09-25', 'ausencia', 'A', '1')]), '2026-09-25');
  assert.equal(D.inicioDaPessoa({ criado_em: 'lixo' }, []), '');
  assert.equal(D.inicioDaPessoa(null, null), '');
});

test('dias com movimento: quem entrou depois só conta os dias desde que entrou', () => {
  const lancs = [lanc('2026-09-30', 'ausencia', 'A', '1'), lanc('2026-09-22', 'ausencia', 'B', '2')];
  const envios = [{ data: '2026-09-29', efetivo: 5 }, { data: '2026-09-25', efetivo: 5 }];
  assert.equal(D.diasComMovimento(lancs, envios, HOJE, 30), 4);
  assert.equal(D.diasComMovimento(lancs, envios, HOJE, 30, '2026-09-29'), 2);      // 29 e 30
  assert.equal(D.diasComMovimento(lancs, envios, HOJE, 30, '2026-08-01'), 4);      // entrou antes do período: não muda nada
  assert.equal(D.diasComMovimento(lancs, envios, HOJE, 0, '2026-09-25'), 3);
});

test('perfil de quem acabou de ser cadastrado: sem histórico, sem % e sem "presente" inventado', () => {
  const nova = { id: 'n', nome: 'Dora Nova', matricula: '5', criado_em: '2026-09-30T15:00:00Z' };
  const lancs = [lanc('2026-09-30', 'ausencia', 'Outra Pessoa', '9')];
  const envios = [1, 2, 3, 4, 5, 6, 7, 8].map(n => ({ data: '2026-09-' + String(30 - n).padStart(2, '0'), efetivo: 5 }));
  const base = D.diasComMovimento(lancs, envios, HOJE, 30, D.inicioDaPessoa(nova, []));
  const k = D.kpisDaPessoa([], base, HOJE, 30);
  assert.equal(base, 1); assert.equal(k.taxa, null); assert.equal(k.presentes, 1); assert.equal(k.diasAusente, 0);
});

// ---- Travas: a aba Equipe do líder só lê e cadastra; nunca altera nem apaga lançamento ou colaborador ----
const fs = require('node:fs');
const path = require('node:path');
const RAIZ = path.join(__dirname, '..');

test('aba Equipe (painel.js): as únicas escritas no banco são o cadastro de colaborador e a leitura do histórico', () => {
  const src = fs.readFileSync(path.join(RAIZ, 'painel.js'), 'utf8');
  const ini = src.indexOf('LÍDER · EQUIPE'), fim = src.indexOf('//  SUPERVISOR');
  assert.ok(ini > 0 && fim > ini, 'marcadores do bloco não achados');
  const bloco = src.slice(ini, fim);
  assert.doesNotMatch(bloco, /\.(update|delete|upsert|rpc)\(/, 'o bloco da Equipe não pode alterar, apagar nem chamar funções do banco');
  const escritas = bloco.match(/\.insert\(/g) || [];
  assert.equal(escritas.length, 1, 'só um insert (o cadastro)');
  assert.match(bloco, /supa\.from\('funcionarios'\)\.insert\(/);
  assert.doesNotMatch(bloco, /from\('(lancamentos|envios)'\)\.(insert|update|delete|upsert)/);
  assert.match(bloco, /time: perfil\.time/, 'o cadastro vai sempre para o time do próprio líder');
});

test('migração do cadastro pelo líder: só INSERT, no próprio time, pessoa ativa; sem regra de alterar ou apagar', () => {
  const sql = fs.readFileSync(path.join(RAIZ, 'banco/migracoes/20260930c_lider_cadastra_colaborador.sql'), 'utf8');
  const politicas = sql.match(/create policy [\s\S]*?;/gi) || [];
  assert.equal(politicas.length, 1);
  assert.match(politicas[0], /for insert/i);
  assert.match(politicas[0], /papel_atual\(\) = 'lider'/);
  assert.match(politicas[0], /"time" = public\.time_atual\(\)/);
  assert.match(politicas[0], /and ativo/);
  assert.doesNotMatch(sql, /for (update|delete|all)\b/i);
  const foraDoTeste = sql.slice(0, sql.indexOf('do $teste$'));   // o teste embutido tenta alterar e apagar de propósito (e desfaz tudo no fim)
  assert.ok(foraDoTeste.length > 200);
  assert.doesNotMatch(foraDoTeste, /^\s*(delete|update|truncate|drop table|alter table)\b/im, 'a migração não mexe em dados nem em tabelas');
  assert.match(sql, /raise exception 'FIM_DO_TESTE'/, 'o teste embutido desfaz tudo no fim');
});
