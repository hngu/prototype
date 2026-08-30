import { useCallback, useState } from "react";
import { TuyauHTTPError } from "@tuyau/core/client";
import {
  searchEvents,
  type Event,
  type SearchEventsQuery,
} from "../api/events";
import { firstApiMessage, vineFieldErrors } from "../api/formErrors";

export function useSearchEvents() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nearError, setNearError] = useState<string | null>(null);
  const [events, setEvents] = useState<Event[]>([]);

  const search = useCallback(async (filters: SearchEventsQuery = {}) => {
    setIsLoading(true);
    setError(null);
    setNearError(null);

    try {
      const result = await searchEvents(filters);
      setEvents(result);
      return result;
    } catch (err) {
      if (err instanceof TuyauHTTPError && err.status === 422) {
        const near = vineFieldErrors(err.response)?.find(
          (item) => item.field === "near",
        );
        if (near) {
          setNearError(near.message);
          return;
        }
        setError(firstApiMessage(err.response) || err.message);
        return;
      }

      const message =
        err instanceof TuyauHTTPError ? err.message : "Something went wrong";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { events, isLoading, error, nearError, search };
}
