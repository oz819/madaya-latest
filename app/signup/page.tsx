"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import DevCredit from "@/components/landing/DevCredit";
import { GeoStar } from "@/components/center/Geo";
import { SLUG_RE, applyPalette, slugify, type PendingCenter } from "@/lib/center";
import { dirOf, t, type Key, type Locale } from "@/lib/i18n";

// سجّل مركزك: the owner's account (email + password) and the centre's basics. After the email is
// confirmed, /onboarding creates the centre with these details and the owner becomes its admin.
export default function SignupPage() {
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const [locale, setLocale] = useState<Locale>("ar");
  const tr = (k: Key) => t(locale, k);
  const [f, setF] = useState({ name: "", slug: "", country: "", city: "", owner: "", email: "", password: "", website: "" });
  const [slugTouched, setSlugTouched] = useState(false);
  const [slugTaken, setSlugTaken] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [host, setHost] = useState("");
  useEffect(() => setHost(location.host), []);

  useEffect(() => applyPalette({ palette: "indigo" }), []);
  // Already signed in: the centre is created straight away in the wizard.
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace("/onboarding?new=1");
    });
  }, [supabase, router]);

  // Is the link free? (public_center only finds active centres; create_center re-checks.)
  useEffect(() => {
    if (!SLUG_RE.test(f.slug)) return setSlugTaken(false);
    const id = setTimeout(async () => {
      const { data } = await supabase.rpc("public_center", { p_slug: f.slug });
      setSlugTaken(!!data);
    }, 350);
    return () => clearTimeout(id);
  }, [f.slug, supabase]);

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setF((x) => ({ ...x, [k]: v, ...(k === "name" && !slugTouched ? { slug: slugify(v) } : {}) }));
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (f.website) return setSent(true); // a bot filled the hidden field
    if (f.name.trim().length < 2) return setError("اكتب اسم المركز");
    if (!SLUG_RE.test(f.slug)) return setError(`${tr("signup.slug")}: ${tr("signup.slugHint")} (3–40)`);
    if (slugTaken) return setError("هذا الرابط مستخدم، اختر غيره");
    if (f.owner.trim().length < 2) return setError("اكتب اسمك");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email.trim())) return setError("اكتب بريدًا صحيحًا");
    if (f.password.length < 8) return setError("كلمة المرور 8 أحرف على الأقل");
    setBusy(true);
    const pending: PendingCenter = { name: f.name.trim(), slug: f.slug, country: f.country.trim(), city: f.city.trim(), owner: f.owner.trim() };
    const { data, error } = await supabase.auth.signUp({
      email: f.email.trim(),
      password: f.password,
      options: { emailRedirectTo: `${location.origin}/auth/confirm?next=/onboarding`, data: { name: pending.owner, pending_center: pending } },
    });
    setBusy(false);
    if (error) {
      return setError(
        error.code === "user_already_exists"
          ? "لهذا البريد حساب من قبل. ادخل به ثم أنشئ مركزك."
          : error.code === "over_email_send_rate_limit" || error.code === "over_request_rate_limit"
            ? "محاولات كثيرة. انتظر قليلًا ثم أعد المحاولة."
            : error.code === "weak_password"
              ? "كلمة المرور ضعيفة، اختر أطول"
              : error.code === "signup_disabled"
                ? "التسجيل مغلق حاليًا."
                : error.message
      );
    }
    if (data.session) router.replace("/onboarding");
    else setSent(true);
  }

  return (
    <div className="ob geo-bg" dir={dirOf(locale)} lang={locale}>
      <div className="ob-box">
        <div className="cx-nav" style={{ padding: "0 0 8px" }}>
          <Link href="/login" className="cx-brand">
            <span className="header-mark" style={{ width: 34, height: 34 }}>ح</span>
            <span>{tr("platform.name")}</span>
          </Link>
          <button type="button" className="link" onClick={() => setLocale(locale === "ar" ? "en" : "ar")}>
            {tr("lang.switch")}
          </button>
        </div>
        <div className="card" style={{ padding: 22 }}>
          <GeoStar style={{ width: 44, height: 44, opacity: 0.8 }} />
          <h1 className="ob-title" style={{ marginTop: 8 }}>{tr("signup.title")}</h1>
          <p className="ob-sub">{tr("signup.sub")}</p>

          {sent ? (
            <div className="notice" style={{ marginTop: 16 }}>{tr("signup.check")}</div>
          ) : (
            <form onSubmit={submit} noValidate>
              <div className="field">
                <label htmlFor="s-name">{tr("signup.center")}</label>
                <input id="s-name" value={f.name} onChange={set("name")} maxLength={120} required />
              </div>
              <div className="field">
                <label htmlFor="s-slug">{tr("signup.slug")}</label>
                <div className="slug-input">
                  <span>{host}/</span>
                  <input
                    id="s-slug"
                    value={f.slug}
                    onChange={(e) => {
                      setSlugTouched(true);
                      setF({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") });
                    }}
                    maxLength={40}
                    placeholder="my-center"
                  />
                </div>
                <p className="small muted" style={{ margin: "4px 0 0" }}>
                  {slugTaken ? <span className="error-text">هذا الرابط مستخدم</span> : tr("signup.slugHint")}
                </p>
              </div>
              <div className="two" style={{ marginTop: 12 }}>
                <div>
                  <label htmlFor="s-country">{tr("signup.country")}</label>
                  <input id="s-country" value={f.country} onChange={set("country")} maxLength={60} />
                </div>
                <div>
                  <label htmlFor="s-city">{tr("signup.city")}</label>
                  <input id="s-city" value={f.city} onChange={set("city")} maxLength={60} />
                </div>
              </div>
              <div className="field">
                <label htmlFor="s-owner">{tr("signup.you")}</label>
                <input id="s-owner" value={f.owner} onChange={set("owner")} maxLength={100} autoComplete="name" />
              </div>
              <div className="field">
                <label htmlFor="s-email">{tr("signup.email")}</label>
                <input id="s-email" type="email" dir="ltr" value={f.email} onChange={set("email")} autoComplete="email" />
              </div>
              <div className="field">
                <label htmlFor="s-pass">{tr("signup.password")}</label>
                <input id="s-pass" type="password" dir="ltr" value={f.password} onChange={set("password")} autoComplete="new-password" />
              </div>
              {/* Spam trap: hidden from people, filled by bots. */}
              <input name="website" value={f.website} onChange={set("website")} tabIndex={-1} autoComplete="off" aria-hidden="true" style={{ position: "absolute", left: -9999, width: 1, height: 1, opacity: 0 }} />
              <button type="submit" className="btn-block" disabled={busy}>
                {busy ? "..." : tr("signup.submit")}
              </button>
              {error && <p className="error-text">{error}</p>}
              <p className="small center" style={{ marginTop: 12 }}>
                {tr("signup.have")} <Link href="/login">{tr("platform.login")}</Link>
              </p>
            </form>
          )}
        </div>
        <DevCredit compact />
      </div>
    </div>
  );
}
