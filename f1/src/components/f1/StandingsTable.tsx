"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useI18n, type Key } from "@/i18n";
import { DriverPhoto, Flag, TeamMark } from "@/components/ui/Media";
import { FormChips, Segmented } from "@/components/ui/Bits";
import { regionName } from "@/lib/countries";
import type { DriverRow, TeamRow } from "@/lib/data";

type SortKey = "position" | "points" | "wins" | "podiums" | "poles" | "fastestLaps";
const SORTS: SortKey[] = ["position", "points", "wins", "podiums", "poles", "fastestLaps"];

const FULL_COLS = "lg:grid-cols-[3rem_minmax(0,1fr)_5rem_3.5rem_4rem_3.5rem_3rem_9rem]";
const COMPACT_COLS = "lg:grid-cols-[2.5rem_minmax(0,1fr)_4rem_3rem_3.5rem]";

const val = (r: DriverRow, k: SortKey): number =>
  k === "position" ? r.position : k === "points" ? r.points : k === "wins" ? r.wins : k === "podiums" ? r.stats?.podiums ?? 0 : k === "poles" ? r.stats?.poles ?? 0 : r.stats?.fastestLaps ?? 0;

export function DriverStandingsTable({ rows, limit, compact = false }: { rows: DriverRow[]; limit?: number; compact?: boolean }) {
  const { t, locale } = useI18n();
  const [sort, setSort] = useState<SortKey>("position");

  const sorted = useMemo(() => {
    const out = [...rows].sort((a, b) => (sort === "position" ? a.position - b.position : val(b, sort) - val(a, sort) || a.position - b.position));
    return limit ? out.slice(0, limit) : out;
  }, [rows, sort, limit]);

  return (
    <div>
      {!limit && (
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <span className="eyebrow">{t("standings.sortBy")}</span>
          <Segmented<SortKey> label={t("standings.sortBy")} value={sort} onChange={setSort} options={SORTS.map((s) => ({ value: s, label: t(`standings.sort.${s}` as Key) }))} />
        </div>
      )}
      <div className="glass overflow-hidden p-1.5 sm:p-2">
        <div className={`hidden items-center gap-3 px-4 pb-2 pt-3 text-[0.68rem] uppercase tracking-widest text-white/45 lg:grid ${compact ? COMPACT_COLS : FULL_COLS}`}>
          <span>#</span><span>{t("common.driver")}</span>
          <span className="text-right">{t("common.points")}</span><span className="text-right">{t("common.wins")}</span><span className="text-right">{t("common.podiums")}</span>
          {!compact && <><span className="text-right">{t("common.poles")}</span><span className="text-right">{t("common.fl")}</span><span>{t("common.form")}</span></>}
        </div>
        <ol>
          {sorted.map((r, i) => {
            const d = r.driver;
            return (
              <motion.li key={d.id} layout="position" transition={{ type: "spring", stiffness: 520, damping: 42 }} initial={limit ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
                <Link href={`/drivers/${d.id}`} style={{ "--row-c": d.color } as React.CSSProperties} className={`row group block rounded-2xl px-3 py-2.5 sm:px-4 lg:grid lg:items-center lg:gap-3 ${compact ? COMPACT_COLS : FULL_COLS}`}>
                  <div className="flex items-center gap-3 lg:contents">
                    <span className={`racing-num num w-9 shrink-0 text-3xl lg:w-auto ${r.position <= 3 ? "text-white" : "text-white/55"}`}>{String(r.position).padStart(2, "0")}</span>
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <DriverPhoto driver={d} className="h-12 w-12 shrink-0 !rounded-full sm:h-14 sm:w-14" />
                      <div className="min-w-0">
                        <p className="truncate font-semibold leading-tight"><span className="text-white/60 font-normal">{d.firstName}</span> <span className="display text-xl">{d.lastName}</span></p>
                        <p className="mt-0.5 flex items-center gap-2 truncate text-xs text-white/55">
                          <Flag code={d.countryCode} /> <span className="hidden sm:inline">{regionName(d.countryCode, locale, d.nationality)} · </span><span style={{ color: d.color }}>{d.teamName ?? "—"}</span>
                        </p>
                      </div>
                    </div>
                    <div className="text-right lg:contents">
                      <span className="racing-num num block text-3xl lg:text-right lg:text-2xl">{r.points}</span>
                      <span className="eyebrow !text-[0.58rem] lg:hidden">{t("common.pts")}</span>
                    </div>
                  </div>
                  <dl className={`mt-2.5 grid ${compact ? "grid-cols-2" : "grid-cols-4"} gap-2 border-t border-white/5 pt-2.5 text-center lg:contents lg:border-0 lg:pt-0 lg:mt-0`}>
                    <Stat label={t("common.wins")} v={r.wins} hi={sort === "wins"} />
                    <Stat label={t("common.podiums")} v={r.stats?.podiums} hi={sort === "podiums"} />
                    {!compact && <Stat label={t("common.poles")} v={r.stats?.poles} hi={sort === "poles"} />}
                    {!compact && <Stat label={t("common.fl")} v={r.stats?.fastestLaps} hi={sort === "fastestLaps"} />}
                  </dl>
                  {!compact && <div className="mt-2 hidden sm:block lg:mt-0"><FormChips form={r.stats?.form ?? []} /></div>}
                </Link>
                {i < sorted.length - 1 && <div className="mx-4 h-px bg-white/[.04]" />}
              </motion.li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}

function Stat({ label, v, hi }: { label: string; v?: number; hi?: boolean }) {
  return (
    <div className="lg:text-right">
      <dt className="eyebrow !text-[0.58rem] lg:sr-only">{label}</dt>
      <dd className={`num text-lg font-semibold lg:text-base ${hi ? "text-white" : "text-white/80"}`}>{v ?? "–"}</dd>
    </div>
  );
}

export function TeamStandingsTable({ rows }: { rows: TeamRow[] }) {
  const { t } = useI18n();
  const max = Math.max(1, ...rows.map((r) => r.points));
  return (
    <ol className="grid gap-3">
      {rows.map((r, i) => (
        <motion.li key={r.team.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 10) * 0.03 }}>
          <Link href={`/teams/${r.team.id}`} style={{ "--accent-c": r.team.color, "--row-c": r.team.color } as React.CSSProperties} className="glass accent-card glare row group block overflow-hidden p-4 sm:p-5">
            <div className="relative flex items-center gap-3 sm:gap-4">
              <span className="racing-num num w-10 shrink-0 text-3xl text-white/70 sm:w-12 sm:text-4xl">{String(r.position).padStart(2, "0")}</span>
              <TeamMark name={r.team.name} color={r.team.color} className="h-11 w-11 shrink-0 text-lg" />
              <div className="min-w-0 flex-1">
                <p className="display truncate text-2xl leading-none">{r.team.name}</p>
                <p className="mt-1 truncate text-xs text-white/55">{r.drivers.map((d) => d.lastName).join(" · ")}</p>
              </div>
              <div className="shrink-0 text-right"><span className="racing-num num pr-1 text-3xl sm:text-4xl">{r.points}</span><span className="eyebrow ml-1 hidden !text-[0.6rem] sm:inline">{t("common.pts")}</span></div>
            </div>
            <div className="relative mt-3 h-1.5 overflow-hidden rounded-full bg-white/10" role="img" aria-label={`${r.points} ${t("common.pts")}`}>
              <motion.div className="h-full rounded-full" style={{ background: r.team.color }} initial={{ width: 0 }} animate={{ width: `${(r.points / max) * 100}%` }} transition={{ duration: 0.8, ease: [0.2, 0.9, 0.25, 1] }} />
            </div>
            <div className="relative mt-2.5 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-white/55">
              <span>{t("common.wins")} <b className="num text-white">{r.wins}</b></span>
              <span>{t("common.podiums")} <b className="num text-white">{r.stats?.podiums ?? "–"}</b></span>
              {r.stats?.form.length ? <span className="ml-auto flex items-center gap-2"><span className="hidden sm:inline">{t("standings.recent")}</span><MiniBars form={r.stats.form.map((f) => f.points)} color={r.team.color} /></span> : null}
            </div>
          </Link>
        </motion.li>
      ))}
    </ol>
  );
}

function MiniBars({ form, color }: { form: number[]; color: string }) {
  const m = Math.max(1, ...form);
  return (
    <span className="inline-flex h-5 items-end gap-[3px]" role="img" aria-label={form.join(", ")}>
      {form.map((p, i) => (
        <span key={i} className="w-1.5 rounded-sm" title={`${p}`} style={{ height: `${Math.max(12, (p / m) * 100)}%`, background: color, opacity: 0.4 + 0.12 * i }} />
      ))}
    </span>
  );
}
