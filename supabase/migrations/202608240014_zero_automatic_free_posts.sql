-- Sin publicaciones gratis automáticas: sólo admin regala créditos o exenta cuentas desde el panel.
update public.app_settings set value='0'::jsonb,updated_at=now() where key='free_posts';

insert into public.app_settings(key,value) values
  ('billing_config','{"charging_enabled":true,"founding_employer_limit":0}')
on conflict(key) do update set value=jsonb_build_object(
  'charging_enabled',coalesce((public.app_settings.value->>'charging_enabled')::boolean,true),
  'founding_employer_limit',0
),updated_at=now();

update public.employers set billing_exempt=false,early_access=false,
  exemption_reason=null,billing_updated_at=now()
where early_access is true or exemption_reason='Beneficio de empleador fundador';

notify pgrst,'reload schema';
