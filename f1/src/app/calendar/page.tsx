"use client";
import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useI18n } from "@/i18n";
import { useNow, useOverview, useSeason, raceStatus } from "@/hooks/useF1";
import { Resource } from "@/components/ui/Resource";
import { SkeletonCards } from "@/components/ui/Skeleton";
import { PageHeader, Segmented } from "@/components/ui/Bits";
import { RaceCard } from "@/components/f1/RaceCard";
import { regionName } from "@/lib/countries";
import { gpName } from "@/lib/format";
import type { Overview } from "@/types/f1";

type Filter = "all" | "upcoming" | "finished" | "sprint";
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function Grid({ o }: { o: Overview }) {
  const { t, lang, locale } = useI18n();
  const now = useNow();
  const season = useSeason();
  const sp = useSearchParams();
  const q = sp.get("q") ?? "";
  const [filter, setFilter] = useState<Filter>("all");
  const winners = useMemo(() => {
    const m = new Map<number, string>();
    const names = new Map(o.drivers.map((d) => [d.id, d.name]));
    season.data?.rounds.forEach((r) => { const w = r.race.find((x) => x.position === 1); if (w) m.set(r.round, names.get(w.driverId) ?? w.driverId); });
    return m;
  }, [season.data, o.drivers]);

  const list = o.calendar.filter((r) => {
    if (q) {
      const hay = norm(`${r.name} ${gpName(r, lang, locale)} ${r.country} ${regionName(r.countryCode, locale)} ${r.circuitName} ${r.locality}`);
      if (!hay.includes(norm(q))) return false;
    }
    const s = now ? raceStatus(r, now) : "upcoming";
    return filter === "all" ? true : filter === "sprint" ? r.isSprint : filter === "upcoming" ? s !== "finished" : s === "finished";
  });
  return (
    <>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Segmented<Filter> label={t("nav.calendar")} value={filter} onChange={setFilter} options={(["all", "upcoming", "finished", "sprint"] as Filter[]).map((f) => ({ value: f, label: t(`calendar.filter.${f}` as never) }))} />
        {q && <span className="rounded-full border border-white/15 bg-white/[.06] px-3 py-1 text-sm">“{q}”</span>}
      </div>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{list.map((r) => <RaceCard key={r.round} race={r} winner={winners.get(r.round)} />)}</div>
    </>
  );
}

export default function CalendarPage() {
  const { t } = useI18n();
  const q = useOverview();
  return (
    <>
      <PageHeader title={t("calendar.title", { season: q.data?.season ?? "" })} subtitle={q.data ? t("calendar.subtitle", { n: q.data.calendar.length }) : undefined} />
      <Resource query={q} loading={<SkeletonCards n={8} label={t("load.calendar")} h="h-72" />}>
        {(o) => <Suspense fallback={null}><Grid o={o} /></Suspense>}
      </Resource>
    </>
  );
}
