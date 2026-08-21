-- Lectura y guardado robustos del perfil de trabajador.
create or replace function public.get_my_worker_profile()
returns table(
  profile_id uuid,
  age smallint,
  zone text,
  categories text[],
  availability text,
  opportunity_score smallint,
  completed_jobs integer,
  no_show_count integer,
  rating_average numeric,
  attendance_rate numeric
)
language sql stable security definer set search_path=public as $$
  select w.profile_id,w.age,w.zone,w.categories,w.availability,w.opportunity_score,
         w.completed_jobs,w.no_show_count,w.rating_average,w.attendance_rate
  from workers w
  join profiles p on p.id=w.profile_id
  where w.profile_id=auth.uid() and p.role='worker'
$$;

revoke execute on function public.get_my_worker_profile() from public,anon;
grant execute on function public.get_my_worker_profile() to authenticated;

create or replace function public.update_worker_profile(
  p_name text,
  p_phone text,
  p_municipality text,
  p_age int,
  p_zone text,
  p_categories text[],
  p_availability text
) returns void
language plpgsql security definer set search_path=public as $$
begin
  if not exists(select 1 from profiles where id=auth.uid() and role='worker' and status='active') then
    raise exception 'Perfil de trabajador no válido';
  end if;
  if p_age not between 18 and 90 then raise exception 'La edad debe estar entre 18 y 90 años'; end if;
  if cardinality(p_categories)=0 then raise exception 'Elige al menos una categoría'; end if;
  if char_length(trim(p_zone)) < 2 then raise exception 'Escribe tu colonia o zona'; end if;
  if char_length(trim(p_availability)) < 2 then raise exception 'Escribe tu disponibilidad'; end if;

  update profiles
  set full_name=trim(p_name),phone=trim(p_phone),municipality=p_municipality,updated_at=now()
  where id=auth.uid();

  insert into workers(profile_id,age,zone,categories,availability)
  values(auth.uid(),p_age,trim(p_zone),p_categories,trim(p_availability))
  on conflict(profile_id) do update set
    age=excluded.age,
    zone=excluded.zone,
    categories=excluded.categories,
    availability=excluded.availability;

  insert into user_activity(user_id,event,metadata)
  values(auth.uid(),'worker_profile_updated','{}');
end $$;

revoke execute on function public.update_worker_profile(text,text,text,int,text,text[],text) from public,anon;
grant execute on function public.update_worker_profile(text,text,text,int,text,text[],text) to authenticated;
