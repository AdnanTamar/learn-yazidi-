import { cached } from "./http";
import { config, isMock } from "./config";
import { fetchCalendar, fetchDriverStandings, fetchTeamStandings, mapDriver, mapTeam, getAll } from "./jolpica";
import { latestDrivers } from "./openf1";
import { teamColor } from "@/lib/countries";
import type { Driver, Meta, Overview, Race, Team } from "@/types/f1";

export const buildMeta = (stale?: boolean, asOf?: number): Meta => ({
  generatedAt: new Date().toISOString(),
  source: isMock ? "mock" : "provider",
  ...(stale ? { stale: true, asOf: new Date(asOf ?? Date.now()).toISOString() } : {}),
});

export const getCalendar = () => cached<Race[]>(`calendar:${config.season}`, 60 * 60_000, () => fetchCalendar(config.season));

export async function getOverview(): Promise<Overview & { _stale: boolean; _asOf: number }> {
  const [cal, ds, ts, photos] = await Promise.all([
    getCalendar(),
    cached("standings:drivers", 2 * 60_000, () => fetchDriverStandings(config.season)),
    cached("standings:teams", 2 * 60_000, () => fetchTeamStandings(config.season)),
    cached("of:photos", 30 * 60_000, async () => {
      try {
        return await latestDrivers(config.season === "current" ? new Date().getFullYear() : config.season);
      } catch {
        return [];
      }
    }),
  ]);
  const calendar = cal.value;
  const season = calendar[0]?.season ?? String(new Date().getFullYear());

  const teams = new Map<string, Team>();
  const drivers = new Map<string, Driver>();

  for (const t of ts.value.rows) teams.set(t.teamId, { ...mapTeam(t.team), driverIds: [] });
  for (const s of ds.value.rows) {
    const d = mapDriver(s.driver);
    d.teamId = s.teamId;
    drivers.set(d.id, d);
    if (s.teamId) {
      if (!teams.has(s.teamId)) teams.set(s.teamId, { ...mapTeam(s.team), driverIds: [] });
      teams.get(s.teamId)!.driverIds.push(d.id);
    }
  }

  // Before the first race there are no standings yet: fall back to the entry list.
  if (!drivers.size) {
    const rows = await cached("entrylist", 30 * 60_000, () => getAll(`/${config.season}/drivers.json`, (m) => m.DriverTable.Drivers));
    for (const r of rows.value) drivers.set(r.driverId, mapDriver(r));
  }

  // Decorate with photos / team names / colours from OpenF1 (cosmetic, best effort).
  const of = photos.value;
  for (const d of drivers.values()) {
    const match = of.find((o) => d.number && o.driver_number === d.number) ?? of.find((o) => o.last_name?.toLowerCase() === d.lastName.toLowerCase());
    d.photo = match?.headshot_url ?? null;
    const team = d.teamId ? teams.get(d.teamId) : null;
    d.teamName = team?.name ?? match?.team_name ?? null;
    d.color = team?.color ?? (match?.team_colour ? `#${match.team_colour}` : teamColor(null));
  }

  const driverStandings = ds.value.rows.map(({ driver: _d, team: _t, ...s }) => s);
  const teamStandings = ts.value.rows.map(({ team: _t, ...s }) => s);
  const stale = ds.stale || ts.stale || cal.stale;
  return {
    meta: buildMeta(stale, Math.min(ds.asOf, ts.asOf, cal.asOf)),
    season,
    calendar,
    drivers: [...drivers.values()],
    teams: [...teams.values()],
    driverStandings,
    teamStandings,
    completedRounds: ds.value.round,
    _stale: stale,
    _asOf: Math.min(ds.asOf, ts.asOf),
  };
}
