"use client";

import { useState } from "react";

// What the centre offers and what its app does, filterable by audience and searchable.

// Stroke icons on a 24px grid.
const ICONS: Record<string, string> = {
  book: "M4 4h6a3 3 0 0 1 2 1 3 3 0 0 1 2-1h6v15h-6a2 2 0 0 0-2 1 2 2 0 0 0-2-1H4zM12 5v15",
  mic: "M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM5 11a7 7 0 0 0 14 0M12 18v3",
  clip: "M8 4h8v3H8zM6 5H5v16h14V5h-1M9 12h6M9 16h4",
  users: "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21v-1a6 6 0 0 1 12 0v1M16 3.5a4 4 0 0 1 0 7.5M22 21v-1a6 6 0 0 0-4-5.6",
  cal: "M4 5h16v16H4zM4 10h16M8 3v4M16 3v4M9 15l2 2 4-4",
  doc: "M6 2h9l5 5v15H6zM14 2v6h6M9 13h6M9 17h6",
  map: "M9 4l6 2 6-2v14l-6 2-6-2-6 2V6zM9 4v14M15 6v14",
  link: "M10 14a4 4 0 0 0 6 0l3-3a4 4 0 0 0-6-6l-1 1M14 10a4 4 0 0 0-6 0l-3 3a4 4 0 0 0 6 6l1-1",
  chart: "M4 20V10M10 20V4M16 20v-7M22 20H2",
  bell: "M6 16V11a6 6 0 1 1 12 0v5l2 2H4zM10 21h4",
  grid: "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z",
  medal: "M8 3h8l-2 6h-4zM12 21a6 6 0 1 0 0-12 6 6 0 0 0 0 12z",
  star: "M12 3l2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z",
  shield: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z",
};

const CATS = [
  { id: "all", t: "الكل" },
  { id: "center", t: "برامج المركز" },
  { id: "teacher", t: "للمعلّم" },
  { id: "parent", t: "لوليّ الأمر" },
  { id: "admin", t: "للإدارة" },
];

const FEATURES = [
  { t: "حلقات التحفيظ", d: "حلقات للبنين والبنات بإشراف معلّمين ومعلّمات متقنين.", c: "center", i: "book" },
  { t: "تدارس القرآن", d: "مجالس تلاوة وتجويد وتدبّر.", c: "center", i: "mic" },
  { t: "الدورات العلمية", d: "دورات شرعية وتربوية على يد أهل العلم.", c: "center", i: "clip" },
  { t: "أنشطة الشباب", d: "برامج ثقافية وتربوية هادفة يجد فيها الشباب بغيتهم.", c: "center", i: "users" },
  { t: "التسميع اليومي", d: "تسجيل الحفظ والمراجعة بتقدير لكل طالب بضغطة.", c: "teacher", i: "mic" },
  { t: "الحضور والغياب", d: "تفقّد الحلقة بثوانٍ، حتى بدون إنترنت.", c: "teacher", i: "cal" },
  { t: "درس اليوم", d: "خطة الحلقة اليومية ظاهرة للمعلّم والإدارة.", c: "teacher", i: "doc" },
  { t: "خريطة الحفظ", d: "خريطة للأجزاء والسور: أين وصل كل طالب.", c: "teacher", i: "map" },
  { t: "رابط وليّ الأمر", d: "رابط خاص يتابع فيه الأهل حفظ أبنائهم أولًا بأول.", c: "parent", i: "link" },
  { t: "التقارير الدورية", d: "تقرير بالحفظ والحضور يصل الأهل على واتساب.", c: "parent", i: "chart" },
  { t: "تنبيه الغياب", d: "إشعار لوليّ الأمر عند تكرار الغياب.", c: "parent", i: "bell" },
  { t: "لوحة المدير", d: "نظرة شاملة على الحلقات والمعلّمين والأرقام.", c: "admin", i: "grid" },
  { t: "الاختبارات والشهادات", d: "اختبارات الأجزاء وشهادات إتمام جاهزة للطباعة.", c: "admin", i: "medal" },
  { t: "المتفوّقون", d: "ترتيب الطلاب بالنقاط لتحفيزهم وتكريمهم.", c: "admin", i: "star" },
  { t: "نسخ احتياطي مشفّر", d: "بيانات المركز محفوظة كل ليلة ومشفّرة.", c: "admin", i: "shield" },
];

export default function Features() {
  const [cat, setCat] = useState("all");
  const [q, setQ] = useState("");
  const k = q.trim();
  const list = FEATURES.filter((f) => (cat === "all" || f.c === cat) && (!k || (f.t + f.d).includes(k)));

  return (
    <section id="features" className="lx-section" data-reveal>
      <div className="lx-head lx-center">
        <div className="lx-kicker"><i />برامجنا ومنصّتنا<i /></div>
        <h2>كل ما يخدم <span className="lx-gold">حافظ القرآن</span></h2>
      </div>
      <div className="lx-filter">
        <div className="lx-tabs" role="tablist">
          {CATS.map((c) => (
            <button key={c.id} type="button" role="tab" aria-selected={cat === c.id} className={cat === c.id ? "on" : ""} onClick={() => setCat(c.id)}>
              {c.t}
            </button>
          ))}
        </div>
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث: تسميع، تقرير، شهادة…" aria-label="ابحث في البرامج" />
      </div>
      <ul className="lx-grid">
        {list.map((f) => (
          <li key={f.t}>
            <span className="lx-ic" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d={ICONS[f.i]} /></svg>
            </span>
            <h3>{f.t}</h3>
            <p>{f.d}</p>
          </li>
        ))}
      </ul>
      {!list.length && <p className="lx-muted lx-center">لا نتائج لـ«{k}».</p>}
    </section>
  );
}
