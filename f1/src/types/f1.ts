export interface Meta {
  /** ISO time the payload was assembled on the server. */
  generatedAt: string;
  /** "live" provider data, or "mock" when running against the dev mock server. */
  source: "provider" | "mock";
  /** True when the upstream failed and the last good payload is being served. */
  stale?: boolean;
  /** ISO time of the last successful upstream fetch (for stale payloads). */
  asOf?: string;
}

export interface Driver {
  id: string;
  number: number | null;
  code: string;
  firstName: string;
  lastName: string;
  name: string;
  nationality: string;
  countryCode: string | null;
  dob: string | null;
  photo: string | null;
  teamId: string | null;
  teamName: string | null;
  color: string;
}

export interface Team {
  id: string;
  name: string;
  nationality: string;
  countryCode: string | null;
  color: string;
  driverIds: string[];
}

export interface Session {
  date: string; // YYYY-MM-DD
  time: string | null; // HH:MM:SSZ
  iso: string | null; // full ISO instant when time is known
}

export interface Race {
  round: number;
  season: string;
  name: string;
  circuitId: string;
  circuitName: string;
  locality: string;
  country: string;
  countryCode: string | null;
  lat: number | null;
  lng: number | null;
  race: Session;
  qualifying: Session | null;
  sprint: Session | null;
  sprintQualifying: Session | null;
  practice: { key: "FP1" | "FP2" | "FP3"; session: Session }[];
  isSprint: boolean;
}

export interface DriverStanding {
  position: number;
  points: number;
  wins: number;
  driverId: string;
  teamId: string | null;
}

export interface TeamStanding {
  position: number;
  points: number;
  wins: number;
  teamId: string;
}

export interface ResultRow {
  position: number | null; // null when not classified
  positionText: string;
  driverId: string;
  teamId: string;
  number: number | null;
  grid: number;
  laps: number;
  status: string;
  finished: boolean; // classified (finished or lapped)
  time: string | null;
  points: number;
  fastestLap: { rank: number; lap: number | null; time: string | null } | null;
}

export interface QualiRow {
  position: number;
  driverId: string;
  teamId: string;
  number: number | null;
  q1: string | null;
  q2: string | null;
  q3: string | null;
  laps?: number | null;
}

export interface SeasonRound {
  round: number;
  race: ResultRow[];
  sprint: ResultRow[];
  qualifying: QualiRow[];
}

export interface DriverSeasonStats {
  driverId: string;
  teamId: string | null;
  races: number;
  points: number;
  wins: number;
  podiums: number;
  poles: number;
  fastestLaps: number;
  dnfs: number;
  avgQuali: number | null;
  avgFinish: number | null;
  /** Cumulative championship points after each completed round. */
  progression: { round: number; points: number }[];
  /** Last results (most recent last): finishing position or null for DNF. */
  form: { round: number; position: number | null; status: string }[];
}

export interface TeamSeasonStats {
  teamId: string;
  points: number;
  wins: number;
  podiums: number;
  poles: number;
  progression: { round: number; points: number }[];
  form: { round: number; points: number }[];
}

export interface Overview {
  meta: Meta;
  season: string;
  calendar: Race[];
  drivers: Driver[];
  teams: Team[];
  driverStandings: DriverStanding[];
  teamStandings: TeamStanding[];
  completedRounds: number;
}

export interface SeasonData {
  meta: Meta;
  season: string;
  rounds: SeasonRound[];
  drivers: DriverSeasonStats[];
  teams: TeamSeasonStats[];
}

export interface CareerStats {
  driverId: string;
  races: number | null;
  wins: number | null;
  podiums: number | null;
  poles: number | null;
  championships: number | null;
  championshipYears: string[];
  seasonsActive: string[];
}

export interface DriverProfile {
  meta: Meta;
  career: CareerStats;
}

export interface ControlEvent {
  id: string;
  date: string;
  lap: number | null;
  kind: "flag" | "safety" | "pit" | "fastest" | "overtake" | "info" | "penalty";
  text: string;
}

export interface RaceExtras {
  safetyCars: number | null;
  virtualSafetyCars: number | null;
  redFlags: number | null;
  penalties: { lap: number | null; text: string }[] | null;
  trackPoints: [number, number][] | null;
  sessionKey: number | null;
}

export interface RaceDetail {
  meta: Meta;
  race: Race;
  results: ResultRow[];
  qualifying: QualiRow[];
  sprint: ResultRow[];
  sprintQualifying: QualiRow[];
  extras: RaceExtras;
}

export type TrackStatus = "green" | "yellow" | "sc" | "vsc" | "red" | "chequered" | "unknown";

export interface LiveCar {
  driverNumber: number;
  position: number;
  driverId: string | null;
  code: string;
  name: string;
  team: string;
  color: string;
  tyre: string | null;
  tyreAge: number | null;
  laps: number | null;
  gap: string | null;
  interval: string | null;
  pitStops: number;
  lastLap: number | null;
  bestLap: number | null;
  hasFastestLap: boolean;
  sectors: { time: number | null; tone: "purple" | "green" | "yellow" | "none" }[];
  status: "running" | "pit" | "stopped";
  photo: string | null;
  x?: number | null;
  y?: number | null;
}

export interface LiveWeather {
  air: number | null;
  track: number | null;
  windSpeed: number | null;
  windDirection: number | null;
  humidity: number | null;
  rainfall: boolean | null;
  date: string;
}

export interface LiveState {
  meta: Meta;
  /**
   * live         – session running and data is fresh
   * stale        – session running but the provider stopped updating
   * unavailable  – session should be running but the provider returned nothing / refused
   * idle         – nothing scheduled right now
   * ended        – the provider reports that the session has finished
   */
  state: "live" | "stale" | "unavailable" | "idle" | "ended";
  reason?: string;
  session: { key: number; name: string; type: string; start: string; end: string; circuit: string } | null;
  /** ISO time of the newest record the provider delivered. */
  dataAsOf: string | null;
  lap: number | null;
  trackStatus: TrackStatus;
  cars: LiveCar[];
  weather: LiveWeather | null;
  events: ControlEvent[];
  trackPoints: [number, number][] | null;
  hasPositions: boolean;
}
