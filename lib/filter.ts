"use client";

// The one student filter shared by every page (students, talqeen, reports): a section, a halaqa,
// or everyone. It is remembered on the device (works offline), in the user's settings on the
// server (follows them to another phone), and in the address bar (?f=...). A user who never chose
// one starts on the default filter the admin set for their account.

import { useSyncExternalStore } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { Circle } from "@/lib/types";

export type Section = "MALE" | "FEMALE";
export const SECTIONS: Section[] = ["MALE", "FEMALE"];
export const SECTION_LABEL: Record<Section, string> = { MALE: "الذكور", FEMALE: "الإناث" };

/** 'all' | 's:MALE' | 's:FEMALE' | 'c:<circle id>' */
export type Filter = string;

const VALID = /^(all|s:(MALE|FEMALE)|c:[0-9a-f-]{36})$/;
const LOCAL_KEY = "ui:filter";
const LEGACY_KEY = "ui:students.circle";
const URL_PARAM = "f";

// Tagged with the account, so another teacher signing in on a shared phone starts on their own.
type Saved = { value: Filter; at: string; user: string };

/** Circles the filter covers, or null for everyone. */
export function filterCircleIds(filter: Filter, circles: Circle[]): Set<string> | null {
  if (filter.startsWith("s:")) return new Set(circles.filter((c) => c.section === filter.slice(2)).map((c) => c.id));
  if (filter.startsWith("c:")) return new Set([filter.slice(2)]);
  return null;
}

/**
 * The filter if it still points at something that exists, else 'all'. A halaqa that is the only
 * one in its section reads as that section, matching what the picker offers (filterOptions).
 */
export function effectiveFilter(filter: Filter, circles: Circle[]): Filter {
  if (filter.startsWith("s:")) return circles.some((c) => c.section === filter.slice(2)) ? filter : "all";
  if (filter.startsWith("c:")) {
    const circle = circles.find((c) => c.id === filter.slice(2));
    if (!circle) return "all";
    const alone = circle.section && circles.filter((c) => c.section === circle.section).length === 1;
    return alone ? `s:${circle.section}` : filter;
  }
  return "all";
}

export function filterLabel(filter: Filter, circles: Circle[]): string {
  if (filter.startsWith("s:")) return SECTION_LABEL[filter.slice(2) as Section] ?? "—";
  if (filter.startsWith("c:")) return circles.find((c) => c.id === filter.slice(2))?.name ?? "—";
  return "كل الطلاب";
}

/**
 * Choices for a filter picker. A section with a single halaqa is offered once, as the section,
 * so "ذكور" doesn't appear twice; halaqat are listed when a section has several or none.
 */
export function filterOptions(circles: Circle[]): { sections: Section[]; circles: Circle[] } {
  const sections = SECTIONS.filter((sec) => circles.some((c) => c.section === sec));
  const perSection = (sec: string | null) => circles.filter((c) => c.section === sec).length;
  return {
    sections,
    circles: circles.filter((c) => !c.section || perSection(c.section) > 1),
  };
}

function readLocal(userId: string): Saved | null {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    const saved = raw ? (JSON.parse(raw) as Saved) : null;
    return saved && saved.user === userId && VALID.test(saved.value) ? saved : null;
  } catch {
    return null;
  }
}

// The students page used to remember its own halaqa; carry that choice over once.
function readLegacy(): Filter | null {
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    localStorage.removeItem(LEGACY_KEY);
    const id = raw ? (JSON.parse(raw) as string) : null;
    return id && id !== "all" && VALID.test(`c:${id}`) ? `c:${id}` : null;
  } catch {
    return null;
  }
}

function writeUrl(value: Filter) {
  try {
    const url = new URL(location.href);
    if (value === "all") url.searchParams.delete(URL_PARAM);
    else url.searchParams.set(URL_PARAM, value);
    if (url.href !== location.href) history.replaceState(history.state, "", url);
  } catch {}
}

class FilterStore {
  private value: Filter = "all";
  private listeners = new Set<() => void>();
  private sb: SupabaseClient<Database> | null = null;
  private userId: string | null = null;

  /** Picks the starting filter: address bar, then the newest of device/server, then the account default. */
  async init(sb: SupabaseClient<Database>, userId: string, accountDefault: string | null | undefined) {
    this.sb = sb;
    this.userId = userId;
    const fromUrl = new URLSearchParams(location.search).get(URL_PARAM);
    const local = readLocal(userId);
    const legacy = readLegacy();
    const fallback = accountDefault && VALID.test(accountDefault) ? accountDefault : "all";

    if (fromUrl && VALID.test(fromUrl)) {
      this.set(fromUrl);
    } else {
      this.apply(local?.value ?? legacy ?? fallback);
    }
    if (!navigator.onLine) return;

    const { data } = await sb.from("user_settings").select("filter,updated_at").eq("user_id", userId).maybeSingle();
    if (fromUrl && VALID.test(fromUrl)) return;
    if (data?.filter && VALID.test(data.filter) && (!local || data.updated_at > local.at)) {
      this.apply(data.filter);
      try {
        localStorage.setItem(LOCAL_KEY, JSON.stringify({ value: data.filter, at: data.updated_at, user: userId } satisfies Saved));
      } catch {}
    } else if (local && (!data || local.at > data.updated_at)) {
      // Chosen on this device while offline: send it now.
      this.push(local);
    }
  }

  get = () => this.value;

  /** The user picked a filter: remember it everywhere. */
  set(value: Filter) {
    if (!VALID.test(value)) return;
    const saved: Saved = { value, at: new Date().toISOString(), user: this.userId ?? "" };
    try {
      localStorage.setItem(LOCAL_KEY, JSON.stringify(saved));
    } catch {}
    this.apply(value);
    this.push(saved);
  }

  private apply(value: Filter) {
    this.value = value;
    writeUrl(value);
    for (const l of this.listeners) l();
  }

  private push(saved: Saved) {
    if (!this.sb || !this.userId || !navigator.onLine) return;
    this.sb
      .from("user_settings")
      .upsert({ user_id: this.userId, filter: saved.value, updated_at: saved.at }, { onConflict: "user_id,center_id" })
      .then(
        () => {},
        () => {}
      );
  }

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };
}

export const filterStore = new FilterStore();

export function useFilter(): [Filter, (f: Filter) => void] {
  const value = useSyncExternalStore(filterStore.subscribe, filterStore.get, () => "all");
  return [value, (f) => filterStore.set(f)];
}
