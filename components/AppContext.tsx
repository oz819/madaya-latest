"use client";

import { createContext, useContext } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { Profile } from "@/lib/types";
import type { Mushaf } from "@/lib/quran";
import type { MyContext } from "@/lib/center";

export type AppCtx = {
  supabase: SupabaseClient<Database>;
  profile: Profile;
  mushaf: Mushaf;
  showToast: (t: string) => void;
  /** The centre this session works in (from my_context). */
  center: NonNullable<MyContext["center"]>;
  isOwner: boolean;
  isPlatformAdmin: boolean;
  /** Re-reads my_context, e.g. after the centre's settings change. */
  refreshCenter: () => Promise<void>;
};

export const AppContext = createContext<AppCtx | null>(null);

export function useApp(): AppCtx {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp outside AppContext");
  return ctx;
}
