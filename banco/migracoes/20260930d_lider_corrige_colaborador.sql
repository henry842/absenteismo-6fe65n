-- Migração: o líder passa a CORRIGIR nome, cargo e turno de quem é do PRÓPRIO time (botão "Editar dados" do perfil, aba Equipe), 30/09/2026.
-- STATUS: APLICADA no banco de produção pelo usuário, no SQL Editor (conferida em 02/10/2026: regra func_lider_corrigir e gatilho funcionarios_lider_corrige existem).
-- Para aplicar de novo (é seguro): Supabase > SQL Editor > cole este arquivo inteiro > Run.
-- Independe da migração 20260930c (cadastro): pode rodar antes, depois ou sem ela.
--
-- O que muda: só ACRESCENTA uma regra e uma trava. Não apaga nem altera nenhum dado agora.
-- Sem esta migração o sistema continua igual: o botão "Editar dados" avisa que a correção ainda não foi liberada.
--
-- Segurança: o líder só consegue alterar colaborador ATIVO do time dele, e só nome, cargo e turno. A trava barra qualquer mudança em
-- matrícula, time, situação (ativo), id e data de cadastro (a matrícula liga a pessoa ao histórico: só o supervisor mexe nela).
-- O líder continua sem poder apagar nem desativar ninguém. Cada correção fica na auditoria (antes e depois).
-- Se algum teste falhar, a migração inteira é desfeita e nada muda.

-- 1) Regra: líder corrige colaborador ativo do próprio time (e a linha continua ativa e no mesmo time depois da correção)
drop policy if exists func_lider_corrigir on public.funcionarios;
create policy func_lider_corrigir on public.funcionarios as permissive for update to authenticated
  using (public.papel_atual() = 'lider' and "time" = public.time_atual() and ativo)
  with check (public.papel_atual() = 'lider' and "time" = public.time_atual() and ativo);

-- 2) Trava de colunas: para o líder, só nome, cargo e turno podem mudar. (O supervisor e a importação do RH ficam como estão.)
create or replace function public.restringir_correcao_do_lider()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if public.papel_atual() is distinct from 'lider' then return new; end if;
  if new.id is distinct from old.id or new.matricula is distinct from old.matricula or new."time" is distinct from old."time"
     or new.ativo is distinct from old.ativo or new.criado_em is distinct from old.criado_em then
    raise exception 'O líder só pode corrigir nome, cargo e turno.' using errcode = '42501';
  end if;
  return new;
end $$;
revoke all on function public.restringir_correcao_do_lider() from public, anon, authenticated;

drop trigger if exists funcionarios_lider_corrige on public.funcionarios;
create trigger funcionarios_lider_corrige before update on public.funcionarios
  for each row execute function public.restringir_correcao_do_lider();

-- Teste embutido: tudo o que o teste faz é desfeito no fim (nenhum dado de verdade é tocado).
do $teste$
declare
  lider uuid; tim text; outro_time text; henry uuid; n int; gravou int; v record;
begin
  select user_id, "time" into lider, tim from public.perfis where usuario = 'c1b' and papel = 'lider' and ativo;
  select "time" into outro_time from public.perfis where usuario = 'c2b' and papel = 'lider' and ativo;
  select user_id into henry from public.perfis where usuario = 'henry' and papel = 'supervisor' and ativo;
  if lider is null or outro_time is null or henry is null or tim = outro_time then raise exception 'perfis de teste não encontrados'; end if;
  begin
    -- duas pessoas de teste, criadas como administrador (sem identidade de líder)
    perform set_config('request.jwt.claims', '', true);
    perform set_config('request.jwt.claim.sub', '', true);
    insert into public.funcionarios (nome, matricula, "time", cargo, turno) values ('Teste Corrige Um', '9990101', tim, 'Operador', '2° Turno'), ('Teste Corrige Outro Time', '9990102', outro_time, 'Operador', '2° Turno');

    -- como o líder do time do c1b
    set local role authenticated;
    perform set_config('request.jwt.claims', json_build_object('sub', lider, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', lider::text, true);

    update public.funcionarios set nome = 'Teste Corrigido', cargo = 'Suporte', turno = '1° Turno' where matricula = '9990101';
    get diagnostics n = row_count;
    if n <> 1 then raise exception 'T1: o líder deveria corrigir nome, cargo e turno de quem é do time'; end if;
    select * into v from public.funcionarios where matricula = '9990101';
    if v.nome <> 'Teste Corrigido' or v.cargo <> 'Suporte' or v.turno <> '1° Turno' then raise exception 'T1b: a correção não gravou'; end if;

    update public.funcionarios set nome = 'Invasor' where matricula = '9990102';
    get diagnostics n = row_count;
    if n <> 0 then raise exception 'T2: o líder não pode corrigir gente de outro time'; end if;

    begin update public.funcionarios set matricula = '9990199' where matricula = '9990101';
      raise exception 'T3: o líder não pode mudar a matrícula';
    exception when insufficient_privilege then null; end;

    begin update public.funcionarios set "time" = outro_time where matricula = '9990101';
      raise exception 'T4: o líder não pode mandar a pessoa para outro time';
    exception when insufficient_privilege then null; end;

    begin update public.funcionarios set ativo = false where matricula = '9990101';
      raise exception 'T5: o líder não pode desativar ninguém';
    exception when insufficient_privilege then null; end;

    delete from public.funcionarios where matricula = '9990101';
    get diagnostics n = row_count;
    if n <> 0 then raise exception 'T6: o líder não pode apagar colaborador'; end if;

    -- como supervisor: continua mexendo em tudo (matrícula, time, situação), como antes
    perform set_config('request.jwt.claims', json_build_object('sub', henry, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', henry::text, true);
    update public.funcionarios set matricula = '9990198', "time" = outro_time, ativo = false where matricula = '9990101';
    get diagnostics n = row_count;
    if n <> 1 then raise exception 'T7: o supervisor deveria continuar podendo mudar matrícula, time e situação'; end if;

    -- a auditoria guardou a correção do líder, com o antes e o depois
    reset role;
    select count(*) into gravou from public.auditoria where tabela = 'funcionarios' and acao = 'UPDATE' and usuario = 'c1b'
      and antes ->> 'nome' = 'Teste Corrige Um' and depois ->> 'nome' = 'Teste Corrigido';
    if gravou <> 1 then raise exception 'T8: a correção do líder deveria estar na auditoria'; end if;
    raise exception 'FIM_DO_TESTE';
  exception when others then
    if sqlerrm <> 'FIM_DO_TESTE' then raise; end if;
  end;
  perform set_config('request.jwt.claims', '', true);
  perform set_config('request.jwt.claim.sub', '', true);
end $teste$;
