import { useState, type SubmitEventHandler } from "react";
import { Button, Group, Select, TextInput } from "@mantine/core";
import { DatePickerInput } from "@mantine/dates";
import {
  EVENT_CATEGORIES,
  type EventCategory,
} from "@api-starter-kit/backend/event-categories";
import dayjs from "dayjs";
import type { SearchEventsQuery } from "../api/events";

const CATEGORY_OPTIONS = EVENT_CATEGORIES.map((value) => ({
  value,
  label: value.charAt(0).toUpperCase() + value.slice(1),
}));

function isEventCategory(value: string): value is EventCategory {
  return (EVENT_CATEGORIES as readonly string[]).includes(value);
}

type BookTicketSearchProps = {
  onSearch: (filters: SearchEventsQuery) => void;
  isLoading: boolean;
  nearError?: string | null;
};

export const BookTicketSearch = ({
  onSearch,
  isLoading,
  nearError,
}: BookTicketSearchProps) => {
  const [date, setDate] = useState<string | null>(null);
  const [category, setCategory] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [near, setNear] = useState("");

  const handleSubmit: SubmitEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault();

    const filters: SearchEventsQuery = {};

    if (date) {
      filters.date = dayjs(date).format("YYYY-MM-DD");
    }
    if (category && isEventCategory(category)) {
      filters.category = category;
    }
    if (query.trim()) {
      filters.q = query.trim();
    }
    if (near.trim()) {
      filters.near = near.trim();
    }

    onSearch(filters);
  };

  return (
    <form onSubmit={handleSubmit}>
      <Group grow align="flex-end" wrap="wrap">
        <DatePickerInput
          label="Date"
          placeholder="Pick a date"
          value={date}
          onChange={setDate}
          clearable
        />
        <Select
          label="Category"
          placeholder="All categories"
          data={CATEGORY_OPTIONS}
          value={category}
          onChange={(value) =>
            setCategory(typeof value === "string" ? value : null)
          }
          clearable
        />
        <TextInput
          label="Location"
          placeholder="City or address"
          value={near}
          error={nearError}
          onChange={(event) => setNear(event.currentTarget.value)}
        />
        <TextInput
          label="Search"
          placeholder="Search events"
          value={query}
          onChange={(event) => setQuery(event.currentTarget.value)}
        />
        <Button type="submit" loading={isLoading}>
          Search
        </Button>
      </Group>
    </form>
  );
};
