"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { NOT_REGISTERED_MESSAGE } from "@/lib/messages";
import DevCredit from "@/components/landing/DevCredit";
import { CenterMark } from "@/components/center/Geo";

type Mode = "code" | "password";

// Sign-in for a centre's staff: a 6-digit code by email (as before) or email + password (accounts
// made by "سجّل مركزك" have one). `allowCreate` lets an invited person make their login on the way.
export default function LoginDialog({
  title,
  subtitle,
  logo,
  next = "/",
  defaultEmail = "",
  allowCreate = false,
  onClose,
}: {
  title: string;
  subtitle?: string;
  logo?: string | null;
  next?: string;
  defaultEmail?: string;
  allowCreate?: boolean;
  onClose?: () => void;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("code");
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState(defaultEmail);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!onClose) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function done() {
    router.replace(next);
    router.refresh();
  }

  async function sendCode(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    // Read the field off the form: some autofill fills the DOM value without a React onChange.
    const submitted = (new FormData(e.currentTarget).get("email") as string | null)?.trim() ?? "";
    if (!submitted) return setError("الرجاء إدخال البريد الإلكتروني.");
    setEmail(submitted);
    setLoading(true);
    const { error } = await createClient().auth.signInWithOtp({ email: submitted, options: { shouldCreateUser: allowCreate } });
    setLoading(false);
    if (error) {
      return setError(
        error.code === "otp_disabled" || error.code === "signup_disabled" || error.code === "user_not_found"
          ? NOT_REGISTERED_MESSAGE
          : error.code === "over_email_send_rate_limit"
            ? "تم إرسال عدد كبير من الطلبات. انتظر قليلًا ثم أعد المحاولة."
            : error.code === "unexpected_failure"
              ? "تعذّر إرسال البريد الإلكتروني حاليًا بسبب مشكلة في خدمة البريد. أعد المحاولة لاحقًا."
              : `تعذّر إرسال الكود (${error.code ?? error.status ?? "خطأ غير معروف"}).`
      );
    }
    setStep("code");
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const { error } = await createClient().auth.verifyOtp({ email: email.trim(), token: code.trim(), type: "email" });
    setLoading(false);
    if (error) return setError(error.code === "otp_expired" ? "الكود غير صحيح أو منتهي الصلاحية." : `تعذّر تأكيد الكود (${error.code ?? error.status}).`);
    done();
  }

  async function signInPassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const form = new FormData(e.currentTarget);
    const em = (form.get("email") as string | null)?.trim() ?? "";
    const pw = (form.get("password") as string | null) ?? "";
    if (!em || !pw) return setError("اكتب البريد الإلكتروني وكلمة المرور.");
    setLoading(true);
    const { error } = await createClient().auth.signInWithPassword({ email: em, password: pw });
    setLoading(false);
    if (error) {
      return setError(
        error.code === "invalid_credentials"
          ? "البريد أو كلمة المرور غير صحيحة."
          : error.code === "email_not_confirmed"
            ? "أكّد بريدك الإلكتروني أولًا من الرسالة التي وصلتك."
            : error.code === "over_request_rate_limit"
              ? "محاولات كثيرة. انتظر قليلًا ثم أعد المحاولة."
              : `تعذّر تسجيل الدخول (${error.code ?? error.status}).`
      );
    }
    done();
  }

  const box = (
    <div className="loginbox" role="dialog" aria-modal="true" aria-label="تسجيل الدخول" onClick={(e) => e.stopPropagation()}>
      {onClose && (
        <button type="button" className="login-close" onClick={onClose} aria-label="إغلاق">
          ✕
        </button>
      )}
      <div className="lg-head">
        <CenterMark name={title} logo={logo} size={64} />
        <h2>{title}</h2>
        <p>{subtitle ?? "دخول الإدارة والمعلّمين"}</p>
      </div>

      {process.env.NEXT_PUBLIC_DEMO === "1" && (
        <p className="notice" style={{ marginTop: 12 }}>
          نسخة تجريبية ببيانات وهمية: <b dir="ltr">admin@demo.com</b> (مضايا) أو <b dir="ltr">doha@demo.com</b> (الدوحة) أو{" "}
          <b dir="ltr">both@demo.com</b> (معلّم بالمركزين) أو <b dir="ltr">super@demo.com</b> (إدارة المنصة) — الكود <b dir="ltr">123456</b> أو كلمة
          المرور <b dir="ltr">demo1234</b>.
        </p>
      )}
      <div className="seg" role="tablist" aria-label="طريقة الدخول">
        <button type="button" role="tab" aria-selected={mode === "code"} className={mode === "code" ? "on" : ""} onClick={() => { setMode("code"); setError(""); }}>
          كود بالبريد
        </button>
        <button type="button" role="tab" aria-selected={mode === "password"} className={mode === "password" ? "on" : ""} onClick={() => { setMode("password"); setError(""); }}>
          كلمة المرور
        </button>
      </div>

      {mode === "password" ? (
        <form onSubmit={signInPassword}>
          <div className="field">
            <label htmlFor="lg-email">البريد الإلكتروني</label>
            <input id="lg-email" type="email" name="email" defaultValue={email} required autoComplete="email" dir="ltr" />
          </div>
          <div className="field">
            <label htmlFor="lg-pass">كلمة المرور</label>
            <input id="lg-pass" type="password" name="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" dir="ltr" />
          </div>
          <button type="submit" className="btn-block" disabled={loading}>
            {loading ? "جارٍ الدخول..." : "دخول"}
          </button>
          <p className="small center" style={{ marginTop: 10 }}>
            <Link href="/forgot-password">نسيت كلمة المرور؟</Link>
          </p>
        </form>
      ) : step === "email" ? (
        <form onSubmit={sendCode}>
          <div className="field">
            <label htmlFor="lg-email2">البريد الإلكتروني</label>
            <input id="lg-email2" type="email" name="email" defaultValue={email} required autoFocus autoComplete="email" dir="ltr" />
          </div>
          <button type="submit" className="btn-block" disabled={loading}>
            {loading ? "جارٍ الإرسال..." : "إرسال كود الدخول"}
          </button>
        </form>
      ) : (
        <form onSubmit={verifyCode}>
          <div className="notice" style={{ marginTop: 12 }}>
            أُرسل كود من 6 أرقام إلى <b dir="ltr">{email}</b>. تفقّد بريدك (والرسائل غير المرغوبة أيضًا).
          </div>
          <div className="field">
            <label htmlFor="lg-code">كود الدخول</label>
            <input
              id="lg-code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              className="otp-input"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              required
              autoFocus
            />
          </div>
          <button type="submit" className="btn-block" disabled={loading || code.length !== 6}>
            {loading ? "جارٍ التحقق..." : "تأكيد الدخول"}
          </button>
          <button type="button" className="secondary btn-block" style={{ marginTop: 8 }} onClick={() => { setStep("email"); setCode(""); setError(""); }} disabled={loading}>
            تغيير البريد الإلكتروني
          </button>
        </form>
      )}
      {error && <p className="error-text">{error}</p>}
      <DevCredit compact />
    </div>
  );

  if (!onClose) return box;
  return (
    <div className="login-overlay" onClick={onClose}>
      {box}
    </div>
  );
}
