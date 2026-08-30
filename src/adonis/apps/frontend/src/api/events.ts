import type { Data } from "@api-starter-kit/backend/data";
import type { EventCategory } from "@api-starter-kit/backend/event-categories";
import { client } from "./client";

export type Event = Data.Event;

export type SearchEventsQuery = {
  date?: string;
  category?: EventCategory;
  q?: string;
  near?: string;
};

function unwrapData<T>(payload: { data: T }): T {
  return payload.data;
}

export async function searchEvents(
  filters: SearchEventsQuery = {},
): Promise<Event[]> {
  const query: SearchEventsQuery = {};

  if (filters.date) {
    query.date = filters.date;
  }
  if (filters.category) {
    query.category = filters.category;
  }
  if (filters.q?.trim()) {
    query.q = filters.q.trim();
  }
  if (filters.near?.trim()) {
    query.near = filters.near.trim();
  }

  const response = await client.api.events.index({ query });
  return unwrapData(response);
}
