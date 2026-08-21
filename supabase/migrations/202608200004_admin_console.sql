-- Consola administrativa: métricas generales, detalle por usuario y metas.
insert into public.app_settings(key,value) values
  ('admin_goals','{"monthly_revenue":5000,"monthly_completed_jobs":50,"total_users":100,"monthly_paid_posts":25}')
on conflict(key) do nothing;

create or replace function public.admin_console()
returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare result jsonb;
begin
  if not is_admin() then raise exception 'No autorizado'; end if;
  select jsonb_build_object(
    'summary',jsonb_build_object(
      'users_total',(select count(*) from profiles),
      'workers',(select count(*) from profiles where role='worker'),
      'employers',(select count(*) from profiles where role='employer'),
      'active_users',(select count(*) from profiles where status='active'),
      'jobs_total',(select count(*) from jobs),
      'jobs_open',(select count(*) from jobs where status in ('open','candidates_available')),
      'jobs_completed',(select count(*) from jobs where status='completed'),
      'monthly_completed_jobs',(select count(*) from jobs where status='completed' and updated_at>=date_trunc('month',now())),
      'jobs_completed_clean',(select count(*) from jobs j where j.status='completed' and not exists(select 1 from reports r where r.job_id=j.id and r.status in ('open','reviewing','resolved'))),
      'applications',(select count(*) from applications),
      'confirmed_workers',(select count(*) from applications where status in ('confirmed','completed')),
      'pending_payments',(select count(*) from payments where status='reported'),
      'confirmed_payments',(select count(*) from payments where status='confirmed'),
      'rejected_payments',(select count(*) from payments where status='rejected'),
      'platform_revenue',(select coalesce(sum(amount),0) from payments where status='confirmed'),
      'monthly_revenue',(select coalesce(sum(amount),0) from payments where status='confirmed' and confirmed_at>=date_trunc('month',now())),
      'monthly_paid_posts',(select count(*) from payments where status='confirmed' and confirmed_at>=date_trunc('month',now())),
      'completed_job_value',(select coalesce(sum(j.pay_amount),0) from applications a join jobs j on j.id=a.job_id where a.status='completed' and coalesce(a.paid_as_agreed,true)),
      'reports_open',(select count(*) from reports where status in ('open','reviewing')),
      'no_shows',(select coalesce(sum(no_show_count),0) from workers)
    ),
    'goals',(select value from app_settings where key='admin_goals'),
    'employers',coalesce((select jsonb_agg(to_jsonb(e) order by e.total_jobs desc,e.full_name) from (
      select p.id,p.full_name,p.phone,p.municipality,p.status,p.created_at,em.employer_type,em.rating_average,
        (select count(*) from jobs j where j.employer_id=p.id)::int total_jobs,
        (select count(*) from jobs j where j.employer_id=p.id and j.status in ('open','candidates_available'))::int open_jobs,
        (select count(*) from jobs j where j.employer_id=p.id and j.status='completed')::int completed_jobs,
        (select count(*) from payments py where py.employer_id=p.id and py.status='confirmed')::int paid_posts,
        (select coalesce(sum(py.amount),0) from payments py where py.employer_id=p.id and py.status='confirmed') platform_paid,
        (select coalesce(sum(j.pay_amount*j.workers_needed),0) from jobs j where j.employer_id=p.id and j.status='completed') completed_payroll
      from profiles p join employers em on em.profile_id=p.id
      where p.role='employer'
    ) e),'[]'::jsonb),
    'workers',coalesce((select jsonb_agg(to_jsonb(wr) order by wr.completed_jobs desc,wr.full_name) from (
      select p.id,p.full_name,p.phone,p.municipality,p.status,p.created_at,w.age,w.zone,w.categories,w.availability,
        w.completed_jobs,w.no_show_count,w.rating_average,w.attendance_rate,
        count(a.id) filter(where a.status in ('interested','selected','confirmed'))::int active_applications,
        coalesce(sum(j.pay_amount) filter(where a.status='completed' and coalesce(a.paid_as_agreed,true)),0) total_earned
      from profiles p join workers w on w.profile_id=p.id
      left join applications a on a.worker_id=p.id
      left join jobs j on j.id=a.job_id
      where p.role='worker'
      group by p.id,p.full_name,p.phone,p.municipality,p.status,p.created_at,w.age,w.zone,w.categories,w.availability,w.completed_jobs,w.no_show_count,w.rating_average,w.attendance_rate
    ) wr),'[]'::jsonb),
    'payments',coalesce((select jsonb_agg(to_jsonb(py) order by py.reported_at desc) from (
      select pay.id,pay.reference,pay.amount,pay.status,pay.reported_at,pay.confirmed_at,pay.rejection_reason,
        j.id job_id,j.title job_title,j.status job_status,p.full_name employer_name,p.phone employer_phone,p.municipality
      from payments pay join jobs j on j.id=pay.job_id join profiles p on p.id=pay.employer_id
    ) py),'[]'::jsonb)
  ) into result;
  return result;
end $$;

revoke execute on function public.admin_console() from public,anon;
grant execute on function public.admin_console() to authenticated;

create or replace function public.admin_update_goals(
  p_monthly_revenue numeric,
  p_monthly_completed_jobs integer,
  p_total_users integer,
  p_monthly_paid_posts integer
) returns void
language plpgsql security definer set search_path=public as $$
begin
  if not is_admin() then raise exception 'No autorizado'; end if;
  if least(p_monthly_revenue,p_monthly_completed_jobs,p_total_users,p_monthly_paid_posts)<0 then
    raise exception 'Las metas no pueden ser negativas';
  end if;
  insert into app_settings(key,value) values('admin_goals',jsonb_build_object(
    'monthly_revenue',p_monthly_revenue,
    'monthly_completed_jobs',p_monthly_completed_jobs,
    'total_users',p_total_users,
    'monthly_paid_posts',p_monthly_paid_posts
  )) on conflict(key) do update set value=excluded.value,updated_at=now();
  insert into user_activity(user_id,event,metadata) values(auth.uid(),'admin_goals_updated','{}');
end $$;

revoke execute on function public.admin_update_goals(numeric,integer,integer,integer) from public,anon;
grant execute on function public.admin_update_goals(numeric,integer,integer,integer) to authenticated;

-- Úsalo solamente desde Supabase SQL Editor. No queda disponible para la aplicación.
create or replace function public.bootstrap_superadmin(p_email text)
returns text
language plpgsql security definer set search_path=public,auth as $$
declare target_id uuid;
begin
  select id into target_id from auth.users where lower(email)=lower(trim(p_email));
  if target_id is null then raise exception 'Primero crea y confirma esa cuenta en Jale'; end if;
  if exists(select 1 from applications where worker_id=target_id) or exists(select 1 from jobs where employer_id=target_id) then
    raise exception 'La cuenta ya tiene actividad; crea una cuenta exclusiva para administración';
  end if;
  delete from workers where profile_id=target_id;
  delete from employers where profile_id=target_id;
  update profiles set role='admin',status='active',updated_at=now() where id=target_id;
  if not found then raise exception 'La cuenta todavía no terminó su registro en Jale'; end if;
  return 'Cuenta superadmin activada';
end $$;
revoke all on function public.bootstrap_superadmin(text) from public,anon,authenticated;
