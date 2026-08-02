# Global Real-Time Flight Tracker

## Context

We want a web app that shows every aircraft in the air worldwide on a map, updating in
real time. Clicking a plane zooms into a cinematic 3D view where you watch it fly over
accurate terrain, and a search box lets you jump straight to a flight by callsign.

The repo today is an empty Vite + React 19 + TypeScript scaffold at `src/frontend`
(`src/App.tsx` is still the Vite starter page). Everything below is new construction.

**The three constraints that drive the entire design**, established during research:

1. **OpenSky Network is the only free source of a truly global feed.** ADS-B aggregators
   like airplanes.live and adsb.lol are excellent but only serve a radius around a point —
   no whole-world query.
2. **OpenSky's budget is ~1,000 global polls/day** (4,000 credits ÷ 4 credits per global
   `/states/all` call). That is **one poll every ~90 seconds** — three orders of magnitude
   away from "real time".
3. **Therefore the app is not really a polling app; it is a simulation app.** We poll
   slowly for truth and *dead-reckon* every aircraft forward at 60fps from its last known
   position, velocity, heading and vertical rate. This is how FlightRadar24 feels smooth,
   and it is the single most important idea in this codebase.

A backend is non-negotiable: OpenSky moved to OAuth2 client-credentials in March 2026, the
`client_secret` cannot ship in browser JS, and OpenSky does not reliably send CORS headers.
One server polls once and fans out to all clients, so the credit budget stays constant no
matter how many users connect.

Scope decisions confirmed with the user: hybrid MapLibre (world) + Cesium (follow view),
Node backend, personal/non-commercial (which is what makes OpenSky and Cesium ion free
tiers legitimate), and search limited to callsign/flight number for v1.

---

## Architecture

```
src/
  shared/          NEW  — types shared by both sides (no build step, plain .ts)
    flight.ts
  backend/         NEW  — Fastify + TypeScript
    src/
      openskyAuth.ts    OAuth2 token cache
      poller.ts         budget-aware polling loop
      store.ts          in-memory aircraft state + trails
      routes/
        stream.ts       GET /api/stream  (SSE)
        search.ts       GET /api/flights/search?q=
        aircraft.ts     GET /api/aircraft/:icao24
      server.ts
  frontend/        EXISTS — Vite + React 19 + React Compiler
    src/
      routes/WorldView.tsx      MapLibre globe
      routes/FollowView.tsx     Cesium 3D (lazy-loaded)
      data/flightStore.ts       zustand
      data/useFlightStream.ts   EventSource -> store
      lib/deadReckoning.ts      ** shared by both views **
      map/useAircraftLayer.ts
      search/SearchBox.tsx
```

`src/shared/flight.ts` is imported by both via a tsconfig path alias (`@shared/*`) plus a
matching Vite `resolve.alias`. Keeps the wire format honest on both ends.

---

## Phase 0 — Scaffolding

- `src/backend/package.json`: `fastify`, `dotenv`; dev deps `tsx`, `typescript`,
  `@types/node`. Scripts: `dev` = `tsx watch src/server.ts`, `build` = `tsc`.
- `.env` at repo root (gitignored): `OPENSKY_CLIENT_ID`, `OPENSKY_CLIENT_SECRET`.
  **User action required:** register at opensky-network.org and create an API client.
  Feeding data to OpenSky raises the daily budget from 4,000 to 8,000 credits.
- `src/shared/flight.ts`:

```ts
// Wire format is a positional tuple, not an object — with ~12k aircraft in a
// snapshot the key names alone would cost hundreds of KB.
export type AircraftTuple = [
  icao24: string, callsign: string, lat: number, lon: number,
  altM: number, velocityMs: number, trackDeg: number, vertRateMs: number,
  onGround: 0 | 1, lastContactMs: number, country: string,
];

export interface Aircraft { /* decoded, camelCase object form */ }
export type StreamMessage =
  | { type: 'snapshot'; t: number; aircraft: AircraftTuple[] }
  | { type: 'delta';    t: number; changed: AircraftTuple[]; removed: string[] };
```

- Frontend `vite.config.ts`: add `server.proxy` for `/api` -> `http://localhost:3001` so
  dev is same-origin and SSE just works.

## Phase 1 — Backend: auth, poller, store, SSE

**`openskyAuth.ts`** — POST `application/x-www-form-urlencoded` with
`grant_type=client_credentials` to
`https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token`.
Tokens live 30 minutes; cache in memory and refresh at 25 minutes. Single in-flight
refresh promise so concurrent callers don't stampede.

**`poller.ts`** — `GET https://opensky-network.org/api/states/all` with
`Authorization: Bearer <token>`, no bounding box (global). Interval from
`POLL_INTERVAL_MS`, default **90000**. That is 960 calls/day at 4 credits = 3,840 of the
4,000 budget. On HTTP 429, read the `X-Rate-Limit-Retry-After-Seconds` header and back off
rather than hammering. Track credits spent today and expose it on a `/api/health` route —
we will want to see this number while tuning.

**`store.ts`** — `Map<icao24, Aircraft>`. Drop entries with null `lat`/`lon` (OpenSky
returns plenty). Evict aircraft not seen for 15 minutes. Keep a bounded trail (ring buffer,
~60 points) **only for aircraft that some client has selected**, so memory stays flat.

**`routes/stream.ts`** — SSE. On connect, write the full snapshot; on every subsequent poll,
diff against what that client last received and write only changed + removed. Send an SSE
comment heartbeat every 20s so proxies don't reap idle connections. Clean up the listener
on `request.raw.on('close')`.

*Field mapping from the OpenSky state vector (positional array):* `0` icao24, `1` callsign,
`5` lon, `6` lat, `7` baro_altitude (m), `8` on_ground, `9` velocity (m/s), `10` true_track
(deg), `11` vertical_rate (m/s), `4` last_contact (s). Note **lon comes before lat** — the
classic bug with this API.

*Verify:* `curl -N localhost:3001/api/stream | head -c 2000` shows a snapshot with ~8–12k
aircraft, and `curl localhost:3001/api/health` shows a sane credit count.

## Phase 2 — Dead reckoning (build this before any map work)

`src/frontend/src/lib/deadReckoning.ts` — pure functions, no React, no map library. This is
the piece both views depend on, so it gets built and unit-verified first.

```ts
// Great-circle forward projection. Do NOT use flat lat/lon + delta —
// it visibly breaks at high latitudes, which is where a lot of traffic is.
export function projectPosition(a: Aircraft, nowMs: number): Projected {
  const dt = (nowMs - a.lastContactMs) / 1000;          // seconds
  const d  = (a.velocityMs * dt) / EARTH_RADIUS_M;      // angular distance
  const brng = toRad(a.trackDeg);
  // ... standard destination-point formula ...
  return { lat, lon, altM: a.altM + a.vertRateMs * dt, headingDeg: a.trackDeg };
}
```

**Correction easing:** when a poll delivers a new truth position, do not snap. Keep the
previously projected position and ease toward the newly projected one over ~1s
(`easeInOutCubic`). Without this, every plane on screen teleports once every 90 seconds and
the illusion collapses.

*Verify:* a scratch test that projects a known aircraft 90s forward and confirms the
distance travelled equals `velocity × 90` within a metre or two.

## Phase 3 — MapLibre world view

- `npm i maplibre-gl` in `src/frontend`.
- Basemap: CARTO dark matter — `https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json`.
  No API key, and the dark palette is the right look for a flight tracker.
- `projection: { type: 'globe' }` (MapLibre GL JS 5+).
- One GeoJSON source + one `symbol` layer for all aircraft:
  - `icon-rotate: ['get', 'heading']`, `icon-rotation-alignment: 'map'`
  - `icon-allow-overlap: true`, `icon-ignore-placement: true`
  - colour by altitude via an `interpolate` expression on an SDF plane icon
- `useAircraftLayer.ts` runs a `requestAnimationFrame` loop but **throttles `setData` to
  ~10Hz** — rebuilding a 10k-feature GeoJSON at 60fps is the obvious way to tank this. Cull
  to `map.getBounds()` plus a margin before building the feature array; at low zoom also cap
  the count (nearest-N or altitude-filtered), since 12k icons on a zoomed-out globe is
  visual noise anyway.

*Escape hatch:* if 10Hz `setData` still stutters on a full global load, swap this one layer
for a deck.gl `IconLayer` overlaid on the same map. The dead-reckoning and store layers are
untouched by that change — this is exactly why they are separate modules.

## Phase 4 — Selection and search

- Click handler on the symbol layer -> `flightStore.select(icao24)` -> navigate to
  `/flight/:icao24` via `react-router` (already a dependency).
- `SearchBox.tsx`: debounced (250ms) query to `GET /api/flights/search?q=`, which does a
  case-insensitive prefix match on trimmed callsigns in the backend store. Results show
  callsign, origin country, altitude. Selecting one navigates to the same follow route.
- Use `react-hook-form` + `zod` and CSS modules, per the conventions in
  `src/frontend/README.md`.
- An info panel over the map for the selected aircraft: callsign, altitude, speed, heading,
  vertical rate, plus a polyline trail from `/api/aircraft/:icao24`.

## Phase 5 — Cesium follow view

- `npm i cesium vite-plugin-cesium-build` and add the plugin to `vite.config.ts` (it handles
  `CESIUM_BASE_URL` and asset copying). Cesium ion token goes in `VITE_CESIUM_ION_TOKEN` —
  ion tokens are public client tokens, so this one legitimately belongs in the frontend.
- **Lazy-load the whole route** with `React.lazy` + `Suspense`. Cesium is ~3MB gzipped and
  must not be in the world view's initial bundle.
- Scene setup: `Cesium.Terrain.fromWorldTerrain()` for real elevation, Bing imagery from
  ion (both in the free non-commercial tier: 15GB/month streaming).
- Aircraft as a `Model` from a small `.glb` in `public/models/`, positioned by a Cesium
  `CallbackProperty` that calls **the same `projectPosition` from Phase 2** — one physics
  implementation, two renderers.
- Orientation via `Transforms.headingPitchRollQuaternion`: heading from `trackDeg`, pitch
  derived from `atan2(vertRateMs, velocityMs)`, small roll during heading changes.
- Chase camera: start with `viewer.trackedEntity = aircraftEntity` (one line, works), then
  upgrade to `camera.lookAtTransform` with an east-north-up offset behind and above the
  aircraft for a properly cinematic angle.
- A "back to world" control returns to `/` and restores the previous map viewport.

## Phase 6 — Polish

Altitude-graded colour ramp and a legend; trails on hover; a subtle "last updated Ns ago"
indicator (honest about the 90s cadence); handle SSE reconnect with exponential backoff;
handle the empty/zero-aircraft state; reduced-motion support.

---

## Verification

1. `cd src/backend && npm run dev` — check `/api/health` reports a valid token and a
   credit count that grows by 4 per poll, not faster.
2. `curl -N localhost:3001/api/stream | head -c 2000` — snapshot arrives, then deltas every
   ~90s. Confirm aircraft count is in the 8–12k range (below ~1k means the bbox/parsing is
   wrong).
3. `cd src/frontend && npm run dev` — planes render on the globe and **move continuously**
   between polls. Watch a single plane across a poll boundary: it must ease, not jump.
4. Sanity-check a real flight against flightradar24.com — same callsign, roughly the same
   position and heading.
5. Click a plane -> Cesium loads, terrain is visibly 3D (fly one over the Alps or the
   Rockies to confirm), camera tracks the aircraft.
6. Search a live callsign from step 2 -> jumps to that aircraft's follow view.
7. `npm run lint` and `npm run build` clean in both packages.

## Risks

- **OpenSky coverage is uneven** — strong over Europe/North America, sparse over oceans and
  parts of Asia/Africa. Expect visible gaps; this is the data, not a bug.
- **90s truth cadence** means a plane that turns is briefly projected along its old heading.
  Acceptable; the easing hides most of it.
- **Non-commercial licensing** (OpenSky and Cesium ion) is fine for this project as scoped.
  If that ever changes, the swap point is `poller.ts` alone — the store, stream, and
  frontend are all source-agnostic.
