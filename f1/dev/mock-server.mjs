/**
 * DEV ONLY – a tiny stand-in for Jolpica (Ergast) and OpenF1 so the UI can be
 * developed offline. All values are synthetic demo data (flagged "mock" in the UI).
 *   MOCK_LIVE=1  → pretends the next Grand Prix is running right now.
 *   MOCK_LIVE=down → pretends it is running but the live provider refuses requests.
 */
import http from "node:http";

const PORT = 4010;
const LIVE = process.env.MOCK_LIVE || "";
const NOW = Date.now();
const YEAR = 2026;

let seed = 42;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);

const TEAMS = [
  ["mclaren", "McLaren", "British"], ["ferrari", "Ferrari", "Italian"], ["mercedes", "Mercedes", "German"],
  ["red_bull", "Red Bull", "Austrian"], ["racing_bulls", "Racing Bulls", "Italian"], ["aston_martin", "Aston Martin", "British"],
  ["williams", "Williams", "British"], ["alpine", "Alpine F1 Team", "French"], ["haas", "Haas F1 Team", "American"],
  ["audi", "Audi", "German"], ["cadillac", "Cadillac F1 Team", "American"],
];
const DRIVERS = [
  ["norris", "Lando", "Norris", "NOR", 1, "British", "mclaren", "1999-11-13"], ["piastri", "Oscar", "Piastri", "PIA", 81, "Australian", "mclaren", "2001-04-06"],
  ["leclerc", "Charles", "Leclerc", "LEC", 16, "Monegasque", "ferrari", "1997-10-16"], ["hamilton", "Lewis", "Hamilton", "HAM", 44, "British", "ferrari", "1985-01-07"],
  ["russell", "George", "Russell", "RUS", 63, "British", "mercedes", "1998-02-15"], ["antonelli", "Kimi", "Antonelli", "ANT", 12, "Italian", "mercedes", "2006-08-25"],
  ["max_verstappen", "Max", "Verstappen", "VER", 3, "Dutch", "red_bull", "1997-09-30"], ["hadjar", "Isack", "Hadjar", "HAD", 6, "French", "red_bull", "2004-09-28"],
  ["lawson", "Liam", "Lawson", "LAW", 30, "New Zealander", "racing_bulls", "2002-02-11"], ["lindblad", "Arvid", "Lindblad", "LIN", 41, "British", "racing_bulls", "2007-08-08"],
  ["alonso", "Fernando", "Alonso", "ALO", 14, "Spanish", "aston_martin", "1981-07-29"], ["stroll", "Lance", "Stroll", "STR", 18, "Canadian", "aston_martin", "1998-10-29"],
  ["albon", "Alexander", "Albon", "ALB", 23, "Thai", "williams", "1996-03-23"], ["sainz", "Carlos", "Sainz", "SAI", 55, "Spanish", "williams", "1994-09-01"],
  ["gasly", "Pierre", "Gasly", "GAS", 10, "French", "alpine", "1996-02-07"], ["colapinto", "Franco", "Colapinto", "COL", 43, "Argentine", "alpine", "2003-05-27"],
  ["ocon", "Esteban", "Ocon", "OCO", 31, "French", "haas", "1996-09-17"], ["bearman", "Oliver", "Bearman", "BEA", 87, "British", "haas", "2005-05-08"],
  ["hulkenberg", "Nico", "Hülkenberg", "HUL", 27, "German", "audi", "1987-08-19"], ["bortoleto", "Gabriel", "Bortoleto", "BOR", 5, "Brazilian", "audi", "2004-10-14"],
  ["perez", "Sergio", "Pérez", "PER", 11, "Mexican", "cadillac", "1990-01-26"], ["bottas", "Valtteri", "Bottas", "BOT", 77, "Finnish", "cadillac", "1989-08-28"],
];
const team = (id) => TEAMS.find((t) => t[0] === id);
const strength = Object.fromEntries(DRIVERS.map((d, i) => [d[0], 1 - i * 0.032 + (rnd() - 0.5) * 0.07]));

// [name, locality, country, circuitId, circuitName, date, sprint, lat, lng]
const CAL = [
  ["Australian Grand Prix", "Melbourne", "Australia", "albert_park", "Albert Park Grand Prix Circuit", "03-08", 0, -37.85, 144.97],
  ["Chinese Grand Prix", "Shanghai", "China", "shanghai", "Shanghai International Circuit", "03-15", 1, 31.34, 121.22],
  ["Japanese Grand Prix", "Suzuka", "Japan", "suzuka", "Suzuka Circuit", "03-29", 0, 34.84, 136.54],
  ["Bahrain Grand Prix", "Sakhir", "Bahrain", "bahrain", "Bahrain International Circuit", "04-12", 0, 26.03, 50.51],
  ["Saudi Arabian Grand Prix", "Jeddah", "Saudi Arabia", "jeddah", "Jeddah Corniche Circuit", "04-19", 0, 21.63, 39.10],
  ["Miami Grand Prix", "Miami", "USA", "miami", "Miami International Autodrome", "05-03", 1, 25.96, -80.24],
  ["Canadian Grand Prix", "Montreal", "Canada", "villeneuve", "Circuit Gilles Villeneuve", "05-24", 1, 45.5, -73.52],
  ["Monaco Grand Prix", "Monte-Carlo", "Monaco", "monaco", "Circuit de Monaco", "06-07", 0, 43.73, 7.42],
  ["Barcelona Grand Prix", "Montmeló", "Spain", "catalunya", "Circuit de Barcelona-Catalunya", "06-14", 0, 41.57, 2.26],
  ["Austrian Grand Prix", "Spielberg", "Austria", "red_bull_ring", "Red Bull Ring", "06-28", 0, 47.22, 14.76],
  ["British Grand Prix", "Silverstone", "UK", "silverstone", "Silverstone Circuit", "07-05", 1, 52.07, -1.02],
  ["Belgian Grand Prix", "Spa", "Belgium", "spa", "Circuit de Spa-Francorchamps", "07-19", 0, 50.44, 5.97],
  ["Hungarian Grand Prix", "Budapest", "Hungary", "hungaroring", "Hungaroring", "07-26", 0, 47.58, 19.25],
  ["Dutch Grand Prix", "Zandvoort", "Netherlands", "zandvoort", "Circuit Park Zandvoort", "08-23", 1, 52.39, 4.54],
  ["Italian Grand Prix", "Monza", "Italy", "monza", "Autodromo Nazionale di Monza", "09-06", 0, 45.62, 9.28],
  ["Spanish Grand Prix", "Madrid", "Spain", "madring", "Madring", "09-13", 0, 40.46, -3.61],
  ["Azerbaijan Grand Prix", "Baku", "Azerbaijan", "baku", "Baku City Circuit", "09-26", 0, 40.37, 49.85],
  ["Singapore Grand Prix", "Marina Bay", "Singapore", "marina_bay", "Marina Bay Street Circuit", "10-11", 1, 1.29, 103.86],
  ["United States Grand Prix", "Austin", "USA", "americas", "Circuit of the Americas", "10-25", 0, 30.13, -97.64],
  ["Mexico City Grand Prix", "Mexico City", "Mexico", "rodriguez", "Autódromo Hermanos Rodríguez", "11-01", 0, 19.4, -99.09],
  ["São Paulo Grand Prix", "São Paulo", "Brazil", "interlagos", "Autódromo José Carlos Pace", "11-08", 0, -23.7, -46.7],
  ["Las Vegas Grand Prix", "Las Vegas", "USA", "vegas", "Las Vegas Strip Circuit", "11-21", 0, 36.11, -115.17],
  ["Qatar Grand Prix", "Lusail", "Qatar", "losail", "Losail International Circuit", "11-29", 0, 25.49, 51.45],
  ["Abu Dhabi Grand Prix", "Abu Dhabi", "UAE", "yas_marina", "Yas Marina Circuit", "12-06", 0, 24.47, 54.6],
];

const day = (md, off = 0) => { const d = new Date(`${YEAR}-${md}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + off); return d.toISOString().slice(0, 10); };
const races = CAL.map((c, i) => {
  const raceStart = c[0] === "Singapore Grand Prix" && LIVE ? NOW - 35 * 60_000 : null;
  const date = raceStart ? new Date(raceStart).toISOString().slice(0, 10) : day(c[5]);
  const time = raceStart ? new Date(raceStart).toISOString().slice(11, 19) + "Z" : "13:00:00Z";
  const r = {
    season: String(YEAR), round: String(i + 1), raceName: c[0], date, time,
    Circuit: { circuitId: c[3], circuitName: c[4], Location: { lat: String(c[7]), long: String(c[8]), locality: c[1], country: c[2] } },
  };
  if (c[6]) {
    r.SprintQualifying = { date: day(c[5], -2), time: "10:30:00Z" };
    r.Sprint = { date: day(c[5], -1), time: "11:00:00Z" };
    r.Qualifying = { date: day(c[5], -1), time: "15:00:00Z" };
    r.FirstPractice = { date: day(c[5], -2), time: "09:30:00Z" };
  } else {
    r.FirstPractice = { date: day(c[5], -2), time: "11:30:00Z" };
    r.SecondPractice = { date: day(c[5], -2), time: "15:00:00Z" };
    r.ThirdPractice = { date: day(c[5], -1), time: "10:30:00Z" };
    r.Qualifying = { date: day(c[5], -1), time: "14:00:00Z" };
  }
  return r;
});
const finished = (r) => Date.parse(`${r.date}T${r.time}`) + 2 * 3600_000 < NOW;
const DONE = races.filter(finished);
const RACE_PTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
const SPR_PTS = [8, 7, 6, 5, 4, 3, 2, 1];

const fmt = (s) => { const m = Math.floor(s / 60); return `${m}:${(s - m * 60).toFixed(3).padStart(6, "0")}`; };
const dObj = (d) => ({ driverId: d[0], permanentNumber: String(d[4]), code: d[3], givenName: d[1], familyName: d[2], dateOfBirth: d[7], nationality: d[5] });
const cObj = (id) => ({ constructorId: id, name: team(id)[1], nationality: team(id)[2] });

const resultsByRound = {}, sprintByRound = {}, qualiByRound = {};
for (const r of DONE) {
  const n = Number(r.round);
  const order = DRIVERS.map((d) => ({ d, s: strength[d[0]] + (rnd() - 0.5) * 0.45 })).sort((a, b) => b.s - a.s);
  const quali = DRIVERS.map((d) => ({ d, s: strength[d[0]] + (rnd() - 0.5) * 0.3 })).sort((a, b) => b.s - a.s);
  const base = 78 + (n % 7) * 3;
  qualiByRound[n] = quali.map((q, i) => {
    const t = base + i * 0.07 + rnd() * 0.05;
    return { number: String(q.d[4]), position: String(i + 1), Driver: dObj(q.d), Constructor: cObj(q.d[6]), Q1: fmt(t + 0.9), ...(i < 16 ? { Q2: fmt(t + 0.4) } : {}), ...(i < 10 ? { Q3: fmt(t) } : {}) };
  });
  const dnf = new Set(order.filter(() => rnd() < 0.06).map((o) => o.d[0]));
  const laps = 50 + (n % 5) * 3;
  const fl = order[Math.floor(rnd() * 8)].d[0];
  let cls = 0;
  resultsByRound[n] = order.map((o, i) => {
    const out = dnf.has(o.d[0]) && i > 2;
    if (!out) cls++;
    const g = quali.findIndex((q) => q.d[0] === o.d[0]) + 1;
    return {
      number: String(o.d[4]), position: String(i + 1), positionText: out ? "R" : String(i + 1),
      points: out || i >= 10 ? "0" : String(RACE_PTS[i]), Driver: dObj(o.d), Constructor: cObj(o.d[6]),
      grid: String(g), laps: String(out ? Math.floor(laps * 0.4) : laps), status: out ? "Engine" : i > 14 ? "+1 Lap" : "Finished",
      ...(out ? {} : { Time: { millis: "0", time: i === 0 ? `1:3${n % 10}:12.${100 + i}` : `+${(i * 4.1 + rnd() * 2).toFixed(3)}` } }),
      FastestLap: { rank: o.d[0] === fl ? "1" : String(2 + i), lap: String(Math.floor(laps * 0.7)), Time: { time: fmt(base - 1 + i * 0.03) } },
    };
  });
  if (r.Sprint) {
    const so = DRIVERS.map((d) => ({ d, s: strength[d[0]] + (rnd() - 0.5) * 0.4 })).sort((a, b) => b.s - a.s);
    sprintByRound[n] = so.map((o, i) => ({
      number: String(o.d[4]), position: String(i + 1), positionText: String(i + 1), points: i < 8 ? String(SPR_PTS[i]) : "0",
      Driver: dObj(o.d), Constructor: cObj(o.d[6]), grid: String(i + 1), laps: "19", status: "Finished", Time: { time: i === 0 ? "31:10.4" : `+${(i * 2.2).toFixed(3)}` },
    }));
  }
}

const driverTable = () => DRIVERS.map((d) => {
  let pts = 0, wins = 0;
  for (const r of DONE) {
    const n = Number(r.round);
    for (const x of resultsByRound[n]) if (x.Driver.driverId === d[0]) { pts += Number(x.points); if (x.position === "1") wins++; }
    for (const x of sprintByRound[n] ?? []) if (x.Driver.driverId === d[0]) pts += Number(x.points);
  }
  return { d, pts, wins };
}).sort((a, b) => b.pts - a.pts);
const teamTable = () => TEAMS.map((t) => {
  const ds = driverTable().filter((x) => x.d[6] === t[0]);
  return { t, pts: ds.reduce((a, b) => a + b.pts, 0), wins: ds.reduce((a, b) => a + b.wins, 0) };
}).sort((a, b) => b.pts - a.pts);

const mr = (extra, total = 1, offset = 0, limit = 30) => ({ MRData: { series: "f1", limit: String(limit), offset: String(offset), total: String(total), ...extra } });
const page = (arr, q) => { const l = Number(q.get("limit") ?? 30), o = Number(q.get("offset") ?? 0); return [arr.slice(o, o + l), arr.length, o, l]; };

function jolpica(path, q) {
  const parts = path.replace(/\.json$/, "").split("/").filter(Boolean);
  const kind = parts.filter((p) => !/^\d+$/.test(p) && p !== "current").at(-1);
  const round = parts.find((p, i) => i > 0 && /^\d{1,2}$/.test(p));
  const scope = parts[0] === "drivers" ? "career" : "season";
  if (scope === "career") {
    const sub = parts[2], filter = parts[3];
    const total = sub === "seasons" ? 14 : sub === "driverstandings" ? 2 : filter ? 20 : 250;
    if (sub === "seasons") return mr({ SeasonTable: { Seasons: Array.from({ length: 14 }, (_, i) => ({ season: String(2013 + i) })) } }, 14);
    if (sub === "driverstandings") return mr({ StandingsTable: { StandingsLists: [{ season: "2021" }, { season: "2024" }] } }, 2);
    return mr({ RaceTable: { Races: [] } }, total);
  }
  const [filtered] = [0];
  void filtered;
  if (kind === "races") { const [a, t, o, l] = page(races, q); return mr({ RaceTable: { Races: a } }, t, o, l); }
  if (kind === "driverstandings") {
    const rows = driverTable().map((x, i) => ({ position: String(i + 1), positionText: String(i + 1), points: String(x.pts), wins: String(x.wins), Driver: dObj(x.d), Constructors: [cObj(x.d[6])] }));
    return mr({ StandingsTable: { season: String(YEAR), StandingsLists: [{ season: String(YEAR), round: String(DONE.length), DriverStandings: rows }] } }, 1);
  }
  if (kind === "constructorstandings") {
    const rows = teamTable().map((x, i) => ({ position: String(i + 1), positionText: String(i + 1), points: String(x.pts), wins: String(x.wins), Constructor: cObj(x.t[0]) }));
    return mr({ StandingsTable: { season: String(YEAR), StandingsLists: [{ season: String(YEAR), round: String(DONE.length), ConstructorStandings: rows }] } }, 1);
  }
  const src = kind === "results" ? resultsByRound : kind === "sprint" ? sprintByRound : kind === "qualifying" ? qualiByRound : null;
  if (src) {
    const key = kind === "results" ? "Results" : kind === "sprint" ? "SprintResults" : "QualifyingResults";
    const flat = [];
    for (const r of DONE) { const n = Number(r.round); if (round && n !== Number(round)) continue; for (const row of src[n] ?? []) flat.push([r, row]); }
    const [a, t, o, l] = page(flat, q);
    const grouped = new Map();
    for (const [r, row] of a) { if (!grouped.has(r.round)) grouped.set(r.round, { ...r, [key]: [] }); grouped.get(r.round)[key].push(row); }
    return mr({ RaceTable: { Races: [...grouped.values()] } }, t, o, l);
  }
  if (kind === "drivers") return mr({ DriverTable: { Drivers: DRIVERS.map(dObj) } }, DRIVERS.length);
  return mr({});
}

/* ───────────────────────── OpenF1 ───────────────────────── */
const SING = races.find((r) => r.raceName === "Singapore Grand Prix");
const liveStart = Date.parse(`${SING.date}T${SING.time}`);
const SESS = races.filter((r) => finished(r) || r === SING).map((r, i) => {
  const start = Date.parse(`${r.date}T${r.time}`);
  return { session_key: 9000 + Number(r.round), session_name: "Race", session_type: "Race", date_start: new Date(start).toISOString(), date_end: new Date(start + 95 * 60_000).toISOString(), country_name: r.Circuit.Location.country, circuit_short_name: r.Circuit.Location.locality, location: r.Circuit.Location.locality, year: YEAR };
});
const LAST_KEY = SESS.filter((s) => Date.parse(s.date_start) < NOW).at(-1)?.session_key ?? 9001;
const OF_DRIVERS = DRIVERS.map((d) => ({ driver_number: d[4], name_acronym: d[3], full_name: `${d[1]} ${d[2].toUpperCase()}`, last_name: d[2], team_name: team(d[6])[1], team_colour: ({ mclaren: "FF8000", ferrari: "E8002D", mercedes: "27F4D2", red_bull: "3671C6", racing_bulls: "6692FF", aston_martin: "229971", williams: "64C4FF", alpine: "FF87BC", haas: "B6BABD", audi: "F50537", cadillac: "C9C9D1" })[d[6]], headshot_url: null }));

function trackXY(t) { const a = t * Math.PI * 2; return [Math.round(5000 * Math.cos(a) + 1800 * Math.cos(3 * a)), Math.round(3200 * Math.sin(a) + 1100 * Math.sin(2 * a))]; }

function openf1(path, q) {
  const ep = path.replace(/^\//, "");
  if (LIVE === "down") return { __status: 401, detail: "Live F1 session in progress, API access restricted" };
  const key = Number(q.get("session_key"));
  const isLive = LIVE && key === 9000 + Number(SING.round);
  const elapsed = (NOW - liveStart) / 1000 + (Date.now() - NOW) / 1000;
  if (ep === "sessions") return SESS;
  if (ep === "drivers") return OF_DRIVERS;
  if (ep === "race_control") {
    if (!isLive) return [{ date: new Date(NOW - 7e6).toISOString(), lap_number: 17, category: "SafetyCar", flag: null, scope: null, message: "SAFETY CAR DEPLOYED" }, { date: new Date(NOW - 6.9e6).toISOString(), lap_number: 20, category: "Flag", flag: "GREEN", scope: "Track", message: "GREEN LIGHT - PIT EXIT OPEN" }];
    return [
      { date: new Date(liveStart).toISOString(), lap_number: 1, category: "Flag", flag: "GREEN", scope: "Track", message: "GREEN LIGHT - PIT EXIT OPEN" },
      { date: new Date(liveStart + 600_000).toISOString(), lap_number: 7, category: "SafetyCar", flag: null, scope: "Track", message: "SAFETY CAR DEPLOYED" },
      { date: new Date(liveStart + 840_000).toISOString(), lap_number: 10, category: "SafetyCar", flag: null, scope: "Track", message: "SAFETY CAR IN THIS LAP" },
      { date: new Date(liveStart + 900_000).toISOString(), lap_number: 11, category: "Flag", flag: "GREEN", scope: "Track", message: "TRACK CLEAR" },
      { date: new Date(Date.now() - 20_000).toISOString(), lap_number: Math.floor(elapsed / 100) + 1, category: "Other", flag: null, scope: null, message: "TURN 14 INCIDENT INVOLVING CAR 31 (OCO) NOTED - NO FURTHER INVESTIGATION" },
    ];
  }
  if (!isLive) return [];
  const lapNo = Math.floor(elapsed / 100) + 1;
  const order = DRIVERS.map((d) => d[4]);
  const posAt = (n) => { const arr = order.slice(); if (Math.floor(elapsed / 35) % 2) [arr[2], arr[3]] = [arr[3], arr[2]]; return arr.indexOf(n) + 1; };
  if (ep === "position") return order.map((n) => ({ date: new Date(Date.now() - 2000).toISOString(), driver_number: n, position: posAt(n), session_key: key }));
  if (ep === "intervals") return order.map((n, i) => ({ date: new Date(Date.now() - 1500).toISOString(), driver_number: n, gap_to_leader: i === 0 ? 0 : +(i * 3.4 + Math.sin(elapsed / 9 + i)).toFixed(3), interval: i === 0 ? null : +(3.4 + Math.cos(elapsed / 7 + i)).toFixed(3) }));
  if (ep === "laps") {
    const out = [];
    for (const n of order) for (let l = 1; l <= lapNo; l++) {
      const s1 = 29 + ((n * l) % 7) * 0.12, s2 = 31 + ((n + l) % 5) * 0.1, s3 = 28 + ((n * 3 + l) % 6) * 0.1;
      out.push({ driver_number: n, lap_number: l, date_start: new Date(liveStart + (l - 1) * 100_000).toISOString(), lap_duration: l === lapNo ? null : +(s1 + s2 + s3).toFixed(3), duration_sector_1: l === lapNo ? null : +s1.toFixed(3), duration_sector_2: l === lapNo ? null : +s2.toFixed(3), duration_sector_3: l === lapNo ? null : +s3.toFixed(3), is_pit_out_lap: false });
    }
    return out;
  }
  if (ep === "stints") return order.map((n, i) => ({ driver_number: n, stint_number: 1, compound: ["MEDIUM", "HARD", "SOFT"][i % 3], lap_start: 1, tyre_age_at_start: 0 }));
  if (ep === "pit") return [{ driver_number: 4 === 4 ? 16 : 0, date: new Date(liveStart + 1_800_000).toISOString(), lap_number: 18, pit_duration: 22.4 }, { driver_number: 1, date: new Date(liveStart + 1_900_000).toISOString(), lap_number: 19, pit_duration: 21.9 }];
  if (ep === "weather") return [{ date: new Date(Date.now() - 30_000).toISOString(), air_temperature: 29.4, track_temperature: 35.1, wind_speed: 2.1, wind_direction: 140, humidity: 78, rainfall: 0 }];
  if (ep === "overtakes") return [{ date: new Date(Date.now() - 45_000).toISOString(), overtaking_driver_number: 16, overtaken_driver_number: 63, position: 4 }];
  if (ep === "location") return order.map((n, i) => { const [x, y] = trackXY(((elapsed / 95 + i * 0.012) % 1)); return { date: new Date(Date.now() - 900).toISOString(), driver_number: n, x, y, z: 0 }; });
  return [];
}

function openf1Static(path, q) {
  const ep = path.replace(/^\//, "");
  const key = Number(q.get("session_key"));
  const lapStart = Date.parse(`${SING.date}T${SING.time}`);
  if (ep === "laps" && q.get("driver_number")) {
    return Array.from({ length: 6 }, (_, i) => ({ driver_number: Number(q.get("driver_number")), lap_number: i + 2, date_start: new Date(NOW - 5e6 + i * 95_000).toISOString(), lap_duration: 90 + i * 0.3, is_pit_out_lap: false }));
  }
  if (ep === "location" && q.get("driver_number")) {
    return Array.from({ length: 360 }, (_, i) => { const [x, y] = trackXY(i / 360); return { date: new Date(NOW).toISOString(), x, y, z: 0 }; });
  }
  if (ep === "session_result") return DRIVERS.map((d, i) => ({ driver_number: d[4], position: i + 1, number_of_laps: 14 + (i % 4), duration: [90.5 + i * 0.1, i < 16 ? 89.9 + i * 0.1 : null, i < 10 ? 89.2 + i * 0.1 : null] }));
  void lapStart;
  return null;
}

const server = http.createServer((req, res) => {
  const u = new URL(req.url, "http://x");
  const send = (code, body) => { res.writeHead(code, { "content-type": "application/json", "access-control-allow-origin": "*" }); res.end(JSON.stringify(body)); };
  try {
    if (u.pathname.startsWith("/jolpica")) return send(200, jolpica(u.pathname.replace("/jolpica", ""), u.searchParams));
    if (u.pathname.startsWith("/openf1")) {
      const p = u.pathname.replace("/openf1", "");
      const rawQ = u.searchParams;
      const stat = openf1Static(p, rawQ);
      const out = stat ?? openf1(p, rawQ);
      if (out && out.__status) return send(out.__status, out);
      return send(200, out);
    }
    send(404, { error: "not found" });
  } catch (e) { console.error(e); send(500, { error: String(e) }); }
});
server.listen(PORT, () => console.log(`[mock] F1 demo provider on :${PORT} (live=${LIVE || "off"}, last session ${LAST_KEY})`));
