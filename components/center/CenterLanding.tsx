"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FacebookIcon, InstagramIcon, WhatsAppIcon } from "@/components/SocialIcons";
import DevCredit from "@/components/landing/DevCredit";
import LoginDialog from "@/components/center/LoginDialog";
import { CenterMark, GeoStar } from "@/components/center/Geo";
import { accentStyle, applyPalette, whatsappLink, type PublicCenter } from "@/lib/center";

// A centre's public page (المرحلة 0): its name, logo, a short about paragraph and how to reach it —
// all from the centre's settings, nothing hard-coded. `base` is where its other public pages live
// ("" on its own domain, "/{slug}" on the platform).
export default function CenterLanding({ center, base }: { center: PublicCenter; base: string }) {
  const [showLogin, setShowLogin] = useState(false);
  useEffect(() => applyPalette(center), [center]);

  const wa = whatsappLink(center.whatsapp);
  const place = [center.city, center.country].filter(Boolean).join("، ");
  const contacts = [
    wa && { href: wa, label: "واتساب", value: center.whatsapp!, icon: <WhatsAppIcon /> },
    center.contact_phone && { href: `tel:${center.contact_phone.replace(/[^\d+]/g, "")}`, label: "هاتف", value: center.contact_phone, icon: <PhoneIcon /> },
    center.contact_email && { href: `mailto:${center.contact_email}`, label: "البريد", value: center.contact_email, icon: <MailIcon /> },
    center.instagram && { href: center.instagram, label: "انستغرام", value: handle(center.instagram), icon: <InstagramIcon /> },
    center.facebook && { href: center.facebook, label: "فيسبوك", value: "صفحتنا", icon: <FacebookIcon /> },
    center.address && { href: null, label: "العنوان", value: center.address, icon: <PinIcon /> },
  ].filter(Boolean) as { href: string | null; label: string; value: string; icon: React.ReactNode }[];

  return (
    <div className="cx" data-palette={center.palette} style={accentStyle(center)} dir="rtl" lang="ar">
      <header className="cx-nav">
        <a href="#top" className="cx-brand">
          <CenterMark name={center.name} logo={center.logo_url} size={38} />
          <span>{center.name}</span>
        </a>
        <div className="cx-nav-actions">
          <button type="button" className="secondary" onClick={() => setShowLogin(true)} aria-haspopup="dialog">
            تسجيل الدخول
          </button>
        </div>
      </header>

      <main id="top" className="geo-bg" style={{ flex: 1 }}>
        <section className="cx-hero">
          <div>
            {place && <div className="cx-kicker">{place}</div>}
            <h1>{center.name}</h1>
            {center.about && <p className="lead">{center.about}</p>}
            <div className="cx-cta">
              <Link href={`${base}/register`} className="btn">
                <span>سجّل في الحلقات</span>
                <span aria-hidden="true">←</span>
              </Link>
              <button type="button" className="btn ghost" onClick={() => setShowLogin(true)}>
                دخول المعلّمين والإدارة
              </button>
              {center.honor_enabled && (
                <Link href={`${base}/honor`} className="btn ghost">
                  لوحة الشرف
                </Link>
              )}
            </div>
          </div>
          <div className="cx-art" aria-hidden="true">
            <GeoStar />
            <div className="cx-logo">
              <CenterMark name={center.name} logo={center.logo_url} size={160} />
            </div>
          </div>
        </section>

        {contacts.length > 0 && (
          <section className="cx-section" aria-label="التواصل">
            <div className="cx-contact">
              {contacts.map((c) =>
                c.href ? (
                  <a key={c.label} href={c.href} target={c.href.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer">
                    {c.icon}
                    <span>
                      <small>{c.label}</small>
                      <span dir="auto">{c.value}</span>
                    </span>
                  </a>
                ) : (
                  <div key={c.label}>
                    {c.icon}
                    <span>
                      <small>{c.label}</small>
                      {c.value}
                    </span>
                  </div>
                )
              )}
            </div>
          </section>
        )}

        {/* ملاحظات إضافية من المركز: مكان محجوز لما يرسله العميل لاحقًا (يُكتب من الإعدادات). */}
        {center.extra_notes && (
          <section className="cx-section">
            <div className="cx-notes">{center.extra_notes}</div>
          </section>
        )}
      </main>

      <footer className="cx-footer">
        <div>© {new Date().getFullYear()} {center.name}</div>
        <DevCredit compact />
      </footer>

      {showLogin && (
        <LoginDialog title={center.name} logo={center.logo_url} onClose={() => setShowLogin(false)} />
      )}
    </div>
  );
}

function handle(url: string): string {
  const m = url.match(/instagram\.com\/([^/?#]+)/i);
  return m ? `@${m[1]}` : url;
}

const ic = { width: 20, height: 20, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
function PhoneIcon() {
  return <svg {...ic}><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" /></svg>;
}
function MailIcon() {
  return <svg {...ic}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></svg>;
}
function PinIcon() {
  return <svg {...ic}><path d="M12 21s-7-6.2-7-12a7 7 0 0 1 14 0c0 5.8-7 12-7 12z" /><circle cx="12" cy="9" r="2.5" /></svg>;
}
