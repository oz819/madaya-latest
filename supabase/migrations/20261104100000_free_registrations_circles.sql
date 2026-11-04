-- 2026-11-04: (1) the platform is free — no trial period and no student limit; (2) the public
-- registration form is hardened (clean text, phone normalised on the server, duplicate requests
-- ignored, per-centre and platform-wide flood limits, each centre can close its form, a request is
-- accepted only into a halaqa of its section); (3) a halaqa and its students are created in one
-- step (one transaction), for the onboarding wizard and الإدارة.
-- Additive on top of 20261101100000_multi_center.sql.

-- ============================================================== (1) free: no trial, no limits
drop trigger if exists trg_students_plan_limit on public.students;
drop function if exists private.check_student_limit();
drop function if exists private.plan_student_limit(text);

alter table public.centers alter column status set default 'ACTIVE';
update public.centers set status = 'ACTIVE', trial_ends_at = null where status = 'TRIAL';
update public.centers set trial_ends_at = null where trial_ends_at is not null;

create or replace function public.create_center(p_name text, p_slug text, p_country text, p_city text, p_owner_name text,
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
          nullif(btrim(p_phone), ''), coalesce(nullif(p_palette, ''), 'indigo'), v_uid, 'ACTIVE', 'FREE', null)
  returning id into v_id;

  insert into public.app_users (id, name) values (v_uid, btrim(p_owner_name))
  on conflict (id) do nothing;
  insert into public.memberships (user_id, center_id, name, role, is_owner) values (v_uid, v_id, btrim(p_owner_name), 'ADMIN', true);
  insert into public.ranking_settings (center_id) values (v_id);
  update public.app_users set current_center_id = v_id where id = v_uid;
  return jsonb_build_object('id', v_id, 'slug', v_slug);
end $$;


-- ============================================================== (2) registration requests
-- Each centre may close its public form (e.g. when the halaqat are full).
alter table public.centers add column if not exists registrations_open boolean not null default true;
grant update (registrations_open) on public.centers to authenticated;

-- public_center tells the form whether it is open.
create or replace function public.public_center(p_slug text default null, p_domain text default null) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('id', c.id, 'slug', c.slug, 'name', c.name, 'country', c.country, 'city', c.city,
    'logo_url', c.logo_url, 'palette', c.palette, 'primary_color', c.primary_color, 'about', c.about,
    'contact_phone', c.contact_phone, 'contact_email', c.contact_email, 'whatsapp', c.whatsapp,
    'instagram', c.instagram, 'facebook', c.facebook, 'address', c.address, 'locale', c.locale, 'extra_notes', c.extra_notes,
    'registrations_open', c.registrations_open,
    'honor_enabled', coalesce((select r.honor_enabled from public.ranking_settings r where r.center_id = c.id), false))
  from public.centers c
  where c.status <> 'SUSPENDED'
    and ((p_slug is not null and c.slug = lower(p_slug)) or (p_slug is null and p_domain is not null and c.domain = lower(p_domain)))
  limit 1
$$;

-- Text typed by the public: no control, zero-width or direction-override characters (they can hide
-- or reverse what the admin reads), no markup, spaces collapsed. Null when nothing is left.
create or replace function private.clean_text(p text) returns text language sql immutable set search_path = '' as $$
  select nullif(btrim(regexp_replace(
           regexp_replace(coalesce(p, ''), '[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁦-⁩﻿<>]', ' ', 'g'),
           '\s+', ' ', 'g')), '')
$$;

-- A phone as typed → international digits (like lib/guardian.ts normalizePhone): Arabic digits,
-- spaces, "+", "00" prefix; a local 10-digit 09… number is Syrian (963). Null if it can't be one.
create or replace function private.normalize_phone(p text) returns text language plpgsql immutable set search_path = '' as $$
declare
  d text := regexp_replace(translate(coalesce(p, ''), '٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹', '01234567890123456789'), '[^0-9]', '', 'g');
begin
  if d like '00%' then
    d := substr(d, 3);
  elsif d like '0%' and length(d) = 10 then
    d := '963' || substr(d, 2);
  end if;
  return case when d ~ '^[0-9]{7,15}$' then d end;
end $$;

-- Requests can only come in through submit_registration and change through the admin functions.
revoke insert, update, delete, truncate on public.registration_requests from anon, authenticated;
revoke all on public.registration_requests from anon;

drop function if exists public.submit_registration(text, integer, text, text, text, text, text, text);
create function public.submit_registration(p_student_name text, p_age integer, p_section text, p_guardian_name text,
                                           p_guardian_phone text, p_memorized text, p_trap text default null,
                                           p_center text default null)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  v_name text := private.clean_text(p_student_name);
  v_guardian text := private.clean_text(p_guardian_name);
  v_memorized text := private.clean_text(p_memorized);
  v_phone text := private.normalize_phone(p_guardian_phone);
  v_center public.centers;
begin
  -- A program that filled the hidden field: say "received" so it learns nothing.
  if coalesce(p_trap, '') <> '' then
    return true;
  end if;
  select * into v_center from public.centers
  where slug = lower(coalesce(nullif(btrim(p_center), ''), 'madaya')) and status <> 'SUSPENDED';
  if v_center.id is null then
    raise exception 'المركز غير موجود';
  end if;
  if not v_center.registrations_open then
    raise exception 'التسجيل مغلق حاليًا في هذا المركز. تواصلوا مع الإدارة';
  end if;
  if v_name is null or char_length(v_name) < 2 or char_length(v_name) > 100 then
    raise exception 'اكتبوا اسم الطالب (من حرفين إلى 100 حرف)';
  end if;
  if v_name ~ '[0-9٠-٩@/\\{}\[\]|$%^*=]' or v_name ~* '(https?|www\.)' then
    raise exception 'اسم الطالب: حروف فقط';
  end if;
  if p_age is not null and (p_age < 3 or p_age > 80) then
    raise exception 'العمر غير صحيح';
  end if;
  if p_section is null or p_section not in ('MALE', 'FEMALE') then
    raise exception 'اختاروا القسم';
  end if;
  if v_phone is null then
    raise exception 'رقم ولي الأمر غير صحيح';
  end if;
  if char_length(coalesce(v_guardian, '')) > 100 or char_length(coalesce(v_memorized, '')) > 300 then
    raise exception 'النص طويل جدًا';
  end if;
  if v_memorized ~* '(https?://|www\.)' or v_guardian ~* '(https?://|www\.)' then
    raise exception 'لا تضعوا روابط في الطلب';
  end if;

  -- The same child sent twice (a double tap, or sent again later): keep the first, say "received".
  if exists (select 1 from public.registration_requests
             where center_id = v_center.id and status = 'PENDING' and guardian_phone = v_phone
               and lower(student_name) = lower(v_name)) then
    return true;
  end if;
  -- Floods: a few requests per number a day, a cap per centre per hour and on the whole platform.
  if (select count(*) from public.registration_requests
      where guardian_phone = v_phone and created_at > now() - interval '1 day') >= 5 then
    raise exception 'وصلتنا طلبات كثيرة من هذا الرقم اليوم. سنتواصل معكم قريبًا إن شاء الله';
  end if;
  if (select count(*) from public.registration_requests where center_id = v_center.id and created_at > now() - interval '1 hour') >= 60
     or (select count(*) from public.registration_requests where created_at > now() - interval '1 hour') >= 600 then
    raise exception 'الخدمة مشغولة الآن، حاولوا بعد قليل';
  end if;

  insert into public.registration_requests (student_name, age, section, guardian_name, guardian_phone, memorized, center_id)
  values (v_name, p_age, p_section, v_guardian, v_phone, v_memorized, v_center.id);
  return true;
end $$;
revoke all on function public.submit_registration(text, integer, text, text, text, text, text, text) from public;
grant execute on function public.submit_registration(text, integer, text, text, text, text, text, text) to anon, authenticated;

-- Accept into a halaqa of the centre, of the same section as the request (a halaqa with no section
-- takes anyone).
create or replace function public.admin_accept_registration(p_id uuid, p_circle_id uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_center uuid := private.current_center_id();
  v_req public.registration_requests;
  v_circle public.circles;
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
  select * into v_circle from public.circles where id = p_circle_id and center_id = v_center and active and deleted_at is null;
  if v_circle.id is null then
    raise exception 'اختر حلقة';
  end if;
  if v_circle.section is not null and v_circle.section <> v_req.section then
    raise exception 'الحلقة «%» ليست من قسم الطلب', v_circle.name;
  end if;
  insert into public.students (name, circle_id, guardian_name, guardian_phone, center_id)
  values (v_req.student_name, p_circle_id, v_req.guardian_name, v_req.guardian_phone, v_center)
  returning id into v_student;
  update public.registration_requests
  set status = 'ACCEPTED', decided_at = now(), decided_by = auth.uid(), student_id = v_student
  where id = p_id;
  return v_student;
end $$;
revoke all on function public.admin_accept_registration(uuid, uuid) from public, anon;
grant execute on function public.admin_accept_registration(uuid, uuid) to authenticated;

-- ============================================================== (3) a halaqa with its students, at once
-- Names: a JSON array of strings, one per line as typed (cleaned, 2–100 letters, duplicates dropped), at most 300.
-- Returns the new halaqa's id and how many students were added. All or nothing.
create or replace function public.admin_create_circle(p_name text, p_section text default null, p_students jsonb default '[]')
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_center uuid := private.current_center_id();
  v_name text := private.clean_text(p_name);
  v_circle uuid;
  v_count int;
begin
  if not private.is_admin() then
    raise exception 'إنشاء الحلقات متاح للمدير فقط';
  end if;
  if v_name is null or char_length(v_name) > 100 then
    raise exception 'اكتب اسم الحلقة';
  end if;
  if p_section is not null and p_section not in ('MALE', 'FEMALE') then
    raise exception 'القسم غير صحيح';
  end if;
  if p_students is not null and jsonb_typeof(p_students) <> 'array' then
    raise exception 'قائمة الطلاب غير صحيحة';
  end if;
  if jsonb_array_length(coalesce(p_students, '[]')) > 300 then
    raise exception 'الحد 300 اسم في المرة الواحدة';
  end if;
  if exists (select 1 from public.circles where center_id = v_center and lower(btrim(name)) = lower(v_name)) then
    raise exception 'يوجد حلقة بهذا الاسم (ربما في سجل المحذوفات — استرجعها من هناك)';
  end if;

  insert into public.circles (name, section, center_id) values (v_name, p_section, v_center) returning id into v_circle;

  insert into public.students (name, circle_id, center_id)
  select n, v_circle, v_center
  from (select distinct on (lower(n)) n, o
        from (select private.clean_text(x) n, o from jsonb_array_elements_text(coalesce(p_students, '[]')) with ordinality as t(x, o)) a
        where n is not null and char_length(n) between 2 and 100
        order by lower(n), o) b
  order by o;
  get diagnostics v_count = row_count;
  return jsonb_build_object('id', v_circle, 'students', v_count);
end $$;
revoke all on function public.admin_create_circle(text, text, jsonb) from public, anon;
grant execute on function public.admin_create_circle(text, text, jsonb) to authenticated;

revoke all on function private.clean_text(text), private.normalize_phone(text) from public;
grant execute on function private.clean_text(text), private.normalize_phone(text) to authenticated, anon, service_role;
