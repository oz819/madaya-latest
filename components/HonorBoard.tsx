import type { Metadata } from "next";
import { createAdminClient } from "@/utils/supabase/admin";
import PublicShell from "@/components/PublicShell";
import type { PublicCenter } from "@/lib/center";
import { Mushaf } from "@/lib/quran";
import { computeRanking, settingsFromRow, weekStartOf, type RankData } from "@/lib/ranking";
import { juzTitle } from "@/lib/exams";
import { membership, rowsInScope, studentsInScope } from "@/lib/transfers";
import { addDays, type Student } from "@/lib/types";
import type { Database } from "@/lib/supabase/database.types";

// لوحة الشرف العامة (/honor): the week's top students per section and new juz' certificates.
// Built here on the server with the service key, so nothing but the shortened names and results
// ever leaves it; there's no public function to query. Shown only while the admin has it on.

export const metadata: Metadata = {
  title: "لوحة الشرف — حلقات القرآن",
  robots: { index: false, follow: false },
};

type Tables = Database["public"]["Tables"];
const TOP = 5;
// lib/filter is client-only; the same two sections.
const SECTIONS = ["MALE", "FEMALE"] as const;
const SECTION_LABEL = { MALE: "الذكور", FEMALE: "الإناث" } as const;
const MEDALS = ["🥇", "🥈", "🥉"];

// One centre's board (the service key bypasses RLS, so every query below filters by its id).
export default async function HonorBoard({ center }: { center: PublicCenter | null }) {
  const board = center ? await load(center.id).catch((e) => {
    console.error("honor board:", e);
    return null;
  }) : null;
  if (!board) {
    return (
      <PublicShell center={center}>
        <div className="card center">
          <h2>لوحة الشرف غير متاحة الآن</h2>
          <p className="muted">تابعونا قريبًا إن شاء الله.</p>
        </div>
      </PublicShell>
    );
  }

  return (
    <PublicShell center={center}>
      <div className="card honor center">
        <h2>🏅 لوحة الشرف</h2>
        <p className="muted">
          {board.lastWeek ? "متفوقو الأسبوع الماضي" : "متفوقو هذا الأسبوع"} · {dayLabel(board.from)} – {dayLabel(board.to)}
        </p>
      </div>
      {board.sections.map((sec) => (
        <div className="card honor" key={sec.section}>
          <h2>⭐ قسم {SECTION_LABEL[sec.section]}</h2>
          <ul className="honor-list">
            {sec.top.map((t, i) => (
              <li key={i}>
                <span className="medal">{MEDALS[t.rank - 1] ?? t.rank}</span>
                <b>{t.name}</b>
              </li>
            ))}
          </ul>
        </div>
      ))}
      {!board.sections.length && (
        <div className="card center">
          <p className="muted">لم تكتمل نتائج هذا الأسبوع بعد.</p>
        </div>
      )}
      {board.certificates.length > 0 && (
        <div className="card honor">
          <h2>🎓 شهادات جديدة</h2>
          <p className="muted">أتمّوا حفظ جزء واجتازوا اختباره خلال آخر 30 يومًا. بارك الله فيهم.</p>
          <ul className="honor-list honor-cert">
            {board.certificates.map((c, i) => (
              <li key={i}>
                <span className="medal">📜</span>
                <b>{c.name}</b>
                <span className="muted">{juzTitle(c.juz)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </PublicShell>
  );
}

async function load(centerId: string) {
  const sb = createAdminClient();
  const { data: row } = await sb.from("ranking_settings").select("*").eq("center_id", centerId).maybeSingle();
  if (!row?.honor_enabled) return null;
  const settings = settingsFromRow(row);
  const { data: c } = await sb.from("centers").select("timezone").eq("id", centerId).maybeSingle();
  // The centre's day, not the server's (UTC).
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: c?.timezone || "Asia/Damascus" }).format(new Date());

  // Every row of a query (the server returns at most 1000 at a time).
  async function all<T extends keyof Tables>(table: T, filter: (q: ReturnType<typeof sel<T>>) => ReturnType<typeof sel<T>>) {
    const out: Tables[T]["Row"][] = [];
    for (let i = 0; ; i += 1000) {
      const { data, error } = await filter(sel(table)).range(i, i + 999);
      if (error) throw new Error(error.message);
      out.push(...((data ?? []) as unknown as Tables[T]["Row"][]));
      if (!data || data.length < 1000) return out;
    }
  }
  function sel<T extends keyof Tables>(table: T) {
    // quran_surahs is shared by all centres; every other table is this centre's rows only.
    const q = sb.from(table).select("*");
    return (table === "quran_surahs" ? q : q.eq("center_id" as never, centerId as never)) as typeof q;
  }

  const [students, circles, surahs, transfers] = await Promise.all([
    all("students", (q) => q.eq("active", true).is("deleted_at", null)),
    all("circles", (q) => q.eq("active", true).is("deleted_at", null)),
    all("quran_surahs", (q) => q),
    all("student_transfers", (q) => q.is("deleted_at", null)),
  ]);
  const mushaf = new Mushaf(surahs);
  const circleOf = new Map(circles.map((c) => [c.id, c]));
  const live = students.filter((s) => circleOf.has(s.circle_id));
  // A student moved between sections counts in each for the days they were there.
  const circleOn = membership(students, transfers);

  async function rank(from: string, to: string) {
    const period = <T extends keyof Tables>(table: T, col: string) => all(table, (q) => q.is("deleted_at", null).gte(col, from).lte(col, to));
    const [quran, attendance, tarbiya, activities, exams] = await Promise.all([
      period("quran_entries", "entry_date"),
      period("attendance", "att_date"),
      period("edu_notes", "record_date"),
      period("activities", "activity_date"),
      period("exams", "exam_date"),
    ]);
    return SECTIONS.map((section) => {
      const inSection = (id: string) => circleOf.get(id)?.section === section;
      const pool = studentsInScope(live, transfers, inSection, from, to) as Student[];
      const data = {
        quran: rowsInScope(quran, (e) => e.entry_date, circleOn, inSection),
        attendance: rowsInScope(attendance, (a) => a.att_date, circleOn, inSection),
        tarbiya: rowsInScope(tarbiya, (n) => n.record_date, circleOn, inSection),
        activities,
        exams: rowsInScope(exams, (x) => x.exam_date, circleOn, inSection),
      } as unknown as RankData;
      const r = computeRanking(pool, data, settings, mushaf, from, to, circleOn);
      return {
        section,
        top: r.ranked
          .filter((x) => x.rank !== null && x.rank <= TOP)
          .map((x) => ({ rank: x.rank!, name: shortName(x.student.name) })),
      };
    }).filter((x) => x.top.length > 0);
  }

  // This week; early in the week, before anyone is ranked, the week before.
  const ws = weekStartOf(today, settings.weekStart);
  let from = ws;
  let to = today;
  let sections = await rank(from, to);
  const lastWeek = sections.length === 0;
  if (lastWeek) {
    from = addDays(ws, -7);
    to = addDays(ws, -1);
    sections = await rank(from, to);
  }

  const since = addDays(today, -29);
  const passed = await all("exams", (q) => q.is("deleted_at", null).eq("kind", "JUZ").eq("passed", true).gte("exam_date", since).order("exam_date", { ascending: false }));
  const byId = new Map(live.map((s) => [s.id, s]));
  const certificates = passed
    .filter((x) => byId.has(x.student_id) && x.juz_no)
    .map((x) => ({ name: shortName(byId.get(x.student_id)!.name), juz: x.juz_no! }));

  return { from, to, lastWeek, sections, certificates };
}

/** «محمد أحمد الخطيب» → «محمد خ.»: the first name and the family name's initial, for privacy. */
function shortName(full: string): string {
  const words = full.trim().split(/\s+/).filter(Boolean);
  if (words.length < 2) return words[0] ?? "";
  const last = words[words.length - 1].replace(/^ال(?=\S{2})/, "");
  return `${words[0]} ${last[0]}.`;
}

function dayLabel(d: string): string {
  const [y, m, day] = d.split("-").map(Number);
  return new Intl.DateTimeFormat("ar-SY", { day: "numeric", month: "long" }).format(new Date(y, m - 1, day));
}
