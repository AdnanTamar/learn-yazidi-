"use client";
import { useI18n } from "@/i18n";
import { useTeamRows } from "@/lib/data";
import { Resource } from "@/components/ui/Resource";
import { SkeletonRows } from "@/components/ui/Skeleton";
import { PageHeader } from "@/components/ui/Bits";
import { TeamStandingsTable } from "@/components/f1/StandingsTable";
import { StandingsTabs } from "@/components/f1/StandingsTabs";

export default function ConstructorsPage() {
  const { t } = useI18n();
  const { rows, overview } = useTeamRows();
  return (
    <>
      <PageHeader eyebrow={overview.data ? `${overview.data.season} · ${overview.data.completedRounds}/${overview.data.calendar.length}` : undefined} title={t("standings.constructors")} right={<StandingsTabs active="teams" />} />
      <Resource query={overview} loading={<SkeletonRows rows={10} label={t("load.championship")} />}>
        {() => (rows?.length ? <TeamStandingsTable rows={rows} /> : <div className="glass p-10 text-center text-white/60">{t("standings.empty")}</div>)}
      </Resource>
    </>
  );
}
