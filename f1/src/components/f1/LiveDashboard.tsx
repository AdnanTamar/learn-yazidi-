"use client";
import { RefreshCw, WifiOff, Radio, KeyRound } from "lucide-react";
import { useI18n } from "@/i18n";
import { useLive } from "@/hooks/useF1";
import { GlassCard } from "@/components/ui/GlassCard";
import { MagneticButton } from "@/components/ui/Magnetic";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/Resource";
import { CircuitMap } from "./CircuitMap";
import { FreshnessChip, LiveTimingTable, RaceTimeline, TrackStatusBanner, WeatherPanel } from "./Live";
import { gpName } from "@/lib/format";
import type { Race } from "@/types/f1";

function LiveSkeleton({ label }: { label: string }) {
  return (
    <div role="status" aria-live="polite" aria-label={label}>
      <p className="eyebrow mb-4 flex items-center gap-2"><span className="timing-lights" aria-hidden><i className="on" /><i className="on" /><i className="on" /></span>{label}</p>
      <div className="grid gap-4 xl:grid-cols-3">
        <Skeleton className="h-[520px] !rounded-3xl xl:col-span-2" />
        <div className="grid gap-4"><Skeleton className="h-20 !rounded-3xl" /><Skeleton className="h-64 !rounded-3xl" /><Skeleton className="h-40 !rounded-3xl" /></div>
      </div>
    </div>
  );
}

/**
 * Real-time race dashboard. Everything shown here comes straight from the provider payload;
 * when the provider cannot supply it the relevant block says so instead of estimating.
 */
export function LiveDashboard({ race, sessionName }: { race: Race; sessionName: "Race" | "Sprint" | null }) {
  const { t, lang, locale } = useI18n();
  const q = useLive(true);
  const live = q.data;

  const header = (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
      <div>
        <div className="mb-2 flex items-center gap-3">
          <span className="inline-flex items-center gap-2 rounded-full border border-red-400/50 bg-red-500/15 px-3 py-1 text-xs font-extrabold tracking-[0.2em] text-red-100"><span className="live-dot" aria-hidden />{t("live.badge")}</span>
          <span className="eyebrow">{sessionName === "Sprint" ? t("home.sprintInProgress") : t("live.rip")}</span>
        </div>
        <h2 className="display text-4xl sm:text-5xl">{t("live.title")}</h2>
        <p className="mt-2 text-white/60">{gpName(race, lang, locale)} · {race.circuitName}</p>
      </div>
      <div className="flex flex-col items-end gap-2">
        {live && (live.state === "live" || live.state === "stale") && <FreshnessChip live={live} />}
        {live?.lap != null && (live.state === "live" || live.state === "stale") && (
          <p className="racing-num num text-5xl">{t("live.lap")} {live.lap}</p>
        )}
      </div>
    </div>
  );

  if (!live) {
    if (q.error) return <>{header}<ErrorState message={t("err.liveUnavailable")} onRetry={() => q.mutate()} /></>;
    return <>{header}<LiveSkeleton label={t("load.live")} /></>;
  }

  const connectionLost = Boolean(q.error);

  if (live.state === "unavailable" || live.state === "idle" || live.state === "ended") {
    const unavailable = live.state === "unavailable";
    return (
      <>
        {header}
        <GlassCard tilt={0} className="flex flex-col items-center gap-3 p-8 text-center sm:p-12" role="alert">
          {unavailable ? <WifiOff className="h-9 w-9 text-amber-300" aria-hidden /> : <Radio className="h-9 w-9 text-white/60" aria-hidden />}
          <h3 className="display text-3xl">{unavailable ? t("live.unavailable") : live.state === "ended" ? t("live.ended") : t("live.idle")}</h3>
          <p className="max-w-lg text-white/65">{unavailable ? t("live.unavailableHint") : t("live.idleHint")}</p>
          {unavailable && <p className="flex max-w-lg items-start gap-2 rounded-xl bg-white/[.05] px-4 py-3 text-left text-sm text-white/60"><KeyRound className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />{t("live.unavailableKey")}</p>}
          {unavailable && live.reason && <p className="text-xs text-white/35">{live.reason}</p>}
          <MagneticButton variant="primary" onClick={() => q.mutate()} className="mt-2"><RefreshCw className="h-4 w-4" aria-hidden />{t("common.retry")}</MagneticButton>
        </GlassCard>
      </>
    );
  }

  const stale = live.state === "stale";
  return (
    <>
      {header}
      {(stale || connectionLost) && (
        <div role="alert" className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-amber-400/40 bg-amber-400/10 px-4 py-3 text-amber-100">
          <WifiOff className="h-5 w-5 shrink-0" aria-hidden />
          <div>
            <p className="font-semibold">{stale ? t("live.stale") : t("err.reconnect")}</p>
            {stale && <p className="text-sm text-amber-100/75">{t("live.staleHint")}</p>}
          </div>
        </div>
      )}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <section aria-label={t("live.classification")} className="min-w-0">
          <LiveTimingTable cars={live.cars} lap={live.lap} dimmed={stale || connectionLost} />
        </section>
        <aside className="grid content-start gap-4">
          <TrackStatusBanner status={stale ? "unknown" : live.trackStatus} />
          <GlassCard tilt={0} className="p-4">
            <h3 className="eyebrow mb-3">{t("live.track")}</h3>
            <div className="relative aspect-[4/3]"><CircuitMap points={live.trackPoints} cars={stale ? [] : live.cars} className="h-full w-full" /></div>
            {!live.hasPositions && <p className="mt-2 text-xs text-white/45">{t("live.noPositions")}</p>}
          </GlassCard>
          <GlassCard tilt={0} className="p-4"><h3 className="eyebrow mb-3">{t("live.weather")}</h3><WeatherPanel w={live.weather} /></GlassCard>
          <GlassCard tilt={0} className="p-4"><h3 className="eyebrow mb-2">{t("live.raceControl")}</h3><RaceTimeline events={live.events} /></GlassCard>
        </aside>
      </div>
    </>
  );
}
