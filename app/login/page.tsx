"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Amiri, Reem_Kufi } from "next/font/google";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { NOT_REGISTERED_MESSAGE } from "@/lib/messages";
import { FacebookIcon, GitHubIcon, InstagramIcon, WhatsAppIcon } from "@/components/SocialIcons";
import StarField from "@/components/landing/StarField";
import DevCredit from "@/components/landing/DevCredit";
import Features from "@/components/landing/Features";
import { useReveal } from "@/components/landing/useReveal";

// Amiri for the about text, Reem Kufi for headings (exposed as CSS variables, see globals.css).
const amiri = Amiri({ subsets: ["arabic"], weight: ["400", "700"], variable: "--font-amiri", display: "swap" });
const reemKufi = Reem_Kufi({ subsets: ["arabic"], variable: "--font-reem-kufi", display: "swap" });

const SOCIAL_LINKS = [
  { href: "https://www.facebook.com/share/1HjPsLvumo/", label: "صفحتنا على فيسبوك", Icon: FacebookIcon },
  { href: "https://www.instagram.com/lmrkzlthqfyldwy", label: "حسابنا على انستغرام", Icon: InstagramIcon },
  { href: "https://wa.me/963993323763", label: "تواصل معنا عبر واتساب", Icon: WhatsAppIcon },
];

const MARQUEE = ["حفظ", "تلاوة", "تجويد", "تدبّر", "إتقان", "مراجعة", "إجازة"];

const JOURNEY: [string, string][] = [
  ["التسجيل", "يملأ وليّ الأمر طلب التسجيل من الموقع خلال دقيقة."],
  ["الحلقة", "يُوزَّع الطالب على حلقة تناسب عمره ومستواه."],
  ["التسميع اليومي", "يسمّع حفظه ومراجعته، ويُسجَّل التقدير فورًا."],
  ["خريطة الحفظ", "كل جزء يحفظه يضيء على خريطته."],
  ["متابعة الأهل", "تقارير دورية وتنبيه عند الغياب تصل وليّ الأمر."],
  ["الاختبار", "اختبار عند إتمام كل جزء."],
  ["الشهادة والتكريم", "شهادة إتمام، وتكريم للمتفوّقين."],
];

type Step = "email" | "code";

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  // The page opens on the centre's landing view; the existing login form shows in a dialog.
  const [showLogin, setShowLogin] = useState(false);
  useReveal();

  useEffect(() => {
    if (!showLogin) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setShowLogin(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showLogin]);

  async function sendCode(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    // Read the field straight off the form instead of trusting the `email` state: some browsers
    // (Chrome autofill on Android especially) fill the input's DOM value without firing a React
    // onChange, which would otherwise send an empty email to Supabase.
    const submittedEmail = (new FormData(e.currentTarget).get("email") as string | null)?.trim() ?? "";
    if (!submittedEmail) {
      setError("الرجاء إدخال البريد الإلكتروني.");
      return;
    }
    setEmail(submittedEmail);

    setLoading(true);
    const supabase = createClient();
    // shouldCreateUser: false — only accounts the admin created can sign in (spec §3.2). For an
    // unknown email Supabase answers otp_disabled / signup_disabled and no auth.users row is
    // created. This flag is only page code; the real block is "Allow new users to sign up" being
    // off in the Supabase dashboard (see README).
    const { error } = await supabase.auth.signInWithOtp({
      email: submittedEmail,
      options: { shouldCreateUser: false },
    });
    setLoading(false);
    if (error) {
      // unexpected_failure here is Supabase relaying a hard SMTP-provider rejection (e.g. a
      // sender-domain restriction) — a real delivery failure, not a client bug. Say so plainly
      // instead of a bare status code; never claim the code was sent when it wasn't.
      setError(
        error.code === "otp_disabled" || error.code === "signup_disabled" || error.code === "user_not_found"
          ? NOT_REGISTERED_MESSAGE
          : error.code === "over_email_send_rate_limit"
          ? "تم إرسال عدد كبير من الطلبات. انتظر قليلًا ثم أعد المحاولة."
          : error.code === "unexpected_failure"
          ? "تعذّر إرسال البريد الإلكتروني حاليًا بسبب مشكلة في خدمة البريد. أعد المحاولة لاحقًا أو تواصل مع المدير."
          : `تعذّر إرسال الكود (${error.code ?? error.status ?? "خطأ غير معروف"}). راجع الإعداد أو تواصل مع المدير.`
      );
      return;
    }
    setStep("code");
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: code.trim(),
      type: "email",
    });
    setLoading(false);
    if (error) {
      setError(
        error.code === "otp_expired"
          ? "الكود غير صحيح أو منتهي الصلاحية."
          : `تعذّر تأكيد الكود (${error.code ?? error.status ?? "خطأ غير معروف"}).`
      );
      return;
    }

    router.replace("/");
    router.refresh();
  }

  function backToEmail() {
    setStep("email");
    setCode("");
    setError("");
  }

  return (
    <div className={`lx ${amiri.variable} ${reemKufi.variable}`} dir="rtl" lang="ar">
      <header className="lx-nav">
        <a href="#top" className="lx-brand">
          <Image src="/images/logo.png" alt="" width={40} height={40} />
          <span>مركز مضايا</span>
        </a>
        <nav className="lx-links" aria-label="أقسام الصفحة">
          <a href="#about">عن المركز</a>
          <a href="#journey">رحلة الحافظ</a>
          <a href="#features">المنصّة</a>
          <a href="#join">التسجيل</a>
        </nav>
        <button type="button" className="lx-login" onClick={() => setShowLogin(true)} aria-haspopup="dialog">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="12" cy="8" r="4" />
            <path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" />
          </svg>
          <span>تسجيل الدخول</span>
        </button>
      </header>

      <section id="top" className="lx-hero">
        <div className="lx-hero-bg" aria-hidden="true" />
        <StarField className="lx-stars" />
        <div className="lx-hero-text">
          <p className="lx-hadith">«خَيْرُكُم مَنْ تَعَلَّمَ القُرْآنَ وَعَلَّمَهُ»</p>
          <h1 className="lx-title">
            <span className="lx-line"><span>منارةٌ للعلم</span></span>
            <span className="lx-line"><span className="lx-gold">والهدى في مضايا</span></span>
          </h1>
          <p className="lx-lead">
            المركز الثقافي الدعوي في مضايا بريف دمشق: حلقات تحفيظ ودورات علمية وأنشطة للشباب، ومنظومة رقمية تتابع حفظ كل طالب آيةً بآية.
          </p>
          <div className="lx-cta">
            <Link href="/register" className="lx-btn">
              <span>سجّل في الحلقات</span>
              <i aria-hidden="true">←</i>
            </Link>
            <button type="button" className="lx-ghost" onClick={() => setShowLogin(true)}>
              دخول المعلّمين والإدارة
            </button>
          </div>
        </div>
        <div className="lx-hero-foot">
          <span>تأسّس ٢٠٢٥ · بإشراف د. محمد العبده</span>
          <DevCredit compact />
          <span className="lx-scroll" aria-hidden="true"><i /></span>
        </div>
      </section>

      <div className="lx-marquee" aria-hidden="true">
        <div>
          {[0, 1].map((k) => (
            <span key={k}>
              {MARQUEE.map((w, i) => (
                <span key={i} className={i % 2 ? "lx-outline" : ""}>{w}<b>✦</b></span>
              ))}
            </span>
          ))}
        </div>
      </div>

      <section id="about" className="lx-section lx-about" data-reveal>
        <div className="lx-kicker"><i />نبذة عن المركز</div>
        <p className="lx-about-big">
          تأسس المركز عام ٢٠٢٥ في بلدة مضايا بريف دمشق، بعد ترميم مبناه وإعادة تأهيله، ليتحول من مقرٍّ لنشر عقائد حزب البعث إلى <em>منارةٍ للعلم والهدى</em>، وذلك بإشراف{" "}
          <a href="https://alabdah.com/about" target="_blank" rel="noopener noreferrer">د. محمد العبده</a>.
        </p>
        <div className="lx-about-cols">
          <p>يحتضن المركز حلقات تحفيظ القرآن الكريم وتدارسه، ويقيم الدورات العلمية، ويفتح أبوابه للشباب بأنشطة ثقافية وتربوية هادفة يجدون فيها بغيتهم.</p>
          <p className="lx-dua">نسأل الله أن يبارك في هذا المركز وأن يوفقه للاستمرار وأداء رسالته، ولا تنسونا من صالح دعائكم.</p>
        </div>
      </section>

      <section id="journey" className="lx-journey">
        <div className="lx-section lx-head" data-reveal>
          <div className="lx-kicker"><i />من أول يوم إلى الختمة</div>
          <h2>رحلة <span className="lx-gold">الحافظ</span></h2>
        </div>
        <ol className="lx-track">
          {JOURNEY.map(([t, d], i) => (
            <li key={t} data-reveal style={{ transitionDelay: `${i * 70}ms` }}>
              <span className="lx-num">{(i + 1).toLocaleString("ar-EG")}</span>
              <h3>{t}</h3>
              <p>{d}</p>
            </li>
          ))}
        </ol>
      </section>

      <Features />

      <section className="lx-section lx-map" data-reveal>
        <div>
          <div className="lx-kicker"><i />خريطة الحفظ</div>
          <h2>أين وصل ابنك؟<br /><span className="lx-gold">بنظرة واحدة.</span></h2>
          <p className="lx-muted">كل جزء يحفظه الطالب يضيء على خريطته. وليّ الأمر يتابعها من رابطه الخاص، والمعلّم يعرف من يحتاج مراجعة.</p>
        </div>
        <div className="lx-juz" aria-label="مثال توضيحي لخريطة الحفظ">
          {Array.from({ length: 30 }, (_, i) => (
            <span key={i} className={i < 19 ? "on" : i === 19 ? "cur" : ""} style={{ transitionDelay: `${i * 45}ms` }}>
              {(i + 1).toLocaleString("ar-EG")}
            </span>
          ))}
          <small>مثال توضيحي</small>
        </div>
      </section>

      <section id="join" className="lx-section" data-reveal>
        <div className="lx-join">
          <p className="lx-ayah">﴿وَرَتِّلِ الْقُرْآنَ تَرْتِيلًا﴾</p>
          <h2>ابدأ رحلة الحفظ <span className="lx-gold">اليوم</span></h2>
          <p className="lx-muted">التسجيل مفتوح للبنين والبنات. املأ الطلب وتتواصل معك إدارة المركز.</p>
          <Link href="/register" className="lx-btn">
            <span>سجّل الآن</span>
            <i aria-hidden="true">←</i>
          </Link>
          <div className="lx-social" role="navigation" aria-label="روابط التواصل">
            {SOCIAL_LINKS.map(({ href, label, Icon }) => (
              <a key={href} href={href} target="_blank" rel="noopener noreferrer" aria-label={label} title={label}>
                <Icon />
              </a>
            ))}
          </div>
        </div>
      </section>

      <footer className="lx-footer">
        <div className="lx-footer-row">
          <span>المركز الثقافي الدعوي في مضايا · ريف دمشق</span>
          <a href="https://github.com/oz819/madaya" target="_blank" rel="noopener noreferrer" aria-label="الكود المصدري على GitHub">
            <GitHubIcon /> GitHub
          </a>
        </div>
        <DevCredit />
        <div className="lx-giant" aria-hidden="true">مضايا</div>
      </footer>

      {showLogin && (
        <div className="login-overlay" onClick={() => setShowLogin(false)}>
          <div className="loginbox islamic-card" role="dialog" aria-modal="true" aria-label="تسجيل الدخول" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="login-close" onClick={() => setShowLogin(false)} aria-label="إغلاق">
              ✕
            </button>
            <div className="brand">
              <span className="lg-logo"><Image src="/images/logo.png" alt="" width={76} height={76} /></span>
              <h1 className="brand-main">مركز مضايا الثقافي</h1>
              <h2 className="brand-sub">حلقات القرآن</h2>
              <div className="brand-divider" />
            </div>
            <p className="center muted">منظومة متابعة الحفظ والمراجعة والتلاوة والنمو التربوي</p>
            <ol className="lg-steps" aria-label="خطوات الدخول">
              <li className="on">البريد الإلكتروني</li>
              <li className={step === "code" ? "on" : ""}>كود الدخول</li>
            </ol>

            {step === "email" ? (
              <form onSubmit={sendCode} style={{ marginTop: 18 }}>
                <label>البريد الإلكتروني</label>
                <input
                  type="email"
                  name="email"
                  defaultValue={email}
                  required
                  autoFocus
                  autoComplete="email"
                />
                <button type="submit" style={{ width: "100%", marginTop: 13 }} disabled={loading}>
                  {loading ? "جارٍ الإرسال..." : "إرسال كود الدخول"}
                </button>
                {error && <p className="error-text">{error}</p>}
              </form>
            ) : (
              <form onSubmit={verifyCode} style={{ marginTop: 18 }}>
                <div className="notice">
                  أُرسل كود مكوّن من 6 أرقام إلى <b>{email}</b>. تفقّد بريدك (وصندوق الرسائل غير المرغوبة أيضًا).
                </div>
                <label style={{ marginTop: 12 }}>كود الدخول</label>
                <input
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
                <button type="submit" style={{ width: "100%", marginTop: 13 }} disabled={loading || code.length !== 6}>
                  {loading ? "جارٍ التحقق..." : "تأكيد الدخول"}
                </button>
                {error && <p className="error-text">{error}</p>}
                <button
                  type="button"
                  className="secondary"
                  style={{ width: "100%", marginTop: 9 }}
                  onClick={backToEmail}
                  disabled={loading}
                >
                  تغيير البريد الإلكتروني
                </button>
              </form>
            )}
            <DevCredit compact />
          </div>
        </div>
      )}

    </div>
  );
}
