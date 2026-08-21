-- Jale MVP: schema, transactional business rules and strict RLS.
create extension if not exists pgcrypto;

create type public.user_role as enum ('worker','employer','admin');
create type public.account_status as enum ('active','suspended','blocked');
create type public.job_status as enum ('draft','awaiting_payment','open','candidates_available','filled','completed','cancelled');
create type public.application_status as enum ('interested','selected','confirmed','rejected','withdrawn','completed','no_show');
create type public.payment_status as enum ('reported','confirmed','rejected');
create type public.report_status as enum ('open','reviewing','resolved','dismissed');

create table public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
insert into public.app_settings(key,value) values
  ('free_posts','2'), ('post_price_mxn','50'), ('max_active_applications','3'),
  ('candidate_caps','{"one":5,"two":6,"three":8,"small_multiplier":2,"medium_multiplier":1.75,"large_multiplier":1.5}'),
  ('opportunity_score','{"base":50,"never_completed":20,"inactive_return":12,"days_divisor":14,"max_days_bonus":20,"recent_rejection":3,"max_rejection_bonus":12,"attendance_bonus":10,"good_rating":8,"recent_completed":-6,"active_application":-4,"no_show":-15,"conflicting_selection":-20}');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null check (char_length(full_name) between 2 and 100),
  phone text not null check (phone ~ '^[0-9+ ()-]{10,20}$'),
  role public.user_role not null,
  status public.account_status not null default 'active',
  municipality text,
  last_active_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workers (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  age smallint not null check (age between 18 and 90),
  zone text not null check (char_length(zone) between 2 and 100),
  categories text[] not null check (cardinality(categories) > 0),
  availability text not null check (char_length(availability) between 2 and 300),
  opportunity_score smallint not null default 70 check (opportunity_score between 0 and 100),
  completed_jobs integer not null default 0 check (completed_jobs >= 0),
  no_show_count integer not null default 0 check (no_show_count >= 0),
  rating_average numeric(3,2),
  attendance_rate numeric(5,2),
  last_job_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.employers (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  employer_type text not null check (employer_type in ('Persona','Negocio')),
  free_posts_used smallint not null default 0 check (free_posts_used between 0 and 2),
  rating_average numeric(3,2),
  created_at timestamptz not null default now()
);

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  employer_id uuid not null references public.employers(profile_id),
  title text not null check (char_length(title) between 5 and 100),
  category text not null,
  description text not null check (char_length(description) between 10 and 600),
  workers_needed integer not null check (workers_needed between 1 and 50),
  municipality text not null,
  zone text not null check (char_length(zone) between 2 and 100),
  job_date date not null,
  start_time time not null,
  duration_hours numeric(4,1) not null check (duration_hours > 0 and duration_hours <= 336),
  pay_amount numeric(10,2) not null check (pay_amount > 0),
  payment_method text not null check (payment_method in ('efectivo','transferencia')),
  notes text check (char_length(notes) <= 500),
  status public.job_status not null default 'draft',
  paid boolean not null default false,
  candidate_limit integer not null check (candidate_limit >= workers_needed),
  first_application_at timestamptz,
  filled_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.applications (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  worker_id uuid not null references public.workers(profile_id),
  status public.application_status not null default 'interested',
  opportunity_score_at_apply smallint not null,
  applied_at timestamptz not null default now(),
  selected_at timestamptz,
  confirmed_at timestamptz,
  worker_completed_at timestamptz,
  employer_completed_at timestamptz,
  presented boolean,
  paid_as_agreed boolean,
  completed_at timestamptz,
  unique(job_id, worker_id)
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null unique references public.jobs(id) on delete cascade,
  employer_id uuid not null references public.employers(profile_id),
  reference text not null unique check (reference ~ '^JALE-[A-Z0-9]{4,10}$'),
  amount numeric(10,2) not null default 50 check (amount > 0),
  status public.payment_status not null default 'reported',
  reported_at timestamptz not null default now(),
  confirmed_at timestamptz,
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  rejection_reason text
);

create table public.ratings (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  rater_id uuid not null references public.profiles(id),
  rated_id uuid not null references public.profiles(id),
  direction text not null check (direction in ('worker_to_employer','employer_to_worker')),
  score smallint not null check (score between 1 and 5),
  comment text check (char_length(comment) <= 300),
  created_at timestamptz not null default now(),
  unique(application_id, direction),
  check (rater_id <> rated_id)
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id),
  reported_user_id uuid references public.profiles(id),
  job_id uuid references public.jobs(id),
  application_id uuid references public.applications(id),
  reason text not null check (reason in ('No me pagaron','Cambiaron el pago','Cambiaron el trabajo','Trato inapropiado','No-show','Otro')),
  details text check (char_length(details) <= 1000),
  status public.report_status not null default 'open',
  admin_notes text,
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.user_activity (
  id bigint generated always as identity primary key,
  user_id uuid references public.profiles(id) on delete set null,
  event text not null,
  job_id uuid references public.jobs(id) on delete set null,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index jobs_open_date_idx on public.jobs(status, job_date, start_time);
create index jobs_employer_idx on public.jobs(employer_id, created_at desc);
create index jobs_category_municipality_idx on public.jobs(category, municipality);
create index applications_worker_status_idx on public.applications(worker_id, status);
create index applications_job_status_idx on public.applications(job_id, status);
create index payments_status_idx on public.payments(status, reported_at);
create index reports_status_idx on public.reports(status, created_at);
create index activity_event_created_idx on public.user_activity(event, created_at);

create or replace function public.is_admin(uid uuid default auth.uid()) returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from profiles where id = uid and role = 'admin' and status = 'active')
$$;

create or replace function public.is_job_employer(p_job_id uuid) returns boolean
language sql stable security definer set search_path=public as $$
  select exists(select 1 from jobs where id=p_job_id and employer_id=auth.uid())
$$;

create or replace function public.has_job_application(p_job_id uuid) returns boolean
language sql stable security definer set search_path=public as $$
  select exists(select 1 from applications where job_id=p_job_id and worker_id=auth.uid())
$$;

create or replace function public.candidate_limit_for(needed integer) returns integer
language plpgsql stable security definer set search_path=public as $$
declare c jsonb;
begin
  select value into c from app_settings where key='candidate_caps';
  return case when needed=1 then (c->>'one')::int when needed=2 then (c->>'two')::int when needed=3 then (c->>'three')::int
    when needed between 4 and 5 then ceil(needed*(c->>'small_multiplier')::numeric)::int
    when needed between 6 and 10 then ceil(needed*(c->>'medium_multiplier')::numeric)::int
    else ceil(needed*(c->>'large_multiplier')::numeric)::int end;
end $$;

create or replace function public.calculate_opportunity_score(p_worker_id uuid) returns smallint
language plpgsql stable security definer set search_path=public as $$
declare w workers; cfg jsonb; score numeric; active_count int; recent_done int; recent_rejected int; days_without int; days_inactive int;
begin
  select * into w from workers where profile_id=p_worker_id;
  select value into cfg from app_settings where key='opportunity_score';
  select count(*) filter(where status in ('interested','selected','confirmed')),
         count(*) filter(where status='completed' and completed_at>now()-interval '30 days'),
         count(*) filter(where status='rejected' and selected_at>now()-interval '30 days')
    into active_count,recent_done,recent_rejected from applications where worker_id=p_worker_id;
  days_without:=coalesce(extract(day from now()-w.last_job_at)::int,90);
  select extract(day from now()-last_active_at)::int into days_inactive from profiles where id=p_worker_id;
  score:=(cfg->>'base')::numeric
    + case when w.completed_jobs=0 then (cfg->>'never_completed')::numeric else 0 end
    + case when days_inactive>=60 then (cfg->>'inactive_return')::numeric else 0 end
    + least((cfg->>'max_days_bonus')::numeric,floor(days_without/(cfg->>'days_divisor')::numeric))
    + least((cfg->>'max_rejection_bonus')::numeric,recent_rejected*(cfg->>'recent_rejection')::numeric)
    + case when w.attendance_rate>=90 then (cfg->>'attendance_bonus')::numeric else 0 end
    + case when w.rating_average>=4.5 then (cfg->>'good_rating')::numeric else 0 end
    + recent_done*(cfg->>'recent_completed')::numeric + active_count*(cfg->>'active_application')::numeric
    + w.no_show_count*(cfg->>'no_show')::numeric;
  return greatest(0,least(100,round(score)))::smallint;
end $$;

create or replace function public.log_activity(evt text, jid uuid default null, meta jsonb default '{}') returns void
language plpgsql security definer set search_path=public as $$
begin insert into user_activity(user_id,event,job_id,metadata) values(auth.uid(),evt,jid,meta); end $$;

create or replace function public.complete_onboarding(p_name text,p_phone text,p_role user_role,p_municipality text,p_age int default null,p_zone text default null,p_categories text[] default null,p_availability text default null,p_employer_type text default null) returns void
language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is null or p_role='admin' or exists(select 1 from profiles where id=auth.uid()) then raise exception 'Registro no permitido'; end if;
  insert into profiles(id,full_name,phone,role,municipality) values(auth.uid(),trim(p_name),trim(p_phone),p_role,p_municipality);
  if p_role='worker' then
    insert into workers(profile_id,age,zone,categories,availability) values(auth.uid(),p_age,trim(p_zone),p_categories,trim(p_availability));
  else
    insert into employers(profile_id,employer_type) values(auth.uid(),p_employer_type);
  end if;
end $$;

create or replace function public.create_job(
  p_title text, p_category text, p_description text, p_workers_needed int,
  p_municipality text, p_zone text, p_job_date date, p_start_time time,
  p_duration_hours numeric, p_pay_amount numeric, p_payment_method text, p_notes text default null
) returns public.jobs
language plpgsql security definer set search_path=public as $$
declare emp employers; result jobs; is_free boolean; free_limit int;
begin
  select e.* into emp from employers e join profiles p on p.id=e.profile_id
  where e.profile_id=auth.uid() and p.status='active' for update;
  if not found then raise exception 'Sólo un empleador activo puede publicar'; end if;
  if p_job_date < current_date or p_duration_hours > 336 or p_pay_amount <= 0 then raise exception 'Datos del jale inválidos'; end if;
  select (value #>> '{}')::int into free_limit from app_settings where key='free_posts';
  is_free := emp.free_posts_used < free_limit;
  insert into jobs(employer_id,title,category,description,workers_needed,municipality,zone,job_date,start_time,duration_hours,pay_amount,payment_method,notes,status,paid,candidate_limit,published_at)
  values(auth.uid(),trim(p_title),p_category,trim(p_description),p_workers_needed,p_municipality,trim(p_zone),p_job_date,p_start_time,p_duration_hours,p_pay_amount,p_payment_method,nullif(trim(p_notes),''),case when is_free then 'open'::job_status else 'awaiting_payment'::job_status end,false,candidate_limit_for(p_workers_needed),case when is_free then now() end)
  returning * into result;
  if is_free then update employers set free_posts_used=free_posts_used+1 where profile_id=auth.uid(); end if;
  perform log_activity('job_created',result.id,jsonb_build_object('free',is_free));
  return result;
end $$;

create or replace function public.report_payment(p_job_id uuid) returns public.payments
language plpgsql security definer set search_path=public as $$
declare result payments; ref text; price numeric;
begin
  if not exists(select 1 from jobs where id=p_job_id and employer_id=auth.uid() and status='awaiting_payment') then raise exception 'Jale no válido para pago'; end if;
  ref := 'JALE-' || upper(substr(replace(p_job_id::text,'-',''),1,6));
  select (value #>> '{}')::numeric into price from app_settings where key='post_price_mxn';
  insert into payments(job_id,employer_id,reference,amount,status)
  values(p_job_id,auth.uid(),ref,price,'reported')
  on conflict(job_id) do update set status='reported',reported_at=now(),rejection_reason=null
  returning * into result;
  perform log_activity('payment_reported',p_job_id,jsonb_build_object('reference',result.reference));
  return result;
end $$;

create or replace function public.admin_review_payment(p_payment_id uuid,p_confirm boolean,p_reason text default null) returns void
language plpgsql security definer set search_path=public as $$
declare pay payments;
begin
  if not is_admin() then raise exception 'No autorizado'; end if;
  select * into pay from payments where id=p_payment_id for update;
  if pay.status <> 'reported' then raise exception 'Pago ya revisado'; end if;
  if p_confirm then
    update payments set status='confirmed',confirmed_at=now(),reviewed_at=now(),reviewed_by=auth.uid() where id=p_payment_id;
    update jobs set status='open',paid=true,published_at=now(),updated_at=now() where id=pay.job_id and status='awaiting_payment';
  else
    update payments set status='rejected',rejection_reason=coalesce(nullif(trim(p_reason),''),'Comprobante no validado'),reviewed_at=now(),reviewed_by=auth.uid() where id=p_payment_id;
  end if;
  insert into user_activity(user_id,event,job_id,metadata) values(auth.uid(),case when p_confirm then 'payment_confirmed' else 'payment_rejected' end,pay.job_id,'{}');
end $$;

create or replace function public.apply_to_job(p_job_id uuid) returns public.applications
language plpgsql security definer set search_path=public as $$
declare j jobs; w workers; active_count int; current_count int; result applications;
begin
  update workers set opportunity_score=calculate_opportunity_score(auth.uid()) where profile_id=auth.uid();
  select * into w from workers where profile_id=auth.uid();
  if not found or not exists(select 1 from profiles where id=auth.uid() and status='active') then raise exception 'Perfil de trabajador no válido'; end if;
  select * into j from jobs where id=p_job_id for update;
  if j.status not in ('open','candidates_available') or (j.job_date+j.start_time) <= now() then raise exception 'Este jale ya no recibe interesados'; end if;
  select count(*) into active_count from applications a join jobs aj on aj.id=a.job_id where a.worker_id=auth.uid() and a.status in ('interested','selected','confirmed') and aj.status not in ('completed','cancelled');
  if active_count >= 3 then raise exception 'Ya tienes 3 postulaciones activas'; end if;
  select count(*) into current_count from applications where job_id=p_job_id and status in ('interested','selected','confirmed');
  if current_count >= j.candidate_limit then raise exception 'Ya se llenaron los lugares para interesados'; end if;
  insert into applications(job_id,worker_id,opportunity_score_at_apply) values(p_job_id,auth.uid(),w.opportunity_score) returning * into result;
  update jobs set first_application_at=coalesce(first_application_at,now()),status='candidates_available',updated_at=now() where id=p_job_id;
  perform log_activity('application_created',p_job_id,'{}');
  return result;
end $$;

create or replace function public.withdraw_application(p_application_id uuid) returns void
language plpgsql security definer set search_path=public as $$
begin
  update applications set status='withdrawn' where id=p_application_id and worker_id=auth.uid() and status in ('interested','selected');
  if not found then raise exception 'No puedes retirar esta postulación'; end if;
end $$;

create or replace function public.select_application(p_application_id uuid) returns void
language plpgsql security definer set search_path=public as $$
declare app applications; j jobs; occupied int;
begin
  select a.* into app from applications a where a.id=p_application_id for update;
  select * into j from jobs where id=app.job_id and employer_id=auth.uid() for update;
  if not found or j.status not in ('open','candidates_available','filled') or app.status <> 'interested' then raise exception 'No puedes seleccionar esta postulación'; end if;
  select count(*) into occupied from applications where job_id=j.id and status in ('selected','confirmed');
  if occupied >= j.workers_needed then raise exception 'Ya seleccionaste a todas las personas necesarias'; end if;
  update applications set status='selected',selected_at=now() where id=p_application_id;
  perform log_activity('worker_selected',j.id,jsonb_build_object('application_id',p_application_id));
end $$;

create or replace function public.respond_to_selection(p_application_id uuid,p_accept boolean) returns void
language plpgsql security definer set search_path=public as $$
declare app applications; j jobs; conflict boolean; confirmed_count int;
begin
  select a.* into app from applications a where a.id=p_application_id and a.worker_id=auth.uid() for update;
  if app.status <> 'selected' then raise exception 'Esta selección ya no está disponible'; end if;
  if not p_accept then update applications set status='rejected' where id=p_application_id; return; end if;
  select * into j from jobs where id=app.job_id for update;
  select exists(
    select 1 from applications a2 join jobs j2 on j2.id=a2.job_id
    where a2.worker_id=auth.uid() and a2.status='confirmed' and a2.id<>app.id
      and tsrange((j.job_date+j.start_time)::timestamp,((j.job_date+j.start_time)+(j.duration_hours||' hours')::interval)::timestamp,'[)')
       && tsrange((j2.job_date+j2.start_time)::timestamp,((j2.job_date+j2.start_time)+(j2.duration_hours||' hours')::interval)::timestamp,'[)')
  ) into conflict;
  if conflict then raise exception 'Este horario choca con otro jale que ya confirmaste'; end if;
  select count(*) into confirmed_count from applications where job_id=j.id and status='confirmed';
  if confirmed_count >= j.workers_needed then raise exception 'El jale ya está cubierto'; end if;
  update applications set status='confirmed',confirmed_at=now() where id=p_application_id;
  confirmed_count := confirmed_count+1;
  if confirmed_count >= j.workers_needed then
    update jobs set status='filled',filled_at=coalesce(filled_at,now()),updated_at=now() where id=j.id;
    update applications set status='rejected' where job_id=j.id and status='interested';
  end if;
  perform log_activity('selection_confirmed',j.id,'{}');
end $$;

create or replace function public.employer_finish_application(p_application_id uuid,p_presented boolean,p_rating int,p_comment text default null) returns void
language plpgsql security definer set search_path=public as $$
declare app applications; j jobs;
begin
  select a.* into app from applications a where a.id=p_application_id for update;
  select * into j from jobs where id=app.job_id and employer_id=auth.uid();
  if not found or app.status<>'confirmed' or (j.job_date+j.start_time+(j.duration_hours||' hours')::interval)>now() then raise exception 'Aún no puedes finalizar este jale'; end if;
  update applications set employer_completed_at=now(),presented=p_presented,status=case when p_presented then status else 'no_show' end where id=app.id;
  insert into ratings(application_id,rater_id,rated_id,direction,score,comment) values(app.id,auth.uid(),app.worker_id,'employer_to_worker',p_rating,nullif(trim(p_comment),''));
  if not p_presented then
    update workers set no_show_count=no_show_count+1 where profile_id=app.worker_id;
    insert into reports(reporter_id,reported_user_id,job_id,application_id,reason) values(auth.uid(),app.worker_id,j.id,app.id,'No-show');
  end if;
  perform public.finalize_application_if_ready(app.id);
end $$;

create or replace function public.worker_finish_application(p_application_id uuid,p_paid boolean,p_rating int,p_comment text default null) returns void
language plpgsql security definer set search_path=public as $$
declare app applications; j jobs;
begin
  select a.* into app from applications a where a.id=p_application_id and a.worker_id=auth.uid() for update;
  select * into j from jobs where id=app.job_id;
  if app.status not in ('confirmed','no_show') or (j.job_date+j.start_time+(j.duration_hours||' hours')::interval)>now() then raise exception 'Aún no puedes finalizar este jale'; end if;
  update applications set worker_completed_at=now(),paid_as_agreed=p_paid where id=app.id;
  insert into ratings(application_id,rater_id,rated_id,direction,score,comment) values(app.id,auth.uid(),j.employer_id,'worker_to_employer',p_rating,nullif(trim(p_comment),''));
  if not p_paid then insert into reports(reporter_id,reported_user_id,job_id,application_id,reason) values(auth.uid(),j.employer_id,j.id,app.id,'No me pagaron'); end if;
  perform public.finalize_application_if_ready(app.id);
end $$;

create or replace function public.finalize_application_if_ready(p_application_id uuid) returns void
language plpgsql security definer set search_path=public as $$
declare app applications;
begin
  select * into app from applications where id=p_application_id for update;
  if app.worker_completed_at is not null and app.employer_completed_at is not null and app.presented is true then
    update applications set status='completed',completed_at=now() where id=app.id;
    update workers set completed_jobs=completed_jobs+1,last_job_at=now() where profile_id=app.worker_id;
  end if;
  update jobs j set status='completed',updated_at=now()
  where j.id=app.job_id and not exists(select 1 from applications a where a.job_id=j.id and a.status='confirmed');
  perform public.refresh_reputation(app.worker_id);
  perform public.refresh_reputation((select employer_id from jobs where id=app.job_id));
end $$;

create or replace function public.refresh_reputation(p_user_id uuid) returns void
language plpgsql security definer set search_path=public as $$
begin
  if exists(select 1 from workers where profile_id=p_user_id) then
    update workers w set
      rating_average=(select round(avg(r.score),2) from ratings r where r.rated_id=p_user_id and r.direction='employer_to_worker'),
      attendance_rate=(select round(100.0*count(*) filter(where a.presented=true)/nullif(count(*) filter(where a.presented is not null),0),2) from applications a where a.worker_id=p_user_id)
    where w.profile_id=p_user_id;
    update workers set opportunity_score=calculate_opportunity_score(p_user_id) where profile_id=p_user_id;
  else
    update employers e set rating_average=(select round(avg(r.score),2) from ratings r where r.rated_id=p_user_id and r.direction='worker_to_employer') where e.profile_id=p_user_id;
  end if;
end $$;

create or replace function public.create_report(p_job_id uuid,p_reason text,p_details text default null) returns uuid
language plpgsql security definer set search_path=public as $$
declare rid uuid; target uuid; aid uuid;
begin
  select j.employer_id,a.id into target,aid from jobs j join applications a on a.job_id=j.id and a.worker_id=auth.uid() where j.id=p_job_id;
  if not found then raise exception 'Sin relación con este jale'; end if;
  insert into reports(reporter_id,reported_user_id,job_id,application_id,reason,details) values(auth.uid(),target,p_job_id,aid,p_reason,nullif(trim(p_details),'')) returning id into rid;
  return rid;
end $$;

create or replace function public.get_job_candidates(p_job_id uuid)
returns table(application_id uuid,worker_id uuid,full_name text,categories text[],completed_jobs int,rating numeric,attendance numeric,is_new boolean,status application_status,phone text)
language sql stable security definer set search_path=public as $$
  select a.id,a.worker_id,p.full_name,w.categories,w.completed_jobs,w.rating_average,w.attendance_rate,w.completed_jobs=0,a.status,
    case when a.status in ('selected','confirmed') then p.phone else null end
  from applications a join jobs j on j.id=a.job_id join workers w on w.profile_id=a.worker_id join profiles p on p.id=a.worker_id
  where a.job_id=p_job_id and (j.employer_id=auth.uid() or is_admin())
  order by (abs(hashtext(a.id::text||current_date::text)) % 100),a.opportunity_score_at_apply desc,a.applied_at
$$;

create or replace function public.get_contact_for_application(p_application_id uuid)
returns table(worker_name text,worker_phone text,employer_name text,employer_phone text)
language sql stable security definer set search_path=public as $$
  select wp.full_name,wp.phone,ep.full_name,ep.phone from applications a join jobs j on j.id=a.job_id
  join profiles wp on wp.id=a.worker_id join profiles ep on ep.id=j.employer_id
  where a.id=p_application_id and a.status in ('selected','confirmed','completed','no_show')
    and (auth.uid() in (a.worker_id,j.employer_id) or is_admin())
$$;

create or replace function public.admin_set_user_status(p_user_id uuid,p_status account_status) returns void
language plpgsql security definer set search_path=public as $$ begin if not is_admin() then raise exception 'No autorizado'; end if; update profiles set status=p_status,updated_at=now() where id=p_user_id and role<>'admin'; end $$;

create or replace function public.admin_set_job_status(p_job_id uuid,p_status job_status) returns void
language plpgsql security definer set search_path=public as $$ begin if not is_admin() then raise exception 'No autorizado'; end if; update jobs set status=p_status,updated_at=now() where id=p_job_id; if p_status in ('cancelled','completed') then update applications set status='rejected' where job_id=p_job_id and status in ('interested','selected'); end if; end $$;

create or replace function public.cancel_own_job(p_job_id uuid) returns void
language plpgsql security definer set search_path=public as $$
begin
  update jobs set status='cancelled',updated_at=now() where id=p_job_id and employer_id=auth.uid() and status in ('draft','awaiting_payment','open','candidates_available');
  if not found then raise exception 'No puedes cancelar este jale'; end if;
  update applications set status='rejected' where job_id=p_job_id and status in ('interested','selected');
end $$;

create or replace function public.admin_review_report(p_report_id uuid,p_status report_status,p_notes text default null,p_remove_no_show boolean default false) returns void
language plpgsql security definer set search_path=public as $$
declare rep reports;
begin
  if not is_admin() then raise exception 'No autorizado'; end if;
  select * into rep from reports where id=p_report_id for update;
  update reports set status=p_status,admin_notes=nullif(trim(p_notes),''),reviewed_by=auth.uid(),reviewed_at=now() where id=p_report_id;
  if p_remove_no_show and rep.reason='No-show' and rep.reported_user_id is not null then
    update workers set no_show_count=greatest(0,no_show_count-1) where profile_id=rep.reported_user_id;
  end if;
end $$;

-- RLS: direct mutations are intentionally narrow; sensitive transitions happen only in the functions above.
alter table profiles enable row level security; alter table workers enable row level security; alter table employers enable row level security;
alter table jobs enable row level security; alter table applications enable row level security; alter table payments enable row level security;
alter table ratings enable row level security; alter table reports enable row level security; alter table user_activity enable row level security; alter table app_settings enable row level security;

create policy profiles_self_admin_select on profiles for select using(id=auth.uid() or is_admin());
create policy profiles_self_insert on profiles for insert with check(id=auth.uid() and role in ('worker','employer'));
create policy profiles_self_update on profiles for update using(id=auth.uid()) with check(id=auth.uid());
create policy workers_self_admin_select on workers for select using(profile_id=auth.uid() or is_admin());
create policy workers_self_insert on workers for insert with check(profile_id=auth.uid() and exists(select 1 from profiles p where p.id=auth.uid() and p.role='worker'));
create policy workers_self_update on workers for update using(profile_id=auth.uid()) with check(profile_id=auth.uid());
create policy employers_self_admin_select on employers for select using(profile_id=auth.uid() or is_admin());
create policy employers_self_insert on employers for insert with check(profile_id=auth.uid() and exists(select 1 from profiles p where p.id=auth.uid() and p.role='employer'));

create policy jobs_related_select on jobs for select using(status in ('open','candidates_available') or employer_id=auth.uid() or is_admin() or has_job_application(id));
create policy applications_related_select on applications for select using(worker_id=auth.uid() or is_admin() or is_job_employer(job_id));
create policy payments_owner_admin_select on payments for select using(employer_id=auth.uid() or is_admin());
create policy ratings_related_select on ratings for select using(rater_id=auth.uid() or rated_id=auth.uid() or is_admin());
create policy reports_reporter_admin_select on reports for select using(reporter_id=auth.uid() or is_admin());
create policy reports_admin_update on reports for update using(is_admin()) with check(is_admin());
create policy activity_own_admin_select on user_activity for select using(user_id=auth.uid() or is_admin());
create policy settings_public_select on app_settings for select using(true);
create policy settings_admin_write on app_settings for all using(is_admin()) with check(is_admin());

revoke execute on function public.create_job(text,text,text,int,text,text,date,time,numeric,numeric,text,text) from public,anon;
revoke execute on function public.complete_onboarding(text,text,user_role,text,int,text,text[],text,text) from public,anon;
revoke execute on function public.report_payment(uuid),public.apply_to_job(uuid),public.withdraw_application(uuid),public.select_application(uuid),public.respond_to_selection(uuid,boolean),public.cancel_own_job(uuid) from public,anon;
revoke execute on function public.employer_finish_application(uuid,boolean,int,text),public.worker_finish_application(uuid,boolean,int,text),public.create_report(uuid,text,text) from public,anon;
revoke execute on function public.get_job_candidates(uuid),public.get_contact_for_application(uuid),public.admin_review_payment(uuid,boolean,text),public.admin_set_user_status(uuid,account_status),public.admin_set_job_status(uuid,job_status),public.admin_review_report(uuid,report_status,text,boolean) from public,anon;
grant execute on function public.create_job(text,text,text,int,text,text,date,time,numeric,numeric,text,text) to authenticated;
grant execute on function public.complete_onboarding(text,text,user_role,text,int,text,text[],text,text) to authenticated;
grant execute on function public.report_payment(uuid),public.apply_to_job(uuid),public.withdraw_application(uuid),public.select_application(uuid),public.respond_to_selection(uuid,boolean) to authenticated;
grant execute on function public.employer_finish_application(uuid,boolean,int,text),public.worker_finish_application(uuid,boolean,int,text),public.create_report(uuid,text,text) to authenticated;
grant execute on function public.get_job_candidates(uuid),public.get_contact_for_application(uuid),public.admin_review_payment(uuid,boolean,text),public.admin_set_user_status(uuid,account_status),public.admin_set_job_status(uuid,job_status) to authenticated;
grant execute on function public.cancel_own_job(uuid) to authenticated;
revoke execute on function public.finalize_application_if_ready(uuid),public.refresh_reputation(uuid),public.log_activity(text,uuid,jsonb) from public,anon,authenticated;
revoke execute on function public.is_job_employer(uuid),public.has_job_application(uuid) from public,anon;
grant execute on function public.is_job_employer(uuid),public.has_job_application(uuid) to authenticated;

-- Admin metrics expose aggregates only and still require the admin role.
create or replace function public.admin_metrics() returns jsonb language plpgsql stable security definer set search_path=public as $$
begin if not is_admin() then raise exception 'No autorizado'; end if;
return jsonb_build_object(
 'users_total',(select count(*) from profiles),'workers',(select count(*) from workers),'employers',(select count(*) from employers),
 'jobs_today',(select count(*) from jobs where created_at::date=current_date),'jobs_open',(select count(*) from jobs where status in ('open','candidates_available')),
 'jobs_filled',(select count(*) from jobs where status in ('filled','completed')),'applications',(select count(*) from applications),
 'payments_pending',(select count(*) from payments where status='reported'),'payments_confirmed',(select count(*) from payments where status='confirmed'),
 'revenue',(select coalesce(sum(amount),0) from payments where status='confirmed'),'reports',(select count(*) from reports where status in ('open','reviewing')),
 'no_shows',(select coalesce(sum(no_show_count),0) from workers),
 'avg_first_candidate_minutes',(select round(avg(extract(epoch from (first_application_at-published_at))/60)) from jobs where first_application_at is not null),
 'avg_fill_minutes',(select round(avg(extract(epoch from (filled_at-published_at))/60)) from jobs where filled_at is not null),
 'fill_rate',(select round(100.0*count(*) filter(where status in ('filled','completed'))/nullif(count(*) filter(where published_at is not null),0),1) from jobs),
 'avg_pay',(select round(avg(pay_amount),2) from jobs where published_at is not null)
); end $$;
revoke execute on function public.admin_metrics() from public,anon;
grant execute on function public.admin_metrics() to authenticated;
grant execute on function public.admin_review_report(uuid,report_status,text,boolean) to authenticated;

-- A user may edit contact fields, never their own role or moderation state.
revoke update on public.profiles from authenticated;
grant update(full_name,phone,municipality,last_active_at,updated_at) on public.profiles to authenticated;
revoke update on public.workers from authenticated;
grant update(zone,categories,availability) on public.workers to authenticated;
