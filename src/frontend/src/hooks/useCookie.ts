import { useCallback, useEffect, useState } from "react";

export type SameSite = "strict" | "lax" | "none";

export interface CookieAttributes {
  /** Absolute expiry date, or number of days from now */
  expires?: Date | number;
  /** Lifetime in seconds (`Max-Age`) */
  maxAge?: number;
  /** Defaults to `/` */
  path?: string;
  domain?: string;
  /** Restrict to HTTPS. Implied when `sameSite` is `"none"`. */
  secure?: boolean;
  sameSite?: SameSite;
}

export interface UseCookieOptions<T> extends CookieAttributes {
  /** Cookie name */
  key: string;
  /** Used when the cookie is missing */
  defaultValue?: T;
  /**
   * When `true` (default), the cookie is read in an effect after mount.
   * Avoids SSR/hydration mismatches; set `false` to read synchronously.
   */
  getInitialValueInEffect?: boolean;
  serialize?: (value: T) => string;
  deserialize?: (value: string | undefined) => T;
}

export type UseCookieReturnValue<T> = [
  T,
  (value: T | ((prev: T) => T), attributes?: CookieAttributes) => void,
  (attributes?: Pick<CookieAttributes, "path" | "domain">) => void,
];

function serializeJSON<T>(value: T): string {
  try {
    return JSON.stringify(value);
  } catch {
    throw new Error("useCookie: Failed to serialize the value");
  }
}

function deserializeJSON<T>(value: string | undefined): T {
  if (value === undefined) {
    return undefined as T;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return value as T;
  }
}

function isBrowser(): boolean {
  return typeof document !== "undefined";
}

export function getCookie(name: string): string | undefined {
  if (!isBrowser()) {
    return undefined;
  }

  const encodedName = encodeURIComponent(name);
  const cookies = document.cookie ? document.cookie.split("; ") : [];

  for (const cookie of cookies) {
    const separatorIndex = cookie.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = cookie.slice(0, separatorIndex);
    if (key === encodedName || key === name) {
      return decodeURIComponent(cookie.slice(separatorIndex + 1));
    }
  }

  return undefined;
}

export function setCookie(
  name: string,
  value: string,
  attributes: CookieAttributes = {},
): void {
  if (!isBrowser()) {
    return;
  }

  const {
    expires,
    maxAge,
    path = "/",
    domain,
    sameSite = "lax",
    secure = sameSite === "none",
  } = attributes;

  let cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}`;

  if (expires !== undefined) {
    const date =
      expires instanceof Date
        ? expires
        : new Date(Date.now() + expires * 86_400_000);
    cookie += `; expires=${date.toUTCString()}`;
  }

  if (maxAge !== undefined) {
    cookie += `; max-age=${Math.trunc(maxAge)}`;
  }

  cookie += `; path=${path}`;

  if (domain) {
    cookie += `; domain=${domain}`;
  }

  if (secure) {
    cookie += "; secure";
  }

  cookie += `; samesite=${sameSite}`;

  document.cookie = cookie;
}

export function deleteCookie(
  name: string,
  attributes: Pick<CookieAttributes, "path" | "domain"> = {},
): void {
  setCookie(name, "", {
    ...attributes,
    path: attributes.path ?? "/",
    expires: new Date(0),
    maxAge: 0,
  });
}

export function readCookieValue<T>(
  options: UseCookieOptions<T> & { defaultValue: T },
): T;
export function readCookieValue<T>(
  options: UseCookieOptions<T>,
): T | undefined;
export function readCookieValue<T>({
  key,
  defaultValue,
  deserialize = deserializeJSON,
}: UseCookieOptions<T>): T | undefined {
  const raw = getCookie(key);
  return raw !== undefined ? deserialize(raw) : defaultValue;
}

export function useCookie<T = string>(
  options: UseCookieOptions<T> & { defaultValue: T },
): UseCookieReturnValue<T>;
export function useCookie<T = string>(
  options: UseCookieOptions<T>,
): UseCookieReturnValue<T | undefined>;
export function useCookie<T = string>({
  key,
  defaultValue,
  getInitialValueInEffect = true,
  serialize = serializeJSON,
  deserialize = deserializeJSON,
  expires,
  maxAge,
  path = "/",
  domain,
  secure,
  sameSite,
}: UseCookieOptions<T>): UseCookieReturnValue<T | undefined> {
  const readValue = (skipCookie: boolean): T | undefined => {
    if (skipCookie || !isBrowser()) {
      return defaultValue;
    }

    const raw = getCookie(key);
    return raw !== undefined ? deserialize(raw) : defaultValue;
  };

  const [value, setValue] = useState<T | undefined>(() =>
    readValue(getInitialValueInEffect),
  );

  useEffect(() => {
    if (getInitialValueInEffect) {
      setValue(readValue(false));
    }
  }, [key]);

  const setCookieValue = useCallback(
    (
      next: T | undefined | ((prev: T | undefined) => T | undefined),
      attributes?: CookieAttributes,
    ) => {
      setValue((current) => {
        const resolved =
          typeof next === "function"
            ? (next as (prev: T | undefined) => T | undefined)(current)
            : next;

        if (resolved === undefined) {
          deleteCookie(key, {
            path: attributes?.path ?? path,
            domain: attributes?.domain ?? domain,
          });
          return defaultValue;
        }

        setCookie(key, serialize(resolved), {
          expires,
          maxAge,
          path,
          domain,
          secure,
          sameSite,
          ...attributes,
        });
        return resolved;
      });
    },
    [key, defaultValue, serialize, expires, maxAge, path, domain, secure, sameSite],
  );

  const removeCookieValue = useCallback(
    (attributes?: Pick<CookieAttributes, "path" | "domain">) => {
      deleteCookie(key, {
        path: attributes?.path ?? path,
        domain: attributes?.domain ?? domain,
      });
      setValue(defaultValue);
    },
    [key, defaultValue, path, domain],
  );

  return [value, setCookieValue, removeCookieValue];
}
