"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import DevCredit from "@/components/landing/DevCredit";
import { CenterMark, GeoStar } from "@/components/center/Geo";
import { PALETTES, SLUG_RE, applyPalette, slugify, type MyContext, type Palette, type PendingCenter } from "@/lib/center";
import { logoDataUrl } from "@/lib/logo";

type Step = 0 | 1 | 2 | 3;
const STEPS = ["المركز", "الشعار والألوان", "أول حلقة", "أول معلّم"];

// معالج الإعداد بعد "سجّل مركزك": 1) create the centre (owner = this login), 2) logo + colours,
// 3) the first halaqa and its students, 4) invite the first teacher. Every step can be skipped and
// done later from الإدارة.
export default function Onboarding() {
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const [ctx, setCtx] = useState<MyContext | null>(null);
  const [step, setStep] = useState<Step>(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);

  const [c, setC] = useState<PendingCenter>({ name: "", slug: "", country: "", city: "", owner: "" });
  const [logo, setLogo] = useState<string | null>(null);
  const [palette, setPalette] = useState<Palette>("indigo");
  const [circle, setCircle] = useState({ name: "", section: "MALE", students: "" });
  const [teacher, setTeacher] = useState({ email: "", name: "" });
  const [inviteLink, setInviteLink] = useState("");

  async function loadCtx() {
    const { data } = await supabase.rpc("my_context");
    const v = data as unknown as MyContext | null;
    setCtx(v);
    return v;
  }

  useEffect(() => {
    (async () => {
      const { data: s } = await supabase.auth.getSession();
      if (!s.session) return router.replace("/login");
      const v = await loadCtx();
      const isNew = new URLSearchParams(location.search).has("new");
      const meta = s.session.user.user_metadata as { pending_center?: PendingCenter; name?: string } | undefined;
      if (meta?.pending_center) setC(meta.pending_center);
      else setC((x) => ({ ...x, owner: meta?.name || v?.name || "" }));
      // The owner of a centre not set up yet continues from step 2.
      if (!isNew && v?.center && v.membership?.role === "ADMIN") {
        if (v.center.onboarded) return router.replace("/");
        setPalette(v.center.palette);
        setLogo(v.center.logo_url);
        applyPalette(v.center);
        setStep(1);
      }
      setReady(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function createCenter(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (c.name.trim().length < 2) return setError("اكتب اسم المركز");
    if (!SLUG_RE.test(c.slug)) return setError("رابط المركز: أحرف إنجليزية صغيرة وأرقام وشرطات (3–40)");
    if (c.owner.trim().length < 2) return setError("اكتب اسمك");
    setBusy(true);
    const { error } = await supabase.rpc("create_center", {
      p_name: c.name,
      p_slug: c.slug,
      p_country: c.country,
      p_city: c.city,
      p_owner_name: c.owner,
      p_palette: palette,
    });
    if (!error) {
      // The details are in the centre now; don't offer to create it twice.
      await supabase.auth.updateUser({ data: { pending_center: null } });
      await loadCtx();
    }
    setBusy(false);
    if (error) return setError(error.message);
    setStep(1);
  }

  async function saveLook() {
    setError("");
    setBusy(true);
    const { error } = await supabase.from("centers").update({ logo_url: logo, palette }).eq("id", ctx!.center!.id);
    setBusy(false);
    if (error) return setError(error.message);
    setStep(2);
  }

  async function saveCircle() {
    setError("");
    const name = circle.name.trim();
    if (!name) return setStep(3);
    setBusy(true);
    const { data, error } = await supabase.from("circles").insert({ name, section: circle.section }).select("id").single();
    if (error || !data) {
      setBusy(false);
      return setError(error?.message || "تعذّر إنشاء الحلقة");
    }
    const names = circle.students.split(/\r?\n|،|,/).map((n) => n.trim()).filter((n) => n.length >= 2).slice(0, 60);
    if (names.length) {
      const { error: e2 } = await supabase.from("students").insert(names.map((n) => ({ name: n.slice(0, 100), circle_id: data.id })));
      if (e2) {
        setBusy(false);
        return setError(e2.message);
      }
    }
    setBusy(false);
    setStep(3);
  }

  async function inviteTeacher() {
    setError("");
    const email = teacher.email.trim().toLowerCase();
    if (!email) return finish();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return setError("اكتب بريدًا صحيحًا");
    setBusy(true);
    const { data, error } = await supabase
      .from("center_invites")
      .insert({ email, name: teacher.name.trim() || null, role: "TEACHER" })
      .select("*")
      .single();
    if (error || !data) {
      setBusy(false);
      return setError(error?.message || "تعذّر إنشاء الدعوة");
    }
    await fetch("/api/admin/invites", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: data.id }) }).catch(() => null);
    setBusy(false);
    setInviteLink(`${location.origin}/invite/${data.token}`);
  }

  async function finish() {
    setBusy(true);
    await supabase.from("centers").update({ onboarded: true }).eq("id", ctx!.center!.id);
    router.replace("/");
  }

  async function pickLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      setLogo(await logoDataUrl(file));
      setError("");
    } catch (err) {
      setError((err as Error).message);
    }
  }

  if (!ready) return <div className="login"><p className="muted">جارٍ التحميل...</p></div>;
  const centerName = ctx?.center?.name ?? c.name ?? "مركزك";

  return (
    <div className="ob geo-bg">
      <div className="ob-box">
        <ol className="ob-steps" aria-label="خطوات الإعداد">
          {STEPS.map((s, i) => (
            <li key={s} className={i <= step ? "on" : ""} title={s} />
          ))}
        </ol>
        <div className="card" style={{ padding: 22 }}>
          <p className="small muted" style={{ margin: 0 }}>
            الخطوة {step + 1} من {STEPS.length}: {STEPS[step]}
          </p>

          {step === 0 && (
            <form onSubmit={createCenter} noValidate>
              <GeoStar style={{ width: 40, height: 40, marginTop: 10 }} />
              <h1 className="ob-title">أنشئ مركزك</h1>
              <p className="ob-sub">ستكون مدير المركز وصاحبه، وتستطيع إضافة مدراء آخرين لاحقًا.</p>
              <div className="field">
                <label>اسم المركز</label>
                <input value={c.name} onChange={(e) => setC({ ...c, name: e.target.value, slug: c.slug || slugify(e.target.value) })} maxLength={120} />
              </div>
              <div className="field">
                <label>رابط المركز</label>
                <div className="slug-input">
                  <span>{location.host}/</span>
                  <input value={c.slug} onChange={(e) => setC({ ...c, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") })} maxLength={40} placeholder="my-center" />
                </div>
              </div>
              <div className="two" style={{ marginTop: 12 }}>
                <div>
                  <label>الدولة</label>
                  <input value={c.country} onChange={(e) => setC({ ...c, country: e.target.value })} maxLength={60} />
                </div>
                <div>
                  <label>المدينة</label>
                  <input value={c.city} onChange={(e) => setC({ ...c, city: e.target.value })} maxLength={60} />
                </div>
              </div>
              <div className="field">
                <label>اسمك</label>
                <input value={c.owner} onChange={(e) => setC({ ...c, owner: e.target.value })} maxLength={100} />
              </div>
              <div className="ob-actions">
                <span />
                <button type="submit" disabled={busy}>{busy ? "جارٍ الإنشاء..." : "إنشاء المركز"}</button>
              </div>
            </form>
          )}

          {step === 1 && (
            <div>
              <h1 className="ob-title">شعار {centerName} وألوانه</h1>
              <p className="ob-sub">تظهر في صفحة المركز وفي التطبيق وصفحات الأهل.</p>
              <div className="logo-pick" style={{ margin: "16px 0" }}>
                <CenterMark name={centerName} logo={logo} size={64} />
                <label className="btn ghost" style={{ margin: 0, cursor: "pointer" }}>
                  رفع الشعار
                  <input type="file" accept="image/png,image/jpeg,image/webp" onChange={pickLogo} hidden />
                </label>
                <span className="small muted">PNG أو JPG أو WebP، حتى 5 ميغابايت</span>
              </div>
              <div className="palettes">
                {PALETTES.map((p) => (
                  <button
                    type="button"
                    key={p.id}
                    className={`palette-opt${palette === p.id ? " on" : ""}`}
                    onClick={() => {
                      setPalette(p.id);
                      applyPalette({ palette: p.id });
                    }}
                  >
                    <i>{p.colors.map((x) => <b key={x} style={{ background: x }} />)}</i>
                    <span className="small">{p.label}</span>
                  </button>
                ))}
              </div>
              <div className="ob-actions">
                <button type="button" className="secondary" onClick={() => setStep(2)}>تخطّي</button>
                <button type="button" onClick={saveLook} disabled={busy}>{busy ? "جارٍ الحفظ..." : "التالي"}</button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <h1 className="ob-title">أول حلقة</h1>
              <p className="ob-sub">اسم الحلقة وأسماء طلابها (اسم في كل سطر). تستطيع لاحقًا الاستيراد من Excel.</p>
              <div className="two" style={{ marginTop: 12 }}>
                <div>
                  <label>اسم الحلقة</label>
                  <input value={circle.name} onChange={(e) => setCircle({ ...circle, name: e.target.value })} placeholder="حلقة أبي بكر الصديق" />
                </div>
                <div>
                  <label>القسم</label>
                  <select value={circle.section} onChange={(e) => setCircle({ ...circle, section: e.target.value })}>
                    <option value="MALE">ذكور</option>
                    <option value="FEMALE">إناث</option>
                  </select>
                </div>
              </div>
              <div className="field">
                <label>الطلاب</label>
                <textarea rows={6} value={circle.students} onChange={(e) => setCircle({ ...circle, students: e.target.value })} placeholder={"أحمد محمد\nعمر خالد"} />
              </div>
              <div className="ob-actions">
                <button type="button" className="secondary" onClick={() => setStep(3)}>تخطّي</button>
                <button type="button" onClick={saveCircle} disabled={busy}>{busy ? "جارٍ الحفظ..." : "التالي"}</button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div>
              <h1 className="ob-title">أول معلّم</h1>
              <p className="ob-sub">نرسل له رابط دعوة يدخل به ببريده وينضم لمركزك.</p>
              {inviteLink ? (
                <div className="notice" style={{ marginTop: 14 }}>
                  رابط الدعوة (أُرسل بالبريد إن كان مضبوطًا، وتستطيع إرساله بواتساب):
                  <div dir="ltr" style={{ wordBreak: "break-all", marginTop: 6 }}>{inviteLink}</div>
                  <div className="row-actions" style={{ marginTop: 8 }}>
                    <button type="button" className="secondary" onClick={() => navigator.clipboard?.writeText(inviteLink)}>نسخ</button>
                    <a className="btn ghost" href={`https://wa.me/?text=${encodeURIComponent(`دعوة للانضمام إلى ${centerName}: ${inviteLink}`)}`} target="_blank" rel="noreferrer">واتساب</a>
                  </div>
                </div>
              ) : (
                <div className="two" style={{ marginTop: 12 }}>
                  <div>
                    <label>البريد الإلكتروني</label>
                    <input type="email" dir="ltr" value={teacher.email} onChange={(e) => setTeacher({ ...teacher, email: e.target.value })} />
                  </div>
                  <div>
                    <label>الاسم</label>
                    <input value={teacher.name} onChange={(e) => setTeacher({ ...teacher, name: e.target.value })} />
                  </div>
                </div>
              )}
              <div className="ob-actions">
                {!inviteLink && <button type="button" className="secondary" onClick={finish} disabled={busy}>تخطّي وإنهاء</button>}
                {inviteLink ? (
                  <button type="button" onClick={finish} disabled={busy}>الدخول إلى المركز</button>
                ) : (
                  <button type="button" onClick={inviteTeacher} disabled={busy}>{busy ? "..." : "إرسال الدعوة"}</button>
                )}
              </div>
            </div>
          )}
          {error && <p className="error-text">{error}</p>}
        </div>
        <DevCredit compact />
      </div>
    </div>
  );
}
