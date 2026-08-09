/**
 * Exercise: Peel it off, or weld it on
 * Lesson:   typescript-tooling-config/erasable-syntax-and-enums
 *
 * Replace every `throw new Error('TODO: …')` with a real implementation, and do the two
 * type-level TODOs as well.
 *
 * This exercise exists **because** of the constraint the whole package is authored under, so
 * it is worth saying what that is.
 *
 * Node runs these files by *erasing* types — deleting annotations and running what is left.
 * Most TypeScript is a sticker you can peel off. A few features are welded on: they need the
 * compiler to *generate* code, and an `enum` is the clearest case, because it produces an
 * object that exists at run time.
 *
 *     enum Status { Queued = 'queued', Running = 'running' }
 *
 * Peel the types off that and there is no `Status` object left, so `Status.Queued` is a
 * `TypeError` on the first call. `erasableSyntaxOnly` turns it into `TS1294` at authoring
 * time instead, which is why that line appears only in this comment.
 *
 * The replacement is an `as const` object plus `keyof typeof`, and it is not a workaround.
 * It is better in four specific ways the brief lists. Build it.
 */

import type { Equals, Expect } from '../../tools/type-assert.ts'

/* ── Part 1: the replacement for the enum ────────────────────────────────────────────── */

/**
 * The four statuses, as a real object.
 *
 * `as const` is doing the work: without it every property widens to `string`, and the unions
 * below become `string` too — which is the single most common way this pattern is got wrong.
 */
export const STATUS = {
  Queued: 'queued',
  Running: 'running',
  Done: 'done',
  Failed: 'failed',
} as const

/**
 * The union of status **keys**: `'Queued' | 'Running' | 'Done' | 'Failed'`.
 *
 * **TODO:** derive this from `STATUS` with `keyof typeof`. Written out longhand below so a
 * fresh clone compiles; the assertion underneath holds either way, so it tells you whether
 * what you wrote is right rather than whether you wrote anything.
 */
export type StatusKey = 'Queued' | 'Running' | 'Done' | 'Failed'

type _statusKey = Expect<Equals<StatusKey, 'Queued' | 'Running' | 'Done' | 'Failed'>>

/**
 * The union of status **values**: `'queued' | 'running' | 'done' | 'failed'`.
 *
 * **TODO:** derive this from `STATUS` too, via an indexed access.
 *
 * Having both types separately is one of the four wins: an enum member is a name *and* a
 * value at once, and code that needs one of them has no way to ask for just that.
 */
export type Status = 'queued' | 'running' | 'done' | 'failed'

type _status = Expect<Equals<Status, 'queued' | 'running' | 'done' | 'failed'>>

/* ── Part 2: things an enum could not do ─────────────────────────────────────────────── */

/** Every status value, in declaration order. */
export function allStatuses(): readonly Status[] {
  throw new Error('TODO: derive from STATUS rather than listing them again')
}

/**
 * Is this string one of the four statuses?
 *
 * A real check that narrows. With a string enum there is no run-time list of members that is
 * also correctly typed, so this needs a cast there and does not here.
 */
export function isStatus(value: string): value is Status {
  throw new Error('TODO: check against the values')
}

/** The key for a value: `'queued'` → `'Queued'`. `undefined` if there is no such value. */
export function keyOf(value: string): StatusKey | undefined {
  throw new Error('TODO: search the entries — and one cast is unavoidable here')
}

/* ── Part 3: exhaustiveness, which is the actual payoff ──────────────────────────────── */

/**
 * A one-line description per status.
 *
 * queued → `waiting to start`, running → `in progress`, done → `finished`,
 * failed → `gave up`.
 *
 * Use a `switch` with **no `default`** and an exhaustiveness check, so adding a fifth status
 * is a compile error here rather than a silently wrong answer.
 */
export function describe(status: Status): string {
  throw new Error('TODO: exhaustive switch, no default arm')
}

/**
 * The same mapping as a lookup table.
 *
 * **TODO:** fill it in and delete the `as` cast. `Record<Status, string>` is the trick —
 * once the cast is gone, leaving a status out will not compile, which is the table-shaped
 * version of the exhaustiveness check and usually the better one for a pure mapping.
 */
export const DESCRIPTIONS = {} as Record<Status, string>

/**
 * Can a job in this status still be cancelled? Only `queued` and `running`.
 *
 * Write it so that adding a fifth status is a compile error here too. A `switch` would do it;
 * so would a table, and the table is shorter.
 */
export function isCancellable(status: Status): boolean {
  throw new Error('TODO: and adding a status must break this at compile time')
}
