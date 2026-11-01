import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/server";
import type { Database } from "@/lib/supabase/database.types";
import type { MyContext } from "@/lib/center";

// Verifies the current session is an active admin of the centre it is working in, using the normal
// cookie-bound (RLS-respecting) client — the same rule the database enforces. Every admin route
// then acts only inside that centre (centerId), because the service key it uses bypasses RLS.
export async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, status: 401, error: "غير مسجّل الدخول" };

  const { data } = await supabase.rpc("my_context");
  const ctx = data as unknown as MyContext | null;
  if (!ctx?.center || ctx.membership?.role !== "ADMIN" || !ctx.membership.active) {
    return { ok: false as const, status: 403, error: "هذا الإجراء متاح للمدير فقط" };
  }
  return { ok: true as const, userId: user.id, centerId: ctx.center.id, center: ctx.center };
}

/** The person's membership in this centre, or null when they aren't in it. */
export async function membershipIn(admin: SupabaseClient<Database>, userId: string, centerId: string) {
  const { data } = await admin.from("memberships").select("*").eq("user_id", userId).eq("center_id", centerId).maybeSingle();
  return data;
}

/**
 * A centre's admin may change a login's email or password only when that login belongs to their
 * centre alone — otherwise one centre could take over an account another centre relies on.
 */
export async function onlyInCenter(admin: SupabaseClient<Database>, userId: string, centerId: string): Promise<boolean> {
  const [{ data: ms }, { data: pa }] = await Promise.all([
    admin.from("memberships").select("center_id").eq("user_id", userId),
    admin.from("platform_admins").select("user_id").eq("user_id", userId).maybeSingle(),
  ]);
  return !pa && !!ms?.length && ms.every((m) => m.center_id === centerId);
}

export const NO_SERVICE_KEY = "SUPABASE_SERVICE_ROLE_KEY غير مضبوط على الخادم — راجع .env.local.example";
