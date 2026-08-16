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

export interface AdonisError {
  field?: string;
  message: string;
  rule?: string;
}

export class ApiError extends Error {
  readonly status: number;
  readonly errors: AdonisError[];

  constructor(status: number, errors: AdonisError[], message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.errors = errors;
  }

  static fromResponse(status: number, payload: unknown): ApiError {
    const errors = parseAdonisErrors(payload);
    const message = errors[0]?.message ?? `Request failed with status ${status}`;
    return new ApiError(status, errors, message);
  }
}

function parseAdonisErrors(payload: unknown): AdonisError[] {
  if (
    payload !== null &&
    typeof payload === "object" &&
    "errors" in payload &&
    Array.isArray(payload.errors)
  ) {
    return payload.errors.flatMap((item) => {
      if (item !== null && typeof item === "object" && "message" in item) {
        const entry = item as AdonisError;
        return [
          {
            message: String(entry.message),
            field: entry.field,
            rule: entry.rule,
          },
        ];
      }
      return [];
    });
  }

  return [{ message: "Request failed" }];
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
