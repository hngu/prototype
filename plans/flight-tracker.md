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
  backend/         EXISTS — Express 5 + TypeScript
    src/
      config.ts         env config (node --env-file, no dotenv)
      openskyAuth.ts    OAuth2 token cache
      poller.ts         budget-aware polling loop
      store.ts          in-memory aircraft state + trails
      routes/
        stream.ts       GET /api/stream  (SSE)
        search.ts       GET /api/flights/search?q=
        aircraft.ts     GET /api/aircraft/:icao24
      index.ts
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

## Phase 0 — Scaffolding — ✅ DONE (2026-08-02)

Built and verified. Three things landed differently from the original plan; the reasons are
recorded below because they constrain later phases.

**Express, not Fastify.** The backend was already scaffolded on Express 5. The hot path here
is SSE — one long-lived response per client — which Express handles directly, and there is
no throughput argument at ~1 request per client per session. Consequence for Phase 1:
`request.raw.on('close')` becomes `req.on('close')`.

**No `dotenv`.** Node 24.9 is pinned in `.tool-versions`, so config uses the native
`--env-file-if-exists=../../.env` flag in the `dev`/`start` scripts. `-if-exists` is
deliberate: the server must boot and serve `/api/health` before credentials exist.

**Backend `rootDir` is `..`, not `./src`.** A type-only import of `../shared` still raises
TS6059 — verified, not assumed. `rootDir` therefore has to contain `shared/`, which moves
emitted output to `dist/backend/src/index.js` (the `start` script matches).

Also landed:

- `src/shared/flight.ts` — `AircraftTuple`, `Aircraft`, `StreamMessage`, `HealthResponse`.
  Types-only and must stay that way: the imports erase at compile time, so nothing needs to
  resolve at runtime. Adding runtime code breaks the backend, where `node dist/...` does not
  honour tsconfig paths. `src/shared/package.json` declares `"type": "module"` so `nodenext`
  does not mis-detect the directory as CommonJS.
- `@shared/*` alias wired in three places that must stay in agreement: backend `tsconfig.json`
  `paths`, frontend `tsconfig.app.json` `paths` + `include`, and `vite.config.ts`
  `resolve.alias`. The two packages resolve differently, so the specifier differs —
  frontend `@shared/flight`, backend `@shared/flight.js`. Not unifiable without changing a
  `moduleResolution`.
- Vite `server.proxy` `/api` -> `http://localhost:3001`, plus `server.fs.allow: ['..']`
  since `src/shared` sits outside the Vite root. Backend port is `PORT` in `.env`
  (default 3001 in `config.ts`) and **must match the proxy target**, which is not read from
  `.env`.
- `GET /api/health` stub returning `HealthResponse` placeholders. Its job in Phase 0 was to
  prove browser -> proxy -> Express works before any OpenSky code exists.
- `vitest` installed in the frontend (`npm test`), ahead of the Phase 2 dead-reckoning tests.
- `.env.example` committed; `.env` created and confirmed gitignored.

*Verified:* type-check/build/lint clean in both packages; `/api/health` returns correct JSON
both directly on :3001 and through the Vite proxy on :5173.

**Still open — user action:** register at opensky-network.org, create an API client, and fill
`OPENSKY_CLIENT_ID` / `OPENSKY_CLIENT_SECRET` in `.env`. Phase 1 cannot be verified against
live data until this is done. Feeding data to OpenSky raises the daily budget from 4,000 to
8,000 credits, which would allow `POLL_INTERVAL_MS` to drop to ~45000.

**Not yet verified:** whether the Vite proxy buffers SSE frames. There is no SSE route until
Phase 1 — test with `curl -N` through :5173, not just against :3001.

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

*Field mapping from the OpenSky state vector* (17 elements; verified against the REST docs
2026-08-02):

| Idx | Field | Unit | Null? | Use |
|-----|-------|------|-------|-----|
| 0 | `icao24` | hex | no | store key |
| 1 | `callsign` | 8-char padded | yes | **must `.trim()`** |
| 2 | `origin_country` | string | no | tuple `country` |
| 3 | `time_position` | sec | yes | **dead-reckoning clock** |
| 4 | `last_contact` | sec | no | fallback when 3 is null |
| 5 | `longitude` | deg | yes | drop row if null |
| 6 | `latitude` | deg | yes | drop row if null |
| 7 | `baro_altitude` | m | yes | `altM` |
| 8 | `on_ground` | bool | no | `onGround` |
| 9 | `velocity` | m/s | yes | dead reckoning |
| 10 | `true_track` | deg from N | yes | icon rotation + bearing |
| 11 | `vertical_rate` | m/s | yes | altitude projection |

Indices 12–17 (`sensors`, `geo_altitude`, `squawk`, `spi`, `position_source`, `category`)
are unused. `category` requires `extended=1` anyway.

Four traps:

1. **lon (5) comes before lat (6)** while `AircraftTuple` is lat-then-lon — the decode *does*
   swap. The classic bug with this API, and it fails silently.
2. **Times are seconds; the tuple is milliseconds.** Multiply by 1000, or projection runs
   ~1.7 billion seconds forward and every aircraft leaves the map.
3. **Callsigns are space-padded to 8 chars and often null** — trim, or Phase 4 prefix search
   silently misses.
4. **Two distinct null cases.** Null lat/lon -> drop the row. Null velocity/track *with* a
   valid position -> keep it, render at last known point, skip projection.

*Project from `time_position` (3), not `last_contact` (4).* `last_contact` is the last time
any signal arrived; `time_position` is the last time a *position* did, and it is the clock
the held lat/lon actually belongs to. Using `last_contact` makes elapsed time look shorter
than it is, so aircraft are drawn behind their true position — and the error is worst for
aircraft with degraded position updates, i.e. over oceans, where it can least be afforded.
`time_position` is nullable, hence the fallback:

```ts
const posTimeSec = state[3] ?? state[4];   // time_position, else last_contact
```

*Credit accounting:* every response carries `X-Rate-Limit-Remaining`, which is authoritative
and accounts for anything else spending the budget. Track an internal counter too and expose
both on `/api/health` — divergence means something is polling that we don't know about.

*Verify:* `curl -N localhost:3001/api/stream | head -c 2000` shows a snapshot with ~8–12k
aircraft, and `curl localhost:3001/api/health` shows a sane credit count.

## Phase 2 — Dead reckoning (build this before any map work)

`src/frontend/src/lib/deadReckoning.ts` — pure functions, no React, no map library. This is
the piece both views depend on, so it gets built and unit-verified first.

```ts
// Great-circle forward projection. Do NOT use flat lat/lon + delta —
// it visibly breaks at high latitudes, which is where a lot of traffic is.
export function projectPosition(a: Aircraft, nowMs: number): Projected {
  // posTimeMs is OpenSky time_position — the clock the held lat/lon belongs to,
  // NOT last_contact. See the Phase 1 field mapping for why this matters.
  const dt = (nowMs - a.posTimeMs) / 1000;              // seconds
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
