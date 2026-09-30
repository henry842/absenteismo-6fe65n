-- Migração: remove o segundo passo dos supervisores (a pedido do usuário, 30/09/2026).
-- STATUS: APLICADA no banco de produção em 30/09/2026, pelo SQL Editor (o ambiente bloqueia mudanças no banco de produção feitas por mim).
-- Conferida depois: regra simples de volta, consulta antiga removida, nenhum cadastro de celular sobrando, bloqueio de e-mail dos líderes e demais itens intactos.
-- Ninguém tinha ativado o segundo passo, então o efeito prático é nenhum: a regra volta a ser a simples. Mas é importante
-- desfazer: enquanto a regra nova existe, quem descobrisse a senha de um supervisor poderia cadastrar o PRÓPRIO celular e,
-- sem a tela do código no site, trancar o supervisor de verdade para fora.
-- Fica como está (continua valendo): o bloqueio de e-mail nos logins de líder, o encerramento de sessões e a senha própria do líder.
-- Se algum teste falhar, a migração inteira é desfeita e nada muda.

-- 1) A regra de "quem é supervisor" volta a ser só: perfil ativo com esse papel (como era antes do segundo passo)
create or replace function public.papel_atual()
returns text language sql stable security definer set search_path = ''
as $$ select papel from public.perfis where user_id = auth.uid() and ativo $$;

-- 2) A consulta "quem ainda não ativou" só existia para o segundo passo
drop function if exists public.supervisores_sem_mfa();

-- 3) Cadastro de celular que ficou pela metade (nunca ativado) não serve para nada
delete from auth.mfa_factors where status = 'unverified';

-- Teste embutido: mesmo com um celular cadastrado e ativado, o supervisor só com senha volta a ser reconhecido.
do $teste$
declare
  henry uuid; lider uuid; fator uuid := gen_random_uuid();
begin
  select user_id into henry from public.perfis where usuario = 'henry';
  select user_id into lider from public.perfis where usuario = 'c1b';
  if henry is null or lider is null then raise exception 'perfis de teste não encontrados'; end if;
  begin
    perform set_config('request.jwt.claims', json_build_object('sub', henry, 'role', 'authenticated', 'aal', 'aal1')::text, true);
    perform set_config('request.jwt.claim.sub', henry::text, true);
    insert into auth.mfa_factors (id, user_id, friendly_name, factor_type, status, created_at, updated_at, secret)
      values (fator, henry, 'teste', 'totp', 'verified', now(), now(), 'segredo');
    if public.papel_atual() is distinct from 'supervisor' then raise exception 'T1: supervisor só com senha deveria ser reconhecido'; end if;
    perform set_config('request.jwt.claims', json_build_object('sub', lider, 'role', 'authenticated', 'aal', 'aal1')::text, true);
    perform set_config('request.jwt.claim.sub', lider::text, true);
    if public.papel_atual() is distinct from 'lider' then raise exception 'T2: líder continua líder'; end if;
    if exists (select 1 from pg_proc where proname = 'supervisores_sem_mfa' and pronamespace = 'public'::regnamespace) then raise exception 'T3: a consulta antiga deveria ter sumido'; end if;
    if not exists (select 1 from pg_trigger where tgname = 'auth_bloquear_email_interno') then raise exception 'T4: o bloqueio de e-mail dos líderes tem que continuar'; end if;
    raise exception 'FIM_DO_TESTE';
  exception when others then
    if sqlerrm <> 'FIM_DO_TESTE' then raise; end if;
  end;
  perform set_config('request.jwt.claims', '', true);
  perform set_config('request.jwt.claim.sub', '', true);
end $teste$;
