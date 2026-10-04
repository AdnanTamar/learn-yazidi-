"use client";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowLeftRight } from "lucide-react";
import { useI18n } from "@/i18n";
import { useOverview, useSeason } from "@/hooks/useF1";
import { useDriverRows, type DriverRow } from "@/lib/data";
import { headToHead } from "@/lib/h2h";
import { Resource } from "@/components/ui/Resource";
import { Skeleton } from "@/components/ui/Skeleton";
import { GlassCard } from "@/components/ui/GlassCard";
import { DriverPhoto, Flag } from "@/components/ui/Media";
import { PageHeader } from "@/components/ui/Bits";
import { MagneticButton } from "@/components/ui/Magnetic";
import { Duel } from "@/components/f1/Duel";
import type { SeasonData } from "@/types/f1";

interface Metric { label: string; a: number | null; b: number | null; lower?: boolean; dec?: number }

function Side({ r, align }: { r: DriverRow; align: "l" | "r" }) {
  const d = r.driver;
  return (
    <GlassCard tilt={5} accent={d.color} className={`group overflow-hidden ${align === "r" ? "text-right" : ""}`}>
      <div className={`flex items-end gap-4 p-4 sm:p-5 ${align === "r" ? "flex-row-reverse" : ""}`}>
        <DriverPhoto driver={d} className="h-24 w-24 shrink-0 !rounded-2xl sm:h-32 sm:w-32" priority />
        <div className="min-w-0 pb-1">
          <p className="racing-num text-4xl text-white/25">{d.number}</p>
          <p className="text-sm text-white/60">{d.firstName}</p>
          <h2 className="display text-3xl leading-none sm:text-4xl">{d.lastName}</h2>
          <p className={`mt-2 flex items-center gap-2 text-xs ${align === "r" ? "justify-end" : ""}`}><Flag code={d.countryCode} /><span style={{ color: d.color }}>{d.teamName}</span></p>
        </div>
      </div>
    </GlassCard>
  );
}

function Compare({ rows, season }: { rows: DriverRow[]; season: SeasonData | undefined }) {
  const { t } = useI18n();
  const sp = useSearchParams();
  const [a, setA] = useState(sp.get("a") ?? rows[0]?.driver.id);
  const [b, setB] = useState(sp.get("b") ?? rows[1]?.driver.id);
  useEffect(() => { const u = new URL(window.location.href); u.searchParams.set("a", a ?? ""); u.searchParams.set("b", b ?? ""); window.history.replaceState(null, "", u); }, [a, b]);
  const ra = rows.find((r) => r.driver.id === a), rb = rows.find((r) => r.driver.id === b);
  const h = useMemo(() => (season && a && b ? headToHead(season.rounds, a, b) : null), [season, a, b]);

  const sel = (v: string | undefined, set: (s: string) => void, label: string) => (
    <label className="block">
      <span className="eyebrow mb-1.5 block">{label}</span>
      <select value={v} onChange={(e) => set(e.target.value)} className="w-full rounded-xl border border-white/15 bg-[#10131a] px-3 py-2.5 text-sm outline-none focus:border-white/40">
        {rows.map((r) => <option key={r.driver.id} value={r.driver.id}>{r.driver.name}</option>)}
      </select>
    </label>
  );

  const metrics: Metric[] = ra && rb ? [
    { label: t("common.points"), a: ra.points, b: rb.points },
    { label: t("common.wins"), a: ra.wins, b: rb.wins },
    { label: t("common.podiums"), a: ra.stats?.podiums ?? null, b: rb.stats?.podiums ?? null },
    { label: t("common.poles"), a: ra.stats?.poles ?? null, b: rb.stats?.poles ?? null },
    { label: t("common.fastestLaps"), a: ra.stats?.fastestLaps ?? null, b: rb.stats?.fastestLaps ?? null },
    { label: t("profile.avgQuali"), a: ra.stats?.avgQuali ?? null, b: rb.stats?.avgQuali ?? null, lower: true, dec: 1 },
    { label: t("profile.avgFinish"), a: ra.stats?.avgFinish ?? null, b: rb.stats?.avgFinish ?? null, lower: true, dec: 1 },
    { label: t("profile.dnfs"), a: ra.stats?.dnfs ?? null, b: rb.stats?.dnfs ?? null, lower: true },
  ] : [];

  return (
    <div className="grid gap-6">
      <div className="grid items-end gap-3 sm:grid-cols-[1fr_auto_1fr]">
        {sel(a, setA, t("compare.driverA"))}
        <MagneticButton variant="glass" aria-label={t("compare.swap")} onClick={() => { setA(b); setB(a); }} className="!px-3.5"><ArrowLeftRight className="h-4 w-4" aria-hidden /></MagneticButton>
        {sel(b, setB, t("compare.driverB"))}
      </div>
      {!ra || !rb || a === b ? <p className="glass p-8 text-center text-white/60">{t("compare.pickTwo")}</p> : (
        <>
          <div className="grid gap-4 md:grid-cols-2"><Side r={ra} align="l" /><Side r={rb} align="r" /></div>
          <GlassCard tilt={0} className="p-4 sm:p-7">
            <ul>
              {metrics.map((m) => {
                const both = m.a != null && m.b != null;
                const aWins = both && (m.lower ? m.a! < m.b! : m.a! > m.b!);
                const bWins = both && (m.lower ? m.b! < m.a! : m.b! > m.a!);
                const mx = Math.max(Number(m.a ?? 0), Number(m.b ?? 0), 1);
                const fmt = (v: number | null) => (v == null ? "–" : v.toFixed(m.dec ?? 0));
                return (
                  <li key={m.label} className="border-b border-white/5 py-4 last:border-0">
                    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                      <span className={`racing-num num text-3xl sm:text-4xl ${aWins ? "" : "text-white/55"}`}>{fmt(m.a)}</span>
                      <span className="eyebrow text-center !text-[0.62rem]">{m.label}{m.lower && <span className="block normal-case tracking-normal text-white/35">{t("compare.lowerBetter")}</span>}</span>
                      <span className={`racing-num num text-right text-3xl sm:text-4xl ${bWins ? "" : "text-white/55"}`}>{fmt(m.b)}</span>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-1" aria-hidden>
                      <div className="flex justify-end"><span className="h-1.5 rounded-full transition-all duration-700" style={{ width: `${(Number(m.a ?? 0) / mx) * 100}%`, background: ra.driver.color, opacity: aWins || !both ? 1 : 0.4 }} /></div>
                      <div><span className="block h-1.5 rounded-full transition-all duration-700" style={{ width: `${(Number(m.b ?? 0) / mx) * 100}%`, background: rb.driver.color === ra.driver.color ? "#c8ccd6" : rb.driver.color, opacity: bWins || !both ? 1 : 0.4 }} /></div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </GlassCard>
          <div className="grid gap-4 md:grid-cols-2">
            {h ? (
              <>
                <GlassCard tilt={3} className="p-5"><h3 className="eyebrow">{t("compare.qualiH2H")}</h3><Duel label={t("compare.shared", { n: h.qualiShared })} a={h.qualiA} b={h.qualiB} ca={ra.driver.color} cb={rb.driver.color === ra.driver.color ? "#c8ccd6" : rb.driver.color} /></GlassCard>
                <GlassCard tilt={3} className="p-5"><h3 className="eyebrow">{t("compare.raceH2H")}</h3><Duel label={t("compare.shared", { n: h.raceShared })} a={h.raceA} b={h.raceB} ca={ra.driver.color} cb={rb.driver.color === ra.driver.color ? "#c8ccd6" : rb.driver.color} /></GlassCard>
              </>
            ) : <Skeleton className="h-32 md:col-span-2" />}
          </div>
        </>
      )}
    </div>
  );
}

function Inner() {
  const { t } = useI18n();
  const { rows, overview } = useDriverRows();
  const season = useSeason();
  return (
    <Resource query={overview} loading={<Skeleton className="h-96 !rounded-3xl" />}>
      {() => (rows?.length ? <Compare rows={rows} season={season.data} /> : <p className="glass p-8 text-center text-white/60">{t("standings.empty")}</p>)}
    </Resource>
  );
}

export default function ComparePage() {
  const { t } = useI18n();
  useOverview();
  return (
    <>
      <PageHeader title={t("compare.title")} subtitle={t("compare.subtitle")} />
      <Suspense fallback={<Skeleton className="h-96 !rounded-3xl" />}><Inner /></Suspense>
    </>
  );
}
