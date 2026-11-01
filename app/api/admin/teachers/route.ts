import { NextResponse } from "next/server";
import { NO_SERVICE_KEY, membershipIn, requireAdmin } from "@/lib/requireAdmin";
import { createAdminClient } from "@/utils/supabase/admin";

// Staff accounts of the admin's centre. Creating a login needs the Supabase Auth Admin API
// (service_role), which the browser can never call. Everything here is limited to the admin's
// own centre: the service key bypasses RLS, so each query names the centre.

function adminClientOrNull() {
  try {
    return createAdminClient();
  } catch {
    return null;
  }
}

// Login emails live in auth.users: return them for this centre's members only.
export async function GET() {
  const admin = await requireAdmin();
  if (!admin.ok) return NextResponse.json({ error: admin.error }, { status: admin.status });
  const sb = adminClientOrNull();
  if (!sb) return NextResponse.json({ error: NO_SERVICE_KEY }, { status: 500 });

  const { data: members, error } = await sb.from("memberships").select("user_id").eq("center_id", admin.centerId);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  const emails: Record<string, string> = {};
  await Promise.all(
    (members ?? []).map(async (m) => {
      const { data } = await sb.auth.admin.getUserById(m.user_id);
      if (data?.user?.email) emails[m.user_id] = data.user.email;
    })
  );
  return NextResponse.json({ emails });
}

// Add a teacher: a new login with a password, or — when the email already has a login (e.g. a
// teacher of another centre too) — just a membership in this centre, keeping their password.
export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (!admin.ok) return NextResponse.json({ error: admin.error }, { status: admin.status });

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  if (!name || !email || name.length > 100) {
    return NextResponse.json({ error: "أكمل بيانات المحفظ" }, { status: 400 });
  }

  const sb = adminClientOrNull();
  if (!sb) return NextResponse.json({ error: NO_SERVICE_KEY }, { status: 500 });

  const { data: existingId } = await sb.rpc("service_user_id", { p_email: email });
  let userId = existingId as string | null;
  let created = false;
  if (!userId) {
    if (password.length < 8) return NextResponse.json({ error: "كلمة المرور 8 أحرف على الأقل" }, { status: 400 });
    const { data, error } = await sb.auth.admin.createUser({ email, password, email_confirm: true });
    if (error || !data.user) return NextResponse.json({ error: error?.message || "تعذّر إنشاء الحساب" }, { status: 400 });
    userId = data.user.id;
    created = true;
  } else if (await membershipIn(sb, userId, admin.centerId)) {
    return NextResponse.json({ error: "هذا البريد عضو في المركز من قبل" }, { status: 400 });
  }

  const { error: userErr } = await sb.from("app_users").upsert({ id: userId, name }, { onConflict: "id", ignoreDuplicates: true });
  const { error: memErr } = userErr
    ? { error: userErr }
    : await sb.from("memberships").insert({ user_id: userId, center_id: admin.centerId, name, role: "TEACHER", active: true });
  if (memErr) {
    // Don't leave a half-made login behind.
    if (created) await sb.auth.admin.deleteUser(userId);
    return NextResponse.json({ error: memErr.message }, { status: 400 });
  }
  return NextResponse.json({ id: userId, name, email, existing: !created }, { status: 201 });
}
