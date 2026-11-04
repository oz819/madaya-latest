import type { Metadata } from "next";
import { notFound } from "next/navigation";
import PublicShell from "@/components/PublicShell";
import RegisterForm from "@/components/RegisterForm";
import { centerForHost } from "@/lib/centerServer";

// تسجيل طالب جديد on a centre's own domain (madayacentre.com/register). On the platform the form
// lives at /{slug}/register. The request waits for the admin (الإدارة ← طلبات التسجيل).
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "تسجيل طالب جديد", robots: { index: false, follow: false } };

export default async function RegisterPage() {
  const center = await centerForHost();
  if (!center) notFound();
  return (
    <PublicShell center={center}>
      <RegisterForm centerSlug={center.slug} open={center.registrations_open !== false} centerName={center.name} />
    </PublicShell>
  );
}
