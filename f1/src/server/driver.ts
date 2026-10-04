import { cached } from "./http";
import { config } from "./config";
import { getAll, getTotal } from "./jolpica";
import { buildMeta } from "./overview";
import type { DriverProfile } from "@/types/f1";

const safe = async <T>(p: Promise<T>): Promise<T | null> => {
  try {
    return await p;
  } catch {
    return null;
  }
};

/** Career counters from the Ergast-compatible history tables. Values are null when the provider cannot answer. */
export async function getDriverProfile(id: string): Promise<DriverProfile> {
  const res = await cached(`career:${id}`, 24 * 3600_000, async () => {
    const base = `/drivers/${encodeURIComponent(id)}`;
    const races = await getTotal(`${base}/results.json`);
    const wins = await safe(getTotal(`${base}/results/1.json`));
    const p2 = await safe(getTotal(`${base}/results/2.json`));
    const p3 = await safe(getTotal(`${base}/results/3.json`));
    const poles = await safe(getTotal(`${base}/qualifying/1.json`));
    const titles = await safe(getAll(`${base}/driverstandings/1.json`, (m) => m.StandingsTable.StandingsLists));
    const seasons = await safe(getAll(`${base}/seasons.json`, (m) => m.SeasonTable.Seasons));
    const current = String(new Date().getFullYear());
    const years = (titles ?? []).map((l) => String(l.season)).filter((y) => y !== current && y !== config.season);
    return {
      driverId: id,
      races,
      wins,
      podiums: wins !== null && p2 !== null && p3 !== null ? wins + p2 + p3 : null,
      poles,
      championships: titles ? years.length : null,
      championshipYears: years,
      seasonsActive: (seasons ?? []).map((s) => String(s.season)),
    };
  });
  return { meta: buildMeta(res.stale, res.asOf), career: res.value };
}
