# Pit Wall — Formula 1 companion

Next.js 15 · React 19 · TypeScript · Tailwind · Framer Motion · Recharts · SWR. English + Dutch, instant switching.

## Run
```bash
cd f1
npm install
cp .env.example .env.local     # optional – defaults work for historical data
npm run dev                    # http://localhost:3000
```

## Data (nothing is hardcoded)
| Need | Provider | Key |
|---|---|---|
| Calendar, standings, results, qualifying, sprint, career stats | [Jolpica](https://github.com/jolpica/jolpica-f1) (Ergast-compatible) | none |
| Photos/team colours, live timing, weather, race control, circuit outline, sprint qualifying, qualifying lap counts, safety cars/penalties | [OpenF1](https://openf1.org) | `F1_API_KEY` (bearer token) for **real-time** data |

Config: `.env.example` (`F1_SEASON`, `JOLPICA_BASE_URL`, `OPENF1_BASE_URL`, `F1_API_KEY`).

Layers: `src/server/*` (throttled HTTP + TTL / stale-if-error cache -> provider clients -> aggregation) -> `src/app/api/f1/*` (JSON API) -> `src/hooks/useF1.ts` (SWR polling) -> components. Live data polls every 5 s, only while the official timetable says a Race/Sprint is running.

## Reliability rules
- Live values come only from the provider. If it refuses or returns nothing: "Live timing unavailable". If it stops updating (>45 s): "Live data temporarily unavailable", table dimmed with the last-known timestamp.
- If the upstream fails, the last good payload is served and flagged.
- Not supplied by the sources, so shown as unavailable instead of estimated: laps led, rain probability (only rainfall yes/no), total race laps, a true retirement flag during live (status uses pit / "stopped" heuristics from feed activity).
- Team logos are colour monograms (no trademarked artwork bundled).

## Offline development
`npm run dev:mock` runs `dev/mock-server.mjs`, a synthetic provider (UI shows a "Demo data" badge). `MOCK_LIVE=1` simulates a running Grand Prix, `MOCK_LIVE=down` a refusing provider.

## Caveat
Built in a sandbox that could not reach Jolpica/OpenF1. Response shapes follow their documentation and were exercised only against the mock; verify against the real APIs first.
