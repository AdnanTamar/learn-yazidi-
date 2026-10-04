"use client";
import { useMemo } from "react";
import { useOverview, useSeason } from "@/hooks/useF1";
import type { Driver, DriverSeasonStats, DriverStanding, Overview, Team, TeamSeasonStats, TeamStanding } from "@/types/f1";

export interface DriverRow {
  driver: Driver;
  position: number;
  points: number;
  wins: number;
  stats?: DriverSeasonStats;
}
export interface TeamRow {
  team: Team;
  position: number;
  points: number;
  wins: number;
  stats?: TeamSeasonStats;
  drivers: Driver[];
}

export function buildLookups(o: Overview | undefined) {
  const drivers = new Map<string, Driver>();
  const teams = new Map<string, Team>();
  o?.drivers.forEach((d) => drivers.set(d.id, d));
  o?.teams.forEach((t) => teams.set(t.id, t));
  return { drivers, teams };
}

/** Driver standings enriched with season aggregates once they have loaded. */
export function useDriverRows() {
  const overview = useOverview();
  const season = useSeason();
  return useMemo(() => {
    const o = overview.data;
    if (!o) return { rows: undefined as DriverRow[] | undefined, overview, season };
    const { drivers } = buildLookups(o);
    const stats = new Map(season.data?.drivers.map((s) => [s.driverId, s]));
    const standings: (DriverStanding | { position: number; points: number; wins: number; driverId: string; teamId: null })[] = o.driverStandings.length
      ? o.driverStandings
      : o.drivers.map((d, i) => ({ position: i + 1, points: 0, wins: 0, driverId: d.id, teamId: null }));
    const rows = standings
      .map((s) => ({ driver: drivers.get(s.driverId)!, position: s.position, points: s.points, wins: s.wins, stats: stats.get(s.driverId) }))
      .filter((r) => r.driver);
    return { rows, overview, season };
  }, [overview, season]);
}

export function useTeamRows() {
  const overview = useOverview();
  const season = useSeason();
  return useMemo(() => {
    const o = overview.data;
    if (!o) return { rows: undefined as TeamRow[] | undefined, overview, season };
    const { drivers, teams } = buildLookups(o);
    const stats = new Map(season.data?.teams.map((s) => [s.teamId, s]));
    const standings: TeamStanding[] = o.teamStandings.length ? o.teamStandings : o.teams.map((t, i) => ({ position: i + 1, points: 0, wins: 0, teamId: t.id }));
    const rows = standings
      .map((s) => {
        const team = teams.get(s.teamId)!;
        return { team, position: s.position, points: s.points, wins: s.wins, stats: stats.get(s.teamId), drivers: team?.driverIds.map((id) => drivers.get(id)!).filter(Boolean) ?? [] };
      })
      .filter((r) => r.team);
    return { rows, overview, season };
  }, [overview, season]);
}
