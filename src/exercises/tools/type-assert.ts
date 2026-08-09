/**
 * Type-level assertions, for exercises whose subject is a type.
 *
 * Course 3 is about writing types, and a type has no runtime behaviour to assert.
 * These two helpers are how the exercises grade one anyway. Kept here rather than
 * copied into each exercise because `Equals` is famously easy to get subtly wrong —
 * a version that passes vacuously would silently stop checking anything.
 *
 * Both are types. Nothing here exists at run time.
 */

/**
 * True when `A` and `B` are the *same* type, not merely mutually assignable.
 *
 * The two-conditional dance is deliberate and cannot be simplified to
 * `A extends B ? B extends A ? true : false : false`. That version reports `true`
 * for `any` against anything, and — the one that matters in practice — cannot tell
 * `{ a?: string }` from `{ a: string | undefined }`, because those two *are* mutually
 * assignable. Deferring both sides inside an unresolved generic signature compares the
 * types structurally instead, optional markers and all.
 *
 * Verified against tsc 6.0.3: it accepts correct answers and rejects `any`, a swapped
 * conditional branch, and `| undefined` in place of `?:`.
 */
export type Equals<A, B> = (<G>() => G extends A ? 1 : 2) extends <G>() => G extends B ? 1 : 2
  ? true
  : false

/**
 * Fails to compile unless its argument is exactly `true`.
 *
 *   type _check = Expect<Equals<MyPartial<X>, Partial<X>>>
 *
 * The error lands on the assertion, naming the file and line — which is what makes
 * `pnpm --filter exercises typecheck` a usable grader for a type.
 */
export type Expect<T extends true> = T

/**
 * True when `A` is assignable to `B` — a weaker claim than `Equals`, for the cases
 * where a value only has to *fit* rather than match.
 */
export type Extends<A, B> = A extends B ? true : false
