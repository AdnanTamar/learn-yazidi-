import { cached, openf1Fetch } from "./http";

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface OfSession {
  session_key: number;
  session_name: string;
  session_type: string;
  date_start: string;
  date_end: string;
  country_name: string;
  circuit_short_name: string;
  location: string;
  year: number;
}

export async function ofSessions(year: number | string, ttlMs = 5 * 60_000): Promise<OfSession[]> {
  const { value } = await cached(`of:sessions:${year}`, ttlMs, () => openf1Fetch<OfSession[]>("sessions", { year }));
  return Array.isArray(value) ? value : [];
}

/** Find the OpenF1 session matching a Jolpica race weekend session (same day, matching name). */
export function matchSession(sessions: OfSession[], date: string, names: string[]): OfSession | null {
  const t = Date.parse(`${date}T12:00:00Z`);
  return (
    sessions
      .filter((s) => names.includes(s.session_name) && Math.abs(Date.parse(s.date_start) - t) < 36 * 3600_000)
      .sort((a, b) => Math.abs(Date.parse(a.date_start) - t) - Math.abs(Date.parse(b.date_start) - t))[0] ?? null
  );
}

export interface OfDriver {
  driver_number: number;
  name_acronym: string;
  full_name: string;
  last_name: string;
  team_name: string;
  team_colour: string;
  headshot_url: string | null;
}

export async function ofDrivers(sessionKey: number | string): Promise<OfDriver[]> {
  const { value } = await cached(`of:drivers:${sessionKey}`, 6 * 3600_000, () => openf1Fetch<OfDriver[]>("drivers", { session_key: sessionKey }));
  return Array.isArray(value) ? value : [];
}

/** Drivers (photo, colour) from the most recent session that has already started. */
export async function latestDrivers(year: number | string): Promise<OfDriver[]> {
  const sessions = await ofSessions(year, 30 * 60_000);
  const past = sessions.filter((s) => Date.parse(s.date_start) < Date.now()).sort((a, b) => Date.parse(b.date_start) - Date.parse(a.date_start));
  for (const s of past.slice(0, 3)) {
    const d = await ofDrivers(s.session_key);
    if (d.length) return d;
  }
  return [];
}

/** Outline of the circuit from one clean lap of GPS data. */
export async function circuitTrace(sessionKey: number, driverNumber: number): Promise<[number, number][] | null> {
  try {
    return (await cached(`of:trace:${sessionKey}`, 7 * 24 * 3600_000, async () => {
    const laps = await openf1Fetch<any[]>("laps", { session_key: sessionKey, driver_number: driverNumber });
    const lap = laps.filter((l) => l.lap_duration && l.date_start && !l.is_pit_out_lap && l.lap_number > 1).sort((a, b) => a.lap_duration - b.lap_duration)[0];
    if (!lap) throw new Error("no clean lap yet");
    const start = new Date(lap.date_start).toISOString().slice(0, 19);
    const end = new Date(Date.parse(lap.date_start) + lap.lap_duration * 1000).toISOString().slice(0, 19);
    const loc = await openf1Fetch<any[]>("location", `session_key=${sessionKey}&driver_number=${driverNumber}&date>=${start}&date<=${end}`);
    const pts = loc.filter((p) => p.x || p.y).map((p) => [p.x, p.y] as [number, number]);
    if (pts.length < 40) throw new Error("not enough GPS points");
    const step = Math.max(1, Math.floor(pts.length / 400));
    return pts.filter((_, i) => i % step === 0);
    })).value;
  } catch {
    return null; // not cached: retried on the next request
  }
}
