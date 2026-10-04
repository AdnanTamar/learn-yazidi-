"use client";
import { useI18n } from "@/i18n";
import { useTeamRows } from "@/lib/data";
import { Resource } from "@/components/ui/Resource";
import { SkeletonCards } from "@/components/ui/Skeleton";
import { PageHeader } from "@/components/ui/Bits";
import { TeamCard } from "@/components/f1/Cards";

export default function TeamsPage() {
  const { t } = useI18n();
  const { rows, overview } = useTeamRows();
  return (
    <>
      <PageHeader title={t("teams.title")} subtitle={overview.data ? t("teams.subtitle", { season: overview.data.season }) : undefined} />
      <Resource query={overview} loading={<SkeletonCards n={6} label={t("load.drivers")} h="h-72" />}>
        {() => <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{rows?.map((r) => <TeamCard key={r.team.id} row={r} />)}</div>}
      </Resource>
    </>
  );
}
