"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import DevCredit from "@/components/landing/DevCredit";
import LoginDialog from "@/components/center/LoginDialog";
import { GeoStar } from "@/components/center/Geo";
import { applyPalette, slugify } from "@/lib/center";
import { dirOf, t, type Key, type Locale } from "@/lib/i18n";

// The platform's own page (no centre on this address): what it is, "سجّل مركزك", and sign-in.
const FEATURES: { k: string; icon: string }[] = [
  { k: "track", icon: "M4 19V5a2 2 0 0 1 2-2h12v18H6a2 2 0 0 1-2-2zM8 7h6M8 11h6" },
  { k: "offline", icon: "M2 9a15 15 0 0 1 20 0M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0M12 20h.01" },
  { k: "family", icon: "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21v-1a6 6 0 0 1 12 0v1M17 11a3 3 0 1 0 0-6M22 21v-1a5 5 0 0 0-4-4.9" },
  { k: "reports", icon: "M4 20V10M10 20V4M16 20v-7M22 20H2" },
  { k: "roles", icon: "M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7z" },
  { k: "isolation", icon: "M6 10V8a6 6 0 0 1 12 0v2M5 10h14v11H5zM12 14v3" },
];

export default function PlatformLanding() {
  const router = useRouter();
  const [locale, setLocale] = useState<Locale>("ar");
  const [showLogin, setShowLogin] = useState(false);
  const [slug, setSlug] = useState("");
  const tr = (k: Key) => t(locale, k);
  useEffect(() => applyPalette({ palette: "indigo" }), []);

  return (
    <div className="cx" dir={dirOf(locale)} lang={locale}>
      <header className="cx-nav">
        <span className="cx-brand">
          <span className="header-mark" style={{ width: 38, height: 38 }}>ح</span>
          <span>{tr("platform.name")}</span>
        </span>
        <div className="cx-nav-actions">
          <button type="button" className="link" onClick={() => setLocale(locale === "ar" ? "en" : "ar")}>
            {tr("lang.switch")}
          </button>
          <button type="button" className="secondary" onClick={() => setShowLogin(true)}>
            {tr("platform.login")}
          </button>
        </div>
      </header>

      <main className="geo-bg" style={{ flex: 1 }}>
        <section className="px-hero">
          <GeoStar style={{ width: 72, height: 72, margin: "0 auto", opacity: 0.8 }} />
          <h1>{tr("platform.tagline")}</h1>
          <p>{tr("platform.lead")}</p>
          <div className="cx-cta" style={{ justifyContent: "center" }}>
            <Link href="/signup" className="btn">
              {tr("platform.cta")}
            </Link>
            <button type="button" className="btn ghost" onClick={() => setShowLogin(true)}>
              {tr("platform.login")}
            </button>
          </div>
          <form
            className="slug-input"
            style={{ maxWidth: 380, margin: "22px auto 0" }}
            onSubmit={(e) => {
              e.preventDefault();
              const s = slugify(slug);
              if (s) router.push(`/${s}`);
            }}
          >
            <span>/</span>
            <input aria-label={tr("platform.find")} placeholder={tr("platform.find")} value={slug} onChange={(e) => setSlug(e.target.value)} style={{ borderRadius: 0 }} />
            <button type="submit" style={{ borderRadius: "0 var(--r-md) var(--r-md) 0" }}>
              {tr("platform.go")}
            </button>
          </form>
        </section>

        <section className="px-grid" aria-label="المزايا">
          {FEATURES.map((f) => (
            <div className="px-card" key={f.k}>
              <span className="px-icon">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d={f.icon} /></svg>
              </span>
              <h3>{tr(`f.${f.k}.t` as Key)}</h3>
              <p>{tr(`f.${f.k}.d` as Key)}</p>
            </div>
          ))}
        </section>
      </main>

      <footer className="cx-footer">
        <DevCredit compact />
      </footer>

      {showLogin && <LoginDialog title={tr("platform.name")} subtitle={tr("platform.login")} onClose={() => setShowLogin(false)} />}
    </div>
  );
}
