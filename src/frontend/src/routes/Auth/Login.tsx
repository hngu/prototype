import { useState } from "react";
import { Link } from "react-router";
import { useForm } from "@mantine/form";
import {
  Alert,
  PasswordInput,
  Group,
  Button,
  Box,
  TextInput,
  Text,
  Anchor,
} from "@mantine/core";
import { SIGNUP_ROUTE } from "..";
import { validateEmail, validatePassword } from "../../validations/auth";
import { useAuth } from "../../hooks/useAuth";
import { applyFormApiError } from "../../api/formErrors";

export const Login = () => {
  const { login, isSubmitting } = useAuth();
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm({
    mode: "uncontrolled",
    initialValues: {
      email: "",
      password: "",
    },
    validate: {
      email: validateEmail,
      password: validatePassword,
    },
  });

  return (
    <Box maw={340} mx="auto" pt="xl">
      <form
        onSubmit={form.onSubmit(async (values) => {
          setFormError(null);
          try {
            await login(values.email, values.password);
          } catch (error) {
            applyFormApiError(error, form.setFieldError, setFormError);
          }
        })}
      >
        {formError ? (
          <Alert color="red" mb="md" title="Could not log in">
            {formError}
          </Alert>
        ) : null}
        <TextInput
          label="Email"
          placeholder="Email"
          key={form.key("email")}
          {...form.getInputProps("email")}
        />
        <PasswordInput
          label="Password"
          placeholder="Password"
          key={form.key("password")}
          {...form.getInputProps("password")}
        />

        <Group justify="flex-end" mt="md">
          <Button type="submit" loading={isSubmitting}>
            Submit
          </Button>
        </Group>

        <Text size="sm" mt="md" ta="center">
          Don&apos;t have an account? Create one{" "}
          <Anchor component={Link} to={SIGNUP_ROUTE}>
            here
          </Anchor>
          .
        </Text>
      </form>
    </Box>
  );
};
