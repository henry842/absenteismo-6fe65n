// Roda a bateria de testes e monta a tabela "Funcionalidade → Resultado" (seção 78) a partir do resultado REAL
// de cada teste (TAP). Nada é marcado PASS sem um teste que tenha passado. Grava RELATORIO_TESTES.md.
// Uso: npm run relatorio
const { spawnSync } = require('child_process'), fs = require('fs'), path = require('path');
const raiz = path.join(__dirname, '..');
const arquivos = fs.readdirSync(path.join(raiz, 'tests')).filter(f => f.endsWith('.test.js')).map(f => path.join('tests', f));
const r = spawnSync(process.execPath, ['--test', '--test-concurrency=1', '--test-reporter=tap', ...arquivos], { cwd: raiz, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const saida = r.stdout;

// Resultado de cada teste (inclusive subtestes): nome → ok | falha | pulado
const testes = new Map();
for (const l of saida.split('\n')) {
  const m = l.match(/^\s*(not ok|ok) \d+ - (.+?)(\s+# SKIP.*)?$/);
  if (m) testes.set(m[2].trim(), m[3] ? 'SKIPPED' : m[1] === 'ok' ? 'PASS' : 'FAILED');
}

// Funcionalidade → testes que a comprovam (todos precisam passar)
const MAPA = [
  ['XLSX import', [/^XLSX: abas/, /^XLSX: número com formato/]],
  ['XLSM import (sem executar macro)', [/^XLSM:/]],
  ['CSV import', [/^CSV Windows-1252/, /^CSV UTF-8/]],
  ['.xls antigo recusado com orientação', [/^\.xls antigo/]],
  ['Formato pelo conteúdo, não pelo nome', [/^não confia no nome/]],
  ['Header detection', [/^planilha não padronizada/, /seleciona XLSX real/]],
  ['Header mapping', [/^mapeamento com confiança/, /^planilha não padronizada/, /^4\. mapear cabeçalhos/]],
  ['Correção manual de mapeamento (UI)', [/^mapeamento: mostra confiança/]],
  ['Station parser', [/^estações:/]],
  ['Model parser', [/^modelos:/]],
  ['Normalização segura (nunca inventa)', [/^nunca inventa/, /^aliases: valor desconhecido/]],
  ['Aliases', [/^aliases: turno/, /^aliases do usuário/, /^de\/para: corrigir com alias/, /^8\. salvar alias/]],
  ['Skill levels i/I/L/U', [/^nível de habilidade/]],
  ['Stable IDs', [/^IDs estáveis/]],
  ['Quality score', [/^Quality Score/, /^11\. calcular Quality Score/]],
  ['Duplicate detection', [/^duplicidade de operações/, /^9\. detectar duplicidade/, /^10\. resolver/]],
  ['Integrity validation', [/^integridade referencial/, /^12\. validar referências/]],
  ['Profiles', [/^perfis:/]],
  ['Seven independent schemas', [/^as 7 bases/, /^dicionário: 7 bases/]],
  ['XLSX export', [/^gera \.xlsx oficial/, /^13\. gerar XLSX/]],
  ['Reopen generated workbook', [/^14\. reabrir XLSX/, /^15\. validar conteúdo/, /^leitor independente/]],
  ['Manifest', [/^16\. gerar Manifesto/]],
  ['Installation from scratch', [/^instalação: cria os 8/]],
  ['Installation diagnosis', [/^diagnóstico: base ausente/, /^20\. mostrar diagnóstico/]],
  ['Generate missing bases', [/^diagnóstico: base ausente/]],
  ['Backup', [/^regravar: faz backup/]],
  ['Rollback', [/^rollback:/]],
  ['Conflict detection', [/^conflitos 3 vias/]],
  ['Diff / soft delete', [/^comparação de versões/]],
  ['Matrix + History (append-only, idempotent)', [/^Matriz \+ Histórico/, /histórico só de acréscimo/]],
  ['Analysis / simulation modes', [/^modos: ANALISE e SIMULACAO/]],
  ['Cancellation', [/^cancelamento/]],
  ['Legacy: history one sheet per person', [/^legado: histórico/]],
  ['Legacy: planning matrix', [/^legado: planejamento/]],
  ['Legacy: rotation control', [/^legado: controle de revezamento/]],
  ['LGPD minimization', [/^LGPD:/, /^planilha não padronizada/]],
  ['Path traversal blocked', [/^caminhos:/, /^storage confinado/, /path traversal é recusado/]],
  ['Local bridge', [/^bridge: segurança/]],
  ['Configuration persistence', [/^configurações: aliases/, /^configuração ⇄ abas/]],
  ['Chinese text preservation', [/^texto: acentos e chinês/, /^gera \.xlsx oficial/, /^CSV UTF-8/]],
  ['Accents (Windows-1252)', [/^CSV Windows-1252/]],
  ['Leading-zero matricula', [/^matrícula é sempre texto/, /^XLSX: número com formato/]],
  ['Manual creation', [/^edição em massa/, /Nova Implantação sem planilha/]],
  ['Mass edit with preview', [/^edição em massa/]],
  ['Audit report (.xlsx)', [/^relatório da importação/]],
  ['Large file (5,000 rows)', [/^arquivo grande/]],
  ['BYD: ellipse → TITULAR', [/^BYD 1:/]],
  ['BYD: triangle → EM_TREINAMENTO', [/^BYD 2:/]],
  ['BYD: ellipse + triangle → FUTURO_TITULAR', [/^BYD 3:/]],
  ['BYD: overlapping ellipses → one TITULAR', [/^BYD 4:/]],
  ['BYD: marker 1 → skill_level L', [/^BYD 5:/]],
  ['BYD: triangle without 1 → no invented L', [/^BYD 6:/]],
  ['BYD: fill GREEN', [/^BYD 7:/]],
  ['BYD: fill YELLOW', [/^BYD 8:/]],
  ['BYD: shape origin recorded', [/^BYD 9:/]],
  ['BYD: Base Operacional generated and reopened', [/^BYD 10:/, /^BYD: leitor independente/]],
  ['BYD: unusual combinations → WARNING', [/^BYD validações/]],
  ['BYD: color is metadata only (L is L)', [/^BYD 8:/, /cor é só metadado/]],
  ['BYD: known residue "c" (profile only)', [/^BYD resíduo/, /resíduo "c" só no log/]],
  ['BYD: possible same person → confirm, alias, recalc', [/^BYD pessoas:/]],
  ['People dedup (universal, assisted)', [/^pessoas parecidas \(universal\)/]],
  ['Pending categories (config × data × warning)', [/^BYD pendências por categoria/]],
  ['BYD: final sanity check', [/^BYD validação final/]],
  ['BYD REAL: 4 models · 123 ops · 41 people', [/^sanity check após confirmar/]],
  ['BYD: panel in the browser', [/^Matriz BYD: painel/]],
  ['BYD: REAL reference matrix', [/^Matriz BYD real:/]],
  ['Manual adjustments: person edit (matrícula → ID)', [/^AJ 1:/]],
  ['Manual adjustments: remove never deletes (REMOVE override)', [/^AJ 2:/]],
  ['Manual adjustments: add skill / fix operation', [/^AJ 3:/]],
  ['Manual adjustments: validations (reason, level, enum)', [/^AJ 4:/]],
  ['Manual adjustments: undo + history', [/^AJ 5:/, /^Perfil da pessoa:/]],
  ['Official change → HISTORICO_OFICIAL (pending in Matriz)', [/^AJ 6:/]],
  ['Adjustments survive Matriz update + reconciliation', [/^AJ 7:/]],
  ['Base Operacional: AJUSTES_MANUAIS / LOG / effective × source', [/^AJ 8:/]],
  ['Adjustments persisted in 07_Configuracoes', [/^AJ 9:/]],
  ['Person profile in the browser', [/^Perfil da pessoa:/]],
  ['E2E 20 steps', [/^E2E:/]],
  ['UI end to end (browser, file://)', [/^interface: fluxo completo/]],
];

const linhas = MAPA.map(([func, padroes]) => {
  const achados = padroes.map(p => [...testes.entries()].filter(([n]) => p.test(n)));
  let res;
  if (achados.some(a => !a.length)) res = 'NOT TESTED';
  else {
    const todos = achados.flat().map(([, s]) => s);
    res = todos.includes('FAILED') ? 'FAILED' : todos.every(s => s === 'SKIPPED') ? 'SKIPPED' : todos.includes('SKIPPED') ? 'PARTIAL' : 'PASS';
  }
  return [func, res, achados.flat().length];
});
const total = [...testes.values()];
const cont = s => total.filter(x => x === s).length;
const larg = Math.max(...linhas.map(l => l[0].length)) + 2;
const tabela = ['Funcionalidade'.padEnd(larg) + 'Resultado  (testes)', ...linhas.map(([f, r, n]) => f.padEnd(larg) + r.padEnd(11) + `(${n})`)].join('\n');
const md = `# Relatório de testes — Padronizador C3B

Gerado por \`npm run relatorio\` em ${new Date().toISOString()} (Node ${process.version}).
Matriz BYD real: ${process.env.C3B_MATRIZ_REAL ? 'testada (C3B_MATRIZ_REAL definida; o arquivo não fica no repositório)' : 'NÃO testada nesta execução (defina C3B_MATRIZ_REAL)'}.
Cada linha só é PASS se todos os testes que a comprovam passaram nesta execução.

\`\`\`
${tabela}
\`\`\`

Testes executados (inclui subtestes): ${total.length} · PASS ${cont('PASS')} · FAILED ${cont('FAILED')} · SKIPPED ${cont('SKIPPED')}

## Todos os testes

${[...testes.entries()].map(([n, s]) => `- ${s === 'PASS' ? '✓' : s === 'SKIPPED' ? '–' : '✕'} ${n}${s !== 'PASS' ? ` (${s})` : ''}`).join('\n')}
`;
fs.writeFileSync(path.join(raiz, 'RELATORIO_TESTES.md'), md);
console.log(tabela + `\n\n${total.length} testes · PASS ${cont('PASS')} · FAILED ${cont('FAILED')} · SKIPPED ${cont('SKIPPED')}\nRelatório: RELATORIO_TESTES.md`);
process.exit(r.status === 0 ? 0 : 1);
