-- Revisão de segurança (30/09/2026)
-- 1) Auditoria também da tabela registros (é ela que o app de fechamento usa): quem mudou qual lançamento,
--    quando, e como estava antes/depois. Lançamento apagado continua recuperável pelo "antes".
--    O cadastro (lista matrícula → nome, grande e regravada a cada lançamento) só registra o tamanho,
--    para a auditoria não virar uma segunda cópia inteira dos dados das pessoas a cada gravação.
create or replace function public.registrar_auditoria() returns trigger
language plpgsql security definer set search_path = '' as $$
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
end $$;
revoke all on function public.registrar_auditoria() from public, anon, authenticated;

create trigger auditoria_registros after insert or update or delete on public.registros
  for each row execute function public.registrar_auditoria();

-- 2) search_path vazio nas funções SECURITY DEFINER (os nomes dentro delas já são qualificados:
--    public.perfis, auth.uid()). Evita que um objeto criado em outro schema seja usado no lugar.
alter function public.papel_atual() set search_path = '';
alter function public.time_atual() set search_path = '';
alter function public.salvar_horario_turno(time) set search_path = '';
