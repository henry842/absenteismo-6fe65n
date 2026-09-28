// Leitura real (XLSX, XLSM, CSV, rejeição de .xls), cabeçalho, detecção de schema, mapeamento,
// formatos legados e normalização (nunca inventa valores; decisões do usuário mudam os dados).
const test = require('node:test'), assert = require('node:assert/strict');
const { S, fixture, importar } = require('./ajuda.js');
const ExcelJS = require('exceljs');
const IMP = S.importacao;

async function sessao(nome, pacote = S.createPackage({ empresa: 'T' }, 't')) {
  const s = await IMP.iniciar({ bytes: fixture(nome), nome, pacote, usuario: 't' });
  assert.ok(!s.erro, s.erro && s.erro.message);
  return s;
}

test('XLSX: abas, mescladas, fórmulas, cabeçalho em outra linha e hash', async () => {
  const a = await S.analyzeWorkbook(fixture('Controle_de_Revezamento_C3B_sintetico.xlsx'), 'x.xlsx');
  assert.equal(a.arquivo.formato, 'xlsx'); assert.match(a.arquivo.hash, /^[0-9a-f]{64}$/);
  assert.deepEqual(a.abas.map(x => x.nome), ['Operadores', 'Operações', 'Escala', 'Revezamento']);
  const op = a.abas[0];
  assert.ok(op.mescladas.length >= 1); assert.equal(op.formulas, 1);
  const cab = S.detectHeader(op);
  assert.equal(cab.linha, 2, 'cabeçalho na linha 3');
  const ops = a.abas[1];
  assert.equal(ops.valores[3][0], 'SA 6H', 'célula mesclada na vertical é preenchida com o valor da mescla');
});

test('XLSX: número com formato 000000 vira matrícula "000777"', async () => {
  const s = await sessao('Controle_de_Revezamento_C3B_sintetico.xlsx');
  IMP.mapear(s, 'Operadores', 'PEOPLE');
  IMP.definirValorFixo(s, 'Operadores', 'status', 'ATIVO');
  const r = await IMP.processar(s, 'Operadores');
  const w = r.oficiais.find(p => p.nome === '王伟');
  assert.equal(w.matricula, '000777'); assert.equal(w.employee_id, 'EMP-000777');
  assert.ok(r.ignoradas.some(i => /total/.test(i.motivo)), 'linha de total ignorada');
  assert.equal(r.oficiais.length, 6);
});

test('XLSM: lido como dados; a macro não é executada nem copiada', async () => {
  const s = await sessao('Funcionarios_C3_com_macro.xlsm');
  assert.equal(s.analise.arquivo.formato, 'xlsm');
  const aba = s.abas.find(a => a.nome === 'Lista Funcionários');
  assert.equal(aba.schema, 'PEOPLE'); assert.equal(aba.selecionada, true);
  IMP.mapear(s, aba.nome, 'PEOPLE');
  const r = await IMP.processar(s, aba.nome);
  assert.equal(r.oficiais.length, 7);
  const bytes = await S.generateOfficialWorkbook('PEOPLE', r.oficiais, {});
  const JSZip = require('jszip');
  const zip = await JSZip.loadAsync(bytes);
  assert.equal(zip.file('xl/vbaProject.bin'), null, 'arquivo gerado não carrega a macro');
});

test('CSV Windows-1252 com ponto e vírgula: acentos preservados', async () => {
  const s = await sessao('funcionarios_windows1252.csv');
  assert.equal(s.analise.arquivo.codificacao, 'Windows-1252'); assert.equal(s.analise.arquivo.separador, ';');
  IMP.mapear(s, s.abas[0].nome, 'PEOPLE');
  const r = await IMP.processar(s, s.abas[0].nome);
  assert.deepEqual(r.oficiais.map(p => p.nome), ['João Conceição', 'Márcia Araújo']);
  assert.equal(r.oficiais[1].matricula, '000123'); assert.equal(r.oficiais[1].turno, 'TURNO_3');
});

test('CSV UTF-8 com BOM, aspas e quebra de linha dentro do campo', async () => {
  const txt = '﻿matrícula,nome,equipe,status\n"000001","Li, 李明",C3B,ativo\n"000002","Ana\nSouza",C3B,ativo\n';
  const a = await S.analyzeWorkbook(new TextEncoder().encode(txt), 'x.csv');
  assert.match(a.arquivo.codificacao, /^UTF-8/);
  assert.equal(a.abas[0].valores[1][1], 'Li, 李明'); assert.equal(a.abas[0].valores[2][1], 'Ana\nSouza');
});

test('.xls antigo e arquivo vazio são recusados com orientação', async () => {
  const ole = new Uint8Array(Buffer.from('D0CF11E0A1B11AE1000000000000', 'hex'));
  await assert.rejects(S.analyzeWorkbook(ole, 'antigo.xls'), e => e.name === 'ErroLeitura' && /xlsx/i.test(e.comoResolver));
  await assert.rejects(S.analyzeWorkbook(new Uint8Array(), 'vazio.xlsx'), /vazio/);
  await assert.rejects(S.analyzeWorkbook(new TextEncoder().encode('não é excel'), 'falso.xlsx'), e => e.name === 'ErroLeitura');
});

test('não confia no nome: .csv que na verdade é xlsx é lido pelo conteúdo', async () => {
  const a = await S.analyzeWorkbook(fixture('Funcionarios_C3_nao_padronizado.xlsx'), 'renomeado.csv');
  assert.ok(['xlsx', 'xlsm'].includes(a.arquivo.formato));
});

test('planilha não padronizada: schema, cabeçalho, mapeamento e colunas LGPD', async () => {
  const s = await sessao('Funcionarios_C3_nao_padronizado.xlsx');
  const capa = s.abas.find(a => a.nome === 'Capa'), lista = s.abas.find(a => a.nome === 'Lista Funcionários');
  assert.equal(capa.selecionada, false);
  assert.equal(lista.schema, 'PEOPLE'); assert.equal(lista.cabecalho.linha, 3);
  const t = IMP.mapear(s, lista.nome, 'PEOPLE');
  const campo = h => t.mapeamento.find(m => m.cabecalho === h);
  assert.equal(campo('RE').campo, 'matricula'); assert.equal(campo('NOME FUNC.').campo, 'nome'); assert.equal(campo('Situação').campo, 'status');
  assert.equal(campo('CPF').decisao, 'NAO_UTILIZADO'); assert.equal(campo('Data Nasc.').decisao, 'NAO_UTILIZADO');
  const r = await IMP.processar(s, lista.nome);
  assert.ok(r.oficiais.every(p => !Object.values(p).includes('111.222.333-44')), 'CPF não entra na base');
  assert.ok(r.issues.some(i => i.codigo === 'LGPD_IGNORADO'));
});

test('mapeamento com confiança: ≥95% automático, 80–94% revisar', async () => {
  const s = await sessao('Funcionarios_C3_nao_padronizado.xlsx');
  const t = IMP.mapear(s, 'Lista Funcionários', 'PEOPLE');
  for (const m of t.mapeamento.filter(x => x.campo)) {
    if (m.decisao === 'AUTO') assert.ok(m.confianca >= 0.95);
    if (m.decisao === 'REVISAR') assert.ok(m.confianca >= 0.8 && m.confianca < 0.95);
    assert.ok(m.motivos.length);
  }
});

test('nunca inventa: desconhecido fica UNKNOWN/vazio e gera aviso', async () => {
  const s = await sessao('Funcionarios_C3_nao_padronizado.xlsx');
  IMP.mapear(s, 'Lista Funcionários', 'PEOPLE');
  const r = await IMP.processar(s, 'Lista Funcionários');
  const ana = r.oficiais.find(p => p.matricula === '004601');
  assert.equal(ana.funcao, 'UNKNOWN', '"Soldador" não vira uma função qualquer');
  assert.ok(r.issues.some(i => i.codigo === 'VALOR_NAO_RECONHECIDO' && i.valor === 'Soldador'));
  assert.ok(r.issues.some(i => i.codigo === 'DUPLICADO'), 'matrícula repetida é apontada');
  const log = r.log.find(l => l.original_value === 'Soldador');
  assert.equal(log.normalized_value, 'UNKNOWN'); assert.equal(log.decision, 'PENDENTE');
});

test('de/para: corrigir com alias muda os dados e vale para a próxima importação', async () => {
  const pacote = S.createPackage({ empresa: 'T' }, 't');
  const s = await sessao('Funcionarios_C3_nao_padronizado.xlsx', pacote);
  IMP.mapear(s, 'Lista Funcionários', 'PEOPLE');
  await IMP.processar(s, 'Lista Funcionários');
  IMP.decidirValor(s, 'Lista Funcionários', 'funcao', 'Soldador', { acao: 'CORRIGIR', valor: 'OPERADOR_PRODUCAO', criarAlias: true });
  IMP.decidirValor(s, 'Lista Funcionários', 'turno', 'turno x', { acao: 'IGNORAR' });
  const r = await IMP.processar(s, 'Lista Funcionários');
  assert.equal(r.oficiais.find(p => p.matricula === '004601').funcao, 'OPERADOR_PRODUCAO');
  assert.equal(r.oficiais.find(p => p.nome === 'Pedro Alves').turno, null);
  assert.ok(r.log.some(l => l.rule === 'CORRIGIDO_PELO_USUARIO'));
  assert.equal(pacote.config.aliases.length, 1);
  const s2 = await sessao('Funcionarios_C3_nao_padronizado.xlsx', pacote);
  IMP.mapear(s2, 'Lista Funcionários', 'PEOPLE');
  const r2 = await IMP.processar(s2, 'Lista Funcionários');
  assert.equal(r2.oficiais.find(p => p.matricula === '004601').funcao, 'OPERADOR_PRODUCAO', 'alias aplicado na nova importação');
  assert.throws(() => IMP.decidirValor(s2, 'Lista Funcionários', 'funcao', 'x', { acao: 'APAGAR' }), /inválida/);
});

test('legado: histórico com uma aba por colaborador (Modelo/Exemplo ignorados)', async () => {
  const s = await sessao('Ficha_Historico_Habilidades_sintetico.xlsx');
  const v = s.abas.find(a => a.virtual);
  assert.match(v.nome, /Histórico: 3 colaboradores/);
  assert.equal(s.abas.find(a => a.nome === 'Modelo').selecionada, false);
  assert.match(s.abas.find(a => a.nome === 'Exemplo').motivoIgnorada, /modelo|exemplo/i);
  assert.equal(s.abas.find(a => a.nome === '王伟').consumidaPor, v.nome);
});

test('legado: planejamento em matriz (pessoas nas colunas), inclusive variante sem coordenadas fixas', async () => {
  for (const f of ['Planejamento_Treinamento_Matriz_sintetico.xlsx', 'Planejamento_Mensal_Variante_sintetico.xlsx']) {
    const s = await sessao(f);
    const v = s.abas.find(a => a.virtual);
    assert.ok(v, f); assert.equal(v.schema, 'TRAINING'); assert.deepEqual(v.sugestoesValorFixo, { status: 'PLANEJADO' });
  }
});

test('legado: controle de revezamento — escala/revezamento não viram base', async () => {
  const s = await sessao('Controle_de_Revezamento_C3B_sintetico.xlsx');
  for (const n of ['Escala', 'Revezamento']) { const a = s.abas.find(x => x.nome === n); assert.equal(a.selecionada, false); assert.match(a.motivoIgnorada, /gerado pelo C3B/); }
});

test('operações: estação parseada, IDs estáveis, modelo desconhecido sem ID e par duplicado', async () => {
  const s = await sessao('Controle_de_Revezamento_C3B_sintetico.xlsx');
  IMP.mapear(s, 'Operações', 'OPERATIONS');
  const r = await IMP.processar(s, 'Operações');
  const ids = r.oficiais.map(o => o.operation_id);
  assert.deepEqual(ids.slice(0, 2), ['SA6H-C16-L1-001', 'SA6H-C16-L1-002']);
  const xyz = r.oficiais.find(o => o.codigo_operacao === 'OP-900');
  assert.equal(xyz.model_id, 'UNKNOWN'); assert.equal(xyz.operation_id, null);
  assert.equal(r.oficiais.find(o => o.codigo_operacao === 'OP-101').torque, 25);
  assert.equal(r.duplicidades.length, 1);
  IMP.decidirDuplicidade(s, 'Operações', 0, 'MESMA');
  assert.equal(s.trabalhos['Operações'].resultado.oficiais.filter(o => o.operation_id === 'SA6H-C16-L1-001').length, 1);
  const r2 = await IMP.processar(s, 'Operações');
  assert.equal(r2.oficiais.filter(o => o.operation_id === 'SA6H-C16-L1-001').length, 2, 'depois do alias, a linha repetida aponta para o mesmo ID');
});

test('modos: ANALISE e SIMULACAO nunca alteram as bases', async () => {
  for (const modo of ['ANALISE', 'SIMULACAO']) {
    const pacote = S.createPackage({ empresa: 'T' }, 't');
    const { sessao: s, lote } = await importar(pacote, 'funcionarios_windows1252.csv', { modo });
    assert.throws(() => IMP.confirmar(s), /nada é aplicado/);
    assert.equal(pacote.bases.PEOPLE.length, 0); assert.equal(lote.estado, 'CANCELLED'); assert.equal(pacote.lotes.length, 1);
  }
});

test('cancelamento durante a análise', async () => {
  const token = S.util.tokenCancelamento();
  token.cancelar();
  const s = await IMP.iniciar({ bytes: fixture('Controle_de_Revezamento_C3B_sintetico.xlsx'), nome: 'x.xlsx', pacote: S.createPackage({}, 't'), token });
  assert.equal(s.lote.estado, 'CANCELLED');
});

test('arquivo grande (5.000 linhas) é processado em lotes', async () => {
  const wb = new ExcelJS.Workbook(); const ws = wb.addWorksheet('Pessoas');
  ws.addRow(['Matrícula', 'Nome', 'Equipe', 'Turno', 'Status']);
  for (let i = 1; i <= 5000; i++) ws.addRow([String(i).padStart(6, '0'), `Pessoa ${i}`, 'C3B', i % 2 ? 'T1' : 'T2', 'Ativo']);
  const bytes = new Uint8Array(await wb.xlsx.writeBuffer());
  const pacote = S.createPackage({}, 't');
  let progresso = 0;
  const s = await IMP.iniciar({ bytes, nome: 'grande.xlsx', pacote });
  IMP.mapear(s, 'Pessoas', 'PEOPLE');
  const r = await IMP.processar(s, 'Pessoas', { progresso: p => { progresso = p; } });
  assert.equal(r.oficiais.length, 5000); assert.equal(progresso, 100);
});

test('as 7 bases são independentes: Matriz, Treinamentos e Presença importadas de CSV e ligadas ao Cadastro', async () => {
  const pacote = S.createPackage({ empresa: 'T' }, 't');
  const csv = (nome, txt) => ({ nome, bytes: new TextEncoder().encode(txt) });
  await importar(pacote, csv('pessoas.csv', 'Matrícula;Nome;Equipe;Status\n004512;João Silva;C3B;Ativo\n000777;王伟;C3B;Ativo\n'));
  await importar(pacote, csv('ops.csv', 'Modelo;Estação;Cód. Op.;Descrição\nSA6H;C16 L1;OP-101;Torque parafuso\n'));
  await importar(pacote, csv('matriz.csv', 'Matrícula;Estação;Cód. Op.;Nível;Titularidade;Status\n004512;C16 L1;OP-101;L;Titular;Ativo\n000777;C16 L1;OP-101;i;;Ativo\n'));
  await importar(pacote, csv('treino.csv', 'Matrícula;Estação;Cód. Op.;Nível atual;Nível alvo;Data planejada;Status;Prioridade\n000777;C16 L1;OP-101;i;I;2026-10-15;Planejado;Alta\n'));
  await importar(pacote, csv('presenca.csv', 'Matrícula;Data;Turno;Presença;Motivo\n004512;2026-09-22;T2;P;\n000777;22/09/2026;T2;Falta;Atestado\n'));
  assert.equal(pacote.bases.SKILLS.length, 2);
  assert.equal(pacote.bases.SKILLS.find(s => s.employee_id === 'EMP-000777').skill_level, 'i');
  assert.equal(pacote.bases.HISTORY.length, 2, 'matriz importada gera eventos no histórico');
  assert.equal(pacote.bases.TRAINING[0].target_level, 'I');
  assert.deepEqual(pacote.bases.ATTENDANCE.map(a => a.status).sort(), ['AUSENTE', 'PRESENTE']);
  assert.match(pacote.bases.ATTENDANCE[0].attendance_id, /^ATT-20260922-EMP-/);
  assert.deepEqual(S.validatePackage(pacote.bases), []);
  for (const id of ['SKILLS', 'TRAINING', 'ATTENDANCE']) {
    const bytes = await S.generateOfficialWorkbook(id, pacote.bases[id], {});
    assert.equal((await S.verifyWorkbook(bytes, id, pacote.bases[id])).ok, true, id);
  }
});

test('pessoas parecidas (universal): sugere, nunca une sozinho; "mesma pessoa" grava alias usado depois', async () => {
  const pacote = S.createPackage({ empresa: 'T' }, 't');
  const csv = (nome, txt) => ({ nome, bytes: new TextEncoder().encode(txt) });
  // 1ª carga: Pedro Alves já no Cadastro
  await importar(pacote, csv('p1.csv', 'Matrícula;Nome;Equipe;Status\n004602;Pedro Alves Souza;C3B;Ativo\n'));
  // 2ª planilha traz a mesma pessoa com o nome digitado errado e outra matrícula
  const { sessao: s } = await importar(pacote, csv('p2.csv', 'Matrícula;Nome;Equipe;Status\n014602;Pedro Alvse Souza;C3B;Ativo\n000001;Ana Lima Santos;C3B;Ativo\n'), { confirmar: false });
  const t = Object.values(s.trabalhos)[0];
  assert.equal(t.resultado.pessoasParecidas.length, 1, 'par sugerido');
  assert.equal(t.resultado.oficiais.length, 2, 'nada foi unido automaticamente');
  assert.throws(() => IMP.decidirPessoa(s, t.aba, 0, 'MESMA', { canonico: 'Pedro Alvse Souza' }), /já está no Cadastro oficial/, 'não apaga registro oficial');
  IMP.decidirPessoa(s, t.aba, 0, 'MESMA', { canonico: 'Pedro Alves Souza' });
  assert.deepEqual(t.resultado.oficiais.map(p => p.nome), ['Ana Lima Santos'], 'a grafia repetida sai desta importação');
  assert.ok(pacote.config.aliases.some(a => a.entity_type === 'PESSOA' && a.original_value === 'Pedro Alvse Souza' && a.normalized_value === 'Pedro Alves Souza'));
  IMP.confirmar(s, {});
  assert.equal(pacote.bases.PEOPLE.length, 2);
  // o alias resolve referências por nome nas próximas importações (ex.: histórico sem matrícula)
  await importar(pacote, csv('ops.csv', 'Modelo;Estação;Cód. Op.;Descrição\nSA6H;C16 L1;OP-101;Torque parafuso\n'));
  const { sessao: h } = await importar(pacote, csv('hist.csv', 'Nome;Data;Estação;Cód. Op.;Nível\nPedro Alvse Souza;2026-09-01;C16 L1;OP-101;I\n'), { confirmar: false });
  const ev = Object.values(h.trabalhos)[0].resultado.oficiais[0];
  assert.equal(ev.employee_id, 'EMP-004602');
  // "pessoas diferentes" não volta a perguntar
  const { sessao: s3 } = await importar(pacote, csv('p3.csv', 'Matrícula;Nome;Equipe;Status\n000002;Ana Lina Santos;C3B;Ativo\n'), { confirmar: false });
  const t3 = Object.values(s3.trabalhos)[0];
  assert.equal(t3.resultado.pessoasParecidas.length, 1);
  IMP.decidirPessoa(s3, t3.aba, 0, 'DIFERENTES');
  const { sessao: s4 } = await importar(pacote, csv('p3.csv', 'Matrícula;Nome;Equipe;Status\n000002;Ana Lina Santos;C3B;Ativo\n'), { confirmar: false });
  assert.equal(Object.values(s4.trabalhos)[0].resultado.pessoasParecidas.length, 0);
});
