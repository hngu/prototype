/**
 * Exercise: Trust nothing at the door
 * Lesson:   typescript-fundamentals/what-typescript-does
 *
 * Replace every `throw new Error('TODO: …')` with a real implementation.
 *
 * Do not change the exported signatures. `solution.test.ts` proves at compile
 * time that this file and `solution.ts` expose the same API, so a changed
 * signature shows up as a type error rather than a confusing test failure.
 */

export interface Reading {
  readonly label: string
  readonly celsius: number
}

/** Celsius to Fahrenheit, rounded to one decimal place. */
export function toFahrenheit(celsius: number): number {
  throw new Error('TODO: convert to Fahrenheit and round to 1 decimal place')
}

/** The warmest reading, or `undefined` when there are none. */
export function hottest(readings: readonly Reading[]): Reading | undefined {
  throw new Error('TODO: return the warmest reading, or undefined for an empty list')
}

/**
 * Checks a value that came from outside the program — parsed JSON, a form
 * submission, a query string — and returns a `Reading` only if it really is one.
 *
 * `unknown` is the type for "a value the compiler knows nothing about yet".
 * Lesson 7 covers it properly; here it just means the annotation is honest.
 */
export function parseReading(raw: unknown): Reading | undefined {
  throw new Error('TODO: validate raw at runtime and return a Reading or undefined')
}
