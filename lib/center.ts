// What the app knows about a centre (tenant), its palettes and the "me" context from my_context().
// Shared by server and client code — nothing here touches the browser or the cookies.

export type Palette = "indigo" | "navy" | "plum" | "slate";

export const PALETTES: { id: Palette; label: string; colors: [string, string] }[] = [
  { id: "indigo", label: "نيلي ورملي", colors: ["#2f3e9e", "#b8925a"] },
  { id: "navy", label: "كحلي وذهبي", colors: ["#1c2b4a", "#b98d2e"] },
  { id: "plum", label: "عنّابي ورملي", colors: ["#6a2c5b", "#c09a73"] },
  { id: "slate", label: "رمادي هادئ", colors: ["#334155", "#8a94a6"] },
];

/** The public face of a centre (public_center RPC): safe to show to anyone. */
export type PublicCenter = {
  id: string;
  slug: string;
  name: string;
  country: string | null;
  city: string | null;
  logo_url: string | null;
  palette: Palette;
  primary_color: string | null;
  about: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  whatsapp: string | null;
  instagram: string | null;
  facebook: string | null;
  address: string | null;
  locale: "ar" | "en";
  honor_enabled: boolean;
  registrations_open?: boolean;
  extra_notes?: string | null;
};

export type CenterRole = "ADMIN" | "TEACHER";

export type MyContext = {
  user_id: string;
  name: string | null;
  is_platform_admin: boolean;
  center: {
    id: string;
    slug: string;
    name: string;
    logo_url: string | null;
    palette: Palette;
    primary_color: string | null;
    about: string | null;
    status: "ACTIVE" | "SUSPENDED";
    plan: "FREE" | "BASIC" | "PRO";
    onboarded: boolean;
    timezone: string;
    locale: "ar" | "en";
  } | null;
  membership: { role: CenterRole; is_owner: boolean; active: boolean; name: string; default_filter: string | null } | null;
  centers: { id: string; slug: string; name: string; role: CenterRole; status: string; active: boolean }[];
  blocked: null | "NO_CENTER" | "SUSPENDED" | "DELETED" | "DISABLED";
};

/** Inline CSS variables for a centre's own colour (on top of its palette). */
export function accentStyle(c: { primary_color?: string | null } | null | undefined): React.CSSProperties | undefined {
  const hex = c?.primary_color;
  if (!hex || !/^#[0-9a-fA-F]{6}$/.test(hex)) return undefined;
  return { ["--accent" as string]: hex, ["--accent-strong" as string]: hex, ["--accent-soft" as string]: `${hex}14` } as React.CSSProperties;
}

/** Puts the palette on <html> so dialogs and the page background follow it. */
export function applyPalette(c: { palette?: Palette | null; primary_color?: string | null } | null | undefined) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.dataset.palette = c?.palette || "indigo";
  for (const [k, v] of Object.entries(accentStyle(c) ?? {})) root.style.setProperty(k, String(v));
  if (!accentStyle(c)) for (const k of ["--accent", "--accent-strong", "--accent-soft"]) root.style.removeProperty(k);
}

export const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/;

/** A slug suggestion from a name (Latin letters only; Arabic names give an empty suggestion). */
export function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export function initials(name: string): string {
  const w = name.replace(/^(مركز|المركز|جمعية|دار)\s+/, "").trim();
  return w.slice(0, 1) || "م";
}

export function whatsappLink(n: string | null | undefined): string | null {
  const d = (n || "").replace(/\D/g, "");
  return d.length >= 7 ? `https://wa.me/${d}` : null;
}

/** What "سجّل مركزك" keeps in the new login's metadata until the wizard creates the centre. */
export type PendingCenter = { name: string; slug: string; country: string; city: string; owner: string };
