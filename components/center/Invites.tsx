"use client";

import { useCallback, useEffect, useState } from "react";
import { useApp } from "@/components/AppContext";
import type { Tables } from "@/lib/supabase/database.types";

type Invite = Tables<"center_invites">;

// دعوة مدير أو معلّم بالبريد: a private link for that email. Opening it, the person signs in (or
// makes their login) with that email and joins this centre — the same person can belong to more
// than one centre. The link can be sent by email, WhatsApp or copied.
export default function Invites() {
  const { supabase, center, showToast } = useApp();
  const [rows, setRows] = useState<Invite[] | null>(null);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<"TEACHER" | "ADMIN">("TEACHER");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase.from("center_invites").select("*").order("created_at", { ascending: false }).limit(50);
    if (error) setError(error.message);
    setRows(data ?? []);
  }, [supabase]);
  useEffect(() => {
    load();
  }, [load]);

  const link = (t: string) => `${location.origin}/invite/${t}`;
  const message = (inv: Invite) =>
    `السلام عليكم${inv.name ? ` ${inv.name}` : ""}،\nدعوة للانضمام إلى ${center.name} على منصة حلقات ${inv.role === "ADMIN" ? "مديرًا" : "معلّمًا"}.\nافتح الرابط وادخل ببريدك ${inv.email}:\n${link(inv.token)}`;

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const em = email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) return setError("اكتب بريدًا صحيحًا");
    if (!navigator.onLine) return setError("الدعوات تحتاج اتصالًا بالإنترنت");
    setBusy(true);
    const { data, error } = await supabase
      .from("center_invites")
      .insert({ email: em, role, name: name.trim() || null })
      .select("*")
      .single();
    if (error || !data) {
      setBusy(false);
      return setError(error?.message || "تعذّر إنشاء الدعوة");
    }
    // Ask the server to email it (Supabase's mailer). If email isn't set up, the link still works.
    const res = await fetch("/api/admin/invites", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: data.id, origin: location.origin }),
    }).catch(() => null);
    setBusy(false);
    setEmail("");
    setName("");
    await load();
    if (res?.ok) showToast("أُرسلت الدعوة إلى البريد");
    else {
      await navigator.clipboard?.writeText(link(data.token)).catch(() => {});
      showToast("أُنشئت الدعوة ونُسخ رابطها — أرسله بواتساب أو البريد");
    }
  }

  async function revoke(id: string) {
    const { error } = await supabase.from("center_invites").update({ revoked_at: new Date().toISOString() }).eq("id", id);
    if (error) return showToast(error.message);
    load();
  }

  const state = (i: Invite) =>
    i.revoked_at ? "ملغاة" : i.accepted_at ? "مقبولة" : new Date(i.expires_at) < new Date() ? "منتهية" : "بانتظار القبول";

  return (
    <div className="card">
      <h3>✉️ دعوة مدير أو معلّم</h3>
      <form className="formgrid" onSubmit={create} noValidate>
        <div>
          <label>البريد الإلكتروني</label>
          <input type="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <label>الاسم (اختياري)</label>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={100} />
        </div>
        <div>
          <label>الدور</label>
          <select value={role} onChange={(e) => setRole(e.target.value as "TEACHER" | "ADMIN")}>
            <option value="TEACHER">محفّظ / معلّم</option>
            <option value="ADMIN">مدير</option>
          </select>
        </div>
        <div style={{ alignSelf: "end" }}>
          <button type="submit" disabled={busy} style={{ width: "100%" }}>
            {busy ? "جارٍ الإنشاء..." : "إرسال دعوة"}
          </button>
        </div>
      </form>
      {error && <p className="error-text">{error}</p>}

      {rows && rows.length > 0 && (
        <div className="table-wrap" style={{ marginTop: 12 }}>
          <table>
            <thead>
              <tr>
                <th>البريد</th>
                <th>الدور</th>
                <th>الحالة</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((i) => {
                const open = state(i) === "بانتظار القبول";
                return (
                  <tr key={i.id}>
                    <td dir="ltr" style={{ textAlign: "right" }}>
                      {i.email}
                      {i.name && <div className="small muted">{i.name}</div>}
                    </td>
                    <td>{i.role === "ADMIN" ? "مدير" : "محفّظ"}</td>
                    <td>{state(i)}</td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      {open && (
                        <>
                          <button type="button" className="link" onClick={() => navigator.clipboard?.writeText(link(i.token)).then(() => showToast("تم نسخ الرابط"), () => {})}>
                            نسخ الرابط
                          </button>{" "}
                          <a href={`https://wa.me/?text=${encodeURIComponent(message(i))}`} target="_blank" rel="noreferrer">
                            واتساب
                          </a>{" "}
                          <a href={`mailto:${i.email}?subject=${encodeURIComponent(`دعوة إلى ${center.name}`)}&body=${encodeURIComponent(message(i))}`}>بريد</a>{" "}
                          <button type="button" className="link" style={{ color: "var(--danger)" }} onClick={() => revoke(i.id)}>
                            إلغاء
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
