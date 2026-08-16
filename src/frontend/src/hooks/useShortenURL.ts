import { useCallback, useState } from "react";
import { shortenUrl } from "../api/shortUrl";
import { ApiError } from "../api/types";

export function useShortenURL() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shortUrl, setShortUrl] = useState<string | null>(null);

  const shortenURL = useCallback(async (url: string, alias?: string) => {
    setIsLoading(true);
    setError(null);
    setShortUrl(null);

    try {
      const result = await shortenUrl({
        url,
        ...(alias ? { alias } : {}),
      });
      setShortUrl(result.shortUrl);
      return result;
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Something went wrong";
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { shortenURL, isLoading, error, shortUrl };
}
