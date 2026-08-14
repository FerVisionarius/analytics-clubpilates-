-- Devuelve los branch_id que tienen alguna clase con plazas (clubes "abiertos"),
-- para el panel LASERR global. Evita traer todas las filas de classes al cliente.
create or replace function public.branches_with_classes()
returns table(branch_id text)
language sql
stable
security definer
as $$
  select distinct branch_id from public.classes where capacity > 0
$$;
