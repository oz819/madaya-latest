"use client";

import { useEffect, useState } from "react";
import { useApp } from "@/components/AppContext";
import { currentSubscription, disablePush, enablePush, pushSupported } from "@/lib/push";

// 🔔 in the header: turn this device's notifications on or off (Web Push, where supported).
export default function PushToggle() {
  const { supabase, showToast } = useApp();
  const [on, setOn] = useState<boolean | null>(null);
  useEffect(() => {
    if (!pushSupported()) return;
    currentSubscription().then((s) => setOn(!!s), () => setOn(false));
  }, []);
  if (on === null) return null;

  async function toggle() {
    if (on) {
      await disablePush(supabase);
      setOn(false);
      return showToast("أُوقفت الإشعارات على هذا الجهاز");
    }
    const err = await enablePush(supabase);
    if (err) return showToast(err);
    setOn(true);
    const res = await fetch("/api/push/test", { method: "POST" }).catch(() => null);
    showToast(res?.ok ? "تم تفعيل الإشعارات — أرسلنا إشعارًا تجريبيًا" : "تم تفعيل الإشعارات");
  }

  return (
    <button type="button" className="logout" onClick={toggle} title={on ? "إيقاف الإشعارات" : "تفعيل الإشعارات"} aria-pressed={on}>
      {on ? "🔔" : "🔕"}
    </button>
  );
}
