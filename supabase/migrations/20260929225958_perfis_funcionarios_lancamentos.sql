
-- Perfis: supervisor (vê tudo) ou líder (um por time)
create table public.perfis (
  user_id uuid primary key references auth.users(id) on delete cascade,
  papel text not null check (papel in ('supervisor','lider')),
  usuario text not null unique check (usuario ~ '^[a-z0-9._-]{2,40}$'),
  nome text not null default '' check (length(nome) <= 120),
  time text check (time is null or length(time) between 1 and 60),
  entrada_turno time,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  constraint lider_tem_time check (papel <> 'lider' or time is not null)
);
create unique index perfis_um_lider_por_time on public.perfis (time) where papel = 'lider' and ativo;

create function public.papel_atual() returns text
language sql stable security definer set search_path = public as
$$ select papel from public.perfis where user_id = auth.uid() and ativo $$;

create function public.time_atual() returns text
language sql stable security definer set search_path = public as
$$ select time from public.perfis where user_id = auth.uid() and ativo and papel = 'lider' $$;

revoke all on function public.papel_atual() from public, anon;
revoke all on function public.time_atual() from public, anon;
grant execute on function public.papel_atual() to authenticated;
grant execute on function public.time_atual() to authenticated;

-- O líder só pode mudar o horário do próprio turno
create function public.salvar_horario_turno(h time) returns void
language sql security definer set search_path = public as
$$ update public.perfis set entrada_turno = h where user_id = auth.uid() and papel = 'lider' and ativo $$;
revoke all on function public.salvar_horario_turno(time) from public, anon;
grant execute on function public.salvar_horario_turno(time) to authenticated;

-- Funcionários (vem do Excel)
create table public.funcionarios (
  id uuid primary key default gen_random_uuid(),
  matricula text not null default '' check (matricula ~ '^[0-9]{0,20}$'),
  nome text not null check (length(nome) between 1 and 120),
  time text not null check (length(time) between 1 and 60),
  cargo text not null default '' check (length(cargo) <= 60),
  turno text not null default '' check (length(turno) <= 30),
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);
create index funcionarios_time on public.funcionarios (time);
create index funcionarios_matricula on public.funcionarios (matricula);

-- Lançamentos do dia (ausência ou atraso), feitos pelo líder
create table public.lancamentos (
  id uuid primary key default gen_random_uuid(),
  data date not null,
  time text not null check (length(time) between 1 and 60),
  tipo text not null check (tipo in ('ausencia','atraso')),
  matricula text not null default '' check (matricula ~ '^[0-9]{0,20}$'),
  nome text not null check (length(nome) between 1 and 120),
  motivo text not null check (length(motivo) between 1 and 60),
  justificativa text not null default '' check (length(justificativa) <= 500),
  hora_prevista time,
  hora_chegada time,
  lider_id uuid not null default auth.uid() references auth.users(id),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint atraso_tem_horas check (tipo <> 'atraso' or (hora_prevista is not null and hora_chegada is not null))
);
create unique index lancamentos_uma_vez_por_dia on public.lancamentos (data, time, (coalesce(nullif(matricula, ''), nome)));
create index lancamentos_data on public.lancamentos (data, time);

create function public.marcar_atualizado() returns trigger language plpgsql as
$$ begin new.atualizado_em = now(); return new; end $$;
create trigger lancamentos_atualizado before update on public.lancamentos
  for each row execute function public.marcar_atualizado();

-- "Time enviado": o líder fecha o dia (mesmo sem ausência) e informa o efetivo
create table public.envios (
  data date not null,
  time text not null check (length(time) between 1 and 60),
  efetivo integer not null check (efetivo between 0 and 1000),
  lider_id uuid not null default auth.uid() references auth.users(id),
  enviado_em timestamptz not null default now(),
  primary key (data, time)
);

alter table public.perfis enable row level security;
alter table public.funcionarios enable row level security;
alter table public.lancamentos enable row level security;
alter table public.envios enable row level security;

create policy perfis_ler on public.perfis for select to authenticated
  using (user_id = auth.uid() or public.papel_atual() = 'supervisor');

create policy func_ler on public.funcionarios for select to authenticated
  using (public.papel_atual() = 'supervisor' or (public.papel_atual() = 'lider' and time = public.time_atual()));
create policy func_supervisor_escrever on public.funcionarios for all to authenticated
  using (public.papel_atual() = 'supervisor') with check (public.papel_atual() = 'supervisor');

create policy lanc_ler on public.lancamentos for select to authenticated
  using (public.papel_atual() = 'supervisor' or (public.papel_atual() = 'lider' and time = public.time_atual()));
create policy lanc_lider_inserir on public.lancamentos for insert to authenticated
  with check (public.papel_atual() = 'lider' and time = public.time_atual() and lider_id = auth.uid()
              and data between current_date - 7 and current_date + 1);
create policy lanc_lider_alterar on public.lancamentos for update to authenticated
  using (public.papel_atual() = 'lider' and time = public.time_atual() and data >= current_date - 7)
  with check (public.papel_atual() = 'lider' and time = public.time_atual() and lider_id = auth.uid()
              and data between current_date - 7 and current_date + 1);
create policy lanc_lider_apagar on public.lancamentos for delete to authenticated
  using (public.papel_atual() = 'lider' and time = public.time_atual() and data >= current_date - 7);
create policy lanc_supervisor on public.lancamentos for all to authenticated
  using (public.papel_atual() = 'supervisor') with check (public.papel_atual() = 'supervisor');

create policy env_ler on public.envios for select to authenticated
  using (public.papel_atual() = 'supervisor' or (public.papel_atual() = 'lider' and time = public.time_atual()));
create policy env_lider_inserir on public.envios for insert to authenticated
  with check (public.papel_atual() = 'lider' and time = public.time_atual() and lider_id = auth.uid()
              and data between current_date - 7 and current_date + 1);
create policy env_lider_alterar on public.envios for update to authenticated
  using (public.papel_atual() = 'lider' and time = public.time_atual() and data >= current_date - 7)
  with check (public.papel_atual() = 'lider' and time = public.time_atual() and lider_id = auth.uid()
              and data between current_date - 7 and current_date + 1);
create policy env_lider_apagar on public.envios for delete to authenticated
  using (public.papel_atual() = 'lider' and time = public.time_atual() and data >= current_date - 7);
create policy env_supervisor on public.envios for all to authenticated
  using (public.papel_atual() = 'supervisor') with check (public.papel_atual() = 'supervisor');

-- As duas contas de supervisor que já existiam foram cadastradas aqui com os IDs reais delas
-- (tirados desta cópia: o repositório não guarda IDs de contas). Para montar um banco novo:
-- insert into public.perfis (user_id, papel, usuario, nome) values ('<id da conta>', 'supervisor', '<usuario>', '<Nome>');
