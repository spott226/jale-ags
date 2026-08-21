-- Expone la lectura a usuarios autenticados; RLS sigue limitando dueño o administrador.
grant usage on schema public to authenticated;
grant select on table public.support_tickets to authenticated;
grant select on table public.profiles to authenticated;

-- Fuerza a la API de Supabase/PostgREST a reconocer la tabla y su relación con profiles.
notify pgrst, 'reload schema';
