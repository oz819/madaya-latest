-- منصة متعددة المراكز (Multi-tenant SaaS) — المرحلة 2 من برومبت "مضايا سنتر".
--
-- The idea in one paragraph: every row of centre data gets a center_id. A user can belong to several
-- centres (memberships) and works in one at a time (app_users.current_center_id, switchable).
-- private.current_center_id() is that centre, and every centre table gets a RESTRICTIVE policy
-- "center_id = current centre" — Postgres ANDs it with the existing policies, so isolation is
-- enforced by the database even if a query, a screen or an old cached app forgets to filter.
-- is_staff()/is_admin() now mean "staff/admin *of the current centre*". SECURITY DEFINER
-- functions (which bypass RLS) are rewritten to filter by the current centre explicitly.
--
-- Madaya's existing data becomes the first centre with no visible change for its users:
-- center_id is added with a constant default (no table rewrite, no triggers, no audit noise),
-- and the old profiles table lives on as a view over memberships, so the app's queries work as is.

-- The fixed id of Madaya's centre (used by this migration and by the tests).
create function private.madaya_center_id() returns uuid language sql immutable set search_path = '' as $$
  select '00000000-0000-4000-8000-00000000a001'::uuid
$$;

-- ============================================================== centres
create table public.centers (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$'),
  name text not null check (char_length(btrim(name)) between 2 and 120),
  country text check (char_length(country) <= 60),
  city text check (char_length(city) <= 60),
  -- An https URL or a small inline PNG/JPEG/WebP (resized in the browser). No SVG: it can carry script.
  logo_url text check (logo_url is null or (char_length(logo_url) <= 350000
    and logo_url ~ '^(https://[^\s"''<>]+|/images/[a-z0-9._-]+|data:image/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+)$')),
  palette text not null default 'indigo' check (palette in ('indigo', 'navy', 'plum', 'slate')),
  primary_color text check (primary_color ~ '^#[0-9a-fA-F]{6}$'),
  about text check (char_length(about) <= 2000),
  extra_notes text check (char_length(extra_notes) <= 4000),
  contact_phone text check (char_length(contact_phone) <= 30),
  contact_email text check (char_length(contact_email) <= 120),
  whatsapp text check (char_length(whatsapp) <= 30),
  instagram text check (char_length(instagram) <= 200),
  facebook text check (char_length(facebook) <= 200),
  address text check (char_length(address) <= 200),
  timezone text not null default 'Asia/Damascus' check (char_length(timezone) <= 64),
  locale text not null default 'ar' check (locale in ('ar', 'en')),
  domain text unique check (domain ~ '^[a-z0-9.-]{3,253}$'),
  status text not null default 'TRIAL' check (status in ('TRIAL', 'ACTIVE', 'SUSPENDED')),
  plan text not null default 'FREE' check (plan in ('FREE', 'BASIC', 'PRO')),
  trial_ends_at timestamptz,
  onboarded boolean not null default false,
  owner_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Slugs that are pages of the app itself (the centre's public page lives at /{slug}).
create function private.is_reserved_slug(p_slug text) returns boolean language sql immutable set search_path = '' as $$
  select p_slug = any (array['login','register','honor','p','api','auth','forgot-password','reset-password','admin','super',
    'signup','new','onboarding','invite','app','www','sb','static','images','icons','manifest','sw','_next','help','about',
    'pricing','terms','privacy','centers','center','madaya-demo'])
$$;
alter table public.centers add constraint centers_slug_not_reserved check (not private.is_reserved_slug(slug));

-- Madaya's public profile: what its landing page said (now editable from the admin settings).
insert into public.centers (id, slug, name, country, city, logo_url, about, whatsapp, instagram, facebook, address,
                            domain, status, plan, onboarded, palette)
values (private.madaya_center_id(), 'madaya', 'المركز الثقافي الدعوي في مضايا', 'سوريا', 'مضايا', '/images/logo.png',
  'تأسس المركز عام ٢٠٢٥ في بلدة مضايا بريف دمشق، بإشراف د. محمد العبده. يحتضن حلقات تحفيظ القرآن الكريم وتدارسه، ويقيم الدورات العلمية، ويفتح أبوابه للشباب بأنشطة ثقافية وتربوية هادفة.',
  '963993323763', 'https://www.instagram.com/lmrkzlthqfyldwy', 'https://www.facebook.com/share/1HjPsLvumo/', 'مضايا · ريف دمشق',
  'madayacentre.com', 'ACTIVE', 'PRO', true, 'indigo');

-- Us: the people who run the platform. They see the list of centres; they do not get into a
-- centre's daily data unless that centre adds them as staff.
create table public.platform_admins (user_id uuid primary key references auth.users(id) on delete cascade, created_at timestamptz not null default now());
alter table public.platform_admins enable row level security;
insert into public.platform_admins (user_id) select id from auth.users where lower(email) = 'osamazaedsefalden@gmail.com';

create function private.is_platform_admin() returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.platform_admins where user_id = auth.uid())
$$;

-- ============================================================== people and memberships
-- profiles (one row per login) becomes app_users (who the person is); what they are in a centre
-- moves to memberships. Renaming keeps every foreign key (teacher_id, decided_by, …) pointing at it.
alter table public.profiles rename to app_users;
drop trigger if exists trg_profiles_deleted_by on public.app_users;
drop trigger if exists trg_audit on public.app_users;
drop policy if exists profiles_select on public.app_users;
drop policy if exists profiles_update on public.app_users;
alter table public.app_users add column current_center_id uuid references public.centers(id) on delete set null;

create table public.memberships (
  user_id uuid not null references public.app_users(id) on delete cascade,
  center_id uuid not null references public.centers(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 100),
  role text not null check (role in ('ADMIN', 'TEACHER')),
  is_owner boolean not null default false,
  active boolean not null default true,
  default_filter text check (default_filter ~ '^(all|s:(MALE|FEMALE)|c:[0-9a-f-]{36})$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid,
  primary key (user_id, center_id)
);
create index idx_memberships_center on public.memberships (center_id);

insert into public.memberships (user_id, center_id, name, role, active, default_filter, created_at, deleted_at, deleted_by)
select id, private.madaya_center_id(), name, role, active, default_filter, created_at, deleted_at, deleted_by from public.app_users;
update public.app_users set current_center_id = private.madaya_center_id();

alter table public.app_users drop column role, drop column active, drop column deleted_at, drop column deleted_by, drop column default_filter;

-- The centre this request works in: the user's chosen centre if they are active staff there,
-- otherwise their oldest active membership. Null for no membership or a suspended centre.
create function private.current_center_id() returns uuid language sql stable security definer set search_path = '' as $$
  select m.center_id
  from public.memberships m join public.centers c on c.id = m.center_id
  where m.user_id = auth.uid() and m.active and m.deleted_at is null and c.status <> 'SUSPENDED'
  order by (m.center_id is not distinct from (select u.current_center_id from public.app_users u where u.id = auth.uid())) desc,
           m.created_at, m.center_id
  limit 1
$$;

create or replace function private.is_staff() returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.memberships
                 where user_id = auth.uid() and center_id = private.current_center_id()
                   and role in ('ADMIN', 'TEACHER') and active and deleted_at is null)
$$;
create or replace function private.is_admin() returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.memberships
                 where user_id = auth.uid() and center_id = private.current_center_id()
                   and role = 'ADMIN' and active and deleted_at is null)
$$;

-- The app keeps reading and editing "profiles": now the members of the current centre.
create view public.profiles with (security_invoker = true) as
  select m.user_id as id, m.name, m.role, m.active, m.created_at, m.deleted_at, m.deleted_by, m.default_filter,
         m.is_owner, m.center_id, m.updated_at
  from public.memberships m
  where m.center_id = private.current_center_id();

alter table public.app_users enable row level security;
create policy app_users_select on public.app_users for select to authenticated using (
  id = (select auth.uid())
  or exists (select 1 from public.memberships m where m.user_id = app_users.id and m.center_id = (select private.current_center_id())));
create policy app_users_update on public.app_users for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
revoke insert, update, delete on public.app_users from authenticated, anon;
grant select on public.app_users to authenticated;
grant update (name) on public.app_users to authenticated;

alter table public.memberships enable row level security;
create policy memberships_select on public.memberships for select to authenticated using (
  user_id = (select auth.uid()) or (center_id = (select private.current_center_id()) and (select private.is_staff())));
create policy memberships_update on public.memberships for update to authenticated
  using (center_id = (select private.current_center_id()) and (select private.is_admin()))
  with check (center_id = (select private.current_center_id()) and (select private.is_admin()));
revoke all on public.memberships from authenticated, anon;
grant select on public.memberships to authenticated;
grant update (name, role, active, default_filter) on public.memberships to authenticated;
grant all on public.memberships, public.app_users, public.centers, public.platform_admins to service_role;
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (name, role, active, default_filter) on public.profiles to authenticated;

-- The owner stays an active admin of their centre (they can hand ownership over, not lose it).
create function private.guard_membership() returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and old.is_owner and (new.role <> 'ADMIN' or not new.active or new.deleted_at is not null) then
    raise exception 'صاحب المركز يبقى مديرًا فعّالًا';
  end if;
  new.updated_at := now();
  return new;
end $$;
create trigger trg_memberships_guard before insert or update on public.memberships for each row execute function private.guard_membership();
create trigger trg_memberships_deleted_by before insert or update on public.memberships for each row execute function private.stamp_deleted_by();

-- set_creator looked people up in profiles; the account itself is in app_users now.
create or replace function private.set_creator() returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    new.teacher_id := coalesce(auth.uid(), new.teacher_id);
  elsif new.teacher_id is null and old.teacher_id is not null
        and not exists (select 1 from public.app_users where id = old.teacher_id) then
    null;
  else
    new.teacher_id := old.teacher_id;
  end if;
  return new;
end $$;

-- ============================================================== center_id on every centre table
do $$
declare
  t text;
begin
  foreach t in array array['circles','students','talqeen_sessions','quran_entries','attendance','arabic_books',
    'student_arabic_enrollments','arabic_entries','edu_notes','circle_lessons','activities','ranking_settings',
    'guardian_links','report_sends','exams','registration_requests','audit_log','student_transfers','user_settings'] loop
    -- A constant default fills existing rows without rewriting them or firing triggers.
    execute format('alter table public.%I add column center_id uuid not null default %L references public.centers(id) on delete cascade',
                   t, private.madaya_center_id());
    execute format('alter table public.%I alter column center_id set default private.current_center_id()', t);
    execute format('create index %I on public.%I (center_id)', 'idx_' || t || '_center', t);
    execute format('create policy %I on public.%I as restrictive for all to authenticated using (center_id = (select private.current_center_id())) with check (center_id = (select private.current_center_id()))',
                   t || '_same_center', t);
  end loop;
end $$;

-- Names unique per centre, not across the platform.
drop index public.circles_name_unique;
create unique index circles_name_unique on public.circles (center_id, lower(btrim(name)));
drop index public.arabic_books_title_unique;
create unique index arabic_books_title_unique on public.arabic_books (center_id, lower(btrim(title)));

-- One settings row per centre. The app still reads "id = 1"; RLS makes that the current centre's row.
alter table public.ranking_settings drop constraint ranking_settings_pkey;
alter table public.ranking_settings drop constraint if exists ranking_settings_id_check;
alter table public.ranking_settings add primary key (center_id);

-- Each person's saved filter is per centre (it names that centre's circles).
alter table public.user_settings drop constraint user_settings_pkey;
alter table public.user_settings add primary key (user_id, center_id);

-- A row can only point at rows of its own centre (a student of another centre, their circle, book …),
-- even when someone guesses an id: foreign keys alone don't see RLS.
create function private.check_same_center() returns trigger language plpgsql security definer set search_path = '' as $$
declare
  i int := 0;
  v_col text;
  v_tbl text;
  v_id uuid;
  v_center uuid;
begin
  while i < coalesce(array_length(tg_argv, 1), 0) loop
    v_col := tg_argv[i];
    v_tbl := tg_argv[i + 1];
    v_id := (to_jsonb(new) ->> v_col)::uuid;
    if v_id is not null then
      execute format('select center_id from public.%I where id = $1', v_tbl) into v_center using v_id;
      if v_center is distinct from new.center_id then
        raise exception 'لا يمكن ربط سجل بمركز آخر' using errcode = '42501';
      end if;
    end if;
    i := i + 2;
  end loop;
  return new;
end $$;

create trigger trg_same_center before insert or update on public.students for each row execute function private.check_same_center('circle_id', 'circles');
create trigger trg_same_center before insert or update on public.talqeen_sessions for each row execute function private.check_same_center('circle_id', 'circles');
create trigger trg_same_center before insert or update on public.quran_entries for each row execute function private.check_same_center('student_id', 'students', 'talqeen_session_id', 'talqeen_sessions');
create trigger trg_same_center before insert or update on public.attendance for each row execute function private.check_same_center('student_id', 'students');
create trigger trg_same_center before insert or update on public.student_arabic_enrollments for each row execute function private.check_same_center('student_id', 'students', 'book_id', 'arabic_books');
create trigger trg_same_center before insert or update on public.arabic_entries for each row execute function private.check_same_center('student_id', 'students', 'book_id', 'arabic_books');
create trigger trg_same_center before insert or update on public.edu_notes for each row execute function private.check_same_center('student_id', 'students');
create trigger trg_same_center before insert or update on public.circle_lessons for each row execute function private.check_same_center('circle_id', 'circles');
create trigger trg_same_center before insert or update on public.activities for each row execute function private.check_same_center('circle_id', 'circles');
create trigger trg_same_center before insert or update on public.report_sends for each row execute function private.check_same_center('student_id', 'students');
create trigger trg_same_center before insert or update on public.exams for each row execute function private.check_same_center('student_id', 'students');
create trigger trg_same_center before insert or update on public.guardian_links for each row execute function private.check_same_center('student_id', 'students');
create trigger trg_same_center before insert or update on public.student_transfers for each row execute function private.check_same_center('student_id', 'students', 'from_circle_id', 'circles', 'to_circle_id', 'circles');

-- activities.student_ids is an array: every id in it must be a student of the same centre.
create function private.check_activity_students() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from unnest(new.student_ids) sid
             where not exists (select 1 from public.students s where s.id = sid and s.center_id = new.center_id)) then
    raise exception 'لا يمكن ربط سجل بمركز آخر' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger trg_activity_students before insert or update on public.activities for each row execute function private.check_activity_students();

-- Triggers that write rows on the user's behalf take the centre from the row itself.
create or replace function private.create_guardian_link() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.guardian_links (student_id, center_id) values (new.id, new.center_id) on conflict (student_id) do nothing;
  return new;
end $$;

create or replace function private.record_student_transfer() returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_tz text := coalesce((select timezone from public.centers where id = new.center_id), 'Asia/Damascus');
begin
  if new.circle_id is distinct from old.circle_id then
    insert into public.student_transfers (student_id, from_circle_id, to_circle_id, transfer_date, created_by, center_id)
    values (new.id, old.circle_id, new.circle_id, (coalesce(new.edited_at, now()) at time zone v_tz)::date, auth.uid(), new.center_id);
  end if;
  return null;
end $$;

create or replace function private.audit_row() returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_skip text[] := array['updated_at', 'edited_at', 'updated_by', 'created_at', 'deleted_by', 'teacher_id', 'center_id'];
  v_old jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  v_new jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
  v_row jsonb := coalesce(v_new, v_old);
  v_changes jsonb := '{}'::jsonb;
  v_action text := tg_op;
  v_key text := '';
  v_col text;
  k text;
  v_center uuid := coalesce((v_row ->> 'center_id')::uuid, private.current_center_id());
begin
  if v_center is null then
    return null;
  end if;
  foreach v_col in array tg_argv loop
    v_key := v_key || case when v_key = '' then '' else '|' end || coalesce(v_row ->> v_col, '');
  end loop;
  if tg_op = 'UPDATE' then
    for k in select jsonb_object_keys(v_new) loop
      if not (k = any (v_skip)) and (v_new -> k) is distinct from (v_old -> k) then
        v_changes := v_changes || jsonb_build_object(k, jsonb_build_array(v_old -> k, v_new -> k));
      end if;
    end loop;
    if v_changes = '{}'::jsonb then
      return null;
    end if;
    if v_changes ? 'deleted_at' then
      v_action := case when v_new ->> 'deleted_at' is null then 'RESTORE' else 'DELETE' end;
    end if;
  else
    v_changes := jsonb_strip_nulls(v_row) - v_skip;
  end if;
  insert into public.audit_log (actor, table_name, row_key, student_id, action, changes, center_id)
  values (auth.uid(),
          case when tg_table_name = 'memberships' then 'profiles' else tg_table_name end,
          v_key,
          case when tg_table_name = 'students' then (v_row ->> 'id')::uuid else (v_row ->> 'student_id')::uuid end,
          v_action, v_changes, v_center);
  return null;
end $$;
create trigger trg_audit after insert or delete or update on public.memberships for each row execute function private.audit_row('user_id');

-- ============================================================== plans (limits enforced by the database)
create function private.plan_student_limit(p_plan text) returns int language sql immutable set search_path = '' as $$
  select case p_plan when 'FREE' then 60 when 'BASIC' then 400 else null end
$$;
create function private.check_student_limit() returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_limit int;
begin
  select private.plan_student_limit(plan) into v_limit from public.centers where id = new.center_id;
  if v_limit is not null
     and (select count(*) from public.students where center_id = new.center_id and deleted_at is null) >= v_limit then
    raise exception 'وصل المركز للحد الأقصى من الطلاب في خطته الحالية (% طالبًا). تواصلوا معنا للترقية', v_limit;
  end if;
  return new;
end $$;
create trigger trg_students_plan_limit before insert on public.students for each row execute function private.check_student_limit();

-- ============================================================== centres: who sees and edits what
alter table public.centers enable row level security;
create policy centers_select on public.centers for select to authenticated using (
  exists (select 1 from public.memberships m where m.center_id = centers.id and m.user_id = (select auth.uid()) and m.deleted_at is null)
  or (select private.is_platform_admin()));
create policy centers_update on public.centers for update to authenticated
  using (id = (select private.current_center_id()) and (select private.is_admin()))
  with check (id = (select private.current_center_id()) and (select private.is_admin()));
revoke all on public.centers from anon, authenticated;
grant select on public.centers to authenticated;
-- A centre's admin edits its profile; status, plan, slug and domain are ours.
grant update (name, country, city, logo_url, palette, primary_color, about, extra_notes, contact_phone, contact_email,
              whatsapp, instagram, facebook, address, timezone, locale, onboarded) on public.centers to authenticated;

create function private.touch_center() returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end $$;
create trigger trg_centers_touch before update on public.centers for each row execute function private.touch_center();

-- ============================================================== invitations
create table public.center_invites (
  id uuid primary key default gen_random_uuid(),
  center_id uuid not null default private.current_center_id() references public.centers(id) on delete cascade,
  email text not null check (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(email) <= 200),
  name text check (char_length(name) <= 100),
  role text not null default 'TEACHER' check (role in ('ADMIN', 'TEACHER')),
  token text not null unique default private.new_link_token(),
  created_by uuid default auth.uid() references public.app_users(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '14 days',
  accepted_at timestamptz,
  accepted_by uuid references public.app_users(id) on delete set null,
  revoked_at timestamptz
);
create index idx_center_invites_center on public.center_invites (center_id, created_at desc);
alter table public.center_invites enable row level security;
create policy center_invites_admin on public.center_invites for all to authenticated
  using (center_id = (select private.current_center_id()) and (select private.is_admin()))
  with check (center_id = (select private.current_center_id()) and (select private.is_admin()));
revoke all on public.center_invites from anon, authenticated;
grant select, insert on public.center_invites to authenticated;
grant update (revoked_at) on public.center_invites to authenticated;
grant all on public.center_invites to service_role;

-- ============================================================== RPCs: context, switching, public page
-- Everything the app needs to know about "me" in one call.
create function public.my_context() returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_center uuid := private.current_center_id();
  v_out jsonb;
begin
  if v_uid is null then
    return null;
  end if;
  select jsonb_build_object(
    'user_id', v_uid,
    'name', (select name from public.app_users where id = v_uid),
    'is_platform_admin', private.is_platform_admin(),
    'center', (select jsonb_build_object('id', c.id, 'slug', c.slug, 'name', c.name, 'logo_url', c.logo_url, 'palette', c.palette,
                 'primary_color', c.primary_color, 'about', c.about, 'status', c.status, 'plan', c.plan, 'onboarded', c.onboarded,
                 'timezone', c.timezone, 'locale', c.locale, 'trial_ends_at', c.trial_ends_at)
               from public.centers c where c.id = v_center),
    'membership', (select jsonb_build_object('role', m.role, 'is_owner', m.is_owner, 'active', m.active, 'name', m.name,
                     'default_filter', m.default_filter)
                   from public.memberships m where m.user_id = v_uid and m.center_id = v_center),
    'centers', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'slug', c.slug, 'name', c.name, 'role', m.role,
                           'status', c.status, 'active', m.active and m.deleted_at is null) order by m.created_at)
                         from public.memberships m join public.centers c on c.id = m.center_id
                         where m.user_id = v_uid and m.deleted_at is null), '[]'::jsonb),
    -- Why there is no current centre, so the app can say it plainly.
    'blocked', case
      when v_center is not null then null
      when exists (select 1 from public.memberships m join public.centers c on c.id = m.center_id
                   where m.user_id = v_uid and m.deleted_at is null and m.active and c.status = 'SUSPENDED') then 'SUSPENDED'
      when exists (select 1 from public.memberships m where m.user_id = v_uid and m.deleted_at is not null) then 'DELETED'
      when exists (select 1 from public.memberships m where m.user_id = v_uid and not m.active) then 'DISABLED'
      else 'NO_CENTER' end
  ) into v_out;
  return v_out;
end $$;

create function public.switch_center(p_center_id uuid) returns void language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.memberships m join public.centers c on c.id = m.center_id
                 where m.user_id = auth.uid() and m.center_id = p_center_id and m.active and m.deleted_at is null
                   and c.status <> 'SUSPENDED') then
    raise exception 'لست عضوًا فعّالًا في هذا المركز';
  end if;
  update public.app_users set current_center_id = p_center_id where id = auth.uid();
end $$;

-- What a visitor may see about a centre (its public page and the login screen): by slug or by domain.
create function public.public_center(p_slug text default null, p_domain text default null) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('id', c.id, 'slug', c.slug, 'name', c.name, 'country', c.country, 'city', c.city,
    'logo_url', c.logo_url, 'palette', c.palette, 'primary_color', c.primary_color, 'about', c.about,
    'contact_phone', c.contact_phone, 'contact_email', c.contact_email, 'whatsapp', c.whatsapp,
    'instagram', c.instagram, 'facebook', c.facebook, 'address', c.address, 'locale', c.locale, 'extra_notes', c.extra_notes,
    'honor_enabled', coalesce((select r.honor_enabled from public.ranking_settings r where r.center_id = c.id), false))
  from public.centers c
  where c.status <> 'SUSPENDED'
    and ((p_slug is not null and c.slug = lower(p_slug)) or (p_slug is null and p_domain is not null and c.domain = lower(p_domain)))
  limit 1
$$;

-- ============================================================== self-service: a new centre
create function public.create_center(p_name text, p_slug text, p_country text, p_city text, p_owner_name text,
                                     p_about text default null, p_phone text default null, p_palette text default 'indigo')
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_slug text := lower(btrim(coalesce(p_slug, '')));
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'سجّل الدخول أولًا';
  end if;
  if not exists (select 1 from auth.users where id = v_uid and email_confirmed_at is not null) then
    raise exception 'أكّد بريدك الإلكتروني أولًا';
  end if;
  if char_length(btrim(coalesce(p_owner_name, ''))) not between 2 and 100 then
    raise exception 'اكتب اسمك (من حرفين إلى 100 حرف)';
  end if;
  if v_slug !~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$' or private.is_reserved_slug(v_slug) then
    raise exception 'رابط المركز: أحرف إنجليزية صغيرة وأرقام وشرطات، من 3 إلى 40 حرفًا';
  end if;
  if exists (select 1 from public.centers where slug = v_slug) then
    raise exception 'هذا الرابط مستخدم، اختر غيره';
  end if;
  -- Floods: a few centres per person, and a cap on new centres per hour for the whole platform.
  if (select count(*) from public.centers where owner_id = v_uid) >= 3 then
    raise exception 'وصلت للحد الأقصى من المراكز لحساب واحد. تواصل معنا';
  end if;
  if (select count(*) from public.centers where created_at > now() - interval '1 hour') >= 30 then
    raise exception 'الخدمة مشغولة الآن، حاول بعد قليل';
  end if;

  insert into public.centers (slug, name, country, city, about, contact_phone, palette, owner_id, status, plan, trial_ends_at)
  values (v_slug, btrim(p_name), nullif(btrim(p_country), ''), nullif(btrim(p_city), ''), nullif(btrim(p_about), ''),
          nullif(btrim(p_phone), ''), coalesce(nullif(p_palette, ''), 'indigo'), v_uid, 'TRIAL', 'FREE', now() + interval '30 days')
  returning id into v_id;

  insert into public.app_users (id, name) values (v_uid, btrim(p_owner_name))
  on conflict (id) do nothing;
  insert into public.memberships (user_id, center_id, name, role, is_owner) values (v_uid, v_id, btrim(p_owner_name), 'ADMIN', true);
  insert into public.ranking_settings (center_id) values (v_id);
  update public.app_users set current_center_id = v_id where id = v_uid;
  return jsonb_build_object('id', v_id, 'slug', v_slug);
end $$;

-- ============================================================== invitations: accept
create function public.invite_info(p_token text) returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('center', c.name, 'slug', c.slug, 'logo_url', c.logo_url, 'palette', c.palette,
                            'role', i.role, 'email', i.email, 'name', i.name,
                            'state', case when i.revoked_at is not null then 'REVOKED' when i.accepted_at is not null then 'USED'
                                          when i.expires_at < now() then 'EXPIRED' else 'OK' end)
  from public.center_invites i join public.centers c on c.id = i.center_id
  where p_token is not null and char_length(p_token) >= 32 and i.token = p_token
$$;

create function public.accept_invite(p_token text, p_name text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_inv public.center_invites;
  v_email text;
  v_name text;
begin
  if v_uid is null then
    raise exception 'سجّل الدخول أولًا';
  end if;
  select * into v_inv from public.center_invites where token = p_token for update;
  if v_inv.id is null or v_inv.revoked_at is not null or v_inv.expires_at < now() then
    raise exception 'رابط الدعوة غير صالح أو انتهت صلاحيته';
  end if;
  if v_inv.accepted_at is not null then
    raise exception 'استُخدم رابط الدعوة من قبل';
  end if;
  select email into v_email from auth.users where id = v_uid;
  if lower(v_email) is distinct from lower(v_inv.email) then
    raise exception 'هذه الدعوة لبريد آخر. ادخل بالبريد الذي وصلته الدعوة';
  end if;
  v_name := coalesce(nullif(btrim(p_name), ''), nullif(btrim(v_inv.name), ''), split_part(v_email, '@', 1));

  insert into public.app_users (id, name) values (v_uid, v_name) on conflict (id) do nothing;
  insert into public.memberships (user_id, center_id, name, role)
  values (v_uid, v_inv.center_id, v_name, v_inv.role)
  on conflict (user_id, center_id) do update set active = true, deleted_at = null, role = excluded.role;
  update public.center_invites set accepted_at = now(), accepted_by = v_uid where id = v_inv.id;
  update public.app_users set current_center_id = v_inv.center_id where id = v_uid;
  return jsonb_build_object('center_id', v_inv.center_id);
end $$;

-- ============================================================== super admin
create function public.super_centers() returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_platform_admin() then
    raise exception 'هذه الصفحة لإدارة المنصة فقط';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', c.id, 'slug', c.slug, 'name', c.name, 'country', c.country, 'city', c.city, 'status', c.status, 'plan', c.plan,
      'domain', c.domain, 'created_at', c.created_at, 'trial_ends_at', c.trial_ends_at,
      'owner_email', (select u.email from auth.users u where u.id = c.owner_id),
      'staff', (select count(*) from public.memberships m where m.center_id = c.id and m.deleted_at is null and m.active),
      'students', (select count(*) from public.students s where s.center_id = c.id and s.deleted_at is null and s.active),
      'circles', (select count(*) from public.circles x where x.center_id = c.id and x.deleted_at is null),
      'last_activity', (select max(q.created_at) from public.quran_entries q where q.center_id = c.id)
    ) order by c.created_at)
    from public.centers c), '[]'::jsonb);
end $$;

create function public.super_set_center(p_id uuid, p_status text default null, p_plan text default null) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_platform_admin() then
    raise exception 'هذه الصفحة لإدارة المنصة فقط';
  end if;
  update public.centers set status = coalesce(p_status, status), plan = coalesce(p_plan, plan) where id = p_id;
  if not found then
    raise exception 'المركز غير موجود';
  end if;
end $$;

-- ============================================================== existing SECURITY DEFINER RPCs, now per centre
create or replace function public.admin_accept_registration(p_id uuid, p_circle_id uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_center uuid := private.current_center_id();
  v_req public.registration_requests;
  v_student uuid;
begin
  if not private.is_admin() then
    raise exception 'قبول طلبات التسجيل متاح للمدير فقط';
  end if;
  select * into v_req from public.registration_requests where id = p_id and center_id = v_center for update;
  if v_req.id is null then
    raise exception 'الطلب غير موجود';
  end if;
  if v_req.status <> 'PENDING' then
    raise exception 'تمّ البتّ في هذا الطلب من قبل';
  end if;
  if not exists (select 1 from public.circles where id = p_circle_id and center_id = v_center and active and deleted_at is null) then
    raise exception 'اختر حلقة';
  end if;
  insert into public.students (name, circle_id, guardian_name, guardian_phone, center_id)
  values (v_req.student_name, p_circle_id, v_req.guardian_name, v_req.guardian_phone, v_center)
  returning id into v_student;
  update public.registration_requests
  set status = 'ACCEPTED', decided_at = now(), decided_by = auth.uid(), student_id = v_student
  where id = p_id;
  return v_student;
end $$;

create or replace function public.admin_reject_registration(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_admin() then
    raise exception 'رفض طلبات التسجيل متاح للمدير فقط';
  end if;
  update public.registration_requests
  set status = 'REJECTED', decided_at = now(), decided_by = auth.uid()
  where id = p_id and status = 'PENDING' and center_id = private.current_center_id();
  if not found then
    raise exception 'تمّ البتّ في هذا الطلب من قبل';
  end if;
end $$;

-- Removing a person from a centre leaves their other centres alone; the login itself is blocked
-- only when no centre is left.
create or replace function public.admin_soft_delete(p_kind text, p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_center uuid := private.current_center_id();
begin
  if not private.is_admin() then
    raise exception 'هذا الإجراء متاح للمدير فقط';
  end if;
  if p_kind = 'profile' then
    if p_id = auth.uid() then
      raise exception 'لا يمكنك حذف حسابك أنت';
    end if;
    if exists (select 1 from public.memberships where user_id = p_id and center_id = v_center and is_owner) then
      raise exception 'لا يمكن حذف صاحب المركز';
    end if;
    update public.memberships set deleted_at = now() where user_id = p_id and center_id = v_center and deleted_at is null;
    if not exists (select 1 from public.memberships where user_id = p_id and deleted_at is null) then
      update auth.users set banned_until = 'infinity' where id = p_id;
      delete from auth.sessions where user_id = p_id;
    end if;
  elsif p_kind = 'student' then
    update public.students set deleted_at = now(), edited_at = private.next_edit(edited_at)
    where id = p_id and center_id = v_center and deleted_at is null;
  elsif p_kind = 'circle' then
    if exists (select 1 from public.students where circle_id = p_id and deleted_at is null) then
      raise exception 'في هذه الحلقة طلاب. انقلهم إلى حلقة أخرى أو احذفهم أولًا';
    end if;
    update public.circles set deleted_at = now(), edited_at = private.next_edit(edited_at)
    where id = p_id and center_id = v_center and deleted_at is null;
  elsif p_kind = 'arabic_book' then
    if exists (select 1 from public.student_arabic_enrollments
               where book_id = p_id and deleted_at is null and finished_on is null) then
      raise exception 'هذا الكتاب يدرسه طلاب حاليًا. أنهِ تسجيلهم فيه أولًا';
    end if;
    update public.arabic_books set deleted_at = now(), edited_at = private.next_edit(edited_at)
    where id = p_id and center_id = v_center and deleted_at is null;
  else
    raise exception 'نوع غير معروف';
  end if;
end $$;

create or replace function public.admin_restore(p_kind text, p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_center uuid := private.current_center_id();
  v_edited timestamptz;
begin
  if not private.is_admin() then
    raise exception 'هذا الإجراء متاح للمدير فقط';
  end if;
  if p_kind = 'profile' then
    update public.memberships set deleted_at = null where user_id = p_id and center_id = v_center;
    if found then
      update auth.users set banned_until = null where id = p_id;
    end if;
  elsif p_kind = 'student' then
    if exists (select 1 from public.students s join public.circles c on c.id = s.circle_id
               where s.id = p_id and c.deleted_at is not null) then
      raise exception 'حلقة هذا الطالب محذوفة. استرجع الحلقة أولًا';
    end if;
    update public.students set deleted_at = null, edited_at = private.next_edit(edited_at) where id = p_id and center_id = v_center;
  elsif p_kind = 'circle' then
    update public.circles set deleted_at = null, edited_at = private.next_edit(edited_at) where id = p_id and center_id = v_center;
  elsif p_kind = 'arabic_book' then
    update public.arabic_books set deleted_at = null, edited_at = private.next_edit(edited_at) where id = p_id and center_id = v_center;
  elsif p_kind = 'quran_entry' then
    update public.quran_entries set deleted_at = null, edited_at = private.next_edit(edited_at) where id = p_id and center_id = v_center;
  elsif p_kind = 'arabic_entry' then
    update public.arabic_entries set deleted_at = null, edited_at = private.next_edit(edited_at) where id = p_id and center_id = v_center;
  elsif p_kind = 'edu_note' then
    update public.edu_notes set deleted_at = null, edited_at = private.next_edit(edited_at) where id = p_id and center_id = v_center;
  elsif p_kind = 'talqeen_session' then
    select edited_at into v_edited from public.talqeen_sessions where id = p_id and center_id = v_center;
    update public.talqeen_sessions set deleted_at = null, edited_at = private.next_edit(edited_at) where id = p_id and center_id = v_center;
    update public.quran_entries set deleted_at = null, edited_at = private.next_edit(edited_at)
    where talqeen_session_id = p_id and center_id = v_center and deleted_at is not null and edited_at = v_edited;
  else
    raise exception 'نوع غير معروف';
  end if;
end $$;

create or replace function public.admin_purge(p_kind text, p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_center uuid := private.current_center_id();
begin
  if not private.is_admin() then
    raise exception 'هذا الإجراء متاح للمدير فقط';
  end if;
  if p_kind = 'profile' then
    if p_id = auth.uid() then
      raise exception 'لا يمكنك حذف حسابك أنت';
    end if;
    if not exists (select 1 from public.memberships where user_id = p_id and center_id = v_center and deleted_at is not null) then
      raise exception 'العنصر ليس في سجل المحذوفات';
    end if;
    delete from public.memberships where user_id = p_id and center_id = v_center;
    -- The login goes only when it belongs to no other centre and isn't one of us.
    if not exists (select 1 from public.memberships where user_id = p_id)
       and not exists (select 1 from public.platform_admins where user_id = p_id) then
      delete from auth.users where id = p_id;
    end if;
  elsif p_kind = 'student' then
    delete from public.students where id = p_id and center_id = v_center and deleted_at is not null;
  elsif p_kind = 'circle' then
    if exists (select 1 from public.students where circle_id = p_id) then
      raise exception 'لهذه الحلقة طلاب (ولو في سجل المحذوفات). امسحهم نهائيًا أو انقلهم أولًا';
    end if;
    delete from public.circles where id = p_id and center_id = v_center and deleted_at is not null;
  elsif p_kind = 'arabic_book' then
    if exists (select 1 from public.arabic_entries where book_id = p_id)
       or exists (select 1 from public.student_arabic_enrollments where book_id = p_id) then
      raise exception 'لهذا الكتاب سجلات دروس عند الطلاب، فلا يمكن مسحه نهائيًا';
    end if;
    delete from public.arabic_books where id = p_id and center_id = v_center and deleted_at is not null;
  elsif p_kind = 'quran_entry' then
    delete from public.quran_entries where id = p_id and center_id = v_center and deleted_at is not null;
  elsif p_kind = 'arabic_entry' then
    delete from public.arabic_entries where id = p_id and center_id = v_center and deleted_at is not null;
  elsif p_kind = 'edu_note' then
    delete from public.edu_notes where id = p_id and center_id = v_center and deleted_at is not null;
  elsif p_kind = 'talqeen_session' then
    delete from public.talqeen_sessions where id = p_id and center_id = v_center and deleted_at is not null;
  else
    raise exception 'نوع غير معروف';
  end if;
end $$;

create or replace function public.admin_trash()
returns table(kind text, id text, label text, detail text, deleted_at timestamptz, deleted_by_name text)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_center uuid := private.current_center_id();
begin
  if not private.is_admin() then
    raise exception 'هذا الإجراء متاح للمدير فقط';
  end if;
  return query
    select 'profile', p.user_id::text, p.name, case p.role when 'ADMIN' then 'مدير' else 'محفّظ' end, p.deleted_at, d.name
    from public.memberships p left join public.memberships d on d.user_id = p.deleted_by and d.center_id = v_center
    where p.deleted_at is not null and p.center_id = v_center
  union all
    select 'student', s.id::text, s.name, coalesce('حلقة ' || c.name, ''), s.deleted_at, d.name
    from public.students s left join public.circles c on c.id = s.circle_id
    left join public.memberships d on d.user_id = s.deleted_by and d.center_id = v_center
    where s.deleted_at is not null and s.center_id = v_center
  union all
    select 'circle', c.id::text, c.name, '', c.deleted_at, d.name
    from public.circles c left join public.memberships d on d.user_id = c.deleted_by and d.center_id = v_center
    where c.deleted_at is not null and c.center_id = v_center
  union all
    select 'arabic_book', b.id::text, b.title, b.total_pages || ' صفحة', b.deleted_at, d.name
    from public.arabic_books b left join public.memberships d on d.user_id = b.deleted_by and d.center_id = v_center
    where b.deleted_at is not null and b.center_id = v_center
  union all
    select 'quran_entry', q.id::text,
           (case q.track when 'HIFZ' then 'حفظ' when 'TILAWA' then 'تلاوة' when 'MURAJAA' then 'مراجعة' else 'تلقين' end) || ' — ' || s.name,
           q.entry_date::text || coalesce(' · ' || fs.name || ' ' || q.from_ayah || ' ← ' || ts.name || ' ' || q.to_ayah, ''),
           q.deleted_at, d.name
    from public.quran_entries q
    join public.students s on s.id = q.student_id
    left join public.quran_surahs fs on fs.surah_no = q.from_surah_no
    left join public.quran_surahs ts on ts.surah_no = q.to_surah_no
    left join public.memberships d on d.user_id = q.deleted_by and d.center_id = v_center
    where q.deleted_at is not null and q.talqeen_session_id is null and q.center_id = v_center
  union all
    select 'arabic_entry', a.id::text, 'عربية — ' || s.name,
           a.entry_date::text || ' · ' || b.title || ' ص' || a.from_page || '-' || a.to_page, a.deleted_at, d.name
    from public.arabic_entries a
    join public.students s on s.id = a.student_id
    join public.arabic_books b on b.id = a.book_id
    left join public.memberships d on d.user_id = a.deleted_by and d.center_id = v_center
    where a.deleted_at is not null and a.center_id = v_center
  union all
    select 'edu_note', n.id::text, 'ملاحظة تربوية — ' || s.name, n.record_date::text || ' · ' || n.area, n.deleted_at, d.name
    from public.edu_notes n
    join public.students s on s.id = n.student_id
    left join public.memberships d on d.user_id = n.deleted_by and d.center_id = v_center
    where n.deleted_at is not null and n.center_id = v_center
  union all
    select 'talqeen_session', t.id::text, 'جلسة تلقين — ' || c.name,
           t.session_date::text || ' · ' || fs.name || ' ' || t.from_ayah || ' ← ' || ts.name || ' ' || t.to_ayah,
           t.deleted_at, d.name
    from public.talqeen_sessions t
    join public.circles c on c.id = t.circle_id
    left join public.quran_surahs fs on fs.surah_no = t.from_surah_no
    left join public.quran_surahs ts on ts.surah_no = t.to_surah_no
    left join public.memberships d on d.user_id = t.deleted_by and d.center_id = v_center
    where t.deleted_at is not null and t.center_id = v_center
  order by 5 desc;
end $$;

create or replace function public.rotate_guardian_link(p_student_id uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_center uuid := private.current_center_id();
  v_token text;
begin
  if not private.is_admin() then
    raise exception 'تغيير رابط ولي الأمر متاح للمدير فقط';
  end if;
  if not exists (select 1 from public.students where id = p_student_id and center_id = v_center) then
    raise exception 'الطالب غير موجود';
  end if;
  insert into public.guardian_links (student_id, center_id) values (p_student_id, v_center)
  on conflict (student_id) do update
    set token = private.new_link_token(), created_at = now(), updated_at = now(), last_opened_at = null, open_count = 0
  returning token into v_token;
  return v_token;
end $$;

-- The family's page by its private link: the centre comes from the student, the week and the day
-- from that centre's settings and time zone.
create or replace function public.guardian_view(p_token text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_student public.students;
  v_circle public.circles;
  v_center public.centers;
  v_today date;
  v_since date;
  v_month date;
  v_week date;
begin
  if p_token is null or char_length(p_token) < 32 then
    return null;
  end if;
  select s.* into v_student
  from public.guardian_links g join public.students s on s.id = g.student_id
  where g.token = p_token and s.deleted_at is null and s.active;
  if not found then
    return null;
  end if;
  select * into v_center from public.centers where id = v_student.center_id and status <> 'SUSPENDED';
  if not found then
    return null;
  end if;
  v_today := (now() at time zone v_center.timezone)::date;
  v_since := v_today - 13;
  v_month := v_today - 29;
  select * into v_circle from public.circles where id = v_student.circle_id;
  select v_today - ((extract(dow from v_today)::int - coalesce(week_start, 6) + 7) % 7) into v_week
  from public.ranking_settings where center_id = v_student.center_id;
  v_week := coalesce(v_week, v_today - ((extract(dow from v_today)::int - 6 + 7) % 7));

  if not exists (select 1 from public.memberships m where m.user_id = auth.uid() and m.center_id = v_student.center_id) then
    update public.guardian_links
    set last_opened_at = now(), open_count = open_count + 1, updated_at = now()
    where student_id = v_student.id;
  end if;

  return jsonb_build_object(
    'center', jsonb_build_object('name', v_center.name, 'slug', v_center.slug, 'logo_url', v_center.logo_url,
                                 'palette', v_center.palette, 'primary_color', v_center.primary_color),
    'student', jsonb_build_object('name', v_student.name, 'circle', v_circle.name, 'section', v_circle.section),
    'surahs', (select jsonb_agg(jsonb_build_object('surah_no', surah_no, 'name', name, 'ayah_count', ayah_count) order by surah_no)
               from public.quran_surahs),
    'hifz', coalesce((
      select jsonb_agg(jsonb_build_object('entry_date', q.entry_date, 'from_surah_no', q.from_surah_no, 'from_ayah', q.from_ayah,
                                          'to_surah_no', q.to_surah_no, 'to_ayah', q.to_ayah) order by q.entry_date)
      from public.quran_entries q
      where q.student_id = v_student.id and q.deleted_at is null and q.track = 'HIFZ'), '[]'::jsonb),
    'recent', coalesce((
      select jsonb_agg(jsonb_build_object('entry_date', q.entry_date, 'track', q.track, 'from_surah_no', q.from_surah_no,
                                          'from_ayah', q.from_ayah, 'to_surah_no', q.to_surah_no, 'to_ayah', q.to_ayah,
                                          'quality', q.quality) order by q.entry_date desc, q.created_at)
      from public.quran_entries q
      where q.student_id = v_student.id and q.deleted_at is null and q.entry_date >= v_since), '[]'::jsonb),
    'attendance', coalesce((
      select jsonb_agg(jsonb_build_object('att_date', a.att_date, 'status', a.status) order by a.att_date desc)
      from public.attendance a
      where a.student_id = v_student.id and a.deleted_at is null and a.att_date >= v_month), '[]'::jsonb),
    'lessons', coalesce((
      select jsonb_agg(jsonb_build_object('lesson_date', l.lesson_date, 'title', l.title) order by l.lesson_date desc)
      from public.circle_lessons l
      where l.circle_id = v_student.circle_id and l.deleted_at is null and l.lesson_date >= v_since), '[]'::jsonb),
    'goal', case when v_student.weekly_goal_ayahs is null then null else jsonb_build_object(
      'weekly_ayahs', v_student.weekly_goal_ayahs,
      'done', (select count(distinct i)
               from public.quran_entries q,
                    generate_series(public.ayahs_before(q.from_surah_no) + q.from_ayah, public.ayahs_before(q.to_surah_no) + q.to_ayah) i
               where q.student_id = v_student.id and q.deleted_at is null and q.track = 'HIFZ' and q.entry_date >= v_week)) end,
    'exams', coalesce((
      select jsonb_agg(jsonb_build_object('exam_date', x.exam_date, 'kind', x.kind, 'juz_no', x.juz_no, 'surah_no', x.surah_no,
                                          'score', x.score, 'passed', x.passed) order by x.exam_date desc)
      from (select * from public.exams where student_id = v_student.id and deleted_at is null
            order by exam_date desc, created_at desc limit 10) x), '[]'::jsonb)
  );
end $$;

-- The public registration form now says which centre it is for (its slug). Old cached pages that
-- don't send one keep going to Madaya, where the form lived before.
drop function if exists public.submit_registration(text, integer, text, text, text, text, text);
create function public.submit_registration(p_student_name text, p_age integer, p_section text, p_guardian_name text,
                                           p_guardian_phone text, p_memorized text, p_trap text default null,
                                           p_center text default null)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  v_name text := btrim(coalesce(p_student_name, ''));
  v_center uuid;
begin
  if coalesce(p_trap, '') <> '' then
    return true;
  end if;
  select id into v_center from public.centers
  where slug = lower(coalesce(nullif(btrim(p_center), ''), 'madaya')) and status <> 'SUSPENDED';
  if v_center is null then
    raise exception 'المركز غير موجود';
  end if;
  if char_length(v_name) < 2 or char_length(v_name) > 100 then
    raise exception 'اكتبوا اسم الطالب (من حرفين إلى 100 حرف)';
  end if;
  if p_age is not null and (p_age < 3 or p_age > 80) then
    raise exception 'العمر غير صحيح';
  end if;
  if p_section is null or p_section not in ('MALE', 'FEMALE') then
    raise exception 'اختاروا القسم';
  end if;
  if coalesce(p_guardian_phone, '') !~ '^[0-9]{7,15}$' then
    raise exception 'رقم ولي الأمر غير صحيح';
  end if;
  if char_length(coalesce(p_guardian_name, '')) > 100 or char_length(coalesce(p_memorized, '')) > 300 then
    raise exception 'النص طويل جدًا';
  end if;
  if (select count(*) from public.registration_requests
      where guardian_phone = p_guardian_phone and created_at > now() - interval '1 day') >= 5 then
    raise exception 'وصلتنا طلبات كثيرة من هذا الرقم اليوم. سنتواصل معكم قريبًا إن شاء الله';
  end if;
  if (select count(*) from public.registration_requests where center_id = v_center and created_at > now() - interval '1 hour') >= 60 then
    raise exception 'الخدمة مشغولة الآن، حاولوا بعد قليل';
  end if;
  insert into public.registration_requests (student_name, age, section, guardian_name, guardian_phone, memorized, center_id)
  values (v_name, p_age, p_section, nullif(btrim(p_guardian_name), ''), p_guardian_phone, nullif(btrim(p_memorized), ''), v_center);
  return true;
end $$;

-- ============================================================== who may call what
revoke all on function public.my_context(), public.switch_center(uuid), public.create_center(text, text, text, text, text, text, text, text),
  public.accept_invite(text, text), public.super_centers(), public.super_set_center(uuid, text, text) from public, anon;
grant execute on function public.my_context(), public.switch_center(uuid), public.create_center(text, text, text, text, text, text, text, text),
  public.accept_invite(text, text), public.super_centers(), public.super_set_center(uuid, text, text) to authenticated;
grant execute on function public.public_center(text, text), public.invite_info(text),
  public.submit_registration(text, integer, text, text, text, text, text, text) to anon, authenticated;
revoke all on function private.current_center_id(), private.is_platform_admin(), private.madaya_center_id(),
  private.check_same_center(), private.check_activity_students(), private.check_student_limit(), private.guard_membership()
  from public;
grant execute on function private.current_center_id(), private.is_platform_admin(), private.madaya_center_id(),
  private.is_reserved_slug(text), private.plan_student_limit(text) to authenticated, anon, service_role;

-- ============================================================== for the server only (service key)
-- The admin "add a teacher" route: is there already a login with this email (maybe in another centre)?
create function public.service_user_id(p_email text) returns uuid language sql stable security definer set search_path = '' as $$
  select id from auth.users where lower(email) = lower(btrim(p_email)) limit 1
$$;
revoke all on function public.service_user_id(text) from public, anon, authenticated;
grant execute on function public.service_user_id(text) to service_role;
