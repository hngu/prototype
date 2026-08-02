import express, { type Application, type Request, type Response } from "express";
import type { HealthResponse } from "@shared/flight.js";
import { config, hasOpenSkyCredentials } from "./config.js";

const app: Application = express();

// No body parsers: every route in this service is a GET. Add them back if that
// ever stops being true.

/**
 * Liveness plus the OpenSky credit burn.
 *
 * Phase 0 serves placeholders; the poller and store fill these in during Phase 1.
 * Its real job right now is to prove the browser -> Vite proxy -> Express path
 * works before any OpenSky code exists, so the first thing under test is the
 * plumbing alone rather than the plumbing and the OAuth flow together.
 */
app.get("/api/health", (_req: Request, res: Response<HealthResponse>) => {
  res.json({
    ok: true,
    hasToken: false,
    creditsToday: 0,
    creditBudget: config.creditBudget,
    lastPollMs: null,
    aircraftCount: 0,
    pollIntervalMs: config.pollIntervalMs,
  });
});

app.listen(config.port, () => {
  console.log(`Server is running on http://localhost:${config.port}`);
  if (!hasOpenSkyCredentials()) {
    console.warn(
      "OPENSKY_CLIENT_ID/OPENSKY_CLIENT_SECRET are unset — polling will not start. " +
        "Register an API client at opensky-network.org and copy .env.example to .env.",
    );
  }
});
