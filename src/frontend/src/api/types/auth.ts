export interface User {
  id: number;
  fullName: string | null;
  email: string;
  createdAt: string;
  updatedAt: string;
  initials: string;
}

export interface AuthPayload {
  user: User;
  token: string;
}

export interface SignupPayload {
  fullName?: string | null;
  email: string;
  password: string;
  passwordConfirmation: string;
}

export interface LoginPayload {
  email: string;
  password: string;
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
