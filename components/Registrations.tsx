"use client";

import { useEffect, useState } from "react";
import { useApp } from "@/components/AppContext";
import { confirmDialog } from "@/components/ConfirmDialog";
import { store, useStore } from "@/lib/offline/store";
import { SECTION_LABEL, type Section } from "@/lib/filter";
import { formatPhone, waLink } from "@/lib/guardian";
import type { Tables } from "@/lib/supabase/database.types";

type Request = Tables<"registration_requests">;

/** Pending requests, for the badge on the dashboard. Online only; null while unknown. */
export function usePendingRegistrations(): number | null {
  const { supabase } = useApp();
  const [n, setN] = useState<number | null>(null);
  useEffect(() => {
    if (!navigator.onLine) return;
    supabase
      .from("registration_requests")
      .select("id", { count: "exact", head: true })
      .eq("status", "PENDING")
      .then(({ count }) => setN(count ?? null));
  }, [supabase]);
  return n;
}

// طلبات التسجيل: requests from the public form (/register). The admin picks a halaqa of the
// requested section and accepts (the student is created with the guardian's number) or rejects.
export default function Registrations() {
  const s = useStore();
  const { supabase, showToast, center } = useApp();
  const [rows, setRows] = useState<Request[] | null>(null);
  const [error, setError] = useState("");
  const [circleFor, setCircleFor] = useState<Record<string, string>>({});
  const [showDone, setShowDone] = useState(false);
  const [open, setOpen] = useState<boolean | null>(null);
  const circles = s.all("circles").filter((c) => c.active && !c.deleted_at);

  useEffect(() => {
    let stale = false;
    supabase
      .from("centers")
      .select("registrations_open")
      .eq("id", center.id)
      .maybeSingle()
      .then(({ data }) => !stale && setOpen((v) => v ?? data?.registrations_open ?? true));
    return () => {
      stale = true;
    };
  }, [supabase, center.id]);

  async function toggleOpen(v: boolean) {
    setError("");
    setOpen(v);
    const { error } = await supabase.from("centers").update({ registrations_open: v }).eq("id", center.id);
    if (error) {
      setOpen(!v);
      return setError(error.message);
    }
    showToast(v ? "صار نموذج التسجيل يستقبل الطلبات" : "تم إغلاق نموذج التسجيل");
  }

  async function load() {
    const { data, error } = await supabase.from("registration_requests").select("*").order("created_at", { ascending: false }).limit(200);
    if (error) return setError(error.message);
    setRows(data);
  }
  useEffect(() => {
    if (navigator.onLine) load();
    else setError("طلبات التسجيل تحتاج اتصالًا بالإنترنت");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function accept(r: Request) {
    setError("");
    const circleId = circleFor[r.id] ?? circlesOf(r)[0]?.id;
    if (!circleId) return setError(`اختر حلقة لـ ${r.student_name}`);
    const { error } = await supabase.rpc("admin_accept_registration", { p_id: r.id, p_circle_id: circleId });
    if (error) return setError(error.message);
    await store.sync();
    showToast(`أُضيف ${r.student_name} إلى ${s.get("circles", circleId)?.name ?? "الحلقة"}`);
    load();
  }

  async function reject(r: Request) {
    const ok = await confirmDialog({ title: `رفض طلب «${r.student_name}»؟`, body: "يبقى الطلب في السجل مع حالة «مرفوض».", ok: "رفض", danger: true });
    if (!ok) return;
    setError("");
    const { error } = await supabase.rpc("admin_reject_registration", { p_id: r.id });
    if (error) return setError(error.message);
    showToast("تم رفض الطلب");
    load();
  }

  // Halaqat that can take the request: of its section, or with no section (the database checks too).
  function circlesOf(r: Request) {
    return circles
      .filter((c) => !c.section || c.section === r.section)
      .sort((a, b) => Number(!!b.section) - Number(!!a.section) || a.name.localeCompare(b.name, "ar"));
  }

  const pending = rows?.filter((r) => r.status === "PENDING") ?? [];
  const done = rows?.filter((r) => r.status !== "PENDING") ?? [];
  const link = typeof location === "undefined" ? "" : `${location.origin}/${center.slug}/register`;

  return (
    <div className="card registrations">
      <h3>📝 طلبات التسجيل {pending.length > 0 && <span className="badge redo">{pending.length} جديد</span>}</h3>
      <p className="small muted">
        أرسلوا للأهل رابط التسجيل: <span dir="ltr">{link}</span>{" "}
        <button
          type="button"
          className="link"
          onClick={() => navigator.clipboard?.writeText(link).then(() => showToast("تم نسخ رابط التسجيل"), () => {})}
        >
          نسخ
        </button>
      </p>
      {open !== null && (
        <label className="switch-row reg-toggle">
          <input type="checkbox" checked={open} onChange={(e) => toggleOpen(e.target.checked)} />
          {open ? "النموذج يستقبل طلبات جديدة" : "النموذج مغلق — يرى الأهل «التسجيل مغلق حاليًا»"}
        </label>
      )}
      {error && <p className="error-text">{error}</p>}
      {rows && !pending.length && <p className="muted">لا توجد طلبات جديدة.</p>}
      <ul className="reg-list">
        {pending.map((r) => (
          <li key={r.id}>
            <RequestInfo r={r} />
            <div className="reg-actions">
              {!circlesOf(r).length ? (
                <span className="small muted">لا توجد حلقة لقسم {SECTION_LABEL[r.section as Section] ?? ""} — أنشئها من «الحلقات» أولًا.</span>
              ) : (
              <select
                aria-label={`حلقة ${r.student_name}`}
                value={circleFor[r.id] ?? circlesOf(r)[0]?.id ?? ""}
                onChange={(e) => setCircleFor({ ...circleFor, [r.id]: e.target.value })}
              >
                {circlesOf(r).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              )}
              <button onClick={() => accept(r)} disabled={!circlesOf(r).length}>
                قبول
              </button>
              <button className="danger" onClick={() => reject(r)}>
                رفض
              </button>
            </div>
          </li>
        ))}
      </ul>
      {done.length > 0 && (
        <>
          <button className="link" onClick={() => setShowDone(!showDone)}>
            {showDone ? "إخفاء" : "عرض"} الطلبات السابقة ({done.length})
          </button>
          {showDone && (
            <ul className="reg-list done">
              {done.map((r) => (
                <li key={r.id}>
                  <RequestInfo r={r} />
                  <span className={`badge ${r.status === "ACCEPTED" ? "excellent" : "redo"}`}>
                    {r.status === "ACCEPTED" ? `مقبول${r.student_id ? ` — ${s.get("circles", s.get("students", r.student_id)?.circle_id ?? "")?.name ?? ""}` : ""}` : "مرفوض"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

function RequestInfo({ r }: { r: Request }) {
  const when = new Intl.DateTimeFormat("ar-SY", { day: "numeric", month: "long" }).format(new Date(r.created_at));
  return (
    <div className="reg-info">
      <b>{r.student_name}</b>{" "}
      <span className="muted small">
        {SECTION_LABEL[r.section as Section] ?? ""}
        {r.age ? ` · ${r.age} سنة` : ""} · {when}
      </span>
      <div className="small">
        ولي الأمر: {r.guardian_name ? `${r.guardian_name} · ` : ""}
        <a href={waLink(`السلام عليكم ورحمة الله، بخصوص طلب تسجيل ${r.student_name} في حلقات القرآن…`, r.guardian_phone)} target="_blank" rel="noreferrer" dir="ltr">
          {formatPhone(r.guardian_phone)}
        </a>
      </div>
      {r.memorized && <div className="small muted">يحفظ: {r.memorized}</div>}
    </div>
  );
}
