// Interface real no navegador (Playwright + Chromium), aberta direto do disco (file://), sem servidor:
// seleciona um XLSX de verdade, escolhe aba, corrige mapeamento, decide no de/para, confirma, gera o pacote
// (armazenamento em memória), diagnostica, restaura versão, usa o modo Líder e a Nova Implantação.
// Pulado automaticamente se o Playwright não estiver instalado.
const test = require('node:test'), assert = require('node:assert/strict');
const path = require('path'), { execSync } = require('child_process');

function carregarPlaywright() {
  try { return require('playwright'); } catch (e) { /* tenta a instalação global */ }
  try { return require(path.join(execSync('npm root -g').toString().trim(), 'playwright')); } catch (e) { return null; }
}
const pw = carregarPlaywright();
const PAGINA = 'file://' + path.join(__dirname, '..', 'index.html');
const FIX = n => path.join(__dirname, 'fixtures', n);

test('interface: fluxo completo no navegador', { skip: !pw && 'Playwright não instalado', timeout: 180000 }, async (t) => {
  const browser = await pw.chromium.launch();
  t.after(() => browser.close());
  const pg = await (await browser.newContext({ viewport: { width: 1500, height: 1000 }, acceptDownloads: true })).newPage();
  const erros = [];
  pg.on('pageerror', e => erros.push(e.message));
  pg.on('console', m => { if (m.type() === 'error') erros.push(m.text()); });
  const toast = async () => (await pg.textContent('#toast')).trim();
  const tela = async n => { await pg.click(`.navBtn[data-view="${n}"]`); await pg.waitForSelector(`.tela[data-tela="${n}"].ativa`); };
  await pg.goto(PAGINA);
  await pg.waitForSelector('body[data-pronto="1"]');

  await t.test('interface original preservada (hero, 9 botões, bilíngue)', async () => {
    assert.equal(await pg.$$eval('.navBtn', e => e.length), 9);
    assert.match(await pg.textContent('.heroTitle'), /数据智能标准化工具/);
    assert.equal(await pg.textContent('#qualityNum'), '—', 'sem dados, sem nota inventada');
  });
  await t.test('armazenamento em memória', async () => {
    await tela('config'); await pg.click('[data-st="memory"]');
    await pg.waitForFunction(() => /Memória/.test(document.querySelector('#toast').textContent));
  });
  await t.test('seleciona XLSX real, detecta aba e cabeçalho', async () => {
    await tela('inicio'); await pg.click('#startImport');
    await pg.setInputFiles('#fileInput', FIX('Funcionarios_C3_nao_padronizado.xlsx'));
    assert.match(await pg.textContent('#fileMeta'), /Funcionarios_C3_nao_padronizado\.xlsx/);
    await pg.click('#simulateBtn');
    await pg.waitForSelector('.tela[data-tela="importacao"].ativa');
    const itens = await pg.$$eval('.abaItem', e => e.map(x => ({ nome: x.dataset.aba, marcada: x.querySelector('.selAba').checked })));
    assert.deepEqual(itens, [{ nome: 'Capa', marcada: false }, { nome: 'Lista Funcionários', marcada: true }]);
    assert.equal(await pg.inputValue('.linhaCab[data-i="1"]'), '4');
  });
  await t.test('mapeamento: mostra confiança, LGPD e permite corrigir', async () => {
    await pg.click('#irMapear');
    await pg.waitForSelector('.selCampo');
    assert.match(await pg.textContent('#telaMapeamento'), /CPF/);
    const idx = await pg.$eval('.selCampo', s => s.dataset.indice);
    await pg.selectOption(`.selCampo[data-indice="${idx}"]`, '');
    assert.equal(await pg.$eval(`.selCampo[data-indice="${idx}"]`, s => s.value), '');
    await pg.selectOption(`.selCampo[data-indice="${idx}"]`, 'nome');
    await pg.fill('#nomePerfil', 'Lista de funcionários B'); await pg.click('#salvarPerfil');
    assert.match(await toast(), /Perfil "Lista de funcionários B" salvo/);
  });
  await t.test('normalização: decisão no de/para muda o dado', async () => {
    await pg.click('#processar');
    await pg.waitForSelector('.tela[data-tela="normalizacao"].ativa', { timeout: 30000 });
    const linha = pg.locator('.depara', { hasText: 'Soldador' });
    await linha.locator('select.corr').selectOption('OPERADOR_PRODUCAO');
    await linha.locator('.aliasDp').check();
    await linha.locator('[data-acao="CORRIGIR"]').click();
    await pg.waitForFunction(() => /Corrigido: "Soldador"/.test(document.querySelector('#toast').textContent));
    assert.equal(await pg.locator('.depara', { hasText: 'Soldador' }).count(), 0);
  });
  await t.test('validação: nota, pendências e confirmação', async () => {
    await tela('validacao');
    assert.match(await pg.textContent('#telaValidacao'), /Como a nota foi calculada/);
    assert.ok(await pg.$$eval('.issue', e => e.length) > 0);
    await pg.click('#confirmar'); await pg.click('#okConf');
    await pg.waitForFunction(() => /aplicada às bases/.test(document.querySelector('#toast').textContent));
  });
  await t.test('geração: checklist só com etapas reais', async () => {
    await tela('geracao'); await pg.click('#gerarCompleto');
    await pg.waitForSelector('#telaGeracao .checklist', { timeout: 60000 });
    assert.match(await toast(), /6 base\(s\) \+ Configurações \+ Manifesto/);
    assert.ok(await pg.$$eval('#telaGeracao .checklist .x', e => e.length) === 0);
    await pg.click('#gerarCompleto');
    await pg.waitForFunction(() => /BACKUP/.test(document.querySelector('#telaGeracao').textContent), null, { timeout: 60000 });
  });
  await t.test('diagnóstico reconhece a instalação', async () => {
    await tela('config'); await pg.click('#diagRodar');
    await pg.waitForSelector('#diagCarregar', { timeout: 30000 });
    assert.match(await pg.textContent('#blocoDiagnostico'), /Instalação C3B reconhecida/);
  });
  await t.test('histórico: versões e restauração', async () => {
    await tela('historico'); await pg.click('#verListar');
    await pg.waitForSelector('.verRestaurar', { timeout: 30000 });
    await pg.click('.verRestaurar'); await pg.click('#okConf');
    await pg.waitForFunction(() => /Restaurada a v1/.test(document.querySelector('#toast').textContent), null, { timeout: 30000 });
  });
  await t.test('dicionário: alias criado na normalização aparece', async () => {
    await tela('dicionario'); await pg.click('[data-dic-aba="aliases"]');
    assert.match(await pg.textContent('#telaDicionario'), /Soldador/);
  });
  await t.test('modo Líder esconde controles administrativos', async () => {
    await pg.click('#perfilModo');
    assert.equal(await pg.evaluate(() => document.body.classList.contains('modo-lider')), true);
    assert.equal(await pg.isVisible('#alCriar'), false);
    await pg.click('#perfilModo');
  });
  await t.test('Nova Implantação sem planilha até gerar', async () => {
    await tela('config'); await pg.fill('#cfgRaiz', 'NOVA'); await pg.press('#cfgRaiz', 'Tab');
    await tela('inicio'); await pg.click('#startNova');
    await pg.fill('.wzMeta[data-k="empresa"]', 'Empresa Teste'); await pg.fill('.wzMeta[data-k="equipe"]', 'C3B');
    await pg.check('.wzModelo[value="SA6H"]'); await pg.check('#wzNovoProjeto');
    await pg.click('#wzP1');
    await pg.fill('.wzPes[data-i="0"][data-k="matricula"]', '001234'); await pg.fill('.wzPes[data-i="0"][data-k="nome"]', 'Pessoa Um');
    await pg.fill('.wzPes[data-i="1"][data-k="matricula"]', '001235'); await pg.fill('.wzPes[data-i="1"][data-k="nome"]', '李明');
    await pg.click('#wzPesAdd'); await pg.waitForFunction(() => /2 pessoa/.test(document.querySelector('#toast').textContent));
    await pg.selectOption('.wzOp[data-i="0"][data-k="modelo"]', 'SA6H'); await pg.fill('.wzOp[data-i="0"][data-k="estacao"]', 'C16L1'); await pg.fill('.wzOp[data-i="0"][data-k="descricao_pt"]', 'Aperto do suporte');
    await pg.click('#wzOpAdd'); await pg.waitForFunction(() => /1 operação/.test(document.querySelector('#toast').textContent));
    await pg.click('#wzTodasP'); await pg.check('.wzMarcaO'); await pg.selectOption('#wzNivel', 'I'); await pg.click('#wzMarcar');
    await pg.waitForFunction(() => /2 evento/.test(document.querySelector('#toast').textContent));
    await pg.click('[data-wz="4"]'); await pg.click('[data-wz="5"]'); await pg.click('#wzGerar');
    await pg.waitForFunction(() => /Pacote gerado/.test(document.querySelector('#toast').textContent), null, { timeout: 60000 });
  });
  await t.test('sem erros no console', () => assert.deepEqual(erros, []));
});
