import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import type { Database } from "@/lib/supabase/database.types";

// Refreshes the Supabase auth session on every request and redirects unauthenticated visitors
// away from the app to /login. Route-level RLS is still the real security boundary — this is
// just UX (don't show the app shell before we even know if there's a session).
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const demo = process.env.NEXT_PUBLIC_DEMO === "1";
  const supabase = createServerClient<Database>(
    demo ? `${request.nextUrl.origin}/sb` : process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      ...(demo ? { cookieOptions: { name: "sb-demo-auth-token" } } : {}),
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options));
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Consumes the token from an emailed link and only then knows who the user is, so it must be
  // reachable in both states — redirecting it either way would break every auth email.
  if (pathname.startsWith("/auth/confirm")) {
    return supabaseResponse;
  }

  // Only the app itself and the pages for signed-in people need a session. Everything else is
  // public: centre pages (/{slug}, /{slug}/register, /{slug}/honor), the family page (/p/…),
  // registration, "سجّل مركزك" (/signup) and invitation links (/invite/…).
  const needsSession = pathname === "/" || pathname.startsWith("/onboarding") || pathname.startsWith("/super");

  // Reachable without a session; a signed-in visitor is sent to the app instead.
  const isSignedOutRoute = pathname.startsWith("/login") || pathname.startsWith("/forgot-password");

  if (!user && needsSession) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && isSignedOutRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
