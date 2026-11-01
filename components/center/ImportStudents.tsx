"use client";

import { useMemo, useState } from "react";
import { useApp } from "@/components/AppContext";
import { newId, store, useStore } from "@/lib/offline/store";
import { normalizePhone } from "@/lib/guardian";

type Row = { name: string; circle: string; guardian: string; phone: string };

/** CSV (comma or semicolon) or rows pasted from Excel (tab separated). Quotes are honoured. */
export function parseTable(text: string): string[][] {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return [];
  const sep = lines[0].includes("\t") ? "\t" : lines[0].includes(";") && !lines[0].includes(",") ? ";" : ",";
  return lines.map((line) => {
    const out: string[] = [];
    let cur = "";
    let q = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (q) {
        if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
        else if (ch === '"') q = false;
        else cur += ch;
      } else if (ch === '"') q = true;
      else if (ch === sep) { out.push(cur.trim()); cur = ""; }
      else cur += ch;
    }
    out.push(cur.trim());
    return out;
  });
}

const HEAD = /^(الاسم|اسم|name|student)/i;

// استيراد جماعي للطلاب: columns are name, halaqa, guardian's name, guardian's phone (only the name
// is required). A halaqa that doesn't match goes to the one picked below. Students are added
// through the offline outbox like any other, so it works on a weak connection too.
export default function ImportStudents() {
  const { showToast } = useApp();
  const s = useStore();
  const circles = s.all("circles").filter((c) => c.active);
  const [text, setText] = useState("");
  const [fallback, setFallback] = useState("");
  const [busy, setBusy] = useState(false);

  const rows = useMemo<Row[]>(() => {
    const t = parseTable(text);
    if (t.length && HEAD.test(t[0][0] ?? "")) t.shift();
    return t
      .map((r) => ({ name: r[0] ?? "", circle: r[1] ?? "", guardian: r[2] ?? "", phone: r[3] ?? "" }))
      .filter((r) => r.name.length >= 2);
  }, [text]);

  const byName = new Map(circles.map((c) => [c.name.trim().toLowerCase(), c.id]));
  const circleOf = (r: Row) => byName.get(r.circle.trim().toLowerCase()) ?? fallback;
  const missing = rows.filter((r) => !circleOf(r)).length;

  async function readFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (f.size > 1024 * 1024) return showToast("الملف أكبر من 1 ميغابايت");
    if (/\.xlsx?$/i.test(f.name)) return showToast("احفظ ملف Excel بصيغة CSV أولًا، أو انسخ الخلايا والصقها هنا");
    setText(await f.text());
  }

  async function run() {
    if (!rows.length || missing) return;
    setBusy(true);
    for (const r of rows) {
      await store.save(
        "students",
        {
          id: newId(),
          name: r.name.slice(0, 100),
          circle_id: circleOf(r),
          active: true,
          guardian_name: r.guardian.slice(0, 100) || null,
          guardian_phone: normalizePhone(r.phone),
        },
        `استيراد طالب: ${r.name}`
      );
    }
    setBusy(false);
    setText("");
    showToast(`أُضيف ${rows.length} طالبًا`);
  }

  return (
    <div className="card">
      <h3>📥 استيراد طلاب (Excel / CSV)</h3>
      <p className="small muted">
        الأعمدة بالترتيب: اسم الطالب، الحلقة، اسم ولي الأمر، رقم ولي الأمر. انسخ الخلايا من Excel والصقها هنا، أو ارفع ملف CSV.
      </p>
      <textarea rows={5} value={text} onChange={(e) => setText(e.target.value)} placeholder={"أحمد محمد\tحلقة أبي بكر\tمحمد\t0991234567"} dir="auto" />
      <div className="formgrid compact" style={{ marginTop: 8 }}>
        <div>
          <label>ملف CSV</label>
          <input type="file" accept=".csv,.txt,text/csv,text/plain" onChange={readFile} />
        </div>
        <div>
          <label>حلقة لمن لم تُذكر حلقته</label>
          <select value={fallback} onChange={(e) => setFallback(e.target.value)}>
            <option value="">— اختر —</option>
            {circles.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      {rows.length > 0 && (
        <p className="small" style={{ marginTop: 8 }}>
          {rows.length} طالبًا جاهزون للإضافة
          {missing > 0 && <span className="error-text"> — {missing} بلا حلقة معروفة: اختر حلقة لهم</span>}
        </p>
      )}
      <button type="button" onClick={run} disabled={!rows.length || missing > 0 || busy} style={{ marginTop: 8 }}>
        {busy ? "جارٍ الإضافة..." : `إضافة ${rows.length || ""} طالب`}
      </button>
    </div>
  );
}
