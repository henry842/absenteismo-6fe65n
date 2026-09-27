// "Carregar exemplo": monta uma planilha de exemplo (fictícia, marcada como EXEMPLO) no navegador e a envia
// pelo MESMO fluxo real de importação. Não é um atalho com resultados prontos: tudo é calculado de verdade.
(function () {
  'use strict';
  UI.gerarPlanilhaExemplo = async function () {
    const wb = new ExcelJS.Workbook();
    const d = (a, m, dia) => new Date(Date.UTC(a, m - 1, dia));
    const op = wb.addWorksheet('Operadores');
    op.mergeCells('A1:G1'); op.getCell('A1').value = 'EXEMPLO FICTÍCIO — CONTROLE DE REVEZAMENTO C3B 轮岗控制表';
    op.getRow(3).values = ['Nº', 'Matrícula 工号', 'Nome 姓名', 'Função 职务', 'Turno 班次', 'Equipe', 'CPF'];
    [[1, '004512', 'João Exemplo', 'OP PROD', '2º turno', 'C3B', '000.000.000-00'], [2, '009165', 'Maria Exemplo', 'Operador de Produção', 'T2', 'C3B', ''],
     [3, '000777', '王伟 (exemplo)', 'Operador', '2T', 'C3B', ''], [4, '004600', 'Carlos Exemplo', 'LIDER', 'segundo turno', 'C3B', ''],
     [5, '004601', 'Ana Exemplo', 'OP. MONTAGEM ESPECIAL', 'T2', 'C3B', ''], [6, '004601', 'Ana Exemplo (repetida)', 'op prod', 'turno x', 'C3B', '']]
      .forEach((l, i) => { op.getRow(4 + i).values = l; });
    op.getRow(11).values = ['Total de operadores', { formula: 'COUNTA(C4:C9)', result: 6 }];
    const ops = wb.addWorksheet('Operações');
    ops.mergeCells('A1:C1'); ops.getCell('A1').value = 'IDENTIFICAÇÃO';
    ops.mergeCells('D1:E1'); ops.getCell('D1').value = 'OPERAÇÃO 工序';
    ops.mergeCells('F1:H1'); ops.getCell('F1').value = 'PARÂMETROS';
    ops.getRow(2).values = ['Modelo', 'Estação', 'Cód. Op.', 'Descrição', '工序', 'Torque (N·m)', 'Soquete', 'Takt (s)'];
    [['SA 6H', 'C16 L1', 'OP-101', 'Torque parafuso suporte dianteiro', '前支架螺栓拧紧', '25 N·m', '13 mm', 58],
     ['SA 6H', 'C16 L1', 'OP-102', 'Conexão da tubulação', '管路连接', null, null, 58],
     ['SA6H', 'C16L', null, 'Aperto suporte dianteiro', '前支架紧固', 25, '13mm', null],
     ['SA6H', 'C16-R2', 'OP-110', 'Inspeção de vazamento', '泄漏检查', null, null, 58],
     ['SA-2H', 'C18 FR1', 'OP-201', 'Montagem do condensador', '冷凝器装配', 12.5, '10 mm', 55],
     ['XYZ9', 'C20 Esquerda', 'OP-900', 'Operação de modelo desconhecido', '', null, null, null]].forEach((l, i) => { ops.getRow(3 + i).values = l; });
    for (const [nome, matr, ev] of [['João Exemplo', '004512', [[d(2026, 3, 2), 'C16 L1', 'Torque parafuso suporte dianteiro', '', 'i', 'Carlos Exemplo'], ['15/04/2026', 'C16 L1', 'Torque parafuso suporte dianteiro', 'i', 'I', 'Carlos Exemplo']]],
      ['Maria Exemplo', '009165', [[d(2026, 5, 10), 'C16-R2', 'Inspeção de vazamento', '', 'I', 'Carlos Exemplo'], ['03/08/2026', 'C16-R2', 'Inspeção de vazamento', 'I', 'L', 'Carlos Exemplo']]],
      ['Modelo', '', []]]) {
      const ws = wb.addWorksheet(nome);
      ws.mergeCells('A1:G1'); ws.getCell('A1').value = 'FICHA DE HISTÓRICO DE HABILIDADES — 技能履历表 (EXEMPLO)';
      ws.getCell('A3').value = 'Nome:'; ws.getCell('B3').value = nome === 'Modelo' ? '' : nome;
      ws.getCell('A4').value = 'Matrícula:'; ws.getCell('B4').value = matr;
      ws.getRow(7).values = ['Data', 'Estação', 'Operação', 'Nível anterior', 'Nível', 'Responsável', 'Observação'];
      ev.forEach((e, i) => { ws.getRow(8 + i).values = e; });
    }
    return new Uint8Array(await wb.xlsx.writeBuffer());
  };
})();
