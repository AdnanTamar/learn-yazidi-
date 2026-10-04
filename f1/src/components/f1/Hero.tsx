"use client";
import Link from "next/link";
import { ArrowRight, Radio } from "lucide-react";
import { useI18n } from "@/i18n";
import { GlassCard } from "@/components/ui/GlassCard";
import { DriverPhoto, Flag } from "@/components/ui/Media";
import { MagneticLink } from "@/components/ui/Magnetic";
import { Countdown } from "./Countdown";
import { fmtDateTime, gpName } from "@/lib/format";
import { regionName } from "@/lib/countries";
import { useSettings } from "@/lib/settings";
import type { DriverRow } from "@/lib/data";
import type { Race } from "@/types/f1";

export function LeaderCard({ row }: { row?: DriverRow }) {
  const { t, locale } = useI18n();
  if (!row) return <GlassCard tilt={0} className="grid place-items-center p-10 text-center text-white/55">{t("home.noLeader")}</GlassCard>;
  const d = row.driver;
  return (
    <GlassCard tilt={5} accent={d.color} className="group overflow-hidden">
      <div className="grid sm:grid-cols-[minmax(220px,0.9fr)_1.1fr]">
        <div className="relative min-h-[260px] sm:min-h-[340px]">
          <DriverPhoto driver={d} priority className="absolute inset-0 !rounded-none" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0b0d12] via-transparent to-transparent sm:bg-gradient-to-r sm:from-transparent sm:to-[#0b0d12]/70" />
          <span className="racing-num absolute bottom-2 left-4 text-8xl text-white/25" aria-hidden>{d.number}</span>
        </div>
        <div className="relative flex flex-col justify-between gap-6 p-6 sm:p-8">
          <div>
            <p className="eyebrow flex items-center gap-2"><span className="grid h-5 min-w-5 place-items-center rounded bg-accent px-1 text-[0.6rem] font-black text-white">P1</span>{t("home.leader")}</p>
            <h2 className="display mt-3 text-5xl leading-[.95] sm:text-6xl"><span className="block text-2xl text-white/65 sm:text-3xl">{d.firstName}</span>{d.lastName}</h2>
            <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-white/70"><span className="inline-flex items-center gap-2"><Flag code={d.countryCode} /> {regionName(d.countryCode, locale, d.nationality)}</span><span className="font-semibold" style={{ color: d.color }}>{d.teamName}</span></p>
          </div>
          <dl className="grid grid-cols-4 gap-2 border-t border-white/10 pt-5">
            {[[t("common.points"), row.points], [t("common.wins"), row.wins], [t("common.podiums"), row.stats?.podiums ?? "–"], [t("common.position"), "P" + row.position]].map(([l, v]) => (
              <div key={String(l)}><dd className="racing-num num pr-1 text-3xl sm:text-4xl">{v}</dd><dt className="eyebrow mt-1 !text-[0.58rem]">{l}</dt></div>
            ))}
          </dl>
          <Link href={`/drivers/${d.id}`} className="inline-flex items-center gap-2 text-sm font-semibold text-white/80 hover:text-white">{t("home.viewProfile")} <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden /></Link>
        </div>
      </div>
    </GlassCard>
  );
}

export function NextRaceCard({ race, live, sessionName }: { race: Race | null; live: boolean; sessionName?: "Race" | "Sprint" | null }) {
  const { t, lang, locale } = useI18n();
  const { settings } = useSettings();
  if (!race) return <GlassCard tilt={0} className="grid place-items-center p-10 text-center text-white/60">{t("home.seasonOver")}</GlassCard>;
  const o = { locale, ...settings };
  return (
    <GlassCard tilt={4} className={`flex flex-col justify-between gap-6 p-6 sm:p-8 ${live ? "!border-red-400/50 shadow-[0_0_0_1px_rgba(255,59,48,.3),0_30px_80px_-30px_rgba(255,59,48,.5)]" : ""}`}>
      <div>
        <p className="eyebrow flex items-center gap-2"><span className="timing-lights" aria-hidden><i className="on" /><i className="on" /><i className="on" /><i /><i /></span>{live ? t("home.currentGp") : t("home.nextGp")} · R{race.round}</p>
        <h2 className="display mt-3 text-4xl leading-none sm:text-5xl">{gpName(race, lang, locale)}</h2>
        <dl className="mt-5 grid grid-cols-2 gap-4 text-sm">
          <div><dt className="eyebrow !text-[0.6rem]">{t("common.circuit")}</dt><dd className="mt-1 font-medium">{race.circuitName}</dd><dd className="flex items-center gap-1.5 text-xs text-white/55"><Flag code={race.countryCode} /> {race.locality}, {regionName(race.countryCode, locale, race.country)}</dd></div>
          <div><dt className="eyebrow !text-[0.6rem]">{t("common.date")}</dt><dd className="mt-1 font-medium num">{fmtDateTime(race.race, o)}</dd><dd className="text-xs text-white/55">{t("common.local")}</dd></div>
        </dl>
      </div>
      {live ? (
        <div>
          <div className="flex items-center gap-3"><span className="live-dot" aria-hidden /><p className="display text-4xl text-red-100">{t("live.badge")}</p></div>
          <p className="mt-1 text-lg text-white/75">{sessionName === "Sprint" ? t("home.sprintInProgress") : t("home.raceInProgress")}</p>
          <MagneticLink href="/live" variant="primary" className="mt-4"><Radio className="h-4 w-4" aria-hidden />{t("home.watchLive")}</MagneticLink>
        </div>
      ) : (
        <div>
          <p className="eyebrow mb-3">{t("home.raceStartsIn")}</p>
          {race.race.iso ? <Countdown target={race.race.iso} /> : <p className="text-white/60">{fmtDateTime(race.race, o)}</p>}
        </div>
      )}
    </GlassCard>
  );
}
