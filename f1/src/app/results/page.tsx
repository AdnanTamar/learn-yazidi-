"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { useI18n } from "@/i18n";
import { useNow, useOverview, raceStatus } from "@/hooks/useF1";
import { Resource } from "@/components/ui/Resource";
import { Skeleton } from "@/components/ui/Skeleton";
import { PageHeader } from "@/components/ui/Bits";
import { Flag } from "@/components/ui/Media";
import { RaceSessions } from "@/components/f1/RaceSessions";
import { gpName } from "@/lib/format";
import type { Overview } from "@/types/f1";

function Content({ o }: { o: Overview }) {
  const { t, lang, locale } = useI18n();
  const now = useNow();
  const done = o.calendar.filter((r) => (now ? raceStatus(r, now) !== "upcoming" : r.round <= o.completedRounds));
  const latest = done.at(-1)?.round ?? o.calendar[0]?.round;
  const [round, setRound] = useState<number | null>(null);
  useEffect(() => setRound((r) => r ?? latest ?? null), [latest]);
  const sel = round ?? latest;
  const race = o.calendar.find((r) => r.round === sel);
  return (
    <>
      <div className="hide-scroll mb-6 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label={t("race.pickRace")}>
        {done.map((r) => (
          <button key={r.round} role="tab" aria-selected={r.round === sel} onClick={() => setRound(r.round)} className={`flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-2 text-sm font-semibold transition ${r.round === sel ? "border-white bg-white text-black" : "border-white/12 bg-white/[.04] text-white/75 hover:bg-white/10"}`}>
            <Flag code={r.countryCode} /><span className="num text-xs opacity-60">R{r.round}</span>{r.locality}
          </button>
        ))}
      </div>
      {race && sel ? (
        <>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <h2 className="display text-3xl">{gpName(race, lang, locale)}</h2>
            <Link href={`/races/${sel}`} className="inline-flex items-center gap-1.5 text-sm font-semibold text-white/70 hover:text-white">{t("common.details")} <ArrowUpRight className="h-4 w-4" aria-hidden /></Link>
          </div>
          <RaceSessions round={sel} />
        </>
      ) : <Skeleton className="h-96 !rounded-3xl" />}
    </>
  );
}

export default function ResultsPage() {
  const { t } = useI18n();
  const q = useOverview();
  return (
    <>
      <PageHeader title={t("results.title")} subtitle={t("results.subtitle")} />
      <Resource query={q} loading={<Skeleton className="h-96 !rounded-3xl" />} errorKey="err.race">{(o) => <Content o={o} />}</Resource>
    </>
  );
}
