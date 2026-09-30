-- Um registro por chave de cada usuário:
--   '2026-09-24|C1B' → fechamento de um time num dia
--   'config'         → ajustes
--   'cadastro'       → matrícula → nome/time
-- dados = null quando o lançamento foi apagado (para os outros aparelhos apagarem também).
create table public.registros (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  chave text not null,
  dados jsonb,
  atualizado_em timestamptz not null default now(),
  primary key (user_id, chave)
);

create index registros_user_atualizado on public.registros (user_id, atualizado_em);

-- A hora vem sempre do servidor (não do relógio do celular)
create or replace function public.marcar_atualizado_em()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.atualizado_em := now();
  return new;
end;
$$;

create trigger registros_atualizado_em
before insert or update on public.registros
for each row execute function public.marcar_atualizado_em();

alter table public.registros enable row level security;

create policy "cada um lê os seus" on public.registros
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "cada um cria os seus" on public.registros
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "cada um altera os seus" on public.registros
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "cada um apaga os seus" on public.registros
  for delete to authenticated using ((select auth.uid()) = user_id);
