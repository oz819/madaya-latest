"use client";

import { useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { normalizePhone } from "@/lib/guardian";
import { SECTION_LABEL, SECTIONS, type Section } from "@/lib/filter";

const EMPTY = { name: "", age: "", section: "" as Section | "", guardianName: "", phone: "", memorized: "", website: "" };

export default function RegisterForm({ centerSlug }: { centerSlug: string }) {
  const [supabase] = useState(() => createClient());
  const [f, setF] = useState(EMPTY);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState("");
  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setF({ ...f, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const name = f.name.trim();
    if (name.length < 2) return setError("اكتبوا اسم الطالب");
    const age = f.age.trim() ? Number(f.age.replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 0x660))) : null;
    if (age !== null && !(Number.isInteger(age) && age >= 3 && age <= 80)) return setError("العمر غير صحيح");
    if (!f.section) return setError("اختاروا القسم");
    const phone = normalizePhone(f.phone);
    if (!phone) return setError("رقم ولي الأمر غير صحيح، مثلًا 0912345678");
    if (!navigator.onLine) return setError("لا يوجد اتصال بالإنترنت");
    setBusy(true);
    const { error } = await supabase.rpc("submit_registration", {
      p_student_name: name,
      p_age: age,
      p_section: f.section,
      p_guardian_name: f.guardianName.trim() || null,
      p_guardian_phone: phone,
      p_memorized: f.memorized.trim() || null,
      p_trap: f.website || null,
      p_center: centerSlug,
    });
    setBusy(false);
    if (error) return setError(/[ء-ي]/.test(error.message) ? error.message : "تعذّر الإرسال، حاولوا مرة أخرى");
    setSent(name);
    setF(EMPTY);
  }

  if (sent) {
    return (
      <div className="card center register-done">
        <h2>✅ وصلنا طلب تسجيل {sent}</h2>
        <p>جزاكم الله خيرًا. ستتواصل إدارة المركز معكم على رقم واتساب قريبًا إن شاء الله.</p>
        <button className="secondary" onClick={() => setSent("")}>
          تسجيل طالب آخر
        </button>
      </div>
    );
  }

  return (
    <form className="card register-form" onSubmit={submit} noValidate>
      <h2>📝 تسجيل طالب جديد في حلقات القرآن</h2>
      <p className="muted">املؤوا البيانات، وتتواصل إدارة المركز معكم لتحديد الحلقة.</p>
      <label>
        اسم الطالب الثلاثي *
        <input value={f.name} onChange={set("name")} maxLength={100} autoComplete="off" required />
      </label>
      <div className="register-row">
        <label>
          العمر
          <input value={f.age} onChange={set("age")} inputMode="numeric" maxLength={2} placeholder="مثلًا 10" />
        </label>
        <label>
          القسم *
          <select value={f.section} onChange={set("section")} required>
            <option value="">اختر</option>
            {SECTIONS.map((s) => (
              <option key={s} value={s}>
                {SECTION_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label>
        اسم ولي الأمر
        <input value={f.guardianName} onChange={set("guardianName")} maxLength={100} />
      </label>
      <label>
        رقم واتساب ولي الأمر *
        <input value={f.phone} onChange={set("phone")} type="tel" inputMode="tel" dir="ltr" maxLength={20} placeholder="0912345678" />
      </label>
      <label>
        ماذا يحفظ من القرآن؟
        <textarea value={f.memorized} onChange={set("memorized")} maxLength={300} rows={2} placeholder="مثلًا: جزء عمّ، أو لا شيء بعد" />
      </label>
      {/* Hidden from people; programs that fill every field fill this one too. */}
      <label className="hp-field" aria-hidden="true">
        الموقع
        <input value={f.website} onChange={set("website")} tabIndex={-1} autoComplete="off" />
      </label>
      {error && <p className="error-text">{error}</p>}
      <button type="submit" disabled={busy}>
        {busy ? "جارٍ الإرسال..." : "إرسال الطلب"}
      </button>
    </form>
  );
}
