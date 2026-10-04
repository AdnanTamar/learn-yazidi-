"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight } from "lucide-react";
import { useI18n, type Key } from "@/i18n";
import { useOverview, useSeason } from "@/hooks/useF1";
import { buildLookups } from "@/lib/data";
import { headToHead } from "@/lib/h2h";
import { Resource } from "@/components/ui/Resource";
import { SkeletonCards } from "@/components/ui/Skeleton";
import { GlassCard } from "@/components/ui/GlassCard";
import { PageHeader, Segmented, StatCard } from "@/components/ui/Bits";
import { BarMetric, ProgressChart } from "@/components/charts/Charts";
import { MagneticLink } from "@/components/ui/Magnetic";
import { Duel } from "@/components/f1/Duel";
import type { DriverSeasonStats, Overview, SeasonData } from "@/types/f1";

type Metric = "wins" | "podiums" | "poles" | "fastestLaps" | "points" | "avgQuali" | "avgFinish";
const METRICS: { id: Metric; label: Key; asc?: boolean; dec?: number }[] = [
  { id: "wins", label: "stats.mostWins" }, { id: "podiums", label: "stats.mostPodiums" }, { id: "poles", label: "stats.mostPoles" },
  { id: "fastestLaps", label: "stats.mostFastest" }, { id: "points", label: "stats.mostPoints" },
  { id: "avgQuali", label: "stats.bestQuali", asc: true, dec: 1 }, { id: "avgFinish", label: "stats.bestFinish", asc: true, dec: 1 },
];

function Content({ o, s }: { o: Overview; s: SeasonData }) {
  const { t, lang, locale } = useI18n();
  const lk = buildLookups(o);
  const [metric, setMetric] = useState<Metric>("wins");
  const m = METRICS.find((x) => x.id === metric)!;

  const val = (d: DriverSeasonStats) => d[metric] as number | null;
  const ranked = useMemo(() => s.drivers.filter((d) => val(d) != null && (!m.asc || d.races > 0)).sort((a, b) => (m.asc ? val(a)! - val(b)! : val(b)! - val(a)!)).slice(0, 10), [s, metric]); // eslint-disable-line react-hooks/exhaustive-deps
  const top = (id: Metric) => [...s.drivers].filter((d) => d[id] != null).sort((a, b) => (id === "avgQuali" || id === "avgFinish" ? (a[id] as number) - (b[id] as number) : (b[id] as number) - (a[id] as number)))[0];

  const teams = [...o.teamStandings].slice(0, 11);
  const topTeams = teams.slice(0, 5);
  const duels = o.teams.map((tm) => {
    const [a, b] = tm.driverIds;
    return a && b ? { team: tm, a, b, h: headToHead(s.rounds, a, b) } : null;
  }).filter(Boolean) as { team: Overview["teams"][number]; a: string; b: string; h: ReturnType<typeof headToHead> }[];

  return (
    <div className="grid gap-10">
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {(["wins", "podiums", "poles", "fastestLaps", "points"] as Metric[]).map((id) => {
          const d = top(id);
          const dr = d ? lk.drivers.get(d.driverId) : null;
          return <StatCard key={id} label={t(METRICS.find((x) => x.id === id)!.label)} value={d ? (d[id] as number) : "–"} hint={dr?.name} accent={dr?.color} />;
        })}
      </section>

      <section>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <h2 className="display text-3xl">{t("stats.leaders")}</h2>
          <Segmented<Metric> label={t("stats.metric")} value={metric} onChange={setMetric} options={METRICS.map((x) => ({ value: x.id, label: t(x.label) }))} />
        </div>
        <GlassCard tilt={0} className="p-4 sm:p-6">
          <BarMetric decimals={m.dec ?? 0} data={ranked.map((d) => ({ id: d.driverId, label: lk.drivers.get(d.driverId)?.lastName ?? d.driverId, value: val(d)!, color: lk.drivers.get(d.driverId)?.color ?? "#888" }))} />
          {m.asc && <p className="mt-2 text-xs text-white/45">{t("stats.avgNote")} · {t("compare.lowerBetter")}</p>}
        </GlassCard>
        <p className="mt-3 rounded-2xl bg-white/[.04] px-4 py-3 text-sm text-white/55"><b className="text-white/75">{t("stats.lapsLed")}:</b> {t("stats.lapsLedNA")}</p>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div>
          <h2 className="display mb-4 text-3xl">{t("stats.teamPerf")}</h2>
          <GlassCard tilt={0} className="p-4 sm:p-6"><BarMetric height={380} unit={t("common.pts")} data={teams.map((x) => ({ id: x.teamId, label: lk.teams.get(x.teamId)?.name.replace(/ F1 Team$/, "") ?? x.teamId, value: x.points, color: lk.teams.get(x.teamId)?.color ?? "#888" }))} /></GlassCard>
        </div>
        <div>
          <h2 className="display mb-4 text-3xl">{t("stats.pointsRace")}</h2>
          <GlassCard tilt={0} className="p-4 sm:p-6">
            <ProgressChart height={380} roundLabels={Object.fromEntries(o.calendar.map((r) => [r.round, `R${r.round}`]))} series={topTeams.map((x) => ({ id: x.teamId, label: lk.teams.get(x.teamId)?.name ?? x.teamId, color: lk.teams.get(x.teamId)?.color ?? "#888", data: s.teams.find((tt) => tt.teamId === x.teamId)?.progression ?? [] }))} />
          </GlassCard>
        </div>
      </section>

      <section>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <h2 className="display text-3xl">{t("stats.h2h")}</h2>
          <MagneticLink href="/compare" variant="glass">{t("stats.compareCta")} <ArrowRight className="h-4 w-4" aria-hidden /></MagneticLink>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {duels.map(({ team, a, b, h }) => {
            const da = lk.drivers.get(a)!, db = lk.drivers.get(b)!;
            return (
              <GlassCard key={team.id} tilt={4} accent={team.color} className="p-5">
                <Link href={`/compare?a=${a}&b=${b}`} className="block">
                  <p className="eyebrow !text-[0.62rem]" style={{ color: team.color }}>{team.name}</p>
                  <div className="mt-2 flex items-center justify-between display text-2xl"><span>{da.lastName}</span><span className="text-sm text-white/40">vs</span><span>{db.lastName}</span></div>
                  <Duel label={t("session.qualifying")} a={h.qualiA} b={h.qualiB} ca={da.color} cb="#c8ccd6" />
                  <Duel label={t("session.race")} a={h.raceA} b={h.raceB} ca={da.color} cb="#c8ccd6" />
                </Link>
              </GlassCard>
            );
          })}
        </div>
      </section>
      <p className="hidden">{lang}{locale}</p>
    </div>
  );
}

export default function StatisticsPage() {
  const { t } = useI18n();
  const ov = useOverview();
  const season = useSeason();
  return (
    <>
      <PageHeader title={t("stats.title")} subtitle={t("stats.subtitle")} />
      <Resource query={ov} loading={<SkeletonCards n={6} label={t("load.stats")} h="h-40" />}>
        {(o) => <Resource quiet query={season} loading={<SkeletonCards n={6} label={t("load.stats")} h="h-64" />}>{(s) => <Content o={o} s={s} />}</Resource>}
      </Resource>
    </>
  );
}
