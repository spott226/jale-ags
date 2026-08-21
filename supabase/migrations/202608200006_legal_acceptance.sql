-- Evidencia versionada de aceptación; el usuario sólo puede registrar la versión vigente para sí mismo.
create table public.legal_acceptances (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  version text not null check(char_length(version) between 8 and 40),
  terms_accepted boolean not null default true,
  privacy_acknowledged boolean not null default true,
  accepted_at timestamptz not null default now()
);

alter table public.legal_acceptances enable row level security;
create policy legal_acceptances_own_admin_read on public.legal_acceptances for select using(user_id=auth.uid() or is_admin());

create or replace function public.accept_current_legal(p_version text) returns void
language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is null or not exists(select 1 from profiles where id=auth.uid()) then raise exception 'Completa primero tu perfil'; end if;
  if p_version <> '2026-08-20' then raise exception 'La versión legal no es válida'; end if;
  insert into legal_acceptances(user_id,version,accepted_at)
  values(auth.uid(),p_version,now())
  on conflict(user_id) do update set version=excluded.version,terms_accepted=true,privacy_acknowledged=true,accepted_at=now();
end $$;

revoke execute on function public.accept_current_legal(text) from public,anon;
grant execute on function public.accept_current_legal(text) to authenticated;
