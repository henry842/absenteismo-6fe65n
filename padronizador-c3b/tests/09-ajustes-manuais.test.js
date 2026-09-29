// Camada de Ajustes Manuais C3B: MATRIZ ORIGINAL → base importada → AJUSTES MANUAIS → VALOR EFETIVO → C3B.
// A base importada nunca é editada; cada ajuste guarda origem, novo valor, motivo, responsável e data, pode ser
// desfeito e sobrevive a uma nova leitura da Matriz. Usa a fixture BYD e uma variante "Matriz v2" gerada na hora.
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('fs'), path = require('path');
const { S, pastaTemp } = require('./ajuda.js');
const GER = require('./fixtures/gerar-matriz-byd.js');
const FIX = path.join(__dirname, 'fixtures', 'Matriz_BYD_estrutura_real_sintetica.xlsx');
const AJ = S.ajustes;

let r, r2, motor;
const pessoa = nome => r.pessoas.find(p => p.nome.startsWith(nome));
const op = estacao => r.operacoes.find(o => o.sheet === 'SA6H' && o.station_code === estacao);
const reg = (res, emp, opId) => res.registros.find(x => x.source_employee_id === emp && x.operation_id === opId);
const novo = () => AJ.novoEstado();
const AGORA = '2026-09-20T10:00:00.000Z';

test.before(async () => {
  r = await S.byd.extrair(fs.readFileSync(FIX), { arquivo: 'matriz_v1.xlsx' });
  // v2: a Matriz oficial foi atualizada — ANA recebeu o marcador 1 (L) em C25 R1
  const saida = path.join(pastaTemp('matriz-v2'), 'matriz_v2.xlsx');
  await GER.gerar({ saida, marcadoresL: [[3, 2]] });
  r2 = await S.byd.extrair(fs.readFileSync(saida), { arquivo: 'matriz_v2.xlsx' });
  motor = S.aliases.criarMotor({});
});

test('AJ 1: editar pessoa (matrícula, turno, função) sem tocar na base importada', () => {
  const e = novo(), ana = pessoa('ANA');
  const antes = JSON.stringify(r);
  const o = AJ.criarAjuste(e, r, { tipo: 'PESSOA', employee_id: ana.employee_id, field: 'matricula', new_value: '9001', reason: 'cadastro do RH', created_by: 'lider' }, { agora: AGORA });
  AJ.criarAjuste(e, r, { tipo: 'PESSOA', employee_id: ana.employee_id, field: 'turno', new_value: '2º turno', reason: 'escala', created_by: 'lider' }, { motor, agora: AGORA });
  AJ.criarAjuste(e, r, { tipo: 'PESSOA', employee_id: ana.employee_id, field: 'funcao', new_value: 'operador', reason: 'cadastro', created_by: 'lider' }, { motor, agora: AGORA });
  assert.equal(JSON.stringify(r), antes, 'a extração da Matriz (base importada) não muda');
  assert.deepEqual([o.override_id, o.entity_type, o.action, o.original_value, o.new_value, o.reason, o.created_by, o.created_at, o.active],
    ['OVR-00001', 'PERSON', 'UPDATE', null, '9001', 'cadastro do RH', 'lider', AGORA, true]);
  const ef = AJ.aplicar(r, e), p = ef.pessoas.find(x => x.source_employee_id === ana.employee_id);
  assert.equal(p.matricula, '9001'); assert.equal(p.turno, 'TURNO_2', 'turno normalizado pelo Dicionário');
  assert.equal(p.employee_id, 'EMP-9001', 'matrícula informada por ajuste gera o ID oficial');
  assert.equal(p.source_employee_id, ana.employee_id);
  const habs = ef.registros.filter(x => x.source_employee_id === ana.employee_id);
  assert.ok(habs.length > 0 && habs.every(x => x.employee_id === 'EMP-9001' && x.matricula === '9001'), 'todas as habilidades da pessoa seguem o novo ID');
});

test('AJ 2: remover habilidade não apaga — cria REMOVE e o valor efetivo fica SEM_REGISTRO', () => {
  const e = novo(), joao = pessoa('JOÃO'), o14 = op('C14 FZ1');
  const o = AJ.criarAjuste(e, r, { tipo: 'HABILIDADE', employee_id: joao.employee_id, operation_id: o14.operation_id, field: 'registro', reason: 'Registro incorreto', created_by: 'lider' }, { agora: AGORA });
  assert.deepEqual([o.action, o.original_value, o.new_value, o.scope], ['REMOVE', 'COM_REGISTRO', 'SEM_REGISTRO', 'LOCAL']);
  const x = reg(AJ.aplicar(r, e), joao.employee_id, o14.operation_id);
  assert.equal(x.desconsiderado, true); assert.equal(x.skill_level, 'SEM_REGISTRO');
  assert.equal(x.source_skill_level, 'L'); assert.equal(x.source_assignment_status, 'TITULAR', 'fonte original preservada');
  assert.equal(x.source_block, r.registros.find(y => y.employee_id === joao.employee_id && y.operation_id === o14.operation_id).source_block);
  assert.equal(x.origem_efetiva, 'MATRIZ+AJUSTE');
  const res = AJ.aplicar(r, e).resumo.find(s => s.sheet === 'SA6H'), base = r.resumo.find(s => s.sheet === 'SA6H');
  assert.equal(res.nivel_L, base.nivel_L - 1, 'KPIs usam o valor efetivo'); assert.equal(res.titulares, base.titulares - 1);
  assert.throws(() => AJ.criarAjuste(e, r, { tipo: 'HABILIDADE', employee_id: joao.employee_id, operation_id: o14.operation_id, field: 'registro', reason: 'de novo' }), /Não há registro efetivo/);
});

test('AJ 3: adicionar habilidade e corrigir a operação vinculada', () => {
  const e = novo(), pedro = pessoa('PEDRO EXEMPLO ALVES'), maria = pessoa('MARIA');
  const alvo = op('C16 L1');
  const add = AJ.criarAjuste(e, r, { tipo: 'HABILIDADE', employee_id: pedro.employee_id, operation_id: alvo.operation_id, field: 'skill_level', new_value: 'I', reason: 'avaliado hoje' }, { agora: AGORA });
  assert.equal(add.action, 'ADD');
  let x = reg(AJ.aplicar(r, e), pedro.employee_id, alvo.operation_id);
  assert.equal(x.skill_level, 'I'); assert.equal(x.source_skill_level, 'NAO_IDENTIFICADO');
  // Maria: habilidade lançada em C14 FZ1 por engano, era C14 L1
  const de = op('C14 FZ1'), para = op('C14 L1');
  const mv = AJ.criarAjuste(e, r, { tipo: 'HABILIDADE', employee_id: maria.employee_id, operation_id: de.operation_id, field: 'operation_id', new_value: para.operation_id, reason: 'operação errada' }, { agora: AGORA });
  const ef = AJ.aplicar(r, e);
  x = reg(ef, maria.employee_id, para.operation_id);
  assert.equal(x.assignment_status, 'EM_TREINAMENTO'); assert.equal(x.source_operation_id, de.operation_id); assert.equal(x.station_code, 'C14 L1');
  assert.equal(reg(ef, maria.employee_id, de.operation_id), undefined, 'não fica duplicada na operação antiga');
  assert.equal(mv.original_value, de.operation_id);
  // colisão: João já tem habilidade em C16 L1
  const joao = pessoa('JOÃO');
  assert.throws(() => AJ.criarAjuste(e, r, { tipo: 'HABILIDADE', employee_id: joao.employee_id, operation_id: de.operation_id, field: 'operation_id', new_value: op('C16 L1').operation_id, reason: 'x' }), /já tem habilidade/);
});

test('AJ 4: validações — motivo obrigatório, nível/designação/enum inválidos, i ≠ I', () => {
  const e = novo(), ana = pessoa('ANA'), o = op('C14 L1').operation_id;
  const h = (extra) => ({ tipo: 'HABILIDADE', employee_id: ana.employee_id, operation_id: o, field: 'skill_level', new_value: 'L', reason: 'ok', ...extra });
  assert.throws(() => AJ.criarAjuste(e, r, h({ reason: '  ' })), /motivo/);
  assert.throws(() => AJ.criarAjuste(e, r, h({ new_value: 'X' })), /Nível inválido/);
  assert.throws(() => AJ.criarAjuste(e, r, h({ new_value: 'l' })), /Nível inválido/, 'l minúsculo não é L');
  assert.throws(() => AJ.criarAjuste(e, r, h({ field: 'assignment_status', new_value: 'CHEFE' })), /Designação inválida/);
  assert.throws(() => AJ.criarAjuste(e, r, h({ operation_id: 'NAO-EXISTE' })), /não existe/);
  assert.throws(() => AJ.criarAjuste(e, r, { tipo: 'PESSOA', employee_id: ana.employee_id, field: 'turno', new_value: 'turno da lua', reason: 'x' }, { motor }), /Dicionário/);
  assert.throws(() => AJ.criarAjuste(e, r, { tipo: 'PESSOA', employee_id: ana.employee_id, field: 'nome', new_value: 'X', reason: 'x', scope: 'OFICIAL' }), /habilidades/);
  assert.equal(e.overrides.length, 0, 'nada é gravado quando a validação falha');
  AJ.criarAjuste(e, r, h({ new_value: 'i' }));
  assert.equal(reg(AJ.aplicar(r, e), ana.employee_id, o).skill_level, 'i');
});

test('AJ 5: desfazer e histórico — o ajuste fica inativo e o valor volta ao da Matriz', () => {
  const e = novo(), joao = pessoa('JOÃO'), o = op('C14 FZ1').operation_id;
  const a = AJ.criarAjuste(e, r, { tipo: 'HABILIDADE', employee_id: joao.employee_id, operation_id: o, field: 'assignment_status', new_value: 'FUTURO_TITULAR', reason: 'vai assumir', created_by: 'lider' }, { agora: AGORA });
  const b = AJ.criarAjuste(e, r, { tipo: 'HABILIDADE', employee_id: joao.employee_id, operation_id: o, field: 'assignment_status', new_value: 'EM_TREINAMENTO', reason: 'corrigido', created_by: 'lider' }, { agora: AGORA });
  assert.equal(e.overrides.find(x => x.override_id === a.override_id).active, false, 'um ajuste ativo por campo; o anterior é substituído, não apagado');
  assert.match(e.overrides.find(x => x.override_id === a.override_id).close_reason, /SUBSTITUIDO/);
  assert.equal(reg(AJ.aplicar(r, e), joao.employee_id, o).assignment_status, 'EM_TREINAMENTO');
  AJ.desfazer(e, b.override_id, { por: 'lider' });
  const x = reg(AJ.aplicar(r, e), joao.employee_id, o);
  assert.equal(x.assignment_status, 'TITULAR'); assert.equal(x.override_ids, null); assert.equal(x.origem_efetiva, 'MATRIZ');
  assert.deepEqual(AJ.historico(e, joao.employee_id).map(l => l.evento), ['CRIADO', 'SUBSTITUIDO', 'CRIADO', 'DESFEITO']);
  assert.equal(e.overrides.length, 2, 'histórico completo: nada é apagado');
  assert.throws(() => AJ.desfazer(e, b.override_id), /já está inativo/);
});

test('AJ 6: alteração oficial (I → L) vai para o Histórico oficial pendente na Matriz; desfazer gera estorno', () => {
  const e = novo(), ana = pessoa('ANA'), o = op('C25 R1').operation_id;
  const a = AJ.criarAjuste(e, r, { tipo: 'HABILIDADE', employee_id: ana.employee_id, operation_id: o, field: 'skill_level', new_value: 'L', reason: 'certificada', created_by: 'lider', scope: 'OFICIAL' }, { agora: AGORA });
  assert.equal(a.scope, 'OFICIAL');
  assert.equal(e.historico_oficial.length, 1);
  const ev = e.historico_oficial[0];
  assert.deepEqual([ev.event_type, ev.previous_value, ev.new_value, ev.status_matriz, ev.responsible], ['MUDANCA_NIVEL', 'NAO_IDENTIFICADO', 'L', 'PENDENTE_NA_MATRIZ', 'lider']);
  assert.match(ev.alvo_matriz, /^SA6H!/, 'diz onde mudar na Matriz oficial');
  assert.throws(() => AJ.criarAjuste(e, r, { tipo: 'HABILIDADE', employee_id: ana.employee_id, operation_id: o, field: 'observacao', new_value: 'x', reason: 'x', scope: 'OFICIAL' }), /oficial/);
  const e2 = JSON.parse(JSON.stringify(e));
  AJ.desfazer(e2, a.override_id, { por: 'lider' });
  assert.deepEqual(e2.historico_oficial.map(h => [h.event_type, h.status_matriz]), [['MUDANCA_NIVEL', 'ESTORNADO'], ['ESTORNO', 'NAO_SE_APLICA']]);
});

test('AJ 7: ajustes sobrevivem à releitura da Matriz; quando a Matriz passa a dizer o mesmo → "não é mais necessário"', () => {
  const e = novo(), ana = pessoa('ANA'), joao = pessoa('JOÃO'), o = op('C25 R1').operation_id;
  const oficial = AJ.criarAjuste(e, r, { tipo: 'HABILIDADE', employee_id: ana.employee_id, operation_id: o, field: 'skill_level', new_value: 'L', reason: 'certificada', scope: 'OFICIAL' }, { agora: AGORA });
  const local = AJ.criarAjuste(e, r, { tipo: 'PESSOA', employee_id: joao.employee_id, field: 'matricula', new_value: '7001', reason: 'RH' }, { agora: AGORA });
  assert.deepEqual(AJ.reconciliar(r, e), [], 'na mesma Matriz nada a revisar');
  // Matriz v2 relida: ANA agora tem o marcador 1 em C25 R1
  assert.equal(r2.registros.find(x => x.employee_id === ana.employee_id && x.operation_id === o).skill_level, 'L');
  const ef2 = AJ.aplicar(r2, e);
  assert.equal(ef2.pessoas.find(p => p.source_employee_id === joao.employee_id).matricula, '7001', 'o ajuste local continua valendo depois da releitura');
  const rec = AJ.reconciliar(r2, e);
  assert.equal(rec.length, 1);
  assert.equal(rec[0].override_id, oficial.override_id); assert.equal(rec[0].situacao, 'NAO_MAIS_NECESSARIO');
  assert.match(rec[0].mensagem, new RegExp(`${oficial.override_id} não é mais necessário`));
  // [Manter ajuste]: não pergunta de novo enquanto a Matriz não mudar
  const em = JSON.parse(JSON.stringify(e));
  AJ.manter(em, oficial.override_id, rec[0].fonte_atual, { por: 'lider' });
  assert.deepEqual(AJ.reconciliar(r2, em), []);
  assert.equal(AJ.ativos(em).length, 2);
  // [Encerrar ajuste]: passa a valer a Matriz e o evento oficial fica APLICADO_NA_MATRIZ
  AJ.encerrar(e, oficial.override_id, { por: 'lider', motivo: 'NAO_MAIS_NECESSARIO' });
  assert.equal(e.historico_oficial[0].status_matriz, 'APLICADO_NA_MATRIZ');
  const x = reg(AJ.aplicar(r2, e), ana.employee_id, o);
  assert.equal(x.skill_level, 'L'); assert.equal(x.origem_efetiva, 'MATRIZ'); assert.equal(local.active, true);
  // Matriz mudou para outro valor / pessoa sumiu
  const e3 = novo();
  AJ.criarAjuste(e3, r, { tipo: 'HABILIDADE', employee_id: ana.employee_id, operation_id: o, field: 'skill_level', new_value: 'U', reason: 'x' }, { agora: AGORA });
  assert.equal(AJ.reconciliar(r2, e3)[0].situacao, 'FONTE_MUDOU');
  const semAna = { ...r2, pessoas: r2.pessoas.filter(p => p.employee_id !== ana.employee_id) };
  assert.equal(AJ.reconciliar(semAna, e3)[0].situacao, 'ORFAO');
});

test('AJ 8: Base Operacional traz AJUSTES_MANUAIS, LOG, HISTORICO_OFICIAL, CONFIGURACAO, SYNC_STATE e valor efetivo × fonte', async () => {
  const e = novo(), joao = pessoa('JOÃO'), ana = pessoa('ANA'), o14 = op('C14 FZ1').operation_id;
  AJ.criarAjuste(e, r, { tipo: 'HABILIDADE', employee_id: joao.employee_id, operation_id: o14, field: 'registro', reason: 'Registro incorreto', created_by: 'lider' }, { agora: AGORA });
  AJ.criarAjuste(e, r, { tipo: 'HABILIDADE', employee_id: ana.employee_id, operation_id: op('C25 R1').operation_id, field: 'skill_level', new_value: 'L', reason: 'certificada', created_by: 'lider', scope: 'OFICIAL' }, { agora: AGORA });
  AJ.criarAjuste(e, r, { tipo: 'PESSOA', employee_id: ana.employee_id, field: 'matricula', new_value: '9001', reason: 'RH', created_by: 'lider' }, { agora: AGORA });
  const bytes = await S.byd.gerarBaseOperacional(r, { ajustes: e });
  const v = await S.byd.verificarBaseOperacional(bytes, r, { ajustes: e });
  assert.equal(v.ok, true, JSON.stringify(v.checks.filter(c => !c.ok)));
  assert.ok(v.checks.find(c => c.nome === 'Ajustes manuais preservados').ok);
  const lido = await S.byd.lerBaseOperacional(bytes);
  for (const aba of ['AJUSTES_MANUAIS', 'LOG_AJUSTES', 'HISTORICO_OFICIAL', 'CONFIGURACAO', 'SYNC_STATE']) assert.ok(lido.abas[aba], aba);
  assert.deepEqual(Object.keys(lido.abas.AJUSTES_MANUAIS[0]).slice(0, 12),
    ['override_id', 'employee_id', 'operation_id', 'entity_type', 'field', 'action', 'original_value', 'new_value', 'reason', 'created_by', 'created_at', 'active']);
  assert.equal(lido.abas.AJUSTES_MANUAIS.length, 3); assert.equal(lido.abas.HISTORICO_OFICIAL[0].status_matriz, 'PENDENTE_NA_MATRIZ');
  const h = lido.abas.HABILIDADES_ATUAIS.find(x => x.operation_id === o14 && String(x.source_skill_level) === 'L' && String(x.skill_level) === 'SEM_REGISTRO');
  assert.ok(h, 'linha removida aparece com fonte original e valor efetivo');
  assert.ok(lido.abas.HABILIDADES_ATUAIS.some(x => x.employee_id === 'EMP-9001'), 'ID efetivo por matrícula');
  // os ajustes voltam da Base para o estado (ex.: projeto novo carregando uma Base anterior)
  const e2 = await S.byd.lerAjustesDaBase(bytes);
  assert.equal(e2.overrides.length, 3); assert.equal(e2.log.length, 3); assert.equal(e2.historico_oficial.length, 1); assert.equal(e2.seq, 3);
  assert.deepEqual(AJ.aplicar(r, e2).registros.map(x => [x.employee_id, x.operation_id, x.skill_level, x.assignment_status]),
    AJ.aplicar(r, e).registros.map(x => [x.employee_id, x.operation_id, x.skill_level, x.assignment_status]));
  const o = AJ.criarAjuste(e2, r, { tipo: 'PESSOA', employee_id: joao.employee_id, field: 'observacao', new_value: 'x', reason: 'x' });
  assert.equal(o.override_id, 'OVR-00004', 'a numeração continua de onde parou');
});

test('AJ 9: ajustes ficam no 07_Configuracoes da instalação (AJUSTES_MANUAIS / LOG_AJUSTES / HISTORICO_OFICIAL)', async () => {
  const raiz = pastaTemp('aj-inst'), st = S.armazenamento.NodeFsAdapter(raiz);
  const { pacote } = await S.createInstallation(st, 'C3B', { empresa: 'BYD' }, { usuario: 't' });
  const e = novo(), ana = pessoa('ANA');
  AJ.criarAjuste(e, r, { tipo: 'HABILIDADE', employee_id: ana.employee_id, operation_id: op('C25 R1').operation_id, field: 'skill_level', new_value: 'L', reason: 'certificada', created_by: 'lider', scope: 'OFICIAL' }, { agora: AGORA });
  AJ.criarAjuste(e, r, { tipo: 'PESSOA', employee_id: ana.employee_id, field: 'nome', new_value: 'ANA EXEMPLO DE SOUZA', reason: 'grafia', created_by: 'lider' }, { agora: AGORA });
  AJ.desfazer(e, 'OVR-00002', { por: 'lider', agora: AGORA });
  pacote.config.ajustes = e;
  const w = await S.writePackage(st, 'C3B', pacote, { modo: 'ATUALIZAR', bases: [] });
  assert.ok(w.ok, w.erro);
  const c = await S.loadInstallation(st, 'C3B');
  const lidos = c.pacote.config.ajustes;
  assert.equal(lidos.overrides.length, 2); assert.equal(lidos.log.length, 3); assert.equal(lidos.historico_oficial.length, 1);
  assert.deepEqual(lidos.overrides.map(o => [o.override_id, o.active, o.scope, o.new_value]), [['OVR-00001', true, 'OFICIAL', 'L'], ['OVR-00002', false, 'LOCAL', 'ANA EXEMPLO DE SOUZA']]);
  assert.equal(reg(AJ.aplicar(r, lidos), ana.employee_id, op('C25 R1').operation_id).skill_level, 'L');
});
