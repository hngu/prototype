import { useState } from "react";
import { useForm } from "@mantine/form";
import {
  Alert,
  Anchor,
  Box,
  Button,
  Group,
  TextInput,
} from "@mantine/core";
import { applyFormApiError } from "../../api/formErrors";
import { useShortenURL } from "../../hooks/useShortenURL";
import { validateAlias, validateLongUrl } from "../../validations/shortUrl";

export const ShortURL = () => {
  const { shortenURL, isLoading, error, shortUrl } = useShortenURL();
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm({
    mode: "uncontrolled",
    initialValues: {
      url: "",
      alias: "",
    },
    validate: {
      url: validateLongUrl,
      alias: validateAlias,
    },
  });

  const alertMessage = formError ?? error;

  return (
    <Box maw={480} mx="auto" pt="xl">
      <form
        onSubmit={form.onSubmit(async (values) => {
          setFormError(null);
          const alias = values.alias.trim();
          try {
            await shortenURL(values.url.trim(), alias || undefined);
          } catch (err) {
            applyFormApiError(err, form.setFieldError, setFormError);
          }
        })}
      >
        {alertMessage ? (
          <Alert color="red" mb="md" title="Could not shorten URL">
            {alertMessage}
          </Alert>
        ) : null}
        <TextInput
          label="Long URL"
          description="URL that you want to shorten"
          placeholder="https://example.com/very/long/path"
          withAsterisk
          key={form.key("url")}
          {...form.getInputProps("url")}
        />
        <TextInput
          mt="sm"
          label="Alias"
          description="Optional custom slug for the shortened URL"
          placeholder="my-link"
          key={form.key("alias")}
          {...form.getInputProps("alias")}
        />

        <Group justify="flex-end" mt="md">
          <Button type="submit" loading={isLoading}>
            Submit
          </Button>
        </Group>
      </form>

      {shortUrl ? (
        <Alert color="green" mt="md" title="Shortened URL">
          <Anchor href={shortUrl} target="_blank" rel="noreferrer">
            {shortUrl}
          </Anchor>
        </Alert>
      ) : null}
    </Box>
  );
};
