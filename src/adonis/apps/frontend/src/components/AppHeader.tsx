import { Link } from "react-router";
import { Anchor, Button, Group, Text } from "@mantine/core";
import { useAuth } from "../hooks/useAuth";
import { LOGIN_ROUTE, SIGNUP_ROUTE } from "../routes";

export const AppHeader = () => {
  const { user, logout, isSubmitting } = useAuth();

  return (
    <Group justify="space-between" px="xl" py="sm">
      <Anchor component={Link} to="/" underline="never" fw={600}>
        Prototype
      </Anchor>
      <Group gap="sm">
        {user ? (
          <>
            <Text size="sm">{user.email}</Text>
            <Button
              variant="default"
              onClick={() => {
                void logout();
              }}
              loading={isSubmitting}
            >
              Log out
            </Button>
          </>
        ) : (
          <>
            <Button component={Link} to={LOGIN_ROUTE} variant="default">
              Log in
            </Button>
            <Button component={Link} to={SIGNUP_ROUTE}>
              Sign up
            </Button>
          </>
        )}
      </Group>
    </Group>
  );
};
