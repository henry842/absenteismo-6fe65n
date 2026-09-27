// Cenário de ponta a ponta obrigatório (seção 79 da especificação), sem mocks, gravando em disco real.
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('fs'), path = require('path');
const { S, fixture, pastaTemp } = require('./ajuda.js');
const IMP = S.importacao;

test('E2E: planilha não padronizada → bases oficiais → reabrir → diagnóstico', async (t) => {
  const raiz = pastaTemp('e2e'), st = S.armazenamento.NodeFsAdapter(raiz), PASTA = 'C3B';
  const pacote = S.createPackage({ empresa: 'BYD', unidade: 'Camaçari', area: 'Montagem', equipe: 'C3B' }, 'implantador');
  const e = {};

  await t.test('1. importar planilha não padronizada', async () => {
    e.s = await IMP.iniciar({ bytes: fixture('Controle_de_Revezamento_C3B_sintetico.xlsx'), nome: 'Controle_de_Revezamento_C3B_sintetico.xlsx', pacote, usuario: 'implantador' });
    assert.ok(!e.s.erro); assert.equal(e.s.lote.estado, 'MAPPED'); assert.match(e.s.lote.import_batch_id, /^IMPORT-\d{8}-\d{3}$/);
  });
  await t.test('2. detectar aba', () => {
    assert.deepEqual(e.s.abas.filter(a => a.selecionada).map(a => a.nome), ['Operadores', 'Operações']);
    assert.ok(e.s.abas.find(a => a.nome === 'Escala').motivoIgnorada);
  });
  await t.test('3. detectar schema', () => {
    assert.equal(e.s.abas.find(a => a.nome === 'Operadores').schema, 'PEOPLE');
    assert.equal(e.s.abas.find(a => a.nome === 'Operações').schema, 'OPERATIONS');
  });
  await t.test('4. mapear cabeçalhos', () => {
    const tp = IMP.mapear(e.s, 'Operadores', 'PEOPLE'), to = IMP.mapear(e.s, 'Operações', 'OPERATIONS');
    assert.equal(tp.mapeamento.find(m => m.cabecalho === 'Matrícula 工号').campo, 'matricula');
    assert.equal(tp.mapeamento.find(m => m.cabecalho === 'Telefone').decisao, 'NAO_UTILIZADO');
    assert.equal(to.mapeamento.find(m => m.cabecalho === 'Estação').campo, 'estacao');
    assert.ok(S.dicionario.camposMapeaveis('PEOPLE').filter(c => c.required).every(c => tp.mapeamento.some(m => m.campo === c.field_id) || c.field_id === 'status'));
    IMP.definirValorFixo(e.s, 'Operadores', 'status', 'ATIVO');
  });
  await t.test('5. normalizar valores', async () => {
    e.rp = await IMP.processar(e.s, 'Operadores');
    e.ro = await IMP.processar(e.s, 'Operações');
    const joao = e.rp.oficiais.find(p => p.matricula === '004512');
    assert.equal(joao.funcao, 'OPERADOR_PRODUCAO'); assert.equal(joao.turno, 'TURNO_2');
    assert.equal(e.rp.oficiais.find(p => p.nome === '王伟').matricula, '000777');
    assert.equal(e.ro.oficiais[0].model_id, 'SA6H'); assert.equal(e.ro.oficiais[0].estacao, 'C16');
  });
  await t.test('6. encontrar campo desconhecido', () => {
    const ana = e.rp.oficiais.find(p => p.matricula === '004601');
    assert.equal(ana.funcao, 'UNKNOWN');
    e.pend = S.relatorios.naoReconhecidos(e.rp.log.map(l => ({ aba: 'Operadores', ...l })));
    assert.ok(e.pend.some(g => g.original === 'OP. MONTAGEM ESPECIAL'));
  });
  await t.test('7. solicitar decisão', () => {
    const iss = e.rp.issues.find(i => i.codigo === 'VALOR_NAO_RECONHECIDO' && i.valor === 'OP. MONTAGEM ESPECIAL');
    assert.ok(iss); assert.match(iss.comoResolver, /Normalização/);
  });
  await t.test('8. salvar alias', async () => {
    IMP.decidirValor(e.s, 'Operadores', 'funcao', 'OP. MONTAGEM ESPECIAL', { acao: 'CORRIGIR', valor: 'OPERADOR_PRODUCAO', criarAlias: true });
    e.rp = await IMP.processar(e.s, 'Operadores');
    assert.equal(e.rp.oficiais.find(p => p.matricula === '004601').funcao, 'OPERADOR_PRODUCAO');
    assert.ok(pacote.config.aliases.some(a => a.entity_type === 'FUNCAO' && a.original_value === 'OP. MONTAGEM ESPECIAL'));
  });
  await t.test('9. detectar duplicidade', () => {
    assert.equal(e.ro.duplicidades.length, 1);
    const d = e.ro.duplicidades[0];
    assert.ok(d.geral >= 75); assert.equal(d.componentes.estacao, 100);
  });
  await t.test('10. resolver', () => {
    const antes = e.s.trabalhos['Operações'].resultado.oficiais.length;
    const r = IMP.decidirDuplicidade(e.s, 'Operações', 0, 'MESMA');
    assert.equal(e.s.trabalhos['Operações'].resultado.oficiais.length, antes - 1);
    assert.ok(pacote.config.aliases.some(a => a.entity_type === 'OPERACAO' && a.normalized_value === r.mantida));
  });
  await t.test('11. calcular Quality Score', () => {
    const q = e.s.trabalhos['Operadores'].resultado.qualidade;
    assert.ok(q.nota > 0 && q.nota <= 100); assert.equal(q.componentes.length, 7);
    assert.equal(q.componentes.reduce((s, c) => s + c.peso, 0), 100);
  });
  await t.test('12. validar referências', async () => {
    const p = IMP.previa(e.s);
    assert.equal(p.bloqueado, false);
    IMP.confirmar(e.s, {});
    assert.equal(e.s.lote.estado, 'COMPLETED');
    // segunda importação: histórico por colaborador referencia pessoas e operações já no pacote
    const h = await IMP.iniciar({ bytes: fixture('Ficha_Historico_Habilidades_sintetico.xlsx'), nome: 'Ficha.xlsx', pacote, usuario: 'implantador' });
    const v = h.abas.find(a => a.virtual);
    IMP.mapear(h, v.nome, 'HISTORY');
    await IMP.processar(h, v.nome);
    const ph = IMP.previa(h);
    assert.equal(ph.contagem.BLOCKING, 0, JSON.stringify(ph.issues.filter(i => i.severidade === 'BLOCKING').map(i => i.mensagem)));
    IMP.confirmar(h, {});
    assert.equal(pacote.bases.HISTORY.length, 7);
    assert.deepEqual(S.validatePackage(pacote.bases), []);
    // referência quebrada é BLOCKING
    const quebrado = JSON.parse(JSON.stringify(pacote.bases)); quebrado.HISTORY[0].employee_id = 'EMP-INEXISTENTE';
    assert.equal(S.validatePackage(quebrado)[0].severidade, 'BLOCKING');
  });
  await t.test('13. gerar XLSX', async () => {
    e.g = await S.createInstallation(st, PASTA, null, { pacote, usuario: 'implantador' });
    assert.equal(e.g.ok, true, e.g.erro);
    for (const r of e.g.resultados) assert.ok(r.etapas.every(x => x.ok || x.pulado), r.schemaId);
  });
  await t.test('14. reabrir XLSX', async () => {
    e.lido = await S.readOfficialWorkbook(fs.readFileSync(path.join(raiz, PASTA, '01_Cadastro_Equipe_C3B.xlsx')));
    assert.equal(e.lido.schemaId, 'PEOPLE');
  });
  await t.test('15. validar conteúdo', async () => {
    assert.equal(e.lido.registros.length, pacote.bases.PEOPLE.length);
    assert.equal(e.lido.registros.find(r => r.nome === '王伟').matricula, '000777');
    for (const id of ['PEOPLE', 'OPERATIONS', 'HISTORY']) {
      const b = fs.readFileSync(path.join(raiz, PASTA, S.dicionario.schema(id).arquivo));
      assert.equal((await S.verifyWorkbook(new Uint8Array(b), id, pacote.bases[id])).ok, true, id);
    }
  });
  await t.test('16. gerar Manifesto', async () => {
    const m = await S.readOfficialWorkbook(fs.readFileSync(path.join(raiz, PASTA, '00_Manifesto_C3B.xlsx')));
    assert.equal(m.schemaId, 'MANIFEST'); assert.equal(m.manifesto.installation_id, pacote.manifesto.installation_id);
    assert.equal(m.arquivos.length, 7);
    assert.ok(m.arquivos.filter(a => a.base_id === 'PEOPLE')[0].hash);
  });
  await t.test('17. fechar', () => { e.id = pacote.manifesto.installation_id; e.contagens = Object.fromEntries(Object.entries(pacote.bases).map(([k, v]) => [k, v.length])); });
  await t.test('18. abrir novamente', async () => {
    e.c = await S.loadInstallation(S.armazenamento.NodeFsAdapter(raiz), PASTA);
    assert.deepEqual(Object.fromEntries(Object.entries(e.c.pacote.bases).map(([k, v]) => [k, v.length])), e.contagens);
    assert.ok(e.c.pacote.config.aliases.length >= 2, 'aliases persistidos em 07_Configuracoes');
  });
  await t.test('19. reconhecer instalação', () => {
    assert.equal(e.c.pacote.manifesto.installation_id, e.id);
    assert.equal(e.c.pacote.manifesto.empresa, 'BYD');
  });
  await t.test('20. mostrar diagnóstico correto', async () => {
    const d = await S.diagnoseInstallation(S.armazenamento.NodeFsAdapter(raiz), PASTA);
    assert.equal(d.reconhecida, true); assert.deepEqual(d.ausentes, []);
    const b = id => d.bases.find(x => x.schema === id);
    assert.equal(b('PEOPLE').registros, e.contagens.PEOPLE);
    assert.equal(b('SKILLS').status, 'NAO_INICIADO');
    assert.equal(b('HISTORY').status, 'PARCIAL', 'histórico de 3 de 6 colaboradores é parcial');
    assert.ok(b('PEOPLE').alertas.every(a => !/fora do Padronizador/.test(a.texto)), 'hash confere com o Manifesto');
    assert.ok(d.saude.nota > 0);
  });
});
