// Trava contra SQL injection: nenhuma consulta pode ser montada como texto, no site, na função do servidor e no banco.
// O ataque de verdade (textos maliciosos contra uma cópia do banco) está em banco/ferramentas/ataque-sql.mjs.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const RAIZ = path.join(__dirname, '..');
const ler = f => fs.readFileSync(path.join(RAIZ, f), 'utf8');
const SITE = ['app.js', 'painel.js', 'sincronia.js', 'acesso.js', 'lideres.js', 'leitor.js', 'excel.js', 'config.js', 'sw.js'];
const linhasDe = texto => texto.split(/\r?\n/).map((linha, i) => ({ n: i + 1, linha }));
const achados = (texto, re) => linhasDe(texto).filter(({ linha }) => re.test(linha)).map(({ n, linha }) => `${n}: ${linha.trim().slice(0, 110)}`);

test('site: nenhum SQL escrito como texto (a conversa com o banco é só pelos métodos do Supabase)', () => {
  const SQL = /\b(insert\s+into|delete\s+from|drop\s+(table|schema|function)|truncate\s+table|alter\s+table|create\s+(table|policy|function)|update\s+[a-z_."]+\s+set)\b/i;
  for (const f of SITE) assert.deepEqual(achados(ler(f), SQL), [], `${f} tem SQL escrito como texto`);
});

test('site: filtros por texto livre do PostgREST (or, like, ilike, filter com texto) não são usados', () => {
  const PERIGOSOS = /\.(or|ilike|like|textSearch|not|overlaps|containedBy)\(|\.filter\(\s*['"`]|\.match\(\s*\{/;
  for (const f of SITE) assert.deepEqual(achados(ler(f), PERIGOSOS), [], `${f} usa filtro por texto livre`);
});

test('site: tabela e função chamadas só por nome fixo, e valor nenhum entra num filtro por montagem de texto', () => {
  for (const f of SITE) {
    const src = ler(f);
    // supa.from('tabela') / cliente.from('tabela'): o nome da tabela é sempre um texto fixo
    const montadas = achados(src, /\b(supa|cliente|admin|client)\.from\((?!'[a-z_]+'\))/);
    assert.deepEqual(montadas, [], `${f}: nome de tabela montado`);
    const rpc = achados(src, /\.rpc\((?!\s*'[a-z_]+'\s*[,)])/);
    assert.deepEqual(rpc, [], `${f}: rpc com nome montado`);
    // filtros (.eq, .in, .gte...) com texto interpolado (crase com ${...}) na mesma linha
    const montados = achados(src, /\.(eq|neq|in|gt|gte|lt|lte|is)\([^)]*`[^`]*\$\{/);
    assert.deepEqual(montados, [], `${f}: filtro com texto montado`);
  }
  const usadas = new Set((ler('painel.js').match(/\.rpc\('([a-z_]+)'/g) || []).map(s => s.slice(6, -1)));
  assert.deepEqual([...usadas], ['salvar_horario_turno'], 'o site só chama a função salvar_horario_turno');
});

test('função do servidor (admin-lideres): sem SQL como texto, sem filtro livre e com o usuário validado', () => {
  const src = ler('banco/funcoes/admin-lideres/index.ts');
  assert.deepEqual(achados(src, /\b(insert\s+into|delete\s+from|drop\s+table|update\s+[a-z_.]+\s+set|select\s+.+\s+from)\b/i), []);
  assert.deepEqual(achados(src, /\.(or|ilike|like|textSearch|not)\(|\.filter\(/), []);
  assert.deepEqual(achados(src, /\.from\((?!'[a-z_]+'\))/), [], 'nome de tabela montado');
  assert.deepEqual(achados(src, /\.rpc\((?!'encerrar_sessoes')/), [], 'só chama encerrar_sessoes');
  assert.match(src, /!\/\^\[a-z0-9\._-\]\{2,40\}\$\/\.test\(usuario\)/, 'o usuário é validado por padrão fechado antes de ser usado');
  assert.match(src, /papel !== 'supervisor'/, 'só supervisor chama');
});

test('banco: nenhuma função monta SQL dinâmico e todas têm search_path fixo (retrato e migrações)', () => {
  const arquivos = ['banco/estado-atual.sql', ...fs.readdirSync(path.join(RAIZ, 'banco/migracoes')).filter(f => f.endsWith('.sql')).map(f => 'banco/migracoes/' + f)];
  assert.ok(arquivos.length >= 5, 'retrato + 4 migrações');
  for (const f of arquivos) {
    const sql = ler(f).split(/\r?\n/).map(l => l.replace(/--.*$/, '')).join('\n');     // sem comentários
    // "execute function" (gatilho) e "grant execute on function" (permissão) não são SQL dinâmico; "execute format(...)"/"execute 'texto'" são
    assert.doesNotMatch(sql, /\bexecute\s+(?!(function|procedure|on)\b)/i, `${f}: EXECUTE (SQL dinâmico)`);
    assert.doesNotMatch(sql, /\bformat\s*\(/i, `${f}: format() montando SQL`);
    assert.doesNotMatch(sql, /\bquote_(ident|literal|nullable)\b/i, `${f}: quote_* (sinal de SQL montado)`);
    const funcoes = sql.split(/create\s+(?:or\s+replace\s+)?function\s/i).slice(1);
    for (const corpo of funcoes) {
      const cabecalho = corpo.split(/\bas\s+\$/i)[0];
      assert.match(cabecalho, /search_path/i, `${f}: função sem search_path fixo: ${cabecalho.trim().slice(0, 60)}`);
    }
  }
});

test('banco: nenhuma tabela fica sem RLS e nenhuma regra libera o visitante anônimo', () => {
  const sql = ler('banco/estado-atual.sql');
  const tabelas = [...sql.matchAll(/^create table public\.(\w+)/gim)].map(m => m[1]);
  assert.ok(tabelas.length >= 9);
  for (const t of tabelas) assert.match(sql, new RegExp(`alter table public\\.${t} enable row level security`), `${t} sem RLS`);
  const regras = sql.split(/\r?\n/).filter(l => /^create policy /i.test(l));
  assert.ok(regras.length >= 25);
  // só vale regra "para todos" se ela NEGA tudo (using (false)), como a da tabela convites
  for (const r of regras.filter(l => !/using \(false\) with check \(false\)/i.test(l))) assert.doesNotMatch(r, /\bto\s+(anon|public)\b/i, `regra para visitante anônimo: ${r.slice(0, 80)}`);
  assert.ok(regras.some(l => /convites_ninguem/.test(l) && /using \(false\)/i.test(l)), 'a regra que nega tudo na tabela convites tem que continuar');
});
