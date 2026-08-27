import { createTuyau } from "@tuyau/core/client";
import { registry } from "@api-starter-kit/backend/registry";
import { readCookieValue } from "../hooks/useCookie";

export const ACCESS_TOKEN_COOKIE = "accessToken";

export const client = createTuyau({
  baseUrl: import.meta.env.VITE_API_URL ?? "https://adonis.app",
  registry,
  headers: { Accept: "application/json" },
  hooks: {
    beforeRequest: [
      (request) => {
        const token = readCookieValue<string | null>({
          key: ACCESS_TOKEN_COOKIE,
          defaultValue: null,
        });
        if (token) {
          request.headers.set("Authorization", `Bearer ${token}`);
        }
      },
    ],
  },
});
