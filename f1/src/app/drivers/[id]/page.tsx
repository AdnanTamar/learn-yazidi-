"use client";
import Link from "next/link";
import { use } from "react";
import { ArrowLeft } from "lucide-react";
import { useI18n } from "@/i18n";
import { useCareer, useSeason } from "@/hooks/useF1";
import { useDriverRows, buildLookups } from "@/lib/data";
import { Resource, ErrorState } from "@/components/ui/Resource";
import { Skeleton } from "@/components/ui/Skeleton";
import { GlassCard } from "@/components/ui/GlassCard";
import { DriverPhoto, Flag } from "@/components/ui/Media";
import { FormChips, StatCard } from "@/components/ui/Bits";
import { ProgressChart } from "@/components/charts/Charts";
import { regionName } from "@/lib/countries";
import { gpName, fmtDate } from "@/lib/format";
import { useSettings } from "@/lib/settings";
import type { Overview } from "@/types/f1";

export default function DriverPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { rows, overview } = useDriverRows();
  const { t } = useI18n();
  return (
    <>
      <Link href="/drivers" className="mb-5 inline-flex items-center gap-2 text-sm text-white/60 hover:text-white"><ArrowLeft className="h-4 w-4" aria-hidden />{t("nav.drivers")}</Link>
      <Resource query={overview} loading={<Skeleton className="h-[480px] !rounded-3xl" />}>
        {(o) => (rows?.find((r) => r.driver.id === id) ? <Profile id={id} o={o} /> : <ErrorState message={t("profile.notFound")} detail={id} />)}
      </Resource>
    </>
  );
}

function Profile({ id, o }: { id: string; o: Overview }) {
  const { t, lang, locale } = useI18n();
  const { settings } = useSettings();
  const { rows } = useDriverRows();
  const season = useSeason();
  const career = useCareer(id);
  const row = rows!.find((r) => r.driver.id === id)!;
  const d = row.driver;
  const s = row.stats;
  const lk = buildLookups(o);
  const mate = rows!.find((r) => r.driver.teamId === d.teamId && r.driver.id !== id);
  const c = career.data?.career;
  const fmtAvg = (n: number | null | undefined) => (n == null ? "–" : n.toFixed(1));

  const history = (season.data?.rounds ?? []).filter((r) => r.race.some((x) => x.driverId === id)).map((r) => ({ round: r.round, row: r.race.find((x) => x.driverId === id)!, race: o.calendar.find((x) => x.round === r.round) })).reverse();

  return (
    <div className="grid gap-6">
      <GlassCard tilt={3} accent={d.color} className="group overflow-hidden">
        <div className="grid md:grid-cols-[minmax(280px,.8fr)_1.2fr]">
          <div className="relative min-h-[320px] md:min-h-[440px]">
            <DriverPhoto driver={d} priority className="absolute inset-0 !rounded-none" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0b0d12] via-transparent to-transparent md:bg-gradient-to-r md:from-transparent md:to-[#0b0d12]/80" />
          </div>
          <div className="relative flex flex-col justify-between gap-8 p-6 sm:p-10">
            <span className="racing-num pointer-events-none absolute right-6 top-2 text-[9rem] text-white/[.06] sm:text-[12rem]" aria-hidden>{d.number}</span>
            <div className="relative">
              <p className="eyebrow">{t("profile.standing")}: P{row.position}</p>
              <h1 className="display mt-3 text-6xl leading-[.9] sm:text-8xl"><span className="block text-3xl text-white/65 sm:text-4xl">{d.firstName}</span>{d.lastName}</h1>
              <p className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-white/75">
                <span className="inline-flex items-center gap-2"><Flag code={d.countryCode} size={40} /> {regionName(d.countryCode, locale, d.nationality)}</span>
                <Link href={d.teamId ? `/teams/${d.teamId}` : "#"} className="font-semibold hover:underline" style={{ color: d.color }}>{d.teamName}</Link>
                {d.dob && <span className="text-sm text-white/50">{t("profile.born")} {fmtDate(d.dob, { locale, ...settings }, "long")}</span>}
              </p>
            </div>
            <dl className="relative grid grid-cols-3 gap-4 border-t border-white/10 pt-6 sm:grid-cols-5">
              {[[t("profile.number"), `#${d.number ?? "–"}`], [t("common.points"), row.points], [t("common.wins"), row.wins], [t("common.podiums"), s?.podiums ?? "–"], [t("common.poles"), s?.poles ?? "–"]].map(([l, v]) => (
                <div key={String(l)}><dd className="racing-num num text-4xl sm:text-5xl">{v}</dd><dt className="eyebrow mt-1 !text-[0.58rem]">{l}</dt></div>
              ))}
            </dl>
          </div>
        </div>
      </GlassCard>

      <section aria-labelledby="season-h">
        <h2 id="season-h" className="display mb-4 text-3xl">{t("profile.season", { season: o.season })}</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-4">
          <StatCard label={t("common.fastestLaps")} value={s?.fastestLaps ?? "–"} accent={d.color} />
          <StatCard label={t("profile.avgQuali")} value={fmtAvg(s?.avgQuali)} accent={d.color} />
          <StatCard label={t("profile.avgFinish")} value={fmtAvg(s?.avgFinish)} accent={d.color} />
          <StatCard label={t("profile.dnfs")} value={s?.dnfs ?? "–"} accent={d.color} />
        </div>
        <div className="mt-3 flex items-center gap-3 text-sm text-white/55"><span>{t("common.form")}</span><FormChips form={s?.form ?? []} /></div>
      </section>

      <section aria-labelledby="progress-h">
        <h2 id="progress-h" className="display mb-4 text-3xl">{t("profile.progress")}</h2>
        <GlassCard tilt={0} className="p-4 sm:p-6">
          {season.data ? (
            <ProgressChart
              roundLabels={Object.fromEntries(o.calendar.map((r) => [r.round, `R${r.round} · ${gpName(r, lang, locale)}`]))}
              series={[
                { id: d.id, label: d.name, color: d.color, data: s?.progression ?? [] },
                ...(mate ? [{ id: mate.driver.id, label: mate.driver.name, color: "#c8ccd6", data: mate.stats?.progression ?? [] }] : []),
              ]}
            />
          ) : <Skeleton className="h-72" />}
        </GlassCard>
      </section>

      <section aria-labelledby="career-h">
        <h2 id="career-h" className="display mb-4 text-3xl">{t("profile.career")}</h2>
        {career.error && !c ? <p className="glass p-6 text-white/60">{t("profile.careerNA")}</p> : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {[[t("profile.races"), c?.races], [t("common.wins"), c?.wins], [t("common.podiums"), c?.podiums], [t("common.poles"), c?.poles], [t("profile.titles"), c?.championships]].map(([l, v]) => (
              <StatCard key={String(l)} label={String(l)} value={c ? v ?? t("common.na") : <Skeleton className="mt-1 h-10 w-16" />} />
            ))}
          </div>
        )}
        {c && (
          <p className="mt-4 text-sm text-white/65">
            <span className="eyebrow mr-2">{t("profile.titleYears")}</span>
            {c.championshipYears.length ? c.championshipYears.join(" · ") : t("profile.none")}
            {c.seasonsActive.length > 0 && <span className="ml-5"><span className="eyebrow mr-2">{t("profile.seasons")}</span>{c.seasonsActive[0]}–{c.seasonsActive.at(-1)}</span>}
          </p>
        )}
      </section>

      <section aria-labelledby="prev-h">
        <h2 id="prev-h" className="display mb-4 text-3xl">{t("profile.previous")}</h2>
        <div className="glass scroll-x p-1.5">
          <table className="w-full min-w-[600px] border-separate border-spacing-0 text-sm">
            <thead><tr className="text-left text-[0.66rem] uppercase tracking-widest text-white/45">{[t("common.round"), t("common.race"), t("common.grid"), t("common.finish"), t("common.points"), t("common.status")].map((h, i) => <th key={i} scope="col" className="px-3 py-2.5 font-semibold">{h}</th>)}</tr></thead>
            <tbody>
              {history.map(({ round, row: r, race }) => (
                <tr key={round} className="row" style={{ "--row-c": d.color } as React.CSSProperties}>
                  <td className="num px-3 py-2.5 text-white/60">R{round}</td>
                  <td className="px-3 py-2.5">{race ? <Link href={`/races/${round}`} className="inline-flex items-center gap-2 hover:underline"><Flag code={race.countryCode} />{gpName(race, lang, locale)}</Link> : round}</td>
                  <td className="num px-3 py-2.5">{r.grid || "PL"}</td>
                  <td className="px-3 py-2.5"><span className="racing-num num text-xl">{r.finished && r.position ? r.position : <span className="text-sm not-italic text-red-300">{t("common.dnf")}</span>}</span></td>
                  <td className="num px-3 py-2.5 font-semibold">{r.points || "–"}</td>
                  <td className="px-3 py-2.5 text-white/60">{r.status}</td>
                </tr>
              ))}
              {!history.length && <tr><td colSpan={6} className="px-3 py-8 text-center text-white/50">{season.data ? t("common.noData") : t("load.race")}</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
      <p className="hidden">{lk.drivers.size}</p>
    </div>
  );
}
