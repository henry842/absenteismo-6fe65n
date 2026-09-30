
-- Atraso pode ser lançado sem a hora de chegada ("aguardando chegada"); nova categoria: saída antecipada.
alter table public.lancamentos add column hora_saida time;

alter table public.lancamentos drop constraint atraso_tem_horas;
alter table public.lancamentos drop constraint lancamentos_tipo_check;
alter table public.lancamentos add constraint lancamentos_tipo_check check (tipo in ('ausencia', 'atraso', 'saida'));
alter table public.lancamentos add constraint atraso_tem_horario check (tipo <> 'atraso' or hora_prevista is not null);
alter table public.lancamentos add constraint saida_tem_horario check (tipo <> 'saida' or hora_saida is not null);

-- Uma situação de presença por pessoa e dia (ausência OU atraso), e no máximo uma saída antecipada
drop index public.lancamentos_uma_vez_por_dia;
create unique index lancamentos_uma_vez_por_dia on public.lancamentos
  (data, time, (coalesce(nullif(matricula, ''), nome)), ((tipo = 'saida')));
