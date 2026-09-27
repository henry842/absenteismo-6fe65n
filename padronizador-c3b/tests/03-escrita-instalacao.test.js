// Geração real de .xlsx (reaberto pelo ExcelJS e por um leitor independente, openpyxl), instalação em disco,
// backups que nunca sobrescrevem, versões, rollback, diagnóstico, perfis, configurações e edição em massa.
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const { S, pastaTemp, importar } = require('./ajuda.js');
const W = require('../src/excel/escritor.js'), INST = require('../src/features/instalacao.js');
const disco = raiz => S.armazenamento.NodeFsAdapter(raiz);

const pessoas = [
  { employee_id: 'EMP-001234', matricula: '001234', nome: 'João Conceição', funcao: 'LIDER', equipe: 'C3B', turno: 'TURNO_2', status: 'ATIVO', data_integracao: '2024-03-12', observacao: null, updated_at: '2026-09-27T10:00:00Z', updated_by: 't', source: 'teste' },
  { employee_id: 'EMP-000777', matricula: '000777', nome: '王伟', funcao: 'OPERADOR_PRODUCAO', equipe: 'C3B', turno: 'TURNO_2', status: 'ATIVO', data_integracao: null, observacao: '中文备注', updated_at: '2026-09-27T10:00:00Z', updated_by: 't', source: 'teste' },
];

let python = true;
try { execFileSync('python3', ['-c', 'import openpyxl']); } catch (e) { python = false; }

test('gera .xlsx oficial e verifica relendo (matrícula texto, datas, chinês, _META, DICIONARIO)', async () => {
  const bytes = await S.generateOfficialWorkbook('PEOPLE', pessoas, { data_version: 3, installation_id: 'C3B-INST-TESTE' });
  const v = await S.verifyWorkbook(bytes, 'PEOPLE', pessoas);
  assert.equal(v.ok, true, JSON.stringify(v.checks.filter(c => !c.ok)));
  const lido = await S.readOfficialWorkbook(bytes);
  assert.equal(lido.schemaId, 'PEOPLE'); assert.equal(+lido.meta.data_version, 3);
  assert.equal(lido.registros[1].matricula, '000777'); assert.equal(lido.registros[1].nome, '王伟');
  assert.equal(lido.registros[0].nome, 'João Conceição');
  // verificação detecta adulteração
  const outro = pessoas.map(p => ({ ...p, nome: p.nome + ' X' }));
  assert.equal((await S.verifyWorkbook(bytes, 'PEOPLE', outro)).ok, false);
});

test('leitor independente (openpyxl) abre o arquivo gerado', { skip: !python && 'python3/openpyxl indisponível' }, async () => {
  const dir = pastaTemp('py');
  const arq = path.join(dir, '01.xlsx');
  fs.writeFileSync(arq, await S.generateOfficialWorkbook('PEOPLE', pessoas, { data_version: 1 }));
  const out = execFileSync('python3', ['-c', `
import openpyxl, json, sys
wb = openpyxl.load_workbook(sys.argv[1])
ws = wb.worksheets[0]
hdr = [c.value for c in ws[1]]
col = hdr.index('matricula') + 1
dcol = hdr.index('data_integracao') + 1
print(json.dumps({"abas": wb.sheetnames, "matr": [ws.cell(r, col).value for r in (2, 3)], "tipo_matr": type(ws.cell(3, col).value).__name__,
  "data": str(ws.cell(2, dcol).value), "freeze": ws.freeze_panes, "filtro": ws.auto_filter.ref, "validacoes": len(ws.data_validations.dataValidation),
  "meta_oculta": wb['_META'].sheet_state, "nome": ws.cell(3, hdr.index('nome') + 1).value}, ensure_ascii=False))
`, arq]).toString();
  const r = JSON.parse(out);
  assert.deepEqual(r.matr, ['001234', '000777']); assert.equal(r.tipo_matr, 'str');
  assert.match(r.data, /^2024-03-12/); assert.match(r.freeze, /^[AB]2$/); assert.ok(r.filtro);
  assert.ok(r.validacoes >= 1); assert.equal(r.meta_oculta, 'hidden'); assert.equal(r.nome, '王伟');
  assert.ok(r.abas.includes('DICIONARIO'));
});

test('instalação: cria os 8 arquivos e pastas, relê e verifica cada um', async () => {
  const raiz = pastaTemp('inst'), st = disco(raiz);
  const r = await S.createInstallation(st, 'C3B', { empresa: 'BYD', unidade: 'Camaçari', equipe: 'C3B' }, { usuario: 't' });
  assert.equal(r.ok, true, r.erro);
  const arquivos = fs.readdirSync(path.join(raiz, 'C3B')).sort();
  for (const s of S.dicionario.SCHEMAS) assert.ok(arquivos.includes(s.arquivo), s.arquivo);
  for (const p of ['BACKUP', 'EXPORTACOES', 'RELATORIOS', 'LOGS']) assert.ok(arquivos.includes(p));
  for (const res of r.resultados) {
    assert.ok(res.etapas.find(e => e.etapa === 'Reler e verificar').ok);
    assert.equal(res.etapas.find(e => e.etapa === 'Backup').pulado, true, 'sem arquivo anterior o backup é marcado como não aplicável');
  }
  const d = await S.diagnoseInstallation(st, 'C3B');
  assert.equal(d.reconhecida, true); assert.equal(d.installation_id, r.pacote.manifesto.installation_id);
  assert.equal(d.ausentes.length, 0);
});

test('regravar: faz backup antes, versão sobe, backups nunca sobrescritos, log em LOGS', async () => {
  const raiz = pastaTemp('bkp'), st = disco(raiz);
  const { pacote } = await S.createInstallation(st, 'C3B', { empresa: 'BYD' }, {});
  pacote.bases.PEOPLE = pessoas;
  for (let i = 0; i < 3; i++) { const r = await S.writePackage(st, 'C3B', pacote, { modo: 'ATUALIZAR', bases: ['PEOPLE'] }); assert.ok(r.ok, r.erro); }
  const backups = fs.readdirSync(path.join(raiz, 'C3B', 'BACKUP')).filter(f => f.startsWith('01_'));
  assert.equal(backups.length, 3); assert.equal(new Set(backups).size, 3);
  const versoes = await S.listVersions(st, 'C3B', 'PEOPLE');
  assert.deepEqual(versoes.map(v => v.versao), [1, 2, 3, 4]); assert.equal(versoes.at(-1).atual, true);
  assert.ok(fs.readdirSync(path.join(raiz, 'C3B', 'LOGS')).length >= 3);
  assert.ok(pacote.logs.some(l => l.acao === 'GRAVAR_BASE' && l.backup));
});

test('rollback: restaura versão antiga como nova versão, com backup do atual', async () => {
  const raiz = pastaTemp('rb'), st = disco(raiz);
  const { pacote } = await S.createInstallation(st, 'C3B', { empresa: 'BYD' }, {});
  pacote.bases.PEOPLE = [pessoas[0]];
  await S.writePackage(st, 'C3B', pacote, { modo: 'ATUALIZAR', bases: ['PEOPLE'] });          // v2: 1 pessoa
  pacote.bases.PEOPLE = pessoas;
  await S.writePackage(st, 'C3B', pacote, { modo: 'ATUALIZAR', bases: ['PEOPLE'] });          // v3: 2 pessoas
  const v = await S.listVersions(st, 'C3B', 'PEOPLE');
  const v2 = v.find(x => x.versao === 2);
  const cmp = await S.compareFiles(st, v2.arquivo, v.at(-1).arquivo);
  assert.equal(cmp.adicionados.length, 1);
  const r = await S.restoreVersion(st, 'C3B', pacote, 'PEOPLE', v2.arquivo, {});
  assert.equal(r.ok, true); assert.equal(r.restauradaDe, 2); assert.equal(r.dataVersion, 4);
  assert.equal(pacote.bases.PEOPLE.length, 1);
  const lido = await S.readOfficialWorkbook(await st.readFile('C3B/01_Cadastro_Equipe_C3B.xlsx'));
  assert.equal(lido.meta.restored_from, 'v2'); assert.equal(lido.registros.length, 1);
  assert.deepEqual((await S.listVersions(st, 'C3B', 'PEOPLE')).map(x => x.versao), [1, 2, 3, 4], 'nada foi apagado: v1..v3 em BACKUP e v4 atual');
  await assert.rejects(S.restoreVersion(st, 'C3B', pacote, 'OPERATIONS', v2.arquivo, {}), /base PEOPLE/);
});

test('diagnóstico: base ausente, arquivo renomeado, alteração fora do Padronizador e planilha estranha', async () => {
  const raiz = pastaTemp('diag'), st = disco(raiz);
  const { pacote } = await S.createInstallation(st, 'C3B', { empresa: 'BYD' }, {});
  const dir = path.join(raiz, 'C3B');
  fs.unlinkSync(path.join(dir, '03_Matriz_Habilidades_C3B.xlsx'));
  fs.renameSync(path.join(dir, '02_Catalogo_Operacoes_C3B.xlsx'), path.join(dir, 'catalogo copia.xlsx'));
  pacote.bases.PEOPLE = pessoas;
  fs.writeFileSync(path.join(dir, '01_Cadastro_Equipe_C3B.xlsx'), await S.generateOfficialWorkbook('PEOPLE', pessoas, { data_version: 1 }));
  fs.copyFileSync(path.join(__dirname, 'fixtures', 'Funcionarios_C3_nao_padronizado.xlsx'), path.join(dir, 'lista antiga.xlsx'));
  const d = await S.diagnoseInstallation(st, 'C3B');
  const b = id => d.bases.find(x => x.schema === id);
  assert.equal(b('SKILLS').status, 'AUSENTE'); assert.deepEqual(d.ausentes, ['SKILLS']);
  assert.ok(b('OPERATIONS').alertas.some(a => /outro nome/.test(a.texto)));
  assert.ok(b('PEOPLE').alertas.some(a => /fora do Padronizador/.test(a.texto)));
  assert.deepEqual(d.naoReconhecidos, ['lista antiga.xlsx']);
  // gerar só os ausentes
  // gerar exatamente o que o diagnóstico apontou como ausente
  const r = await S.writePackage(st, 'C3B', d.pacote, { modo: 'ATUALIZAR', bases: d.ausentes });
  assert.ok(r.ok); assert.deepEqual(r.resultados.map(x => x.schemaId), ['SKILLS']);
  // modo AUSENTES olha o nome padrão: recria o 02 com o nome oficial, com os dados da cópia renomeada
  const r2 = await S.writePackage(st, 'C3B', d.pacote, { modo: 'AUSENTES' });
  assert.ok(r2.ok); assert.deepEqual(r2.resultados.map(x => x.schemaId), ['OPERATIONS']);
  assert.ok(fs.existsSync(path.join(dir, '02_Catalogo_Operacoes_C3B.xlsx')));
});

test('segurança: não grava sobre outra instalação; histórico só de acréscimo; bloqueios exigem motivo', async () => {
  const raiz = pastaTemp('seg'), st = disco(raiz);
  const a = await S.createInstallation(st, 'C3B', { empresa: 'A' }, {});
  const outro = S.createPackage({ empresa: 'B' }, 't');
  const r = await S.writePackage(st, 'C3B', outro, {});
  assert.equal(r.ok, false); assert.match(r.erro, /outra instalação/);
  // histórico: sumir evento do pacote impede a gravação
  const p = a.pacote;
  p.bases.PEOPLE = pessoas; p.bases.OPERATIONS = [{ operation_id: 'SA6H-C16-L1-001', model_id: 'SA6H', station_id: 'SA6H-C16', estacao: 'C16', lado: 'L', posicao: '1', descricao_pt: 'X' }];
  S.registerSkill(p, { employee_id: 'EMP-001234', operation_id: 'SA6H-C16-L1-001', new_level: 'i', event_date: '2026-01-10' });
  assert.ok((await S.writePackage(st, 'C3B', p, {})).ok);
  p.bases.HISTORY = [];
  const h = await S.writePackage(st, 'C3B', p, { modo: 'ATUALIZAR', bases: ['HISTORY'] });
  assert.equal(h.ok, false); assert.match(h.erro, /só de acréscimo/);
  // referência quebrada: BLOCKING, só grava com motivo
  const q = S.createPackage({ empresa: 'Q' }, 't');
  const st2 = disco(pastaTemp('bloq'));
  q.bases.SKILLS = [{ skill_record_id: 'SKL-X', employee_id: 'EMP-NAO', operation_id: 'OP-NAO', skill_level: 'i', status: 'ATIVO' }];
  const b1 = await S.writePackage(st2, '', q, { modo: 'ATUALIZAR', bases: ['SKILLS'] });
  assert.equal(b1.ok, false); assert.match(b1.erro, /bloqueio/);
  const b2 = await S.writePackage(st2, '', q, { modo: 'ATUALIZAR', bases: ['SKILLS'], override: { motivo: 'carga parcial autorizada' } });
  assert.equal(b2.ok, true);
});

test('storage confinado: NodeFsAdapter não sai da pasta', async () => {
  const st = disco(pastaTemp('conf'));
  await assert.rejects(st.writeFile('../fora.txt', new Uint8Array([1])), /não permitido|fora da pasta/);
  await assert.rejects(st.readFile('/etc/passwd'), /fora da pasta|não permitido|ENOENT/);
});

test('configurações: aliases, perfis, modelos, valores e master_mode sobrevivem a gravar e reabrir', async () => {
  const raiz = pastaTemp('cfg'), st = disco(raiz);
  const p = S.createPackage({ empresa: 'BYD', modelos: ['SA6H'] }, 't');
  const m = S.importacao.motorDoPacote(p);
  p.config.aliases.push(m.adicionar('FUNCAO', 'Soldador', 'OPERADOR_PRODUCAO', 't'));
  m.adicionarModelo('SA8H', ['sa 8h']); p.config.modelosExtras = m.modelosExtras();
  m.adicionarValor('TURNO', 'TURNO_4', 'Quarto turno'); p.config.valoresExtras = m.valoresExtras();
  const api = S.perfis.criarPerfis();
  api.criar({ profile_name: 'Planilha BYD', schema: 'PEOPLE', column_mapping: { re: 'matricula' }, fixed_values: { status: 'ATIVO' } });
  p.config.perfis = api.listar(); p.config.sync.PEOPLE = 'EXCEL_MASTER';
  assert.ok((await S.writePackage(st, 'C3B', p, {})).ok);
  const c = await S.loadInstallation(st, 'C3B');
  assert.equal(c.pacote.manifesto.installation_id, p.manifesto.installation_id);
  assert.equal(c.pacote.config.aliases[0].original_value, 'Soldador');
  assert.equal(c.pacote.config.perfis[0].column_mapping.re, 'matricula');
  assert.ok(c.pacote.config.modelosExtras.some(x => x.model_id === 'SA8H'));
  assert.ok(c.pacote.config.valoresExtras.TURNO.some(x => x.codigo === 'TURNO_4'));
  assert.equal(c.pacote.config.sync.PEOPLE, 'EXCEL_MASTER');
  const m2 = S.importacao.motorDoPacote(c.pacote);
  assert.equal(m2.normalizar('MODELO', 'sa 8h').normalizado, 'SA8H');
  assert.equal(m2.normalizar('TURNO', 'turno_4').normalizado, 'TURNO_4');
});

test('perfis: criar, editar (versão), duplicar, excluir, exportar/importar e compatibilidade', async () => {
  const api = S.perfis.criarPerfis();
  const a = api.criar({ profile_name: 'A', schema: 'PEOPLE', sheet_name_pattern: 'Lista Funcionários', column_mapping: { 're': 'matricula', 'nome func': 'nome', 'time': 'equipe' } });
  assert.equal(api.editar(a.profile_id, { profile_name: 'A2' }).version, 2);
  const dup = api.duplicar(a.profile_id); assert.notEqual(dup.profile_id, a.profile_id);
  const json = api.exportar(a.profile_id);
  const outro = S.perfis.criarPerfis(); const imp = outro.importar(json); assert.equal(imp[0].profile_name, 'A2');
  assert.throws(() => outro.importar('{"x":1}'), /inválido/);
  assert.equal(api.excluir(dup.profile_id), true); assert.equal(api.listar().length, 1);
  // compatibilidade: perfil reconhece a planilha na próxima importação
  const pacote = S.createPackage({}, 't'); pacote.config.perfis = api.listar();
  const { sessao: s } = await importar(pacote, 'Funcionarios_C3_nao_padronizado.xlsx', { confirmar: false });
  assert.ok(s.abas.find(x => x.nome === 'Lista Funcionários').perfilCompativel, 'perfil compatível encontrado');
});

test('edição em massa com prévia e log; carga inicial da matriz gera histórico', async () => {
  const p = S.createPackage({}, 't');
  p.bases.PEOPLE = JSON.parse(JSON.stringify(pessoas));
  p.bases.OPERATIONS = [{ operation_id: 'SA6H-C16-L1-001', model_id: 'SA6H', estacao: 'C16', descricao_pt: 'X' }];
  const pv = S.cadastro.previaEmMassa(p, 'PEOPLE', ['EMP-001234', 'EMP-000777'], 'turno', 'T3');
  assert.equal(pv.valor, 'TURNO_3'); assert.equal(pv.mudam, 2);
  assert.throws(() => S.cadastro.previaEmMassa(p, 'PEOPLE', ['EMP-001234'], 'turno', 'turno maluco'), /não é um valor reconhecido/);
  assert.equal(S.cadastro.aplicarEmMassa(p, 'PEOPLE', pv).alterados, 2);
  assert.equal(p.logs.filter(l => l.acao === 'EDICAO_EM_MASSA').length, 2);
  const r = S.cadastro.marcarMatriz(p, { employee_ids: ['EMP-001234', 'EMP-000777'], operation_ids: ['SA6H-C16-L1-001'], nivel: 'I', data: '2026-09-01' });
  assert.deepEqual(r, { novos: 2, alterados: 0, eventos: 2 });
  assert.ok(p.bases.HISTORY.every(e => e.event_type === 'CARGA_INICIAL'));
  assert.throws(() => S.cadastro.marcarMatriz(p, { employee_ids: ['EMP-NAO'], operation_ids: ['SA6H-C16-L1-001'], nivel: 'I', data: '2026-09-01' }), /Não existem/);
});

test('relatório da importação é um .xlsx com as abas de auditoria', async () => {
  const pacote = S.createPackage({}, 't');
  await importar(pacote, 'funcionarios_windows1252.csv');
  const bytes = await S.relatorios.relatorioImportacao(pacote.lotes[0]);
  const lido = await new (require('exceljs').Workbook)().xlsx.load(Buffer.from(bytes));
  assert.deepEqual(lido.worksheets.map(w => w.name), ['RESUMO', 'POR_ABA', 'TRANSFORMACOES', 'PENDENCIAS', 'NAO_MAPEADOS']);
  assert.ok(lido.getWorksheet('TRANSFORMACOES').rowCount > 1);
});

test('configuração ⇄ abas é reversível', () => {
  const p = S.createPackage({ empresa: 'X' }, 't');
  p.config.contadores = { '20260927': 3 };
  const volta = INST.abasParaConfig(JSON.parse(JSON.stringify(INST.configParaAbas(p))));
  assert.deepEqual(volta.contadores, { '20260927': 3 });
});
