import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { DEMO, DEMO_INTERNAL_URL, demoFetch } from "@/lib/demo/fetch";

// Privileged client: bypasses RLS entirely via the service_role key. Server-only (route
// handlers), never imported by a Client Component, never sent to the browser. Every caller of
// a function that uses this MUST independently verify the requester is an active admin first —
// this client itself enforces no permissions at all.
export function createAdminClient() {
  const url = DEMO ? DEMO_INTERNAL_URL : process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured on the server.");
  }
  return createSupabaseClient<Database>(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
    ...(DEMO ? { global: { fetch: demoFetch } } : {}),
  });
}
