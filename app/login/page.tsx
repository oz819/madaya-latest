import type { Metadata } from "next";
import CenterLanding from "@/components/center/CenterLanding";
import PlatformLanding from "@/components/center/PlatformLanding";
import { centerForHost } from "@/lib/centerServer";

// The first screen. On a centre's own domain (madayacentre.com → Madaya) it is that centre's page;
// on the platform's address it is the platform's page with "سجّل مركزك".
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const center = await centerForHost();
  return { title: center ? center.name : "منصة حلقات — إدارة مراكز تحفيظ القرآن", robots: { index: false, follow: false } };
}

export default async function LoginPage() {
  const center = await centerForHost();
  return center ? <CenterLanding center={center} base="" /> : <PlatformLanding />;
}
