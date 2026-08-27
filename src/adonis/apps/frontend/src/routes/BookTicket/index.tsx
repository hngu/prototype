import { Box, Table } from "@mantine/core";
import { BookTicketSearch } from "../../components/BookTicketSearch";

const searchResults = [
  { position: 6, mass: 12.011, symbol: 'C', name: 'Carbon' },
  { position: 7, mass: 14.007, symbol: 'N', name: 'Nitrogen' },
  { position: 39, mass: 88.906, symbol: 'Y', name: 'Yttrium' },
  { position: 56, mass: 137.33, symbol: 'Ba', name: 'Barium' },
  { position: 58, mass: 140.12, symbol: 'Ce', name: 'Cerium' },
];

export const BookTicket = () => {
  return (
    <Box pt="xl" px="xl">
      <BookTicketSearch />
      <Table mt="md">
      <Table.Thead>
        <Table.Tr>
          <Table.Th>Event name</Table.Th>
          <Table.Th>Date</Table.Th>
          <Table.Th>Venue</Table.Th>
          <Table.Th></Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>{searchResults.map(result => (
        <Table.Tr key={result.name}>
          <Table.Td>{result.position}</Table.Td>
          <Table.Td>{result.name}</Table.Td>
          <Table.Td>{result.symbol}</Table.Td>
          <Table.Td>{result.mass}</Table.Td>
        </Table.Tr>
      ))}</Table.Tbody>
      </Table>
    </Box>
  );
};