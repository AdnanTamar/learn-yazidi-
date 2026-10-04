"use client";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { useI18n } from "@/i18n";
import { GlassCard } from "@/components/ui/GlassCard";
import { DriverPhoto, Flag, TeamMark } from "@/components/ui/Media";
import { FormChips } from "@/components/ui/Bits";
import { regionName } from "@/lib/countries";
import type { DriverRow, TeamRow } from "@/lib/data";

export function DriverCard({ row }: { row: DriverRow }) {
  const { t, locale } = useI18n();
  const d = row.driver;
  return (
    <GlassCard as="article" tilt={6} accent={d.color} className="group h-full overflow-hidden">
      <Link href={`/drivers/${d.id}`} className="flex h-full flex-col rounded-[inherit]" aria-label={d.name}>
        <div className="relative h-56 sm:h-64">
          <DriverPhoto driver={d} className="absolute inset-0 !rounded-none" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0b0d12] via-[#0b0d12]/20 to-transparent" />
          <span className="racing-num absolute right-4 top-3 text-6xl text-white/20 sm:text-7xl" aria-hidden>{d.number ?? ""}</span>
          <span className="absolute left-4 top-4 grid h-9 min-w-9 place-items-center rounded-full bg-black/55 px-2 text-sm font-bold backdrop-blur num">P{row.position}</span>
        </div>
        <div className="relative -mt-12 flex flex-1 flex-col gap-3 p-5 pt-0">
          <div>
            <p className="text-sm text-white/60">{d.firstName}</p>
            <h3 className="display text-3xl leading-none">{d.lastName}</h3>
            <p className="mt-2 flex items-center gap-2 text-sm text-white/70"><Flag code={d.countryCode} /> {regionName(d.countryCode, locale, d.nationality)} <span className="text-white/25">·</span> <span style={{ color: d.color }}>{d.teamName ?? "—"}</span></p>
          </div>
          <div className="mt-auto grid grid-cols-3 gap-2 border-t border-white/10 pt-3 text-center">
            <Mini label={t("common.points")} v={row.points} />
            <Mini label={t("common.wins")} v={row.wins} />
            <Mini label={t("common.podiums")} v={row.stats?.podiums ?? "–"} />
          </div>
          <div className="flex items-center justify-between">
            <FormChips form={row.stats?.form ?? []} />
            <ArrowUpRight className="h-4 w-4 text-white/40 transition group-hover:text-white" aria-hidden />
          </div>
        </div>
      </Link>
    </GlassCard>
  );
}

const Mini = ({ label, v }: { label: string; v: React.ReactNode }) => (
  <div>
    <div className="racing-num num text-2xl">{v}</div>
    <div className="eyebrow !text-[0.58rem]">{label}</div>
  </div>
);

export function TeamCard({ row }: { row: TeamRow }) {
  const { t } = useI18n();
  const c = row.team.color;
  return (
    <GlassCard as="article" tilt={5} accent={c} className="group h-full overflow-hidden">
      <Link href={`/teams/${row.team.id}`} className="flex h-full flex-col gap-5 rounded-[inherit] p-5 sm:p-6" aria-label={row.team.name}>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3.5">
            <TeamMark name={row.team.name} color={c} className="h-12 w-12 text-xl" />
            <div>
              <h3 className="display text-2xl leading-none">{row.team.name}</h3>
              <p className="mt-1.5 flex items-center gap-1.5 text-xs text-white/55"><Flag code={row.team.countryCode} /> {row.team.nationality}</p>
            </div>
          </div>
          <span className="racing-num num text-5xl text-white/25">{String(row.position).padStart(2, "0")}</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {row.drivers.map((d) => (
            <div key={d.id} className="flex items-center gap-2.5 rounded-2xl bg-white/[.04] p-2">
              <DriverPhoto driver={d} className="h-11 w-11 shrink-0 !rounded-full" />
              <div className="min-w-0 leading-tight"><p className="truncate text-[0.7rem] text-white/50">{d.firstName}</p><p className="truncate text-sm font-semibold">{d.lastName}</p></div>
            </div>
          ))}
        </div>
        <div className="mt-auto flex items-end justify-between border-t border-white/10 pt-4">
          <div><p className="racing-num num text-4xl">{row.points}</p><p className="eyebrow !text-[0.6rem]">{t("common.points")}</p></div>
          <div className="flex gap-5 text-right">
            <Mini label={t("common.wins")} v={row.wins} />
            <Mini label={t("common.podiums")} v={row.stats?.podiums ?? "–"} />
          </div>
        </div>
      </Link>
    </GlassCard>
  );
}
