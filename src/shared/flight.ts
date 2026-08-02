/**
 * Wire format shared by the backend poller and the frontend stream reader.
 *
 * Types only — no runtime values. The frontend compiles with
 * `verbatimModuleSyntax` and `erasableSyntaxOnly`, so this file must stay fully
 * erasable and every import of it must be an `import type`.
 *
 * The two packages resolve modules differently, so the specifier differs:
 *   frontend (moduleResolution: bundler) -> import type { ... } from '@shared/flight'
 *   backend  (moduleResolution: node16)  -> import type { ... } from '@shared/flight.js'
 *
 * Because the imports are type-only they erase at compile time, so nothing here
 * needs to resolve at runtime. Adding runtime code to this file would break that
 * assumption on the backend, where `node dist/...` does not honour tsconfig paths.
 */

/**
 * Aircraft on the wire is a positional tuple, not an object.
 *
 * A global snapshot is ~8-12k aircraft. Repeating the key names on every entry
 * costs hundreds of KB per snapshot over an uncompressed SSE stream, so the
 * field names live here in the type and never on the wire.
 *
 * Positional formats fail silently when the two ends disagree — a swapped
 * lat/lon puts aircraft in the wrong hemisphere without throwing. The labels
 * below are what makes that a compile error instead of a debugging session.
 */
export type AircraftTuple = [
  icao24: string,
  callsign: string,
  lat: number,
  lon: number,
  altM: number,
  velocityMs: number,
  trackDeg: number,
  vertRateMs: number,
  onGround: 0 | 1,
  lastContactMs: number,
  country: string,
];

/** Decoded object form. What the store and the views actually work with. */
export interface Aircraft {
  icao24: string;
  /** Trimmed. OpenSky pads callsigns to 8 chars. */
  callsign: string;
  lat: number;
  lon: number;
  /** Barometric altitude, metres. */
  altM: number;
  /** Ground speed, metres/second. */
  velocityMs: number;
  /** True track, degrees clockwise from north. */
  trackDeg: number;
  /** Vertical rate, metres/second. Positive is climbing. */
  vertRateMs: number;
  onGround: boolean;
  /** Epoch milliseconds. The clock dead reckoning projects forward from. */
  lastContactMs: number;
  country: string;
}

/**
 * Server -> client stream frames.
 *
 * The first frame after connect must be a `snapshot` — a client connecting at
 * second 89 of a 90s poll cycle cannot wait for the next poll to see a map.
 * Everything after that is a `delta` against what that client last received.
 */
export type StreamMessage =
  | { type: 'snapshot'; t: number; aircraft: AircraftTuple[] }
  | { type: 'delta'; t: number; changed: AircraftTuple[]; removed: string[] };

/** Shape of `GET /api/health`. Used to watch the OpenSky credit burn. */
export interface HealthResponse {
  ok: boolean;
  /** Whether a valid OAuth2 token is currently cached. */
  hasToken: boolean;
  /** Credits spent since UTC midnight. 4 per global poll. */
  creditsToday: number;
  /** Daily budget: 4000 unauthenticated-tier, 8000 if feeding data to OpenSky. */
  creditBudget: number;
  /** Epoch ms of the last successful poll, or null before the first one. */
  lastPollMs: number | null;
  /** Aircraft currently in the store. */
  aircraftCount: number;
  pollIntervalMs: number;
}
