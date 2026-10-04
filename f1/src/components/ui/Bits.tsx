"use client";
import type { ReactNode } from "react";
import { Radio, CheckCircle2, Clock } from "lucide-react";
import { useI18n } from "@/i18n";
import { GlassCard } from "./GlassCard";
import type { RaceStatus } from "@/hooks/useF1";

export function PageHeader({ eyebrow, title, subtitle, right }: { eyebrow?: string; title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow && <p className="eyebrow mb-2 flex items-center gap-2"><span className="inline-block h-px w-6 bg-accent" aria-hidden />{eyebrow}</p>}
        <h1 className="display text-4xl leading-none sm:text-5xl">{title}</h1>
        {subtitle && <p className="mt-3 max-w-2xl text-white/60">{subtitle}</p>}
      </div>
      {right}
    </header>
  );
}

export function StatCard({ label, value, hint, accent, className = "" }: { label: string; value: ReactNode; hint?: ReactNode; accent?: string; className?: string }) {
  return (
    <GlassCard tilt={3} accent={accent} className={`p-4 sm:p-5 ${className}`}>
      <p className="eyebrow !text-[0.62rem]">{label}</p>
      <div className="racing-num num mt-2 text-4xl sm:text-5xl">{value}</div>
      {hint && <p className="mt-1.5 text-xs text-white/55">{hint}</p>}
    </GlassCard>
  );
}

/** Status is conveyed by icon + text + colour (never colour alone). */
export function StatusBadge({ status }: { status: RaceStatus }) {
  const { t } = useI18n();
  const map = {
    live: { Icon: Radio, cls: "border-red-400/50 bg-red-500/15 text-red-200", label: t("status.live") },
    upcoming: { Icon: Clock, cls: "border-white/15 bg-white/[.06] text-white/75", label: t("status.upcoming") },
    finished: { Icon: CheckCircle2, cls: "border-emerald-400/25 bg-emerald-400/10 text-emerald-200", label: t("status.finished") },
  }[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[0.68rem] font-bold uppercase tracking-wider ${map.cls}`}>
      <map.Icon className={`h-3 w-3 ${status === "live" ? "animate-pulseDot" : ""}`} aria-hidden /> {map.label}
    </span>
  );
}

export function Segmented<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; label: string }) {
  return (
    <div role="tablist" aria-label={label} className="hide-scroll inline-flex max-w-full gap-1 overflow-x-auto rounded-full border border-white/10 bg-white/[.04] p-1">
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={`whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${value === o.value ? "bg-white text-black" : "text-white/70 hover:text-white"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function FormChips({ form }: { form: { round: number; position: number | null; status: string }[] }) {
  const { t } = useI18n();
  if (!form.length) return <span className="text-white/40">—</span>;
  return (
    <ul className="flex gap-1" aria-label={t("common.form")}>
      {form.map((f) => (
        <li
          key={f.round}
          title={f.position ? `P${f.position}` : `${t("common.dnf")} – ${f.status}`}
          className={`grid h-6 min-w-[28px] place-items-center rounded-md px-1 text-[0.68rem] font-bold num ${
            f.position === null ? "border border-red-400/40 bg-red-500/10 text-red-200" : f.position === 1 ? "bg-amber-300 text-black" : f.position <= 3 ? "bg-white/90 text-black" : f.position <= 10 ? "bg-white/15 text-white" : "bg-white/[.06] text-white/60"
          }`}
        >
          {f.position ?? "×"}
        </li>
      ))}
    </ul>
  );
}
