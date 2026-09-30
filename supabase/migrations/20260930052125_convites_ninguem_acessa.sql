
-- Convites só são lidos e gravados pela função admin-lideres (chave de serviço, que ignora RLS).
create policy convites_ninguem on public.convites for all to anon, authenticated using (false) with check (false);
