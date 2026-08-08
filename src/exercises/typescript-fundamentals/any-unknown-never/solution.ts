/**
 * Reference solution: Three ways to say I don't know
 * Lesson: typescript-fundamentals/any-unknown-never
 */

export type Status = 'queued' | 'running' | 'done'

export type ParseResult =
  | { readonly ok: true; readonly value: unknown }
  | { readonly ok: false; readonly error: string }

/* The one interesting decision in this function is the return type.

   `JSON.parse` is declared as returning `any`, which is a promise the standard
   library cannot keep — it genuinely does not know what is in the string. `any`
   then spreads: whatever the caller does with the result is also `any`, and the
   checking quietly stops for the whole chain. Handing back `unknown` costs the
   caller one check and buys back the entire rest of the program.

   The error string is fixed rather than forwarded from the exception, because
   `JSON.parse`'s message is not part of any specification and has changed between
   engines and between Node versions. A test that asserted on it would fail on
   somebody else's laptop for no useful reason. */
export function parseJson(text: string): ParseResult {
  try {
    return { ok: true, value: JSON.parse(text) as unknown }
  } catch {
    return { ok: false, error: 'invalid JSON' }
  }
}

/* `never` is the empty set: a type with no members at all. Nothing can be
   assigned to it, which is exactly why a parameter of type `never` is useful — the
   only way to call this function is to have convinced the compiler that the
   argument cannot exist.

   Two `never`s are at work in the signature. The parameter one is the assertion.
   The return one says the function does not come back, which is what lets a
   `switch` arm write `return assertNever(…)` and still satisfy a `string` return
   type. */
export function assertNever(value: never, context: string): never {
  throw new Error(`unexpected ${context}: ${JSON.stringify(value)}`)
}

/* The `default` arm is the whole trick. Inside it, the three cases above have
   already removed every member of `Status`, so `status` is `never` — and
   `assertNever` accepts it happily.

   Add `'failed'` to `Status` and this stops compiling on the `assertNever` line:
   `status` is now `'failed'` there, and `'failed'` is not assignable to `never`.
   You get a build error pointing at the exact function that forgot about it, plus a
   sensible runtime message if a bad value ever arrives from outside the program —
   which is the pair of guarantees a bare `default: return '?'` throws away. */
export function statusLabel(status: Status): string {
  switch (status) {
    case 'queued':
      return 'waiting to start'
    case 'running':
      return 'in progress'
    case 'done':
      return 'finished'
    default:
      return assertNever(status, 'status')
  }
}

/* Three checks, each one earning the next. `parsed.value` is `unknown`, so it
   cannot be indexed until it is known to be an object; the field is `unknown`, so
   it cannot be returned until it is known to be a number.

   None of this ceremony exists if `parseJson` returns `any` — `parsed.value.count`
   compiles immediately and returns whatever it likes. That is the trade in one
   function: `unknown` makes you write the four lines that `any` lets you skip and
   then regret. */
export function countFrom(text: string): number | undefined {
  const parsed = parseJson(text)
  if (!parsed.ok) return undefined

  const document = parsed.value
  if (typeof document !== 'object' || document === null) return undefined

  const { count } = document as { readonly count?: unknown }
  return typeof count === 'number' && Number.isFinite(count) ? count : undefined
}
