import { useForm } from '@mantine/form';
import { PasswordInput, Group, Button, Box, TextInput } from '@mantine/core';
import { validateEmail, validatePassword } from '../../validations/auth';


export const Signup = () => {
  const form = useForm({
    mode: 'uncontrolled',
    initialValues: {
      email: '',
      password: '',
      confirmPassword: '',
    },

    validate: {
      email: validateEmail,
      password: validatePassword,
      confirmPassword: (value, values) =>
        value !== values.password ? 'Passwords did not match' : null,
    },
  });

  return (
    <Box maw={340} mx="auto">
      <form onSubmit={form.onSubmit((values) => console.log(values))}>
        <TextInput label="Email"
          placeholder="Email"
          key={form.key('email')}
          {...form.getInputProps('email')} />
        <PasswordInput
          label="Password"
          placeholder="Password"
          key={form.key('password')}
          {...form.getInputProps('password')}
        />

        <PasswordInput
          mt="sm"
          label="Confirm password"
          placeholder="Confirm password"
          key={form.key('confirmPassword')}
          {...form.getInputProps('confirmPassword')}
        />

        <Group justify="flex-end" mt="md">
          <Button type="submit">Submit</Button>
        </Group>
      </form>
    </Box>
  );
};