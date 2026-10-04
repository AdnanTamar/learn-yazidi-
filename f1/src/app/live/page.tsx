"use client";
import { useI18n } from "@/i18n";
import { useOverview, useSchedule } from "@/hooks/useF1";
import { Resource } from "@/components/ui/Resource";
import { GlassCard } from "@/components/ui/GlassCard";
import { MagneticLink } from "@/components/ui/Magnetic";
import { Skeleton } from "@/components/ui/Skeleton";
import { LiveDashboard } from "@/components/f1/LiveDashboard";
import { NextRaceCard } from "@/components/f1/Hero";
import type { Overview } from "@/types/f1";

function Content({ o }: { o: Overview }) {
  const { t } = useI18n();
  const s = useSchedule(o.calendar);
  if (!s) return <Skeleton className="h-96 !rounded-3xl" />;
  if (s.liveRace) return <LiveDashboard race={s.liveRace} sessionName={s.liveSessionName} />;
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <GlassCard tilt={0} className="flex flex-col items-start justify-center gap-4 p-8 sm:p-10">
        <p className="eyebrow">{t("live.badge")}</p>
        <h1 className="display text-4xl sm:text-5xl">{t("live.idle")}</h1>
        <p className="text-white/65">{t("live.idleHint")}</p>
        <MagneticLink href="/results" variant="glass">{t("home.latestResult")}</MagneticLink>
      </GlassCard>
      <NextRaceCard race={s.current} live={false} />
    </div>
  );
}

export default function LivePage() {
  const q = useOverview();
  return <Resource query={q} loading={<Skeleton className="h-96 !rounded-3xl" />} errorKey="err.liveUnavailable">{(o) => <Content o={o} />}</Resource>;
}
