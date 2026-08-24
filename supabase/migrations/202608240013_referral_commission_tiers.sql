-- Comisión por paquete: $50 en paquete de $200 y $100 en paquete de $350.
insert into public.app_settings(key,value) values
  ('referral_config','{"default_commission_amount":50,"premium_package_price":350,"premium_commission_amount":100}')
on conflict(key) do update set value=excluded.value,updated_at=now();

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
  insert into user_activity(user_id,event,job_id,metadata) values(auth.uid(),case when p_confirm then 'payment_confirmed' else 'payment_rejected' end,pay.job_id,jsonb_build_object('reference',pay.reference,'package_posts',pay.package_posts,'amount',pay.amount,'commission',case when p_confirm then commission else null end));
end $$;

notify pgrst,'reload schema';
