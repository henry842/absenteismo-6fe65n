// Núcleo: aliases, estações, modelos, matrícula, datas, números, IDs, Quality Score, duplicidades,
// integridade, Matriz + Histórico, conflitos e segurança de caminhos.
const test = require('node:test'), assert = require('node:assert/strict');
const U = require('../src/core/util.js'), D = require('../src/core/dicionario.js'), AL = require('../src/core/aliases.js');
const P = require('../src/core/parsers.js'), ID = require('../src/core/ids.js'), Q = require('../src/core/qualidade.js');
const DU = require('../src/core/duplicidades.js'), V = require('../src/core/validar.js'), H = require('../src/core/historico.js');
const CF = require('../src/core/conflitos.js'), M = require('../src/core/mapeamento.js');

test('aliases: turno, função e status viram o código oficial', () => {
  const m = AL.criarMotor();
  assert.equal(m.normalizar('TURNO', 'T2').normalizado, 'TURNO_2');
  assert.equal(m.normalizar('TURNO', '2º turno').normalizado, 'TURNO_2');
  assert.equal(m.normalizar('TURNO', 'segundo turno').normalizado, 'TURNO_2');
  assert.equal(m.normalizar('FUNCAO', 'OP PROD').normalizado, 'OPERADOR_PRODUCAO');
  assert.equal(m.normalizar('STATUS_PESSOA', 'ativo').normalizado, 'ATIVO');
});

test('aliases: valor desconhecido fica UNKNOWN; similaridade só sugere, não aplica', () => {
  const m = AL.criarMotor();
  const r = m.normalizar('TURNO', 'turno x');
  assert.equal(r.status, 'UNKNOWN'); assert.equal(r.normalizado, null);
  const s = m.normalizar('FUNCAO', 'Operadr de Producao');
  assert.equal(s.status, 'UNKNOWN'); assert.equal(s.normalizado, null); assert.equal(s.sugestao, 'OPERADOR_PRODUCAO');
});

test('aliases do usuário têm prioridade e podem ser desativados', () => {
  const m = AL.criarMotor();
  const a = m.adicionar('FUNCAO', 'Soldador', 'OPERADOR_PRODUCAO', 'teste');
  assert.match(a.alias_id, /^ALS-\d{5}$/);
  assert.equal(m.normalizar('FUNCAO', 'SOLDADOR').normalizado, 'OPERADOR_PRODUCAO');
  m.definirAtivo(a.alias_id, false);
  assert.equal(m.normalizar('FUNCAO', 'Soldador').status, 'UNKNOWN');
});

test('nível de habilidade diferencia i (treinamento) de I (independente)', () => {
  const m = AL.criarMotor();
  assert.equal(m.normalizar('SKILL_LEVEL', 'i').normalizado, 'i');
  assert.equal(m.normalizar('SKILL_LEVEL', 'I').normalizado, 'I');
  assert.equal(m.normalizar('SKILL_LEVEL', 'l').status, 'REVISAR');
  assert.equal(m.normalizar('SKILL_LEVEL', 'L (Proficiente)').normalizado, 'L');
  assert.deepEqual(D.NIVEIS.map(n => n.codigo), ['i', 'I', 'L', 'U']);
  assert.match(D.NIVEIS[0].definicao_pt, /treinamento/i);
  assert.match(D.NIVEIS[3].definicao_pt, /orientar/i);
});

test('modelos: grafias diferentes → código; desconhecido → UNKNOWN; admin pode adicionar', () => {
  const m = AL.criarMotor();
  assert.equal(m.normalizar('MODELO', 'SA 6H').normalizado, 'SA6H');
  assert.equal(m.normalizar('MODELO', 'sa-2h').normalizado, 'SA2H');
  assert.equal(m.normalizar('MODELO', 'XYZ9').status, 'UNKNOWN');
  m.adicionarModelo('XYZ9');
  assert.equal(m.normalizar('MODELO', 'xyz 9').normalizado, 'XYZ9');
});

test('estações: variações de escrita', () => {
  const casos = { 'C16L': ['C16', 'L', null], 'C16 L1': ['C16', 'L', '1'], 'C16-L1': ['C16', 'L', '1'], 'C18 FR1': ['C18', 'FR', '1'], 'C20FZ2': ['C20', 'FZ', '2'] };
  for (const [e, [b, l, p]] of Object.entries(casos)) {
    const r = P.parseEstacao(e);
    assert.equal(r.status, 'OK', e); assert.equal(r.station_base, b); assert.equal(r.side, l); assert.equal(r.position, p);
  }
  const esq = P.parseEstacao('C16 Esquerda');
  assert.equal(esq.side, 'L'); assert.equal(esq.status, 'REVISAR');
  assert.equal(P.parseEstacao('XYZ').status, 'UNKNOWN');
});

test('matrícula é sempre texto e preserva zeros à esquerda', () => {
  assert.deepEqual(P.parseMatricula('001234'), { valor: '001234', status: 'OK', avisoNumero: false });
  assert.equal(P.parseMatricula(777, { textoFormatado: '000777', eraNumero: true }).valor, '000777');
  const n = P.parseMatricula(1234, { eraNumero: true });
  assert.equal(typeof n.valor, 'string'); assert.equal(n.avisoNumero, true);
});

test('datas: ISO, dd/mm, serial do Excel, formato chinês e ambiguidade', () => {
  assert.equal(U.parseData('15/04/2026').valor, '2026-04-15');
  assert.equal(U.parseData('03/04/2026').status, 'AMBIGUO');
  assert.equal(U.parseData('03/04/2026', { formatoColuna: 'DMY' }).status, 'OK');
  assert.equal(U.parseData(46000).regra, 'EXCEL_SERIAL');
  assert.equal(U.parseData('2026年4月15日').valor, '2026-04-15');
  assert.equal(U.parseData('abc').valor, null);
});

test('números: unidade, vírgula decimal; vazio é null e não 0', () => {
  assert.deepEqual(U.parseNumero('25 N·m'), { valor: 25, status: 'OK', unidade: 'N·m' });
  assert.equal(U.parseNumero('12,5').valor, 12.5);
  assert.equal(U.parseNumero('').valor, null);
  assert.equal(U.parseNumero('abc').valor, null);
});

test('texto: acentos e chinês preservados na comparação', () => {
  assert.equal(U.dobrar('Operação Ção!'), 'operacao cao');
  assert.equal(U.dobrar('工序 名称'), '工序 名称');
});

test('IDs estáveis e determinísticos', () => {
  assert.equal(ID.employeeId('001234'), 'EMP-001234');
  assert.equal(ID.stationId('SA6H', 'C16'), 'SA6H-C16');
  const reg = ID.registroOperacoes();
  const a = reg.obter({ model_id: 'SA6H', station_base: 'C16', side: 'L', position: '1', codigo_operacao: 'OP-101' });
  const b = reg.obter({ model_id: 'SA6H', station_base: 'C16', side: 'L', position: '1', codigo_operacao: 'op 101' });
  const c = reg.obter({ model_id: 'SA6H', station_base: 'C16', side: 'L', position: '1', codigo_operacao: 'OP-102' });
  assert.equal(a.operation_id, 'SA6H-C16-L1-001'); assert.equal(b.operation_id, a.operation_id); assert.equal(c.operation_id, 'SA6H-C16-L1-002');
  // IDs existentes continuam e a sequência segue do maior
  const reg2 = ID.registroOperacoes({ existentes: [{ operation_id: 'SA6H-C16-L1-007', model_id: 'SA6H', estacao: 'C16', lado: 'L', posicao: '1', codigo_operacao: 'OP-101' }] });
  assert.equal(reg2.obter({ model_id: 'SA6H', station_base: 'C16', side: 'L', position: '1', codigo_operacao: 'OP-101' }).operation_id, 'SA6H-C16-L1-007');
  assert.equal(reg2.obter({ model_id: 'SA6H', station_base: 'C16', side: 'L', position: '1', codigo_operacao: 'OP-555' }).operation_id, 'SA6H-C16-L1-008');
  const ev = { employee_id: 'EMP-1', operation_id: 'OP', event_type: 'MUDANCA_NIVEL', previous_level: 'i', new_level: 'I', event_date: '2026-04-15' };
  assert.equal(ID.eventId(ev), ID.eventId({ ...ev })); assert.match(ID.eventId(ev), /^EVT-20260415-[0-9A-F]{10}$/);
  const cont = {};
  assert.match(ID.batchId(cont), /^IMPORT-\d{8}-001$/); assert.match(ID.batchId(cont), /-002$/);
});

test('Quality Score: reprodutível, com os pesos documentados e sem nota para base vazia', () => {
  assert.equal(Q.PESOS.reduce((t, p) => t + p[2], 0), 100);
  assert.equal(Q.calcularQualidade('PEOPLE', []).status, 'NAO_INICIADO');
  assert.equal(Q.calcularQualidade('PEOPLE', null).status, 'AUSENTE');
  const bom = [{ employee_id: 'EMP-1', matricula: '1', nome: 'A', funcao: 'LIDER', equipe: 'C3B', turno: 'TURNO_2', status: 'ATIVO', data_integracao: '2026-01-01' }];
  const q1 = Q.calcularQualidade('PEOPLE', bom), q2 = Q.calcularQualidade('PEOPLE', JSON.parse(JSON.stringify(bom)));
  assert.equal(q1.nota, q2.nota); assert.equal(q1.nota, 100); assert.equal(q1.status, 'VALIDO');
  const ruim = bom.concat([{ ...bom[0], nome: null, turno: 'UNKNOWN' }]);
  const q3 = Q.calcularQualidade('PEOPLE', ruim);
  assert.ok(q3.nota < 100); assert.notEqual(q3.status, 'VALIDO');
});

test('duplicidade de operações: pontuação por componente e limites', () => {
  const a = { operation_id: 'A', model_id: 'SA6H', estacao: 'C16', lado: 'L', posicao: '1', codigo_operacao: null, descricao_pt: 'Torque parafuso suporte dianteiro', torque: 25, soquete: '13 mm' };
  const b = { operation_id: 'B', model_id: 'SA6H', estacao: 'C16', lado: 'L', posicao: '1', codigo_operacao: null, descricao_pt: 'Aperto suporte dianteiro', torque: 25, soquete: '13mm' };
  const c = { ...b, operation_id: 'C', descricao_pt: 'Conexão da tubulação', torque: null, soquete: null };
  const ab = DU.compararOperacoes(a, b), ac = DU.compararOperacoes(a, c);
  assert.ok(ab.geral >= 75, 'parecidas'); assert.equal(ab.componentes.caracteristicas, 100);
  assert.ok(ac.geral <= 60, 'descrições diferentes não podem passar de 60%'); assert.ok(ac.bloqueios.includes('descrições diferentes'));
  const pares = DU.encontrarDuplicidades([a, b, c]);
  assert.equal(pares.length, 1);
  const r = DU.aplicarDecisao([a, b, c], pares[0], 'MESMA', { usuario: 't' });
  assert.equal(r.operacoes.length, 2); assert.equal(r.alias.entity_type, 'OPERACAO'); assert.equal(r.decisao.tipo, 'OPERACOES_UNIFICADAS');
  const d = DU.aplicarDecisao([a, b, c], pares[0], 'DIFERENTES');
  assert.equal(d.operacoes.length, 3);
  assert.equal(DU.encontrarDuplicidades([a, b, c], { decisoes: [d.decisao] }).length, 0, 'decisão "diferentes" não volta a perguntar');
});

test('integridade referencial: referência inexistente é BLOCKING', () => {
  const bases = { PEOPLE: [{ employee_id: 'EMP-1' }], OPERATIONS: [{ operation_id: 'OP-1' }], SKILLS: [{ skill_record_id: 'S', employee_id: 'EMP-2', operation_id: 'OP-1' }], HISTORY: [], TRAINING: [], ATTENDANCE: [] };
  const iss = V.validarPacote(bases);
  assert.equal(iss.length, 1); assert.equal(iss[0].severidade, 'BLOCKING'); assert.equal(iss[0].campo, 'employee_id');
  bases.PEOPLE.push({ employee_id: 'EMP-2' });
  assert.equal(V.validarPacote(bases).length, 0);
});

test('Matriz + Histórico: registrar atualiza a matriz e acrescenta evento; repetir não duplica', () => {
  const pacote = { bases: { SKILLS: [], HISTORY: [] } };
  const m = { employee_id: 'EMP-1', operation_id: 'OP-1', new_level: 'i', event_date: '2026-03-02', responsible_name: 'Líder' };
  const r1 = H.registrarHabilidade(pacote, m);
  assert.equal(r1.evento.event_type, 'NOVA_HABILIDADE'); assert.equal(pacote.bases.SKILLS[0].skill_level, 'i');
  const r2 = H.registrarHabilidade(pacote, { ...m, new_level: 'I', event_date: '2026-04-15' });
  assert.equal(r2.evento.event_type, 'MUDANCA_NIVEL'); assert.equal(r2.evento.previous_level, 'i'); assert.equal(pacote.bases.SKILLS[0].skill_level, 'I');
  assert.equal(pacote.bases.HISTORY.length, 2);
  const antes = JSON.stringify(pacote.bases.HISTORY);
  const r3 = H.anexarEventos(pacote.bases.HISTORY, [r1.evento, r2.evento]);
  assert.equal(r3.adicionados, 0); assert.equal(r3.repetidos, 2); assert.equal(JSON.stringify(pacote.bases.HISTORY), antes, 'histórico é só de acréscimo');
  assert.throws(() => H.registrarHabilidade(pacote, { ...m, new_level: 'X' }), /Nível inválido/);
});

test('conflitos 3 vias: campo mudado nos dois lados vira conflito; um lado só é mesclado', () => {
  const base = [{ employee_id: 'E1', turno: 'TURNO_1', funcao: 'LIDER' }, { employee_id: 'E2', turno: 'TURNO_1', funcao: 'LIDER' }];
  const excel = [{ employee_id: 'E1', turno: 'TURNO_2', funcao: 'LIDER' }, { employee_id: 'E2', turno: 'TURNO_2', funcao: 'LIDER' }];
  const sistema = [{ employee_id: 'E1', turno: 'TURNO_3', funcao: 'LIDER' }, { employee_id: 'E2', turno: 'TURNO_3', funcao: 'SUPERVISOR' }];
  const r = CF.detectarConflitos(base, excel, sistema, 'employee_id');
  assert.equal(r.conflitos.length, 2);
  assert.equal(r.mesclado.find(x => x.employee_id === 'E2').funcao, 'SUPERVISOR');
  const dec = { [r.conflitos[0].conflito_id]: 'EXCEL' };
  const res = CF.resolverConflitos(r.mesclado, r.conflitos, dec, 'employee_id', { aplicarSemelhantes: true });
  assert.equal(res.pendentes.length, 0, 'decisão aplicada ao conflito semelhante');
  assert.ok(res.registros.every(x => x.turno === 'TURNO_2'));
});

test('comparação de versões e soft delete (nunca apaga)', () => {
  const antes = [{ employee_id: 'E1', status: 'ATIVO' }, { employee_id: 'E2', status: 'ATIVO' }];
  const novo = [{ employee_id: 'E1', status: 'FERIAS' }, { employee_id: 'E3', status: 'ATIVO' }];
  const c = CF.compararVersoes(antes, novo, 'employee_id');
  assert.deepEqual([c.adicionados.length, c.alterados.length, c.ausentesNoNovo.length], [1, 1, 1]);
  const manter = CF.aplicarComparacao('PEOPLE', antes, c, { ausentes: 'MANTER' });
  assert.equal(manter.length, 3); assert.equal(manter.find(x => x.employee_id === 'E2').status, 'ATIVO');
  const desat = CF.aplicarComparacao('PEOPLE', antes, c, { ausentes: 'DESATIVAR' });
  assert.equal(desat.length, 3); assert.equal(desat.find(x => x.employee_id === 'E2').status, 'INATIVO');
});

test('LGPD: CPF, telefone, endereço e nascimento são reconhecidos como não utilizados', () => {
  assert.equal(M.campoNaoUtilizado('CPF'), 'CPF');
  assert.equal(M.campoNaoUtilizado('Celular'), 'TELEFONE');
  assert.equal(M.campoNaoUtilizado('Endereço'), 'ENDERECO');
  assert.equal(M.campoNaoUtilizado('Data Nasc.'), 'NASCIMENTO');
  assert.equal(M.campoNaoUtilizado('Nome'), null);
});

test('caminhos: bloqueia path traversal e limpa caracteres proibidos', () => {
  assert.throws(() => U.caminhoSeguro('C3B/../../etc'), /não permitido/);
  assert.throws(() => U.caminhoSeguro('..'), /não permitido/);
  assert.equal(U.caminhoSeguro('C3B', 'BACKUP', 'x:y*.xlsx'), 'C3B/BACKUP/x_y_.xlsx');
});

test('dicionário: 7 bases + manifesto, cada uma com arquivo e chave', () => {
  assert.equal(D.SCHEMAS.length, 8);
  for (const s of D.SCHEMAS) { assert.match(s.arquivo, /^0\d_.+_C3B\.xlsx$/); assert.ok(s.master_mode); }
  assert.equal(D.schema('HISTORY').master_mode, 'APPEND_ONLY');
  assert.ok(D.linhasDicionario().length > 60);
  assert.ok(D.usosDoCampo('employee_id').length >= 5);
});
