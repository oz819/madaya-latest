import { NextResponse } from "next/server";
import { NO_SERVICE_KEY, membershipIn, onlyInCenter, requireAdmin } from "@/lib/requireAdmin";
import { createAdminClient } from "@/utils/supabase/admin";

// Set a new password for a staff login of this centre — only for a login that belongs to this
// centre alone (a teacher shared with another centre resets their own password by email).
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin.ok) return NextResponse.json({ error: admin.error }, { status: admin.status });

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const password = typeof body?.password === "string" ? body.password : "";
  if (password.length < 8) return NextResponse.json({ error: "كلمة المرور يجب أن تكون 8 أحرف على الأقل" }, { status: 400 });

  let sb;
  try {
    sb = createAdminClient();
  } catch {
    return NextResponse.json({ error: NO_SERVICE_KEY }, { status: 500 });
  }
  if (!(await membershipIn(sb, id, admin.centerId))) return NextResponse.json({ error: "الحساب ليس في مركزك" }, { status: 404 });
  if (!(await onlyInCenter(sb, id, admin.centerId))) {
    return NextResponse.json({ error: "هذا الحساب مستخدم في مركز آخر أيضًا، فيغيّر صاحبه كلمة مروره بنفسه" }, { status: 403 });
  }
  const { error } = await sb.auth.admin.updateUserById(id, { password });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
