import { NextResponse } from "next/server";
import { NO_SERVICE_KEY, membershipIn, onlyInCenter, requireAdmin } from "@/lib/requireAdmin";
import { createAdminClient } from "@/utils/supabase/admin";

// Edit a staff account of this centre: the name shown in this centre and/or the login email.
// The email can only be changed for a login that belongs to this centre alone.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin.ok) return NextResponse.json({ error: admin.error }, { status: admin.status });

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : undefined;
  const email = typeof body?.email === "string" ? body.email.trim() : undefined;
  if (name === "" || email === "") return NextResponse.json({ error: "الاسم والبريد لا يمكن أن يكونا فارغين" }, { status: 400 });
  if (name === undefined && email === undefined) return NextResponse.json({ error: "لا يوجد ما يُعدَّل" }, { status: 400 });

  let sb;
  try {
    sb = createAdminClient();
  } catch {
    return NextResponse.json({ error: NO_SERVICE_KEY }, { status: 500 });
  }
  if (!(await membershipIn(sb, id, admin.centerId))) return NextResponse.json({ error: "الحساب ليس في مركزك" }, { status: 404 });

  if (email !== undefined) {
    const { data } = await sb.auth.admin.getUserById(id);
    if (data?.user?.email?.toLowerCase() !== email.toLowerCase()) {
      if (!(await onlyInCenter(sb, id, admin.centerId))) {
        return NextResponse.json({ error: "هذا الحساب مستخدم في مركز آخر أيضًا، فلا يغيّر بريده إلا صاحبه" }, { status: 403 });
      }
      const { error } = await sb.auth.admin.updateUserById(id, { email, email_confirm: true });
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    }
  }
  if (name !== undefined) {
    const { error } = await sb.from("memberships").update({ name }).eq("user_id", id).eq("center_id", admin.centerId);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
