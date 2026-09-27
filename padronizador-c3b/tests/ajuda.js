// Utilidades dos testes: fixtures, pasta temporária e uma importação completa pelo mesmo fluxo da interface.
const fs = require('fs'), path = require('path'), os = require('os');
const S = require('../src/servicos.js');

const FIXTURES = path.join(__dirname, 'fixtures');
const fixture = nome => new Uint8Array(fs.readFileSync(path.join(FIXTURES, nome)));
const pastaTemp = prefixo => fs.mkdtempSync(path.join(os.tmpdir(), `c3b-${prefixo}-`));

// Importa um arquivo: aceita as sugestões, aplica valores fixos e decisões opcionais, processa e confirma.
async function importar(pacote, arquivo, { fixos = {}, decidir = null, override = null, modo = 'IMPORTACAO', confirmar = true, ausentes = {} } = {}) {
  const bytes = typeof arquivo === 'string' ? fixture(arquivo) : arquivo.bytes;
  const nome = typeof arquivo === 'string' ? arquivo : arquivo.nome;
  const s = await S.importacao.iniciar({ bytes, nome, pacote, modo, usuario: 'teste' });
  if (s.erro) throw s.erro;
  const selecionadas = s.abas.filter(a => a.selecionada).sort((a, b) => S.importacao.ORDEM.indexOf(a.schema) - S.importacao.ORDEM.indexOf(b.schema));
  for (const a of selecionadas) {
    S.importacao.mapear(s, a.nome, a.schema);
    for (const [campo, v] of Object.entries(Object.assign({}, a.sugestoesValorFixo || {}, fixos[a.schema] || {}))) S.importacao.definirValorFixo(s, a.nome, campo, v);
    await S.importacao.processar(s, a.nome);
    if (decidir) await decidir(s, a.nome);
  }
  if (!confirmar) return { sessao: s };
  if (modo !== 'IMPORTACAO') return { sessao: s, lote: S.importacao.encerrarSemGravar(s) };
  const r = S.importacao.confirmar(s, { override, ausentes });
  return { sessao: s, ...r };
}

module.exports = { S, fixture, pastaTemp, importar, FIXTURES };
