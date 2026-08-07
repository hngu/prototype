import { Box, Grid, Text, Title } from "@mantine/core";
import { Link } from "react-router";
import classes from "./Home.module.css";

interface AppLink {
  name: string;
  description: string;
  url: string;
}

const APPS: AppLink[] = [
  {
    name: "Chatter",
    description: "Chat with friends",
    url: "/app/chatter",
  },
  {
    name: "BookTicket",
    description: "Book your next event here",
    url: "/app/bookticket",
  },
  {
    name: "ShortURL",
    description: "Share a shortened URL",
    url: "/app/shorturl",
  },
];

export const Home = () => {
  return (
    <Box pt="xl" px="xl">
      <Grid gap="lg">
        {APPS.map((app) => (
          <Grid.Col span={4} key={app.name}>
            <Link to={app.url} className={classes.card}>
              <Title order={3} className={classes.title}>
                {app.name}
              </Title>
              <Text className={classes.description}>{app.description}</Text>
            </Link>
          </Grid.Col>
        ))}
      </Grid>
    </Box>
  );
};
