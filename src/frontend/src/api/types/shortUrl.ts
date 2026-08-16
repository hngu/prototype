export interface ShortenUrlPayload {
  url: string;
  alias?: string;
}

export interface ShortenUrlResult {
  shortUrl: string;
}
