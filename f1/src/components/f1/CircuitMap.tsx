"use client";
import { useMemo } from "react";
import { useI18n } from "@/i18n";
import type { LiveCar } from "@/types/f1";

interface Props {
  points: [number, number][] | null;
  cars?: LiveCar[];
  className?: string;
  label?: string;
}

/** Circuit outline drawn from real GPS samples (OpenF1 location data); live cars use the same coordinate space. */
export function CircuitMap({ points, cars = [], className = "", label }: Props) {
  const { t } = useI18n();
  const geo = useMemo(() => {
    if (!points?.length) return null;
    const xs = points.map((p) => p[0]);
    const ys = points.map((p) => p[1]);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    const w = maxX - minX || 1, h = maxY - minY || 1;
    const pad = Math.max(w, h) * 0.08;
    const map = (x: number, y: number): [number, number] => [x - minX + pad, maxY - y + pad]; // flip Y: GPS north-up
    const path = points.map(([x, y], i) => `${i ? "L" : "M"}${map(x, y).join(" ")}`).join(" ") + "Z";
    return { path, map, vb: `0 0 ${w + pad * 2} ${h + pad * 2}`, unit: Math.max(w, h) };
  }, [points]);

  if (!geo) {
    return (
      <div className={`grid place-items-center text-sm text-white/45 ${className}`}>
        <div className="chequer h-full w-full rounded-2xl" aria-hidden />
        <span className="absolute">{t("live.trackMapNone")}</span>
      </div>
    );
  }
  const r = geo.unit * 0.014;
  return (
    <svg viewBox={geo.vb} className={className} role="img" aria-label={label ?? t("race.circuitLayout")} preserveAspectRatio="xMidYMid meet">
      <path d={geo.path} fill="none" stroke="rgba(255,255,255,.1)" strokeWidth={r * 5.5} strokeLinejoin="round" strokeLinecap="round" />
      <path d={geo.path} fill="none" stroke="rgba(255,255,255,.75)" strokeWidth={r * 1.3} strokeLinejoin="round" strokeLinecap="round" />
      {points && (() => { const [x, y] = geo.map(points[0][0], points[0][1]); return <rect x={x - r * 2} y={y - r * 0.5} width={r * 4} height={r} fill="#ff3b30" />; })()}
      {cars.filter((c) => c.x != null && c.y != null).map((c) => {
        const [x, y] = geo.map(c.x!, c.y!);
        return (
          <g key={c.driverNumber} style={{ transform: `translate(${x}px, ${y}px)`, transition: "transform 4s linear" }}>
            <circle r={r * 2.3} fill={c.color} stroke="#000" strokeWidth={r * 0.35} />
            {c.position <= 3 && <text y={r * 0.9} textAnchor="middle" fontSize={r * 2.4} fontWeight="800" fill="#000">{c.position}</text>}
            <title>{`P${c.position} ${c.name}`}</title>
          </g>
        );
      })}
    </svg>
  );
}
