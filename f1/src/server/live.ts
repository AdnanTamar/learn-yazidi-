import { cached, openf1Fetch } from "./http";
import { buildMeta, getCalendar, getOverview } from "./overview";
import { matchSession, ofSessions, circuitTrace, type OfSession } from "./openf1";
import type { ControlEvent, LiveCar, LiveState, LiveWeather, TrackStatus } from "@/types/f1";

/* eslint-disable @typescript-eslint/no-explicit-any */

const FRESH_MS = 45_000;

const idle = (reason?: string, state: LiveState["state"] = "idle", session: LiveState["session"] = null): LiveState => ({
  meta: buildMeta(),
  state,
  reason,
  session,
  dataAsOf: null,
  lap: null,
  trackStatus: "unknown",
  cars: [],
  weather: null,
  events: [],
  trackPoints: null,
  hasPositions: false,
});

const toSession = (s: OfSession): NonNullable<LiveState["session"]> => ({
  key: s.session_key, name: s.session_name, type: s.session_type, start: s.date_start, end: s.date_end, circuit: s.circuit_short_name || s.location,
});

/** Race/Sprint window from the official schedule; independent of live data availability. */
async function scheduledSession() {
  const cal = (await getCalendar()).value;
  const now = Date.now();
  for (const r of cal) {
    const cands = [
      r.race.iso ? { name: "Race", start: Date.parse(r.race.iso), len: 3.5 * 3600_000, date: r.race.date } : null,
      r.sprint?.iso ? { name: "Sprint", start: Date.parse(r.sprint.iso), len: 1.25 * 3600_000, date: r.sprint.date } : null,
    ].filter(Boolean) as { name: string; start: number; len: number; date: string }[];
    for (const c of cands) if (now >= c.start - 10 * 60_000 && now <= c.start + c.len) return { race: r, ...c };
  }
  return null;
}

const laneTone = (v: number | null, personal: number | null, overall: number | null): LiveCar["sectors"][number]["tone"] =>
  v == null ? "none" : overall != null && v <= overall + 1e-6 ? "purple" : personal != null && v <= personal + 1e-6 ? "green" : "yellow";

const fmtGap = (v: unknown): string | null => {
  if (v == null) return null;
  if (typeof v === "number") return v === 0 ? "0.000" : `+${v.toFixed(3)}`;
  return String(v);
};

function trackStatus(rc: any[]): TrackStatus {
  let status: TrackStatus = "green";
  for (const m of [...rc].sort((a, b) => Date.parse(a.date) - Date.parse(b.date))) {
    const msg = String(m.message ?? "").toUpperCase();
    if (m.category === "SafetyCar") {
      if (/VIRTUAL SAFETY CAR DEPLOYED/.test(msg)) status = "vsc";
      else if (/VIRTUAL SAFETY CAR ENDING/.test(msg)) status = "yellow";
      else if (/SAFETY CAR DEPLOYED/.test(msg)) status = "sc";
      else if (/SAFETY CAR IN THIS LAP|SAFETY CAR ENDING/.test(msg)) status = "yellow";
    } else if (m.flag === "RED") status = "red";
    else if (m.flag === "CHEQUERED") status = "chequered";
    else if (m.flag === "GREEN" && m.scope === "Track") status = "green";
    else if (m.flag === "CLEAR" && m.scope === "Track") status = "green";
    else if ((m.flag === "YELLOW" || m.flag === "DOUBLE YELLOW") && m.scope === "Track") status = "yellow";
  }
  return status;
}

export async function getLive(): Promise<LiveState> {
  const scheduled = await scheduledSession();
  const year = scheduled ? Number(scheduled.race.season) : new Date().getFullYear();

  let sessions: OfSession[];
  try {
    // Short TTL while a session is scheduled so the provider's own start/end are picked up quickly.
    sessions = await ofSessions(year, scheduled ? 20_000 : 5 * 60_000);
  } catch (e) {
    return scheduled ? idle(`Provider unreachable: ${(e as Error).message}`, "unavailable") : idle();
  }

  const now = Date.now();
  let session: OfSession | null = null;
  if (scheduled) session = matchSession(sessions, scheduled.date, [scheduled.name]);
  if (!session) {
    session = sessions.find((s) => /^(Race|Sprint)$/.test(s.session_name) && Date.parse(s.date_start) <= now && now <= Date.parse(s.date_end) + 5 * 60_000) ?? null;
  }
  if (!session) return scheduled ? idle("The provider has no timing session for this Grand Prix yet.", "unavailable") : idle();
  const info = toSession(session);
  if (now > Date.parse(session.date_end) + 5 * 60_000) return idle(undefined, "ended", info);
  if (now < Date.parse(session.date_start) - 10 * 60_000) return idle(undefined, "idle", info);

  const key = session.session_key;
  const since = new Date(now - 150_000).toISOString().slice(0, 19);
  const q = (ep: string, extra = "") => openf1Fetch<any[]>(ep, `session_key=${key}${extra}`).catch(() => null);

  const poll = await cached(`live:${key}`, 3_000, async () => {
    const [drivers, position, intervals, laps, stints, pit, rc, weather, overtakes, loc] = await Promise.all([
      q("drivers"), q("position"), q("intervals", `&date>=${since}`), q("laps"), q("stints"), q("pit"), q("race_control"),
      q("weather", `&date>=${new Date(now - 600_000).toISOString().slice(0, 19)}`), q("overtakes"), q("location", `&date>=${new Date(now - 20_000).toISOString().slice(0, 19)}`),
    ]);
    return { drivers, position, intervals, laps, stints, pit, rc, weather, overtakes, loc };
  });
  const d = poll.value;
  if (!d.position || !d.position.length || !d.drivers || !d.drivers.length) {
    return { ...idle("The provider did not return live timing data (a real-time subscription is required during a live session).", "unavailable", info) };
  }

  const stamp = (rows: any[] | null) => (rows ?? []).reduce((m, r) => Math.max(m, Date.parse(r.date ?? r.date_start ?? 0) || 0), 0);
  const dataAsOfMs = Math.max(stamp(d.position), stamp(d.intervals), stamp(d.rc), stamp(d.weather), stamp(d.loc));
  const isStale = now - dataAsOfMs > FRESH_MS;

  const overview = await getOverview().catch(() => null);

  // latest position per driver
  const latestPos = new Map<number, any>();
  for (const p of [...d.position].sort((a, b) => Date.parse(a.date) - Date.parse(b.date))) latestPos.set(p.driver_number, p);
  const latestInt = new Map<number, any>();
  for (const p of [...(d.intervals ?? [])].sort((a, b) => Date.parse(a.date) - Date.parse(b.date))) latestInt.set(p.driver_number, p);

  const laps = d.laps ?? [];
  const lapsBy = new Map<number, any[]>();
  for (const l of laps) lapsBy.set(l.driver_number, [...(lapsBy.get(l.driver_number) ?? []), l]);
  const best = (xs: any[], f: string) => xs.reduce<number | null>((m, l) => (typeof l[f] === "number" && (m == null || l[f] < m) ? l[f] : m), null);
  const overallS = [1, 2, 3].map((i) => best(laps, `duration_sector_${i}`));
  const overallBest = best(laps, "lap_duration");

  const pitCount = new Map<number, number>();
  for (const p of d.pit ?? []) pitCount.set(p.driver_number, (pitCount.get(p.driver_number) ?? 0) + 1);
  const lastPit = new Map<number, number>();
  for (const p of d.pit ?? []) lastPit.set(p.driver_number, Math.max(lastPit.get(p.driver_number) ?? 0, Date.parse(p.date)));
  const stintBy = new Map<number, any>();
  for (const s of [...(d.stints ?? [])].sort((a, b) => a.stint_number - b.stint_number)) stintBy.set(s.driver_number, s);

  const intervalsActive = new Set(latestInt.keys());
  const manyActive = intervalsActive.size >= Math.ceil(latestPos.size / 2);
  const locBy = new Map<number, any>();
  for (const l of [...(d.loc ?? [])].sort((a, b) => Date.parse(a.date) - Date.parse(b.date))) locBy.set(l.driver_number, l);

  const cars: LiveCar[] = [...latestPos.values()]
    .sort((a, b) => a.position - b.position)
    .map((p) => {
      const od = d.drivers!.find((x) => x.driver_number === p.driver_number);
      const known = overview?.drivers.find((k) => k.number === p.driver_number);
      const myLaps = lapsBy.get(p.driver_number) ?? [];
      const lastLap = [...myLaps].sort((a, b) => b.lap_number - a.lap_number)[0];
      const completed = myLaps.filter((l) => typeof l.lap_duration === "number");
      const lastDone = [...completed].sort((a, b) => b.lap_number - a.lap_number)[0];
      const iv = latestInt.get(p.driver_number);
      const st = stintBy.get(p.driver_number);
      const myBest = best(myLaps, "lap_duration");
      const sectors = [1, 2, 3].map((i, idx) => {
        const v = lastDone?.[`duration_sector_${i}`] ?? null;
        return { time: typeof v === "number" ? v : null, tone: laneTone(typeof v === "number" ? v : null, best(myLaps, `duration_sector_${i}`), overallS[idx]) };
      });
      const inPit = (lastPit.get(p.driver_number) ?? 0) > now - 30_000;
      return {
        driverNumber: p.driver_number,
        position: p.position,
        driverId: known?.id ?? null,
        code: od?.name_acronym ?? known?.code ?? String(p.driver_number),
        name: od?.full_name ? od.full_name.replace(/\b(\w)(\w*)/g, (_m: string, a: string, b: string) => a + b.toLowerCase()) : known?.name ?? `#${p.driver_number}`,
        team: od?.team_name ?? known?.teamName ?? "",
        color: od?.team_colour ? `#${od.team_colour}` : known?.color ?? "#8b93a7",
        tyre: st?.compound ?? null,
        tyreAge: st && lastLap ? (st.tyre_age_at_start ?? 0) + Math.max(0, lastLap.lap_number - st.lap_start) : null,
        laps: lastLap?.lap_number ?? null,
        gap: p.position === 1 ? "0.000" : fmtGap(iv?.gap_to_leader),
        interval: p.position === 1 ? "—" : fmtGap(iv?.interval),
        pitStops: pitCount.get(p.driver_number) ?? 0,
        lastLap: lastDone?.lap_duration ?? null,
        bestLap: myBest,
        hasFastestLap: myBest != null && overallBest != null && myBest <= overallBest + 1e-6,
        sectors,
        status: inPit ? "pit" : manyActive && !intervalsActive.has(p.driver_number) ? "stopped" : "running",
        photo: known?.photo ?? od?.headshot_url ?? null,
        x: locBy.get(p.driver_number)?.x ?? null,
        y: locBy.get(p.driver_number)?.y ?? null,
      } satisfies LiveCar;
    });

  const w = [...(d.weather ?? [])].sort((a, b) => Date.parse(b.date) - Date.parse(a.date))[0];
  const weather: LiveWeather | null = w
    ? { air: w.air_temperature ?? null, track: w.track_temperature ?? null, windSpeed: w.wind_speed ?? null, windDirection: w.wind_direction ?? null, humidity: w.humidity ?? null, rainfall: w.rainfall == null ? null : Number(w.rainfall) > 0, date: w.date }
    : null;

  // Event timeline: only things the provider actually reported.
  const nameOf = (n: number) => cars.find((c) => c.driverNumber === n)?.name ?? d.drivers!.find((x) => x.driver_number === n)?.full_name ?? `#${n}`;
  const events: ControlEvent[] = [];
  for (const m of d.rc ?? []) {
    const msg = String(m.message ?? "");
    const up = msg.toUpperCase();
    const kind: ControlEvent["kind"] = m.category === "SafetyCar" ? "safety" : m.flag ? "flag" : /PENALTY/.test(up) ? "penalty" : "info";
    events.push({ id: `rc-${m.date}-${msg}`, date: m.date, lap: m.lap_number ?? null, kind, text: msg });
  }
  for (const p of d.pit ?? []) events.push({ id: `pit-${p.date}-${p.driver_number}`, date: p.date, lap: p.lap_number ?? null, kind: "pit", text: `${nameOf(p.driver_number)} pits${p.pit_duration ? ` (${Number(p.pit_duration).toFixed(1)}s)` : ""}` });
  for (const o of d.overtakes ?? []) events.push({ id: `ot-${o.date}-${o.overtaking_driver_number}`, date: o.date, lap: null, kind: "overtake", text: `${nameOf(o.overtaking_driver_number)} overtakes ${nameOf(o.overtaken_driver_number)} for P${o.position}` });
  // fastest-lap progression
  let bestSoFar = Infinity;
  for (const l of [...laps].filter((x) => typeof x.lap_duration === "number" && x.date_start).sort((a, b) => Date.parse(a.date_start) - Date.parse(b.date_start))) {
    if (l.lap_duration < bestSoFar - 1e-6) {
      bestSoFar = l.lap_duration;
      const mm = Math.floor(l.lap_duration / 60);
      events.push({ id: `fl-${l.driver_number}-${l.lap_number}`, date: new Date(Date.parse(l.date_start) + l.lap_duration * 1000).toISOString(), lap: l.lap_number, kind: "fastest", text: `Fastest lap: ${nameOf(l.driver_number)} — ${mm}:${(l.lap_duration - mm * 60).toFixed(3).padStart(6, "0")}` });
    }
  }
  events.sort((a, b) => Date.parse(b.date) - Date.parse(a.date));

  let trackPoints: [number, number][] | null = null;
  try {
    const leader = cars[0]?.driverNumber;
    if (leader) {
      // Track outline from the best clean lap already driven in this session, if available.
      trackPoints = await circuitTrace(key, leader);
    }
  } catch {
    trackPoints = null;
  }

  const leaderLap = cars[0]?.laps ?? null;
  return {
    meta: buildMeta(),
    state: isStale ? "stale" : "live",
    reason: isStale ? "The provider has not delivered new data recently." : undefined,
    session: info,
    dataAsOf: new Date(dataAsOfMs).toISOString(),
    lap: leaderLap,
    trackStatus: trackStatus(d.rc ?? []),
    cars,
    weather,
    events: events.slice(0, 60),
    trackPoints,
    hasPositions: cars.some((c) => c.x != null),
  };
}
