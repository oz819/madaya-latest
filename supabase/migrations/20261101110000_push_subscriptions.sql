-- إشعارات Push (المرحلة 3): each device that allows notifications keeps a subscription here, per
-- person and per centre. The server sends with the VAPID key (see app/api/push).
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.app_users(id) on delete cascade,
  center_id uuid not null default private.current_center_id() references public.centers(id) on delete cascade,
  endpoint text not null unique check (endpoint ~ '^https://' and char_length(endpoint) <= 1000),
  p256dh text not null check (char_length(p256dh) <= 200),
  auth text not null check (char_length(auth) <= 100),
  user_agent text check (char_length(user_agent) <= 300),
  created_at timestamptz not null default now()
);
create index idx_push_subscriptions_center on public.push_subscriptions (center_id);
alter table public.push_subscriptions enable row level security;
create policy push_subscriptions_own on public.push_subscriptions for all to authenticated
  using (user_id = (select auth.uid()) and center_id = (select private.current_center_id()))
  with check (user_id = (select auth.uid()) and center_id = (select private.current_center_id()) and (select private.is_staff()));
revoke all on public.push_subscriptions from anon, authenticated;
grant select, insert, delete on public.push_subscriptions to authenticated;
grant all on public.push_subscriptions to service_role;
