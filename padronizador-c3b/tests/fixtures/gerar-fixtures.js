// Gera as planilhas de teste (sintéticas). Os arquivos reais citados na missão não foram fornecidos;
// estas fixtures reproduzem as estruturas descritas: células mescladas, fórmulas, cabeçalho em duas linhas,
// português/chinês, operações embutidas em texto, uma aba por colaborador (+ Modelo/Exemplo) e planejamento
// em matriz (pessoas nas colunas). Uso: node tests/fixtures/gerar-fixtures.js
const ExcelJS = require('exceljs'), fs = require('fs'), path = require('path');
const JSZip = require('jszip');
const DIR = __dirname;
const d = (a, m, dia) => new Date(Date.UTC(a, m - 1, dia));

async function revezamento() {
  const wb = new ExcelJS.Workbook();
  const op = wb.addWorksheet('Operadores');
  op.mergeCells('A1:G1'); op.getCell('A1').value = 'CONTROLE DE REVEZAMENTO C3B — 轮岗控制表';
  op.getRow(3).values = ['Nº', 'Matrícula 工号', 'Nome 姓名', 'Função 职务', 'Turno 班次', 'Equipe', 'Telefone'];
  const pessoas = [
    [1, '004512', 'João Silva', 'OP PROD', '2º turno', 'C3B', '(71) 99999-0001'],
    [2, '009165', 'Maria Santos', 'Operador de Produção', 'T2', 'C3B', ''],
    [3, 777, '王伟', 'Operador', '2T', 'C3B', ''],
    [4, '004600', 'Carlos Lima', 'LIDER', 'segundo turno', 'C3B', ''],
    [5, '004601', 'Ana Souza', 'OP. MONTAGEM ESPECIAL', 'T2', 'C3B', ''],
    [6, '004602', 'Pedro Alves', 'op prod', 'Turno 2', 'C3B', ''],
  ];
  pessoas.forEach((p, i) => { op.getRow(4 + i).values = p; });
  op.getCell('B6').numFmt = '000000';               // 777 aparece como 000777 no Excel
  op.getRow(11).values = ['Total de operadores', { formula: 'COUNTA(C4:C9)', result: 6 }];
  const ops = wb.addWorksheet('Operações');
  ops.mergeCells('A1:C1'); ops.getCell('A1').value = 'IDENTIFICAÇÃO';
  ops.mergeCells('D1:E1'); ops.getCell('D1').value = 'OPERAÇÃO 工序';
  ops.mergeCells('F1:H1'); ops.getCell('F1').value = 'PARÂMETROS';
  ops.getRow(2).values = ['Modelo', 'Estação', 'Cód. Op.', 'Descrição', '工序', 'Torque (N·m)', 'Soquete', 'Takt (s)'];
  const linhas = [
    ['SA 6H', 'C16 L1', 'OP-101', 'Torque parafuso suporte dianteiro', '前支架螺栓拧紧', '25 N·m', '13 mm', 58],
    ['SA 6H', 'C16 L1', 'OP-102', 'Conexão da tubulação', '管路连接', null, null, 58],
    ['SA 6H', 'C16 L1', null, 'Aperto suporte dianteiro', '前支架紧固', 25, '13mm', null],
    ['SA6H', 'C16-R2', 'OP-110', 'Inspeção de vazamento', '泄漏检查', null, null, 58],
    ['SA-2H', 'C18 FR1', 'OP-201', 'Montagem do condensador', '冷凝器装配', 12.5, '10 mm', 55],
    ['SA2H', 'C19 FZ2', 'OP-202', 'Fixação do ventilador', '风扇固定', 9, '8 mm', 55],
    ['XYZ9', 'C20 L', 'OP-900', 'Operação de modelo desconhecido', '', null, null, null],
  ];
  linhas.forEach((l, i) => { ops.getRow(3 + i).values = l; });
  ops.mergeCells('A3:A5');                          // modelo mesclado na vertical (valor só em A3)
  const esc = wb.addWorksheet('Escala');
  esc.getRow(1).values = ['Nome', '22/09', '23/09', '24/09', '25/09'];
  esc.getRow(2).values = ['João Silva', 'T', 'T', 'F', 'T'];
  const rev = wb.addWorksheet('Revezamento');
  rev.getRow(1).values = ['Horário', 'C16 L1', 'C16-R2', 'C18 FR1'];
  rev.getRow(2).values = ['07:00', 'João Silva', 'Maria Santos', '王伟'];
  await wb.xlsx.writeFile(path.join(DIR, 'Controle_de_Revezamento_C3B_sintetico.xlsx'));
}

async function fichaHistorico() {
  const wb = new ExcelJS.Workbook();
  const fichas = [
    ['João Silva', '004512', [[d(2026, 3, 2), 'C16 L1', 'Torque parafuso suporte dianteiro', '', 'i', 'Carlos Lima'], ['15/04/2026', 'C16 L1', 'Torque parafuso suporte dianteiro', 'i', 'I', 'Carlos Lima'], [d(2026, 6, 20), 'C16 L1', 'Torque parafuso suporte dianteiro', 'I', 'L', 'Carlos Lima']]],
    ['Maria Santos', '009165', [[d(2026, 5, 10), 'C16-R2', 'Inspeção de vazamento', '', 'I', 'Carlos Lima'], [d(2026, 8, 1), 'C16-R2', 'Inspeção de vazamento', 'I', 'L', 'Carlos Lima']]],
    ['王伟', '000777', [[d(2026, 7, 7), 'C18 FR1', 'Montagem do condensador', '', 'i', '王经理'], [d(2026, 9, 1), 'C18 FR1', 'Montagem do condensador', 'i', 'I', '王经理']]],
    ['Modelo', '', []],
    ['Exemplo', '000000', [[d(2026, 1, 1), 'C00 L1', 'Exemplo de operação', '', 'i', 'Fulano']]],
  ];
  for (const [nome, matr, eventos] of fichas) {
    const ws = wb.addWorksheet(nome);
    ws.mergeCells('A1:G1'); ws.getCell('A1').value = 'FICHA DE HISTÓRICO DE HABILIDADES — 技能履历表';
    ws.getCell('A3').value = 'Nome:'; ws.getCell('B3').value = nome === 'Modelo' || nome === 'Exemplo' ? '' : nome;
    ws.getCell('A4').value = 'Matrícula:'; ws.getCell('B4').value = matr;
    ws.getCell('A5').value = 'Equipe:'; ws.getCell('B5').value = 'C3B';
    ws.getRow(7).values = ['Data', 'Estação', 'Operação', 'Nível anterior', 'Nível', 'Responsável', 'Observação'];
    eventos.forEach((e, i) => { ws.getRow(8 + i).values = e; });
  }
  await wb.xlsx.writeFile(path.join(DIR, 'Ficha_Historico_Habilidades_sintetico.xlsx'));
}

async function planejamento() {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Setembro 9月');
  ws.mergeCells('A1:H1'); ws.getCell('A1').value = '09.Setembro C3B — Planejamento de Treinamento de Habilidades 月度训练计划';
  ws.getRow(3).values = ['Estação', 'Operação', '工序', 'João Silva', 'Maria Santos', '王伟', 'Carlos Lima', 'Ana Souza'];
  ws.getRow(4).values = ['', '', '', '004512', '009165', '000777', '004600', '004601'];
  ws.getRow(5).values = ['C16 L1', 'Torque parafuso suporte dianteiro', '前支架螺栓拧紧', 'L', null, 'i→I', null, d(2026, 9, 22)];
  ws.getRow(6).values = ['C16-R2', 'Inspeção de vazamento', '泄漏检查', null, 'L', null, 'U', null];
  ws.getRow(7).values = ['C18 FR1', 'Montagem do condensador', '冷凝器装配', null, null, 'I', null, 'I'];
  await wb.xlsx.writeFile(path.join(DIR, 'Planejamento_Treinamento_Matriz_sintetico.xlsx'));
  // variante: começa em outra coluna, sem matrículas (sem coordenadas fixas)
  const wb2 = new ExcelJS.Workbook();
  const w2 = wb2.addWorksheet('Plano');
  w2.getRow(2).values = [null, null, 'Posto', 'Descrição da operação', 'João Silva', 'Maria Santos', 'Carlos Lima'];
  w2.getRow(3).values = [null, null, 'C16 L1', 'Torque parafuso suporte dianteiro', 'U', 'I', null];
  w2.getRow(4).values = [null, null, 'C18 FR1', 'Montagem do condensador', null, '30/09/2026', 'L'];
  await wb2.xlsx.writeFile(path.join(DIR, 'Planejamento_Mensal_Variante_sintetico.xlsx'));
}

async function naoPadronizado() {
  const wb = new ExcelJS.Workbook();
  wb.addWorksheet('Capa').getCell('B2').value = 'Relatório de efetivo — uso interno';
  const ws = wb.addWorksheet('Lista Funcionários');
  ws.getCell('A1').value = 'EFETIVO C3B — TURNO B'; ws.mergeCells('A1:I1');
  ws.getCell('A2').value = 'Atualizado em 20/09/2026';
  ws.getRow(4).values = ['NOME FUNC.', 'RE', 'TIME', 'Cargo', 'Horário', 'Situação', 'CPF', 'Data Nasc.', 'Admissão'];
  const linhas = [
    ['João Silva', '004512', 'C3B', 'OP PROD', 'T2', 'Ativo', '111.222.333-44', '01/01/1990', '12/03/2024'],
    ['Maria Santos', '009165', 'C3B', 'OPERADOR PRODUCAO', '2º Turno', 'Atv', '', '', '2023-11-05'],
    ['王伟', '000777', 'C3B', 'Operador', 'Segundo turno', 'trabalhando', '', '', d(2025, 9, 25)],
    ['Carlos Lima', '004600', 'C3B', 'Líder', '2T', 'Ativo', '', '', '03/04/2024'],
    ['Ana Souza', '004601', 'C3B', 'Soldador', 'T2', 'Ativo', '', '', ''],
    ['Pedro Alves', '004602', 'C3B', 'OP PROD', 'turno x', 'Férias', '', '', ''],
    ['Pedro Alves Dup', '004602', 'C3B', 'OP PROD', 'T2', 'Ativo', '', '', ''],
  ];
  linhas.forEach((l, i) => { ws.getRow(5 + i).values = l; });
  await wb.xlsx.writeFile(path.join(DIR, 'Funcionarios_C3_nao_padronizado.xlsx'));
  // Mesma planilha como .xlsm (com um vbaProject de mentira: deve ser tratado só como dados)
  const zip = await JSZip.loadAsync(fs.readFileSync(path.join(DIR, 'Funcionarios_C3_nao_padronizado.xlsx')));
  let ct = await zip.file('[Content_Types].xml').async('string');
  ct = ct.replace('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml', 'application/vnd.ms-excel.sheet.macroEnabled.main+xml')
    .replace('</Types>', '<Default Extension="bin" ContentType="application/vnd.ms-office.vbaProject"/></Types>');
  zip.file('[Content_Types].xml', ct);
  zip.file('xl/vbaProject.bin', Buffer.from('MACRO-NAO-DEVE-SER-EXECUTADA'));
  fs.writeFileSync(path.join(DIR, 'Funcionarios_C3_com_macro.xlsm'), await zip.generateAsync({ type: 'nodebuffer' }));
  // CSV em Windows-1252 com ponto e vírgula (como o Excel brasileiro salva)
  const csv = 'Matrícula;Nome;Equipe;Função;Turno;Status\r\n004512;João Conceição;C3B;OP PROD;T2;Ativo\r\n000123;Márcia Araújo;C3B;Líder;3º turno;Ativo\r\n';
  const latin1 = Buffer.from([...csv].map(ch => { const c = ch.charCodeAt(0); return c < 256 ? c : 63; }));
  fs.writeFileSync(path.join(DIR, 'funcionarios_windows1252.csv'), latin1);
}

(async () => { await revezamento(); await fichaHistorico(); await planejamento(); await naoPadronizado(); console.log('fixtures geradas em', DIR); })();
