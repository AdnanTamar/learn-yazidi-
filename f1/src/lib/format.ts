import { regionName } from "./countries";
import type { Race, Session } from "@/types/f1";

export interface TimeOpts {
  locale: string;
  clock24: boolean;
  utc: boolean;
}

export function fmtDate(iso: string | null | undefined, o: TimeOpts, style: "short" | "long" | "weekday" = "short"): string {
  if (!iso) return "—";
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00Z` : iso);
  const tz = iso.length === 10 ? "UTC" : o.utc ? "UTC" : undefined;
  const opts: Intl.DateTimeFormatOptions =
    style === "long" ? { day: "numeric", month: "long", year: "numeric" } : style === "weekday" ? { weekday: "short", day: "numeric", month: "short" } : { day: "numeric", month: "short" };
  return new Intl.DateTimeFormat(o.locale, { ...opts, timeZone: tz }).format(d);
}

export function fmtDateTime(s: Session | null, o: TimeOpts): string {
  if (!s) return "—";
  if (!s.iso) return fmtDate(s.date, o, "weekday");
  const d = new Date(s.iso);
  return new Intl.DateTimeFormat(o.locale, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: !o.clock24, timeZone: o.utc ? "UTC" : undefined }).format(d);
}

export function fmtClock(iso: string, o: TimeOpts): string {
  return new Intl.DateTimeFormat(o.locale, { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: !o.clock24, timeZone: o.utc ? "UTC" : undefined }).format(new Date(iso));
}

export function countdown(targetMs: number, nowMs: number) {
  const diff = Math.max(0, targetMs - nowMs);
  const s = Math.floor(diff / 1000);
  return { days: Math.floor(s / 86400), hours: Math.floor((s % 86400) / 3600), minutes: Math.floor((s % 3600) / 60), seconds: s % 60, done: diff === 0 };
}

export function lapTime(s: number | null | undefined): string {
  if (s == null) return "—";
  const m = Math.floor(s / 60);
  return m > 0 ? `${m}:${(s - m * 60).toFixed(3).padStart(6, "0")}` : s.toFixed(3);
}

/** Grand Prix display name, localised for Dutch from the circuit's country. */
const CITY_NAMED = new Set(["Miami", "Las Vegas", "Emilia Romagna", "São Paulo", "Sao Paulo", "Mexico City", "Abu Dhabi", "Madrid", "Monaco", "Singapore", "Barcelona", "Barcelona-Catalunya", "Azerbaijan", "Qatar", "Bahrain", "Saudi Arabian"]);
export function gpName(race: Pick<Race, "name" | "countryCode" | "country">, lang: string, locale: string): string {
  if (lang !== "nl") return race.name;
  const base = race.name.replace(/\s*Grand Prix$/i, "").trim();
  const place = CITY_NAMED.has(base) && !/^(Saudi Arabian|Azerbaijan|Qatar|Bahrain|Monaco|Singapore)$/.test(base)
    ? base
    : regionName(race.countryCode, locale, base);
  return `Grand Prix van ${place}`;
}

export const flagUrl = (code: string | null, w: 20 | 40 | 80 = 40) => (code ? `https://flagcdn.com/w${w}/${code.toLowerCase()}.png` : null);
export const pad2 = (n: number) => String(n).padStart(2, "0");
