// Ataque de SQL injection de verdade, num Postgres em memória (nada toca o banco de verdade) montado a partir do retrato do banco
// (banco/estado-atual.sql: tabelas, regras de acesso, funções e gatilhos) e das migrações c e d. Dispara 12 textos maliciosos como líder e como
// visitante anônimo e confere que nada vira comando. Rode de novo depois de qualquer migração nova.
//
// Como rodar (precisa do Node 18+): na pasta banco/ferramentas, uma vez:  npm init -y && npm install @electric-sql/pglite@0.3.14
// e depois:  node ataque-sql.mjs   (termina com "TUDO CERTO" ou com a lista do que falhou)
import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const RAIZ = fileURLToPath(new URL('../../', import.meta.url)).replace(/\\/g, '/');
const retrato = fs.readFileSync(RAIZ + 'banco/estado-atual.sql', 'utf8').replace(/\r/g, '');
const mig = n => fs.readFileSync(RAIZ + 'banco/migracoes/' + n, 'utf8');
const linhas = retrato.split('\n');
const pega = re => linhas.filter(l => re.test(l));
function funcao(nome) {
  const i = retrato.indexOf(`CREATE OR REPLACE FUNCTION public.${nome}(`);
  if (i < 0) throw new Error('função não achada: ' + nome);
  return retrato.slice(i, retrato.indexOf('$function$;', retrato.indexOf('$function$', i) + 10) + '$function$;'.length);
}
const H = '00000000-0000-0000-0000-0000000000a1', C1 = '00000000-0000-0000-0000-0000000000b1', C2 = '00000000-0000-0000-0000-0000000000b2';

const db = new PGlite();
await db.exec(`
  create role anon nologin; create role authenticated nologin; create role service_role nologin;
  create schema auth; create table auth.users (id uuid primary key, email text);
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(coalesce(nullif(current_setting('request.jwt.claim.sub', true), ''), (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')), '')::uuid $$;`);
const T = 'auditoria|convites|envios|funcionarios|lancamentos|parametros|perfis|registros|textos_editados';
await db.exec(pega(new RegExp(`^create table public\\.(${T}) `)).map(l => l.replace('id bigint not null, quando', 'id bigint generated always as identity, quando')).join('\n'));
await db.exec(pega(new RegExp(`^alter table (${T}) add constraint `)).join('\n'));
await db.exec(pega(/^create (UNIQUE )?index (funcionarios|perfis|lancamentos)_/i).join('\n'));
await db.exec(['papel_atual', 'time_atual', 'registrar_auditoria', 'limitar_lancamentos', 'marcar_atualizado'].map(funcao).join('\n'));
await db.exec(`
  ${T.split('|').map(t => `alter table public.${t} enable row level security;`).join('\n')}
  ${pega(new RegExp(`^create policy ("[^"]+"|\\S+) on public\\.(${T}) `)).filter(l => !/func_lider_/.test(l)).join('\n')}
  ${pega(/^CREATE TRIGGER (auditoria_\w+|lancamentos_atualizado|lancamentos_limite|parametros_atualizado) /).join('\n')}
  grant usage on schema public to anon, authenticated, service_role; grant all on all tables in schema public to anon, authenticated, service_role; grant usage on schema auth to anon, authenticated, service_role;
  insert into auth.users (id) values ('${H}'), ('${C1}'), ('${C2}');
  insert into public.perfis (user_id, papel, usuario, nome, "time") values ('${H}', 'supervisor', 'henry', 'Henry', null), ('${C1}', 'lider', 'c1b', 'Líder 1', 'C1B'), ('${C2}', 'lider', 'c2b', 'Líder 2', 'C2B');
  insert into public.funcionarios (nome, matricula, "time", cargo, turno) values ('Ana Exemplo', '1000001', 'C1B', 'Operador', '2° Turno'), ('Bia Exemplo', '1000002', 'C2B', 'Operador', '2° Turno'), ('Caio Exemplo', '1000003', 'C2B', 'Operador', '2° Turno');
  insert into public.lancamentos (data, "time", tipo, matricula, nome, motivo, lider_id) values (current_date, 'C1B', 'ausencia', '1000001', 'Ana Exemplo', 'Sem justificativa', '${C1}'), (current_date, 'C2B', 'ausencia', '1000002', 'Bia Exemplo', 'Sem justificativa', '${C2}');
`);
await db.exec(mig('20260930c_lider_cadastra_colaborador.sql')); await db.exec(mig('20260930d_lider_corrige_colaborador.sql'));
// os testes embutidos podem ter tocado a auditoria: começa limpo e conta tudo a partir daqui
const policiasLanc = (await db.query(`select count(*)::int n from pg_policies where tablename = 'lancamentos'`)).rows[0].n;
console.log(`Banco de teste: ${(await db.query('select count(*)::int n from pg_policies')).rows[0].n} regras de acesso (${policiasLanc} em lancamentos), RLS ligado nas ${T.split('|').length} tabelas.\n`);

const falhou = [];
const confere = (ok, msg) => { console.log((ok ? '  ok   ' : '  FALHOU ') + msg); if (!ok) falhou.push(msg); };
process.on('uncaughtException', e => { console.log('ERRO: ' + String(e.message).slice(0, 300)); process.exit(2); });

const PAYLOADS = [
  ["fecha aspas e apaga a tabela", "'; DROP TABLE public.funcionarios; --"],
  ["fecha o parêntese e apaga lançamentos", "Robert'); DELETE FROM public.lancamentos; --"],
  ["sempre verdadeiro", "' OR '1'='1"],
  ["UNION para ler os logins", "x' UNION SELECT usuario FROM public.perfis --"],
  ["dólar-aspas para escapar", "$$; DROP SCHEMA public CASCADE; $$"],
  ["promover a supervisor", "Ana'; UPDATE public.perfis SET papel='supervisor' WHERE true; --"],
  ["mudar todos de time", "'; UPDATE public.funcionarios SET \"time\"='C2B'; --"],
  ["travar o banco (pg_sleep)", "'; SELECT pg_sleep(20); --"],
  ["apóstrofo unicode", "ʼ; DROP TABLE public.funcionarios; --"],
  ["barra invertida", "\\'; DROP TABLE public.funcionarios; --"],
  ["texto com codificação de URL", "%27%20OR%201%3D1%3B%20DROP%20TABLE%20funcionarios"],
  ["comentário de bloco", "/* */; DROP TABLE public.lancamentos; /*"],
];

async function comoUsuario(uid, papel, fn) {
  await db.exec(`begin; set local role ${papel}; select set_config('request.jwt.claims', json_build_object('sub','${uid || ''}','role','${papel}')::text, true), set_config('request.jwt.claim.sub','${uid || ''}', true);`);
  try { return await fn(); } finally { await db.exec('rollback;'); }
}
const sp = async (sql, params) => { await db.exec('savepoint s'); try { const r = await db.query(sql, params); await db.exec('release s'); return { r }; } catch (e) { await db.exec('rollback to s'); return { e }; } };
const estado = async () => ({
  tabelas: (await db.query(`select count(*)::int n from pg_tables where schemaname='public'`)).rows[0].n,
  func: (await db.query('select count(*)::int n from public.funcionarios')).rows[0].n,
  lanc: (await db.query('select count(*)::int n from public.lancamentos')).rows[0].n,
  papeis: JSON.stringify((await db.query(`select usuario, papel from public.perfis order by usuario`)).rows),
  times: JSON.stringify((await db.query(`select "time", count(*)::int n from public.funcionarios group by 1 order by 1`)).rows),
});
const base = await estado();

console.log('== 1. Controle: o MESMO texto, montado por concatenação (do jeito ERRADO), causaria estrago ==');
await db.exec('begin');
await db.exec(`insert into public.funcionarios (nome, matricula, "time") values ('${PAYLOADS[0][1].replace("'; DROP", "x'); DROP")}', '', 'C1B')`).catch(() => {});
const aposNaive = await db.query(`select count(*)::int n from pg_tables where schemaname='public' and tablename='funcionarios'`).catch(() => ({ rows: [{ n: 0 }] }));
await db.exec('rollback');
confere(aposNaive.rows[0].n === 0, 'concatenando o texto no SQL (como NÃO fazemos) a tabela funcionarios seria apagada: o ataque é real');
console.log('');

console.log('== 2. Como o sistema faz (valores enviados à parte do SQL): líder tenta cada ataque em todos os campos de texto ==');
for (const [rotulo, p] of PAYLOADS) {
  const antes = await estado();
  const saida = await comoUsuario(C1, 'authenticated', async () => {
    const campos = [];
    // cadastrar colaborador (nome, cargo, turno; a matrícula só aceita números e deve ser recusada)
    const ins = await sp(`insert into public.funcionarios (nome, matricula, "time", cargo, turno) values ($1, '', 'C1B', $2, $3) returning nome, cargo, turno`, [p, p.slice(0, 60), p.slice(0, 30)]);
    campos.push(['cadastro', !!ins.r && ins.r.rows[0].nome === p && ins.r.rows[0].cargo === p.slice(0, 60) && ins.r.rows[0].turno === p.slice(0, 30), ins.e && ins.e.message]);
    const mat = await sp(`insert into public.funcionarios (nome, matricula, "time") values ('Fulano de Tal', $1, 'C1B')`, [p]);
    campos.push(['matrícula recusada', !!mat.e && /funcionarios_matricula_check|check/i.test(mat.e.message), mat.e && mat.e.message]);
    // corrigir nome, cargo e turno (UPDATE)
    const upd = await sp(`update public.funcionarios set nome = $1, cargo = $2, turno = $3 where matricula = '1000001' returning nome`, [p, p.slice(0, 60), p.slice(0, 30)]);
    campos.push(['correção', !!upd.r && upd.r.rows.length === 1 && upd.r.rows[0].nome === p, upd.e && upd.e.message]);
    // lançar ausência com motivo e justificativa maliciosos
    const l = await sp(`insert into public.lancamentos (data, "time", tipo, matricula, nome, motivo, justificativa) values (current_date, 'C1B', 'ausencia', '1000009', $1, $2, $3) returning justificativa`, [p, p.slice(0, 60), p]);
    campos.push(['lançamento', !!l.r && l.r.rows[0].justificativa === p, l.e && l.e.message]);
    // filtro malicioso: o valor entra como texto, não como lógica
    const f = await db.query(`select count(*)::int n from public.funcionarios where nome = $1`, [p]);
    // filtro "esperto" montado pelo atacante com o token dele: a regra por linha ainda vale (só o time dele)
    const esperto = await db.query(`select count(*)::int n, count(distinct "time")::int times from public.funcionarios where nome = $1 or true`, [p]);
    campos.push(['filtro com OR true só enxerga o próprio time', esperto.rows[0].times === 1, null]);
    return campos;
  });
  const depois = await estado();
  const intacto = depois.tabelas === antes.tabelas && depois.papeis === antes.papeis && depois.times === antes.times && depois.func === antes.func && depois.lanc === antes.lanc;
  confere(saida.every(c => c[1]) && intacto, `${rotulo}: tudo guardado como texto puro, tabelas/papéis/times intactos` + (saida.some(c => !c[1]) ? ' — ' + saida.filter(c => !c[1]).map(c => c[0] + ': ' + c[2]).join('; ') : ''));
}
console.log('');

console.log('== 3. Caracteres que o Postgres não aceita (byte nulo): vira erro simples, sem gravar nada ==');
await comoUsuario(C1, 'authenticated', async () => {
  const r = await sp(`insert into public.funcionarios (nome, matricula, "time") values ($1, '', 'C1B')`, ['Ana\u0000x']);
  confere(!!r.e, 'byte nulo no nome é recusado pelo banco (' + (r.e && r.e.message.slice(0, 50)) + ')');
});
console.log('');

console.log('== 4. Segunda parede: se alguém conseguisse injetar mesmo assim, o que a conta de LÍDER alcança? (texto concatenado de propósito) ==');
await comoUsuario(C1, 'authenticated', async () => {
  const ddl = await sp(`select 1`); void ddl;
  const drop = await sp(`drop table public.funcionarios`);
  confere(!!drop.e && /must be owner|permission denied/i.test(drop.e.message), 'apagar tabela: negado ao líder (' + (drop.e && drop.e.message.slice(0, 40)) + ')');
  const esc = await sp(`update public.perfis set papel = 'supervisor' where true returning usuario`);
  confere(!esc.e && esc.r.rows.length === 0, 'virar supervisor: nenhuma linha de perfis é alterável pelo líder');
  const outro = await sp(`delete from public.lancamentos where "time" = 'C2B' returning id`);
  confere(!outro.e && outro.r.rows.length === 0, 'apagar lançamentos de OUTRO time: 0 linhas');
  const ver = await sp(`select usuario from public.perfis`);
  confere(!ver.e && ver.r.rows.length === 1 && ver.r.rows[0].usuario === 'c1b', 'ler logins de outros (perfis): só enxerga o próprio');
  const aud = await sp(`select count(*)::int n from public.auditoria`);
  confere(!aud.e && aud.r.rows[0].n === 0, 'ler a auditoria: o líder não vê nada');
  const dentro = await sp(`delete from public.lancamentos where "time" = 'C1B' returning id`);
  confere(!dentro.e && dentro.r.rows.length >= 1, 'o estrago possível ficaria só no PRÓPRIO time e nos últimos 7 dias (' + (dentro.r ? dentro.r.rows.length : 0) + ' linha(s) do C1B), nunca no resto');
});
console.log('');

console.log('== 5. Visitante sem login (papel anon) com os mesmos textos ==');
for (const [rotulo, p] of PAYLOADS.slice(0, 4)) {
  await comoUsuario(null, 'anon', async () => {
    const res = [];
    for (const t of ['funcionarios', 'lancamentos', 'envios', 'perfis', 'auditoria', 'parametros', 'textos_editados']) {
      const r = await sp(`select count(*)::int n from public.${t} where true or $1 = ''`, [p]);
      res.push(!r.e && r.r.rows[0].n === 0);
    }
    const ins = await sp(`insert into public.funcionarios (nome, matricula, "time") values ($1, '', 'C1B')`, [p]);
    const upd = await sp(`update public.funcionarios set nome = $1 returning id`, [p]);
    const del = await sp(`delete from public.funcionarios returning id`);
    confere(res.every(Boolean) && !!ins.e && (!upd.e && upd.r.rows.length === 0) && (!del.e && del.r.rows.length === 0), `anônimo + "${rotulo}": lê 0 linhas, não cadastra, não altera, não apaga`);
  });
}
console.log('');
const fim = await estado();
confere(JSON.stringify(fim) === JSON.stringify(base), 'depois de tudo, o banco de teste ficou exatamente como começou');
console.log(falhou.length ? `\n${falhou.length} FALHA(S)` : '\nTUDO CERTO: nenhum ataque funcionou');
process.exit(falhou.length ? 1 : 0);
