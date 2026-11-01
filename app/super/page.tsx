"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import { applyPalette } from "@/lib/center";

type Row = {
  id: string; slug: string; name: string; country: string | null; city: string | null; status: "TRIAL" | "ACTIVE" | "SUSPENDED";
  plan: "FREE" | "BASIC" | "PRO"; domain: string | null; created_at: string; trial_ends_at: string | null; owner_email: string | null;
  staff: number; students: number; circles: number; last_activity: string | null;
};

const STATUS = { TRIAL: "تجربة", ACTIVE: "فعّال", SUSPENDED: "موقوف" } as const;
const PLAN = { FREE: "مجانية", BASIC: "أساسية", PRO: "احترافية" } as const;

// لوحة إدارة المنصة (Super Admin): every centre, its size and activity; activate or suspend it,
// change its plan. It never shows a centre's daily data (students' names, records).
export default function SuperAdmin() {
  const [supabase] = useState(() => createClient());
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");

  async function load() {
    const { data, error } = await supabase.rpc("super_centers");
    if (error) return setError(error.message);
    setRows((data as unknown as Row[]) ?? []);
  }
  useEffect(() => {
    applyPalette({ palette: "slate" });
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function set(id: string, patch: { p_status?: string; p_plan?: string }) {
    const { error } = await supabase.rpc("super_set_center", { p_id: id, ...patch });
    if (error) return setError(error.message);
    load();
  }

  const list = (rows ?? []).filter((r) => !q || `${r.name} ${r.slug} ${r.country ?? ""} ${r.owner_email ?? ""}`.toLowerCase().includes(q.toLowerCase()));
  const sum = (k: "students" | "staff" | "circles") => (rows ?? []).reduce((a, r) => a + r[k], 0);

  return (
    <div className="app-bg">
      <header>
        <div className="headerrow">
          <div className="brand-row">
            <span className="header-mark">ح</span>
            <div className="brand-text">
              <h1>إدارة المنصة</h1>
              <div className="dates"><span className="hijri">كل المراكز المسجّلة</span></div>
            </div>
          </div>
          <Link href="/" className="btn ghost">العودة للتطبيق</Link>
        </div>
      </header>
      <main>
        {error && <div className="card"><p className="error-text">{error}</p></div>}
        <div className="grid">
          {[
            ["المراكز", rows?.length ?? 0],
            ["فعّالة", rows?.filter((r) => r.status === "ACTIVE").length ?? 0],
            ["الطلاب", sum("students")],
            ["المعلّمون والمدراء", sum("staff")],
          ].map(([l, v]) => (
            <div className="card stat" key={l as string}>
              <span className="muted">{l}</span>
              <b>{(v as number).toLocaleString("ar-EG")}</b>
            </div>
          ))}
        </div>
        <div className="card">
          <div className="title">
            <h3>المراكز</h3>
            <input style={{ maxWidth: 260 }} placeholder="بحث بالاسم أو الدولة أو البريد" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          {!rows ? (
            <p className="muted">جارٍ التحميل...</p>
          ) : (
            <div className="table-wrap">
              <table className="sx-table">
                <thead>
                  <tr>
                    <th>المركز</th><th>الدولة</th><th>الحالة</th><th>الخطة</th><th>طلاب</th><th>حلقات</th><th>كادر</th><th>آخر نشاط</th><th>صاحب المركز</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <a href={`/${r.slug}`} target="_blank" rel="noreferrer">{r.name}</a>
                        <div className="small muted" dir="ltr" style={{ textAlign: "right" }}>/{r.slug}{r.domain ? ` · ${r.domain}` : ""}</div>
                      </td>
                      <td>{[r.city, r.country].filter(Boolean).join("، ") || "—"}</td>
                      <td>
                        <select value={r.status} onChange={(e) => set(r.id, { p_status: e.target.value })} aria-label="الحالة" className={`status ${r.status}`}>
                          {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                        </select>
                      </td>
                      <td>
                        <select value={r.plan} onChange={(e) => set(r.id, { p_plan: e.target.value })} aria-label="الخطة">
                          {Object.entries(PLAN).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                        </select>
                      </td>
                      <td>{r.students}</td>
                      <td>{r.circles}</td>
                      <td>{r.staff}</td>
                      <td>{r.last_activity ? new Date(r.last_activity).toLocaleDateString("ar-SY") : "—"}</td>
                      <td dir="ltr" style={{ textAlign: "right" }}>{r.owner_email ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
