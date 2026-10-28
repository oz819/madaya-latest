"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import type { Profile, Role } from "@/lib/types";
import { Mushaf } from "@/lib/quran";
import { PROFILE_COLUMNS, store, useStore } from "@/lib/offline/store";
import { filterStore } from "@/lib/filter";
import { getMeta, setMeta } from "@/lib/offline/idb";
import { ACCOUNT_DELETED_MESSAGE, ACCOUNT_DISABLED_MESSAGE, NOT_REGISTERED_MESSAGE } from "@/lib/messages";
import { AppContext } from "@/components/AppContext";
import Students from "@/components/sections/Students";
import Talqeen from "@/components/sections/Talqeen";
import Reports from "@/components/sections/Reports";
import Ranking from "@/components/sections/Ranking";
import Manage from "@/components/sections/Manage";
import Trash from "@/components/sections/Trash";
import Dashboard from "@/components/sections/Dashboard";
import AuditLog from "@/components/sections/AuditLog";
import ConfirmDialogHost from "@/components/ConfirmDialog";
import SyncBadge from "@/components/SyncBadge";
import SlidingIndicator from "@/components/SlidingIndicator";
import InstallHint from "@/components/InstallHint";
import FilterBar from "@/components/FilterBar";
import Toast, { useToast } from "@/components/Toast";

type Page = "students" | "talqeen" | "reports" | "ranking" | "dashboard" | "manage" | "trash" | "audit";

const NAV: { id: Page; label: string }[] = [
  { id: "students", label: "الطلاب" },
  { id: "talqeen", label: "التلقين" },
  { id: "reports", label: "التقارير" },
  { id: "ranking", label: "المتفوقون" },
];

const ADMIN_NAV: { id: Page; label: string }[] = [
  { id: "dashboard", label: "اللوحة" },
  { id: "manage", label: "الإدارة" },
  { id: "trash", label: "سجل المحذوفات" },
  { id: "audit", label: "سجل التعديلات" },
];

// Stroke icons for the tab bar (24px grid).
const NAV_ICON: Record<Page, string> = {
  students: "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21v-1a6 6 0 0 1 12 0v1M16 3.5a4 4 0 0 1 0 7.5M22 21v-1a6 6 0 0 0-4-5.6",
  talqeen: "M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM5 11a7 7 0 0 0 14 0M12 18v3",
  reports: "M4 20V10M10 20V4M16 20v-7M22 20H2",
  ranking: "M12 3l2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z",
  dashboard: "M4 4h6v8H4zM14 4h6v5h-6zM14 13h6v7h-6zM4 16h6v4H4z",
  manage: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z",
  trash: "M4 7h16M10 11v6M14 11v6M5 7l1 13h12l1-13M9 7V4h6v3",
  audit: "M8 4h8v3H8zM6 5H5v16h14V5h-1M9 12h6M9 16h4",
};

function NavButton({ id, label, active, onClick }: { id: Page; label: string; active: boolean; onClick: () => void }) {
  const ref = useRef<HTMLButtonElement>(null);
  // On phones the tab bar is one scrolling row: keep the open tab in view.
  useEffect(() => {
    const b = ref.current, row = b?.parentElement;
    if (!active || !b || !row || row.scrollWidth <= row.clientWidth) return;
    row.scrollTo({ left: b.offsetLeft - (row.clientWidth - b.offsetWidth) / 2, behavior: "smooth" });
  }, [active]);
  return (
    <button ref={ref} className={active ? "active" : ""} onClick={onClick} aria-current={active ? "page" : undefined}>
      <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d={NAV_ICON[id]} />
      </svg>
      <span>{label}</span>
    </button>
  );
}

type CachedProfile = { userId: string; profile: Profile };

// What's on screen. Each change is a browser history entry, so the phone's back button steps
// back inside the app (student card → list → previous tab) instead of leaving it.
type View = { page: Page; studentId: string | null };
const HOME: View = { page: "students", studentId: null };

export default function AppShell() {
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const [profile, setProfile] = useState<Profile | null>(null);
  const [blockedMessage, setBlockedMessage] = useState("");
  const [view, setView] = useState<View>(HOME);
  const page = view.page;
  const { toast, showToast } = useToast();
  const s = useStore();

  useEffect(() => {
    let started = false;
    (async () => {
      // getSession() reads the locally stored session, so the app opens offline. When online we
      // also re-check the profile on the server (role/active may have changed).
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        if (navigator.onLine) router.replace("/login");
        else setBlockedMessage("أول تسجيل دخول يحتاج اتصالًا بالإنترنت.");
        return;
      }
      const userId = session.user.id;
      const cached = await getMeta<CachedProfile>("profile");

      let p: Profile | null = cached?.userId === userId ? cached.profile : null;
      if (navigator.onLine) {
        const { data, error } = await supabase
          .from("profiles")
          .select(PROFILE_COLUMNS)
          .eq("id", userId)
          .maybeSingle();
        if (!error) {
          if (!data || data.deleted_at || !data.active || (data.role !== "ADMIN" && data.role !== "TEACHER")) {
            setBlockedMessage(!data ? NOT_REGISTERED_MESSAGE : data.deleted_at ? ACCOUNT_DELETED_MESSAGE : ACCOUNT_DISABLED_MESSAGE);
            await supabase.auth.signOut();
            return;
          }
          p = { id: data.id, name: data.name, role: data.role as Role, active: data.active, default_filter: data.default_filter };
        }
      }
      if (!p) {
        setBlockedMessage("تعذّر التحقق من الحساب. اتصل بالإنترنت وأعد المحاولة.");
        return;
      }

      // A different account on this device: start from a clean local copy, unless the previous
      // account still has unsynced changes (those are kept and sent).
      if (cached && cached.userId !== userId) {
        await store.ensureLoaded();
        if (store.status.pending + store.status.failed === 0) await store.reset();
      }
      await setMeta("profile", { userId, profile: p } satisfies CachedProfile);
      setProfile(p);
      filterStore.init(supabase, userId, p.default_filter);
      await store.start(supabase, userId);
      started = true;
    })();
    return () => {
      if (started) store.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const current = (history.state as { view?: View } | null)?.view;
    if (current) setView(current);
    else history.replaceState({ ...history.state, view: HOME }, "");
    const onPop = (e: PopStateEvent) => setView((e.state as { view?: View } | null)?.view ?? HOME);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  function go(next: View) {
    if (next.page === view.page && next.studentId === view.studentId) return;
    setView(next);
    history.pushState({ view: next }, "");
  }
  const setPage = (p: Page) => go({ page: p, studentId: null });
  function openStudent(id: string) {
    go({ page: "students", studentId: id });
  }
  function closeStudent() {
    // Opened from the list: undo that history entry so back/forward stay in step.
    if ((history.state as { view?: View } | null)?.view?.studentId) history.back();
    else setView({ ...view, studentId: null });
  }

  // Deleted or disabled while the app is open: the next sync brings the change, then sign out.
  const own = profile ? s.get("profiles", profile.id) : undefined;
  const revoked = !!own && (!!own.deleted_at || !own.active);
  useEffect(() => {
    if (!revoked) return;
    setBlockedMessage(own?.deleted_at ? ACCOUNT_DELETED_MESSAGE : ACCOUNT_DISABLED_MESSAGE);
    setProfile(null);
    store.stop();
    supabase.auth.signOut();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revoked]);

  const surahs = s.all("quran_surahs");
  const mushaf = useMemo(() => new Mushaf(surahs), [surahs]);

  async function logout() {
    if (navigator.onLine) await store.sync();
    const unsent = store.status.pending + store.status.failed;
    if (unsent > 0) {
      const ok = confirm(
        `لديك ${unsent} تغيير لم يُرسل بعد إلى الخادم. تسجيل الخروج الآن يحذفها من هذا الجهاز نهائيًا.\n\nهل تريد تجاهلها وتسجيل الخروج؟`
      );
      if (!ok) return;
    }
    await store.reset();
    await supabase.auth.signOut();
    router.replace("/login");
  }

  if (blockedMessage) {
    return (
      <div className="login">
        <div className="loginbox">
          <h1>📖 حلقات القرآن</h1>
          <p className="center">{blockedMessage}</p>
          <button style={{ width: "100%", marginTop: 13 }} onClick={() => router.replace("/login")}>
            العودة لتسجيل الدخول
          </button>
        </div>
      </div>
    );
  }

  if (!profile || mushaf.total === 0) {
    return (
      <div className="login">
        <p className="muted center">
          {profile && !s.status.online
            ? "بدون اتصال: البيانات لم تُنزَّل على هذا الجهاز بعد. اتصل بالإنترنت مرة واحدة."
            : s.status.lastError
              ? `تعذّر تنزيل البيانات: ${s.status.lastError}`
              : "جارٍ التحميل..."}
        </p>
      </div>
    );
  }

  return (
    <AppContext.Provider value={{ supabase, profile, mushaf, showToast }}>
      <header className="no-print">
        <div className="headerrow">
          <div className="brand-row">
            <Image className="header-logo" src="/images/logo.png" alt="" width={46} height={46} />
            <div className="brand-text">
              <h1>حلقات القرآن</h1>
              <div className="dates">
                <span className="hijri">
                  {greeting()} · {hijriToday()}
                </span>
                <span className="gregorian">{gregorianToday()}</span>
              </div>
            </div>
          </div>
          <div className="userbox">
            <span>
              {profile.name} — {profile.role === "ADMIN" ? "مدير" : "محفّظ"}
            </span>
            <div className="userbox-actions">
              <SyncBadge />
              <button className="logout" onClick={logout}>
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10" />
                </svg>
                خروج
              </button>
            </div>
          </div>
        </div>
      </header>

      <nav className="no-print sliding">
        <SlidingIndicator active={page} />
        {(profile.role === "ADMIN" ? [...NAV, ...ADMIN_NAV] : NAV).map((n) => (
          <NavButton key={n.id} id={n.id} label={n.label} active={page === n.id} onClick={() => setPage(n.id)} />
        ))}
      </nav>

      <main>
        <div className="no-print">
          <InstallHint />
          {((page === "students" && !view.studentId) || page === "talqeen" || page === "reports" || page === "ranking" || page === "dashboard") && <FilterBar />}
        </div>
        {page === "students" && <Students openId={view.studentId} onOpen={openStudent} onClose={closeStudent} />}
        {page === "talqeen" && <Talqeen />}
        {page === "reports" && <Reports />}
        {page === "ranking" && <Ranking />}
        {page === "dashboard" && profile.role === "ADMIN" && <Dashboard openStudent={openStudent} openManage={() => setPage("manage")} />}
        {page === "manage" && profile.role === "ADMIN" && <Manage />}
        {page === "trash" && profile.role === "ADMIN" && <Trash />}
        {page === "audit" && profile.role === "ADMIN" && <AuditLog />}
      </main>

      <Toast text={toast} />
      <ConfirmDialogHost />
    </AppContext.Provider>
  );
}

// e.g. "الخميس، ٨ تشرين الأول ٢٠٢٦ م" — ar-SY gives the Levantine month names.
function gregorianToday(): string {
  try {
    return (
      new Intl.DateTimeFormat("ar-SY", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date()) +
      " م"
    );
  } catch {
    return "";
  }
}

function greeting(): string {
  const h = new Date().getHours();
  return h < 12 ? "صباح الخير" : "مساء الخير";
}

// Today's date in the Umm al-Qura Hijri calendar, e.g. "١٦ ربيع الآخر ١٤٤٨ هـ".
function hijriToday(): string {
  try {
    return new Intl.DateTimeFormat("ar-SA-u-ca-islamic-umalqura", { day: "numeric", month: "long", year: "numeric" }).format(new Date());
  } catch {
    return "";
  }
}
