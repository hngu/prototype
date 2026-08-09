/**
 * Reference solution: A type made of string
 * Lesson: typescript-type-manipulation/template-literal-types
 */

export interface Settings {
  theme: string
  fontSize: number
}

export const SETTING_KEYS = ['theme', 'fontSize'] as const

export type SettingKey = (typeof SETTING_KEYS)[number]

export type Method = 'GET' | 'POST' | 'DELETE'

/* A template literal type is a string *pattern*. `${Method} /${string}` accepts exactly
   the strings that start with one of three words, then a space, then a slash, then
   anything.

   Note it **distributes** over the union in the first slot: this is three patterns, one
   per method, not one pattern containing a union. That is why the compiler can tell you
   `'PATCH /users'` does not fit, and it is also why a template literal type over two
   unions of ten members each produces a hundred string literals — the reason these get
   slow if you are careless. */
export type Route = `${Method} /${string}`

/* `Uppercase` is one of four **intrinsic** string types — `Uppercase`, `Lowercase`,
   `Capitalize`, `Uncapitalize`. They are not written in TypeScript; the compiler
   implements them natively, which is why you cannot write a fifth one yourself. */
export type EnvName<K extends string> = `SETTING_${Uppercase<K>}`

export type Handlers<T> = {
  readonly [K in keyof T & string as `on${Capitalize<K>}Change`]: (next: T[K]) => void
}

/* The return type is a template literal over `K`, so `handlerNameFor('theme')` is typed
   `'onThemeChange'` — the exact literal, not `string`. That is what makes it usable as a
   key later.

   The cast is the familiar generic problem from lesson 5: `\`on${…}Change\`` built from a
   `K` the compiler has not resolved cannot be checked against `` `on${Capitalize<K>}Change` ``,
   even though it is the same transformation. `charAt(0).toUpperCase() + slice(1)` is
   `Capitalize`'s runtime twin, and the two have to be written to agree. */
export function handlerNameFor<K extends SettingKey>(key: K): `on${Capitalize<K>}Change` {
  return `on${key.charAt(0).toUpperCase()}${key.slice(1)}Change` as `on${Capitalize<K>}Change`
}

/* Same shape. `toUpperCase()` is `Uppercase`'s twin — note it upper-cases the *whole*
   string, where `Capitalize` touches only the first character. Mixing the two up is the
   most common mistake with these four. */
export function envNameFor<K extends SettingKey>(key: K): EnvName<K> {
  return `SETTING_${key.toUpperCase()}` as EnvName<K>
}

/* Look at what this function does *not* do: no validation, no error path, no
   `undefined` in the return type. The `Route` type already guaranteed there is a space
   and that what precedes it is a `Method`, so a malformed route was rejected at the call
   site and cannot arrive here.

   `indexOf` and `slice` rather than `split(' ')`, because `split` hands back
   `string[]` and `noUncheckedIndexedAccess` would then make both halves
   `string | undefined` — reintroducing exactly the uncertainty the type had removed.
   The `as Method` is doing the same job as the missing validation: the type promised it. */
export function parseRoute(route: Route): { readonly method: Method; readonly path: string } {
  const space = route.indexOf(' ')

  return {
    method: route.slice(0, space) as Method,
    path: route.slice(space + 1),
  }
}

/* The transformation written twice — once as `Handlers<T>`'s `as` clause, once here — and
   `handlerNameFor` is what keeps the two agreeing. Writing `onThemeChange:` and
   `onFontSizeChange:` out by hand would pass every test in the file and drift the moment
   a third setting appears.

   One cast, for the usual `Object.fromEntries` reason from lesson 6. */
export function makeHandlers(record: (name: string, next: unknown) => void): Handlers<Settings> {
  const entries = SETTING_KEYS.map((key) => {
    const name = handlerNameFor(key)
    return [name, (next: unknown) => record(name, next)]
  })

  return Object.fromEntries(entries) as Handlers<Settings>
}
