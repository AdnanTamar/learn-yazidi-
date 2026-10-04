"use client";
import { useI18n } from "@/i18n";
import { useDriverRows } from "@/lib/data";
import { Resource } from "@/components/ui/Resource";
import { SkeletonRows } from "@/components/ui/Skeleton";
import { PageHeader } from "@/components/ui/Bits";
import { DriverStandingsTable } from "@/components/f1/StandingsTable";
import { StandingsTabs } from "@/components/f1/StandingsTabs";

export default function StandingsPage() {
  const { t } = useI18n();
  const { rows, overview } = useDriverRows();
  return (
    <>
      <PageHeader eyebrow={overview.data ? `${overview.data.season} · ${overview.data.completedRounds}/${overview.data.calendar.length}` : undefined} title={t("standings.title")} right={<StandingsTabs active="drivers" />} />
      <Resource query={overview} loading={<SkeletonRows rows={12} label={t("load.championship")} />}>
        {() => (rows?.length ? <DriverStandingsTable rows={rows} /> : <div className="glass p-10 text-center text-white/60">{t("standings.empty")}</div>)}
      </Resource>
    </>
  );
}
