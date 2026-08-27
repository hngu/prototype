import type { Data } from "@api-starter-kit/backend/data";
import { client } from "./client";

export type User = Data.User;

export interface AuthPayload {
  user: User;
  token: string;
}

export function isUser(value: unknown): value is User {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    "email" in value &&
    typeof (value as User).id === "number" &&
    typeof (value as User).email === "string"
  );
}

function unwrapData<T>(payload: { data: T }): T {
  return payload.data;
}

export async function login(payload: {
  email: string;
  password: string;
}): Promise<AuthPayload> {
  const response = await client.api.auth.accessTokens.store({ body: payload });
  return unwrapData(response);
}

export async function signup(payload: {
  fullName: string | null;
  email: string;
  password: string;
  passwordConfirmation: string;
}): Promise<AuthPayload> {
  const response = await client.api.auth.newAccount.store({ body: payload });
  return unwrapData(response);
}

export async function getProfile(): Promise<User> {
  const response = await client.api.profile.profile.show({});
  return unwrapData(response);
}

export async function logout(): Promise<void> {
  await client.api.profile.accessTokens.destroy({});
}
