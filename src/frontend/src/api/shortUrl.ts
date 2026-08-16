import { apiFetch } from "./client";
import type { ShortenUrlPayload, ShortenUrlResult } from "./types/shortUrl";

interface DataEnvelope<T> {
  data: T;
}

export function shortenUrl(
  payload: ShortenUrlPayload,
): Promise<ShortenUrlResult> {
  return apiFetch<DataEnvelope<ShortenUrlResult>>("/api/v1/short-urls", {
    method: "POST",
    body: JSON.stringify(payload),
  }).then((response) => response.data);
}
