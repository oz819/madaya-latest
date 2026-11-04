"use client";

import { Fragment, useEffect, useState } from "react";
import { useApp } from "@/components/AppContext";
import Panel from "@/components/Panel";
import CircleForm from "@/components/CircleForm";
import { confirmDialog } from "@/components/ConfirmDialog";
import { adminSoftDelete } from "@/lib/adminDelete";
import { PROFILE_COLUMNS, store, useStore } from "@/lib/offline/store";
import { SECTIONS, SECTION_LABEL, effectiveFilter, filterLabel, filterOptions } from "@/lib/filter";
import CenterSettings, { HonorSettings } from "@/components/CenterSettings";
import Registrations from "@/components/Registrations";
import ExportExcel from "@/components/ExportExcel";
import CenterProfile from "@/components/center/CenterProfile";
import Invites from "@/components/center/Invites";
import ImportStudents from "@/components/center/ImportStudents";
import DevCredit from "@/components/landing/DevCredit";

// Admin-only actions (spec §5.4). These need a connection: they write straight to Supabase
// (RLS re-checks is_admin()) and then refresh the local copy.
export default function Manage() {
  return (
    <section>
      <div className="card notice">
        صلاحيات المدير: إدارة المحفّظين والمدراء، إنشاء الحلقات وتسميتها وأرشفتها، أرشفة الطلاب، وإدارة كتب العربية. كل محفّظ مفعّل يرى جميع
        الطلاب ويضيف ويعدّل إدخالاتهم. هذه الإجراءات تحتاج اتصالًا بالإنترنت.
      </div>
      <CenterProfile />
      <Registrations />
      <Invites />
      <Teachers />
      <Halaqat />
      <ImportStudents />
      <ArabicBooks />
      <CenterSettings />
      <HonorSettings />
      <ExportExcel />
      <DevCredit />
    </section>
  );
}

function Teachers() {
  const s = useStore();
  const { supabase, profile, showToast } = useApp();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [emails, setEmails] = useState<Record<string, string>>({});
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editFilter, setEditFilter] = useState("all");
  const circles = s.all("circles").filter((c) => c.active).sort((a, b) => a.name.localeCompare(b.name, "ar"));
  const filterChoices = filterOptions(circles);
  const people = s.all("profiles").sort((a, b) => a.name.localeCompare(b.name, "ar"));

  async function loadEmails() {
    try {
      const res = await fetch("/api/admin/teachers");
      const data = await res.json().catch(() => ({}));
      if (res.ok) setEmails(data.emails ?? {});
    } catch {}
  }

  useEffect(() => {
    loadEmails();
  }, []);

  async function refresh() {
    const { data } = await supabase.from("profiles").select(PROFILE_COLUMNS);
    if (data) await store.applyRemote("profiles", data);
  }

  async function add() {
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/admin/teachers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return setError(data.error || "تعذّر إضافة المحفّظ");
      setName("");
      setEmail("");
      setPassword("");
      await refresh();
      showToast("تمت إضافة المحفّظ");
    } catch {
      setError("تحتاج اتصالًا بالإنترنت");
    } finally {
      setBusy(false);
    }
  }

  async function update(id: string, patch: { active?: boolean; role?: string }, msg: string) {
    setError("");
    const { error } = await supabase.from("profiles").update(patch).eq("id", id);
    if (error) return setError(error.message);
    await refresh();
    showToast(msg);
  }

  function startEdit(id: string, currentName: string, currentFilter: string | null) {
    setError("");
    setEditId(id);
    setEditName(currentName);
    setEditEmail(emails[id] ?? "");
    setEditFilter(effectiveFilter(currentFilter ?? "all", circles));
  }

  async function saveEdit(id: string, currentName: string, currentFilter: string | null) {
    const patch: { name?: string; email?: string; default_filter?: string | null } = {};
    if (editName.trim() !== currentName) patch.name = editName.trim();
    if (editEmail.trim() && editEmail.trim() !== (emails[id] ?? "")) patch.email = editEmail.trim();
    if (editFilter !== effectiveFilter(currentFilter ?? "all", circles)) patch.default_filter = editFilter === "all" ? null : editFilter;
    if (!patch.name && !patch.email && patch.default_filter === undefined) return setEditId(null);
    setBusy(true);
    setError("");
    try {
      // The name is a plain profiles update (RLS: admins only); only the login email needs the
      // server route, because changing it goes through the Auth Admin API.
      if (patch.name || patch.default_filter !== undefined) {
        // undefined fields are left out of the request, so only what changed is written.
        const { error } = await supabase
          .from("profiles")
          .update({ name: patch.name, default_filter: patch.default_filter })
          .eq("id", id);
        if (error) return setError(error.message);
      }
      if (patch.email) {
        const res = await fetch(`/api/admin/teachers/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: patch.email }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) return setError(data.error || "تعذّر تغيير البريد");
      }
      setEditId(null);
      await Promise.all([refresh(), loadEmails()]);
      showToast("تم حفظ التعديل");
    } catch {
      setError("تحتاج اتصالًا بالإنترنت");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string, personName: string) {
    const ok = await confirmDialog({
      title: `حذف حساب «${personName}»؟`,
      body: "ينتقل إلى سجل المحذوفات ولن يستطيع تسجيل الدخول. يمكنك استرجاعه من هناك، وتبقى كل سجلاته.",
      ok: "حذف",
      danger: true,
    });
    if (!ok) return;
    setError("");
    setBusy(true);
    const err = await adminSoftDelete(supabase, "profile", id);
    setBusy(false);
    if (err) return setError(err);
    if (editId === id) setEditId(null);
    showToast(`تم حذف «${personName}» — تجده في سجل المحذوفات`);
  }

  async function resetPassword(id: string) {
    const pw = prompt("كلمة المرور الجديدة (8 أحرف على الأقل):");
    if (!pw) return;
    const res = await fetch(`/api/admin/teachers/${id}/reset-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: pw }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return setError(data.error || "تعذّر تغيير كلمة المرور");
    showToast("تم تغيير كلمة المرور");
  }

  return (
    <div className="card">
      <h3>👥 المحفّظون والمدراء</h3>
      <div className="formgrid compact">
        <input placeholder="الاسم" value={name} onChange={(e) => setName(e.target.value)} />
        <input placeholder="البريد الإلكتروني" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input placeholder="كلمة المرور (8 أحرف+)" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <button onClick={add} disabled={busy}>
          إضافة محفّظ
        </button>
      </div>
      <p className="small muted">يدخل المحفّظ بعدها برمز يصله على بريده. لا يستطيع أحد غير مسجّل هنا إنشاء حساب بنفسه.</p>
      {error && <p className="error-text">{error}</p>}
      <div style={{ overflow: "auto" }}>
        <table className="staff-table">
          <thead>
            <tr>
              <th>الاسم</th>
              <th>البريد</th>
              <th>الدور</th>
              <th>الحالة</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {people.map((p) => (
              <Fragment key={p.id}>
                <tr>
                  <td>
                    {p.name}
                    {p.default_filter && effectiveFilter(p.default_filter, circles) !== "all" && (
                      <div className="small muted">يفتح على: {filterLabel(effectiveFilter(p.default_filter, circles), circles)}</div>
                    )}
                  </td>
                  <td className="small" dir="ltr" style={{ textAlign: "right" }}>
                    {emails[p.id] ?? "—"}
                  </td>
                  <td>{p.role === "ADMIN" ? "مدير" : "محفّظ"}</td>
                  <td>{p.active ? "مفعّل" : "معطّل"}</td>
                  <td className="row-actions">
                    {p.id !== profile.id && (
                      <>
                        <button
                          className="link"
                          onClick={() => update(p.id, { active: !p.active }, p.active ? "تم التعطيل" : "تم التفعيل")}
                        >
                          {p.active ? "تعطيل" : "تفعيل"}
                        </button>
                        {p.role === "TEACHER" ? (
                          <button
                            className="link"
                            onClick={() => confirm(`ترقية ${p.name} إلى مدير؟`) && update(p.id, { role: "ADMIN" }, "تمت الترقية إلى مدير")}
                          >
                            ترقية لمدير
                          </button>
                        ) : (
                          <button
                            className="link"
                            onClick={() =>
                              confirm(`إرجاع ${p.name} إلى محفّظ؟`) && update(p.id, { role: "TEACHER" }, "تم التحويل إلى محفّظ")
                            }
                          >
                            إلغاء الإدارة
                          </button>
                        )}
                      </>
                    )}
                    <button className="link" onClick={() => startEdit(p.id, p.name, p.default_filter)}>
                      تعديل
                    </button>
                    <button className="link" onClick={() => resetPassword(p.id)}>
                      كلمة المرور
                    </button>
                    {p.id !== profile.id && (
                      <button className="link danger-link" disabled={busy} onClick={() => remove(p.id, p.name)}>
                        حذف
                      </button>
                    )}
                  </td>
                </tr>
                {editId === p.id && (
                  <tr className="edit-row">
                    <td colSpan={5}>
                      <div className="formgrid compact">
                        <div>
                          <label>الاسم</label>
                          <input value={editName} onChange={(e) => setEditName(e.target.value)} />
                        </div>
                        <div>
                          <label>البريد الإلكتروني (للدخول)</label>
                          <input type="email" dir="ltr" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} />
                        </div>
                        <div>
                          <label>يفتح التطبيق على</label>
                          <select value={editFilter} onChange={(e) => setEditFilter(e.target.value)}>
                            <option value="all">كل الطلاب</option>
                            {filterChoices.sections.map((sec) => (
                              <option key={sec} value={`s:${sec}`}>
                                {SECTION_LABEL[sec]}
                              </option>
                            ))}
                            {filterChoices.circles.map((c) => (
                              <option key={c.id} value={`c:${c.id}`}>
                                {c.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="row-actions" style={{ alignSelf: "end" }}>
                          <button disabled={busy || !editName.trim()} onClick={() => saveEdit(p.id, p.name, p.default_filter)}>
                            حفظ
                          </button>
                          <button className="secondary" onClick={() => setEditId(null)}>
                            إلغاء
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Halaqat() {
  const s = useStore();
  const { supabase, showToast } = useApp();
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");
  const circles = s.all("circles").sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name, "ar"));
  const count = (id: string) => s.all("students").filter((st) => st.active && st.circle_id === id).length;

  function friendly(msg: string) {
    return /circles_name_unique|duplicate/i.test(msg) ? "يوجد حلقة بهذا الاسم (ربما في سجل المحذوفات — استرجعها من هناك)" : msg;
  }


  async function update(id: string, patch: { name?: string; active?: boolean; section?: string | null }) {
    setError("");
    const { data, error } = await supabase
      .from("circles")
      .update({ ...patch, edited_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();
    if (error) return setError(friendly(error.message));
    await store.applyRemote("circles", [data]);
    showToast("تم الحفظ");
  }

  async function remove(id: string, circleName: string) {
    const ok = await confirmDialog({
      title: `حذف الحلقة «${circleName}»؟`,
      body: "تنتقل إلى سجل المحذوفات وتختفي من كل القوائم. يمكنك استرجاعها من هناك.",
      ok: "حذف",
      danger: true,
    });
    if (!ok) return;
    setError("");
    const err = await adminSoftDelete(supabase, "circle", id);
    if (err) return setError(err);
    showToast(`تم حذف «${circleName}»`);
  }

  return (
    <div className="card">
      <h3>🏫 الحلقات</h3>
      <p className="small muted">
        اسم الحلقة نص حر، مثل «ذكور – الشيخ أحمد» أو «إناث 10–12». حدّد قسم كل حلقة (الذكور / الإناث)، فيظهر القسم في فرز الطلاب ويجمع
        كل حلقاته.
      </p>
      {adding ? (
        <Panel title="🏫 حلقة جديدة مع طلابها" onClose={() => setAdding(false)} className="panel-inset">
          <CircleForm
            supabase={supabase}
            onCreated={async (c) => {
              await store.sync();
              setAdding(false);
              showToast(c.students ? `تم إنشاء «${c.name}» مع ${c.students} طالبًا` : `تم إنشاء «${c.name}»`);
            }}
            secondary={
              <button type="button" className="secondary" onClick={() => setAdding(false)}>
                إلغاء
              </button>
            }
          />
        </Panel>
      ) : (
        <div className="row-actions" style={{ margin: "8px 0 12px" }}>
          <button onClick={() => setAdding(true)}>+ حلقة جديدة</button>
        </div>
      )}
      {error && <p className="error-text">{error}</p>}
      <table>
        <thead>
          <tr>
            <th>الحلقة</th>
            <th>القسم</th>
            <th>الطلاب</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {circles.map((c) => (
            <tr key={c.id} className={c.active ? "" : "muted"}>
              <td>
                {c.name} {!c.active && <span className="badge">مؤرشفة</span>}
              </td>
              <td>
                <select
                  className="cell-select"
                  value={c.section ?? ""}
                  onChange={(e) => update(c.id, { section: e.target.value || null })}
                  aria-label={`قسم ${c.name}`}
                >
                  <option value="">—</option>
                  {SECTIONS.map((sec) => (
                    <option key={sec} value={sec}>
                      {SECTION_LABEL[sec]}
                    </option>
                  ))}
                </select>
              </td>
              <td>{count(c.id)}</td>
              <td className="row-actions">
                <button
                  className="link"
                  onClick={() => {
                    const n = prompt("الاسم الجديد للحلقة:", c.name);
                    if (n && n.trim() && n.trim() !== c.name) update(c.id, { name: n.trim() });
                  }}
                >
                  إعادة تسمية
                </button>
                <button className="link" onClick={() => update(c.id, { active: !c.active })}>
                  {c.active ? "أرشفة" : "استعادة"}
                </button>
                <button className="link danger-link" onClick={() => remove(c.id, c.name)}>
                  حذف
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ArabicBooks() {
  const s = useStore();
  const { supabase, showToast } = useApp();
  const [title, setTitle] = useState("");
  const [pages, setPages] = useState("");
  const [error, setError] = useState("");
  const books = s.all("arabic_books").sort((a, b) => Number(b.active) - Number(a.active) || a.title.localeCompare(b.title, "ar"));

  async function add() {
    setError("");
    const total = Number(pages);
    if (!title.trim() || !Number.isInteger(total) || total < 1) return setError("أدخل العنوان وعدد الصفحات");
    const { data, error } = await supabase.from("arabic_books").insert({ title: title.trim(), total_pages: total }).select().single();
    if (error)
      return setError(/unique|duplicate/i.test(error.message) ? "يوجد كتاب بهذا العنوان (ربما في سجل المحذوفات)" : error.message);
    await store.applyRemote("arabic_books", [data]);
    setTitle("");
    setPages("");
    showToast("تمت إضافة الكتاب");
  }

  async function toggle(id: string, active: boolean) {
    const { data, error } = await supabase
      .from("arabic_books")
      .update({ active, edited_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();
    if (error) return setError(error.message);
    await store.applyRemote("arabic_books", [data]);
  }

  async function remove(id: string, bookTitle: string) {
    const ok = await confirmDialog({
      title: `حذف الكتاب «${bookTitle}»؟`,
      body: "ينتقل إلى سجل المحذوفات ويختفي من القوائم. دروس الطلاب السابقة فيه تبقى.",
      ok: "حذف",
      danger: true,
    });
    if (!ok) return;
    setError("");
    const err = await adminSoftDelete(supabase, "arabic_book", id);
    if (err) return setError(err);
    showToast(`تم حذف «${bookTitle}»`);
  }

  return (
    <div className="card">
      <h3>📘 كتب العربية</h3>
      <p className="small muted">
        كل كتاب تضيفه هنا يظهر خيارًا عند إضافة طالب وفي قسم «العربية» داخل بطاقة الطالب. عدد الصفحات هو عدد صفحات النسخة
        المستخدمة في المركز، ومنه يُحسب تقدّم الطالب.
      </p>
      <div className="formgrid compact">
        <input placeholder="عنوان الكتاب (مثال: الرشيدي)" value={title} onChange={(e) => setTitle(e.target.value)} />
        <input
          placeholder="عدد الصفحات"
          type="number"
          inputMode="numeric"
          min={1}
          value={pages}
          onChange={(e) => setPages(e.target.value)}
        />
        <button onClick={add}>إضافة كتاب</button>
      </div>
      {error && <p className="error-text">{error}</p>}
      {books.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>الكتاب</th>
              <th>الصفحات</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {books.map((b) => (
              <tr key={b.id} className={b.active ? "" : "muted"}>
                <td>{b.title}</td>
                <td>{b.total_pages}</td>
                <td className="row-actions">
                  <button className="link" onClick={() => toggle(b.id, !b.active)}>
                    {b.active ? "أرشفة" : "استعادة"}
                  </button>
                  <button className="link danger-link" onClick={() => remove(b.id, b.title)}>
                    حذف
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
