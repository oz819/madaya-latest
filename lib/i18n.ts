// تعدد اللغات: a tiny dictionary-based i18n, set up from the start so every new screen can be
// translated. Arabic is the source language; English covers the platform pages for now.
// Usage: const t = useT(locale); t("signup.title")

export type Locale = "ar" | "en";

const ar = {
  "platform.name": "منصة حلقات",
  "platform.tagline": "إدارة مراكز وحلقات تحفيظ القرآن الكريم",
  "platform.lead": "سجّل مركزك في دقائق، أضف المعلّمين والطلاب، وتابع الحفظ والتلاوة والحضور والتقارير لأولياء الأمور — من الجوال، وحتى بدون إنترنت.",
  "platform.cta": "سجّل مركزك مجانًا",
  "platform.login": "تسجيل الدخول",
  "platform.find": "عندك رابط مركزك؟",
  "platform.go": "اذهب",
  "f.track.t": "الحفظ والتلاوة والمراجعة",
  "f.track.d": "تسجيل يومي آية بآية، وخريطة حفظ لكل طالب.",
  "f.offline.t": "يعمل بدون إنترنت",
  "f.offline.d": "سجّل الحضور والتسميع، ويتزامن كل شيء عند عودة الاتصال.",
  "f.family.t": "أولياء الأمور",
  "f.family.d": "رابط خاص لكل طالب، وتقارير وتنبيهات غياب عبر واتساب.",
  "f.reports.t": "تقارير وشهادات",
  "f.reports.d": "تقارير شهرية، تصدير Excel، وشهادات إتمام الأجزاء.",
  "f.roles.t": "أدوار وصلاحيات",
  "f.roles.d": "صاحب المركز يدعو المدراء والمعلّمين بالبريد، ولكلٍّ ما يخصه.",
  "f.isolation.t": "بيانات مركزك لك وحدك",
  "f.isolation.d": "عزل كامل على مستوى قاعدة البيانات بين المراكز.",
  "signup.title": "سجّل مركزك",
  "signup.sub": "حساب صاحب المركز يصبح مدير المركز تلقائيًا. التجربة مجانية لمدة 30 يومًا.",
  "signup.center": "اسم المركز",
  "signup.slug": "رابط المركز",
  "signup.slugHint": "أحرف إنجليزية صغيرة وأرقام وشرطات",
  "signup.country": "الدولة",
  "signup.city": "المدينة",
  "signup.you": "اسمك",
  "signup.email": "البريد الإلكتروني",
  "signup.password": "كلمة المرور (8 أحرف على الأقل)",
  "signup.submit": "إنشاء الحساب",
  "signup.have": "عندك حساب؟",
  "signup.check": "أرسلنا رابط تأكيد إلى بريدك. افتحه لإكمال إعداد مركزك.",
  "lang.switch": "English",
} as const;

export type Key = keyof typeof ar;

const en: Record<Key, string> = {
  "platform.name": "Halaqat",
  "platform.tagline": "Run Quran memorization centers and circles",
  "platform.lead": "Register your center in minutes, add teachers and students, and track memorization, recitation, attendance and parent reports — on any phone, even offline.",
  "platform.cta": "Register your center — free",
  "platform.login": "Sign in",
  "platform.find": "Have your center's link?",
  "platform.go": "Go",
  "f.track.t": "Memorization & recitation",
  "f.track.d": "Daily, verse-by-verse records and a memorization map per student.",
  "f.offline.t": "Works offline",
  "f.offline.d": "Take attendance and recitation offline; it syncs when you're back online.",
  "f.family.t": "Parents",
  "f.family.d": "A private link per student, reports and absence alerts on WhatsApp.",
  "f.reports.t": "Reports & certificates",
  "f.reports.d": "Monthly reports, Excel export and juz' completion certificates.",
  "f.roles.t": "Roles & permissions",
  "f.roles.d": "The owner invites admins and teachers by email; each sees what is theirs.",
  "f.isolation.t": "Your data is yours",
  "f.isolation.d": "Full database-level isolation between centers.",
  "signup.title": "Register your center",
  "signup.sub": "The owner's account becomes the center's admin. Free 30-day trial.",
  "signup.center": "Center name",
  "signup.slug": "Center link",
  "signup.slugHint": "lowercase letters, digits and dashes",
  "signup.country": "Country",
  "signup.city": "City",
  "signup.you": "Your name",
  "signup.email": "Email",
  "signup.password": "Password (8+ characters)",
  "signup.submit": "Create account",
  "signup.have": "Already have an account?",
  "signup.check": "We sent a confirmation link to your email. Open it to finish setting up your center.",
  "lang.switch": "العربية",
};

const dict: Record<Locale, Record<Key, string>> = { ar, en };

export function t(locale: Locale, key: Key): string {
  return dict[locale][key] ?? ar[key];
}

export function dirOf(locale: Locale): "rtl" | "ltr" {
  return locale === "ar" ? "rtl" : "ltr";
}
