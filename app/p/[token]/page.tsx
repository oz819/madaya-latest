import type { Metadata } from "next";
import { createClient } from "@/utils/supabase/server";
import { Mushaf, entryRange, type QuranRange } from "@/lib/quran";
import { ATTENDANCE_LABEL, TRACK_LABEL, type AttendanceStatus, type QuranTrack, type Surah } from "@/lib/types";
import { juzProgress } from "@/lib/juz";
import JuzGrid from "@/components/JuzGrid";
import PublicShell from "@/components/PublicShell";

// The family's page (رابط ولي الأمر): read-only, no login, opened by the student's private token.
// Everything comes from guardian_view(), which returns this one student or nothing.

export const metadata: Metadata = {
  title: "متابعة الطالب — حلقات القرآن",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

type Range = { from_surah_no: number | null; from_ayah: number | null; to_surah_no: number | null; to_ayah: number | null };
type View = {
  student: { name: string; circle: string | null; section: string | null };
  surahs: Surah[];
  hifz: (Range & { entry_date: string })[];
  recent: (Range & { entry_date: string; track: QuranTrack; quality: string | null })[];
  attendance: { att_date: string; status: AttendanceStatus }[];
  lessons: { lesson_date: string; title: string }[];
  exams?: { exam_date: string; kind: string; juz_no: number | null; surah_no: number | null; score: number; passed: boolean }[];
  goal?: { weekly_ayahs: number; done: number } | null;
  center?: { name: string; slug: string; logo_url: string | null; palette: "indigo" | "navy" | "plum" | "slate"; primary_color: string | null };
};

export default async function GuardianPage({ params }: PageProps<"/p/[token]">) {
  const { token } = await params;
  const supabase = await createClient();
  const { data } = await supabase.rpc("guardian_view", { p_token: token });
  const v = data as unknown as View | null;

  if (!v) {
    return (
      <PublicShell>
        <div className="card center">
          <h2>الرابط غير صالح</h2>
          <p className="muted">ربما تغيّر الرابط أو انتهى. اطلبوا الرابط الجديد من محفّظ الحلقة.</p>
        </div>
      </PublicShell>
    );
  }

  const mushaf = new Mushaf(v.surahs);
  const ranges = v.hifz.map(entryRange).filter((r): r is QuranRange => !!r);
  const memorized = mushaf.coverage(ranges);
  const percent = mushaf.total ? Math.round((memorized / mushaf.total) * 1000) / 10 : 0;
  // The server clock is UTC; the month is the centre's.
  const month = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Damascus" }).format(new Date()).slice(0, 7);
  const monthRanges = v.hifz.filter((e) => e.entry_date.startsWith(month)).map(entryRange).filter((r): r is QuranRange => !!r);
  const juz = juzProgress(mushaf, ranges);
  const fullJuz = juz.filter((j) => j.percent === 100).length;

  const counted = v.attendance.filter((a) => a.status !== "EXCUSED");
  const present = counted.filter((a) => a.status === "PRESENT" || a.status === "LATE").length;
  const attRate = counted.length ? Math.round((present / counted.length) * 100) : null;

  // The last 14 days, newest first: what was recited, attendance, and the lesson if present.
  const attBy = new Map(v.attendance.map((a) => [a.att_date, a.status]));
  const lessonBy = new Map(v.lessons.map((l) => [l.lesson_date, l.title]));
  const days = [...new Set([...v.recent.map((e) => e.entry_date), ...v.attendance.slice(0, 14).map((a) => a.att_date)])]
    .filter((d) => v.recent.some((e) => e.entry_date === d) || attBy.has(d))
    .sort()
    .reverse()
    .slice(0, 14);

  return (
    <PublicShell center={v.center}>
      <div className="card guardian-head">
        <h2>{v.student.name}</h2>
        <span className="muted">{v.student.circle ?? ""}</span>
      </div>

      <div className="grid guardian-stats">
        <div className="card stat">
          <span className="muted">المحفوظ من القرآن</span>
          <b>{percent}%</b>
          <span className="small muted">
            {memorized} آية{fullJuz ? ` · ${fullJuz} ${fullJuz <= 10 ? "أجزاء" : "جزءًا"} كاملة` : ""}
          </span>
          <div className="progress">
            <i style={{ width: `${Math.min(100, percent)}%` }} />
          </div>
        </div>
        <div className="card stat">
          <span className="muted">حفظ هذا الشهر</span>
          <b>{mushaf.coverage(monthRanges)} آية</b>
        </div>
        <div className="card stat">
          <span className="muted">نسبة الحضور (آخر 30 يومًا)</span>
          <b>{attRate === null ? "—" : `${attRate}%`}</b>
          {attRate !== null && (
            <div className="progress">
              <i style={{ width: `${attRate}%` }} />
            </div>
          )}
        </div>
        {v.goal && (
          <div className="card stat">
            <span className="muted">هدف الأسبوع</span>
            <b>
              {Math.min(v.goal.done, v.goal.weekly_ayahs)} / {v.goal.weekly_ayahs} آية
            </b>
            <div className="progress">
              <i style={{ width: `${Math.min(100, Math.round((v.goal.done / v.goal.weekly_ayahs) * 100))}%` }} />
            </div>
          </div>
        )}
      </div>

      <div className="card">
        <h3>📖 خريطة الحفظ</h3>
        <JuzGrid juz={juz} />
        <p className="small muted">الأخضر: جزء محفوظ كاملًا · الملوّن جزئيًا: بدأ حفظه</p>
      </div>

      {v.exams && v.exams.length > 0 && (
        <div className="card">
          <h3>📝 الاختبارات</h3>
          <ul className="history">
            {v.exams.map((x, i) => (
              <li key={i}>
                <span>
                  {x.kind === "JUZ" ? `اختبار الجزء ${x.juz_no}` : x.kind === "SURAH" ? `اختبار سورة ${mushaf.name(x.surah_no)}` : "السبر الشهري"}
                  <span className="muted"> · {x.exam_date}</span>
                </span>
                <span className={`badge ${x.passed ? "excellent" : "warn"}`}>
                  {x.score} {x.passed ? "· ناجح" : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="card">
        <h3>🗓️ آخر الأيام</h3>
        {days.length ? (
          <ul className="guardian-days">
            {days.map((d) => {
              const status = attBy.get(d);
              const lesson = status === "PRESENT" || status === "LATE" ? lessonBy.get(d) : undefined;
              return (
                <li key={d}>
                  <div className="day-head">
                    <b>{dayLabel(d)}</b>
                    {status && <span className={`badge ${status === "ABSENT" ? "redo" : status === "EXCUSED" ? "warn" : "excellent"}`}>{ATTENDANCE_LABEL[status]}</span>}
                  </div>
                  {v.recent
                    .filter((e) => e.entry_date === d)
                    .map((e, i) => (
                      <div key={i}>
                        {TRACK_LABEL[e.track]}: {mushaf.formatRange(entryRange(e))}
                        {e.quality && <span className="muted"> ({e.quality})</span>}
                      </div>
                    ))}
                  {lesson && <div>الدرس: {lesson}</div>}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="muted">لا توجد تسجيلات في آخر أسبوعين.</p>
        )}
      </div>
    </PublicShell>
  );
}

function dayLabel(d: string): string {
  const [y, m, day] = d.split("-").map(Number);
  try {
    return new Intl.DateTimeFormat("ar-SY", { weekday: "long", day: "numeric", month: "long" }).format(new Date(y, m - 1, day));
  } catch {
    return d;
  }
}
