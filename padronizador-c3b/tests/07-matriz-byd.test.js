// Matriz BYD (BYD_SKILL_MATRIX_V1): titularidade e treinamento pelas formas ○ △ do Excel, nível pelo marcador 1,
// cor real, origem das formas e Base Operacional. Usa a fixture estruturalmente idêntica à Matriz real
// (tests/fixtures/gerar-matriz-byd.js). O teste com o arquivo real está em 08-matriz-byd-real.test.js.
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const { S, pastaTemp } = require('./ajuda.js');
const FIX = path.join(__dirname, 'fixtures', 'Matriz_BYD_estrutura_real_sintetica.xlsx');

let r;
const reg = (nome, estacao) => r.registros.find(x => x.nome.startsWith(nome) && x.station_code === estacao);
test.before(async () => { r = await S.byd.extrair(fs.readFileSync(FIX), { arquivo: path.basename(FIX) }); });

test('BYD 1: ellipse somente → TITULAR', () => {
  const x = reg('JOÃO', 'C14 FZ1');
  assert.equal(x.assignment_status, 'TITULAR');
  assert.deepEqual([x.has_circle, x.has_triangle, x.is_current_operator, x.is_training_planned, x.is_future_holder], [true, false, true, false, false]);
});
test('BYD 2: triangle somente → EM_TREINAMENTO', () => {
  const x = reg('MARIA', 'C14 FZ1');
  assert.equal(x.assignment_status, 'EM_TREINAMENTO');
  assert.deepEqual([x.has_circle, x.has_triangle, x.is_current_operator, x.is_training_planned, x.is_future_holder], [false, true, false, true, false]);
});
test('BYD 3: ellipse + triangle no mesmo bloco → FUTURO_TITULAR', () => {
  const x = reg('CARLOS', 'C14 FZ1');
  assert.equal(x.assignment_status, 'FUTURO_TITULAR');
  assert.deepEqual([x.is_current_operator, x.is_training_planned, x.is_future_holder], [true, true, true]);
});
test('BYD 4: duas ellipses sobrepostas → um único TITULAR', () => {
  const x = reg('JOÃO', 'C16 L1');
  assert.equal(x.assignment_status, 'TITULAR'); assert.equal(x.has_circle, true);
  const marcas = r.origem.filter(o => o.purpose === 'CURRENT_OPERATOR_MARKER' && o.employee_id === x.employee_id && o.operation_id === x.operation_id);
  assert.equal(marcas.length, 2, 'as duas formas ficam registradas na origem');
  assert.equal(marcas.filter(o => o.dedup === 'DUPLICATA_SOBREPOSTA').length, 1, 'uma delas marcada como duplicata');
  assert.equal(r.registros.filter(y => y.employee_id === x.employee_id && y.operation_id === x.operation_id).length, 1);
  assert.ok(!('count_circle' in x));
});
test('BYD 5: marcador 1 → skill_level L (independente da designação)', () => {
  const ana = reg('ANA', 'C16 L1');
  assert.equal(ana.skill_level, 'L'); assert.equal(ana.assignment_status, 'SEM_DESIGNACAO');
  assert.match(ana.skill_level_source, /^MARCADOR_1:/);
  assert.equal(reg('JOÃO', 'C14 FZ1').skill_level, 'L');
});
test('BYD 6: triângulo sem marcador 1 → treinamento sem inventar L', () => {
  const maria = reg('MARIA', 'C14 FZ1'), carlos = reg('CARLOS', 'C14 FZ1');
  assert.equal(maria.skill_level, 'NAO_IDENTIFICADO'); assert.equal(carlos.skill_level, 'NAO_IDENTIFICADO');
  assert.equal(maria.skill_level_source, null);
  // exemplo pedido: João = L + TITULAR; Maria = não identificado + EM_TREINAMENTO; Carlos = não identificado + FUTURO_TITULAR
  assert.deepEqual([reg('JOÃO', 'C14 FZ1'), maria, carlos].map(x => [x.skill_level, x.assignment_status]),
    [['L', 'TITULAR'], ['NAO_IDENTIFICADO', 'EM_TREINAMENTO'], ['NAO_IDENTIFICADO', 'FUTURO_TITULAR']]);
});
test('BYD 7: leitura GREEN (FF92D050)', () => {
  const x = reg('JOÃO', 'C14 FZ1');
  assert.equal(x.fill_state, 'GREEN'); assert.equal(x.fill_rgb, 'FF92D050');
});
test('BYD 8: cor é só metadado — L amarelo ou de outra cor é simplesmente L', () => {
  const x = reg('JOÃO', 'C16 L1');
  assert.equal(x.skill_level, 'L'); assert.equal(x.fill_state, 'YELLOW'); assert.equal(x.fill_rgb, 'FFFFFF00');
  const outro = reg('PEDRO', 'C14 L1');
  assert.equal(outro.skill_level, 'L'); assert.equal(outro.fill_state, 'OTHER'); assert.equal(outro.fill_rgb, 'FF00B0F0');
  const branco = reg('MARIA', 'C14 FZ1');
  assert.equal(branco.fill_state, 'NONE'); assert.equal(branco.fill_source, 'TEMA:0', 'cor de tema resolvida (branco)');
  // a cor não participa de nada de negócio
  const semCor = r.registros.map(y => ({ ...y, fill_state: 'NONE', fill_rgb: null }));
  assert.deepEqual(semCor.filter(S.byd.ehAtual).length, r.habilidadesAtuais.length, 'habilidade atual não depende da cor');
  assert.ok(r.resumo.every(x => !Object.keys(x).some(k => /fill|verde|amarel/i.test(k))), 'resumo (KPI) sem cor');
  assert.ok(r.validacaoFinal.find(v => /cor/.test(v.item)).ok);
});
test('BYD 9: origem do Shape registrada (arquivo, nome, âncora 0-based)', () => {
  const x = reg('CARLOS', 'C14 FZ1');
  const tri = r.origem.find(o => o.purpose === 'TRAINING_MARKER' && o.employee_id === x.employee_id && o.operation_id === x.operation_id);
  assert.equal(tri.shape_type, 'triangle'); assert.equal(tri.drawing_file, 'xl/drawings/drawing1.xml'); assert.equal(tri.sheet, 'SA6H');
  assert.equal(tri.shape_name, 'Triângulo isósceles 150');
  assert.deepEqual([tri.anchor_from_row, tri.anchor_from_col, tri.anchor_to_row, tri.anchor_to_col], [8, 12, 9, 12]);
  const circ = r.origem.find(o => o.purpose === 'CURRENT_OPERATOR_MARKER' && o.employee_id === x.employee_id && o.operation_id === x.operation_id);
  assert.equal(circ.shape_type, 'ellipse');
  assert.equal(x.source_circle_anchor, 'xl/drawings/drawing1.xml#Elipse 151@M11:M11');
  assert.equal(x.source_triangle_anchor, 'xl/drawings/drawing1.xml#Triângulo isósceles 150@M9:M10');
  assert.equal(r.origem.filter(o => o.purpose === 'LEGEND_SHAPE_IGNORED').length, 2, 'legenda abaixo da grade não vira designação');
  assert.ok(r.origem.some(o => o.purpose === 'L_MARKER' && o.cell === 'E11'));
});
test('BYD 10: Base Operacional gerada, reaberta e conferida', async () => {
  const bytes = await S.byd.gerarBaseOperacional(r, {});
  const v = await S.byd.verificarBaseOperacional(bytes, r);
  assert.equal(v.ok, true, JSON.stringify(v.checks.filter(c => !c.ok)));
  const b = v.lido.abas;
  for (const c of ['assignment_status', 'has_circle', 'has_triangle', 'is_current_operator', 'is_training_planned', 'is_future_holder', 'fill_state', 'fill_rgb', 'source_circle_anchor', 'source_triangle_anchor'])
    assert.ok(c in b.HABILIDADES_ATUAIS[0], `HABILIDADES_ATUAIS.${c}`);
  for (const c of ['skill_level', 'assignment_status', 'is_current_operator', 'is_training_planned', 'is_future_holder', 'fill_state']) assert.ok(c in b.MATRIZ_LONGA[0], `MATRIZ_LONGA.${c}`);
  for (const c of ['purpose', 'shape_type', 'drawing_file', 'shape_name', 'anchor_from_row', 'anchor_from_col', 'anchor_to_row', 'anchor_to_col', 'sheet']) assert.ok(c in b.ORIGEM_MAPEAMENTO[0], `ORIGEM_MAPEAMENTO.${c}`);
  assert.equal(b.MATRIZ_LONGA.length, 48, '6 pessoas × 4 operações × 2 abas');
  assert.deepEqual(v.lido.ocultas.HABILIDADES_ATUAIS, ['fill_state', 'fill_rgb', 'fill_source', 'l_marker_raw'], 'cor só como coluna técnica oculta');
  assert.deepEqual(v.lido.ocultas.MATRIZ_LONGA, ['fill_state']);
  for (const aba of ['PESSOAS', 'TREINAMENTOS', 'VALIDACAO']) assert.ok(b[aba] && b[aba].length, aba);
  const carlos = b.HABILIDADES_ATUAIS.find(x => x.nome.startsWith('CARLOS') && x.station_code === 'C14 FZ1');
  assert.equal(carlos.assignment_status, 'FUTURO_TITULAR'); assert.equal(carlos.is_future_holder, true);
  assert.ok(b.HABILIDADES_ATUAIS.some(x => x.nome === '王伟 EXEMPLO'), 'chinês preservado');
  // gravado em disco e relido
  const st = S.armazenamento.NodeFsAdapter(pastaTemp('byd'));
  await st.createDirectory('EXPORTACOES'); await st.writeFile('EXPORTACOES/Base_Operacional_BYD.xlsx', bytes);
  assert.equal((await S.byd.verificarBaseOperacional(await st.readFile('EXPORTACOES/Base_Operacional_BYD.xlsx'), r)).ok, true);
});

test('BYD validações: combinações incomuns viram WARNING e nada é corrigido', () => {
  const cod = c => r.pendencias.filter(p => p.codigo === c);
  const ana = reg('ANA', 'C25 R1'), maria = reg('MARIA', 'C25 R1'), carlos = reg('CARLOS', 'C25 R1');
  assert.equal(cod('CIRCULO_SEM_L').length, 1); assert.equal(ana.assignment_status, 'TITULAR'); assert.equal(ana.skill_level, 'NAO_IDENTIFICADO');
  assert.equal(cod('TRIANGULO_COM_L').length, 1); assert.equal(maria.assignment_status, 'EM_TREINAMENTO'); assert.equal(maria.skill_level, 'L');
  assert.equal(cod('CIRCULO_TRIANGULO_E_L').length, 1); assert.equal(carlos.assignment_status, 'FUTURO_TITULAR'); assert.equal(carlos.skill_level, 'L');
  assert.ok(['CIRCULO_SEM_L', 'TRIANGULO_COM_L', 'CIRCULO_TRIANGULO_E_L'].every(c => cod(c)[0].severidade === 'WARNING'));
  assert.equal(reg('CARLOS', 'C14 FZ1').review_flags, null, '○+△ sem L é o caso normal de futuro titular (sem aviso)');
  assert.equal(cod('VALOR_NAO_RECONHECIDO').length, 2, 'valor desconhecido "XYZ" (SA6H e HA2H) continua virando pendência');
  assert.match(reg('PEDRO', 'C14 FZ1').unrecognized_values, /=XYZ$/);
  assert.equal(cod('FORMA_FORA_DA_GRADE').length, 1);
  assert.equal(cod('TOTAL_L_DIFERENTE').length, 1, 'resultado salvo da fórmula desatualizado é apontado; a leitura vale pelos marcadores');
  assert.equal(cod('ABA_EXEMPLO_IGNORADA').length, 1); assert.deepEqual([...new Set(r.registros.map(x => x.sheet))], ['SA6H', 'HA2H']);
});

test('BYD layout: blocos, marcador L pela fórmula, papéis, estação e datas', () => {
  const a = r.abas[0];
  assert.equal(a.layout.linhaNomes, 5); assert.equal(a.layout.linhaResumo, 25); assert.equal(a.layout.largura, 4); assert.equal(a.layout.altura, 4);
  assert.ok(a.layout.operadores.every(o => o.lMarkerFonte === 'FORMULA' && o.lMarkerCol === o.startCol + 2));
  assert.deepEqual(a.layout.operadores.map(o => o.papel), [null, null, null, null, 'TECNICO', 'LIDER']);
  const op = r.operacoes[0];
  assert.deepEqual([op.station_code, op.station_base, op.side, op.position, op.operation_id], ['C14 FZ1', 'C14', 'FZ', '1', 'SA6H-C14-FZ1-001']);
  assert.equal(op.descricao_zh, '左侧后稳定杆分装合件预紧'); assert.match(op.descricao_pt, /^A barra estabilizadora/);
  const maria = reg('MARIA', 'C14 FZ1');
  assert.equal(maria.dates_raw, '12/08/2026\n14/08/2026'); assert.equal(maria.first_date, '2026-08-12'); assert.equal(maria.latest_date, '2026-08-14');
  assert.equal(r.pessoas[0].employee_id_status, 'SEM_MATRICULA'); assert.match(r.pessoas[0].employee_id, /^EMP-SEMMATR-[0-9A-F]{8}$/);
});

test('BYD: com o Cadastro, a pessoa ganha o employee_id da matrícula', async () => {
  const r2 = await S.byd.extrair(fs.readFileSync(FIX), { pessoas: [{ employee_id: 'EMP-004512', matricula: '004512', nome: 'João Exemplo da Silva' }] });
  const j = r2.pessoas.find(o => o.nome.startsWith('JOÃO'));
  assert.equal(j.employee_id, 'EMP-004512'); assert.equal(j.employee_id_status, 'RESOLVIDO_POR_NOME');
});

test('BYD: a importação detecta a Matriz e não a trata como planilha comum', async () => {
  const s = await S.importacao.iniciar({ bytes: new Uint8Array(fs.readFileSync(FIX)), nome: 'matriz.xlsx', pacote: S.createPackage({}, 't') });
  assert.ok(s.byd); assert.equal(s.byd.perfil, 'BYD_SKILL_MATRIX_V1');
  assert.ok(s.abas.filter(a => a.byd).every(a => !a.selecionada));
  assert.equal(s.byd.resumo[0].futuros_titulares, 2);
  assert.equal(s.byd.pessoasParecidas.length, 1);
});

test('BYD: leitor independente (openpyxl) abre a Base Operacional', { skip: (() => { try { execFileSync('python3', ['-c', 'import openpyxl']); return false; } catch (e) { return 'python3/openpyxl indisponível'; } })() }, async () => {
  const arq = path.join(pastaTemp('bydpy'), 'base.xlsx');
  fs.writeFileSync(arq, await S.byd.gerarBaseOperacional(r, {}));
  const out = JSON.parse(execFileSync('python3', ['-c', `
import openpyxl, json, sys
wb = openpyxl.load_workbook(sys.argv[1]); ws = wb['HABILIDADES_ATUAIS']; h = [c.value for c in ws[1]]
rows = [dict(zip(h, [c.value for c in r])) for r in ws.iter_rows(min_row=2)]
print(json.dumps({"abas": wb.sheetnames, "meta": wb['_META'].sheet_state, "tipos": sorted({type(r['is_future_holder']).__name__ for r in rows}),
  "status": sorted({r['assignment_status'] for r in rows})}))`, arq]).toString());
  assert.deepEqual(out.tipos, ['bool']); assert.equal(out.meta, 'hidden');
  assert.deepEqual(out.status, ['EM_TREINAMENTO', 'FUTURO_TITULAR', 'SEM_DESIGNACAO', 'TITULAR']);
});

test('BYD resíduo "c": só neste perfil, no log técnico, sem pendência e sem nível', async () => {
  const pedro = reg('PEDRO', 'C14 L1');
  assert.equal(pedro.unrecognized_values, null); assert.equal(pedro.review_flags, null); assert.equal(pedro.skill_level, 'L');
  const log = r.origem.filter(o => o.purpose === 'KNOWN_RESIDUE_IGNORED');
  assert.ok(log.length >= 1 && log.every(o => o.raw_value === 'c'));
  assert.ok(!r.pendencias.some(p => /=c\b|"c"/.test(p.mensagem) && p.codigo !== 'ABA_EXEMPLO_IGNORADA'));
  // não é regra global: fora do perfil BYD, "c" continua sendo um valor desconhecido
  const m = S.aliases.criarMotor();
  assert.equal(m.normalizar('FUNCAO', 'c').status, 'UNKNOWN');
  // e o perfil deixa configurar (sem resíduos, o "c" volta a ser pendência)
  const r2 = await S.byd.extrair(fs.readFileSync(FIX), { residuosConhecidos: [] });
  assert.ok(r2.pendencias.some(p => p.codigo === 'VALOR_NAO_RECONHECIDO' && /=c\b/.test(p.mensagem)));
});

test('BYD pessoas: grafia parecida vira sugestão; só une com confirmação; depois recalcula tudo', async () => {
  // antes: 7 pessoas, 1 par sugerido, nada unido
  assert.equal(r.pessoas.length, 7);
  assert.equal(r.pessoasParecidas.length, 1);
  const par = r.pessoasParecidas[0];
  assert.deepEqual([par.a.nome, par.b.nome], ['PEDRO EXEMPLO ALVES', 'PEDRO EXEMPLO ALVSE']);
  assert.equal(r.pendencias.find(p => p.codigo === 'POSSIVEL_MESMA_PESSOA').categoria, 'PROBLEMA_DE_DADOS');
  assert.equal(r.validacaoFinal.find(v => /mesma pessoa/.test(v.item)).ok, false);
  // confirmação pelo fluxo real da importação (grava alias no pacote e reextrai)
  const pacote = S.createPackage({}, 't');
  const s = await S.importacao.iniciar({ bytes: new Uint8Array(fs.readFileSync(FIX)), nome: 'matriz.xlsx', pacote, usuario: 'lider' });
  const depois = await S.importacao.decidirPessoaBYD(s, 0, 'MESMA', { canonico: 'PEDRO EXEMPLO ALVES' });
  assert.equal(depois.pessoas.length, 6);
  const alias = pacote.config.aliases.find(a => a.entity_type === 'PESSOA');
  assert.deepEqual([alias.original_value, alias.normalized_value], ['PEDRO EXEMPLO ALVSE', 'PEDRO EXEMPLO ALVES']);
  assert.ok(pacote.config.decisoes.some(d => d.tipo === 'PESSOAS_UNIFICADAS'));
  const pedro = depois.pessoas.find(p => p.nome === 'PEDRO EXEMPLO ALVES');
  assert.equal(pedro.nomes_na_matriz, 'PEDRO EXEMPLO ALVES | PEDRO EXEMPLO ALVSE'); assert.equal(pedro.abas, 'SA6H,HA2H');
  // todas as relações com o mesmo employee_id
  const ids = new Set([...depois.registros.filter(x => /PEDRO/.test(x.nome_na_matriz)).map(x => x.employee_id),
    ...depois.origem.filter(o => o.purpose === 'OPERATOR_NAME' && /PEDRO/.test(o.raw_value)).map(o => o.employee_id)]);
  assert.deepEqual([...ids], [pedro.employee_id]);
  assert.equal(depois.registros.filter(x => x.nome === 'PEDRO EXEMPLO ALVES').length, 8, '4 operações × 2 abas');
  assert.ok(depois.validacaoFinal.every(v => v.ok), JSON.stringify(depois.validacaoFinal.filter(v => !v.ok)));
  // o alias vale na próxima importação (sem perguntar de novo)
  const prox = await S.byd.extrair(fs.readFileSync(FIX), { aliasesUsuario: pacote.config.aliases, decisoes: pacote.config.decisoes, esperado: { modelos: 2, operacoes: 8, pessoas: 6 } });
  assert.equal(prox.pessoas.length, 6); assert.equal(prox.pessoasParecidas.length, 0);
  assert.ok(prox.validacaoFinal.every(v => v.ok));
  // "pessoas diferentes" também é lembrado
  const pac2 = S.createPackage({}, 't');
  const s2 = await S.importacao.iniciar({ bytes: new Uint8Array(fs.readFileSync(FIX)), nome: 'matriz.xlsx', pacote: pac2 });
  const dif = await S.importacao.decidirPessoaBYD(s2, 0, 'DIFERENTES');
  assert.equal(dif.pessoas.length, 7); assert.equal(dif.pessoasParecidas.length, 0);
});

test('BYD pendências por categoria: configuração pendente separada de problema de dados', () => {
  const cat = c => r.pendencias.filter(p => p.categoria === c).map(p => p.codigo);
  assert.ok(cat('CONFIGURACAO_PENDENTE').includes('CONFIGURACAO_PESSOA'));
  assert.ok(cat('CONFIGURACAO_PENDENTE').includes('MODELO_DA_ABA'));
  assert.ok(!cat('PROBLEMA_DE_DADOS').includes('CONFIGURACAO_PESSOA'), 'matrícula ausente não é erro de leitura');
  for (const c of ['POSSIVEL_MESMA_PESSOA', 'VALOR_NAO_RECONHECIDO', 'FORMA_FORA_DA_GRADE', 'TOTAL_L_DIFERENTE']) assert.ok(cat('PROBLEMA_DE_DADOS').includes(c), c);
  assert.ok(cat('INFORMACAO').includes('FORMA_DUPLICADA'));
  const conf = r.pendencias.find(p => p.codigo === 'CONFIGURACAO_PESSOA' && /ANA EXEMPLO SOUZA/.test(p.mensagem));
  assert.match(conf.mensagem, /falta matrícula, função, turno/);
  assert.match(r.pendencias.find(p => p.codigo === 'CONFIGURACAO_PESSOA' && /王伟/.test(p.mensagem)).mensagem, /falta matrícula, turno/, 'função vem do papel "Líder" na Matriz');
  assert.ok(r.pessoas.every(p => p.configuracao_pendente));
});

test('BYD validação final (sanity check) com valores esperados', async () => {
  const x = await S.byd.extrair(fs.readFileSync(FIX), { esperado: { modelos: 2, operacoes: 8, pessoas: 6 } });
  const v = Object.fromEntries(x.validacaoFinal.map(i => [i.item.split(' ')[0] + (i.item.includes('única') ? 'U' : ''), i]));
  assert.equal(x.validacaoFinal.find(i => i.item === 'Pessoas únicas').ok, false, 'sem confirmar a grafia: 7 ≠ 6');
  assert.equal(x.validacaoFinal.find(i => i.item === 'Modelos').ok, true);
  assert.equal(x.validacaoFinal.find(i => i.item === 'Operações').ok, true);
  assert.ok(v);
});
