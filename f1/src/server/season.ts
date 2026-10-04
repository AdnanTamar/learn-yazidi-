import { cached } from "./http";
import { config } from "./config";
import { fetchQualiByRound, fetchResultsByRound } from "./jolpica";
import { buildMeta, getCalendar } from "./overview";
import type { DriverSeasonStats, QualiRow, ResultRow, SeasonData, SeasonRound, TeamSeasonStats } from "@/types/f1";

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

/** Pure aggregation of per-round results into driver/team season statistics. */
export function aggregate(rounds: SeasonRound[]): { drivers: DriverSeasonStats[]; teams: TeamSeasonStats[] } {
  const drivers = new Map<string, DriverSeasonStats & { _q: number[]; _f: number[]; _cum: number }>();
  const teams = new Map<string, TeamSeasonStats & { _cum: number }>();
  const sorted = [...rounds].sort((a, b) => a.round - b.round);

  const driver = (id: string, teamId: string | null) => {
    let d = drivers.get(id);
    if (!d) {
      d = { driverId: id, teamId, races: 0, points: 0, wins: 0, podiums: 0, poles: 0, fastestLaps: 0, dnfs: 0, avgQuali: null, avgFinish: null, progression: [], form: [], _q: [], _f: [], _cum: 0 };
      drivers.set(id, d);
    }
    if (teamId) d.teamId = teamId;
    return d;
  };
  const team = (id: string) => {
    let t = teams.get(id);
    if (!t) {
      t = { teamId: id, points: 0, wins: 0, podiums: 0, poles: 0, progression: [], form: [], _cum: 0 };
      teams.set(id, t);
    }
    return t;
  };

  for (const r of sorted) {
    const roundPts = new Map<string, number>();
    const teamPts = new Map<string, number>();
    const add = (row: ResultRow) => {
      roundPts.set(row.driverId, (roundPts.get(row.driverId) ?? 0) + row.points);
      teamPts.set(row.teamId, (teamPts.get(row.teamId) ?? 0) + row.points);
    };
    for (const row of r.sprint) { driver(row.driverId, row.teamId); team(row.teamId); add(row); }

    const hasRace = r.race.length > 0;
    for (const row of r.race) {
      const d = driver(row.driverId, row.teamId);
      const t = team(row.teamId);
      add(row);
      d.races++;
      if (row.position === 1) { d.wins++; t.wins++; }
      if (row.position && row.position <= 3 && row.finished) { d.podiums++; t.podiums++; }
      if (row.fastestLap?.rank === 1) d.fastestLaps++;
      if (!row.finished) d.dnfs++;
      else if (row.position) d._f.push(row.position);
      d.form.push({ round: r.round, position: row.finished ? row.position : null, status: row.status });
      // Fallback pole detection if no qualifying table exists for the round.
      if (!r.qualifying.length && row.grid === 1) { d.poles++; t.poles++; }
    }
    for (const q of r.qualifying) {
      const d = driver(q.driverId, q.teamId);
      const t = team(q.teamId);
      d._q.push(q.position);
      if (q.position === 1) { d.poles++; t.poles++; }
    }
    if (hasRace || r.sprint.length) {
      for (const d of drivers.values()) {
        d._cum += roundPts.get(d.driverId) ?? 0;
        d.progression.push({ round: r.round, points: d._cum });
      }
      for (const t of teams.values()) {
        const p = teamPts.get(t.teamId) ?? 0;
        t._cum += p;
        t.progression.push({ round: r.round, points: t._cum });
        if (hasRace) t.form.push({ round: r.round, points: p });
      }
    }
  }

  const dOut = [...drivers.values()].map(({ _q, _f, _cum, ...d }) => ({
    ...d,
    points: _cum,
    avgQuali: avg(_q),
    avgFinish: avg(_f),
    form: d.form.slice(-5),
  }));
  const tOut = [...teams.values()].map(({ _cum, ...t }) => ({ ...t, points: _cum, form: t.form.slice(-5) }));
  return { drivers: dOut, teams: tOut };
}

export async function getSeasonData(): Promise<SeasonData & { _stale: boolean }> {
  const res = await cached("season-data", 10 * 60_000, async () => {
    const calendar = (await getCalendar()).value;
    const [results, sprints, quali] = await Promise.all([
      fetchResultsByRound(config.season, "results"),
      fetchResultsByRound(config.season, "sprint"),
      fetchQualiByRound(config.season),
    ]);
    const roundNumbers = new Set<number>([...results.keys(), ...sprints.keys(), ...quali.keys()]);
    const rounds: SeasonRound[] = [...roundNumbers].sort((a, b) => a - b).map((n) => ({
      round: n,
      race: results.get(n) ?? [],
      sprint: sprints.get(n) ?? [],
      qualifying: (quali.get(n) as QualiRow[] | undefined) ?? [],
    }));
    return { season: calendar[0]?.season ?? String(new Date().getFullYear()), rounds, ...aggregate(rounds) };
  });
  return { meta: buildMeta(res.stale, res.asOf), ...res.value, _stale: res.stale };
}
