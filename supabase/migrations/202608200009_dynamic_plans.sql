-- Planes editables y administración separada de las reglas globales.
drop function if exists public.admin_update_billing_settings(boolean,int,int,numeric,numeric,numeric,boolean);

create or replace function public.admin_update_billing_settings(
  p_charging_enabled boolean,p_free_posts int,p_founding_limit int,p_apply_founders boolean default false
) returns void language plpgsql security definer set search_path=public as $$
begin
  if not is_admin() then raise exception 'No autorizado'; end if;
  if p_free_posts not between 0 and 100 or p_founding_limit not between 0 and 10000 then raise exception 'Configuración fuera de rango'; end if;
  insert into app_settings(key,value) values('billing_config',jsonb_build_object('charging_enabled',p_charging_enabled,'founding_employer_limit',p_founding_limit)) on conflict(key) do update set value=excluded.value,updated_at=now();
  insert into app_settings(key,value) values('free_posts',to_jsonb(p_free_posts)) on conflict(key) do update set value=excluded.value,updated_at=now();
  if p_apply_founders then
    with founders as (select profile_id from employers order by created_at,profile_id limit p_founding_limit)
    update employers e set early_access=true,billing_exempt=true,exemption_reason=coalesce(e.exemption_reason,'Beneficio de empleador fundador'),billing_updated_at=now() from founders f where f.profile_id=e.profile_id;
  end if;
  insert into user_activity(user_id,event,metadata) values(auth.uid(),'billing_settings_updated',jsonb_build_object('charging_enabled',p_charging_enabled,'free_posts',p_free_posts,'founding_limit',p_founding_limit,'applied',p_apply_founders));
end $$;

create or replace function public.admin_upsert_publication_package(
  p_original_posts int,p_posts int,p_price numeric,p_label text
) returns void language plpgsql security definer set search_path=public as $$
declare plans jsonb; updated jsonb;
begin
  if not is_admin() then raise exception 'No autorizado'; end if;
  if p_posts not between 1 and 1000 then raise exception 'La cantidad debe estar entre 1 y 1000'; end if;
  if p_price<=0 or p_price>1000000 then raise exception 'Precio fuera de rango'; end if;
  if length(trim(p_label)) not between 2 and 60 then raise exception 'El nombre debe tener entre 2 y 60 caracteres'; end if;
  select value into plans from app_settings where key='publication_packages' for update;
  select coalesce(jsonb_agg(item order by (item->>'posts')::int),'[]'::jsonb) into updated
  from (
    select item from jsonb_array_elements(coalesce(plans,'[]'::jsonb)) item
    where (item->>'posts')::int<>p_posts and (p_original_posts is null or (item->>'posts')::int<>p_original_posts)
    union all select jsonb_build_object('posts',p_posts,'price',p_price,'label',trim(p_label))
  ) ordered;
  insert into app_settings(key,value) values('publication_packages',updated) on conflict(key) do update set value=excluded.value,updated_at=now();
  if p_posts=1 then insert into app_settings(key,value) values('post_price_mxn',to_jsonb(p_price)) on conflict(key) do update set value=excluded.value,updated_at=now(); end if;
  insert into user_activity(user_id,event,metadata) values(auth.uid(),'publication_package_saved',jsonb_build_object('original_posts',p_original_posts,'posts',p_posts,'price',p_price,'label',trim(p_label)));
end $$;

create or replace function public.admin_delete_publication_package(p_posts int) returns void
language plpgsql security definer set search_path=public as $$
declare plans jsonb; updated jsonb;
begin
  if not is_admin() then raise exception 'No autorizado'; end if;
  select value into plans from app_settings where key='publication_packages' for update;
  if jsonb_array_length(coalesce(plans,'[]'::jsonb))<=1 then raise exception 'Debe existir por lo menos un plan'; end if;
  select coalesce(jsonb_agg(item order by (item->>'posts')::int),'[]'::jsonb) into updated from jsonb_array_elements(plans) item where (item->>'posts')::int<>p_posts;
  if jsonb_array_length(updated)=jsonb_array_length(plans) then raise exception 'Plan no encontrado'; end if;
  update app_settings set value=updated,updated_at=now() where key='publication_packages';
  insert into user_activity(user_id,event,metadata) values(auth.uid(),'publication_package_deleted',jsonb_build_object('posts',p_posts));
end $$;

revoke execute on function public.admin_update_billing_settings(boolean,int,int,boolean),public.admin_upsert_publication_package(int,int,numeric,text),public.admin_delete_publication_package(int) from public,anon;
grant execute on function public.admin_update_billing_settings(boolean,int,int,boolean),public.admin_upsert_publication_package(int,int,numeric,text),public.admin_delete_publication_package(int) to authenticated;
notify pgrst,'reload schema';
