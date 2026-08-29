import { useEffect } from "react";
import { Alert, Box, Center, Loader, Table, Text } from "@mantine/core";
import dayjs from "dayjs";
import { BookTicketSearch } from "../../components/BookTicketSearch";
import { useSearchEvents } from "../../hooks/useSearchEvents";

export const BookTicket = () => {
  const { events, isLoading, error, search } = useSearchEvents();

  useEffect(() => {
    void search();
  }, [search]);

  return (
    <Box pt="xl" px="xl">
      <BookTicketSearch onSearch={(filters) => void search(filters)} isLoading={isLoading} />
      {error ? (
        <Alert color="red" mt="md" title="Could not load events">
          {error}
        </Alert>
      ) : null}
      {isLoading && events.length === 0 ? (
        <Center mt="md">
          <Loader />
        </Center>
      ) : events.length === 0 && !error ? (
        <Text mt="md" c="dimmed">
          No events found
        </Text>
      ) : events.length > 0 ? (
        <Table mt="md">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Event name</Table.Th>
              <Table.Th>Date</Table.Th>
              <Table.Th>Venue</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {events.map((event) => (
              <Table.Tr key={event.id}>
                <Table.Td>{event.name}</Table.Td>
                <Table.Td>
                  {event.date
                    ? dayjs(event.date.toString()).format("MMM D, YYYY h:mm A")
                    : "—"}
                </Table.Td>
                <Table.Td>{event.venue.name}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      ) : null}
    </Box>
  );
};
