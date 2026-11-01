import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans_Arabic } from "next/font/google";
import "./globals.css";
import "./theme.css";
import ServiceWorker from "@/components/ServiceWorker";

// Body text font for the whole app (exposed as --font-body, see the 2026 theme in globals.css).
const plex = IBM_Plex_Sans_Arabic({ subsets: ["arabic", "latin"], weight: ["400", "500", "600", "700"], variable: "--font-body", display: "swap" });

export const metadata: Metadata = {
  title: "حلقات — منصة مراكز تحفيظ القرآن",
  description: "متابعة الحفظ والتلاوة والمراجعة والتلقين والعربية والتربية — تعمل بدون إنترنت",
  applicationName: "حلقات القرآن",
  // Every page is behind a login — nothing here should be indexed.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0e1116" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ar" dir="rtl" data-palette="indigo">
      <body className={plex.variable}>
        {children}
        <ServiceWorker />
      </body>
    </html>
  );
}
