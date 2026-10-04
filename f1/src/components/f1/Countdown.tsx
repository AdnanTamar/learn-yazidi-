"use client";
import { useI18n } from "@/i18n";
import { useNow } from "@/hooks/useF1";
import { countdown, pad2 } from "@/lib/format";

/** Large segmented countdown. Announces coarse changes only (minutes) to screen readers. */
export function Countdown({ target, size = "lg" }: { target: string; size?: "lg" | "sm" }) {
  const { lang } = useI18n();
  const now = useNow();
  if (!now) return <div className="h-14" aria-hidden />;
  const c = countdown(Date.parse(target), now);
  const units = lang === "nl" ? { d: "dg", h: "uur", m: "min", s: "sec" } : { d: "days", h: "hrs", m: "min", s: "sec" };
  const parts = [[c.days, units.d], [c.hours, units.h], [c.minutes, units.m], [c.seconds, units.s]] as const;
  const label = `${c.days}d ${c.hours}h ${c.minutes}m`;
  return (
    <div className="flex items-end gap-3 sm:gap-4" role="timer" aria-label={label}>
      {parts.map(([v, u], i) => (
        <div key={u} className="flex items-end gap-3 sm:gap-4" aria-hidden>
          <div className="text-center">
            <div className={`racing-num num ${size === "lg" ? "text-5xl sm:text-6xl" : "text-3xl"}`}>{i === 0 ? v : pad2(v)}</div>
            <div className="eyebrow mt-1 !text-[0.6rem]">{u}</div>
          </div>
          {i < 3 && <span className={`pb-5 text-white/25 ${size === "lg" ? "text-3xl" : "text-xl"}`}>:</span>}
        </div>
      ))}
    </div>
  );
}
