
-- =====================================================================
-- 1) Prazo de envio (e outros parâmetros compartilhados). Todos leem, só supervisor grava.
-- =====================================================================
create table public.parametros (
  chave text primary key check (chave ~ '^[a-z_]{1,40}$'),
  valor jsonb not null,
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid default auth.uid() references auth.users(id) on delete set null,
  constraint param_hora_limite check (chave <> 'hora_limite'
    or (jsonb_typeof(valor) = 'string' and (valor #>> '{}') ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'))
);
alter table public.parametros enable row level security;
create policy param_ler on public.parametros for select to authenticated using (public.papel_atual() is not null);
create policy param_supervisor on public.parametros for all to authenticated
  using (public.papel_atual() = 'supervisor') with check (public.papel_atual() = 'supervisor');
create trigger parametros_atualizado before update on public.parametros
  for each row execute function public.marcar_atualizado();
-- marcar_atualizado usa a coluna atualizado_em, que existe aqui também

-- =====================================================================
-- 2) Texto para o superior editado (por supervisor e por dia), sincronizado entre aparelhos
-- =====================================================================
create table public.textos_editados (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  data date not null,
  texto text not null check (length(texto) <= 20000),
  atualizado_em timestamptz not null default now(),
  primary key (user_id, data)
);
alter table public.textos_editados enable row level security;
create policy texto_ler on public.textos_editados for select to authenticated
  using (user_id = (select auth.uid()) and public.papel_atual() = 'supervisor');
create policy texto_criar on public.textos_editados for insert to authenticated
  with check (user_id = (select auth.uid()) and public.papel_atual() = 'supervisor');
create policy texto_alterar on public.textos_editados for update to authenticated
  using (user_id = (select auth.uid()) and public.papel_atual() = 'supervisor')
  with check (user_id = (select auth.uid()) and public.papel_atual() = 'supervisor');
create policy texto_apagar on public.textos_editados for delete to authenticated
  using (user_id = (select auth.uid()) and public.papel_atual() = 'supervisor');

-- =====================================================================
-- 3) Registro de alterações (auditoria). Só triggers escrevem; só supervisor lê.
-- =====================================================================
create table public.auditoria (
  id bigint generated always as identity primary key,
  quando timestamptz not null default now(),
  user_id uuid,
  usuario text,
  acao text not null check (acao in ('INSERT', 'UPDATE', 'DELETE')),
  tabela text not null,
  registro text,
  time text,
  antes jsonb,
  depois jsonb
);
create index auditoria_quando on public.auditoria (quando desc);
alter table public.auditoria enable row level security;
create policy auditoria_ler on public.auditoria for select to authenticated using (public.papel_atual() = 'supervisor');
revoke insert, update, delete, truncate on public.auditoria from anon, authenticated;

create function public.registrar_auditoria() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  nome text;
  velho jsonb;
  novo jsonb;
  reg text;
begin
  select usuario into nome from public.perfis where user_id = uid;
  if tg_op <> 'INSERT' then velho := to_jsonb(old); end if;
  if tg_op <> 'DELETE' then novo := to_jsonb(new); end if;
  if tg_op = 'UPDATE' and (velho - 'atualizado_em') = (novo - 'atualizado_em') then return new; end if;
  reg := coalesce(novo ->> 'id', velho ->> 'id', novo ->> 'user_id', velho ->> 'user_id',
                  coalesce(novo ->> 'data', velho ->> 'data') || '|' || coalesce(novo ->> 'time', velho ->> 'time'),
                  novo ->> 'chave', velho ->> 'chave');
  insert into public.auditoria (user_id, usuario, acao, tabela, registro, time, antes, depois)
  values (uid, coalesce(nome, case when uid is null then 'sistema' end), tg_op, tg_table_name, reg,
          coalesce(novo ->> 'time', velho ->> 'time'), velho, novo);
  return coalesce(new, old);
end $$;
revoke all on function public.registrar_auditoria() from public, anon, authenticated;

create trigger auditoria_lancamentos after insert or update or delete on public.lancamentos for each row execute function public.registrar_auditoria();
create trigger auditoria_envios after insert or update or delete on public.envios for each row execute function public.registrar_auditoria();
create trigger auditoria_funcionarios after insert or update or delete on public.funcionarios for each row execute function public.registrar_auditoria();
create trigger auditoria_perfis after insert or update or delete on public.perfis for each row execute function public.registrar_auditoria();
create trigger auditoria_parametros after insert or update or delete on public.parametros for each row execute function public.registrar_auditoria();

-- =====================================================================
-- 4) Limite de lançamentos por time e dia (contra abuso de uma conta)
-- =====================================================================
create function public.limitar_lancamentos() returns trigger
language plpgsql set search_path = '' as $$
begin
  if (select count(*) from public.lancamentos where data = new.data and time = new.time) >= 500 then
    raise exception 'Limite de lançamentos do dia atingido para este time' using errcode = '54000';
  end if;
  return new;
end $$;
revoke all on function public.limitar_lancamentos() from public, anon, authenticated;
create trigger lancamentos_limite before insert on public.lancamentos for each row execute function public.limitar_lancamentos();

-- =====================================================================
-- 5) Cadastro público bloqueado: só nasce conta com convite (feito pela função admin-lideres)
-- =====================================================================
create table public.convites (
  email text primary key check (email = lower(email)),
  criado_em timestamptz not null default now()
);
alter table public.convites enable row level security;
revoke all on public.convites from anon, authenticated;

create function public.exigir_convite() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.email is null or not exists (select 1 from public.convites where email = lower(new.email)) then
    raise exception 'Cadastro não autorizado. Peça ao supervisor para criar o seu acesso.';
  end if;
  return new;
end $$;
revoke all on function public.exigir_convite() from public, anon, authenticated;
create trigger auth_exigir_convite before insert on auth.users for each row execute function public.exigir_convite();

-- =====================================================================
-- 6) Legado (registros): só quem tem acesso ativo ao sistema
-- =====================================================================
drop policy "cada um lê os seus" on public.registros;
drop policy "cada um cria os seus" on public.registros;
drop policy "cada um altera os seus" on public.registros;
drop policy "cada um apaga os seus" on public.registros;
create policy "cada um lê os seus" on public.registros for select to authenticated
  using ((select auth.uid()) = user_id and public.papel_atual() is not null);
create policy "cada um cria os seus" on public.registros for insert to authenticated
  with check ((select auth.uid()) = user_id and public.papel_atual() is not null);
create policy "cada um altera os seus" on public.registros for update to authenticated
  using ((select auth.uid()) = user_id and public.papel_atual() is not null)
  with check ((select auth.uid()) = user_id and public.papel_atual() is not null);
create policy "cada um apaga os seus" on public.registros for delete to authenticated
  using ((select auth.uid()) = user_id and public.papel_atual() is not null);
