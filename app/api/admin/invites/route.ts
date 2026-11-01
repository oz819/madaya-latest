import { NextResponse } from "next/server";
import { NO_SERVICE_KEY, requireAdmin } from "@/lib/requireAdmin";
import { createAdminClient } from "@/utils/supabase/admin";

// Emails an invitation the admin just created (the row itself is made by the admin's own client,
// under RLS). New emails get Supabase's invite mail; existing logins get a sign-in link. Either way
// the link lands on /invite/{token}. If email isn't set up this fails and the app offers the link.
export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (!admin.ok) return NextResponse.json({ error: admin.error }, { status: admin.status });
  const body = await request.json().catch(() => null);
  const id = typeof body?.id === "string" ? body.id : "";
  const origin = new URL(request.url).origin;

  let sb;
  try {
    sb = createAdminClient();
  } catch {
    return NextResponse.json({ error: NO_SERVICE_KEY }, { status: 500 });
  }
  const { data: inv } = await sb.from("center_invites").select("*").eq("id", id).eq("center_id", admin.centerId).maybeSingle();
  if (!inv || inv.accepted_at || inv.revoked_at) return NextResponse.json({ error: "الدعوة غير موجودة" }, { status: 404 });

  const redirectTo = `${origin}/invite/${inv.token}`;
  const { data: existing } = await sb.rpc("service_user_id", { p_email: inv.email });
  const { error } = existing
    ? await sb.auth.signInWithOtp({ email: inv.email, options: { shouldCreateUser: false, emailRedirectTo: redirectTo } })
    : await sb.auth.admin.inviteUserByEmail(inv.email, { redirectTo, data: { invited_to: admin.center.name } });
  if (error) return NextResponse.json({ error: error.message }, { status: 502 });
  return NextResponse.json({ ok: true });
}
