// Matriz BYD REAL (arquivo de referência "Planejamento de Treinamento de Habilidades C3B").
// O arquivo tem nomes de pessoas reais e NÃO fica no repositório: o teste roda quando a variável
// C3B_MATRIZ_REAL aponta para ele (ex.: C3B_MATRIZ_REAL=/caminho/COPIA-TRABALHO-Planejamento-Treinamento-C3B.xlsx npm test).
// As verificações usam endereços de células e contagens, nunca nomes de pessoas.
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('fs'), crypto = require('crypto');
const { S } = require('./ajuda.js');
const ARQ = process.env.C3B_MATRIZ_REAL;
const pular = !ARQ ? 'defina C3B_MATRIZ_REAL com o caminho da Matriz BYD real' : !fs.existsSync(ARQ) ? `arquivo não encontrado: ${ARQ}` : false;

test('Matriz BYD real: designação pelas formas, nível pelo marcador, cor real e Base Operacional', { skip: pular, timeout: 180000 }, async (t) => {
  const bytes = fs.readFileSync(ARQ);
  const hashAntes = crypto.createHash('sha256').update(bytes).digest('hex');
  const r = await S.byd.extrair(bytes, { arquivo: 'matriz-real.xlsx' });
  const bloco = b => r.registros.find(x => x.source_block === b);
  const res = Object.fromEntries(r.resumo.map(x => [x.sheet, x]));

  await t.test('abas de modelo reconhecidas; exemplo ignorado', () => {
    assert.deepEqual(r.abas.map(a => a.sheet), ['EQE', 'HA2H', 'SA6H', 'SC3H']);
    assert.ok(r.pendencias.some(p => p.codigo === 'ABA_EXEMPLO_IGNORADA'));
    assert.deepEqual([res.SA6H.operadores, res.SA6H.operacoes], [41, 37]);
    assert.ok(r.abas.every(a => a.layout.operadores.every(o => o.lMarkerFonte === 'FORMULA')), 'marcador L confirmado pela fórmula em todas as abas');
  });
  await t.test('drawings lidos: drawing1..4 ligados às abas certas', () => {
    assert.deepEqual(r.abas.map(a => a.drawing_file), ['xl/drawings/drawing1.xml', 'xl/drawings/drawing2.xml', 'xl/drawings/drawing3.xml', 'xl/drawings/drawing4.xml']);
  });
  await t.test('ellipse + triangle → FUTURO_TITULAR (SA6H C9, exemplo da especificação)', () => {
    const x = bloco('SA6H!C9:F12');
    assert.equal(x.assignment_status, 'FUTURO_TITULAR'); assert.equal(x.skill_level, 'NAO_IDENTIFICADO');
    assert.match(x.source_triangle_anchor, /drawing3\.xml#.*@E9:E10$/); assert.match(x.source_circle_anchor, /drawing3\.xml#.*@E11:E11$/);
    assert.deepEqual([x.first_date, x.latest_date], ['2026-08-12', '2026-08-14']);
  });
  await t.test('duas ellipses sobrepostas em AO46 → um único TITULAR', () => {
    const x = bloco('SA6H!AM45:AP48');
    assert.equal(x.assignment_status, 'TITULAR');
    const f = r.origem.filter(o => o.purpose === 'CURRENT_OPERATOR_MARKER' && o.sheet === 'SA6H' && o.employee_id === x.employee_id && o.operation_id === x.operation_id);
    assert.equal(f.length, 2); assert.equal(f.filter(o => o.dedup).length, 1);
    assert.ok(f.every(o => o.anchor_from_row === 45 && o.anchor_from_col === 40), 'âncora 0-based AO46');
  });
  await t.test('contagens por aba (formas deduplicadas)', () => {
    assert.deepEqual(['EQE', 'HA2H', 'SA6H', 'SC3H'].map(s => [res[s].titulares, res[s].em_treinamento, res[s].futuros_titulares]), [[22, 6, 0], [31, 0, 3], [32, 1, 7], [0, 0, 0]]);
  });
  await t.test('nível L = marcadores 1; confere com a fórmula da própria planilha (exceto 1 resultado salvo desatualizado)', () => {
    assert.deepEqual(['EQE', 'HA2H', 'SA6H', 'SC3H'].map(s => res[s].nivel_L), [202, 212, 205, 0]);
    const formula = s => r.abas.find(a => a.sheet === s).layout.operadores.reduce((t2, o) => t2 + (o.totalLFormula || 0), 0);
    assert.deepEqual(['HA2H', 'SA6H', 'SC3H'].map(formula), [212, 205, 0]);
    const dif = r.pendencias.filter(p => p.codigo === 'TOTAL_L_DIFERENTE');
    assert.equal(dif.length, 1); assert.equal(dif[0].sheet, 'EQE');
  });
  await t.test('skill_level e assignment_status independentes', () => {
    const par = (l, a) => r.registros.filter(x => x.skill_level === l && x.assignment_status === a).length;
    assert.ok(par('L', 'TITULAR') > 0); assert.ok(par('NAO_IDENTIFICADO', 'EM_TREINAMENTO') > 0); assert.ok(par('NAO_IDENTIFICADO', 'FUTURO_TITULAR') > 0);
    assert.ok(par('L', 'SEM_DESIGNACAO') > 0, 'ter L não cria titularidade');
  });
  await t.test('cores reais: GREEN e YELLOW nos blocos com L', () => {
    assert.deepEqual(['EQE', 'HA2H', 'SA6H'].map(s => [res[s].fill_green, res[s].fill_yellow]), [[121, 18], [93, 19], [74, 20]]);
    const amarelosComL = r.registros.filter(x => x.fill_state === 'YELLOW' && x.skill_level === 'L').length;
    assert.ok(amarelosComL > 0, 'há L com fundo amarelo: cor não é sinônimo de L');
  });
  await t.test('legenda (○ △ abaixo da grade) ignorada e registrada', () => {
    const leg = r.origem.filter(o => o.purpose === 'LEGEND_SHAPE_IGNORED').map(o => `${o.sheet}:${o.anchor_a1}`);
    for (const e of ['EQE:AB94', 'EQE:AB95', 'SA6H:AE159', 'SC3H:AC138', 'SC3H:AC139']) assert.ok(leg.some(l => l.startsWith(e)), e);
  });
  await t.test('Base Operacional gerada, reaberta e conferida; arquivo original intacto', async () => {
    const base = await S.byd.gerarBaseOperacional(r, { origem_hash: hashAntes });
    const v = await S.byd.verificarBaseOperacional(base, r);
    assert.equal(v.ok, true, JSON.stringify(v.checks.filter(c => !c.ok)));
    assert.equal(v.lido.abas.MATRIZ_LONGA.length, r.registros.length);
    assert.equal(crypto.createHash('sha256').update(fs.readFileSync(ARQ)).digest('hex'), hashAntes);
  });
});
