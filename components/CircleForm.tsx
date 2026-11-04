"use client";

import { useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SECTION_LABEL, SECTIONS } from "@/lib/filter";

export type CreatedCircle = { id: string; name: string; students: number };

/**
 * Student names as typed or pasted: one per line. A row pasted from Excel keeps its first cell.
 * Empty lines, one-letter lines and repeats are dropped (the database does the same).
 */
export function parseNames(text: string): { names: string[]; skipped: number } {
  const seen = new Set<string>();
  const names: string[] = [];
  let skipped = 0;
  for (const raw of text.split(/\r?\n/)) {
    const n = raw.split("\t")[0].replace(/\s+/g, " ").trim();
    if (!n) continue;
    const key = n.toLowerCase();
    if (n.length < 2 || n.length > 100 || seen.has(key)) {
      skipped++;
      continue;
    }
    seen.add(key);
    names.push(n);
  }
  return { names, skipped };
}

// حلقة جديدة مع طلابها: the halaqa's name, its section and its students (one name per line), saved
// in one step by admin_create_circle — all or nothing, so a failed save never leaves half a halaqa.
// Used by the onboarding wizard and by الإدارة.
export default function CircleForm({
  supabase,
  onCreated,
  submitLabel = "إنشاء الحلقة",
  secondary,
}: {
  supabase: SupabaseClient;
  onCreated: (c: CreatedCircle) => void | Promise<void>;
  submitLabel?: string;
  /** e.g. a "skip" or "cancel" button shown beside the save button. */
  secondary?: React.ReactNode;
}) {
  const [name, setName] = useState("");
  const [section, setSection] = useState<string>("MALE");
  const [students, setStudents] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const parsed = useMemo(() => parseNames(students), [students]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const n = name.trim();
    if (!n) return setError("اكتب اسم الحلقة");
    if (parsed.names.length > 300) return setError("الحد 300 اسم في المرة الواحدة");
    if (!navigator.onLine) return setError("إنشاء الحلقة يحتاج اتصالًا بالإنترنت");
    setBusy(true);
    const { data, error } = await supabase.rpc("admin_create_circle", {
      p_name: n,
      p_section: section || null,
      p_students: parsed.names,
    });
    setBusy(false);
    if (error || !data) return setError(error?.message || "تعذّر إنشاء الحلقة");
    const r = data as { id: string; students: number };
    setName("");
    setStudents("");
    await onCreated({ id: r.id, name: n, students: r.students });
  }

  return (
    <form className="circle-form" onSubmit={save} noValidate>
      <div className="two">
        <div>
          <label htmlFor="cf-name">اسم الحلقة</label>
          <input id="cf-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} placeholder="حلقة أبي بكر الصديق" />
        </div>
        <div>
          <label htmlFor="cf-section">القسم</label>
          <select id="cf-section" value={section} onChange={(e) => setSection(e.target.value)}>
            {SECTIONS.map((s) => (
              <option key={s} value={s}>
                {SECTION_LABEL[s]}
              </option>
            ))}
            <option value="">بدون قسم</option>
          </select>
        </div>
      </div>
      <div className="field">
        <label htmlFor="cf-students">
          أسماء الطلاب <span className="muted small">(اسم في كل سطر — اختياري)</span>
        </label>
        <textarea
          id="cf-students"
          rows={7}
          value={students}
          onChange={(e) => setStudents(e.target.value)}
          placeholder={"أحمد محمد\nعمر خالد\nيوسف علي"}
        />
        <p className="small muted cf-count" aria-live="polite">
          {parsed.names.length
            ? `سيُضاف ${parsed.names.length} ${parsed.names.length === 1 ? "طالب" : "طالبًا"}`
            : "تستطيع اللصق من Excel أو واتساب مباشرة، أو إضافة الطلاب لاحقًا."}
          {parsed.skipped > 0 && ` · تُجوهل ${parsed.skipped} سطر (مكرر أو قصير)`}
        </p>
      </div>
      {error && <p className="error-text">{error}</p>}
      <div className="ob-actions">
        {secondary ?? <span />}
        <button type="submit" disabled={busy}>
          {busy ? "جارٍ الحفظ..." : submitLabel}
        </button>
      </div>
    </form>
  );
}
