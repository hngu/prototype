import { useState } from "react";
import { Link } from "react-router";
import { useForm } from "@mantine/form";
import {
  Alert,
  Anchor,
  PasswordInput,
  Group,
  Button,
  Box,
  TextInput,
  Text,
} from "@mantine/core";
import { validateEmail, validatePassword } from "../../validations/auth";
import { useAuth } from "../../hooks/useAuth";
import { applyFormApiError } from "../../api/formErrors";
import { LOGIN_ROUTE } from "..";

export const Signup = () => {
  const { signup, isSubmitting } = useAuth();
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm({
    mode: "uncontrolled",
    initialValues: {
      fullName: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
    validate: {
      email: validateEmail,
      password: validatePassword,
      confirmPassword: (value, values) =>
        value !== values.password ? "Passwords did not match" : null,
    },
  });

  return (
    <Box maw={340} mx="auto" pt="xl">
      <form
        onSubmit={form.onSubmit(async (values) => {
          setFormError(null);
          try {
            await signup({
              fullName: values.fullName,
              email: values.email,
              password: values.password,
              passwordConfirmation: values.confirmPassword,
            });
          } catch (error) {
            applyFormApiError(error, form.setFieldError, setFormError);
          }
        })}
      >
        {formError ? (
          <Alert color="red" mb="md" title="Could not sign up">
            {formError}
          </Alert>
        ) : null}
        <TextInput
          label="Full name"
          placeholder="Full name"
          key={form.key("fullName")}
          {...form.getInputProps("fullName")}
        />
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
        <PasswordInput
          mt="sm"
          label="Confirm password"
          placeholder="Confirm password"
          key={form.key("confirmPassword")}
          {...form.getInputProps("confirmPassword")}
        />

        <Group justify="flex-end" mt="md">
          <Button type="submit" loading={isSubmitting}>
            Submit
          </Button>
        </Group>

        <Text size="sm" mt="md" ta="center">
          Already have an account? Log in{" "}
          <Anchor component={Link} to={LOGIN_ROUTE}>
            here
          </Anchor>
          .
        </Text>
      </form>
    </Box>
  );
};
