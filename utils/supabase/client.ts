import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/supabase/database.types";

// The public demo serves its own stand-in for Supabase at /sb on whatever address it runs on.
const DEMO = process.env.NEXT_PUBLIC_DEMO === "1";
export const DEMO_COOKIE = "sb-demo-auth-token";

export function createClient() {
  return createBrowserClient<Database>(
    // (During server rendering there is no `location`; nothing is fetched there anyway.)
    DEMO ? `${typeof window === "undefined" ? "http://demo.invalid" : location.origin}/sb` : process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    DEMO ? { cookieOptions: { name: DEMO_COOKIE } } : undefined
  );
}
