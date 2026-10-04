"use client";
import Link from "next/link";
import { use } from "react";
import { ArrowLeft, Zap, ShieldAlert, Flag as FlagIcon, Gavel, Trophy, Timer, OctagonAlert } from "lucide-react";
import { useI18n } from "@/i18n";
import { useNow, useOverview, useRace, raceStatus } from "@/hooks/useF1";
import { buildLookups } from "@/lib/data";
import { Resource, ErrorState } from "@/components/ui/Resource";
import { Skeleton } from "@/components/ui/Skeleton";
import { GlassCard } from "@/components/ui/GlassCard";
import { Flag } from "@/components/ui/Media";
import { StatusBadge } from "@/components/ui/Bits";
import { CircuitMap } from "@/components/f1/CircuitMap";
import { RaceSessions } from "@/components/f1/RaceSessions";
import { fmtDateTime, gpName } from "@/lib/format";
import { regionName } from "@/lib/countries";
import { useSettings } from "@/lib/settings";
import type { RaceDetail } from "@/types/f1";

export default function RacePage({ params }: { params: Promise<{ round: string }> }) {
  const { round } = use(params);
  const n = Number(round);
  const q = useRace(Number.isFinite(n) ? n : null);
  const ov = useOverview();
  const { t } = useI18n();
  return (
    <>
      <Link href="/calendar" className="mb-5 inline-flex items-center gap-2 text-sm text-white/60 hover:text-white"><ArrowLeft className="h-4 w-4" aria-hidden />{t("nav.calendar")}</Link>
      {q.error && !q.data && (q.error as { status?: number }).status === 404 ? (
        <ErrorState message={t("err.notFound")} />
      ) : (
        <Resource query={q} loading={<Skeleton className="h-[480px] !rounded-3xl" />} errorKey="err.race">
          {(d) => <Detail d={d} lk={buildLookups(ov.data)} />}
        </Resource>
      )}
    </>
  );
}

function Fact({ Icon, label, children }: { Icon: typeof Zap; label: string; children: React.ReactNode }) {
  return (
    <GlassCard tilt={3} className="p-4">
      <p className="eyebrow flex items-center gap-1.5 !text-[0.62rem]"><Icon className="h-3.5 w-3.5" aria-hidden />{label}</p>
      <div className="mt-2 text-lg font-semibold leading-snug">{children}</div>
    </GlassCard>
  );
}

function Detail({ d, lk }: { d: RaceDetail; lk: ReturnType<typeof buildLookups> }) {
  const { t, lang, locale } = useI18n();
  const { settings } = useSettings();
  const now = useNow();
  const o = { locale, ...settings };
  const r = d.race;
  const status = now ? raceStatus(r, now) : "upcoming";
  const name = (id?: string) => (id ? lk.drivers.get(id)?.name ?? id : "—");
  const winner = d.results.find((x) => x.position === 1);
  const pole = d.qualifying.find((x) => x.position === 1) ?? null;
  const fl = d.results.find((x) => x.fastestLap?.rank === 1);
  const podium = d.results.filter((x) => x.position && x.position <= 3 && x.finished);
  const retired = d.results.filter((x) => !x.finished);
  const na = <span className="text-sm font-normal text-white/45">{t("race.reportNA")}</span>;
  const sessions = [
    ...r.practice.map((p) => ({ label: t(`session.${p.key.toLowerCase()}` as never), s: p.session })),
    ...(r.sprintQualifying ? [{ label: t("session.sprintQualifying"), s: r.sprintQualifying }] : []),
    ...(r.sprint ? [{ label: t("session.sprint"), s: r.sprint }] : []),
    ...(r.qualifying ? [{ label: t("session.qualifying"), s: r.qualifying }] : []),
    { label: t("session.race"), s: r.race },
  ];

  return (
    <div className="grid gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow mb-3 flex items-center gap-3"><span className="rounded-md border border-white/15 px-1.5 py-0.5 font-mono font-bold">R{String(r.round).padStart(2, "0")}</span>{r.season}{r.isSprint && <span className="rounded-md bg-accent/90 px-1.5 py-0.5 font-bold text-white">{t("calendar.sprintWeekend")}</span>}</p>
          <h1 className="display text-5xl leading-none sm:text-7xl">{gpName(r, lang, locale)}</h1>
          <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-white/65"><span className="inline-flex items-center gap-2"><Flag code={r.countryCode} size={40} />{regionName(r.countryCode, locale, r.country)}</span><span>{r.circuitName}</span><span className="text-white/45">{r.locality}</span></p>
        </div>
        <StatusBadge status={status} />
      </header>

      <div className="grid gap-5 lg:grid-cols-[1fr_1.2fr]">
        <GlassCard tilt={0} className="p-5">
          <h2 className="eyebrow mb-3">{t("race.circuitLayout")}</h2>
          <div className="relative aspect-[4/3]"><CircuitMap points={d.extras.trackPoints} className="h-full w-full" label={`${r.circuitName}`} /></div>
        </GlassCard>
        <GlassCard tilt={0} className="p-5">
          <h2 className="eyebrow mb-3">{t("race.weekend")} <span className="ml-2 normal-case tracking-normal text-white/40">({t("common.local")})</span></h2>
          <ul className="divide-y divide-white/5">
            {sessions.map((s, i) => (
              <li key={i} className="flex items-center justify-between gap-4 py-2.5 text-sm"><span className={i === sessions.length - 1 ? "font-semibold" : "text-white/75"}>{s.label}</span><span className="num text-white/80">{fmtDateTime(s.s, o)}</span></li>
            ))}
          </ul>
        </GlassCard>
      </div>

      <section aria-label={t("race.summary")} className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Fact Icon={Trophy} label={t("race.winner")}>{winner ? <>{name(winner.driverId)}<span className="block text-sm font-normal text-white/55">{lk.teams.get(winner.teamId)?.name}</span></> : "—"}</Fact>
        <Fact Icon={Timer} label={t("race.pole")}>{pole ? name(pole.driverId) : "—"}{pole && <span className="mono block text-sm font-normal text-white/55">{pole.q3 ?? pole.q2 ?? pole.q1}</span>}</Fact>
        <Fact Icon={Zap} label={t("race.fastestLap")}>{fl ? <>{name(fl.driverId)}<span className="mono block text-sm font-normal text-white/55">{fl.fastestLap?.time}{fl.fastestLap?.lap ? ` · ${t("live.lap")} ${fl.fastestLap.lap}` : ""}</span></> : "—"}</Fact>
        <Fact Icon={FlagIcon} label={t("race.podium")}>{podium.length ? <ol className="text-sm font-medium leading-relaxed">{podium.map((p) => <li key={p.driverId}><span className="racing-num mr-2 text-base">{p.position}</span>{lk.drivers.get(p.driverId)?.lastName ?? p.driverId}</li>)}</ol> : "—"}</Fact>
        <Fact Icon={ShieldAlert} label={t("race.safetyCars")}>{d.extras.safetyCars == null ? na : <>{d.extras.safetyCars}{d.extras.virtualSafetyCars ? <span className="ml-2 text-sm font-normal text-white/55">+ {d.extras.virtualSafetyCars} VSC</span> : null}</>}</Fact>
        <Fact Icon={OctagonAlert} label={t("race.redFlags")}>{d.extras.redFlags == null ? na : d.extras.redFlags}</Fact>
        <Fact Icon={FlagIcon} label={t("race.retirements")}>{d.results.length ? (retired.length ? <ul className="text-sm font-medium leading-relaxed">{retired.map((x) => <li key={x.driverId}>{lk.drivers.get(x.driverId)?.code ?? x.driverId} <span className="font-normal text-white/50">· {x.status}</span></li>)}</ul> : t("race.none")) : "—"}</Fact>
        <Fact Icon={Gavel} label={t("race.penalties")}>{d.extras.penalties == null ? na : d.extras.penalties.length ? <ul className="max-h-24 overflow-y-auto text-xs font-normal leading-snug text-white/75">{d.extras.penalties.slice(0, 8).map((p, i) => <li key={i} className="mb-1">{p.lap ? `${t("live.lap")} ${p.lap}: ` : ""}{p.text}</li>)}</ul> : t("race.none")}</Fact>
      </section>

      <section aria-label={t("race.classification")}>
        <h2 className="display mb-4 text-3xl">{t("race.classification")}</h2>
        <RaceSessions round={r.round} />
      </section>
    </div>
  );
}
