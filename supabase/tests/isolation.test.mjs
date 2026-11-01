// Isolation and permission tests for the multi-centre migration, on a real Postgres (PGlite, in
// process, no network). Loads the production schema snapshot, fills it like Madaya today, applies
// the new migration(s), then checks that no centre can see or touch another centre's data.
//
//   node supabase/tests/isolation.test.mjs
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(here, "..", "migrations");
const NEW_MIGRATIONS = readdirSync(migrationsDir).filter((f) => f >= "20261101").sort();

const MADAYA = "00000000-0000-4000-8000-00000000a001";
const U = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const ADMIN = U(1), TEACHER = U(2), OWNER_B = U(3), BOTH = U(4), STRANGER = U(5), SUPER = U(6), TEACHER_B = U(7);

let passed = 0, failed = 0;
function ok(cond, name) {
  if (cond) { passed++; console.log("  ✓", name); }
  else { failed++; console.log("  ✗", name); }
}

export async function setup() {
  const db = new PGlite();
  await db.exec(readFileSync(join(here, "auth_stub.sql"), "utf8"));
  await db.exec(readFileSync(join(here, "base_schema.sql"), "utf8"));
  // Madaya as it is today (before the migration).
  await db.exec(`
    insert into auth.users (id, email) values
      ('${ADMIN}', 'admin@madaya.test'), ('${TEACHER}', 'teacher@madaya.test'), ('${OWNER_B}', 'owner@qatar.test'),
      ('${BOTH}', 'both@test.test'), ('${STRANGER}', 'nobody@test.test'), ('${SUPER}', 'osamazaedsefalden@gmail.com'),
      ('${TEACHER_B}', 'teacher@qatar.test');
    insert into public.quran_surahs select g, 'سورة ' || g, 50 from generate_series(1, 114) g;
    insert into public.profiles (id, name, role) values ('${ADMIN}', 'مدير مضايا', 'ADMIN'), ('${TEACHER}', 'محفظ مضايا', 'TEACHER');
    insert into public.circles (id, name, section) values ('${U(100)}', 'حلقة أبي بكر', 'MALE'), ('${U(101)}', 'حلقة خديجة', 'FEMALE');
    insert into public.students (id, name, circle_id, guardian_phone) values
      ('${U(200)}', 'أحمد', '${U(100)}', '0991234567'), ('${U(201)}', 'مريم', '${U(101)}', null);
    insert into public.quran_entries (student_id, track, from_surah_no, from_ayah, to_surah_no, to_ayah) values ('${U(200)}', 'HIFZ', 1, 1, 1, 7);
    insert into public.attendance (student_id, att_date, status) values ('${U(200)}', current_date, 'PRESENT');
    insert into public.arabic_books (id, title, total_pages) values ('${U(300)}', 'الرشيدي', 120);
    insert into public.registration_requests (id, student_name, section, guardian_phone) values ('${U(400)}', 'طالب جديد', 'MALE', '0990000000');
    insert into public.user_settings (user_id, filter) values ('${ADMIN}', 'all');
  `);
  const before = (await db.query("select count(*)::int n from public.audit_log")).rows[0].n;
  for (const f of NEW_MIGRATIONS) await db.exec(readFileSync(join(migrationsDir, f), "utf8"));
  return { db, auditBefore: before };
}

// Run a query as a signed-in user (or anon when uid is null), like PostgREST does.
async function as(db, uid, sql, params = []) {
  await db.query(`select set_config('request.jwt.claims', $1, false)`, [uid ? JSON.stringify({ sub: uid, role: "authenticated" }) : ""]);
  await db.exec(uid ? "set role authenticated" : "set role anon");
  try {
    return await db.query(sql, params);
  } finally {
    await db.exec("reset role");
  }
}
async function fails(db, uid, sql, params = []) {
  try {
    await as(db, uid, sql, params);
    return false;
  } catch (e) {
    return e.message || true;
  }
}
const rows = async (db, uid, sql, params) => (await as(db, uid, sql, params)).rows;
const one = async (db, uid, sql, params) => (await rows(db, uid, sql, params))[0];

async function main() {
  const { db, auditBefore } = await setup();

  console.log("ترحيل بيانات مضايا");
  const tables = ["circles", "students", "quran_entries", "attendance", "arabic_books", "registration_requests", "ranking_settings",
    "guardian_links", "user_settings", "audit_log"];
  for (const t of tables) {
    const r = (await db.query(`select count(*) filter (where center_id is distinct from '${MADAYA}')::int bad, count(*)::int n from public.${t}`)).rows[0];
    ok(r.bad === 0 && (t === "audit_log" || r.n > 0), `${t}: ${r.n} صف كلها لمضايا`);
  }
  ok((await db.query("select count(*)::int n from public.audit_log")).rows[0].n === auditBefore, "الترحيل لم يكتب سجلات تعديل جديدة");
  ok((await db.query("select count(*)::int n from public.memberships")).rows[0].n === 2, "صار للمستخدمَين عضوية في مضايا");
  ok((await db.query(`select count(*)::int n from public.platform_admins where user_id = '${SUPER}'`)).rows[0].n === 1, "صاحب المنصة صار مدير منصة");

  console.log("مضايا تعمل كما كانت");
  ok((await rows(db, ADMIN, "select * from public.profiles")).length === 2, "المدير يرى حسابَي المركز في profiles");
  ok((await one(db, ADMIN, "select role from public.profiles where id = $1", [ADMIN])).role === "ADMIN", "دور المدير محفوظ");
  ok((await rows(db, TEACHER, "select * from public.students")).length === 2, "المحفظ يرى طلاب مضايا");
  ok((await one(db, TEACHER, "select private.is_staff() s, private.is_admin() a")).a === false, "المحفظ ليس مديرًا");
  await as(db, TEACHER, `insert into public.attendance (student_id, att_date, status) values ('${U(201)}', current_date, 'ABSENT')`);
  ok((await one(db, ADMIN, `select center_id from public.attendance where student_id = '${U(201)}'`)).center_id === MADAYA, "سجل جديد يأخذ مركز المستخدم تلقائيًا");
  ok((await rows(db, ADMIN, "select * from public.ranking_settings where id = 1")).length === 1, "إعدادات مضايا تُقرأ كما كانت (id = 1)");
  ok((await rows(db, STRANGER, "select * from public.students")).length === 0, "حساب بلا مركز لا يرى شيئًا");
  ok((await one(db, STRANGER, "select public.my_context() c")).c.blocked === "NO_CENTER", "my_context يقول: لا مركز");

  console.log("تسجيل مركز جديد (قطر)");
  const created = (await one(db, OWNER_B, `select public.create_center('مركز الدوحة', 'doha', 'قطر', 'الدوحة', 'صاحب المركز') c`)).c;
  const B = created.id;
  ok(!!B && created.slug === "doha", "create_center أنشأ المركز");
  const ctxB = (await one(db, OWNER_B, "select public.my_context() c")).c;
  ok(ctxB.center.id === B && ctxB.membership.role === "ADMIN" && ctxB.membership.is_owner, "صاحب البريد صار مدير المركز (Owner)");
  ok(ctxB.center.status === "TRIAL" && ctxB.center.plan === "FREE", "المركز الجديد في فترة تجربة على الخطة المجانية");
  ok(!!(await fails(db, OWNER_B, `select public.create_center('x', 'madaya', 'a', 'b', 'c')`)), "لا يمكن أخذ رابط مستخدم");
  ok(!!(await fails(db, OWNER_B, `select public.create_center('x', 'login', 'a', 'b', 'c')`)), "لا يمكن أخذ رابط محجوز");
  await db.exec(`insert into auth.users (id, email, email_confirmed_at) values ('${U(9)}', 'unconfirmed@test.test', null)`);
  ok(!!(await fails(db, U(9), `select public.create_center('x', 'xyz', 'a', 'b', 'c')`)), "لا مركز قبل تأكيد البريد");
  ok((await rows(db, OWNER_B, "select * from public.students")).length === 0, "المركز الجديد لا يرى طلاب مضايا");
  ok((await rows(db, OWNER_B, "select * from public.profiles")).length === 1, "ولا حسابات مضايا");
  ok((await rows(db, OWNER_B, "select * from public.ranking_settings where id = 1")).length === 1, "وله إعداداته الخاصة");
  ok((await rows(db, OWNER_B, "select * from public.arabic_books")).length === 0, "ولا كتب مضايا");
  ok((await rows(db, OWNER_B, "select * from public.registration_requests")).length === 0, "ولا طلبات تسجيل مضايا");
  ok((await rows(db, OWNER_B, "select * from public.audit_log")).every((r) => r.center_id === B), "ولا سجل تعديلات مضايا");
  ok((await rows(db, OWNER_B, "select * from public.centers")).length === 1, "ولا يرى إلا مركزه في centers");

  await as(db, OWNER_B, `insert into public.circles (id, name, section) values ('${U(110)}', 'حلقة أبي بكر', 'MALE')`);
  ok(true, "اسم حلقة مكرر مسموح بين مركزين (فريد داخل المركز فقط)");
  await as(db, OWNER_B, `insert into public.students (id, name, circle_id) values ('${U(210)}', 'عبد الله', '${U(110)}')`);
  await as(db, OWNER_B, `insert into public.arabic_books (id, title, total_pages) values ('${U(310)}', 'الرشيدي', 80)`);
  ok((await rows(db, ADMIN, `select * from public.students where id = '${U(210)}'`)).length === 0, "مضايا لا ترى طلاب الدوحة");
  ok((await rows(db, ADMIN, `select * from public.circles`)).length === 2, "ولا حلقاتها");

  console.log("محاولات الوصول عبر المراكز (يجب أن تفشل كلها)");
  ok(!!(await fails(db, OWNER_B, `insert into public.attendance (student_id, att_date, status) values ('${U(200)}', current_date, 'ABSENT')`)), "تسجيل حضور لطالب من مركز آخر");
  ok(!!(await fails(db, OWNER_B, `insert into public.students (name, circle_id) values ('دخيل', '${U(100)}')`)), "إضافة طالب في حلقة مركز آخر");
  ok(!!(await fails(db, OWNER_B, `insert into public.circles (name, center_id) values ('حلقة', '${MADAYA}')`)), "إدخال صف بـ center_id لمركز آخر");
  ok(!!(await fails(db, OWNER_B, `insert into public.quran_entries (student_id, track, from_surah_no, from_ayah, to_surah_no, to_ayah) values ('${U(200)}', 'HIFZ', 2, 1, 2, 5)`)), "إضافة حفظ لطالب مركز آخر");
  ok(!!(await fails(db, OWNER_B, `insert into public.activities (title, activity_date, student_ids) values ('نشاط', current_date, array['${U(200)}'::uuid])`)), "نشاط فيه طالب من مركز آخر");
  ok((await as(db, OWNER_B, `update public.students set name = 'x' where id = '${U(200)}'`)).affectedRows === 0, "تعديل طالب مركز آخر لا يصيب شيئًا");
  ok(!!(await fails(db, OWNER_B, `update public.students set center_id = '${MADAYA}' where id = '${U(210)}'`)), "نقل طالب إلى مركز آخر");
  ok((await as(db, OWNER_B, `update public.profiles set role = 'TEACHER' where id = '${ADMIN}'`)).affectedRows === 0, "تعديل حساب مدير مضايا لا يصيب شيئًا");
  ok((await as(db, OWNER_B, `update public.centers set name = 'x' where id = '${MADAYA}'`)).affectedRows === 0, "تعديل بيانات مركز آخر لا يصيب شيئًا");
  ok(!!(await fails(db, OWNER_B, `update public.centers set status = 'ACTIVE', plan = 'PRO' where id = '${B}'`)), "المركز لا يغيّر خطته أو حالته بنفسه");
  await as(db, OWNER_B, `select public.admin_soft_delete('student', '${U(200)}')`);
  ok((await one(db, ADMIN, `select deleted_at from public.students where id = '${U(200)}'`)).deleted_at === null, "admin_soft_delete لا يحذف طالب مركز آخر");
  await as(db, OWNER_B, `select public.admin_soft_delete('profile', '${TEACHER}')`);
  ok((await one(db, ADMIN, `select deleted_at from public.profiles where id = '${TEACHER}'`)).deleted_at === null, "ولا يحذف محفظ مركز آخر");
  ok((await rows(db, OWNER_B, "select * from public.admin_trash()")).every((r) => r.id !== U(200)), "admin_trash لا يعرض محذوفات مركز آخر");
  ok(!!(await fails(db, OWNER_B, `select public.rotate_guardian_link('${U(200)}')`)), "تغيير رابط ولي أمر طالب مركز آخر");
  ok(!!(await fails(db, OWNER_B, `select public.admin_accept_registration('${U(400)}', '${U(110)}')`)), "قبول طلب تسجيل لمركز آخر");
  ok(!!(await fails(db, OWNER_B, `select public.admin_reject_registration('${U(400)}')`)), "رفض طلب تسجيل لمركز آخر");
  ok(!!(await fails(db, OWNER_B, `select public.switch_center('${MADAYA}')`)), "الانتقال لمركز لست عضوًا فيه");
  ok((await rows(db, OWNER_B, "select * from public.sync_latest_quran_entries()")).length === 0, "sync_latest_quran_entries لا يعيد بيانات مركز آخر");
  ok((await rows(db, OWNER_B, "select * from public.student_progress")).every((r) => r.student_id === U(210)), "student_progress لا يعيد بيانات مركز آخر");
  ok((await rows(db, OWNER_B, `select * from public.app_users where id = '${ADMIN}'`)).length === 0, "app_users لا يكشف حسابات مركز آخر");
  ok(!!(await fails(db, OWNER_B, "select public.super_centers()")), "لوحة المنصة ممنوعة على غير مديري المنصة");
  ok(!!(await fails(db, OWNER_B, `select private.audit_row()`)), "دوال الخادم الداخلية غير قابلة للاستدعاء");

  console.log("الدعوات والعضوية في أكثر من مركز");
  await as(db, OWNER_B, `insert into public.center_invites (email, role, name) values ('both@test.test', 'TEACHER', 'محفظ مشترك')`);
  await as(db, ADMIN, `insert into public.center_invites (email, role) values ('both@test.test', 'TEACHER')`);
  ok((await rows(db, ADMIN, "select * from public.center_invites")).length === 1, "كل مدير يرى دعوات مركزه فقط");
  const tokB = (await db.query(`select token from public.center_invites where center_id = '${B}'`)).rows[0].token;
  const tokM = (await db.query(`select token from public.center_invites where center_id = '${MADAYA}'`)).rows[0].token;
  ok((await one(db, null, "select public.invite_info($1) i", [tokB])).i.center === "مركز الدوحة", "صفحة الدعوة تعرض اسم المركز للزائر");
  ok(!!(await fails(db, STRANGER, "select public.accept_invite($1)", [tokB])), "دعوة لبريد آخر لا تُقبل");
  await as(db, BOTH, "select public.accept_invite($1)", [tokB]);
  ok(!!(await fails(db, BOTH, "select public.accept_invite($1)", [tokB])), "رابط الدعوة يُستعمل مرة واحدة");
  await as(db, BOTH, "select public.accept_invite($1)", [tokM]);
  const ctxBoth = (await one(db, BOTH, "select public.my_context() c")).c;
  ok(ctxBoth.centers.length === 2 && ctxBoth.center.id === MADAYA, "المستخدم نفسه عضو في مركزين (آخر دعوة = المركز الحالي)");
  ok((await rows(db, BOTH, "select * from public.students")).every((s) => s.center_id === MADAYA), "يرى طلاب المركز الحالي فقط");
  await as(db, BOTH, `select public.switch_center('${B}')`);
  const seenB = await rows(db, BOTH, "select * from public.students");
  ok(seenB.length === 1 && seenB[0].center_id === B, "بعد التبديل يرى طلاب المركز الآخر فقط");
  ok((await one(db, BOTH, "select private.is_admin() a")).a === false, "محفظ في المركزين ليس مديرًا في أيّ منهما");
  ok((await as(db, BOTH, `update public.profiles set role = 'ADMIN' where id = '${BOTH}'`)).affectedRows === 0 ||
     !!(await fails(db, BOTH, `update public.profiles set role = 'ADMIN' where id = '${BOTH}'`)), "المحفظ لا يرقّي نفسه");
  await as(db, OWNER_B, `select public.admin_soft_delete('profile', '${BOTH}')`);
  ok((await db.query(`select banned_until from auth.users where id = '${BOTH}'`)).rows[0].banned_until === null, "حذفه من مركز لا يوقف حسابه في المركز الآخر");
  const ctxAfter = (await one(db, BOTH, "select public.my_context() c")).c;
  ok(ctxAfter.center.id === MADAYA, "ويرجع تلقائيًا لمركزه الباقي");

  console.log("الأدوار داخل المركز");
  ok(!!(await fails(db, OWNER_B, `update public.profiles set role = 'TEACHER' where id = '${OWNER_B}'`)), "صاحب المركز لا يُخفَّض");
  await db.exec(`insert into public.app_users (id, name) values ('${TEACHER_B}', 'محفظة الدوحة');
                 insert into public.memberships (user_id, center_id, name, role) values ('${TEACHER_B}', '${B}', 'محفظة الدوحة', 'TEACHER')`);
  ok((await as(db, TEACHER_B, `update public.profiles set active = false where id = '${OWNER_B}'`)).affectedRows === 0, "المحفظ لا يعدّل الحسابات");
  ok(!!(await fails(db, TEACHER_B, `insert into public.circles (name) values ('حلقة جديدة')`)), "المحفظ لا ينشئ حلقات");
  ok(!!(await fails(db, TEACHER_B, `insert into public.center_invites (email) values ('a@b.cd')`)), "المحفظ لا يرسل دعوات");
  ok((await as(db, TEACHER_B, `update public.centers set name = 'x'`)).affectedRows === 0, "المحفظ لا يعدّل بيانات المركز");
  ok((await as(db, OWNER_B, `update public.centers set about = 'نبذة جديدة', palette = 'navy'`)).affectedRows === 1, "مدير المركز يعدّل نبذته وهويته");

  console.log("الصفحات العامة");
  const pub = (await one(db, null, "select public.public_center('doha') c")).c;
  ok(pub.name === "مركز الدوحة" && pub.about === "نبذة جديدة" && !("plan" in pub) && !("owner_id" in pub), "public_center يعرض البيانات العامة فقط");
  ok((await one(db, null, "select public.public_center(null, 'madayacentre.com') c")).c.slug === "madaya", "النطاق madayacentre.com يفتح مضايا");
  await as(db, null, `select public.submit_registration('طالب قطري', 10, 'MALE', null, '974555555', null, null, 'doha')`);
  await as(db, null, `select public.submit_registration('طالب قديم', 10, 'MALE', null, '0995555555', null)`);
  ok((await rows(db, OWNER_B, "select * from public.registration_requests")).length === 1, "طلب التسجيل يصل للمركز المطلوب فقط");
  ok((await rows(db, ADMIN, "select * from public.registration_requests")).length === 2, "النموذج القديم بلا مركز يصل لمضايا");
  ok(!!(await fails(db, null, "select * from public.students")) || (await rows(db, null, "select * from public.students")).length === 0, "الزائر لا يقرأ الجداول");
  const tokenB = (await db.query(`select token from public.guardian_links where student_id = '${U(210)}'`)).rows[0]?.token;
  const gv = (await one(db, null, "select public.guardian_view($1) v", [tokenB])).v;
  ok(gv?.center?.name === "مركز الدوحة" && gv.student.name === "عبد الله", "رابط ولي الأمر يعرض اسم مركز الطالب");

  console.log("إدارة المنصة");
  ok((await one(db, SUPER, "select jsonb_array_length(public.super_centers()) n")).n === 2, "مدير المنصة يرى كل المراكز");
  ok((await rows(db, SUPER, "select * from public.students")).length === 0, "لكنه لا يرى بيانات المراكز اليومية");
  await as(db, SUPER, `select public.super_set_center('${B}', 'SUSPENDED')`);
  ok((await rows(db, OWNER_B, "select * from public.students")).length === 0, "المركز الموقوف لا يصل لبياناته");
  ok((await one(db, OWNER_B, "select public.my_context() c")).c.blocked === "SUSPENDED", "ويُخبَر أن المركز موقوف");
  ok((await one(db, null, "select public.public_center('doha') c")).c === null, "وصفحته العامة تختفي");
  await as(db, SUPER, `select public.super_set_center('${B}', 'ACTIVE')`);
  ok((await rows(db, OWNER_B, "select * from public.students")).length === 1, "وبعد التفعيل يرجع كل شيء");

  console.log("حدود الخطة المجانية");
  let limitErr = "";
  for (let i = 0; i < 61 && !limitErr; i++) {
    limitErr = (await fails(db, OWNER_B, `insert into public.students (name, circle_id) values ('طالب ${i}', '${U(110)}')`)) || "";
  }
  if (!/الأقصى/.test(limitErr)) console.log("    →", limitErr);
  ok(/الأقصى/.test(limitErr), "الخطة المجانية تتوقف عند 60 طالبًا");
  ok(!(await fails(db, ADMIN, `insert into public.students (name, circle_id) values ('طالب جديد', '${U(100)}')`)), "مضايا (PRO) بلا حد");

  console.log("سجل التعديلات");
  const auditB = await rows(db, OWNER_B, "select * from public.audit_log");
  ok(auditB.length > 0 && auditB.every((r) => r.center_id === B), "كل مركز له سجل تعديلاته");

  console.log("إشعارات Push");
  await as(db, ADMIN, `insert into public.push_subscriptions (endpoint, p256dh, auth) values ('https://push.example/a', 'k', 'a')`);
  ok((await rows(db, ADMIN, "select * from public.push_subscriptions")).length === 1, "الجهاز يحفظ اشتراكه");
  ok((await rows(db, TEACHER, "select * from public.push_subscriptions")).length === 0, "ولا يراه غيره ولو من نفس المركز");
  ok((await rows(db, OWNER_B, "select * from public.push_subscriptions")).length === 0, "ولا مركز آخر");
  ok(!!(await fails(db, OWNER_B, `insert into public.push_subscriptions (endpoint, p256dh, auth, user_id) values ('https://push.example/b', 'k', 'a', '${ADMIN}')`)), "لا أحد يسجّل اشتراكًا باسم غيره");

  console.log(`\n${passed} ناجح، ${failed} فاشل`);
  process.exit(failed ? 1 : 0);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
