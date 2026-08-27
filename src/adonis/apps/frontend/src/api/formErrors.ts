import { notifications } from "@mantine/notifications";
import { TuyauHTTPError } from "@tuyau/core/client";

const FIELD_MAP: Record<string, string> = {
  passwordConfirmation: "confirmPassword",
};

function vineFieldErrors(
  payload: unknown,
): { field?: string; message: string }[] | null {
  if (
    payload === null ||
    typeof payload !== "object" ||
    !("errors" in payload) ||
    !Array.isArray(payload.errors)
  ) {
    return null;
  }

  return payload.errors.flatMap((item: unknown) => {
    if (item !== null && typeof item === "object" && "message" in item) {
      const entry = item as { field?: string; message: string };
      return [
        {
          message: String(entry.message),
          field: entry.field,
        },
      ];
    }
    return [];
  });
}

function firstApiMessage(payload: unknown): string | undefined {
  return vineFieldErrors(payload)?.[0]?.message;
}

export function applyFormApiError(
  error: unknown,
  setFieldError: (path: string, error: string) => void,
  setFormError: (message: string) => void,
): void {
  if (!(error instanceof TuyauHTTPError)) {
    notifications.show({
      color: "red",
      title: "Request failed",
      message: "Something went wrong. Please try again.",
    });
    return;
  }

  const payload = error.response as unknown;

  if (error.status === 422) {
    const fields = vineFieldErrors(payload);
    let mapped = false;
    if (fields) {
      for (const item of fields) {
        const field = item.field
          ? (FIELD_MAP[item.field] ?? item.field)
          : undefined;
        if (field) {
          setFieldError(field, item.message);
          mapped = true;
        }
      }
    }
    if (!mapped) {
      setFormError(firstApiMessage(payload) || error.message);
    }
    return;
  }

  if (error.status === 401 || error.status === 400) {
    setFormError(
      firstApiMessage(payload) || error.message || "Invalid email or password",
    );
    return;
  }

  notifications.show({
    color: "red",
    title: "Request failed",
    message: error.message,
  });
}
