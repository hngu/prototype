import { useState } from "react";
import { Button, Group, Select, TextInput } from "@mantine/core";
import { DatePickerInput } from "@mantine/dates";

const CATEGORIES = [
  { value: "concerts", label: "Concerts" },
  { value: "sports", label: "Sports" },
  { value: "theater", label: "Theater" },
  { value: "comedy", label: "Comedy" },
  { value: "festivals", label: "Festivals" },
  { value: "family", label: "Family" },
];

export const BookTicketSearch = () => {
  const [location, setLocation] = useState("");
  const [date, setDate] = useState<string | null>(null);
  const [category, setCategory] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  return (
    <Group grow align="flex-end" wrap="wrap">
      <TextInput
        label="Location"
        placeholder="City or venue"
        value={location}
        onChange={(event) => setLocation(event.currentTarget.value)}
      />
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
        data={CATEGORIES}
        value={category}
        onChange={(value) => setCategory(typeof value === "string" ? value : null)}
        clearable
      />
      <TextInput
        label="Search"
        placeholder="Search events"
        value={query}
        onChange={(event) => setQuery(event.currentTarget.value)}
      />
      <Button>Search</Button>
    </Group>
  );
};
