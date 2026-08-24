-- Paquetes nuevos, cero gratis automáticos y base de promotores/referidos.

do $$
begin
  if not exists (
    select 1 from pg_type t
    join pg_enum e on e.enumtypid=t.oid
    where t.typname='user_role' and e.enumlabel='promoter'
  ) then
    alter type public.user_role add value 'promoter';
  end if;
end $$;

insert into public.app_settings(key,value) values
  ('referral_config','{"default_commission_amount":50,"premium_package_price":350,"premium_commission_amount":100}')
on conflict(key) do update set value=excluded.value,updated_at=now();

update public.app_settings set value='0'::jsonb,updated_at=now() where key='free_posts';

insert into public.app_settings(key,value) values
  ('billing_config','{"charging_enabled":true,"founding_employer_limit":0}')
on conflict(key) do update set value=jsonb_build_object(
  'charging_enabled',coalesce((public.app_settings.value->>'charging_enabled')::boolean,true),
  'founding_employer_limit',0
),updated_at=now();

insert into public.app_settings(key,value) values
  ('publication_packages','[
    {"posts":6,"price":200,"label":"Paquete Arranque"},
    {"posts":9,"price":350,"label":"Paquete Movimiento"}
  ]')
on conflict(key) do update set value=excluded.value,updated_at=now();

alter table public.payments drop constraint if exists payments_package_posts_check;
alter table public.payments add constraint payments_package_posts_positive check(package_posts between 1 and 1000);

update public.employers e set billing_exempt=false,early_access=false,
  exemption_reason=null,billing_updated_at=now()
where e.early_access is true or e.exemption_reason='Beneficio de empleador fundador';

create table if not exists public.promoters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  referral_code text not null unique check(referral_code ~ '^[A-Z0-9]{4,24}$'),
  status text not null default 'active' check(status in ('active','suspended','blocked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  promoter_id uuid not null references public.promoters(id) on delete restrict,
  employer_id uuid not null unique references public.employers(profile_id) on delete restrict,
  attributed_at timestamptz not null default now(),
  status text not null default 'active' check(status in ('active','corrected','cancelled'))
);

create table if not exists public.referral_commissions (
  id uuid primary key default gen_random_uuid(),
  promoter_id uuid not null references public.promoters(id) on delete restrict,
  employer_id uuid not null references public.employers(profile_id) on delete restrict,
  payment_id uuid not null unique references public.payments(id) on delete restrict,
  gross_amount numeric(10,2) not null check(gross_amount>0),
  commission_amount numeric(10,2) not null check(commission_amount>0),
  status text not null default 'pending' check(status in ('pending','paid','cancelled')),
  earned_at timestamptz not null default now(),
  paid_at timestamptz,
  paid_by uuid references public.profiles(id),
  payout_reference text,
  notes text check(char_length(notes)<=500)
);

create index if not exists promoters_status_idx on public.promoters(status,created_at desc);
create index if not exists referrals_promoter_idx on public.referrals(promoter_id,attributed_at desc);
create index if not exists commissions_promoter_status_idx on public.referral_commissions(promoter_id,status,earned_at desc);
create index if not exists commissions_employer_idx on public.referral_commissions(employer_id,earned_at desc);

alter table public.promoters enable row level security;
alter table public.referrals enable row level security;
alter table public.referral_commissions enable row level security;

create or replace function public.is_promoter(uid uuid default auth.uid()) returns boolean
language sql stable security definer set search_path=public as $$
  select exists(
    select 1 from public.promoters pr
    join public.profiles p on p.id=pr.user_id
    where pr.user_id=uid and pr.status='active' and p.status='active' and p.role::text='promoter'
  )
$$;

drop policy if exists promoters_self_admin_select on public.promoters;
drop policy if exists referrals_promoter_admin_select on public.referrals;
drop policy if exists commissions_promoter_admin_select on public.referral_commissions;
create policy promoters_self_admin_select on public.promoters for select using(user_id=auth.uid() or is_admin());
create policy referrals_promoter_admin_select on public.referrals for select using(is_admin() or exists(select 1 from promoters p where p.id=referrals.promoter_id and p.user_id=auth.uid()));
create policy commissions_promoter_admin_select on public.referral_commissions for select using(is_admin() or exists(select 1 from promoters p where p.id=referral_commissions.promoter_id and p.user_id=auth.uid()));
grant select on table public.promoters,public.referrals,public.referral_commissions to authenticated;

create or replace function public.claim_referral(p_code text) returns void
language plpgsql security definer set search_path=public as $$
declare promoter_row promoters;
begin
  if auth.uid() is null or trim(coalesce(p_code,''))='' then return; end if;
  if not exists(select 1 from profiles where id=auth.uid() and role::text='employer' and status='active') then return; end if;
  select * into promoter_row from promoters where referral_code=upper(regexp_replace(trim(p_code),'[^A-Za-z0-9]','','g')) and status='active';
  if not found then raise exception 'Código de promotor no válido'; end if;
  if promoter_row.user_id=auth.uid() then raise exception 'No puedes usar tu propio código'; end if;
  insert into referrals(promoter_id,employer_id) values(promoter_row.id,auth.uid()) on conflict(employer_id) do nothing;
end $$;

create or replace function public.promoter_dashboard() returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare pid uuid; result jsonb;
begin
  select id into pid from promoters where user_id=auth.uid() and status='active';
  if pid is null then raise exception 'No autorizado'; end if;
  select jsonb_build_object(
    'promoter',(select jsonb_build_object('id',pr.id,'code',pr.referral_code,'status',pr.status) from promoters pr where pr.id=pid),
    'summary',jsonb_build_object(
      'clients',(select count(*) from referrals r where r.promoter_id=pid and r.status='active'),
      'sales',(select coalesce(sum(c.gross_amount),0) from referral_commissions c where c.promoter_id=pid),
      'pending',(select coalesce(sum(c.commission_amount),0) from referral_commissions c where c.promoter_id=pid and c.status='pending'),
      'paid',(select coalesce(sum(c.commission_amount),0) from referral_commissions c where c.promoter_id=pid and c.status='paid')
    ),
    'clients',coalesce((select jsonb_agg(jsonb_build_object(
      'name',p.full_name,'type',e.employer_type,'attributed_at',r.attributed_at,
      'purchases',(select count(*) from payments py where py.employer_id=r.employer_id and py.status='confirmed'),
      'spent',(select coalesce(sum(py.amount),0) from payments py where py.employer_id=r.employer_id and py.status='confirmed'),
      'last_purchase',(select max(py.confirmed_at) from payments py where py.employer_id=r.employer_id and py.status='confirmed')
    ) order by r.attributed_at desc) from referrals r join profiles p on p.id=r.employer_id join employers e on e.profile_id=r.employer_id where r.promoter_id=pid),'[]'::jsonb),
    'commissions',coalesce((select jsonb_agg(jsonb_build_object(
      'id',c.id,'client',p.full_name,'gross_amount',c.gross_amount,'commission_amount',c.commission_amount,
      'status',c.status,'earned_at',c.earned_at,'paid_at',c.paid_at,'payout_reference',c.payout_reference
    ) order by c.earned_at desc) from referral_commissions c join profiles p on p.id=c.employer_id where c.promoter_id=pid),'[]'::jsonb)
  ) into result;
  return result;
end $$;

create or replace function public.admin_promoters_console() returns jsonb
language plpgsql stable security definer set search_path=public as $$
begin
  if not is_admin() then raise exception 'No autorizado'; end if;
  return jsonb_build_object(
    'promoters',coalesce((select jsonb_agg(jsonb_build_object(
      'id',pr.id,'user_id',pr.user_id,'name',p.full_name,'phone',p.phone,'code',pr.referral_code,'status',pr.status,'created_at',pr.created_at,
      'clients',(select count(*) from referrals r where r.promoter_id=pr.id and r.status='active'),
      'sales',(select coalesce(sum(c.gross_amount),0) from referral_commissions c where c.promoter_id=pr.id),
      'pending',(select coalesce(sum(c.commission_amount),0) from referral_commissions c where c.promoter_id=pr.id and c.status='pending'),
      'paid',(select coalesce(sum(c.commission_amount),0) from referral_commissions c where c.promoter_id=pr.id and c.status='paid')
    ) order by pr.created_at desc) from promoters pr join profiles p on p.id=pr.user_id),'[]'::jsonb),
    'commissions',coalesce((select jsonb_agg(jsonb_build_object(
      'id',c.id,'promoter_id',c.promoter_id,'promoter',pp.full_name,'client',ep.full_name,'payment_id',c.payment_id,
      'gross_amount',c.gross_amount,'commission_amount',c.commission_amount,'status',c.status,'earned_at',c.earned_at,
      'paid_at',c.paid_at,'payout_reference',c.payout_reference,'notes',c.notes
    ) order by c.earned_at desc) from referral_commissions c join promoters pr on pr.id=c.promoter_id join profiles pp on pp.id=pr.user_id join profiles ep on ep.id=c.employer_id),'[]'::jsonb)
  );
end $$;

create or replace function public.admin_update_promoter_status(p_promoter_id uuid,p_status text) returns void
language plpgsql security definer set search_path=public as $$
begin
  if not is_admin() then raise exception 'No autorizado'; end if;
  if p_status not in ('active','suspended','blocked') then raise exception 'Estado inválido'; end if;
  update promoters set status=p_status,updated_at=now() where id=p_promoter_id;
  if not found then raise exception 'Promotor no encontrado'; end if;
  insert into user_activity(user_id,event,metadata) values(auth.uid(),'promoter_status_updated',jsonb_build_object('promoter_id',p_promoter_id,'status',p_status));
end $$;

create or replace function public.admin_mark_commissions_paid(p_commission_ids uuid[],p_reference text,p_notes text default null) returns void
language plpgsql security definer set search_path=public as $$
begin
  if not is_admin() then raise exception 'No autorizado'; end if;
  if array_length(p_commission_ids,1) is null then raise exception 'Selecciona comisiones'; end if;
  update referral_commissions set status='paid',paid_at=now(),paid_by=auth.uid(),
    payout_reference=nullif(trim(p_reference),''),notes=nullif(trim(p_notes),'')
  where id=any(p_commission_ids) and status='pending';
  insert into user_activity(user_id,event,metadata) values(auth.uid(),'referral_commissions_paid',jsonb_build_object('count',array_length(p_commission_ids,1),'reference',p_reference));
end $$;

create or replace function public.admin_review_payment(p_payment_id uuid,p_confirm boolean,p_reason text default null) returns void
language plpgsql security definer set search_path=public as $$
declare pay payments; commission numeric; referral jsonb;
begin
  if not is_admin() then raise exception 'No autorizado'; end if;
  select * into pay from payments where id=p_payment_id for update;
  if pay.status<>'reported' then raise exception 'Pago ya revisado'; end if;
  if p_confirm then
    update payments set status='confirmed',confirmed_at=now(),reviewed_at=now(),reviewed_by=auth.uid() where id=p_payment_id;
    update jobs set status='open',paid=true,published_at=now(),updated_at=now() where id=pay.job_id and status='awaiting_payment';
    update employers set free_post_credits=free_post_credits+greatest(0,pay.package_posts-1),billing_updated_at=now() where profile_id=pay.employer_id;
    select value into referral from app_settings where key='referral_config';
    commission:=case
      when pay.amount>=coalesce((referral->>'premium_package_price')::numeric,350)
      then coalesce((referral->>'premium_commission_amount')::numeric,100)
      else coalesce((referral->>'default_commission_amount')::numeric,50)
    end;
    insert into referral_commissions(promoter_id,employer_id,payment_id,gross_amount,commission_amount)
    select r.promoter_id,pay.employer_id,pay.id,pay.amount,commission
    from referrals r join promoters pr on pr.id=r.promoter_id
    where r.employer_id=pay.employer_id and r.status='active' and pr.status='active'
    on conflict(payment_id) do nothing;
  else
    update payments set status='rejected',rejection_reason=coalesce(nullif(trim(p_reason),''),'Comprobante no validado'),reviewed_at=now(),reviewed_by=auth.uid() where id=p_payment_id;
  end if;
  insert into user_activity(user_id,event,job_id,metadata) values(auth.uid(),case when p_confirm then 'payment_confirmed' else 'payment_rejected' end,pay.job_id,jsonb_build_object('reference',pay.reference,'package_posts',pay.package_posts,'amount',pay.amount));
end $$;

revoke execute on function public.is_promoter(uuid),public.claim_referral(text),public.promoter_dashboard(),public.admin_promoters_console(),public.admin_update_promoter_status(uuid,text),public.admin_mark_commissions_paid(uuid[],text,text) from public,anon;
grant execute on function public.is_promoter(uuid),public.claim_referral(text),public.promoter_dashboard(),public.admin_promoters_console(),public.admin_update_promoter_status(uuid,text),public.admin_mark_commissions_paid(uuid[],text,text) to authenticated;
notify pgrst,'reload schema';
