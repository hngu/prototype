/**
 * Environment configuration.
 *
 * Loaded by node's native `--env-file-if-exists` (see package.json scripts), so
 * there is no dotenv dependency. `-if-exists` is deliberate: Phase 0 has to boot
 * and serve /api/health before anyone has registered an OpenSky client.
 */

/** OpenSky charges 4 credits for an unbounded /states/all call. */
export const CREDITS_PER_POLL = 4;

/**
 * Default budget for an authenticated client. Feeding data back to OpenSky
 * raises this to 8000, which would let POLL_INTERVAL_MS drop to ~45s.
 */
const DEFAULT_CREDIT_BUDGET = 4000;

/**
 * 90s => 960 polls/day => 3840 credits, just under the 4000 budget.
 * Lower this only after confirming the budget on the OpenSky account.
 */
const DEFAULT_POLL_INTERVAL_MS = 90_000;

function num(value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export const config = {
  port: num(process.env.PORT, 3001),
  pollIntervalMs: num(process.env.POLL_INTERVAL_MS, DEFAULT_POLL_INTERVAL_MS),
  creditBudget: num(process.env.OPENSKY_CREDIT_BUDGET, DEFAULT_CREDIT_BUDGET),

  /**
   * Never send these to the client. The whole reason this backend exists is that
   * the OpenSky client_secret cannot ship in browser JS.
   */
  openSky: {
    clientId: process.env.OPENSKY_CLIENT_ID ?? '',
    clientSecret: process.env.OPENSKY_CLIENT_SECRET ?? '',
  },
} as const;

/** True once the user has registered an API client and filled in .env. */
export function hasOpenSkyCredentials(): boolean {
  return config.openSky.clientId !== '' && config.openSky.clientSecret !== '';
}
