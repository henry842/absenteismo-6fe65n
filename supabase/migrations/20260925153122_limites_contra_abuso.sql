-- Só os três tipos de registro que o app usa
alter table public.registros
  add constraint registros_chave_formato check (chave ~ '^(config|cadastro|[0-9]{4}-[0-9]{2}-[0-9]{2}\|.{1,60})$');

-- Tamanho por tipo: lançamento de um time/dia até 100 KB; config até 100 KB; cadastro até 500 KB
alter table public.registros drop constraint registros_dados_tamanho;
alter table public.registros
  add constraint registros_dados_tamanho check (
    dados is null
    or (chave = 'cadastro' and octet_length(dados::text) <= 512000)
    or (chave <> 'cadastro' and octet_length(dados::text) <= 102400)
  );

-- No máximo 20 mil registros por conta (mais de 5 anos de uso diário com 10 times)
create or replace function public.limitar_registros_por_conta()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select count(*) from public.registros where user_id = new.user_id) >= 20000 then
    raise exception 'Limite de registros da conta atingido';
  end if;
  return new;
end;
$$;
revoke execute on function public.limitar_registros_por_conta() from public, anon, authenticated;

create trigger registros_limite_por_conta
before insert on public.registros
for each row execute function public.limitar_registros_por_conta();
