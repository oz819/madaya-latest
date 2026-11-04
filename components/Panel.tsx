"use client";

import { useEffect, useRef } from "react";

/** The one close button of the app: ✕ in the panel's corner, labelled for screen readers. */
export function CloseButton({ onClick, label = "إغلاق" }: { onClick: () => void; label?: string }) {
  return (
    <button type="button" className="icon-close" onClick={onClick} aria-label={label} title={label}>
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
        <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      </svg>
    </button>
  );
}

// A panel that opens inside a page (add a student, roll call, send reports, new halaqa …): a title
// with the ✕ beside it, Esc closes it, and the first field gets the focus. The button that opened
// it keeps its own name, so no button ever turns into "إغلاق" under the user's finger.
export default function Panel({
  title,
  onClose,
  className = "",
  children,
}: {
  title: React.ReactNode;
  onClose: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  });

  useEffect(() => {
    const el = ref.current;
    el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    el?.querySelector<HTMLElement>("input:not([type=hidden]):not([type=checkbox]), select, textarea")?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !document.querySelector("[role=alertdialog]")) close.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div ref={ref} className={`card panel ${className}`} role="region" aria-label={typeof title === "string" ? title : undefined}>
      <div className="panel-head">
        <h3>{title}</h3>
        <CloseButton onClick={onClose} />
      </div>
      {children}
    </div>
  );
}
