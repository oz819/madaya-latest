import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "منظومة متابعة حلقات القرآن",
    short_name: "حلقات القرآن",
    description: "متابعة الحفظ والتلاوة والمراجعة والتلقين والعربية والتربية — تعمل بدون إنترنت",
    lang: "ar",
    dir: "rtl",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#04140f",
    theme_color: "#04140f",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
