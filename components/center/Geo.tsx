import type { CSSProperties } from "react";
import { initials } from "@/lib/center";

// The new visual language: a simplified eight-point star in a thin line, inside circles and a grid.
export function GeoStar({ className = "geo-star", style }: { className?: string; style?: CSSProperties }) {
  return (
    <svg className={className} style={style} viewBox="0 0 200 200" aria-hidden="true">
      <circle cx="100" cy="100" r="96" />
      <circle cx="100" cy="100" r="70" />
      <rect x="44" y="44" width="112" height="112" />
      <rect x="44" y="44" width="112" height="112" transform="rotate(45 100 100)" />
      <path d="M100 4v192M4 100h192M32 32l136 136M168 32L32 168" opacity=".35" />
    </svg>
  );
}

/** The centre's logo, or a calm monogram when it has none yet. */
export function CenterMark({ name, logo, size = 42, className = "" }: { name: string; logo?: string | null; size?: number; className?: string }) {
  if (logo) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img className={className || "header-logo"} src={logo} alt="" width={size} height={size} />;
  }
  return (
    <span className={`header-mark ${className}`} style={{ width: size, height: size }} aria-hidden="true">
      {initials(name)}
    </span>
  );
}
