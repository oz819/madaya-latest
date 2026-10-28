import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans_Arabic } from "next/font/google";
import "./globals.css";
import ServiceWorker from "@/components/ServiceWorker";

// Body text font for the whole app (exposed as --font-body, see the 2026 theme in globals.css).
const plex = IBM_Plex_Sans_Arabic({ subsets: ["arabic"], weight: ["400", "500", "700"], variable: "--font-body", display: "swap" });

export const metadata: Metadata = {
  title: "منظومة متابعة حلقات القرآن",
  description: "متابعة الحفظ والتلاوة والمراجعة والتلقين والعربية والتربية — تعمل بدون إنترنت",
  applicationName: "حلقات القرآن",
  // Every page is behind a login — nothing here should be indexed.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#04140f",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ar" dir="rtl">
      <body className={plex.variable}>
        {children}
        <ServiceWorker />
      </body>
    </html>
  );
}
