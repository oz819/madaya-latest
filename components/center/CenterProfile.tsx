"use client";

import { useEffect, useRef, useState } from "react";
import { useApp } from "@/components/AppContext";
import { CenterMark } from "@/components/center/Geo";
import { PALETTES, applyPalette, type Palette } from "@/lib/center";
import { logoDataUrl } from "@/lib/logo";

type Form = {
  name: string;
  about: string;
  logo_url: string | null;
  palette: Palette;
  primary_color: string;
  country: string;
  city: string;
  contact_phone: string;
  contact_email: string;
  whatsapp: string;
  instagram: string;
  facebook: string;
  address: string;
  extra_notes: string;
};

const FIELDS: [keyof Form, string, string?][] = [
  ["country", "الدولة"],
  ["city", "المدينة"],
  ["whatsapp", "واتساب (بالرمز الدولي)", "963993323763"],
  ["contact_phone", "هاتف"],
  ["contact_email", "البريد"],
  ["instagram", "رابط انستغرام", "https://instagram.com/…"],
  ["facebook", "رابط فيسبوك", "https://facebook.com/…"],
  ["address", "العنوان"],
];

// بيانات المركز (المرحلة 0): the name, logo, about paragraph and contacts on the centre's public
// page, and its colours — edited here instead of being written in the code.
export default function CenterProfile() {
  const { supabase, center, showToast, refreshCenter } = useApp();
  const [saved, setSaved] = useState<Form | null>(null);
  const [f, setF] = useState<Form | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // A late answer (a slow network, or React running the effect twice) must not undo edits.
    let stale = false;
    supabase
      .from("centers")
      .select("*")
      .eq("id", center.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (stale) return;
        if (error || !data) return setError(error?.message || "تعذّر تحميل بيانات المركز");
        const v: Form = {
          name: data.name,
          about: data.about ?? "",
          logo_url: data.logo_url,
          palette: (data.palette as Palette) || "indigo",
          primary_color: data.primary_color ?? "",
          country: data.country ?? "",
          city: data.city ?? "",
          contact_phone: data.contact_phone ?? "",
          contact_email: data.contact_email ?? "",
          whatsapp: data.whatsapp ?? "",
          instagram: data.instagram ?? "",
          facebook: data.facebook ?? "",
          address: data.address ?? "",
          extra_notes: data.extra_notes ?? "",
        };
        setSaved(v);
        setF(v);
      });
    return () => {
      stale = true;
    };
  }, [supabase, center.id]);

  // Colours are previewed on the whole app while choosing; leaving without saving puts back the
  // centre's saved look (useApp's center is refreshed after a save).
  const savedLook = useRef(center);
  useEffect(() => {
    savedLook.current = center;
  }, [center]);
  useEffect(() => () => applyPalette(savedLook.current), []);

  if (!f) return <div className="card">{error ? <p className="error-text">{error}</p> : <p className="muted">جارٍ التحميل...</p>}</div>;
  const dirty = JSON.stringify(f) !== JSON.stringify(saved);
  const preview = (next: Form) => {
    setF(next);
    applyPalette({ palette: next.palette, primary_color: next.primary_color || null });
  };
  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });

  async function pickLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      setF({ ...f!, logo_url: await logoDataUrl(file) });
      setError("");
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!f) return;
    if (f.name.trim().length < 2) return setError("اكتب اسم المركز");
    if (!navigator.onLine) return setError("حفظ بيانات المركز يحتاج اتصالًا بالإنترنت");
    setBusy(true);
    const clean = (v: string) => v.trim() || null;
    const { error } = await supabase
      .from("centers")
      .update({
        name: f.name.trim(),
        about: clean(f.about),
        logo_url: f.logo_url,
        palette: f.palette,
        primary_color: /^#[0-9a-fA-F]{6}$/.test(f.primary_color) ? f.primary_color.toLowerCase() : null,
        country: clean(f.country),
        city: clean(f.city),
        contact_phone: clean(f.contact_phone),
        contact_email: clean(f.contact_email),
        whatsapp: clean(f.whatsapp)?.replace(/\D/g, "") || null,
        instagram: clean(f.instagram),
        facebook: clean(f.facebook),
        address: clean(f.address),
        extra_notes: clean(f.extra_notes),
      })
      .eq("id", center.id);
    setBusy(false);
    if (error) return setError(error.message.includes("check") ? "تحقق من الحقول (الروابط تبدأ بـ https://)" : error.message);
    setError("");
    setSaved(f);
    await refreshCenter();
    showToast("تم حفظ بيانات المركز");
  }

  return (
    <form className="card" onSubmit={save} noValidate>
      <h3>🏛️ بيانات المركز والهوية</h3>
      <p className="small muted">
        تظهر في صفحة المركز العامة <span dir="ltr">/{center.slug}</span> وفي التطبيق وصفحات الأهل.
      </p>

      <div className="logo-pick" style={{ margin: "10px 0" }}>
        <CenterMark name={f.name} logo={f.logo_url} size={64} />
        <label className="btn ghost" style={{ margin: 0, cursor: "pointer" }}>
          رفع شعار
          <input type="file" accept="image/png,image/jpeg,image/webp" onChange={pickLogo} hidden />
        </label>
        {f.logo_url && (
          <button type="button" className="link" onClick={() => setF({ ...f, logo_url: null })}>
            إزالة الشعار
          </button>
        )}
      </div>

      <div className="formgrid">
        <div className="wide" style={{ gridColumn: "1 / -1" }}>
          <label>اسم المركز</label>
          <input value={f.name} onChange={set("name")} maxLength={120} />
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <label>نبذة مختصرة</label>
          <textarea rows={4} value={f.about} onChange={set("about")} maxLength={2000} />
        </div>
        {FIELDS.map(([k, label, ph]) => (
          <div key={k}>
            <label>{label}</label>
            <input value={f[k] as string} onChange={set(k)} placeholder={ph} dir={["whatsapp", "contact_phone", "contact_email", "instagram", "facebook"].includes(k) ? "ltr" : undefined} />
          </div>
        ))}
      </div>

      <label style={{ marginTop: 14 }}>الألوان</label>
      <div className="palettes">
        {PALETTES.map((p) => (
          <button
            type="button"
            key={p.id}
            className={`palette-opt${f.palette === p.id ? " on" : ""}`}
            onClick={() => preview({ ...f, palette: p.id, primary_color: "" })}
          >
            <i>
              {p.colors.map((c) => (
                <b key={c} style={{ background: c }} />
              ))}
            </i>
            <span className="small">{p.label}</span>
          </button>
        ))}
      </div>

      <div className="color-pick">
        <label style={{ margin: 0 }} htmlFor="cp-color">
          أو لون خاص بالمركز
        </label>
        <input
          id="cp-color"
          type="color"
          value={f.primary_color || (PALETTES.find((p) => p.id === f.palette)?.colors[0] ?? "#2f3e9e")}
          onChange={(e) => preview({ ...f, primary_color: e.target.value })}
        />
        {f.primary_color ? (
          <button type="button" className="link" onClick={() => preview({ ...f, primary_color: "" })}>
            الرجوع لألوان اللوحة
          </button>
        ) : (
          <span className="small muted">اختياري — يغيّر لون الأزرار والعناوين</span>
        )}
      </div>

      <div className="brand-preview" aria-label="معاينة">
        <CenterMark name={f.name || center.name} logo={f.logo_url} size={40} />
        <b>{f.name || center.name}</b>
        <button type="button" tabIndex={-1}>زر</button>
        <span className="badge">شارة</span>
        <span className="small muted">هكذا تظهر في التطبيق وصفحات الأهل</span>
      </div>

      <div style={{ marginTop: 14 }}>
        <label>ملاحظات إضافية تظهر في صفحة المركز</label>
        <textarea rows={3} value={f.extra_notes} onChange={set("extra_notes")} maxLength={4000} placeholder="مثلًا: مواعيد الدوام، شروط التسجيل، إعلان..." />
      </div>

      <div className="row-actions" style={{ marginTop: 12 }}>
        <button type="submit" disabled={!dirty || busy}>
          {busy ? "جارٍ الحفظ..." : "حفظ"}
        </button>
        {dirty && (
          <button
            type="button"
            className="secondary"
            onClick={() => {
              setF(saved);
              applyPalette({ palette: saved?.palette, primary_color: saved?.primary_color || null });
            }}
          >
            تراجع
          </button>
        )}
        <a className="btn ghost" href={`/${center.slug}`} target="_blank" rel="noreferrer">
          فتح صفحة المركز
        </a>
      </div>
      {error && <p className="error-text">{error}</p>}
    </form>
  );
}
