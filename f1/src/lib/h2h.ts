import type { SeasonRound } from "@/types/f1";

export interface H2H {
  qualiA: number;
  qualiB: number;
  qualiShared: number;
  raceA: number;
  raceB: number;
  raceShared: number;
}

/** Head-to-head over rounds in which both drivers took part. Both-DNF races are not counted. */
export function headToHead(rounds: SeasonRound[], a: string, b: string): H2H {
  const out: H2H = { qualiA: 0, qualiB: 0, qualiShared: 0, raceA: 0, raceB: 0, raceShared: 0 };
  for (const r of rounds) {
    const qa = r.qualifying.find((q) => q.driverId === a);
    const qb = r.qualifying.find((q) => q.driverId === b);
    if (qa && qb) {
      out.qualiShared++;
      if (qa.position < qb.position) out.qualiA++;
      else out.qualiB++;
    }
    const ra = r.race.find((x) => x.driverId === a);
    const rb = r.race.find((x) => x.driverId === b);
    if (ra && rb) {
      const aOk = ra.finished && ra.position != null;
      const bOk = rb.finished && rb.position != null;
      if (!aOk && !bOk) continue;
      out.raceShared++;
      if (aOk && (!bOk || ra.position! < rb.position!)) out.raceA++;
      else out.raceB++;
    }
  }
  return out;
}
