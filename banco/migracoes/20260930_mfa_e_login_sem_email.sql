-- Migração: segundo passo dos supervisores + login de líder sem e-mail + sessões + senha própria.
-- STATUS: APLICADA no banco de produção em 30/09/2026, pelo SQL Editor (o ambiente bloqueou a aplicação automática).
-- Conferida depois: regra nova, gatilho, funções, líderes marcados, sem sobras do teste, dados intactos.
-- É seguro: no fim há um teste embutido; se qualquer verificação falhar, a migração inteira é desfeita e nada muda.
-- (A primeira versão deste teste pegou um erro meu na troca de e-mail e foi corrigida abaixo.)

-- 1) Verificação em dois passos: supervisor que já ativou só é reconhecido em sessão aal2 (depois do código do celular).
--    Quem ainda não ativou continua entrando, para poder ativar; a tela obriga a ativar no primeiro acesso.
--    Todas as regras de acesso do banco perguntam papel_atual(), então isto vale para todas as tabelas de uma vez.
create or replace function public.papel_atual()
returns text language sql stable security definer set search_path = ''
as $$
  select p.papel from public.perfis p
  where p.user_id = auth.uid() and p.ativo
    and (p.papel <> 'supervisor'
         or coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
         or not exists (select 1 from auth.mfa_factors f where f.user_id = p.user_id and f.status = 'verified'))
$$;

-- Supervisores veem quem ainda não ativou (para conferir se os dois já ativaram)
create or replace function public.supervisores_sem_mfa()
returns table (usuario text) language sql stable security definer set search_path = ''
as $$
  select p.usuario from public.perfis p
  where public.papel_atual() = 'supervisor' and p.papel = 'supervisor' and p.ativo
    and not exists (select 1 from auth.mfa_factors f where f.user_id = p.user_id and f.status = 'verified')
  order by p.usuario
$$;
revoke all on function public.supervisores_sem_mfa() from public, anon;
grant execute on function public.supervisores_sem_mfa() to authenticated;

-- 2) Logins de líder usam um e-mail inventado (@lider.absenteismo.app) num domínio que NINGUÉM registrou.
--    Quem registrasse o domínio receberia o "esqueci a senha" (ou o link de acesso) e tomaria a conta do líder.
--    Nenhum fluxo que envie e-mail ou troque o e-mail vale para esses logins.
create or replace function public.bloquear_email_de_login_interno()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if lower(coalesce(old.email, '')) like '%@lider.absenteismo.app' and (
       new.email is distinct from old.email
    or (coalesce(new.recovery_token, '') <> '' and new.recovery_token is distinct from old.recovery_token)
    or (coalesce(new.confirmation_token, '') <> '' and new.confirmation_token is distinct from old.confirmation_token)
    or (coalesce(new.email_change_token_new, '') <> '' and new.email_change_token_new is distinct from old.email_change_token_new)
    or (coalesce(new.email_change_token_current, '') <> '' and new.email_change_token_current is distinct from old.email_change_token_current)
    or (coalesce(new.email_change, '') <> '' and new.email_change is distinct from old.email_change)
    or (coalesce(new.reauthentication_token, '') <> '' and new.reauthentication_token is distinct from old.reauthentication_token)
  ) then
    raise exception 'Este login não usa e-mail. Peça ao supervisor para gerar uma senha nova.';
  end if;
  return new;
end $$;
revoke all on function public.bloquear_email_de_login_interno() from public, anon, authenticated;
drop trigger if exists auth_bloquear_email_interno on auth.users;
create trigger auth_bloquear_email_interno before update on auth.users
  for each row execute function public.bloquear_email_de_login_interno();

-- 3) Encerrar todas as sessões abertas de um login (só a função de administração chama; ao redefinir a senha ou desativar)
create or replace function public.encerrar_sessoes(alvo uuid)
returns void language sql security definer set search_path = ''
as $$ delete from auth.sessions where user_id = alvo $$;
revoke all on function public.encerrar_sessoes(uuid) from public, anon, authenticated;
grant execute on function public.encerrar_sessoes(uuid) to service_role;

-- 4) Função de gatilho não precisa ser chamável por ninguém
revoke all on function public.marcar_atualizado() from public, anon, authenticated;

-- 5) Todo líder cria a própria senha no próximo acesso (a gerada pelo supervisor era provisória)
update auth.users set raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || '{"trocar_senha": true}'::jsonb
where lower(email) like '%@lider.absenteismo.app';

-- Teste embutido: se qualquer verificação falhar, a migração inteira é desfeita.
do $teste$
declare
  henry uuid; lider uuid; fator uuid := gen_random_uuid(); falhou boolean;
begin
  select user_id into henry from public.perfis where usuario = 'henry';
  select user_id into lider from public.perfis where usuario = 'c1b';
  if henry is null or lider is null then raise exception 'perfis de teste não encontrados'; end if;
  begin
    perform set_config('request.jwt.claims', json_build_object('sub', henry, 'role', 'authenticated', 'aal', 'aal1')::text, true);
    perform set_config('request.jwt.claim.sub', henry::text, true);
    if public.papel_atual() is distinct from 'supervisor' then raise exception 'T1: supervisor sem fator deveria continuar entrando'; end if;

    insert into auth.mfa_factors (id, user_id, friendly_name, factor_type, status, created_at, updated_at, secret)
      values (fator, henry, 'teste', 'totp', 'verified', now(), now(), 'segredo');
    if public.papel_atual() is not null then raise exception 'T2: supervisor com fator em sessão aal1 deveria ser recusado'; end if;

    perform set_config('request.jwt.claims', json_build_object('sub', henry, 'role', 'authenticated', 'aal', 'aal2')::text, true);
    if public.papel_atual() is distinct from 'supervisor' then raise exception 'T3: supervisor em aal2 deveria ser aceito'; end if;

    perform set_config('request.jwt.claims', json_build_object('sub', lider, 'role', 'authenticated', 'aal', 'aal1')::text, true);
    perform set_config('request.jwt.claim.sub', lider::text, true);
    if public.papel_atual() is distinct from 'lider' then raise exception 'T4: líder não pode ser afetado pelo segundo passo'; end if;

    falhou := false;
    begin update auth.users set recovery_token = 'abc', recovery_sent_at = now() where id = lider; exception when others then falhou := true; end;
    if not falhou then raise exception 'T5: recuperação de senha do login de líder NÃO foi bloqueada'; end if;
    falhou := false;
    begin update auth.users set email = 'outro@exemplo.com' where id = lider; exception when others then falhou := true; end;
    if not falhou then raise exception 'T6: troca de e-mail do login de líder NÃO foi bloqueada'; end if;
    falhou := false;
    begin update auth.users set email_change = 'outro@exemplo.com', email_change_token_new = 'xyz' where id = lider; exception when others then falhou := true; end;
    if not falhou then raise exception 'T6b: pedido de troca de e-mail do líder NÃO foi bloqueado'; end if;
    update auth.users set last_sign_in_at = now() where id = lider;                 -- entrar continua funcionando

    update auth.users set recovery_token = 'abc', recovery_sent_at = now() where id = henry;   -- e-mail real continua podendo recuperar
    if has_function_privilege('authenticated', 'public.encerrar_sessoes(uuid)', 'execute') then raise exception 'T7: encerrar_sessoes não pode ser chamável por usuário'; end if;
    if has_function_privilege('anon', 'public.supervisores_sem_mfa()', 'execute') then raise exception 'T8: anon não pode chamar supervisores_sem_mfa'; end if;
    raise exception 'FIM_DO_TESTE';
  exception when others then
    if sqlerrm <> 'FIM_DO_TESTE' then raise; end if;
  end;
  perform set_config('request.jwt.claims', '', true);
  perform set_config('request.jwt.claim.sub', '', true);
end $teste$;
