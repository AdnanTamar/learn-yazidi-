"use client";
import Link from "next/link";
import { useI18n } from "@/i18n";

export function StandingsTabs({ active }: { active: "drivers" | "teams" }) {
  const { t } = useI18n();
  const cls = (on: boolean) => `rounded-full px-4 py-1.5 text-sm font-semibold ${on ? "bg-white text-black" : "text-white/70 hover:text-white"}`;
  return (
    <nav aria-label={t("nav.standings")} className="inline-flex gap-1 rounded-full border border-white/10 bg-white/[.04] p-1">
      <Link href="/standings" className={cls(active === "drivers")} aria-current={active === "drivers" ? "page" : undefined}>{t("standings.drivers")}</Link>
      <Link href="/standings/constructors" className={cls(active === "teams")} aria-current={active === "teams" ? "page" : undefined}>{t("standings.teams")}</Link>
    </nav>
  );
}
