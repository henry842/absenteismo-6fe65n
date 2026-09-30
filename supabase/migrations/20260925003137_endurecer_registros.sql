-- Sem login não faz nada na tabela (antes dependia só da RLS)
revoke all on table public.registros from anon;
-- Logado: só o necessário (TRUNCATE não passa pela RLS; REFERENCES/TRIGGER não são usados)
revoke truncate, references, trigger on table public.registros from authenticated;
grant select, insert, update, delete on table public.registros to authenticated;

-- Limites de tamanho: evita que alguém encha o banco grátis com dados enormes
alter table public.registros
  add constraint registros_chave_tamanho check (length(chave) between 1 and 64),
  add constraint registros_dados_tamanho check (dados is null or octet_length(dados::text) <= 512000);

-- A função do gatilho não precisa ser chamada por ninguém de fora
revoke execute on function public.marcar_atualizado_em() from public, anon, authenticated;
