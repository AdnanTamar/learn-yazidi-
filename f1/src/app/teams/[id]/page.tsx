"use client";
import Link from "next/link";
import { use } from "react";
import { ArrowLeft } from "lucide-react";
import { useI18n } from "@/i18n";
import { useSeason } from "@/hooks/useF1";
import { useTeamRows } from "@/lib/data";
import { Resource, ErrorState } from "@/components/ui/Resource";
import { Skeleton } from "@/components/ui/Skeleton";
import { GlassCard } from "@/components/ui/GlassCard";
import { DriverPhoto, Flag, TeamMark } from "@/components/ui/Media";
import { StatCard } from "@/components/ui/Bits";
import { ProgressChart } from "@/components/charts/Charts";
import { gpName } from "@/lib/format";

export default function TeamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { t, lang, locale } = useI18n();
  const { rows, overview } = useTeamRows();
  const season = useSeason();
  return (
    <>
      <Link href="/teams" className="mb-5 inline-flex items-center gap-2 text-sm text-white/60 hover:text-white"><ArrowLeft className="h-4 w-4" aria-hidden />{t("nav.teams")}</Link>
      <Resource query={overview} loading={<Skeleton className="h-[420px] !rounded-3xl" />}>
        {(o) => {
          const row = rows?.find((r) => r.team.id === id);
          if (!row) return <ErrorState message={t("team.notFound")} detail={id} />;
          const c = row.team.color;
          const s = row.stats;
          const recent = (season.data?.rounds ?? []).slice(-8).reverse();
          return (
            <div className="grid gap-6">
              <GlassCard tilt={2} accent={c} className="overflow-hidden p-6 sm:p-10">
                <div className="flex flex-wrap items-center justify-between gap-6">
                  <div className="flex items-center gap-5">
                    <TeamMark name={row.team.name} color={c} className="h-20 w-20 text-4xl" />
                    <div>
                      <p className="eyebrow">{t("standings.constructors")} · P{row.position}</p>
                      <h1 className="display mt-2 text-5xl leading-none sm:text-7xl">{row.team.name}</h1>
                      <p className="mt-3 flex items-center gap-2 text-white/65"><Flag code={row.team.countryCode} size={40} /> {row.team.nationality}</p>
                    </div>
                  </div>
                  <dl className="grid grid-cols-4 gap-6">
                    {[[t("common.points"), row.points], [t("common.wins"), row.wins], [t("common.podiums"), s?.podiums ?? "–"], [t("common.poles"), s?.poles ?? "–"]].map(([l, v]) => (
                      <div key={String(l)}><dd className="racing-num num text-4xl sm:text-6xl">{v}</dd><dt className="eyebrow mt-1 !text-[0.58rem]">{l}</dt></div>
                    ))}
                  </dl>
                </div>
              </GlassCard>

              <section className="grid gap-5 sm:grid-cols-2">
                {row.drivers.map((d) => (
                  <GlassCard key={d.id} tilt={6} accent={d.color} className="group overflow-hidden">
                    <Link href={`/drivers/${d.id}`} className="grid grid-cols-[minmax(130px,.8fr)_1fr] rounded-[inherit]">
                      <div className="relative min-h-[200px]"><DriverPhoto driver={d} className="absolute inset-0 !rounded-none" /><div className="absolute inset-0 bg-gradient-to-r from-transparent to-[#0b0d12]/80" /></div>
                      <div className="flex flex-col justify-center p-5">
                        <span className="racing-num text-5xl text-white/25">{d.number}</span>
                        <p className="text-sm text-white/60">{d.firstName}</p>
                        <h3 className="display text-3xl leading-none">{d.lastName}</h3>
                        <p className="mt-3 racing-num num text-3xl">{overview.data?.driverStandings.find((x) => x.driverId === d.id)?.points ?? 0}<span className="eyebrow ml-1.5 not-italic !text-[0.6rem]">{t("common.pts")}</span></p>
                      </div>
                    </Link>
                  </GlassCard>
                ))}
              </section>

              <section>
                <h2 className="display mb-4 text-3xl">{t("team.progress")}</h2>
                <GlassCard tilt={0} className="p-4 sm:p-6">
                  {season.data ? (
                    <ProgressChart
                      roundLabels={Object.fromEntries(o.calendar.map((r) => [r.round, `R${r.round} · ${gpName(r, lang, locale)}`]))}
                      series={[{ id: row.team.id, label: row.team.name, color: c, data: s?.progression ?? [] }]}
                    />
                  ) : <Skeleton className="h-72" />}
                </GlassCard>
              </section>

              <section>
                <h2 className="display mb-4 text-3xl">{t("team.recent")}</h2>
                <div className="glass scroll-x p-1.5">
                  <table className="w-full min-w-[520px] border-separate border-spacing-0 text-sm">
                    <thead><tr className="text-left text-[0.66rem] uppercase tracking-widest text-white/45"><th className="px-3 py-2.5">{t("common.race")}</th>{row.drivers.map((d) => <th key={d.id} className="px-3 py-2.5">{d.lastName}</th>)}<th className="px-3 py-2.5 text-right">{t("common.points")}</th></tr></thead>
                    <tbody>
                      {recent.map((r) => {
                        const race = o.calendar.find((x) => x.round === r.round);
                        const pts = r.race.filter((x) => x.teamId === row.team.id).reduce((a, b) => a + b.points, 0) + r.sprint.filter((x) => x.teamId === row.team.id).reduce((a, b) => a + b.points, 0);
                        return (
                          <tr key={r.round} className="row" style={{ "--row-c": c } as React.CSSProperties}>
                            <td className="px-3 py-2.5">{race ? <Link href={`/races/${r.round}`} className="inline-flex items-center gap-2 hover:underline"><Flag code={race.countryCode} />{gpName(race, lang, locale)}</Link> : r.round}</td>
                            {row.drivers.map((d) => {
                              const x = r.race.find((y) => y.driverId === d.id);
                              return <td key={d.id} className="px-3 py-2.5"><span className="racing-num num text-xl">{x ? (x.finished && x.position ? x.position : <span className="text-sm not-italic text-red-300">{t("common.dnf")}</span>) : "–"}</span></td>;
                            })}
                            <td className="num px-3 py-2.5 text-right font-semibold">{pts || "–"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          );
        }}
      </Resource>
    </>
  );
}
