-- Tickets técnicos separados de reportes entre personas y no-shows.
create table public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reporter_role public.user_role not null,
  category text not null check(category in ('interface','system_error','account','payment','notifications','other')),
  title text not null check(char_length(title) between 5 and 120),
  description text not null check(char_length(description) between 10 and 1200),
  page_context text check(char_length(page_context)<=120),
  priority text not null default 'normal' check(priority in ('low','normal','high','urgent')),
  status text not null default 'open' check(status in ('open','in_progress','waiting_user','resolved','closed')),
  admin_notes text check(char_length(admin_notes)<=1200),
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index support_tickets_status_created_idx on public.support_tickets(status,created_at desc);
create index support_tickets_reporter_idx on public.support_tickets(reporter_id,created_at desc);

alter table public.support_tickets enable row level security;
create policy support_tickets_owner_admin_select on public.support_tickets for select using(reporter_id=auth.uid() or is_admin());

create or replace function public.create_support_ticket(
  p_category text,p_title text,p_description text,p_page_context text default null,p_blocking boolean default false
) returns uuid
language plpgsql security definer set search_path=public as $$
declare rid uuid; rrole user_role;
begin
  select role into rrole from profiles where id=auth.uid() and status='active';
  if rrole not in ('worker','employer') then raise exception 'Cuenta no válida para soporte'; end if;
  if p_category not in ('interface','system_error','account','payment','notifications','other') then raise exception 'Tipo de problema inválido'; end if;
  insert into support_tickets(reporter_id,reporter_role,category,title,description,page_context,priority)
  values(auth.uid(),rrole,p_category,trim(p_title),trim(p_description),nullif(trim(p_page_context),''),case when p_blocking then 'high' else 'normal' end)
  returning id into rid;
  insert into user_activity(user_id,event,metadata) values(auth.uid(),'support_ticket_created',jsonb_build_object('ticket_id',rid));
  return rid;
end $$;

create or replace function public.admin_update_support_ticket(
  p_ticket_id uuid,p_status text,p_priority text,p_admin_notes text default null
) returns void
language plpgsql security definer set search_path=public as $$
begin
  if not is_admin() then raise exception 'No autorizado'; end if;
  if p_status not in ('open','in_progress','waiting_user','resolved','closed') then raise exception 'Estado inválido'; end if;
  if p_priority not in ('low','normal','high','urgent') then raise exception 'Prioridad inválida'; end if;
  update support_tickets set status=p_status,priority=p_priority,admin_notes=nullif(trim(p_admin_notes),''),reviewed_by=auth.uid(),reviewed_at=now(),resolved_at=case when p_status in ('resolved','closed') then coalesce(resolved_at,now()) else null end,updated_at=now() where id=p_ticket_id;
  if not found then raise exception 'Ticket no encontrado'; end if;
end $$;

revoke execute on function public.create_support_ticket(text,text,text,text,boolean),public.admin_update_support_ticket(uuid,text,text,text) from public,anon;
grant execute on function public.create_support_ticket(text,text,text,text,boolean),public.admin_update_support_ticket(uuid,text,text,text) to authenticated;
