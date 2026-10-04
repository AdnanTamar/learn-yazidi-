"use client";
import Link from "next/link";
import { useI18n } from "@/i18n";
import { DriverPhoto, Flag } from "@/components/ui/Media";
import { Zap } from "lucide-react";
import type { Driver, QualiRow, ResultRow, Team } from "@/types/f1";

interface Lk { drivers: Map<string, Driver>; teams: Map<string, Team> }

const Th = ({ children, right }: { children: React.ReactNode; right?: boolean }) => (
  <th scope="col" className={`whitespace-nowrap px-3 py-2.5 text-[0.66rem] font-semibold uppercase tracking-widest text-white/45 ${right ? "text-right" : "text-left"}`}>{children}</th>
);

function DriverCell({ id, lk }: { id: string; lk: Lk }) {
  const d = lk.drivers.get(id);
  if (!d) return <span className="text-white/60">{id}</span>;
  return (
    <Link href={`/drivers/${d.id}`} className="flex items-center gap-2.5 hover:underline">
      <DriverPhoto driver={d} className="hidden h-8 w-8 shrink-0 !rounded-full sm:block" />
      <span className="whitespace-nowrap"><span className="text-white/55">{d.firstName[0]}.</span> <b className="font-semibold">{d.lastName}</b></span>
      <Flag code={d.countryCode} className="hidden sm:inline-block" />
    </Link>
  );
}
function TeamCell({ id, lk }: { id: string; lk: Lk }) {
  const tm = lk.teams.get(id);
  return <span className="inline-flex items-center gap-2 whitespace-nowrap text-white/75"><span className="h-3.5 w-1 rounded-full" style={{ background: tm?.color ?? "#777" }} aria-hidden />{tm?.name ?? id}</span>;
}

export function ClassificationTable({ rows, lk, sprint }: { rows: ResultRow[]; lk: Lk; sprint?: boolean }) {
  const { t } = useI18n();
  return (
    <div className="glass scroll-x p-1.5">
      <table className="w-full min-w-[720px] border-separate border-spacing-0 text-sm">
        <thead><tr><Th>{t("common.position")}</Th><Th>{t("common.driver")}</Th><Th>{t("common.team")}</Th><Th right>{t("race.startPos")}</Th><Th right>{t("common.laps")}</Th><Th right>{t("common.time")}</Th><Th right>{t("common.points")}</Th>{!sprint && <Th right>{t("common.fl")}</Th>}</tr></thead>
        <tbody>
          {rows.map((r) => {
            const d = lk.drivers.get(r.driverId);
            const gained = r.position && r.grid ? r.grid - r.position : 0;
            return (
              <tr key={r.driverId} style={{ "--row-c": d?.color } as React.CSSProperties} className="row">
                <td className="px-3 py-2.5"><span className="racing-num num text-2xl">{r.position && r.finished ? r.position : <span className="text-base not-italic text-red-300">{r.positionText === "D" ? "DSQ" : t("common.dnf")}</span>}</span></td>
                <td className="px-3 py-2.5"><DriverCell id={r.driverId} lk={lk} /></td>
                <td className="px-3 py-2.5"><TeamCell id={r.teamId} lk={lk} /></td>
                <td className="num px-3 py-2.5 text-right text-white/70">{r.grid || "PL"}{r.finished && gained !== 0 && <span className={`ml-1.5 text-[0.68rem] ${gained > 0 ? "text-emerald-300" : "text-red-300"}`}>{gained > 0 ? "▲" : "▼"}{Math.abs(gained)}</span>}</td>
                <td className="num px-3 py-2.5 text-right text-white/70">{r.laps}</td>
                <td className="num px-3 py-2.5 text-right text-white/85">{r.finished ? r.time ?? r.status : <span className="text-red-300">{r.status}</span>}</td>
                <td className="num px-3 py-2.5 text-right font-semibold">{r.points || "–"}</td>
                {!sprint && <td className="num px-3 py-2.5 text-right">{r.fastestLap?.rank === 1 ? <span className="inline-flex items-center gap-1 rounded-full bg-fuchsia-500/20 px-2 py-0.5 text-xs font-semibold text-fuchsia-200"><Zap className="h-3 w-3" aria-hidden />{r.fastestLap.time}</span> : <span className="text-white/35">{r.fastestLap?.time ?? "–"}</span>}</td>}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const toSec = (s: string | null) => {
  if (!s) return null;
  const [m, rest] = s.includes(":") ? s.split(":") : ["0", s];
  return Number(m) * 60 + Number(rest);
};

/** Qualifying split into Q3 / Q2 / Q1 by the segment each driver reached. */
export function QualifyingTable({ rows, lk, shootout }: { rows: QualiRow[]; lk: Lk; shootout?: boolean }) {
  const { t } = useI18n();
  const pre = shootout ? "sq" : "q";
  const hasLaps = rows.some((r) => r.laps != null);
  const reached = (r: QualiRow) => (r.q3 ? 3 : r.q2 ? 2 : 1);
  const groups = ([3, 2, 1] as const).map((q) => ({ q, rows: rows.filter((r) => reached(r) === q).sort((a, b) => a.position - b.position) })).filter((g) => g.rows.length);

  return (
    <div className="grid gap-5">
      {groups.map(({ q, rows: gr }) => {
        const time = (r: QualiRow) => (q === 3 ? r.q3 : q === 2 ? r.q2 : r.q1);
        const lead = toSec(time(gr[0]));
        return (
          <section key={q} aria-label={t(`quali.${pre}${q}` as never)}>
            <h3 className="mb-2 flex items-center gap-3">
              <span className="display rounded-full bg-white px-3 py-0.5 text-lg text-black">{t(`quali.${pre}${q}` as never)}</span>
              {q < 3 && <span className="text-xs text-white/50">{t("quali.eliminated", { q: t(`quali.${pre}${q}` as never) })}</span>}
            </h3>
            <div className="glass scroll-x p-1.5">
              <table className="w-full min-w-[560px] border-separate border-spacing-0 text-sm">
                <thead><tr><Th>{t("common.position")}</Th><Th>{t("common.driver")}</Th><Th>{t("common.team")}</Th><Th right>{t("quali.bestLap")}</Th><Th right>{t("common.gap")}</Th>{hasLaps && <Th right>{t("quali.laps")}</Th>}</tr></thead>
                <tbody>
                  {gr.map((r) => {
                    const d = lk.drivers.get(r.driverId);
                    const secs = toSec(time(r));
                    return (
                      <tr key={r.driverId} style={{ "--row-c": d?.color } as React.CSSProperties} className="row">
                        <td className="px-3 py-2.5"><span className="racing-num num text-2xl">{r.position}</span></td>
                        <td className="px-3 py-2.5"><DriverCell id={r.driverId} lk={lk} /></td>
                        <td className="px-3 py-2.5"><TeamCell id={r.teamId} lk={lk} /></td>
                        <td className="mono px-3 py-2.5 text-right">{time(r) ?? "—"}</td>
                        <td className="mono px-3 py-2.5 text-right text-white/60">{secs != null && lead != null ? (secs === lead ? "—" : `+${(secs - lead).toFixed(3)}`) : "—"}</td>
                        {hasLaps && <td className="num px-3 py-2.5 text-right text-white/60">{r.laps ?? "–"}</td>}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}
    </div>
  );
}
