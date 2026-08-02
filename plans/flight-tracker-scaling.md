# Flight Tracker — Scaling Notes

Companion to [`flight-tracker.md`](./flight-tracker.md). Captured 2026-08-01, before any
map code existed.

There are two separate ceilings here, and it's worth not confusing them: the **rendering**
ceiling you hit on your laptop in Phase 3, and the **pipeline** ceiling you'd hit with
paying users. The second is much lower than people expect, and MapLibre isn't what breaks.

---

## Part 1 — MapLibre rendering ceilings

### The big one: `setData` is a re-tiling operation, not a buffer update

Internalize this before writing `useAircraftLayer.ts`. When you call `setData` on a GeoJSON
source, MapLibre does not patch positions in place. It:

1. Serializes the feature array and posts it to a worker
2. Re-indexes the whole thing (geojson-vt)
3. Rebuilds vector tiles for every visible tile
4. Transfers fresh vertex buffers back to the main thread
5. Re-uploads to the GPU

There is no partial-update API. **Every `setData` invalidates the entire source.** At the
plan's 10Hz with 12k features that's ten full re-index-and-retile cycles per second, and the
structured clone of the feature array alone is meaningful.

MapLibre's GeoJSON source is designed for data that changes *occasionally* — a filter
toggle, a new query result. We're using it as an animation buffer. It works for a few
thousand features and degrades non-linearly past that.

### The fix that actually scales: project on the GPU

The key ratio: **truth arrives every 90 seconds, but we upload 10× per second.** Every one
of those uploads carries positions derived from data that hasn't changed.

Instead: upload each aircraft's last-known `lat/lon/velocity/heading/vertRate/lastContact`
**once per poll**, pass `now` as a uniform, and do the great-circle projection in the vertex
shader. CPU upload rate drops from 10Hz to ~0.011Hz, and the animation becomes free — the
GPU runs per-frame regardless.

Two ways to get there:

- **deck.gl** (`IconLayer` + custom shader injection) — writes GPU attribute buffers
  directly, accepts binary typed arrays, no re-tiling. The plan calls this an "escape
  hatch"; at any real scale it's the design, not the hatch. Likely a Phase 3.5, not a
  contingency.
- **MapLibre `CustomLayerInterface`** — own the WebGL context and buffers outright. More
  work, one less dependency.

### Symbol-layer specifics

- `icon-allow-overlap: true` and `icon-ignore-placement: true` are not cosmetic. They are
  what skips MapLibre's **symbol collision/placement pass**, which is main-thread work
  proportional to symbol count. The plan sets them — know *why*, because it constrains what
  comes later.
- That constraint bites the moment you want **callsign labels**. Text re-enters collision
  detection and it's a cliff, not a slope. Gate labels behind high zoom, selection, or an
  altitude filter. Never render 12k labels.
- **SDF icons** (needed for `icon-color` altitude ramping) cost slightly more fragment work
  than plain sprites. Fine at this count; worth knowing.

### Trails scale worse than aircraft

The plan keeps trails to selected aircraft only. Understand the shape of what that avoids:
12k aircraft × 60-point ring buffers ≈ 720k vertices in a `line` layer, re-tiling on the
same cadence. Line tessellation is far more expensive than point rendering. "Show trails for
everything" is a feature request that quietly costs ~50× the current budget.

### Keep 12k aircraft out of React

zustand is installed and the obvious move is to put the aircraft map in the store. If any
component subscribes to that slice, you trigger React reconciliation 10× per second over 12k
entries. React Compiler will not save you — it optimizes re-render *cost*, not re-render
*frequency*.

The discipline: aircraft data lives in a mutable store read imperatively by the rAF loop,
which pushes straight to the map. React renders the *selected* aircraft's panel, the search
box, and the chrome. Nothing else subscribes to the fleet.

### Low-zoom LOD

12k icons on a zoomed-out globe is visual noise *and* wasted work. The thing to know:
**supercluster-style clustering at 10Hz is a non-starter** — re-clustering is the expensive
part. Prefer cheap filters: altitude threshold, viewport-culled nearest-N, or server-side
pre-aggregation at low zoom.

---

## Part 2 — What commercialization actually breaks

At commercial scale MapLibre is **not** the binding constraint. These are, roughly in order
of impact.

### 1. The data license evaporates on day one

OpenSky's free tier is non-commercial. So is Cesium ion's. So is CARTO's free basemap tier,
effectively. The entire foundation is licensed for exactly what we're doing now and nothing
more.

Commercial ADS-B means FlightAware Firehose, Spire, ADSBexchange commercial, or building a
receiver network — a real four-to-five-figure monthly line item. This is the actual gate.
Everything below is a solvable engineering problem; this one is a business decision.

### 2. The problem inverts: from too little data to too much

Today we dead-reckon because truth arrives every 90s. A commercial feed pushes ~1s updates,
which flips the bottleneck entirely:

- Dead reckoning becomes a smoothing detail rather than the core illusion
- Ingest handles ~12k state updates *per second*
- Diffing, storing, and broadcasting becomes the hot loop

Code written assuming a 90s cadence — the per-client diff in `stream.ts` especially — will
not survive that transition unchanged.

### 3. Fan-out: the per-client diff doesn't scale

`stream.ts` diffs against *what each client last received*: O(clients × aircraft) per poll,
plus per-client state on the server. Fine at 100 users. At 50,000 it's the whole CPU.

Fixes, escalating:

- **Viewport-scoped subscriptions.** Client sends its bounding box; server sends only
  aircraft inside it. Single biggest win — most users look at one region, not the globe.
  Changes the wire protocol, so design the protocol to allow it even in v1.
- **Broadcast groups.** Bucket clients by viewport tile, compute each diff *once* per
  bucket, write identical bytes to every member. Per-client work becomes per-region work.
- **Binary encoding.** The positional tuple is the right instinct; the next step is dropping
  JSON entirely for a packed binary format. Roughly 3–5× wire reduction over JSON tuples,
  and it kills client-side parse cost.
- **Compress once, not per-connection.** Per-socket gzip across thousands of SSE streams
  burns CPU re-compressing identical payloads.

### 4. Horizontal scaling breaks the in-memory store

`store.ts` is a `Map` in one process — correct now, unshardable later. The moment two
instances sit behind a load balancer, clients on different boxes see different worlds. Needs
one ingest process feeding a pub/sub layer (Redis, NATS) that stateless edge servers
subscribe to.

Related: every SSE client is a **held-open socket**. Connection count, not request rate,
becomes the capacity metric — an unfamiliar scaling axis if you're used to request/response
services, and the one an autoscaler probably isn't watching.

### 5. Mobile is a different device class entirely

12k icons at 60fps on a mid-range Android will not happen. Commercial means:

- Device-tiered LOD, detected via a quick render benchmark rather than user-agent
- Battery and thermal budget — a 60fps rAF loop is a genuine drain, and thermal throttling
  degrades it over minutes rather than failing fast
- Pause the loop on `visibilitychange`, and drop the SSE connection on backgrounding
  (otherwise idle tabs cost sockets)

### 6. Basemap and 3D become line items

CARTO free won't carry commercial traffic. Options: paid CARTO/MapTiler/Mapbox, or self-host
vector tiles (Planetiler + OpenMapTiles behind a CDN) — genuinely cost-effective at volume
and gives full styling control. Cesium ion's non-commercial tier is out; Google
Photorealistic 3D Tiles is the quality play but is metered per-load, which interacts badly
with users who click a lot of planes.

OSM/CARTO attribution is a contractual obligation, not a nicety.

---

## What to do now

Three things that cost little today and preserve options:

1. **Design the wire protocol to carry a viewport**, even if v1 ignores it and sends
   everything. Retrofitting scoping into a protocol is painful; leaving a field unused is
   free.
2. **Keep the fleet out of React from the first commit.** Nearly impossible to retrofit once
   components have grown subscriptions, and invisible until it isn't.
3. **Instrument frame time in Phase 3**, not Phase 6. "Feels smooth on my laptop with 800
   aircraft over Europe at 3am" is not a measurement. Want a p95 frame-time number and a
   synthetic load path that replays a recorded global snapshot.

The plan's modular split — dead reckoning, store, and stream as separate source-agnostic
modules — is what makes most of the above swappable rather than a rewrite.
