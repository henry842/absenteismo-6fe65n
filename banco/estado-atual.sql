-- RETRATO do banco (schema public + gatilhos em auth.users) em 30/09/2026, DEPOIS das migrações
-- banco/migracoes/20260930_mfa_e_login_sem_email.sql e 20260930b_remover_segundo_passo.sql (o segundo passo foi retirado). Serve para conferir e para reconstruir o banco.
-- Não é para rodar de uma vez: a ordem das linhas é a de leitura (tabelas, regras de acesso, restrições, índices, políticas, funções, gatilhos).
-- Quando aplicar uma migração nova, gere este retrato de novo e substitua o arquivo.

create table public.auditoria (id bigint not null, quando timestamp with time zone not null default now(), user_id uuid, usuario text, acao text not null, tabela text not null, registro text, "time" text, antes jsonb, depois jsonb);
create table public.convites (email text not null, criado_em timestamp with time zone not null default now());
create table public.envios (data date not null, "time" text not null, efetivo integer not null, lider_id uuid not null default auth.uid(), enviado_em timestamp with time zone not null default now());
create table public.funcionarios (id uuid not null default gen_random_uuid(), matricula text not null default ''::text, nome text not null, "time" text not null, cargo text not null default ''::text, turno text not null default ''::text, ativo boolean not null default true, criado_em timestamp with time zone not null default now());
create table public.lancamentos (id uuid not null default gen_random_uuid(), data date not null, "time" text not null, tipo text not null, matricula text not null default ''::text, nome text not null, motivo text not null, justificativa text not null default ''::text, hora_prevista time without time zone, hora_chegada time without time zone, lider_id uuid not null default auth.uid(), criado_em timestamp with time zone not null default now(), atualizado_em timestamp with time zone not null default now(), hora_saida time without time zone);
create table public.parametros (chave text not null, valor jsonb not null, atualizado_em timestamp with time zone not null default now(), atualizado_por uuid default auth.uid());
create table public.perfis (user_id uuid not null, papel text not null, usuario text not null, nome text not null default ''::text, "time" text, entrada_turno time without time zone, ativo boolean not null default true, criado_em timestamp with time zone not null default now());
create table public.registros (user_id uuid not null default auth.uid(), chave text not null, dados jsonb, atualizado_em timestamp with time zone not null default now());
create table public.textos_editados (user_id uuid not null default auth.uid(), data date not null, texto text not null, atualizado_em timestamp with time zone not null default now());

alter table public.auditoria enable row level security;
alter table public.convites enable row level security;
alter table public.envios enable row level security;
alter table public.funcionarios enable row level security;
alter table public.lancamentos enable row level security;
alter table public.parametros enable row level security;
alter table public.perfis enable row level security;
alter table public.registros enable row level security;
alter table public.textos_editados enable row level security;

alter table auditoria add constraint auditoria_acao_check CHECK ((acao = ANY (ARRAY['INSERT'::text, 'UPDATE'::text, 'DELETE'::text])));
alter table auditoria add constraint auditoria_pkey PRIMARY KEY (id);
alter table convites add constraint convites_email_check CHECK ((email = lower(email)));
alter table convites add constraint convites_pkey PRIMARY KEY (email);
alter table envios add constraint envios_efetivo_check CHECK (((efetivo >= 0) AND (efetivo <= 1000)));
alter table envios add constraint envios_lider_id_fkey FOREIGN KEY (lider_id) REFERENCES auth.users(id);
alter table envios add constraint envios_pkey PRIMARY KEY (data, "time");
alter table envios add constraint envios_time_check CHECK (((length("time") >= 1) AND (length("time") <= 60)));
alter table funcionarios add constraint funcionarios_cargo_check CHECK ((length(cargo) <= 60));
alter table funcionarios add constraint funcionarios_matricula_check CHECK ((matricula ~ '^[0-9]{0,20}$'::text));
alter table funcionarios add constraint funcionarios_nome_check CHECK (((length(nome) >= 1) AND (length(nome) <= 120)));
alter table funcionarios add constraint funcionarios_pkey PRIMARY KEY (id);
alter table funcionarios add constraint funcionarios_time_check CHECK (((length("time") >= 1) AND (length("time") <= 60)));
alter table funcionarios add constraint funcionarios_turno_check CHECK ((length(turno) <= 30));
alter table lancamentos add constraint atraso_tem_horario CHECK (((tipo <> 'atraso'::text) OR (hora_prevista IS NOT NULL)));
alter table lancamentos add constraint lancamentos_justificativa_check CHECK ((length(justificativa) <= 500));
alter table lancamentos add constraint lancamentos_lider_id_fkey FOREIGN KEY (lider_id) REFERENCES auth.users(id);
alter table lancamentos add constraint lancamentos_matricula_check CHECK ((matricula ~ '^[0-9]{0,20}$'::text));
alter table lancamentos add constraint lancamentos_motivo_check CHECK (((length(motivo) >= 1) AND (length(motivo) <= 60)));
alter table lancamentos add constraint lancamentos_nome_check CHECK (((length(nome) >= 1) AND (length(nome) <= 120)));
alter table lancamentos add constraint lancamentos_pkey PRIMARY KEY (id);
alter table lancamentos add constraint lancamentos_time_check CHECK (((length("time") >= 1) AND (length("time") <= 60)));
alter table lancamentos add constraint lancamentos_tipo_check CHECK ((tipo = ANY (ARRAY['ausencia'::text, 'atraso'::text, 'saida'::text])));
alter table lancamentos add constraint saida_tem_horario CHECK (((tipo <> 'saida'::text) OR (hora_saida IS NOT NULL)));
alter table parametros add constraint param_hora_limite CHECK (((chave <> 'hora_limite'::text) OR ((jsonb_typeof(valor) = 'string'::text) AND ((valor #>> '{}'::text[]) ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'::text))));
alter table parametros add constraint parametros_atualizado_por_fkey FOREIGN KEY (atualizado_por) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table parametros add constraint parametros_chave_check CHECK ((chave ~ '^[a-z_]{1,40}$'::text));
alter table parametros add constraint parametros_pkey PRIMARY KEY (chave);
alter table perfis add constraint lider_tem_time CHECK (((papel <> 'lider'::text) OR ("time" IS NOT NULL)));
alter table perfis add constraint perfis_nome_check CHECK ((length(nome) <= 120));
alter table perfis add constraint perfis_papel_check CHECK ((papel = ANY (ARRAY['supervisor'::text, 'lider'::text])));
alter table perfis add constraint perfis_pkey PRIMARY KEY (user_id);
alter table perfis add constraint perfis_time_check CHECK ((("time" IS NULL) OR ((length("time") >= 1) AND (length("time") <= 60))));
alter table perfis add constraint perfis_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table perfis add constraint perfis_usuario_check CHECK ((usuario ~ '^[a-z0-9._-]{2,40}$'::text));
alter table perfis add constraint perfis_usuario_key UNIQUE (usuario);
alter table registros add constraint registros_chave_formato CHECK ((chave ~ '^(config|cadastro|[0-9]{4}-[0-9]{2}-[0-9]{2}\|.{1,60})$'::text));
alter table registros add constraint registros_chave_tamanho CHECK (((length(chave) >= 1) AND (length(chave) <= 64)));
alter table registros add constraint registros_dados_tamanho CHECK (((dados IS NULL) OR ((chave = 'cadastro'::text) AND (octet_length((dados)::text) <= 512000)) OR ((chave <> 'cadastro'::text) AND (octet_length((dados)::text) <= 102400))));
alter table registros add constraint registros_pkey PRIMARY KEY (user_id, chave);
alter table registros add constraint registros_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table textos_editados add constraint textos_editados_pkey PRIMARY KEY (user_id, data);
alter table textos_editados add constraint textos_editados_texto_check CHECK ((length(texto) <= 20000));
alter table textos_editados add constraint textos_editados_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

create index auditoria_quando ON public.auditoria USING btree (quando DESC);
create index funcionarios_matricula ON public.funcionarios USING btree (matricula);
create index funcionarios_time ON public.funcionarios USING btree ("time");
create index lancamentos_data ON public.lancamentos USING btree (data, "time");
create UNIQUE index lancamentos_uma_vez_por_dia ON public.lancamentos USING btree (data, "time", COALESCE(NULLIF(matricula, ''::text), nome), ((tipo = 'saida'::text)));
create UNIQUE index perfis_um_lider_por_time ON public.perfis USING btree ("time") WHERE ((papel = 'lider'::text) AND ativo);
create index registros_user_atualizado ON public.registros USING btree (user_id, atualizado_em);

create policy auditoria_ler on public.auditoria as permissive for select to authenticated using ((papel_atual() = 'supervisor'::text));
create policy convites_ninguem on public.convites as permissive for all to anon, authenticated using (false) with check (false);
create policy env_ler on public.envios as permissive for select to authenticated using (((papel_atual() = 'supervisor'::text) OR ((papel_atual() = 'lider'::text) AND ("time" = time_atual()))));
create policy env_lider_alterar on public.envios as permissive for update to authenticated using (((papel_atual() = 'lider'::text) AND ("time" = time_atual()) AND (data >= (CURRENT_DATE - 7)))) with check (((papel_atual() = 'lider'::text) AND ("time" = time_atual()) AND (lider_id = auth.uid()) AND ((data >= (CURRENT_DATE - 7)) AND (data <= (CURRENT_DATE + 1)))));
create policy env_lider_apagar on public.envios as permissive for delete to authenticated using (((papel_atual() = 'lider'::text) AND ("time" = time_atual()) AND (data >= (CURRENT_DATE - 7))));
create policy env_lider_inserir on public.envios as permissive for insert to authenticated with check (((papel_atual() = 'lider'::text) AND ("time" = time_atual()) AND (lider_id = auth.uid()) AND ((data >= (CURRENT_DATE - 7)) AND (data <= (CURRENT_DATE + 1)))));
create policy env_supervisor on public.envios as permissive for all to authenticated using ((papel_atual() = 'supervisor'::text)) with check ((papel_atual() = 'supervisor'::text));
create policy func_ler on public.funcionarios as permissive for select to authenticated using (((papel_atual() = 'supervisor'::text) OR ((papel_atual() = 'lider'::text) AND ("time" = time_atual()))));
create policy func_supervisor_escrever on public.funcionarios as permissive for all to authenticated using ((papel_atual() = 'supervisor'::text)) with check ((papel_atual() = 'supervisor'::text));
create policy lanc_ler on public.lancamentos as permissive for select to authenticated using (((papel_atual() = 'supervisor'::text) OR ((papel_atual() = 'lider'::text) AND ("time" = time_atual()))));
create policy lanc_lider_alterar on public.lancamentos as permissive for update to authenticated using (((papel_atual() = 'lider'::text) AND ("time" = time_atual()) AND (data >= (CURRENT_DATE - 7)))) with check (((papel_atual() = 'lider'::text) AND ("time" = time_atual()) AND (lider_id = auth.uid()) AND ((data >= (CURRENT_DATE - 7)) AND (data <= (CURRENT_DATE + 1)))));
create policy lanc_lider_apagar on public.lancamentos as permissive for delete to authenticated using (((papel_atual() = 'lider'::text) AND ("time" = time_atual()) AND (data >= (CURRENT_DATE - 7))));
create policy lanc_lider_inserir on public.lancamentos as permissive for insert to authenticated with check (((papel_atual() = 'lider'::text) AND ("time" = time_atual()) AND (lider_id = auth.uid()) AND ((data >= (CURRENT_DATE - 7)) AND (data <= (CURRENT_DATE + 1)))));
create policy lanc_supervisor on public.lancamentos as permissive for all to authenticated using ((papel_atual() = 'supervisor'::text)) with check ((papel_atual() = 'supervisor'::text));
create policy param_ler on public.parametros as permissive for select to authenticated using ((papel_atual() IS NOT NULL));
create policy param_supervisor on public.parametros as permissive for all to authenticated using ((papel_atual() = 'supervisor'::text)) with check ((papel_atual() = 'supervisor'::text));
create policy perfis_ler on public.perfis as permissive for select to authenticated using (((user_id = auth.uid()) OR (papel_atual() = 'supervisor'::text)));
create policy "cada um altera os seus" on public.registros as permissive for update to authenticated using (((( SELECT auth.uid() AS uid) = user_id) AND (papel_atual() IS NOT NULL))) with check (((( SELECT auth.uid() AS uid) = user_id) AND (papel_atual() IS NOT NULL)));
create policy "cada um apaga os seus" on public.registros as permissive for delete to authenticated using (((( SELECT auth.uid() AS uid) = user_id) AND (papel_atual() IS NOT NULL)));
create policy "cada um cria os seus" on public.registros as permissive for insert to authenticated with check (((( SELECT auth.uid() AS uid) = user_id) AND (papel_atual() IS NOT NULL)));
create policy "cada um lê os seus" on public.registros as permissive for select to authenticated using (((( SELECT auth.uid() AS uid) = user_id) AND (papel_atual() IS NOT NULL)));
create policy texto_alterar on public.textos_editados as permissive for update to authenticated using (((user_id = ( SELECT auth.uid() AS uid)) AND (papel_atual() = 'supervisor'::text))) with check (((user_id = ( SELECT auth.uid() AS uid)) AND (papel_atual() = 'supervisor'::text)));
create policy texto_apagar on public.textos_editados as permissive for delete to authenticated using (((user_id = ( SELECT auth.uid() AS uid)) AND (papel_atual() = 'supervisor'::text)));
create policy texto_criar on public.textos_editados as permissive for insert to authenticated with check (((user_id = ( SELECT auth.uid() AS uid)) AND (papel_atual() = 'supervisor'::text)));
create policy texto_ler on public.textos_editados as permissive for select to authenticated using (((user_id = ( SELECT auth.uid() AS uid)) AND (papel_atual() = 'supervisor'::text)));

CREATE OR REPLACE FUNCTION public.exigir_convite()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if new.email is null or not exists (select 1 from public.convites where email = lower(new.email)) then
    raise exception 'Cadastro não autorizado. Peça ao supervisor para criar o seu acesso.';
  end if;
  return new;
end $function$;
CREATE OR REPLACE FUNCTION public.limitar_lancamentos()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  if (select count(*) from public.lancamentos where data = new.data and time = new.time) >= 500 then
    raise exception 'Limite de lançamentos do dia atingido para este time' using errcode = '54000';
  end if;
  return new;
end $function$;
CREATE OR REPLACE FUNCTION public.limitar_registros_por_conta()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if (select count(*) from public.registros where user_id = new.user_id) >= 20000 then
    raise exception 'Limite de registros da conta atingido';
  end if;
  return new;
end;
$function$;
CREATE OR REPLACE FUNCTION public.marcar_atualizado()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$ begin new.atualizado_em = now(); return new; end $function$;
CREATE OR REPLACE FUNCTION public.marcar_atualizado_em()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  new.atualizado_em := now();
  return new;
end;
$function$;
CREATE OR REPLACE FUNCTION public.papel_atual()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$ select papel from public.perfis where user_id = auth.uid() and ativo $function$;
CREATE OR REPLACE FUNCTION public.bloquear_email_de_login_interno()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
end $function$;
CREATE OR REPLACE FUNCTION public.encerrar_sessoes(alvo uuid)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$ delete from auth.sessions where user_id = alvo $function$;
CREATE OR REPLACE FUNCTION public.registrar_auditoria()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  uid uuid := auth.uid();
  nome text;
  velho jsonb;
  novo jsonb;
  reg text;
  tim text;
begin
  select usuario into nome from public.perfis where user_id = uid;
  if tg_op <> 'INSERT' then velho := to_jsonb(old); end if;
  if tg_op <> 'DELETE' then novo := to_jsonb(new); end if;
  if tg_op = 'UPDATE' and (velho - 'atualizado_em') = (novo - 'atualizado_em') then return new; end if;
  if tg_table_name = 'registros' then
    reg := coalesce(novo ->> 'chave', velho ->> 'chave');
    tim := nullif(split_part(reg, '|', 2), '');
    if reg = 'cadastro' then
      velho := case when velho is null then null else jsonb_build_object('tamanho', octet_length(velho ->> 'dados')) end;
      novo := case when novo is null then null else jsonb_build_object('tamanho', octet_length(novo ->> 'dados')) end;
    end if;
  else
    reg := coalesce(novo ->> 'id', velho ->> 'id', novo ->> 'user_id', velho ->> 'user_id',
                    coalesce(novo ->> 'data', velho ->> 'data') || '|' || coalesce(novo ->> 'time', velho ->> 'time'),
                    novo ->> 'chave', velho ->> 'chave');
    tim := coalesce(novo ->> 'time', velho ->> 'time');
  end if;
  insert into public.auditoria (user_id, usuario, acao, tabela, registro, time, antes, depois)
  values (uid, coalesce(nome, case when uid is null then 'sistema' end), tg_op, tg_table_name, reg, tim, velho, novo);
  return coalesce(new, old);
end $function$;
CREATE OR REPLACE FUNCTION public.salvar_horario_turno(h time without time zone)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$ update public.perfis set entrada_turno = h where user_id = auth.uid() and papel = 'lider' and ativo $function$;
CREATE OR REPLACE FUNCTION public.time_atual()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$ select time from public.perfis where user_id = auth.uid() and ativo and papel = 'lider' $function$;

CREATE TRIGGER auditoria_envios AFTER INSERT OR DELETE OR UPDATE ON public.envios FOR EACH ROW EXECUTE FUNCTION registrar_auditoria();
CREATE TRIGGER auditoria_funcionarios AFTER INSERT OR DELETE OR UPDATE ON public.funcionarios FOR EACH ROW EXECUTE FUNCTION registrar_auditoria();
CREATE TRIGGER auditoria_lancamentos AFTER INSERT OR DELETE OR UPDATE ON public.lancamentos FOR EACH ROW EXECUTE FUNCTION registrar_auditoria();
CREATE TRIGGER lancamentos_atualizado BEFORE UPDATE ON public.lancamentos FOR EACH ROW EXECUTE FUNCTION marcar_atualizado();
CREATE TRIGGER lancamentos_limite BEFORE INSERT ON public.lancamentos FOR EACH ROW EXECUTE FUNCTION limitar_lancamentos();
CREATE TRIGGER auditoria_parametros AFTER INSERT OR DELETE OR UPDATE ON public.parametros FOR EACH ROW EXECUTE FUNCTION registrar_auditoria();
CREATE TRIGGER parametros_atualizado BEFORE UPDATE ON public.parametros FOR EACH ROW EXECUTE FUNCTION marcar_atualizado();
CREATE TRIGGER auditoria_perfis AFTER INSERT OR DELETE OR UPDATE ON public.perfis FOR EACH ROW EXECUTE FUNCTION registrar_auditoria();
CREATE TRIGGER auditoria_registros AFTER INSERT OR DELETE OR UPDATE ON public.registros FOR EACH ROW EXECUTE FUNCTION registrar_auditoria();
CREATE TRIGGER registros_atualizado_em BEFORE INSERT OR UPDATE ON public.registros FOR EACH ROW EXECUTE FUNCTION marcar_atualizado_em();
CREATE TRIGGER registros_limite_por_conta BEFORE INSERT ON public.registros FOR EACH ROW EXECUTE FUNCTION limitar_registros_por_conta();
CREATE TRIGGER auth_exigir_convite BEFORE INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION exigir_convite();
CREATE TRIGGER auth_bloquear_email_interno BEFORE UPDATE ON auth.users FOR EACH ROW EXECUTE FUNCTION bloquear_email_de_login_interno();
