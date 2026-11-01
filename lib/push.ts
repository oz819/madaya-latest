"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

// Web Push on this device: ask permission, subscribe with the platform's public VAPID key and keep
// the subscription in push_subscriptions (RLS: only my own, in my current centre).
export const PUSH_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";

export function pushSupported(): boolean {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window && !!PUSH_KEY;
}

function keyBytes(base64: string): Uint8Array {
  const pad = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export async function currentSubscription(): Promise<PushSubscription | null> {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.ready;
  return reg.pushManager.getSubscription();
}

export async function enablePush(sb: SupabaseClient<Database>): Promise<string> {
  if (!pushSupported()) return "المتصفح لا يدعم الإشعارات (على iPhone: ثبّت التطبيق على الشاشة الرئيسية أولًا).";
  const perm = await Notification.requestPermission();
  if (perm !== "granted") return "لم يُسمح بالإشعارات من إعدادات المتصفح.";
  const reg = await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(PUSH_KEY) as BufferSource }));
  const j = sub.toJSON();
  await sb.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
  const { error } = await sb.from("push_subscriptions").insert({
    endpoint: sub.endpoint,
    p256dh: j.keys?.p256dh ?? "",
    auth: j.keys?.auth ?? "",
    user_agent: navigator.userAgent.slice(0, 300),
  });
  return error ? error.message : "";
}

export async function disablePush(sb: SupabaseClient<Database>): Promise<void> {
  const sub = await currentSubscription();
  if (!sub) return;
  await sb.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
  await sub.unsubscribe();
}
