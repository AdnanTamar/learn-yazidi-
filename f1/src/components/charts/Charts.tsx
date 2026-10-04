"use client";
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useI18n } from "@/i18n";

export interface Series {
  id: string;
  label: string;
  color: string;
  data: { round: number; points: number }[];
}

const axis = { stroke: "rgba(255,255,255,.35)", fontSize: 11, tickLine: false, axisLine: false } as const;

function Tip({ active, payload, label, unit }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string | number; unit: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass !rounded-xl !bg-[#0e1118]/95 px-3 py-2 text-xs shadow-xl">
      <p className="mb-1 font-semibold text-white/70">{label}</p>
      {[...payload].sort((a, b) => b.value - a.value).map((p) => (
        <p key={p.name} className="flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ background: p.color }} aria-hidden /> <span className="text-white/80">{p.name}</span> <b className="num ml-auto pl-4">{p.value} {unit}</b></p>
      ))}
    </div>
  );
}

/** Cumulative points over rounds. Lines are direct-labelled by the legend chips; tooltip gives exact values. */
export function ProgressChart({ series, height = 300, roundLabels }: { series: Series[]; height?: number; roundLabels?: Record<number, string> }) {
  const { t } = useI18n();
  const rounds = [...new Set(series.flatMap((s) => s.data.map((d) => d.round)))].sort((a, b) => a - b);
  const data = rounds.map((r) => ({ round: r, ...Object.fromEntries(series.map((s) => [s.id, s.data.find((d) => d.round === r)?.points ?? null])) }));
  if (!rounds.length) return <p className="py-10 text-center text-sm text-white/50">{t("common.noData")}</p>;
  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-3 text-xs">
        {series.map((s) => <span key={s.id} className="inline-flex items-center gap-1.5 text-white/75"><span className="h-0.5 w-4 rounded" style={{ background: s.color }} aria-hidden />{s.label}</span>)}
      </div>
      <div style={{ height }} role="img" aria-label={series.map((s) => `${s.label}: ${s.data.at(-1)?.points ?? 0}`).join(", ")}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
            <CartesianGrid stroke="rgba(255,255,255,.06)" vertical={false} />
            <XAxis dataKey="round" {...axis} tickFormatter={(r) => `R${r}`} />
            <YAxis {...axis} />
            <Tooltip content={<Tip unit={t("common.pts")} />} labelFormatter={(r) => roundLabels?.[r as number] ?? `R${r}`} cursor={{ stroke: "rgba(255,255,255,.2)" }} />
            {series.map((s) => (
              <Line key={s.id} name={s.label} type="monotone" dataKey={s.id} stroke={s.color} strokeWidth={2.4} dot={false} activeDot={{ r: 4 }} connectNulls isAnimationActive={false} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function BarMetric({ data, unit = "", height = 340, decimals = 0 }: { data: { id: string; label: string; value: number; color: string }[]; unit?: string; height?: number; decimals?: number }) {
  const { t } = useI18n();
  if (!data.length) return <p className="py-10 text-center text-sm text-white/50">{t("common.noData")}</p>;
  return (
    <div style={{ height }} role="img" aria-label={data.map((d) => `${d.label}: ${d.value.toFixed(decimals)}`).join(", ")}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 40, left: 0, bottom: 0 }} barCategoryGap={6}>
          <CartesianGrid stroke="rgba(255,255,255,.05)" horizontal={false} />
          <XAxis type="number" {...axis} />
          <YAxis type="category" dataKey="label" width={96} {...axis} stroke="rgba(255,255,255,.7)" />
          <Tooltip cursor={{ fill: "rgba(255,255,255,.05)" }} content={({ active, payload }) => active && payload?.length ? <div className="glass !rounded-xl !bg-[#0e1118]/95 px-3 py-2 text-xs"><b>{payload[0].payload.label}</b> <span className="num ml-2">{Number(payload[0].value).toFixed(decimals)} {unit}</span></div> : null} />
          <Bar dataKey="value" radius={[0, 8, 8, 0]} isAnimationActive={false} label={{ position: "right", fill: "rgba(255,255,255,.8)", fontSize: 11, formatter: (v: unknown) => Number(v).toFixed(decimals) }}>
            {data.map((d) => <Cell key={d.id} fill={d.color} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
