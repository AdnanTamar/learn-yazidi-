"use client";
import type { ReactNode } from "react";
import { LanguageProvider, type Lang } from "@/i18n";
import { SettingsProvider } from "@/lib/settings";

export function Providers({ lang, children }: { lang: Lang; children: ReactNode }) {
  return (
    <LanguageProvider initial={lang}>
      <SettingsProvider>{children}</SettingsProvider>
    </LanguageProvider>
  );
}
