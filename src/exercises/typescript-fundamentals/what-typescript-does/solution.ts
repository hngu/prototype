/**
 * Reference solution: Trust nothing at the door
 * Lesson: typescript-fundamentals/what-typescript-does
 */

export interface Reading {
  readonly label: string
  readonly celsius: number
}

/* Nothing interesting here on purpose — this is the shape of code the compiler
   really can check for you, and the contrast with `parseReading` below is the
   whole lesson. */
export function toFahrenheit(celsius: number): number {
  return Math.round(((celsius * 9) / 5 + 32) * 10) / 10
}

/* `readings[0]` is `Reading | undefined` here, not `Reading` — the exercises
   tsconfig sets `noUncheckedIndexedAccess`, so the compiler refuses to pretend
   index 0 exists just because you wrote it. `reduce` with no initial value
   sidesteps the question entirely and throws on an empty array, which is why the
   length check comes first. Lesson 8 is about this flag. */
export function hottest(readings: readonly Reading[]): Reading | undefined {
  if (readings.length === 0) return undefined
  return readings.reduce((best, next) => (next.celsius > best.celsius ? next : best))
}

/* This function is the point of the lesson.

   Everything above it is checked by the compiler, because everything above it
   was written in TypeScript. `raw` was not: it arrived at run time, from a file
   or a socket or a text box, long after every type in this file was deleted. So
   the only thing that can vouch for it is code that actually looks — which is
   what this is.

   Two details worth stealing:

   - `typeof raw !== 'object' || raw === null` is the whole "is it a plain
     object?" check, because `typeof null === 'object'` is a 1995 bug that JavaScript
     can never fix.
   - `Number.isFinite` rather than `typeof celsius === 'number'`. `NaN` and
     `Infinity` are both numbers as far as the type system is concerned, and
     `JSON.parse('{"celsius":1e999}')` really does hand you `Infinity`. The type
     said `number` and it is telling the truth; it just is not the truth you wanted. */
export function parseReading(raw: unknown): Reading | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined

  const { label, celsius } = raw as Partial<Reading>
  if (typeof label !== 'string' || label.length === 0) return undefined
  if (typeof celsius !== 'number' || !Number.isFinite(celsius)) return undefined

  /* Rebuilt rather than returned as-is, so extra keys from the wire do not ride
     along into the rest of the program. */
  return { label, celsius }
}
