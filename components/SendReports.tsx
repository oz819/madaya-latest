"use client";

import { useMemo, useState } from "react";
import { useApp } from "@/components/AppContext";
import Panel from "@/components/Panel";
import { useScope } from "@/components/FilterBar";
import { useRankData } from "@/components/ranking/useRankData";
import { useHistoryScope } from "@/components/ranking/useHistoryScope";
import { LOCAL_WINDOW_DAYS, store, useStore } from "@/lib/offline/store";
import { computeRanking } from "@/lib/ranking";
import { useRankingSettings } from "@/lib/rankingSettings";
import { formatPhone, normalizePhone, waLink } from "@/lib/guardian";
import { examLines } from "@/lib/exams";
import { dailyMessage, dayLines, dayName, monthName, monthStats, monthlyMessage, type MonthStats } from "@/lib/familyMessages";
import { addDays, localDateStr, todayStr, type SendKind, type Student } from "@/lib/types";

type Mode = "DAILY" | "MONTHLY";
type Show = "all" | "unsent" | "nophone";

// إرسال تقارير الحلقة: every student in the filter with their family's message ready. «إرسال»
// opens WhatsApp to the guardian's number with the text filled in and marks it sent (on every
// device), so the teacher sees where they got to. Also the month's summary (ملخص الشهر).
export default function SendReports({ onClose }: { onClose: () => void }) {
  const s = useStore();
  const { mushaf, supabase } = useApp();
  const { inScope, label } = useScope();
  const settings = useRankingSettings(supabase);
  const [mode, setMode] = useState<Mode>("DAILY");
  const [date, setDate] = useState(todayStr());
  const [month, setMonth] = useState(todayStr().slice(0, 7));
  const [show, setShow] = useState<Show>("all");

  const students = s
    .all("students")
    .filter((st) => st.active && inScope(st.circle_id))
    .sort((a, b) => a.name.localeCompare(b.name, "ar"));

  const [y, m] = month.split("-").map(Number);
  const monthFrom = `${month}-01`;
  const monthTo = localDateStr(new Date(y, m, 0));
  const rankData = useRankData(monthFrom, monthTo, null);
  // Attendance days counted in the halaqa the student was in on each day (نقل الطلاب).
  const { circleOn } = useHistoryScope();

  // Rank within each halaqa for the month summary.
  const ranks = useMemo(() => {
    const out = new Map<string, { rank: number | null; of: number }>();
    if (mode !== "MONTHLY") return out;
    const byCircle = new Map<string, Student[]>();
    for (const st of s.all("students").filter((x) => x.active)) {
      const list = byCircle.get(st.circle_id) ?? [];
      list.push(st);
      byCircle.set(st.circle_id, list);
    }
    for (const list of byCircle.values()) {
      const r = computeRanking(list, rankData.data, settings, mushaf, monthFrom, monthTo, circleOn);
      for (const x of r.ranked) out.set(x.student.id, { rank: x.rank, of: r.ranked.length });
    }
    return out;
  }, [mode, s, rankData.data, settings, mushaf, monthFrom, monthTo, circleOn]);

  const kind: SendKind = mode;
  const sendDate = mode === "DAILY" ? date : monthFrom;
  const quranBy = s.byStudent("quran_entries");
  const attBy = s.byStudent("attendance");
  const female = (st: Student) => s.get("circles", st.circle_id)?.section === "FEMALE";

  function messageFor(st: Student): string {
    const token = s.get("guardian_links", st.id)?.token;
    if (mode === "DAILY") {
      const lines = dayLines(
        mushaf,
        (quranBy.get(st.id) ?? []).filter((e) => e.entry_date === date),
        s.get("attendance", `${st.id}|${date}`),
        s.get("circle_lessons", `${st.circle_id}|${date}`)
      );
      return dailyMessage(st, date, lines, token, female(st));
    }
    const inMonth = (d: string) => d >= monthFrom && d <= monthTo;
    const base = monthStats(
      mushaf,
      (quranBy.get(st.id) ?? []).filter((e) => inMonth(e.entry_date)),
      (attBy.get(st.id) ?? []).filter((a) => inMonth(a.att_date))
    );
    const r = ranks.get(st.id);
    const stats: MonthStats = { ...base, rank: r?.rank ?? null, rankOf: r?.of ?? 0, exams: examLines(s.all("exams"), st.id, monthFrom, monthTo, mushaf) };
    return monthlyMessage(st, month, stats, token, female(st));
  }

  const sentOf = (st: Student) => {
    const row = s.get("report_sends", `${st.id}|${sendDate}|${kind}`);
    return !!row && !row.deleted_at;
  };
  const sentCount = students.filter(sentOf).length;
  const noPhone = students.filter((st) => !st.guardian_phone).length;
  const list = students.filter((st) => (show === "unsent" ? !sentOf(st) : show === "nophone" ? !st.guardian_phone : true));
  const tooOld = (mode === "DAILY" ? date : monthFrom) < addDays(todayStr(), -LOCAL_WINDOW_DAYS);

  async function mark(st: Student, sent: boolean) {
    if (sent) {
      await store.save("report_sends", { student_id: st.id, send_date: sendDate, kind, deleted_at: null }, `إرسال تقرير: ${st.name}`);
    } else {
      await store.softDelete("report_sends", `${st.id}|${sendDate}|${kind}`, `إلغاء علامة الإرسال: ${st.name}`);
    }
  }

  return (
    <Panel title="📤 إرسال تقارير الحلقة" onClose={onClose} className="send-reports">
      <div className="recent">
        <button className={`chip ${mode === "DAILY" ? "on" : ""}`} onClick={() => setMode("DAILY")}>
          تقرير اليوم
        </button>
        <button className={`chip ${mode === "MONTHLY" ? "on" : ""}`} onClick={() => setMode("MONTHLY")}>
          ملخص الشهر
        </button>
      </div>
      <div className="formgrid compact">
        {mode === "DAILY" ? (
          <div>
            <label>اليوم</label>
            <input type="date" value={date} max={todayStr()} onChange={(e) => setDate(e.target.value || todayStr())} />
          </div>
        ) : (
          <div>
            <label>الشهر</label>
            <input type="month" value={month} max={todayStr().slice(0, 7)} onChange={(e) => setMonth(e.target.value || todayStr().slice(0, 7))} />
          </div>
        )}
        <div className="send-progress">
          <b>
            انبعت {sentCount} من {students.length}
          </b>
          <div className="progress">
            <i style={{ width: `${students.length ? Math.round((sentCount / students.length) * 100) : 0}%` }} />
          </div>
          <span className="small muted">
            {label} · {mode === "DAILY" ? dayName(date) : monthName(month)}
          </span>
        </div>
      </div>
      {tooOld && <p className="notice">هذا الجهاز يحتفظ بآخر {LOCAL_WINDOW_DAYS} يومًا فقط، فقد تكون الرسائل ناقصة.</p>}
      {noPhone > 0 && (
        <p className="notice warn-notice">
          ⚠️ {noPhone} {noPhone === 1 ? "طالب" : "طلاب"} بدون رقم لولي الأمر — أضف الرقم تحت اسم الطالب.
        </p>
      )}
      <div className="recent">
        <span className="muted">عرض:</span>
        {(
          [
            ["all", "الكل"],
            ["unsent", "لم يُرسل"],
            ["nophone", "بدون رقم"],
          ] as const
        ).map(([id, text]) => (
          <button key={id} className={`chip ${show === id ? "on" : ""}`} onClick={() => setShow(id)}>
            {text}
          </button>
        ))}
      </div>

      <ul className="send-list">
        {list.map((st) => (
          <SendRow key={st.id} student={st} message={messageFor(st)} sent={sentOf(st)} onMark={(v) => mark(st, v)} />
        ))}
        {!list.length && <li className="muted">لا يوجد طلاب هنا.</li>}
      </ul>
    </Panel>
  );
}

function SendRow({ student, message, sent, onMark }: { student: Student; message: string; sent: boolean; onMark: (sent: boolean) => void }) {
  const { showToast } = useApp();
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");

  async function savePhone() {
    const p = normalizePhone(phone);
    if (!p) return setError("الرقم غير صحيح — مثل 0912345678");
    setError("");
    await store.save("students", { ...student, guardian_phone: p }, `رقم ولي الأمر: ${student.name}`);
    showToast("تم حفظ الرقم");
  }

  return (
    <li className={sent ? "sent" : ""}>
      <div className="send-head">
        <div>
          <b>{student.name}</b>
          {student.guardian_phone ? (
            <bdi dir="ltr" className="small muted phone">
              {formatPhone(student.guardian_phone)}
            </bdi>
          ) : (
            <div className="no-phone">⚠️ لا يوجد رقم لولي الأمر</div>
          )}
        </div>
        <div className="row-actions">
          {sent ? (
            <>
              <span className="badge excellent">✓ انبعتت</span>
              <button className="link" onClick={() => onMark(false)}>
                تراجع
              </button>
            </>
          ) : (
            <a
              className="btn small"
              href={waLink(message, student.guardian_phone)}
              target="_blank"
              rel="noreferrer"
              onClick={() => onMark(true)}
            >
              إرسال
            </a>
          )}
          <button className="link" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
            {open ? "إخفاء" : "الرسالة"}
          </button>
        </div>
      </div>
      {!student.guardian_phone && (
        <div className="inline-phone">
          <input value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" dir="ltr" inputMode="tel" placeholder="0912345678" aria-label={`رقم ولي أمر ${student.name}`} />
          <button className="secondary" onClick={savePhone} disabled={!phone.trim()}>
            حفظ الرقم
          </button>
          {error && <span className="error-text">{error}</span>}
        </div>
      )}
      {open && <pre className="msg-preview">{message}</pre>}
    </li>
  );
}
