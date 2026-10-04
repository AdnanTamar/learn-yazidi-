import { cached, jolpicaFetch, openf1Fetch } from "./http";
import { mapQuali, mapResult } from "./jolpica";
import { buildMeta, getCalendar, getOverview } from "./overview";
import { circuitTrace, matchSession, ofSessions } from "./openf1";
import type { QualiRow, RaceDetail, RaceExtras, ResultRow } from "@/types/f1";

/* eslint-disable @typescript-eslint/no-explicit-any */
const ISO_DURATION = (s: number) => {
  const m = Math.floor(s / 60);
  return `${m}:${(s - m * 60).toFixed(3).padStart(6, "0")}`;
};

async function table<T>(path: string, pick: (m: any) => T[]): Promise<T[]> {
  try {
    const r: any = await jolpicaFetch(path);
    return pick(r.MRData);
  } catch {
    return [];
  }
}

async function extrasFor(raceDate: string, year: number): Promise<RaceExtras> {
  const empty: RaceExtras = { safetyCars: null, virtualSafetyCars: null, redFlags: null, penalties: null, trackPoints: null, sessionKey: null };
  try {
    const session = matchSession(await ofSessions(year), raceDate, ["Race"]);
    if (!session) return empty;
    const msgs = await cached(`of:rc:${session.session_key}`, 30 * 60_000, () => openf1Fetch<any[]>("race_control", { session_key: session.session_key }));
    const rc = msgs.value;
    const upper = (m: any) => String(m.message ?? "").toUpperCase();
    return {
      ...empty,
      sessionKey: session.session_key,
      safetyCars: rc.filter((m) => m.category === "SafetyCar" && /SAFETY CAR DEPLOYED/.test(upper(m)) && !/VIRTUAL/.test(upper(m))).length,
      virtualSafetyCars: rc.filter((m) => /VIRTUAL SAFETY CAR DEPLOYED/.test(upper(m))).length,
      redFlags: rc.filter((m) => m.flag === "RED").length,
      penalties: rc.filter((m) => /PENALTY/.test(upper(m)) && !/NO FURTHER|REVIEWED|NO INVESTIGATION/.test(upper(m))).map((m) => ({ lap: m.lap_number ?? null, text: m.message })),
    };
  } catch {
    return empty;
  }
}

async function sessionResultFor(date: string, year: number, names: string[]) {
  try {
    const s = matchSession(await ofSessions(year), date, names);
    if (!s) return null;
    const { value } = await cached(`of:sr:${s.session_key}`, 30 * 60_000, () => openf1Fetch<any[]>("session_result", { session_key: s.session_key }));
    const drivers = await cached(`of:dr:${s.session_key}`, 6 * 3600_000, () => openf1Fetch<any[]>("drivers", { session_key: s.session_key }));
    return { value: Array.isArray(value) ? value : [], drivers: drivers.value };
  } catch {
    return null;
  }
}

export async function getRaceDetail(round: number): Promise<RaceDetail | null> {
  const cal = await getCalendar();
  const race = cal.value.find((r) => r.round === round);
  if (!race) return null;
  const finished = race.race.iso ? Date.parse(race.race.iso) + 3 * 3600_000 < Date.now() : false;
  const ttl = finished ? 30 * 60_000 : 60_000;
  const year = Number(race.season);

  const res = await cached(`race:${round}`, ttl, async () => {
    const [results, qualifying, sprint] = await Promise.all([
      table<ResultRow>(`/${race.season}/${round}/results.json`, (m) => (m.RaceTable.Races[0]?.Results ?? []).map(mapResult)),
      table<QualiRow>(`/${race.season}/${round}/qualifying.json`, (m) => (m.RaceTable.Races[0]?.QualifyingResults ?? []).map(mapQuali)),
      race.isSprint ? table<ResultRow>(`/${race.season}/${round}/sprint.json`, (m) => (m.RaceTable.Races[0]?.SprintResults ?? []).map(mapResult)) : Promise.resolve([] as ResultRow[]),
    ]);

    // Sprint qualifying is not part of the Ergast tables: take it from OpenF1's session_result when present.
    let sprintQualifying: QualiRow[] = [];
    if (race.isSprint && race.sprintQualifying) {
      const sr = await sessionResultFor(race.sprintQualifying.date, year, ["Sprint Qualifying", "Sprint Shootout"]);
      if (sr) {
        const known = (await getOverview()).drivers;
        sprintQualifying = sr.value
          .filter((r: any) => r.position)
          .map((r: any) => {
            const d = sr.drivers.find((x: any) => x.driver_number === r.driver_number);
            const dur: (number | null)[] = Array.isArray(r.duration) ? r.duration : [r.duration];
            const fmt = (n: number | null | undefined) => (typeof n === "number" ? ISO_DURATION(n) : null);
            return {
              position: r.position,
              driverId: known.find((k) => k.number === r.driver_number)?.id ?? String(d?.last_name ?? r.driver_number).toLowerCase(),
              teamId: known.find((k) => k.number === r.driver_number)?.teamId ?? "",
              number: r.driver_number,
              q1: fmt(dur[0]),
              q2: fmt(dur[1]),
              q3: fmt(dur[2]),
              laps: r.number_of_laps ?? null,
            } as QualiRow;
          });
      }
    }

    // Number of laps set in qualifying (OpenF1 only).
    if (qualifying.length && race.qualifying) {
      const sr = await sessionResultFor(race.qualifying.date, year, ["Qualifying"]);
      if (sr) for (const q of qualifying) q.laps = sr.value.find((r: any) => r.driver_number === q.number)?.number_of_laps ?? null;
    }

    const extras = await extrasFor(race.race.date, year);
    const winner = results.find((r) => r.position === 1)?.number;
    if (extras.sessionKey && winner) {
      try {
        extras.trackPoints = await circuitTrace(extras.sessionKey, winner);
      } catch {
        extras.trackPoints = null;
      }
    }
    return { results, qualifying, sprint, sprintQualifying, extras };
  });

  return { meta: buildMeta(res.stale, res.asOf), race, ...res.value };
}
