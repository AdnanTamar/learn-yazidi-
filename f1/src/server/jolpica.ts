import { jolpicaFetch } from "./http";
import { config } from "./config";
import { countryCode, nationalityCode, teamColor } from "@/lib/countries";
import type {
  Driver, DriverStanding, QualiRow, Race, ResultRow, Session, Team, TeamStanding,
} from "@/types/f1";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Mr = { MRData: { total: string; limit: string; offset: string; [k: string]: any } };

const PAGE = 100;

/** Fetch every page of a Jolpica table, returning the concatenated array found under `pick`. */
export async function getAll(path: string, pick: (mr: any) => any[]): Promise<any[]> {
  const sep = path.includes("?") ? "&" : "?";
  const first = await jolpicaFetch<Mr>(`${path}${sep}limit=${PAGE}&offset=0`);
  const total = Number(first.MRData.total);
  const out: any[] = [...pick(first.MRData)];
  for (let off = PAGE; off < total; off += PAGE) {
    const next = await jolpicaFetch<Mr>(`${path}${sep}limit=${PAGE}&offset=${off}`);
    out.push(...pick(next.MRData));
  }
  return out;
}

/** Returns MRData.total for a filtered query (used for cheap career counters). */
export async function getTotal(path: string): Promise<number> {
  const sep = path.includes("?") ? "&" : "?";
  const r = await jolpicaFetch<Mr>(`${path}${sep}limit=1`);
  return Number(r.MRData.total);
}

const session = (date?: string, time?: string): Session | null =>
  date ? { date, time: time ?? null, iso: time ? `${date}T${time.endsWith("Z") ? time : time + "Z"}` : null } : null;

export function mapRace(r: any): Race {
  const sprintQ = r.SprintQualifying ?? r.SprintShootout;
  const practice: Race["practice"] = [];
  if (r.FirstPractice) practice.push({ key: "FP1", session: session(r.FirstPractice.date, r.FirstPractice.time)! });
  if (r.SecondPractice) practice.push({ key: "FP2", session: session(r.SecondPractice.date, r.SecondPractice.time)! });
  if (r.ThirdPractice) practice.push({ key: "FP3", session: session(r.ThirdPractice.date, r.ThirdPractice.time)! });
  const loc = r.Circuit?.Location ?? {};
  return {
    round: Number(r.round),
    season: String(r.season),
    name: r.raceName,
    circuitId: r.Circuit?.circuitId,
    circuitName: r.Circuit?.circuitName,
    locality: loc.locality ?? "",
    country: loc.country ?? "",
    countryCode: countryCode(loc.country),
    lat: loc.lat ? Number(loc.lat) : null,
    lng: loc.long ? Number(loc.long) : null,
    race: session(r.date, r.time)!,
    qualifying: session(r.Qualifying?.date, r.Qualifying?.time),
    sprint: session(r.Sprint?.date, r.Sprint?.time),
    sprintQualifying: session(sprintQ?.date, sprintQ?.time),
    practice,
    isSprint: Boolean(r.Sprint),
  };
}

export async function fetchCalendar(season: string): Promise<Race[]> {
  const rows = await getAll(`/${season}/races.json`, (m) => m.RaceTable.Races);
  return rows.map(mapRace);
}

export function mapDriver(d: any): Driver {
  return {
    id: d.driverId,
    number: d.permanentNumber ? Number(d.permanentNumber) : null,
    code: d.code ?? d.familyName?.slice(0, 3).toUpperCase(),
    firstName: d.givenName,
    lastName: d.familyName,
    name: `${d.givenName} ${d.familyName}`,
    nationality: d.nationality,
    countryCode: nationalityCode(d.nationality),
    dob: d.dateOfBirth ?? null,
    photo: null,
    teamId: null,
    teamName: null,
    color: "#8b93a7",
  };
}

export function mapTeam(c: any): Team {
  return {
    id: c.constructorId,
    name: c.name,
    nationality: c.nationality,
    countryCode: nationalityCode(c.nationality),
    color: teamColor(c.constructorId),
    driverIds: [],
  };
}

export async function fetchDriverStandings(season: string): Promise<{ round: number; rows: (DriverStanding & { driver: any; team: any })[] }> {
  const r = await jolpicaFetch<Mr>(`/${season}/driverstandings.json?limit=100`);
  const list = r.MRData.StandingsTable?.StandingsLists?.[0];
  const rows = (list?.DriverStandings ?? []).map((s: any) => ({
    position: Number(s.position ?? s.positionText),
    points: Number(s.points),
    wins: Number(s.wins),
    driverId: s.Driver.driverId,
    teamId: s.Constructors?.[s.Constructors.length - 1]?.constructorId ?? null,
    driver: s.Driver,
    team: s.Constructors?.[s.Constructors.length - 1] ?? null,
  }));
  return { round: Number(list?.round ?? 0), rows };
}

export async function fetchTeamStandings(season: string): Promise<{ rows: (TeamStanding & { team: any })[] }> {
  const r = await jolpicaFetch<Mr>(`/${season}/constructorstandings.json?limit=100`);
  const list = r.MRData.StandingsTable?.StandingsLists?.[0];
  return {
    rows: (list?.ConstructorStandings ?? []).map((s: any) => ({
      position: Number(s.position ?? s.positionText),
      points: Number(s.points),
      wins: Number(s.wins),
      teamId: s.Constructor.constructorId,
      team: s.Constructor,
    })),
  };
}

const CLASSIFIED = /^(Finished|\+\d+ Lap|Lapped)/i;

export function mapResult(x: any): ResultRow {
  const pos = Number(x.position);
  const finished = CLASSIFIED.test(x.status ?? "");
  return {
    position: Number.isFinite(pos) && x.positionText !== "R" && x.positionText !== "D" && x.positionText !== "W" ? pos : null,
    positionText: x.positionText,
    driverId: x.Driver.driverId,
    teamId: x.Constructor?.constructorId,
    number: x.number ? Number(x.number) : null,
    grid: Number(x.grid ?? 0),
    laps: Number(x.laps ?? 0),
    status: x.status ?? "",
    finished,
    time: x.Time?.time ?? null,
    points: Number(x.points ?? 0),
    fastestLap: x.FastestLap
      ? { rank: Number(x.FastestLap.rank), lap: x.FastestLap.lap ? Number(x.FastestLap.lap) : null, time: x.FastestLap.Time?.time ?? null }
      : null,
  };
}

export function mapQuali(x: any): QualiRow {
  return {
    position: Number(x.position),
    driverId: x.Driver.driverId,
    teamId: x.Constructor?.constructorId,
    number: x.number ? Number(x.number) : null,
    q1: x.Q1 || null,
    q2: x.Q2 || null,
    q3: x.Q3 || null,
  };
}

/** Race/sprint results grouped by round. */
export async function fetchResultsByRound(season: string, kind: "results" | "sprint") {
  const races = await getAll(`/${season}/${kind}.json`, (m) => m.RaceTable.Races);
  const byRound = new Map<number, ResultRow[]>();
  for (const r of races) {
    const key = Number(r.round);
    const rows = (r.Results ?? r.SprintResults ?? []).map(mapResult);
    byRound.set(key, [...(byRound.get(key) ?? []), ...rows]);
  }
  return byRound;
}

export async function fetchQualiByRound(season: string) {
  const races = await getAll(`/${season}/qualifying.json`, (m) => m.RaceTable.Races);
  const byRound = new Map<number, QualiRow[]>();
  for (const r of races) {
    const key = Number(r.round);
    byRound.set(key, [...(byRound.get(key) ?? []), ...(r.QualifyingResults ?? []).map(mapQuali)]);
  }
  return byRound;
}

export const resolveSeason = (s: string) => s;
export { config };
