/**
 * Exercise: A type made of string
 * Lesson:   typescript-type-manipulation/template-literal-types
 *
 * Replace every `throw new Error('TODO: …')` with a real implementation.
 *
 * The types below are **given** and are the exercise's subject. All four of the string
 * intrinsics appear across them and the tests: `Uppercase`, `Lowercase`, `Capitalize`
 * and `Uncapitalize`.
 *
 * Your job is the runtime half — and notice how each function's *implementation* is the
 * same transformation its return type already describes. Writing both is the exercise.
 */

export interface Settings {
  theme: string
  fontSize: number
}

/** Every key of `Settings`, as data, so the runtime can walk them. */
export const SETTING_KEYS = ['theme', 'fontSize'] as const

export type SettingKey = (typeof SETTING_KEYS)[number]

/** `'GET' | 'POST' | 'DELETE'`. */
export type Method = 'GET' | 'POST' | 'DELETE'

/**
 * A method and a path in one string, checked at compile time.
 *
 * `'GET /users'` fits. `'PATCH /users'` does not, and neither does `'GET users'` — the
 * space and the slash are part of the type.
 */
export type Route = `${Method} /${string}`

/** `SETTING_THEME`, `SETTING_FONTSIZE`. */
export type EnvName<K extends string> = `SETTING_${Uppercase<K>}`

/**
 * One handler per setting, with the key rewritten.
 *
 * `Handlers<Settings>` is
 * `{ readonly onThemeChange: (next: string) => void; readonly onFontSizeChange: (next: number) => void }`.
 */
export type Handlers<T> = {
  readonly [K in keyof T & string as `on${Capitalize<K>}Change`]: (next: T[K]) => void
}

/** `'theme'` → `'onThemeChange'`. The return type says which one, exactly. */
export function handlerNameFor<K extends SettingKey>(key: K): `on${Capitalize<K>}Change` {
  throw new Error('TODO: capitalise the first letter and wrap it')
}

/** `'fontSize'` → `'SETTING_FONTSIZE'`. */
export function envNameFor<K extends SettingKey>(key: K): EnvName<K> {
  throw new Error('TODO: upper-case the whole key and prefix it')
}

/**
 * Splits a route.
 *
 *   parseRoute('GET /users')  →  { method: 'GET', path: '/users' }
 *
 * The `Route` type guarantees there is a space and that what precedes it is a `Method`,
 * so the body needs no validation at all — which is the point.
 */
export function parseRoute(route: Route): { readonly method: Method; readonly path: string } {
  throw new Error('TODO: split once at the first space')
}

/**
 * Builds a handler per setting, each one reporting its own name and the new value.
 *
 * Derive the names with `handlerNameFor` rather than writing them out — the whole point
 * is that the type and the code perform the same transformation.
 */
export function makeHandlers(
  record: (name: string, next: unknown) => void,
): Handlers<Settings> {
  throw new Error('TODO: walk SETTING_KEYS and build the object')
}
