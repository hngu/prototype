import { client } from "./client";

function unwrapData<T>(payload: { data: T }): T {
  return payload.data;
}

export async function shortenUrl(payload: {
  url: string;
  alias?: string;
}): Promise<{ shortUrl: string }> {
  const response = await client.api.shortUrls.store({
    body: {
      url: payload.url,
      ...(payload.alias ? { alias: payload.alias } : {}),
    },
  });
  return unwrapData(response);
}
