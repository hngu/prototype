/**
 * Exercise: Look before you reach in
 * Lesson:   typescript-fundamentals/narrowing
 *
 * Replace every `throw new Error('TODO: …')` with a real implementation.
 *
 * The rule for this exercise: **no casts and no `any`.** Every branch must earn
 * its type from a check the compiler understands. If you find yourself writing
 * `as string`, the check above it is in the wrong shape.
 *
 * Do not change the exported signatures. `solution.test.ts` proves at compile
 * time that this file and `solution.ts` expose the same API.
 */

export interface Circle {
  readonly radius: number
}

export interface Square {
  readonly side: number
}

/** Three members, each with its own tag. */
export type Result =
  | { readonly kind: 'ok'; readonly data: string }
  | { readonly kind: 'empty' }
  | { readonly kind: 'error'; readonly message: string; readonly code: number }

/**
 * Describes a value that could be any of three things.
 *
 *   'text "hello" (5 characters)'
 *   'number 3.50'
 *   'date 2026-08-08'
 */
export function describe(value: string | number | Date): string {
  throw new Error('TODO: one branch per member of the union — typeof, then instanceof')
}

/** Area of either shape. Neither has a tag, so you cannot switch on one. */
export function areaOf(shape: Circle | Square): number {
  throw new Error('TODO: work out which shape this is from the property it has')
}

/**
 * Renders a result.
 *
 *   'ok: 42 rows'
 *   'nothing to show'
 *   'error 404: not found'
 */
export function render(result: Result): string {
  throw new Error('TODO: switch on result.kind')
}
