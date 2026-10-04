"use client";
import Link from "next/link";
import { useI18n } from "@/i18n";
import { useNow, raceStatus } from "@/hooks/useF1";
import { GlassCard } from "@/components/ui/GlassCard";
import { Flag } from "@/components/ui/Media";
import { StatusBadge } from "@/components/ui/Bits";
import { fmtDate, fmtDateTime, gpName } from "@/lib/format";
import { regionName } from "@/lib/countries";
import { useSettings } from "@/lib/settings";
import type { Race } from "@/types/f1";

export function RaceCard({ race, winner }: { race: Race; winner?: string }) {
  const { t, lang, locale } = useI18n();
  const { settings } = useSettings();
  const now = useNow();
  const status = now ? raceStatus(race, now) : "upcoming";
  const o = { locale, ...settings };
  const tone = status === "live" ? "border-red-400/50 shadow-[0_0_0_1px_rgba(255,59,48,.35),0_20px_60px_-20px_rgba(255,59,48,.45)]" : status === "finished" ? "opacity-[.88]" : "";
  return (
    <GlassCard as="article" tilt={5} className={`group h-full overflow-hidden ${tone}`}>
      <Link href={`/races/${race.round}`} className="relative flex h-full flex-col gap-4 rounded-[inherit] p-5" aria-label={gpName(race, lang, locale)}>
        <div className="pointer-events-none absolute -right-6 -top-4 select-none" aria-hidden>
          <span className="racing-num text-[8rem] leading-none text-white/[.045]">{String(race.round).padStart(2, "0")}</span>
        </div>
        <div className="relative flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-white/60">
            <span className="rounded-md border border-white/15 px-1.5 py-0.5 font-mono font-bold">R{String(race.round).padStart(2, "0")}</span>
            {race.isSprint && <span className="rounded-md bg-accent/90 px-1.5 py-0.5 font-bold uppercase tracking-wider text-white">{t("session.sprint")}</span>}
          </div>
          <StatusBadge status={status} />
        </div>
        <div className="relative">
          <div className="mb-3 flex items-center gap-2.5 text-3xl"><Flag code={race.countryCode} size={80} className="!h-7 transition-transform duration-500 group-hover:scale-110" /></div>
          <h3 className="display text-2xl leading-[1.05]">{gpName(race, lang, locale)}</h3>
          <p className="mt-1.5 text-sm text-white/65">{race.circuitName}</p>
          <p className="text-xs text-white/45">{race.locality}, {regionName(race.countryCode, locale, race.country)}</p>
        </div>
        <div className="track-line relative mt-auto opacity-60" aria-hidden />
        <dl className="relative grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
          <div><dt className="eyebrow !text-[0.58rem]">{t("calendar.raceDay")}</dt><dd className="mt-0.5 text-sm font-semibold num">{fmtDateTime(race.race, o)}</dd></div>
          <div><dt className="eyebrow !text-[0.58rem]">{t("calendar.quali")}</dt><dd className="mt-0.5 text-sm num text-white/80">{fmtDateTime(race.qualifying, o)}</dd></div>
          {race.sprint && <div className="col-span-2"><dt className="eyebrow !text-[0.58rem]">{t("calendar.sprintDay")}</dt><dd className="mt-0.5 text-sm num text-white/80">{fmtDateTime(race.sprint, o)}</dd></div>}
        </dl>
        {winner && status === "finished" && <p className="relative text-xs text-white/55">{t("home.winner")}: <b className="text-white">{winner}</b></p>}
        <p className="sr-only">{fmtDate(race.race.date, o, "long")}</p>
      </Link>
    </GlassCard>
  );
}
