import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/lib/supabase/database.types";
import { DEMO, DEMO_INTERNAL_URL, demoFetch } from "@/lib/demo/fetch";

// Server Components/Actions/Route Handlers: reads the user's session from cookies, so every
// query still goes through RLS as that user — this is not a privileged client.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    DEMO ? DEMO_INTERNAL_URL : process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      ...(DEMO ? { global: { fetch: demoFetch }, cookieOptions: { name: "sb-demo-auth-token" } } : {}),
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Called from a Server Component with no request/response to write to — safe to
            // ignore because middleware.ts refreshes the session on every request anyway.
          }
        },
      },
    }
  );
}
