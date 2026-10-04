"use client";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useI18n } from "@/i18n";
import { useOverview, useRace, useSchedule, raceStatus } from "@/hooks/useF1";
import { useDriverRows, useTeamRows, buildLookups } from "@/lib/data";
import { Resource } from "@/components/ui/Resource";
import { Skeleton, SkeletonRows } from "@/components/ui/Skeleton";
import { GlassCard } from "@/components/ui/GlassCard";
import { DriverStandingsTable, TeamStandingsTable } from "@/components/f1/StandingsTable";
import { LeaderCard, NextRaceCard } from "@/components/f1/Hero";
import { LiveDashboard } from "@/components/f1/LiveDashboard";
import { RaceCard } from "@/components/f1/RaceCard";
import { Flag } from "@/components/ui/Media";
import { gpName } from "@/lib/format";
import type { Overview } from "@/types/f1";

function HomeSkeleton() {
  return (
    <div role="status" aria-live="polite">
      <Skeleton className="mb-6 h-14 w-2/3 max-w-xl" />
      <div className="grid gap-5 lg:grid-cols-[1.35fr_1fr]"><Skeleton className="h-[360px] !rounded-3xl" /><Skeleton className="h-[360px] !rounded-3xl" /></div>
      <div className="mt-8"><SkeletonRows rows={5} label="…" /></div>
    </div>
  );
}

function LatestResult({ o }: { o: Overview }) {
  const { t, lang, locale } = useI18n();
  const finished = [...o.calendar].filter((r) => r.round <= o.completedRounds).pop();
  const race = useRace(finished?.round ?? null);
  if (!finished) return null;
  const lk = buildLookups(o);
  const podium = race.data?.results.filter((r) => r.position && r.position <= 3 && r.finished) ?? [];
  return (
    <GlassCard tilt={3} className="p-6">
      <p className="eyebrow">{t("home.latestResult")}</p>
      <Link href={`/races/${finished.round}`} className="group mt-2 flex items-center gap-2"><h3 className="display text-3xl">{gpName(finished, lang, locale)}</h3><ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden /></Link>
      <ol className="mt-5 grid gap-2">
        {!race.data && [0, 1, 2].map((i) => <Skeleton key={i} className="h-12" />)}
        {podium.map((r) => {
          const d = lk.drivers.get(r.driverId);
          return (
            <li key={r.driverId} className="flex items-center gap-3 rounded-2xl bg-white/[.045] px-3 py-2.5">
              <span className="racing-num w-6 text-2xl">{r.position}</span>
              <span className="h-6 w-1 rounded-full" style={{ background: d?.color }} aria-hidden />
              <span className="min-w-0 flex-1"><b className="font-semibold">{d?.name ?? r.driverId}</b> <span className="text-sm text-white/50">{d?.teamName}</span></span>
              <Flag code={d?.countryCode ?? null} />
              <span className="mono text-xs text-white/60">{r.position === 1 ? r.time : r.time}</span>
            </li>
          );
        })}
      </ol>
    </GlassCard>
  );
}

function HomeContent({ o }: { o: Overview }) {
  const { t } = useI18n();
  const schedule = useSchedule(o.calendar);
  const drivers = useDriverRows();
  const teams = useTeamRows();
  const liveRace = schedule?.liveRace ?? null;
  const current = schedule?.current ?? null;
  const upcoming = o.calendar.filter((r) => schedule && r !== current && raceStatus(r, schedule.now) === "upcoming").slice(0, 3);

  return (
    <>
      <section aria-labelledby="hero-title" className="mb-8">
        <div className="mb-7">
          <p className="eyebrow mb-3 flex items-center gap-3"><span className="inline-block h-px w-8 bg-accent" aria-hidden /><span className="num">{o.completedRounds}/{o.calendar.length}</span> {t("home.roundsDone")}</p>
          <h1 id="hero-title" className="display text-5xl leading-[.9] sm:text-8xl">
            <span className="block text-white/90">Formula 1</span>
            <span className="block bg-gradient-to-r from-white via-white to-accent-soft bg-clip-text text-transparent">{o.season} <span className="text-[.55em] tracking-wider">{t("home.season")}</span></span>
          </h1>
        </div>
      </section>

      {liveRace ? (
        <section className="mb-10"><LiveDashboard race={liveRace} sessionName={schedule?.liveSessionName ?? null} /></section>
      ) : (
        <section className="mb-10 grid gap-5 lg:grid-cols-[1.35fr_1fr]">
          <LeaderCard row={drivers.rows?.[0]?.points ? drivers.rows[0] : undefined} />
          <NextRaceCard race={current} live={false} />
        </section>
      )}

      {liveRace && (
        <section className="mb-10 grid gap-5 lg:grid-cols-[1.35fr_1fr]">
          <LeaderCard row={drivers.rows?.[0]?.points ? drivers.rows[0] : undefined} />
          <NextRaceCard race={liveRace} live sessionName={schedule?.liveSessionName} />
        </section>
      )}

      <section className="mb-10 grid gap-8 xl:grid-cols-[1.5fr_1fr]">
        <div>
          <SectionHead title={t("home.topDrivers")} href="/standings" cta={t("home.fullStandings")} />
          {drivers.rows ? <DriverStandingsTable rows={drivers.rows} limit={6} compact /> : <SkeletonRows rows={6} label={t("load.championship")} />}
        </div>
        <div className="grid content-start gap-8">
          <div>
            <SectionHead title={t("home.topTeams")} href="/standings/constructors" cta={t("home.fullStandings")} />
            {teams.rows ? <TeamStandingsTable rows={teams.rows.slice(0, 4)} /> : <SkeletonRows rows={4} label={t("load.championship")} />}
          </div>
        </div>
      </section>

      <section className="mb-10 grid gap-5 lg:grid-cols-[1fr_1.4fr]">
        <LatestResult o={o} />
        <div>
          <SectionHead title={t("home.upcoming")} href="/calendar" cta={t("home.fullCalendar")} />
          <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-3">{upcoming.map((r) => <RaceCard key={r.round} race={r} />)}</div>
        </div>
      </section>

      <section aria-label={t("home.seasonProgress")} className="glass p-5">
        <div className="mb-2 flex items-center justify-between text-xs text-white/55"><span className="eyebrow">{t("home.seasonProgress")}</span><span className="num">{o.completedRounds}/{o.calendar.length} {t("home.roundsDone")}</span></div>
        <div className="flex gap-1">{o.calendar.map((r) => <span key={r.round} title={r.name} className={`h-2 flex-1 rounded-full ${r.round <= o.completedRounds ? "bg-accent" : "bg-white/12"}`} />)}</div>
      </section>
    </>
  );
}

function SectionHead({ title, href, cta }: { title: string; href: string; cta: string }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-3">
      <h2 className="display text-3xl">{title}</h2>
      <Link href={href} className="group flex items-center gap-1.5 whitespace-nowrap text-sm font-semibold text-white/65 hover:text-white">{cta}<ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden /></Link>
    </div>
  );
}

export default function HomePage() {
  const q = useOverview();
  return <Resource query={q} loading={<HomeSkeleton />}>{(o) => <HomeContent o={o} />}</Resource>;
}
