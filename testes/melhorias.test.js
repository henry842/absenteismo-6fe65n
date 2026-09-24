// Testes das melhorias (comparar com dia anterior, avisos, período, reincidência, Excel).
// Nomes e matrículas inventados.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const L = require('../leitor.js');
const X = require('../excel.js');

// Monta uma mensagem simples no formato do C7B.
function msg(time, data, total, presentes, pessoas) {
  const [a, m, d] = data.split('-');
  return [`*Absenteísmo ${time} ${d}/${m}/${a}*`, `Total de pessoas: ${total}`, `Total presente: ${presentes}`, '',
    ...pessoas.map(([nome, id, motivo]) => `Nome: ${nome}\nID: ${id}\nMotivo: ${motivo}\n`)].join('\n');
}
function gravarTexto(base, texto) {
  for (const m of L.lerMensagens(texto, { ano: 2026 })) base = L.gravar(base, m);
  return base;
}
// Três semanas do C1B e do C7B; a Ana falta toda segunda.
function baseExemplo() {
  let b = L.baseVazia();
  const segundas = ['2026-09-07', '2026-09-14', '2026-09-21'];
  for (const d of ['2026-09-07', '2026-09-08', '2026-09-14', '2026-09-15', '2026-09-21', '2026-09-22']) {
    const ana = segundas.includes(d) ? [['Ana Teste', '1000001', 'Atestado médico']] : [];
    b = gravarTexto(b, msg('C1B', d, 29, 29 - ana.length, ana));
    b = gravarTexto(b, msg('C7B', d, 46, 45, [['Bruno Exemplo', '1000002', 'Sem justificativa']]));
  }
  return b;
}

test('fechamento compara com o último lançamento do time', () => {
  let b = baseExemplo();
  b = gravarTexto(b, msg('C1B', '2026-09-23', 29, 27, [['Ana Teste', '1000001', 'Atestado'], ['Carla Modelo', '1000003', 'atraso']]));
  const r = L.resumoDoDia(b, '2026-09-23');
  const c1 = r.times.find(t => t.time === 'C1B');
  assert.equal(c1.anterior.data, '2026-09-22');
  assert.equal(c1.anterior.ausentes, 0);
  assert.match(L.textoWhatsApp(r), /C1B: 2 de 29 \(6,9%\) · antes 0 ↑/);
});

test('meta marca o time acima com ⚠️', () => {
  const b = baseExemplo();
  b.config.meta = 0.03;
  const r = L.resumoDoDia(b, '2026-09-21');
  const txt = L.textoWhatsApp(r);
  assert.match(txt, /\(meta 3%\)/);
  assert.match(txt, /C1B: 1 de 29 \(3,4%\).*⚠️/);
  assert.doesNotMatch(txt, /C7B: .*⚠️/);
});

test('total de pessoas muito diferente do normal fica amarelo', () => {
  const b = baseExemplo();
  const [m] = L.lerMensagens(msg('C1B', '2026-09-23', 92, 92, []), { ano: 2026 });
  const c = L.conferir(m, b);
  assert.equal(c.status, 'amarelo');
  assert.ok(c.problemas.some(p => /bem diferente do normal do C1B \(29\)/.test(p.texto)));
  const [ok] = L.lerMensagens(msg('C1B', '2026-09-23', 30, 30, []), { ano: 2026 });
  assert.equal(L.conferir(ok, b).status, 'verde');
});

test('pessoa que aparece em outro time: "mudou de time?"', () => {
  const b = baseExemplo();
  const [m] = L.lerMensagens(msg('C7B', '2026-09-23', 46, 45, [['Ana Teste', '1000001', 'Atestado médico']]), { ano: 2026 });
  const c = L.conferir(m, b);
  assert.ok(c.problemas.some(p => p.nivel === 'amarelo' && /costuma ser do C1B.*Mudou de time/.test(p.texto)));
});

test('reincidência aparece como informação sem mudar a cor', () => {
  const b = baseExemplo();
  const [m] = L.lerMensagens(msg('C7B', '2026-09-23', 46, 45, [['Bruno Exemplo', '1000002', 'Sem justificativa']]), { ano: 2026 });
  const c = L.conferir(m, b);
  const info = c.problemas.find(p => p.nivel === 'info');
  assert.match(info.texto, /Bruno Exemplo: 7ª ausência em 30 dias/);
  assert.equal(c.status, 'verde');
});

test('alertas de reincidência acham o padrão de segunda-feira', () => {
  const a = L.alertasReincidencia(baseExemplo(), '2026-09-22', 30, 3);
  const ana = a.find(x => x.matricula === '1000001');
  assert.equal(ana.total, 3);
  assert.equal(ana.padraoDia, 'Segunda');
  const bruno = a.find(x => x.matricula === '1000002');
  assert.equal(bruno.total, 6);
  assert.equal(bruno.padraoDia, null);
});

test('resumo do período: por time, por motivo e por dia da semana', () => {
  const b = baseExemplo();
  const p = L.resumoPeriodo(b, '2026-09-07', '2026-09-22');
  assert.equal(p.dias.length, 6);
  assert.deepEqual(p.times, ['C1B', 'C7B']);
  assert.equal(p.porTime.C1B.faltas, 3);
  assert.equal(p.porMotivo['Sem justificativa'], 6);
  const seg = p.porDiaSemana.find(s => s.nome === 'Segunda');
  assert.equal(seg.faltas, 6); // 3 Ana + 3 Bruno
  const txt = L.textoPeriodo(p, L.alertasReincidencia(b, '2026-09-22'));
  assert.match(txt, /07\/09\/2026 a 22\/09\/2026/);
  assert.match(txt, /\*Dia com mais falta:\* Segunda/);
  assert.match(txt, /2 pessoa\(s\) com 3 ou mais/);
});

test('cobrança lista só os pendentes', () => {
  const b = baseExemplo();
  b.config.times = ['C1B', 'C2B', 'C7B', 'C8B'];
  const r = L.resumoDoDia(b, '2026-09-22');
  assert.equal(L.textoCobranca(r), '*Absenteísmo 22/09/2026*\nAinda falta enviar: *C2B, C8B*\nPor favor, mandem assim que possível. Obrigado!');
  b.config.times = ['C1B', 'C7B'];
  assert.equal(L.textoCobranca(L.resumoDoDia(b, '2026-09-22')), '');
});

test('modelo dos líderes preenchido é lido sem nenhum aviso', () => {
  const preenchido = L.textoModelo('2026-09-24', 'C3B')
    .replace('*Turno:* ', '*Turno:* 2')
    .replace('*Total de pessoas:* ', '*Total de pessoas:* 30')
    .replace('*Presentes:* ', '*Presentes:* 29')
    .replace('*Ausentes:* ', '*Ausentes:* 1')
    .replace('*Nome:* ', '*Nome:* Diego Ficticio')
    .replace('*Matrícula:* ', '*Matrícula:* 1000009')
    .replace('*Motivo:* ', '*Motivo:* Atestado médico');
  const [m, ...resto] = L.lerMensagens(preenchido, { ano: 2026 });
  assert.equal(resto.length, 0);
  assert.equal(m.time, 'C3B');
  assert.equal(m.turno, '2º turno');
  assert.equal(m.data, '2026-09-24');
  assert.deepEqual([m.efetivo, m.presentes, m.ausentes], [30, 29, 1]);
  assert.equal(m.pessoas[0].matricula, '1000009');
  assert.deepEqual(L.conferir(m), { status: 'verde', problemas: [] });
});

test('Excel: zip válido e o backup volta igual', async () => {
  const b = baseExemplo();
  b.config.times = ['C1B', 'C7B'];
  b.config.apelidos = { viagem: 'Sem justificativa' };
  const bytes = X.gerarExcel(b, new Date(2026, 8, 24, 14, 30));
  assert.equal(bytes[0], 0x50); assert.equal(bytes[1], 0x4b); // "PK"
  const z = await X.deszipar(bytes);
  assert.ok(z['xl/workbook.xml'] && z['xl/worksheets/sheet5.xml']);
  const wb = new TextDecoder().decode(z['xl/workbook.xml']);
  assert.match(wb, /name="_backup" sheetId="5" state="hidden"/);
  assert.match(wb, /'Ausências'!\$A\$1:\$H\$10/);
  const aus = new TextDecoder().decode(z['xl/worksheets/sheet3.xml']);
  assert.match(aus, /<c r="A2" s="2"><v>46272<\/v><\/c>/); // 07/09/2026
  assert.match(aus, /Ana Teste/);
  assert.deepEqual(await X.lerBackupDoExcel(bytes), b);

  // Arquivo para conferir no Excel de verdade (testes/saida/, fora do git)
  const saida = path.join(__dirname, 'saida');
  fs.mkdirSync(saida, { recursive: true });
  fs.writeFileSync(path.join(saida, 'exemplo.xlsx'), bytes);
});

test('Excel: backup grande é dividido em várias células e volta igual', async () => {
  let b = L.baseVazia();
  for (let i = 0; i < 60; i++) {
    const d = L.somarDias('2026-06-01', i);
    const pessoas = Array.from({ length: 8 }, (_, k) => [`Pessoa Numero ${k} Ficticia`, String(2000000 + k), 'Atestado médico']);
    b = gravarTexto(b, msg('C1B', d, 40, 32, pessoas));
  }
  const bytes = X.gerarExcel(b);
  const z = await X.deszipar(bytes);
  const celulas = new TextDecoder().decode(z['xl/worksheets/sheet5.xml']).match(/<c r="A\d+"/g).length;
  assert.ok(celulas > 3, `esperava várias células, veio ${celulas}`);
  assert.deepEqual(await X.lerBackupDoExcel(bytes), b);
});

test('Excel: lê arquivo que o Excel salvou por cima (comprimido, textos compartilhados)', async (t) => {
  const arq = path.join(__dirname, 'saida', 'exemplo-salvo-pelo-excel.xlsx');
  if (!fs.existsSync(arq)) return t.skip('rode testes/conferir-no-excel.ps1 para gerar este arquivo');
  const base = await X.lerBackupDoExcel(new Uint8Array(fs.readFileSync(arq)));
  assert.equal(Object.keys(base.fechamentos).length, 12);
  assert.equal(base.config.apelidos.viagem, 'Sem justificativa');
});
