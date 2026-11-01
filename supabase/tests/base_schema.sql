-- Snapshot of the production schema (public + private) as of 2026-11-01, read from the live
-- database's catalog — structure only, no data. The tests load this, then the new migrations, so
-- the multi-centre migration is checked against the real starting point. Old "deprecated_*"
-- tables and functions the app no longer uses are left out.
-- gen_random_uuid() is built in (Postgres 13+), no extension needed.
create schema if not exists private;
grant usage on schema private to authenticated, anon, service_role;
grant usage on schema public to authenticated, anon, service_role;

-- ---------------------------------------------------------------- tables
create table public.quran_surahs (surah_no integer primary key, name text not null unique, ayah_count integer not null);

create table public.profiles (id uuid primary key references auth.users(id) on delete cascade, name text not null,
  role text not null check (role in ('ADMIN','TEACHER')), active boolean not null default true,
  created_at timestamptz not null default now(), deleted_at timestamptz, deleted_by uuid,
  default_filter text check (default_filter ~ '^(all|s:(MALE|FEMALE)|c:[0-9a-f-]{36})$'));

create table public.circles (id uuid primary key default gen_random_uuid(), name text not null,
  created_at timestamptz not null default now(), active boolean not null default true,
  updated_at timestamptz not null default now(), updated_by uuid, edited_at timestamptz not null default now(),
  deleted_at timestamptz, deleted_by uuid, section text check (section in ('MALE','FEMALE')));
create unique index circles_name_unique on public.circles (lower(btrim(name)));

create table public.students (id uuid primary key default gen_random_uuid(), name text not null,
  circle_id uuid not null references public.circles(id) on delete cascade,
  created_at timestamptz not null default now(), active boolean not null default true,
  updated_at timestamptz not null default now(), updated_by uuid, edited_at timestamptz not null default now(),
  deleted_at timestamptz, deleted_by uuid, guardian_name text check (char_length(guardian_name) <= 100),
  guardian_phone text check (guardian_phone ~ '^[0-9]{7,15}$'),
  weekly_goal_ayahs smallint check (weekly_goal_ayahs between 1 and 1000));

create table public.talqeen_sessions (id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references public.circles(id) on delete cascade, session_date date not null default current_date,
  from_surah_no integer not null references public.quran_surahs(surah_no), from_ayah integer not null,
  to_surah_no integer not null references public.quran_surahs(surah_no), to_ayah integer not null, notes text,
  teacher_id uuid default auth.uid() references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), updated_by uuid,
  edited_at timestamptz not null default now(), deleted_at timestamptz, deleted_by uuid);

create table public.quran_entries (id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade, entry_date date not null default current_date,
  track text not null check (track in ('HIFZ','TILAWA','MURAJAA','TALQEEN')),
  from_surah_no integer references public.quran_surahs(surah_no), from_ayah integer,
  to_surah_no integer references public.quran_surahs(surah_no), to_ayah integer, quality text, notes text,
  talqeen_session_id uuid references public.talqeen_sessions(id) on delete cascade,
  teacher_id uuid default auth.uid() references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), updated_by uuid,
  edited_at timestamptz not null default now(), deleted_at timestamptz, deleted_by uuid,
  check (track = 'TALQEEN' or talqeen_session_id is null));

create table public.attendance (student_id uuid not null references public.students(id) on delete cascade, att_date date not null,
  status text not null check (status in ('PRESENT','LATE','EXCUSED','ABSENT')),
  teacher_id uuid default auth.uid() references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), updated_by uuid,
  edited_at timestamptz not null default now(), deleted_at timestamptz, primary key (student_id, att_date));

create table public.arabic_books (id uuid primary key default gen_random_uuid(), title text not null check (btrim(title) <> ''),
  total_pages integer not null check (total_pages > 0), active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), updated_by uuid,
  edited_at timestamptz not null default now(), deleted_at timestamptz, deleted_by uuid);
create unique index arabic_books_title_unique on public.arabic_books (lower(btrim(title)));

create table public.student_arabic_enrollments (id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  book_id uuid not null references public.arabic_books(id) on delete cascade,
  started_on date not null default current_date, finished_on date,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), updated_by uuid,
  edited_at timestamptz not null default now(), deleted_at timestamptz, unique (student_id, book_id));

create table public.arabic_entries (id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade, entry_date date not null default current_date,
  book_id uuid not null references public.arabic_books(id) on delete cascade,
  from_page integer not null check (from_page >= 1), to_page integer not null, quality text, notes text,
  teacher_id uuid default auth.uid() references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), updated_by uuid,
  edited_at timestamptz not null default now(), deleted_at timestamptz, deleted_by uuid, check (to_page >= from_page));

create table public.edu_notes (id uuid primary key default gen_random_uuid(), record_date date not null default current_date,
  student_id uuid not null references public.students(id) on delete cascade,
  teacher_id uuid references public.profiles(id) on delete set null, area text not null,
  points integer not null default 0, note text not null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), updated_by uuid,
  edited_at timestamptz not null default now(), deleted_at timestamptz, deleted_by uuid, quality text);

create table public.circle_lessons (circle_id uuid not null references public.circles(id) on delete cascade,
  lesson_date date not null, title text not null check (btrim(title) <> ''),
  teacher_id uuid default auth.uid() references public.profiles(id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), updated_by uuid,
  edited_at timestamptz not null default now(), deleted_at timestamptz, deleted_by uuid, primary key (circle_id, lesson_date));

create table public.activities (id uuid primary key default gen_random_uuid(), title text not null check (btrim(title) <> ''),
  activity_date date not null, circle_id uuid references public.circles(id) on delete cascade,
  student_ids uuid[] not null default '{}', teacher_id uuid default auth.uid() references public.profiles(id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), updated_by uuid,
  edited_at timestamptz not null default now(), deleted_at timestamptz, deleted_by uuid);

create table public.ranking_settings (id smallint primary key default 1 check (id = 1),
  weights jsonb not null default '{"hifz": 40, "tilawa": 20, "tarbiya": 10, "activities": 10, "attendance": 20}',
  grades jsonb not null default '{"جيد": 70, "إعادة": 40, "تمكين": 60, "ممتاز": 100, "جيد جدًا": 85}',
  week_start smallint not null default 6 check (week_start between 0 and 6), course_start date,
  updated_at timestamptz not null default now(), updated_by uuid default auth.uid(),
  absence_threshold smallint not null default 3 check (absence_threshold between 1 and 30),
  absence_message text check (char_length(absence_message) <= 1000),
  pass_mark smallint not null default 70 check (pass_mark between 1 and 100), honor_enabled boolean not null default false);
insert into public.ranking_settings (id) values (1);

create table public.guardian_links (student_id uuid primary key references public.students(id) on delete cascade,
  token text not null unique check (char_length(token) >= 32), created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(), last_opened_at timestamptz, open_count integer not null default 0);

create table public.report_sends (student_id uuid not null references public.students(id) on delete cascade, send_date date not null,
  kind text not null check (kind in ('DAILY','MONTHLY','ABSENCE')), teacher_id uuid default auth.uid() references public.profiles(id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), updated_by uuid,
  edited_at timestamptz not null default now(), deleted_at timestamptz, deleted_by uuid, primary key (student_id, send_date, kind));

create table public.exams (id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade, exam_date date not null,
  kind text not null check (kind in ('JUZ','SURAH','MONTHLY')), juz_no smallint check (juz_no between 1 and 30),
  surah_no integer references public.quran_surahs(surah_no), examiner text, score numeric(5,2) not null check (score between 0 and 100),
  passed boolean not null, notes text, teacher_id uuid default auth.uid() references public.profiles(id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), updated_by uuid,
  edited_at timestamptz not null default now(), deleted_at timestamptz, deleted_by uuid);

create table public.registration_requests (id uuid primary key default gen_random_uuid(), student_name text not null, age smallint,
  section text not null check (section in ('MALE','FEMALE')), guardian_name text, guardian_phone text not null, memorized text,
  status text not null default 'PENDING' check (status in ('PENDING','ACCEPTED','REJECTED')),
  created_at timestamptz not null default now(), decided_at timestamptz,
  decided_by uuid references public.profiles(id) on delete set null,
  student_id uuid references public.students(id) on delete set null);

create table public.audit_log (id bigint generated always as identity primary key, at timestamptz not null default now(), actor uuid,
  table_name text not null, row_key text not null, student_id uuid,
  action text not null check (action in ('INSERT','UPDATE','DELETE','RESTORE')), changes jsonb not null);

create table public.student_transfers (id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  from_circle_id uuid references public.circles(id) on delete set null, to_circle_id uuid references public.circles(id) on delete set null,
  transfer_date date not null, created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz);

create table public.user_settings (user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  filter text check (filter ~ '^(all|s:(MALE|FEMALE)|c:[0-9a-f-]{36})$'), updated_at timestamptz not null default now());

-- ---------------------------------------------------------------- helper functions
create function private.is_admin() returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from profiles where id = auth.uid() and role = 'ADMIN' and active and deleted_at is null);
$$;
create function private.is_staff() returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from profiles where id = auth.uid() and role in ('ADMIN', 'TEACHER') and active and deleted_at is null);
$$;
create function private.new_link_token() returns text language sql set search_path = '' as $$
  select replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
$$;
alter table public.guardian_links alter column token set default private.new_link_token();
create function private.next_edit(p_prev timestamptz) returns timestamptz language sql stable set search_path = '' as $$
  select greatest(now(), p_prev + interval '1 millisecond');
$$;

create function private.sync_touch() returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and new.edited_at < old.edited_at then return null; end if;
  new.updated_at := now(); new.updated_by := auth.uid(); return new;
end $$;
create function private.set_creator() returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then new.teacher_id := coalesce(auth.uid(), new.teacher_id);
  elsif new.teacher_id is null and old.teacher_id is not null
        and not exists (select 1 from public.profiles where id = old.teacher_id) then null;
  else new.teacher_id := old.teacher_id; end if;
  return new;
end $$;
create function private.stamp_deleted_by() returns trigger language plpgsql set search_path = '' as $$
begin
  if new.deleted_at is null then new.deleted_by := null;
  elsif tg_op = 'INSERT' or old.deleted_at is null then new.deleted_by := coalesce(auth.uid(), new.deleted_by);
  else new.deleted_by := old.deleted_by; end if;
  return new;
end $$;
create function private.ranking_settings_touch() returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at := now(); new.updated_by := auth.uid(); return new; end $$;
create function private.guard_student_archive() returns trigger language plpgsql set search_path = '' as $$
begin
  if (tg_op = 'INSERT' and (not new.active or new.deleted_at is not null))
     or (tg_op = 'UPDATE' and (new.active is distinct from old.active or new.deleted_at is distinct from old.deleted_at)) then
    if not private.is_admin() then raise exception 'أرشفة الطلاب وحذفهم متاحان للمدير فقط'; end if;
  end if;
  return new;
end $$;
create function private.create_guardian_link() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.guardian_links (student_id) values (new.id) on conflict (student_id) do nothing;
  return new;
end $$;
create function private.record_student_transfer() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.circle_id is distinct from old.circle_id then
    insert into public.student_transfers (student_id, from_circle_id, to_circle_id, transfer_date, created_by)
    values (new.id, old.circle_id, new.circle_id, (coalesce(new.edited_at, now()) at time zone 'Asia/Damascus')::date, auth.uid());
  end if;
  return null;
end $$;
create function private.audit_row() returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_skip text[] := array['updated_at', 'edited_at', 'updated_by', 'created_at', 'deleted_by', 'teacher_id'];
  v_old jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  v_new jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
  v_row jsonb := coalesce(v_new, v_old);
  v_changes jsonb := '{}'::jsonb; v_action text := tg_op; v_key text := ''; v_col text; k text;
begin
  foreach v_col in array tg_argv loop
    v_key := v_key || case when v_key = '' then '' else '|' end || coalesce(v_row ->> v_col, '');
  end loop;
  if tg_op = 'UPDATE' then
    for k in select jsonb_object_keys(v_new) loop
      if not (k = any (v_skip)) and (v_new -> k) is distinct from (v_old -> k) then
        v_changes := v_changes || jsonb_build_object(k, jsonb_build_array(v_old -> k, v_new -> k));
      end if;
    end loop;
    if v_changes = '{}'::jsonb then return null; end if;
    if v_changes ? 'deleted_at' then
      v_action := case when v_new ->> 'deleted_at' is null then 'RESTORE' else 'DELETE' end;
    end if;
  else
    v_changes := jsonb_strip_nulls(v_row) - v_skip;
  end if;
  insert into public.audit_log (actor, table_name, row_key, student_id, action, changes)
  values (auth.uid(), tg_table_name, v_key,
    case when tg_table_name = 'students' then (v_row ->> 'id')::uuid else (v_row ->> 'student_id')::uuid end,
    v_action, v_changes);
  return null;
end $$;

-- Unchanged by the multi-centre work (they run as the caller, so RLS scopes them).
create function public.ayahs_before(p_surah_no integer) returns integer language sql immutable set search_path = public as $$
  select coalesce(sum(ayah_count),0)::int from quran_surahs where surah_no < p_surah_no;
$$;
create function public.sync_latest_quran_entries() returns setof public.quran_entries language sql stable set search_path = public as $$
  select distinct on (student_id, track) * from quran_entries where deleted_at is null
  order by student_id, track, entry_date desc, created_at desc;
$$;

create function public.sync_latest_arabic_entries() returns setof public.arabic_entries language sql stable set search_path = public as $$
  select distinct on (student_id, book_id) * from arabic_entries where deleted_at is null
  order by student_id, book_id, to_page desc, entry_date desc;
$$;
create function public.tilawah_percent(p_surah_no integer, p_ayah integer) returns integer language sql stable set search_path = public as $$
  select round((public.ayahs_before(p_surah_no) + coalesce(p_ayah,0))::numeric / (select sum(ayah_count) from quran_surahs) * 100)::int;
$$;
create function public.report_data(p_from date, p_to date, p_circle_id uuid default null, p_student_id uuid default null) returns jsonb
language sql stable set search_path = public as $$
  with st as (select id, circle_id from students where (p_student_id is null or id = p_student_id) and (p_circle_id is null or circle_id = p_circle_id))
  select jsonb_build_object(
    'quran', coalesce((select jsonb_agg(to_jsonb(q) order by q.entry_date, q.created_at) from quran_entries q
                       where q.student_id in (select id from st) and q.deleted_at is null and q.entry_date between p_from and p_to), '[]'::jsonb),
    'arabic', coalesce((select jsonb_agg(to_jsonb(a) order by a.entry_date, a.created_at) from arabic_entries a
                        where a.student_id in (select id from st) and a.deleted_at is null and a.entry_date between p_from and p_to), '[]'::jsonb),
    'tarbiya', coalesce((select jsonb_agg(jsonb_build_object('id', n.id, 'student_id', n.student_id, 'record_date', n.record_date, 'area', n.area,
                          'note', n.note, 'quality', n.quality, 'teacher_id', n.teacher_id) order by n.record_date, n.created_at)
                         from edu_notes n where n.student_id in (select id from st) and n.deleted_at is null and n.record_date between p_from and p_to), '[]'::jsonb),
    'attendance', coalesce((select jsonb_agg(to_jsonb(t) order by t.att_date) from attendance t
                            where t.student_id in (select id from st) and t.deleted_at is null and t.att_date between p_from and p_to), '[]'::jsonb),
    'lessons', coalesce((select jsonb_agg(to_jsonb(l) order by l.lesson_date) from circle_lessons l
                         where l.circle_id in (select circle_id from st) and l.deleted_at is null and l.lesson_date between p_from and p_to), '[]'::jsonb),
    'activities', coalesce((select jsonb_agg(to_jsonb(v) order by v.activity_date) from activities v
                            where (v.circle_id is null or v.circle_id in (select circle_id from st)) and v.deleted_at is null
                              and v.activity_date between p_from and p_to), '[]'::jsonb),
    'exams', coalesce((select jsonb_agg(to_jsonb(x) order by x.exam_date) from exams x
                       where x.student_id in (select id from st) and x.deleted_at is null and x.exam_date between p_from and p_to), '[]'::jsonb));
$$;
create function public.save_talqeen_session(p_session jsonb, p_entries jsonb) returns void language plpgsql set search_path = public, private as $$
declare
  v_id uuid := (p_session ->> 'id')::uuid;
  v_date date := coalesce((p_session ->> 'session_date')::date, current_date);
  v_edited timestamptz := coalesce((p_session ->> 'edited_at')::timestamptz, now());
  v_deleted timestamptz := (p_session ->> 'deleted_at')::timestamptz;
begin
  if not private.is_staff() then raise exception 'غير مصرّح'; end if;
  insert into talqeen_sessions as t (id, circle_id, session_date, from_surah_no, from_ayah, to_surah_no, to_ayah, notes, edited_at, deleted_at)
  values (v_id, (p_session ->> 'circle_id')::uuid, v_date, (p_session ->> 'from_surah_no')::int, (p_session ->> 'from_ayah')::int,
          (p_session ->> 'to_surah_no')::int, (p_session ->> 'to_ayah')::int, nullif(p_session ->> 'notes', ''), v_edited, v_deleted)
  on conflict (id) do update set circle_id = excluded.circle_id, session_date = excluded.session_date, from_surah_no = excluded.from_surah_no,
    from_ayah = excluded.from_ayah, to_surah_no = excluded.to_surah_no, to_ayah = excluded.to_ayah, notes = excluded.notes,
    edited_at = excluded.edited_at, deleted_at = excluded.deleted_at;
  if not exists (select 1 from talqeen_sessions where id = v_id and edited_at = v_edited) then return; end if;
  if v_deleted is not null then p_entries := '[]'::jsonb; end if;
  insert into quran_entries as q (id, student_id, entry_date, track, from_surah_no, from_ayah, to_surah_no, to_ayah, quality, notes, talqeen_session_id, edited_at, deleted_at)
  select (e ->> 'id')::uuid, (e ->> 'student_id')::uuid, v_date, 'TALQEEN', t.from_surah_no, t.from_ayah, t.to_surah_no, t.to_ayah,
         nullif(e ->> 'quality', ''), nullif(e ->> 'notes', ''), v_id, v_edited, null
  from jsonb_array_elements(p_entries) e cross join talqeen_sessions t where t.id = v_id
  on conflict (id) do update set student_id = excluded.student_id, entry_date = excluded.entry_date, from_surah_no = excluded.from_surah_no,
    from_ayah = excluded.from_ayah, to_surah_no = excluded.to_surah_no, to_ayah = excluded.to_ayah, quality = excluded.quality,
    notes = excluded.notes, edited_at = excluded.edited_at, deleted_at = null;
  update quran_entries set deleted_at = now(), edited_at = v_edited
  where talqeen_session_id = v_id and deleted_at is null and id not in (select (e ->> 'id')::uuid from jsonb_array_elements(p_entries) e);
  insert into attendance as a (student_id, att_date, status, edited_at)
  select (e ->> 'student_id')::uuid, v_date, 'PRESENT', v_edited from jsonb_array_elements(p_entries) e
  on conflict (student_id, att_date) do update set status = 'PRESENT', deleted_at = null, edited_at = greatest(a.edited_at, excluded.edited_at)
  where a.status = 'ABSENT' or a.deleted_at is not null;
end $$;

-- ---------------------------------------------------------------- triggers (as in production)
create trigger trg_profiles_deleted_by before insert or update on public.profiles for each row execute function private.stamp_deleted_by();
create trigger trg_audit after insert or delete or update on public.profiles for each row execute function private.audit_row('id');
create trigger trg_circles_deleted_by before insert or update on public.circles for each row execute function private.stamp_deleted_by();
create trigger trg_circles_sync before insert or update on public.circles for each row execute function private.sync_touch();
create trigger trg_audit after insert or delete or update on public.circles for each row execute function private.audit_row('id');
create trigger trg_students_deleted_by before insert or update on public.students for each row execute function private.stamp_deleted_by();
create trigger trg_students_guard before insert or update on public.students for each row execute function private.guard_student_archive();
create trigger trg_students_guardian_link after insert on public.students for each row execute function private.create_guardian_link();
create trigger trg_students_sync before insert or update on public.students for each row execute function private.sync_touch();
create trigger trg_students_transfer after update of circle_id on public.students for each row execute function private.record_student_transfer();
create trigger trg_audit after insert or delete or update on public.students for each row execute function private.audit_row('id');
create trigger trg_quran_entries_creator before insert or update on public.quran_entries for each row execute function private.set_creator();
create trigger trg_quran_entries_sync before insert or update on public.quran_entries for each row execute function private.sync_touch();
create trigger trg_audit after insert or delete or update on public.quran_entries for each row execute function private.audit_row('id');
create trigger trg_attendance_creator before insert or update on public.attendance for each row execute function private.set_creator();
create trigger trg_attendance_sync before insert or update on public.attendance for each row execute function private.sync_touch();
create trigger trg_audit after insert or delete or update on public.attendance for each row execute function private.audit_row('student_id', 'att_date');
create trigger trg_arabic_books_sync before insert or update on public.arabic_books for each row execute function private.sync_touch();
create trigger trg_edu_notes_creator before insert or update on public.edu_notes for each row execute function private.set_creator();
create trigger trg_edu_notes_sync before insert or update on public.edu_notes for each row execute function private.sync_touch();
create trigger trg_ranking_settings_touch before update on public.ranking_settings for each row execute function private.ranking_settings_touch();

-- ---------------------------------------------------------------- RLS (as in production)
do $$ declare t text; begin
  foreach t in array array['circle_lessons','exams','activities','ranking_settings','registration_requests','student_transfers',
    'guardian_links','profiles','circles','quran_surahs','report_sends','students','audit_log','quran_entries','talqeen_sessions',
    'attendance','student_arabic_enrollments','edu_notes','arabic_books','arabic_entries','user_settings'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('grant select, insert, update on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
  end loop;
end $$;
grant execute on all functions in schema private to authenticated, anon, service_role;

create policy quran_surahs_select on public.quran_surahs for select to authenticated using (true);
create policy profiles_select on public.profiles for select to authenticated using (private.is_staff() or id = (select auth.uid()));
create policy profiles_update on public.profiles for update to authenticated using (private.is_admin()) with check (private.is_admin());
create policy circles_select on public.circles for select to authenticated using (private.is_staff());
create policy circles_insert on public.circles for insert to authenticated with check (private.is_admin());
create policy circles_update on public.circles for update to authenticated using (private.is_admin()) with check (private.is_admin());
create policy arabic_books_select on public.arabic_books for select to authenticated using (private.is_staff());
create policy arabic_books_insert on public.arabic_books for insert to authenticated with check (private.is_admin());
create policy arabic_books_update on public.arabic_books for update to authenticated using (private.is_admin()) with check (private.is_admin());
create policy ranking_settings_select on public.ranking_settings for select to authenticated using (private.is_staff());
create policy ranking_settings_update on public.ranking_settings for update to authenticated using (private.is_admin()) with check (private.is_admin());
create policy registration_requests_select on public.registration_requests for select to authenticated using (private.is_admin());
create policy audit_log_select on public.audit_log for select to authenticated using (private.is_admin());
create policy guardian_links_select on public.guardian_links for select to authenticated using (private.is_staff());
create policy student_transfers_select on public.student_transfers for select to authenticated using (private.is_staff());
create policy user_settings_select on public.user_settings for select to authenticated using (user_id = (select auth.uid()));
create policy user_settings_insert on public.user_settings for insert to authenticated with check (user_id = (select auth.uid()) and private.is_staff());
create policy user_settings_update on public.user_settings for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()) and private.is_staff());
do $$ declare t text; begin
  foreach t in array array['students','talqeen_sessions','quran_entries','attendance','student_arabic_enrollments','arabic_entries',
    'edu_notes','circle_lessons','activities','report_sends','exams'] loop
    execute format('create policy %I on public.%I for select to authenticated using (private.is_staff())', t || '_select', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (private.is_staff())', t || '_insert', t);
    execute format('create policy %I on public.%I for update to authenticated using (private.is_staff()) with check (private.is_staff())', t || '_update', t);
  end loop;
end $$;

create view public.student_progress with (security_invoker = true) as
  select s.id as student_id, s.name, s.circle_id from public.students s;
grant select on public.student_progress to authenticated;
