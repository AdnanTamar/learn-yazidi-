"use client";
import { useI18n } from "@/i18n";

export function Footer() {
  const { t } = useI18n();
  return (
    <footer className="mx-auto mt-16 max-w-[1400px] px-4 pb-32 text-xs text-white/45 sm:px-6 xl:pb-12">
      <div className="track-line mb-6" aria-hidden />
      <p className="max-w-3xl leading-relaxed">{t("footer.disclaimer")}</p>
    </footer>
  );
}
