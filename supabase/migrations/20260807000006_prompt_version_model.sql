-- Modelo asociado a cada versión del prompt (proveedor + id de modelo).
-- Así cada versión guarda con qué modelo se prueba, y la versión activa
-- define el modelo que se envía a n8n.
alter table public.dev_prompt_versions
  add column if not exists provider text,
  add column if not exists model text;
