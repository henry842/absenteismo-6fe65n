-- Migração: o líder passa a cadastrar colaborador no PRÓPRIO time (botão "Adicionar colaborador" da aba Equipe), 30/09/2026.
-- STATUS: preparada, AINDA NÃO aplicada (o ambiente bloqueia mudanças no banco de produção feitas por mim). Aplicar pelo SQL Editor.
-- Como aplicar: Supabase > SQL Editor > cole este arquivo inteiro > Run. Se aparecer "Success. No rows returned", deu certo.
--
-- O que muda: só ACRESCENTA uma regra e uma trava. Não apaga nem altera nenhum dado (lançamentos de hoje, envios, cadastro, logins).
-- Sem esta migração o sistema continua igual: a aba Equipe mostra a lista e os indicadores (só leitura), e o botão
-- "Cadastrar colaborador" avisa que o cadastro ainda não foi liberado.
--
-- Segurança: o líder só consegue INSERIR pessoa ATIVA e só no time dele. Esta migração não dá poder de desativar nem apagar ninguém
-- (isso é do supervisor); corrigir nome, cargo e turno é a migração 20260930d, à parte. Cada cadastro fica na auditoria.
-- Se algum teste falhar, a migração inteira é desfeita e nada muda.

-- 1) Regra: líder cadastra no próprio time
drop policy if exists func_lider_inserir on public.funcionarios;
create policy func_lider_inserir on public.funcionarios as permissive for insert to authenticated
  with check (public.papel_atual() = 'lider' and "time" = public.time_atual() and ativo);

-- 2) Travas só para o cadastro feito por líder: matrícula repetida no time e limite de 500 pessoas por time.
--    (O supervisor e a importação da planilha do RH ficam exatamente como estão.)
create or replace function public.limitar_funcionarios_do_lider()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if public.papel_atual() is distinct from 'lider' then return new; end if;
  if new.matricula <> '' and exists (select 1 from public.funcionarios f where f."time" = new."time" and f.ativo and f.matricula = new.matricula) then
    raise exception 'Já existe alguém com essa matrícula no time.' using errcode = '23505';
  end if;
  if (select count(*) from public.funcionarios f where f."time" = new."time" and f.ativo) >= 500 then
    raise exception 'O time já tem 500 colaboradores, que é o limite.' using errcode = '54000';
  end if;
  return new;
end $$;
revoke all on function public.limitar_funcionarios_do_lider() from public, anon, authenticated;

drop trigger if exists funcionarios_lider_limite on public.funcionarios;
create trigger funcionarios_lider_limite before insert on public.funcionarios
  for each row execute function public.limitar_funcionarios_do_lider();

-- Teste embutido: tudo o que o teste faz é desfeito no fim (nenhum dado de verdade é tocado).
do $teste$
declare
  lider uuid; tim text; outro_time text; henry uuid; n int; gravou int;
begin
  select user_id, "time" into lider, tim from public.perfis where usuario = 'c1b' and papel = 'lider' and ativo;
  select "time" into outro_time from public.perfis where usuario = 'c2b' and papel = 'lider' and ativo;
  select user_id into henry from public.perfis where usuario = 'henry' and papel = 'supervisor' and ativo;
  if lider is null or outro_time is null or henry is null or tim = outro_time then raise exception 'perfis de teste não encontrados'; end if;
  begin
    -- como o líder do time do c1b
    set local role authenticated;
    perform set_config('request.jwt.claims', json_build_object('sub', lider, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', lider::text, true);

    insert into public.funcionarios (nome, matricula, "time", cargo, turno) values ('Teste Migracao Um', '9990001', tim, 'Operador', '2° Turno');
    select count(*) into n from public.funcionarios where matricula = '9990001';
    if n <> 1 then raise exception 'T1: o líder deveria cadastrar e ver a pessoa do próprio time'; end if;

    begin insert into public.funcionarios (nome, matricula, "time") values ('Teste Migracao Dois', '9990002', outro_time);
      raise exception 'T2: o líder não pode cadastrar em outro time';
    exception when insufficient_privilege then null; end;

    begin insert into public.funcionarios (nome, matricula, "time", ativo) values ('Teste Migracao Tres', '9990003', tim, false);
      raise exception 'T3: o líder não pode cadastrar pessoa já desativada';
    exception when insufficient_privilege then null; end;

    begin insert into public.funcionarios (nome, matricula, "time") values ('Teste Migracao Quatro', '9990001', tim);
      raise exception 'T4: matrícula repetida no time deveria ser recusada';
    exception when unique_violation then null; end;

    insert into public.funcionarios (nome, matricula, "time") values ('Teste Sem Matricula A', '', tim), ('Teste Sem Matricula B', '', tim);   -- sem matrícula pode repetir (vazio não conta)

    -- desativar continua só com o supervisor (vale com ou sem a migração 20260930d, que deixa o líder corrigir nome, cargo e turno)
    begin
      update public.funcionarios set ativo = false where matricula = '9990001';
      get diagnostics n = row_count;
      if n <> 0 then raise exception 'T5: o líder não pode desativar colaborador'; end if;
    exception when insufficient_privilege then null; end;
    delete from public.funcionarios where matricula = '9990001';
    get diagnostics n = row_count;
    if n <> 0 then raise exception 'T6: o líder não pode apagar colaborador'; end if;

    -- limite de 500 por time: enche o time como administrador (sem a identidade do líder, que é quem as travas fiscalizam) e volta a ser o líder
    reset role;
    perform set_config('request.jwt.claims', '', true);
    perform set_config('request.jwt.claim.sub', '', true);
    insert into public.funcionarios (nome, matricula, "time") select 'Teste Volume ' || g, '8' || lpad(g::text, 6, '0'), tim from generate_series(1, 500) g;
    set local role authenticated;
    perform set_config('request.jwt.claims', json_build_object('sub', lider, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', lider::text, true);
    begin insert into public.funcionarios (nome, matricula, "time") values ('Teste Limite', '9990009', tim);
      raise exception 'T7: passou do limite de 500';
    exception when sqlstate '54000' then null; end;

    -- como supervisor: continua cadastrando em qualquer time, e sem as travas do líder (como era antes)
    perform set_config('request.jwt.claims', json_build_object('sub', henry, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', henry::text, true);
    insert into public.funcionarios (nome, matricula, "time") values ('Teste Supervisor Um', '9990001', outro_time), ('Teste Supervisor Dois', '9990001', outro_time);

    -- a auditoria guardou o cadastro do líder
    reset role;
    select count(*) into gravou from public.auditoria where tabela = 'funcionarios' and acao = 'INSERT' and usuario = 'c1b' and depois ->> 'matricula' = '9990001';
    if gravou <> 1 then raise exception 'T8: o cadastro do líder deveria estar na auditoria'; end if;
    raise exception 'FIM_DO_TESTE';
  exception when others then
    if sqlerrm <> 'FIM_DO_TESTE' then raise; end if;
  end;
  perform set_config('request.jwt.claims', '', true);
  perform set_config('request.jwt.claim.sub', '', true);
end $teste$;
