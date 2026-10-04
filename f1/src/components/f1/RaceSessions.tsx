"use client";
import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/i18n";
import { useRace, useOverview } from "@/hooks/useF1";
import { buildLookups } from "@/lib/data";
import { Resource } from "@/components/ui/Resource";
import { SkeletonRows } from "@/components/ui/Skeleton";
import { Segmented } from "@/components/ui/Bits";
import { ClassificationTable, QualifyingTable } from "./ResultsTables";
import type { RaceDetail } from "@/types/f1";

type Tab = "sq" | "sprint" | "q" | "race";

/** Session tabs for a Grand Prix weekend. Sprint sessions are labelled separately from the main race. */
export function RaceSessions({ round }: { round: number }) {
  const { t } = useI18n();
  const q = useRace(round);
  const ov = useOverview();
  return (
    <Resource quiet query={q} loading={<SkeletonRows rows={10} label={t("load.race")} />} errorKey="err.race">
      {(d) => <Inner d={d} lk={buildLookups(ov.data)} />}
    </Resource>
  );
}

function Inner({ d, lk }: { d: RaceDetail; lk: ReturnType<typeof buildLookups> }) {
  const { t } = useI18n();
  const tabs = useMemo(() => {
    const out: { value: Tab; label: string; has: boolean }[] = [];
    if (d.race.isSprint) {
      out.push({ value: "sq", label: t("session.sprintQualifying"), has: d.sprintQualifying.length > 0 });
      out.push({ value: "sprint", label: t("session.sprint"), has: d.sprint.length > 0 });
    }
    out.push({ value: "q", label: t("session.qualifying"), has: d.qualifying.length > 0 });
    out.push({ value: "race", label: d.race.isSprint ? `${t("session.race")} (GP)` : t("session.race"), has: d.results.length > 0 });
    return out;
  }, [d, t]);

  const best = [...tabs].reverse().find((x) => x.has)?.value ?? "race";
  const [tab, setTab] = useState<Tab>(best);
  useEffect(() => setTab(best), [d.race.round, best]);

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Segmented<Tab> label={t("race.sessionResults")} value={tab} onChange={setTab} options={tabs.map((x) => ({ value: x.value, label: x.label }))} />
        {(tab === "sq" || tab === "sprint") && <span className="rounded-md bg-accent/90 px-2 py-0.5 text-[0.68rem] font-bold uppercase tracking-wider">{t("race.sprintWeekend")}</span>}
      </div>
      {tab === "race" && (d.results.length ? <ClassificationTable rows={d.results} lk={lk} /> : <Empty text={t("race.notFinished")} />)}
      {tab === "sprint" && (d.sprint.length ? <ClassificationTable rows={d.sprint} lk={lk} sprint /> : <Empty text={t("race.notFinished")} />)}
      {tab === "q" && (d.qualifying.length ? <QualifyingTable rows={d.qualifying} lk={lk} /> : <Empty text={t("quali.noData")} />)}
      {tab === "sq" && (d.sprintQualifying.length ? <QualifyingTable rows={d.sprintQualifying} lk={lk} shootout /> : <Empty text={t("quali.noData")} />)}
    </div>
  );
}

const Empty = ({ text }: { text: string }) => <div className="glass p-10 text-center text-white/55">{text}</div>;
