"use client";
import { useI18n } from "@/i18n";
import { useDriverRows } from "@/lib/data";
import { Resource } from "@/components/ui/Resource";
import { SkeletonCards } from "@/components/ui/Skeleton";
import { PageHeader } from "@/components/ui/Bits";
import { DriverCard } from "@/components/f1/Cards";

export default function DriversPage() {
  const { t } = useI18n();
  const { rows, overview } = useDriverRows();
  return (
    <>
      <PageHeader title={t("drivers.title")} subtitle={overview.data ? t("drivers.subtitle", { season: overview.data.season }) : undefined} />
      <Resource query={overview} loading={<SkeletonCards n={9} label={t("load.drivers")} h="h-[26rem]" />}>
        {() => <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{rows?.map((r) => <DriverCard key={r.driver.id} row={r} />)}</div>}
      </Resource>
    </>
  );
}
