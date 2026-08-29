import { useCallback, useState } from "react";
import { TuyauHTTPError } from "@tuyau/core/client";
import {
  searchEvents,
  type Event,
  type SearchEventsQuery,
} from "../api/events";

export function useSearchEvents() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [events, setEvents] = useState<Event[]>([]);

  const search = useCallback(async (filters: SearchEventsQuery = {}) => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await searchEvents(filters);
      setEvents(result);
      return result;
    } catch (err) {
      const message =
        err instanceof TuyauHTTPError ? err.message : "Something went wrong";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { events, isLoading, error, search };
}
