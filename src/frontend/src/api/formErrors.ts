import { notifications } from "@mantine/notifications";
import { ApiError } from "./types";

const FIELD_MAP: Record<string, string> = {
  passwordConfirmation: "confirmPassword",
};

export function applyFormApiError(
  error: unknown,
  setFieldError: (path: string, error: string) => void,
  setFormError: (message: string) => void,
): void {
  if (!(error instanceof ApiError)) {
    notifications.show({
      color: "red",
      title: "Request failed",
      message: "Something went wrong. Please try again.",
    });
    return;
  }

  if (error.status === 422) {
    let mapped = false;
    for (const item of error.errors) {
      const field = item.field
        ? (FIELD_MAP[item.field] ?? item.field)
        : undefined;
      if (field) {
        setFieldError(field, item.message);
        mapped = true;
      }
    }
    if (!mapped) {
      setFormError(error.message);
    }
    return;
  }

  if (error.status === 401) {
    setFormError(error.message || "Invalid email or password");
    return;
  }

  notifications.show({
    color: "red",
    title: "Request failed",
    message: error.message,
  });
}
