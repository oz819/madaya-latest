// Made-up data for the public demo: Madaya (with fake students) and a second centre in Doha, so
// the multi-centre isolation can be tried. Nothing here is real.

export const DEMO_PASSWORD = "demo1234";
export const DEMO_CODE = "123456";

const U = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
export const DEMO_USERS = {
  admin: { id: U(1), email: "admin@demo.com", name: "مدير مضايا (تجريبي)" },
  teacher: { id: U(2), email: "teacher@demo.com", name: "معلّمة تجريبية" },
  doha: { id: U(3), email: "doha@demo.com", name: "صاحب مركز الدوحة" },
  both: { id: U(4), email: "both@demo.com", name: "معلّم في مركزين" },
  super: { id: U(5), email: "super@demo.com", name: "إدارة المنصة" },
};
const DOHA = "00000000-0000-4000-8000-00000000d0a1";
const MADAYA = "00000000-0000-4000-8000-00000000a001";

const boys = ["أحمد", "محمد", "عمر", "يوسف", "خالد", "حمزة", "أنس", "زيد", "معاذ", "إبراهيم", "عبد الله", "سليمان", "مصعب", "بلال", "طارق"];
const girls = ["مريم", "فاطمة", "سارة", "آمنة", "رقية", "هاجر", "سمية", "أسماء", "زينب", "حفصة", "نور", "جنى", "لين", "رهف", "تسنيم"];
const families = ["الخطيب", "الحسن", "السيد", "العلي", "الأحمد", "النجار", "الشامي", "يوسف", "حمدان", "سليمان"];
const q = (s: string) => `'${s.replace(/'/g, "''")}'`;

export function seedSql(): string {
  const u = DEMO_USERS;
  const out: string[] = [];
  out.push(`insert into auth.users (id, email, raw_user_meta_data) values
    ${Object.values(u).map((x) => `(${q(x.id)}, ${q(x.email)}, jsonb_build_object('name', ${q(x.name)}))`).join(",\n    ")};`);
  out.push(`insert into public.centers (id, slug, name, country, city, about, whatsapp, contact_email, palette, status, plan, onboarded, owner_id, trial_ends_at)
    values (${q(DOHA)}, 'doha', 'مركز الدوحة لتحفيظ القرآن (تجريبي)', 'قطر', 'الدوحة',
      'مركز تجريبي ثانٍ على المنصة لتجربة عزل البيانات بين المراكز: لا يرى طلاب مضايا ولا ترى مضايا طلابه.',
      '97455555555', 'info@doha.demo', 'navy', 'TRIAL', 'FREE', true, ${q(u.doha.id)}, now() + interval '30 days');
    insert into public.ranking_settings (center_id) values (${q(DOHA)});`);
  out.push(`insert into public.app_users (id, name, current_center_id) values
    (${q(u.admin.id)}, ${q(u.admin.name)}, ${q(MADAYA)}), (${q(u.teacher.id)}, ${q(u.teacher.name)}, ${q(MADAYA)}),
    (${q(u.doha.id)}, ${q(u.doha.name)}, ${q(DOHA)}), (${q(u.both.id)}, ${q(u.both.name)}, ${q(MADAYA)}),
    (${q(u.super.id)}, ${q(u.super.name)}, null);`);
  out.push(`insert into public.platform_admins (user_id) values (${q(u.super.id)});`);
  out.push(`update public.centers set extra_notes = 'هذه نسخة تجريبية ببيانات وهمية. ادخل بالبريد admin@demo.com والكود 123456 (أو كلمة المرور demo1234).' where id = ${q(MADAYA)};`);
  out.push(`insert into public.memberships (user_id, center_id, name, role, is_owner, default_filter) values
    (${q(u.admin.id)}, ${q(MADAYA)}, ${q(u.admin.name)}, 'ADMIN', true, null),
    (${q(u.teacher.id)}, ${q(MADAYA)}, ${q(u.teacher.name)}, 'TEACHER', false, 's:FEMALE'),
    (${q(u.doha.id)}, ${q(DOHA)}, ${q(u.doha.name)}, 'ADMIN', true, null),
    (${q(u.both.id)}, ${q(MADAYA)}, ${q(u.both.name)}, 'TEACHER', false, null),
    (${q(u.both.id)}, ${q(DOHA)}, ${q(u.both.name)}, 'TEACHER', false, null);`);

  // Madaya: three circles and thirty students with a little history; Doha: one circle.
  const C = (n: number) => `c0000000-0000-4000-8000-00000000000${n}`;
  out.push(`insert into public.circles (id, name, section, center_id) values
    (${q(C(1))}, 'حلقة أبي بكر الصدّيق', 'MALE', ${q(MADAYA)}), (${q(C(2))}, 'حلقة عمر بن الخطاب – متقدم', 'MALE', ${q(MADAYA)}),
    (${q(C(3))}, 'حلقة خديجة أم المؤمنين', 'FEMALE', ${q(MADAYA)}), (${q(C(4))}, 'حلقة الفجر', 'MALE', ${q(DOHA)});`);
  const students: string[] = [];
  const entries: string[] = [];
  const att: string[] = [];
  for (let i = 0; i < 30; i++) {
    const boy = i < 15;
    const id = `50000000-0000-4000-8000-${String(i).padStart(12, "0")}`;
    const circle = boy ? (i < 10 ? C(1) : C(2)) : C(3);
    students.push(`(${q(id)}, ${q(`${boy ? boys[i] : girls[i - 15]} ${families[i % 10]}`)}, ${q(circle)}, ${q(MADAYA)}, ${q("0991" + String(100000 + i))})`);
    const surah = 114 - (i % 12);
    for (let d = 1; d <= 6; d++) {
      entries.push(`(${q(id)}, current_date - ${d * 2}, 'HIFZ', ${surah - d}, 1, ${surah - d}, 5, ${q(["ممتاز", "جيد جدًا", "جيد"][(i + d) % 3])}, ${q(MADAYA)})`);
      att.push(`(${q(id)}, current_date - ${d}, ${q((i + d) % 7 === 0 ? "ABSENT" : "PRESENT")}, ${q(MADAYA)})`);
    }
  }
  for (let i = 0; i < 8; i++) {
    const id = `5000d000-0000-4000-8000-${String(i).padStart(12, "0")}`;
    students.push(`(${q(id)}, ${q(`${boys[(i + 5) % 15]} ${["الكواري", "المري", "الهاجري", "السليطي"][i % 4]}`)}, ${q(C(4))}, ${q(DOHA)}, null)`);
    entries.push(`(${q(id)}, current_date - 1, 'HIFZ', 78, 1, 78, 10, 'ممتاز', ${q(DOHA)})`);
  }
  out.push(`insert into public.students (id, name, circle_id, center_id, guardian_phone) values ${students.join(",\n")};`);
  out.push(`set app.migrating = 'on';
    insert into public.quran_entries (student_id, entry_date, track, from_surah_no, from_ayah, to_surah_no, to_ayah, quality, center_id) values ${entries.join(",\n")};
    insert into public.attendance (student_id, att_date, status, center_id) values ${att.join(",\n")};
    reset app.migrating;`);
  out.push(`insert into public.registration_requests (student_name, age, section, guardian_name, guardian_phone, center_id) values
    ('طالب جديد من النموذج', 9, 'MALE', 'أبو محمد', '0990000001', ${q(MADAYA)}),
    ('طالبة جديدة', 11, 'FEMALE', 'أم سارة', '0990000002', ${q(MADAYA)});`);
  out.push(`update public.ranking_settings set honor_enabled = true where center_id = ${q(MADAYA)};`);
  return out.join("\n");
}
