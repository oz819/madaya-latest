"use client";

import { useMemo } from "react";
import { useApp } from "@/components/AppContext";
import { useScope } from "@/components/FilterBar";
import AbsenceAlerts from "@/components/AbsenceAlerts";
import BackupStatus from "@/components/BackupStatus";
import { usePendingRegistrations } from "@/components/Registrations";
import { useHistoryScope } from "@/components/ranking/useHistoryScope";
import { useStore } from "@/lib/offline/store";
import { useRankingSettings } from "@/lib/rankingSettings";
import { periodRange } from "@/lib/ranking";
import { SECTION_LABEL, type Section } from "@/lib/filter";
import { entryRange, type QuranRange } from "@/lib/quran";
import { addDays, todayStr, type Attendance, type Circle } from "@/lib/types";

// 📈 اللوحة (admin): the centre at a glance, within the fixed filter. Everything is computed on
// the device from the synced window (the last 60 days), so it also opens offline.
export default function Dashboard({ openStudent, openManage }: { openStudent: (id: string) => void; openManage: () => void }) {
  const s = useStore();
  const { supabase, mushaf, isPlatformAdmin } = useApp();
  const settings = useRankingSettings(supabase);
  const { scopedCircles, inScope } = useScope();
  const pendingRegs = usePendingRegistrations();
  const today = todayStr();
  const week = periodRange("week", today, settings, { from: today, to: today });
  const month = periodRange("month", today, settings, { from: today, to: today });

  const students = s.all("students").filter((st) => st.active && inScope(st.circle_id));
  const quranBy = s.byStudent("quran_entries");
  const attBy = s.byStudent("attendance");
  const lessons = s.all("circle_lessons");
  // Records count towards the halaqa the student was in on their day (نقل الطلاب).
  const { circleOn } = useHistoryScope();
  const everyone = s.all("students").filter((st) => st.active);

  const perCircle = useMemo(() => {
    return scopedCircles
      .map((c) => {
        const mine = students.filter((st) => st.circle_id === c.id);
        let ayahs = 0;
        const att: Attendance[] = [];
        for (const st of everyone) {
          const ranges = (quranBy.get(st.id) ?? [])
            .filter((e) => e.track === "HIFZ" && !e.deleted_at && e.entry_date >= month.from && e.entry_date <= today && circleOn(st.id, e.entry_date) === c.id)
            .map(entryRange)
            .filter((r): r is QuranRange => !!r);
          if (ranges.length) ayahs += mushaf.coverage(ranges);
          for (const a of attBy.get(st.id) ?? []) if (circleOn(st.id, a.att_date) === c.id) att.push(a);
        }
        return { circle: c, count: mine.length, ayahs, week: rate(att, week.from, today), month: rate(att, month.from, today) };
      })
      .filter((x) => x.count > 0 || x.ayahs > 0);
  }, [scopedCircles, students, everyone, circleOn, quranBy, attBy, mushaf, month.from, week.from, today]);

  const all = everyone.flatMap((st) => (attBy.get(st.id) ?? []).filter((a) => inScope(circleOn(st.id, a.att_date) ?? "")));
  const weekRate = rate(all, week.from, today);
  const monthRate = rate(all, month.from, today);
  const bySection = (["MALE", "FEMALE"] as Section[])
    .map((sec) => ({ sec, n: perCircle.filter((x) => x.circle.section === sec).reduce((a, x) => a + x.count, 0) }))
    .filter((x) => x.n > 0);
  const noSection = perCircle.filter((x) => !x.circle.section).reduce((a, x) => a + x.count, 0);
  const byAyahs = [...perCircle].sort((a, b) => b.ayahs - a.ayahs);
  const quiet = perCircle.filter((x) => !recordedToday(x.circle));

  // A halaqa "recorded today" when it has attendance, a hifz/recitation entry or the day's lesson.
  function recordedToday(c: Circle): boolean {
    const ids = students.filter((st) => st.circle_id === c.id).map((st) => st.id);
    return (
      ids.some((id) => {
        const a = s.get("attendance", `${id}|${today}`);
        return (a && !a.deleted_at) || (quranBy.get(id) ?? []).some((e) => e.entry_date === today && !e.deleted_at);
      }) || lessons.some((l) => l.circle_id === c.id && l.lesson_date === today && !l.deleted_at)
    );
  }

  // Who recorded in the halaqa last, and when: the teacher to call.
  function lastRecord(c: Circle): { teacher: string; date: string } | null {
    let best: { teacher_id: string | null; date: string } | null = null;
    for (const st of students.filter((x) => x.circle_id === c.id)) {
      for (const r of [...(attBy.get(st.id) ?? []).map((a) => ({ teacher_id: a.teacher_id, date: a.att_date, del: a.deleted_at })),
        ...(quranBy.get(st.id) ?? []).map((e) => ({ teacher_id: e.teacher_id, date: e.entry_date, del: e.deleted_at }))]) {
        if (!r.del && r.date < today && (!best || r.date > best.date)) best = r;
      }
    }
    if (!best) return null;
    return { teacher: (best.teacher_id && s.get("profiles", best.teacher_id)?.name) || "—", date: best.date };
  }

  return (
    <section className="dashboard">
      <div className="grid dash-tiles">
        <Tile icon="👨‍🎓" label="الطلاب" value={String(students.length)}>
          <span className="muted">
            {bySection.map((x) => `${SECTION_LABEL[x.sec]} ${x.n}`).join(" · ")}
            {noSection ? `${bySection.length ? " · " : ""}بلا قسم ${noSection}` : ""}
          </span>
        </Tile>
        <Tile icon="📅" label="الحضور هذا الأسبوع" value={pct(weekRate)} progress={weekRate} />
        <Tile icon="🗓️" label="الحضور هذا الشهر" value={pct(monthRate)} progress={monthRate} />
        {pendingRegs !== null && (
          <button className="card stat stat-tile tile-button" onClick={openManage}>
            <span className="stat-icon" aria-hidden="true">
              📝
            </span>
            <div>
              <span className="muted">طلبات تسجيل جديدة</span>
              <b>{pendingRegs}</b>
            </div>
          </button>
        )}
      </div>

      {quiet.length > 0 && (
        <div className="card insight warn-card quiet-card">
          <h3>⏳ لم تُسجَّل تقارير اليوم</h3>
          <p className="muted">حلقات بلا حضور ولا تسميع ولا درس اليوم، ومعها آخر من سجّل فيها</p>
          <ul className="insight-list">
            {quiet.map(({ circle }) => {
              const last = lastRecord(circle);
              return (
                <li key={circle.id}>
                  <b>{circle.name}</b>
                  <span className="muted">{last ? `آخر تسجيل: ${last.teacher} · ${dayAgo(last.date, today)}` : "لا تسجيلات بعد"}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <AbsenceAlerts students={students} open={openStudent} />

      {/* The nightly backup covers the whole platform's database: ours to watch, not each centre's. */}
      {isPlatformAdmin && <BackupStatus />}

      <div className="card">
        <h3>🏫 الحلقات</h3>
        <p className="muted">مرتّبة بالآيات المحفوظة هذا الشهر</p>
        <div className="table-scroll">
          <table className="dash-table">
            <thead>
              <tr>
                <th>#</th>
                <th>الحلقة</th>
                <th>الطلاب</th>
                <th>آيات الشهر</th>
                <th>حضور الأسبوع</th>
                <th>حضور الشهر</th>
              </tr>
            </thead>
            <tbody>
              {byAyahs.map((x, i) => (
                <tr key={x.circle.id}>
                  <td>{x.ayahs > 0 ? ["🥇", "🥈", "🥉"][i] ?? i + 1 : "—"}</td>
                  <td>
                    {x.circle.name}
                    {x.circle.section && <span className="muted"> · {SECTION_LABEL[x.circle.section as Section]}</span>}
                  </td>
                  <td>{x.count}</td>
                  <td>{x.ayahs}</td>
                  <td>{pct(x.week)}</td>
                  <td>{pct(x.month)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!byAyahs.length && <p className="muted">لا توجد حلقات فيها طلاب ضمن هذا الفرز.</p>}
      </div>
    </section>
  );
}

function Tile({ icon, label, value, progress, children }: { icon: string; label: string; value: string; progress?: number | null; children?: React.ReactNode }) {
  return (
    <div className="card stat stat-tile">
      <span className="stat-icon" aria-hidden="true">
        {icon}
      </span>
      <div>
        <span className="muted">{label}</span>
        <b>{value}</b>
        {progress != null && (
          <div className="progress">
            <i style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

/** Present or late out of the recorded days (excused days don't count), or null with none. */
function rate(rows: Attendance[], from: string, to: string): number | null {
  let yes = 0;
  let n = 0;
  for (const r of rows) {
    if (r.deleted_at || r.att_date < from || r.att_date > to || r.status === "EXCUSED") continue;
    n++;
    if (r.status === "PRESENT" || r.status === "LATE") yes++;
  }
  return n ? yes / n : null;
}

function pct(r: number | null): string {
  return r === null ? "—" : `${Math.round(r * 100)}%`;
}

function dayAgo(date: string, today: string): string {
  if (date === addDays(today, -1)) return "أمس";
  if (date === addDays(today, -2)) return "قبل يومين";
  const [y, m, d] = date.split("-").map(Number);
  return new Intl.DateTimeFormat("ar-SY", { weekday: "long", day: "numeric", month: "long" }).format(new Date(y, m - 1, d));
}
