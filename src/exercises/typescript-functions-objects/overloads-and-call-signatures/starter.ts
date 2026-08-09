/**
 * Exercise: One door, several labelled ways through
 * Lesson:   typescript-functions-objects/overloads-and-call-signatures
 *
 * Replace every `throw new Error('TODO: …')` with a real implementation.
 *
 * `parseDate` and `parseDateUnion` do the *same job* with different signatures.
 * That is the exercise: implement both, then read the two `@ts-expect-error`
 * comments in `solution.test.ts`, which are where the difference actually shows up.
 */

/* Three signatures, one function. The first two are what callers see; the third is
   the implementation signature and is NOT callable from outside. */
export function parseDate(input: number): Date
export function parseDate(input: string): Date | undefined
export function parseDate(input: string | number): Date | undefined {
  throw new Error('TODO: a number is epoch ms; a string is ISO and might be nonsense')
}

/** The same job with one signature over a union. Note the return type. */
export function parseDateUnion(input: string | number): Date | undefined {
  throw new Error('TODO: same behaviour as parseDate')
}

/**
 * A **call signature** plus a property.
 *
 * A function type expression — `(input: string) => Date | undefined` — cannot
 * describe a function that also carries data. An interface can.
 */
export interface DateParser {
  (input: string): Date | undefined
  readonly label: string
}

/** Builds a parser that knows its own name. */
export function makeParser(label: string): DateParser {
  throw new Error('TODO: return something both callable and labelled')
}

/**
 * A **construct signature**: `new (value: number) => Date` describes the thing you
 * put after `new`, rather than the thing you call. `Date` itself satisfies it.
 */
export function buildAll(
  ctor: new (value: number) => Date,
  values: readonly number[],
): readonly Date[] {
  throw new Error('TODO: construct one Date per value')
}
