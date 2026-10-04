import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import type { ReactNode } from "react";
import "./globals.css";
import { Providers } from "@/components/layout/Providers";
import { AmbientBackground } from "@/components/layout/AmbientBackground";
import { NavigationBar } from "@/components/layout/NavigationBar";
import { Footer } from "@/components/layout/Footer";
import { SkipLink } from "@/components/layout/SkipLink";
import type { Lang } from "@/i18n";

export const metadata: Metadata = {
  title: { default: "Pit Wall — Formula 1 standings, calendar & live timing", template: "%s · Pit Wall" },
  description: "Championship standings, race calendar, results, statistics and live race classification for Formula 1.",
};
export const viewport: Viewport = { themeColor: "#07080b", width: "device-width", initialScale: 1 };

export default async function RootLayout({ children }: { children: ReactNode }) {
  const lang: Lang = (await cookies()).get("lang")?.value === "nl" ? "nl" : "en";
  return (
    <html lang={lang} data-motion="on">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:ital,wght@0,600;0,700;0,800;1,700;1,800&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500;700&display=swap" rel="stylesheet" />
      </head>
      <body>
        <Providers lang={lang}>
          <SkipLink />
          <AmbientBackground />
          <NavigationBar />
          <main id="content" className="mx-auto max-w-[1400px] px-4 pb-8 pt-24 sm:px-6 sm:pt-28">
            {children}
          </main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
