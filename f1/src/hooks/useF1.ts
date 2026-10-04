"use client";
import { useMemo, useSyncExternalStore } from "react";
import useSWR, { type SWRConfiguration } from "swr";
import type { CareerStats, DriverProfile, LiveState, Overview, Race, RaceDetail, SeasonData } from "@/types/f1";

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

const fetcher = async <T,>(url: string): Promise<T> => {
  const res = await fetch(url, { headers: { accept: "application/json" } });
  if (!res.ok) throw new HttpError(res.status, `${res.status}`);
  return res.json();
};

const base: SWRConfiguration = { revalidateOnFocus: false, dedupingInterval: 10_000, errorRetryInterval: 5_000, keepPreviousData: true };

export const useOverview = () => useSWR<Overview>("/api/f1/overview", fetcher, { ...base, refreshInterval: 60_000 });
export const useSeason = () => useSWR<SeasonData>("/api/f1/season", fetcher, { ...base, refreshInterval: 5 * 60_000 });
export const useRace = (round: number | null) =>
  useSWR<RaceDetail>(round ? `/api/f1/race/${round}` : null, fetcher, { ...base, refreshInterval: 5 * 60_000 });
export const useCareer = (id: string | null) =>
  useSWR<DriverProfile>(id ? `/api/f1/drivers/${id}` : null, fetcher, { ...base, refreshInterval: 0, revalidateIfStale: false });

export function useLive(enabled: boolean) {
  return useSWR<LiveState>(enabled ? "/api/f1/live" : null, fetcher, {
    refreshInterval: enabled ? 5_000 : 0,
    revalidateOnFocus: true,
    dedupingInterval: 2_000,
    errorRetryInterval: 4_000,
    keepPreviousData: true,
  });
}

/* ── shared 1s clock ─────────────────────────────────────────── */
const listeners = new Set<() => void>();
let nowMs = 0;
let timer: ReturnType<typeof setInterval> | null = null;
const subscribe = (cb: () => void) => {
  listeners.add(cb);
  if (!timer) {
    nowMs = Date.now();
    timer = setInterval(() => {
      nowMs = Date.now();
      listeners.forEach((l) => l());
    }, 1000);
  }
  return () => {
    listeners.delete(cb);
    if (!listeners.size && timer) {
      clearInterval(timer);
      timer = null;
    }
  };
};
export const useNow = (): number => useSyncExternalStore(subscribe, () => nowMs || (nowMs = Date.now()), () => 0);

/* ── schedule helpers (the official timetable, not live data) ── */
export type RaceStatus = "upcoming" | "live" | "finished";
const RACE_WINDOW = 3.5 * 3600_000;
const SPRINT_WINDOW = 1.25 * 3600_000;

export function raceStatus(r: Race, now: number): RaceStatus {
  const start = r.race.iso ? Date.parse(r.race.iso) : Date.parse(`${r.race.date}T23:59:59Z`);
  if (now >= start && now <= start + RACE_WINDOW) return "live";
  if (r.sprint?.iso) {
    const s = Date.parse(r.sprint.iso);
    if (now >= s && now <= s + SPRINT_WINDOW) return "live";
  }
  return now > start + RACE_WINDOW ? "finished" : "upcoming";
}

export function liveSession(r: Race, now: number): "Race" | "Sprint" | null {
  const start = r.race.iso ? Date.parse(r.race.iso) : NaN;
  if (now >= start - 10 * 60_000 && now <= start + RACE_WINDOW) return "Race";
  if (r.sprint?.iso) {
    const s = Date.parse(r.sprint.iso);
    if (now >= s - 10 * 60_000 && now <= s + SPRINT_WINDOW) return "Sprint";
  }
  return null;
}

/** Which Grand Prix is current/next according to the timetable, and whether a Race/Sprint window is open. */
export function useSchedule(calendar: Race[] | undefined) {
  const now = useNow();
  return useMemo(() => {
    if (!calendar?.length || !now) return null;
    const live = calendar.find((r) => liveSession(r, now));
    const next = calendar.find((r) => raceStatus(r, now) !== "finished") ?? null;
    const current = live ?? next;
    return { now, current, liveRace: live ?? null, liveSessionName: live ? liveSession(live, now) : null, seasonOver: !current };
  }, [calendar, now]);
}

export type { CareerStats };
export { HttpError };
