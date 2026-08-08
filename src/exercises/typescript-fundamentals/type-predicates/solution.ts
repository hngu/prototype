/**
 * Reference solution: Sign your name to the check
 * Lesson: typescript-fundamentals/type-predicates
 */

export interface User {
  readonly id: string
  readonly name: string
}

/* `value is string` is a **type predicate**. Without it, this function returns
   `boolean` and the compiler learns nothing from calling it — `if (check(x))` would
   leave `x` exactly as `unknown` as it was before. With it, the `if` narrows.

   The compiler does not verify the claim. It takes your word for it, which is the
   trade: you get to teach it a check it could never have worked out on its own,
   and in exchange the body has to actually be right. A predicate with a sloppy
   body is worse than no predicate, because it launders a lie into a type. */
export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

/* Two things people get wrong here, both inherited from JavaScript rather than
   TypeScript:

   - `typeof null === 'object'`, a bug from 1995 that can never be fixed, so the
     null check is not optional.
   - arrays are objects too, so `Array.isArray` is what separates "a bag of named
     fields" from "a list".

   `Record<string, unknown>` is the honest result. Not `Record<string, any>`:
   `unknown` means the caller still has to check each field before using it, which
   is exactly the situation they are in. */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/* An **assertion function**. It is a predicate's louder cousin: rather than
   returning a boolean for you to branch on, it throws, and the compiler treats
   everything after the call as though the check passed.

   `asserts value is T` has one hard requirement worth knowing before it bites
   you: the compiler must be able to see, at the call site, that the thing you are
   calling is an assertion function. A locally declared `function` is fine. A value
   whose type it had to infer is not — `const check = assertDefined` then
   `check(x)` fails with "Assertions require every name in the call target to be
   declared with an explicit type annotation". `solution.test.ts` annotates its
   `subject` for exactly this reason. */
export function assertDefined<T>(value: T | null | undefined, label: string): asserts value is T {
  if (value === null || value === undefined) {
    throw new Error(`${label} is missing`)
  }
}

/* Both guards, doing the job they were built for. Note `source[field]` is typed
   `unknown` — `isRecord` promised a `Record<string, unknown>` and meant it, so the
   value still has to be checked, and `isNonEmptyString` is what does the checking.

   The pay-off is the `return raw` on the last line. `raw` was `unknown` two lines
   above; it is a `string` now, with no cast anywhere in the function, purely
   because the guard signed its name to the claim. */
export function requireField(source: unknown, field: string): string {
  if (!isRecord(source)) {
    throw new Error('expected an object')
  }

  const raw = source[field]
  if (!isNonEmptyString(raw)) {
    throw new Error(`field "${field}" is not a non-empty string`)
  }

  return raw
}

/* `find` returns `User | undefined`, because it might not find anything — so
   `found.name` is an error on the very next line. There are three ways out and
   only one of them is honest:

     found!.name                      lie to the compiler, crash later
     if (found === undefined) throw    fine, and three lines every time
     assertDefined(found, …)           the check, named, reusable

   After the assertion, `found` is `User`. Not because anything was reassigned,
   but because the compiler believes the signature. */
export function nameOf(users: readonly User[], id: string): string {
  const found = users.find((user) => user.id === id)
  assertDefined(found, `user ${id}`)
  return found.name
}
