import { apiFetch } from "./client";
import type { AuthPayload, LoginPayload, SignupPayload, User } from "./types";

interface DataEnvelope<T> {
  data: T;
}

export function login(payload: LoginPayload): Promise<AuthPayload> {
  return apiFetch<DataEnvelope<AuthPayload>>("/api/v1/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  }).then((response) => response.data);
}

export function signup(payload: SignupPayload): Promise<AuthPayload> {
  return apiFetch<DataEnvelope<AuthPayload>>("/api/v1/auth/signup", {
    method: "POST",
    body: JSON.stringify(payload),
  }).then((response) => response.data);
}

export function getProfile(): Promise<User> {
  return apiFetch<DataEnvelope<User>>("/api/v1/account/profile").then(
    (response) => response.data,
  );
}

export function logout(): Promise<void> {
  return apiFetch<{ message: string }>("/api/v1/account/logout", {
    method: "POST",
  }).then(() => undefined);
}
