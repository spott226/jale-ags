-- Controles flexibles de cobro y endurecimiento de permisos antes de producción.
alter table public.employers drop constraint if exists employers_free_posts_used_check;
alter table public.employers alter column free_posts_used type integer;
alter table public.employers add constraint employers_free_posts_used_nonnegative check(free_posts_used>=0);
alter table public.employers add column if not exists billing_exempt boolean not null default false;
alter table public.employers add column if not exists free_post_credits integer not null default 0 check(free_post_credits between 0 and 10000);
alter table public.employers add column if not exists early_access boolean not null default false;
alter table public.employers add column if not exists exemption_reason text check(char_length(exemption_reason)<=160);
alter table public.employers add column if not exists billing_updated_at timestamptz;

insert into public.app_settings(key,value) values
  ('billing_config','{"charging_enabled":true,"founding_employer_limit":20}'),
  ('publication_packages','[{"posts":1,"price":50,"label":"Una publicación"},{"posts":5,"price":200,"label":"Paquete Impulso"},{"posts":10,"price":350,"label":"Paquete Negocio"}]')
on conflict(key) do nothing;

alter table public.payments add column if not exists package_posts integer not null default 1 check(package_posts in (1,5,10));
alter table public.payments add column if not exists package_label text not null default 'Una publicación' check(char_length(package_label) between 3 and 80);

-- En instalaciones existentes, reconoce como fundadores a los primeros empleadores configurados.
with founders as (
  select profile_id from public.employers order by created_at,profile_id limit 20
)
update public.employers e set early_access=true,billing_exempt=true,
  exemption_reason=coalesce(e.exemption_reason,'Beneficio de empleador fundador'),billing_updated_at=now()
from founders f where f.profile_id=e.profile_id;

create or replace function public.complete_onboarding(p_name text,p_phone text,p_role user_role,p_municipality text,p_age int default null,p_zone text default null,p_categories text[] default null,p_availability text default null,p_employer_type text default null) returns void
language plpgsql security definer set search_path=public as $$
declare founder_limit int:=0; founder_slot boolean:=false;
begin
  if auth.uid() is null or p_role='admin' or exists(select 1 from profiles where id=auth.uid()) then raise exception 'Registro no permitido'; end if;
  if char_length(trim(p_name)) not between 2 and 100 or trim(p_phone) !~ '^[0-9+ ()-]{10,20}$' then raise exception 'Nombre o teléfono inválido'; end if;
  if p_role='employer' then
    perform pg_advisory_xact_lock(hashtext('jale_founding_employers'));
    select coalesce((value->>'founding_employer_limit')::int,0) into founder_limit from app_settings where key='billing_config';
    select count(*)<founder_limit into founder_slot from employers where early_access;
  end if;
  insert into profiles(id,full_name,phone,role,municipality) values(auth.uid(),trim(p_name),trim(p_phone),p_role,p_municipality);
  if p_role='worker' then
    insert into workers(profile_id,age,zone,categories,availability) values(auth.uid(),p_age,trim(p_zone),p_categories,trim(p_availability));
  else
    insert into employers(profile_id,employer_type,early_access,billing_exempt,exemption_reason,billing_updated_at)
    values(auth.uid(),p_employer_type,founder_slot,founder_slot,case when founder_slot then 'Beneficio de empleador fundador' end,case when founder_slot then now() end);
  end if;
end $$;

create or replace function public.create_job(
  p_title text,p_category text,p_description text,p_workers_needed int,p_municipality text,p_zone text,p_job_date date,p_start_time time,
  p_duration_hours numeric,p_pay_amount numeric,p_payment_method text,p_notes text default null
) returns public.jobs
language plpgsql security definer set search_path=public as $$
declare emp employers; result jobs; is_free boolean:=false; free_limit int:=0; billing jsonb; charging boolean:=true;
begin
  select e.* into emp from employers e join profiles p on p.id=e.profile_id where e.profile_id=auth.uid() and p.status='active' for update;
  if not found then raise exception 'Sólo un empleador activo puede publicar'; end if;
  if p_job_date<current_date or p_duration_hours<=0 or p_duration_hours>336 or p_pay_amount<=0 or p_workers_needed not between 1 and 50 then raise exception 'Datos del jale inválidos'; end if;
  select value into billing from app_settings where key='billing_config';
  charging:=coalesce((billing->>'charging_enabled')::boolean,true);
  select coalesce((value#>>'{}')::int,2) into free_limit from app_settings where key='free_posts';
  is_free:=not charging or emp.billing_exempt or emp.free_posts_used<free_limit or emp.free_post_credits>0;
  insert into jobs(employer_id,title,category,description,workers_needed,municipality,zone,job_date,start_time,duration_hours,pay_amount,payment_method,notes,status,paid,candidate_limit,published_at)
  values(auth.uid(),trim(p_title),p_category,trim(p_description),p_workers_needed,p_municipality,trim(p_zone),p_job_date,p_start_time,p_duration_hours,p_pay_amount,p_payment_method,nullif(trim(p_notes),''),case when is_free then 'open'::job_status else 'awaiting_payment'::job_status end,false,candidate_limit_for(p_workers_needed),case when is_free then now() end)
  returning * into result;
  if charging and not emp.billing_exempt then
    if emp.free_posts_used<free_limit then update employers set free_posts_used=free_posts_used+1 where profile_id=auth.uid();
    elsif emp.free_post_credits>0 then update employers set free_post_credits=free_post_credits-1 where profile_id=auth.uid(); end if;
  end if;
  perform log_activity('job_created',result.id,jsonb_build_object('free',is_free,'charging_enabled',charging,'billing_exempt',emp.billing_exempt));
  return result;
end $$;

create or replace function public.report_package_payment(p_job_id uuid,p_package_posts int) returns public.payments
language plpgsql security definer set search_path=public as $$
declare result payments; ref text; package jsonb; price numeric; label text;
begin
  if not exists(select 1 from jobs where id=p_job_id and employer_id=auth.uid() and status='awaiting_payment') then raise exception 'Jale no válido para pago'; end if;
  select item into package from app_settings s cross join lateral jsonb_array_elements(s.value) item
  where s.key='publication_packages' and (item->>'posts')::int=p_package_posts;
  if package is null then raise exception 'Paquete no válido'; end if;
  price:=(package->>'price')::numeric; label:=package->>'label';
  ref:='JALE-'||upper(substr(replace(p_job_id::text,'-',''),1,8));
  insert into payments(job_id,employer_id,reference,amount,status,package_posts,package_label)
  values(p_job_id,auth.uid(),ref,price,'reported',p_package_posts,label)
  on conflict(job_id) do update set status='reported',reported_at=now(),rejection_reason=null,amount=excluded.amount,package_posts=excluded.package_posts,package_label=excluded.package_label
  returning * into result;
  perform log_activity('payment_reported',p_job_id,jsonb_build_object('reference',result.reference,'package_posts',p_package_posts,'amount',price));
  return result;
end $$;

-- La función anterior de pago usaba un precio fijo. Se conserva sólo como
-- compatibilidad interna, pero se impide llamarla desde la API para que nadie
-- pueda saltarse los paquetes o precios configurados por administración.
revoke execute on function public.report_payment(uuid) from public,anon,authenticated;

create or replace function public.admin_review_payment(p_payment_id uuid,p_confirm boolean,p_reason text default null) returns void
language plpgsql security definer set search_path=public as $$
declare pay payments;
begin
  if not is_admin() then raise exception 'No autorizado'; end if;
  select * into pay from payments where id=p_payment_id for update;
  if pay.status<>'reported' then raise exception 'Pago ya revisado'; end if;
  if p_confirm then
    update payments set status='confirmed',confirmed_at=now(),reviewed_at=now(),reviewed_by=auth.uid() where id=p_payment_id;
    update jobs set status='open',paid=true,published_at=now(),updated_at=now() where id=pay.job_id and status='awaiting_payment';
    update employers set free_post_credits=free_post_credits+greatest(0,pay.package_posts-1),billing_updated_at=now() where profile_id=pay.employer_id;
  else
    update payments set status='rejected',rejection_reason=coalesce(nullif(trim(p_reason),''),'Comprobante no validado'),reviewed_at=now(),reviewed_by=auth.uid() where id=p_payment_id;
  end if;
  insert into user_activity(user_id,event,job_id,metadata) values(auth.uid(),case when p_confirm then 'payment_confirmed' else 'payment_rejected' end,pay.job_id,jsonb_build_object('reference',pay.reference,'package_posts',pay.package_posts,'amount',pay.amount));
end $$;

create or replace function public.admin_billing_console() returns jsonb
language sql stable security definer set search_path=public as $$
  select case when is_admin() then jsonb_build_object(
    'config',(select value from app_settings where key='billing_config'),
    'free_posts',(select (value#>>'{}')::int from app_settings where key='free_posts'),
    'post_price_mxn',(select (value#>>'{}')::numeric from app_settings where key='post_price_mxn'),
    'packages',(select value from app_settings where key='publication_packages'),
    'employers',coalesce((select jsonb_agg(jsonb_build_object(
      'id',p.id,'name',p.full_name,'type',e.employer_type,'created_at',e.created_at,'free_posts_used',e.free_posts_used,
      'billing_exempt',e.billing_exempt,'free_post_credits',e.free_post_credits,'early_access',e.early_access,'exemption_reason',e.exemption_reason
    ) order by e.created_at) from employers e join profiles p on p.id=e.profile_id),'[]'::jsonb)
  ) else null end
$$;

create or replace function public.admin_update_billing_settings(p_charging_enabled boolean,p_free_posts int,p_founding_limit int,p_single_price numeric,p_five_price numeric,p_ten_price numeric,p_apply_founders boolean default false) returns void
language plpgsql security definer set search_path=public as $$
begin
  if not is_admin() then raise exception 'No autorizado'; end if;
  if p_free_posts not between 0 and 100 or p_founding_limit not between 0 and 10000 then raise exception 'Configuración fuera de rango'; end if;
  if least(p_single_price,p_five_price,p_ten_price)<=0 or p_five_price>=p_single_price*5 or p_ten_price>=p_single_price*10 then raise exception 'Los paquetes deben tener precio positivo y descuento real'; end if;
  insert into app_settings(key,value) values('billing_config',jsonb_build_object('charging_enabled',p_charging_enabled,'founding_employer_limit',p_founding_limit)) on conflict(key) do update set value=excluded.value,updated_at=now();
  insert into app_settings(key,value) values('free_posts',to_jsonb(p_free_posts)) on conflict(key) do update set value=excluded.value,updated_at=now();
  insert into app_settings(key,value) values('post_price_mxn',to_jsonb(p_single_price)) on conflict(key) do update set value=excluded.value,updated_at=now();
  insert into app_settings(key,value) values('publication_packages',jsonb_build_array(
    jsonb_build_object('posts',1,'price',p_single_price,'label','Una publicación'),jsonb_build_object('posts',5,'price',p_five_price,'label','Paquete Impulso'),jsonb_build_object('posts',10,'price',p_ten_price,'label','Paquete Negocio')
  )) on conflict(key) do update set value=excluded.value,updated_at=now();
  if p_apply_founders then
    with founders as (select profile_id from employers order by created_at,profile_id limit p_founding_limit)
    update employers e set early_access=true,billing_exempt=true,exemption_reason=coalesce(e.exemption_reason,'Beneficio de empleador fundador'),billing_updated_at=now() from founders f where f.profile_id=e.profile_id;
  end if;
  insert into user_activity(user_id,event,metadata) values(auth.uid(),'billing_settings_updated',jsonb_build_object('charging_enabled',p_charging_enabled,'free_posts',p_free_posts,'founding_limit',p_founding_limit,'prices',jsonb_build_array(p_single_price,p_five_price,p_ten_price),'applied',p_apply_founders));
end $$;

create or replace function public.admin_update_employer_billing(p_employer_id uuid,p_billing_exempt boolean,p_free_post_credits int,p_reason text default null) returns void
language plpgsql security definer set search_path=public as $$
begin
  if not is_admin() then raise exception 'No autorizado'; end if;
  if p_free_post_credits not between 0 and 10000 then raise exception 'Créditos fuera de rango'; end if;
  update employers set billing_exempt=p_billing_exempt,free_post_credits=p_free_post_credits,
    exemption_reason=case when p_billing_exempt then coalesce(nullif(trim(p_reason),''),'Beneficio autorizado por administración') else nullif(trim(p_reason),'') end,
    billing_updated_at=now() where profile_id=p_employer_id;
  if not found then raise exception 'Empleador no encontrado'; end if;
  insert into user_activity(user_id,event,metadata) values(auth.uid(),'employer_billing_updated',jsonb_build_object('employer_id',p_employer_id,'exempt',p_billing_exempt,'credits',p_free_post_credits));
end $$;

-- Bloquea la alteración directa de rol, reputación y beneficios. Las escrituras pasan por RPC verificadas.
revoke insert,update,delete on table public.profiles,public.workers,public.employers from anon,authenticated;
revoke insert,update,delete on table public.app_settings from anon,authenticated;
grant select on table public.app_settings to anon,authenticated;

revoke execute on function public.report_package_payment(uuid,int),public.admin_billing_console(),public.admin_update_billing_settings(boolean,int,int,numeric,numeric,numeric,boolean),public.admin_update_employer_billing(uuid,boolean,int,text) from public,anon;
grant execute on function public.report_package_payment(uuid,int),public.admin_billing_console(),public.admin_update_billing_settings(boolean,int,int,numeric,numeric,numeric,boolean),public.admin_update_employer_billing(uuid,boolean,int,text) to authenticated;
notify pgrst,'reload schema';
