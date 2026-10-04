"use client";
import { useI18n } from "@/i18n";

export function SkipLink() {
  const { t } = useI18n();
  return (
    <a href="#content" className="sr-only fixed left-4 top-4 z-[200] rounded-full bg-white px-4 py-2 text-sm font-semibold text-black focus:not-sr-only">
      {t("a11y.skip")}
    </a>
  );
}
