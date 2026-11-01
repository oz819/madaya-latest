import { NextResponse } from "next/server";
import webpush from "web-push";
import { createClient } from "@/utils/supabase/server";

// Sends a test notification to the signed-in person's own devices (their subscriptions are read
// through RLS, so nobody can push to anyone else). Absence alerts and reminders use the same path.
export async function POST() {
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return NextResponse.json({ error: "الإشعارات غير مضبوطة على الخادم (مفاتيح VAPID)" }, { status: 501 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "غير مسجّل الدخول" }, { status: 401 });
  const { data: subs, error } = await supabase.from("push_subscriptions").select("*");
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  webpush.setVapidDetails(`mailto:${process.env.VAPID_CONTACT || "admin@example.com"}`, pub, priv);
  const payload = JSON.stringify({ title: "حلقات", body: "الإشعارات تعمل على هذا الجهاز ✓", url: "/", tag: "test" });
  let sent = 0;
  for (const s of subs ?? []) {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 300 });
      sent++;
    } catch (e) {
      // Gone (unsubscribed or expired): forget it.
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) await supabase.from("push_subscriptions").delete().eq("id", s.id);
    }
  }
  return NextResponse.json({ sent });
}
