import { readCookieValue } from "../hooks/useCookie";
import { ApiError } from "./types";

export const ACCESS_TOKEN_COOKIE = "accessToken";

const API_BASE_URL =
  import.meta.env.VITE_API_URL ?? "http://localhost:3333";

function getAccessToken(): string | null {
  return readCookieValue<string | null>({
    key: ACCESS_TOKEN_COOKIE,
    defaultValue: null,
  });
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers = new Headers(options.headers);

  if (!headers.has("Accept")) {
    headers.set("Accept", "application/json");
  }

  if (options.body !== undefined && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const token = getAccessToken();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  const text = await response.text();
  let payload: unknown = null;

  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { errors: [{ message: text }] };
    }
  }

  if (!response.ok) {
    throw ApiError.fromResponse(response.status, payload);
  }

  return payload as T;
}
