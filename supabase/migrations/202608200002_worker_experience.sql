-- Perfil editable y reparación segura del onboarding para instalaciones existentes.
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
  if cardinality(p_categories)=0 then raise exception 'Elige al menos una categoría'; end if;
  update profiles set full_name=trim(p_name),phone=trim(p_phone),municipality=p_municipality,updated_at=now() where id=auth.uid();
  update workers set age=p_age,zone=trim(p_zone),categories=p_categories,availability=trim(p_availability) where profile_id=auth.uid();
  if not found then raise exception 'No se encontró tu perfil de trabajador'; end if;
  insert into user_activity(user_id,event,metadata) values(auth.uid(),'worker_profile_updated','{}');
end $$;

revoke execute on function public.update_worker_profile(text,text,text,int,text,text[],text) from public,anon;
grant execute on function public.update_worker_profile(text,text,text,int,text,text[],text) to authenticated;

create or replace function public.get_candidate_counts(p_job_ids uuid[])
returns table(job_id uuid,candidate_count bigint)
language sql stable security definer set search_path=public as $$
  select a.job_id,count(*) from applications a join jobs j on j.id=a.job_id
  where a.job_id=any(p_job_ids) and j.status in ('open','candidates_available','filled') and a.status in ('interested','selected','confirmed')
  group by a.job_id
$$;
revoke execute on function public.get_candidate_counts(uuid[]) from public,anon;
grant execute on function public.get_candidate_counts(uuid[]) to authenticated;

-- Lectura segura del perfil propio, independiente de caché o políticas recursivas.
create or replace function public.get_my_profile()
returns table(id uuid,full_name text,phone text,role user_role,status account_status,municipality text)
language sql stable security definer set search_path=public as $$
  select p.id,p.full_name,p.phone,p.role,p.status,p.municipality
  from profiles p where p.id=auth.uid()
$$;
revoke execute on function public.get_my_profile() from public,anon;
grant execute on function public.get_my_profile() to authenticated;
