import type { MetadataRoute } from "next";
import { centerForHost } from "@/lib/centerServer";

// PWA manifest. On a centre's own domain the installed app carries its name; elsewhere the platform's.
export const dynamic = "force-dynamic";

const SIZES = [48, 72, 96, 128, 144, 152, 192, 384, 512];

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const center = await centerForHost().catch(() => null);
  const name = center?.name ?? "حلقات — منصة مراكز تحفيظ القرآن";
  return {
    id: "/",
    name,
    short_name: center ? center.name.slice(0, 18) : "حلقات",
    description: "متابعة الحفظ والتلاوة والمراجعة والحضور — تعمل بدون إنترنت",
    lang: "ar",
    dir: "rtl",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    categories: ["education", "productivity"],
    icons: [
      ...SIZES.map((n) => ({ src: `/icon-${n}.png`, sizes: `${n}x${n}`, type: "image/png" })),
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [{ name: "الطلاب", url: "/", icons: [{ src: "/icon-96.png", sizes: "96x96" }] }],
  };
}
