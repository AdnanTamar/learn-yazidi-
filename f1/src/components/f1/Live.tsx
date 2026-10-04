"use client";
import { useEffect, useMemo, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, ArrowRightLeft, Flag, Flame, Gauge, Info, OctagonAlert, ShieldAlert, Timer, Wind, Droplets, Thermometer, Zap } from "lucide-react";
import { useI18n, type Key } from "@/i18n";
import { useNow } from "@/hooks/useF1";
import { fmtClock, lapTime } from "@/lib/format";
import { useSettings } from "@/lib/settings";
import { GlassCard } from "@/components/ui/GlassCard";
import { DriverPhoto } from "@/components/ui/Media";
import type { ControlEvent, LiveCar, LiveState, LiveWeather, TrackStatus } from "@/types/f1";

/* ── freshness ────────────────────────────────────────────── */
export function useLiveAge(live: LiveState | undefined) {
  const now = useNow();
  if (!live?.dataAsOf || !now) return null;
  return Math.max(0, Math.round((now - Date.parse(live.dataAsOf)) / 1000));
}

export function FreshnessChip({ live }: { live: LiveState }) {
  const { t, locale } = useI18n();
  const { settings } = useSettings();
  const age = useLiveAge(live);
  const text =
    live.state === "stale" && live.dataAsOf
      ? `${t("data.asOf")} ${fmtClock(live.dataAsOf, { locale, ...settings })}`
      : age != null && age > 8 ? t("live.updated", { s: age }) : t("live.updatedNow");
  return (
    <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs ${live.state === "live" ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200" : "border-amber-400/30 bg-amber-400/10 text-amber-200"}`} aria-live="off">
      <span className={`h-1.5 w-1.5 rounded-full ${live.state === "live" ? "bg-emerald-300" : "bg-amber-300"}`} aria-hidden /> {text}
    </span>
  );
}

/* ── track status ─────────────────────────────────────────── */
const STATUS: Record<TrackStatus, { key: Key; cls: string; Icon: typeof Flag; glyph: string }> = {
  green: { key: "flag.green", cls: "border-emerald-400/40 bg-emerald-500/15 text-emerald-100", Icon: Flag, glyph: "🟢" },
  yellow: { key: "flag.yellow", cls: "border-yellow-300/50 bg-yellow-400/15 text-yellow-100", Icon: AlertTriangle, glyph: "🟡" },
  sc: { key: "flag.sc", cls: "border-yellow-300/60 bg-yellow-400/20 text-yellow-50", Icon: ShieldAlert, glyph: "🟡" },
  vsc: { key: "flag.vsc", cls: "border-amber-300/50 bg-amber-400/15 text-amber-100", Icon: AlertTriangle, glyph: "⚠️" },
  red: { key: "flag.red", cls: "border-red-400/60 bg-red-500/20 text-red-50", Icon: OctagonAlert, glyph: "🔴" },
  chequered: { key: "flag.chequered", cls: "border-white/30 bg-white/10 text-white", Icon: Flag, glyph: "🏁" },
  unknown: { key: "flag.unknown", cls: "border-white/15 bg-white/5 text-white/70", Icon: Info, glyph: "" },
};

export function TrackStatusBanner({ status }: { status: TrackStatus }) {
  const { t } = useI18n();
  const s = STATUS[status];
  const pulsing = status === "red" || status === "sc" || status === "vsc" || status === "yellow";
  return (
    <AnimatePresence mode="wait">
      <motion.div key={status} role="status" aria-live="assertive" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} transition={{ duration: 0.25 }} className={`flex items-center gap-3 rounded-2xl border px-4 py-3 ${s.cls}`}>
        <s.Icon className={`h-5 w-5 ${pulsing ? "animate-pulseDot" : ""}`} aria-hidden />
        <div className="leading-tight">
          <p className="eyebrow !text-[0.6rem] !text-current opacity-70">{t("live.trackStatus")}</p>
          <p className="display text-xl">{t(s.key)}</p>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

/* ── weather ──────────────────────────────────────────────── */
export function WeatherPanel({ w }: { w: LiveWeather | null }) {
  const { t, locale } = useI18n();
  const { settings } = useSettings();
  if (!w) return <p className="text-sm text-white/50">{t("live.noWeather")}</p>;
  const rows = [
    { Icon: Thermometer, label: t("live.air"), v: w.air != null ? `${w.air.toFixed(1)}°C` : "—" },
    { Icon: Gauge, label: t("live.trackTemp"), v: w.track != null ? `${w.track.toFixed(1)}°C` : "—" },
    { Icon: Wind, label: t("live.wind"), v: w.windSpeed != null ? `${w.windSpeed.toFixed(1)} m/s${w.windDirection != null ? ` · ${Math.round(w.windDirection)}°` : ""}` : "—" },
    { Icon: Droplets, label: t("live.rain"), v: w.rainfall == null ? "—" : w.rainfall ? t("live.rainYes") : t("live.rainNo") },
    { Icon: Droplets, label: t("live.humidity"), v: w.humidity != null ? `${Math.round(w.humidity)}%` : "—" },
  ];
  return (
    <div>
      <dl className="grid grid-cols-2 gap-2.5">
        {rows.map((r) => (
          <div key={r.label} className="rounded-2xl bg-white/[.045] p-3">
            <dt className="flex items-center gap-1.5 text-[0.68rem] uppercase tracking-widest text-white/50"><r.Icon className="h-3.5 w-3.5" aria-hidden />{r.label}</dt>
            <dd className="num mt-1 text-lg font-semibold">{r.v}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-2 text-[0.68rem] text-white/40">{fmtClock(w.date, { locale, ...settings })}</p>
    </div>
  );
}

/* ── timeline ─────────────────────────────────────────────── */
const EVENT_ICON: Record<ControlEvent["kind"], typeof Flag> = { flag: Flag, safety: ShieldAlert, pit: Timer, fastest: Zap, overtake: ArrowRightLeft, info: Info, penalty: Flame };

export function RaceTimeline({ events }: { events: ControlEvent[] }) {
  const { t, locale } = useI18n();
  const { settings } = useSettings();
  if (!events.length) return <p className="py-6 text-center text-sm text-white/50">{t("live.noEvents")}</p>;
  return (
    <ol className="relative max-h-[560px] overflow-y-auto pr-1" aria-live="polite" aria-label={t("live.raceControl")}>
      <AnimatePresence initial={false}>
        {events.map((e) => {
          const Icon = EVENT_ICON[e.kind];
          return (
            <motion.li key={e.id} layout="position" initial={{ opacity: 0, y: -14, height: 0 }} animate={{ opacity: 1, y: 0, height: "auto" }} exit={{ opacity: 0 }} transition={{ type: "spring", stiffness: 420, damping: 34 }} className="overflow-hidden">
              <div className="flex gap-3 border-b border-white/5 py-2.5">
                <span className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full ${e.kind === "fastest" ? "bg-fuchsia-500/25 text-fuchsia-200" : e.kind === "safety" || e.kind === "penalty" ? "bg-amber-400/20 text-amber-200" : "bg-white/10 text-white/70"}`}><Icon className="h-3.5 w-3.5" aria-hidden /></span>
                <div className="min-w-0">
                  <p className="text-[0.68rem] uppercase tracking-widest text-white/45">{e.lap != null ? `${t("live.lap")} ${e.lap} · ` : ""}{fmtClock(e.date, { locale, ...settings })}</p>
                  <p className="text-sm leading-snug">{e.text}</p>
                </div>
              </div>
            </motion.li>
          );
        })}
      </AnimatePresence>
    </ol>
  );
}

/* ── timing table ─────────────────────────────────────────── */
const TYRE: Record<string, { c: string; l: string }> = {
  SOFT: { c: "#ff3b30", l: "S" }, MEDIUM: { c: "#ffd60a", l: "M" }, HARD: { c: "#f4f4f5", l: "H" }, INTERMEDIATE: { c: "#34c759", l: "I" }, WET: { c: "#0a84ff", l: "W" },
};
const TONE = { purple: "bg-fuchsia-400", green: "bg-emerald-400", yellow: "bg-yellow-300", none: "bg-white/15" } as const;

function Tyre({ car }: { car: LiveCar }) {
  const { t } = useI18n();
  const k = car.tyre?.toUpperCase() ?? "";
  const ty = TYRE[k];
  if (!ty) return <span className="text-white/40">—</span>;
  return (
    <span className="inline-flex items-center gap-2" title={t(`tyre.${k}` as Key)}>
      <span className="grid h-6 w-6 place-items-center rounded-full border-[3px] text-[0.62rem] font-black" style={{ borderColor: ty.c, color: ty.c }} aria-hidden>{ty.l}</span>
      <span className="text-xs text-white/70">{t(`tyre.${k}` as Key)}{car.tyreAge != null ? ` · ${car.tyreAge}` : ""}</span>
    </span>
  );
}

export function LiveTimingTable({ cars, lap, dimmed }: { cars: LiveCar[]; lap: number | null; dimmed?: boolean }) {
  const { t } = useI18n();
  const prev = useRef(new Map<number, number>());
  const deltas = useMemo(() => {
    const m = new Map<number, number>();
    cars.forEach((c) => { const p = prev.current.get(c.driverNumber); if (p != null && p !== c.position) m.set(c.driverNumber, p - c.position); });
    return m;
  }, [cars]);
  useEffect(() => { prev.current = new Map(cars.map((c) => [c.driverNumber, c.position])); }, [cars]);

  return (
    <div className={`glass scroll-x p-1.5 transition-opacity ${dimmed ? "opacity-55 saturate-50" : ""}`}>
      <table className="w-full min-w-[980px] border-separate border-spacing-0 text-sm">
        <caption className="sr-only">{t("live.classification")}</caption>
        <thead>
          <tr className="text-left text-[0.64rem] uppercase tracking-widest text-white/45">
            {[t("live.pos"), t("common.driver"), t("common.number"), t("live.tyre"), t("live.lap"), t("common.gap"), t("live.interval"), t("live.lastLap"), t("live.sectors"), t("live.pitStops"), t("common.status")].map((h, i) => (
              <th key={i} scope="col" className={`whitespace-nowrap px-3 py-2.5 font-semibold ${i >= 4 && i <= 7 ? "text-right" : ""}`}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {cars.map((c) => {
            const d = deltas.get(c.driverNumber);
            return (
              <motion.tr key={c.driverNumber} layout="position" transition={{ type: "spring", stiffness: 380, damping: 36 }} style={{ "--row-c": c.color } as React.CSSProperties} className="row">
                <td className="px-3 py-2">
                  <span className="flex items-center gap-1.5">
                    <span className="racing-num num w-8 text-2xl">{c.position}</span>
                    {d ? <span className={`text-[0.65rem] font-bold ${d > 0 ? "text-emerald-300" : "text-red-300"}`} aria-label={d > 0 ? `+${d}` : `${d}`}>{d > 0 ? "▲" : "▼"}{Math.abs(d)}</span> : null}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <span className="flex items-center gap-2.5">
                    <span className="h-7 w-1 rounded-full" style={{ background: c.color }} aria-hidden />
                    <DriverPhoto driver={{ name: c.name, photo: c.photo, color: c.color, code: c.code }} className="hidden h-9 w-9 shrink-0 !rounded-full sm:block" />
                    <span className="leading-tight"><b className="block whitespace-nowrap font-semibold">{c.name}</b><span className="block whitespace-nowrap text-xs text-white/50">{c.team}</span></span>
                  </span>
                </td>
                <td className="px-3 py-2"><span className="racing-num num text-lg text-white/70">#{c.driverNumber}</span></td>
                <td className="px-3 py-2"><Tyre car={c} /></td>
                <td className="num px-3 py-2 text-right text-white/80">{c.laps ?? "—"}</td>
                <td className="mono px-3 py-2 text-right">{c.gap ?? "—"}</td>
                <td className="mono px-3 py-2 text-right text-white/65">{c.interval ?? "—"}</td>
                <td className="mono px-3 py-2 text-right">
                  <span className="inline-flex items-center gap-1.5">
                    {c.hasFastestLap && <Zap className="h-3.5 w-3.5 text-fuchsia-300" aria-label={t("live.fastestLap")} />}
                    <span className={c.hasFastestLap ? "text-fuchsia-200" : ""}>{lapTime(c.lastLap)}</span>
                  </span>
                </td>
                <td className="px-3 py-2">
                  <span className="flex gap-1" aria-label={t("live.sectors")}>
                    {c.sectors.map((s, i) => <span key={i} title={s.time != null ? `S${i + 1} ${s.time.toFixed(3)} (${s.tone})` : `S${i + 1}`} className={`h-1.5 w-7 rounded-full ${TONE[s.tone]}`} />)}
                  </span>
                </td>
                <td className="num px-3 py-2 text-white/75">{c.pitStops ? t("live.stops", { n: c.pitStops }) : <span className="text-white/40">{t("live.stopsNone")}</span>}</td>
                <td className="px-3 py-2">
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[0.68rem] font-semibold ${c.status === "running" ? "text-emerald-200" : c.status === "pit" ? "bg-sky-400/15 text-sky-200" : "bg-red-500/15 text-red-200"}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${c.status === "running" ? "bg-emerald-300" : c.status === "pit" ? "bg-sky-300" : "bg-red-300"}`} aria-hidden />
                    {c.status === "running" ? t("live.running") : c.status === "pit" ? t("live.inPit") : t("live.stopped")}
                  </span>
                </td>
              </motion.tr>
            );
          })}
        </tbody>
      </table>
      {lap != null && <p className="px-3 py-2 text-xs text-white/40">{t("live.leader")}: {t("live.lap")} {lap}</p>}
    </div>
  );
}

export { GlassCard };
