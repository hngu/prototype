/**
 * Reference solution: One door, several labelled ways through
 * Lesson: typescript-functions-objects/overloads-and-call-signatures
 */

/* Why overload this at all? Because the return type genuinely depends on the
   argument type, and one signature cannot say so. Epoch milliseconds always produce
   a valid `Date`; a string might be nonsense. With the overloads, `parseDate(0)` is
   a `Date` and `parseDate(text)` is `Date | undefined`, and neither caller has to
   check something that cannot happen.

   The price is on the third line. The implementation signature is not part of the
   public type — callers see the first two only — so `parseDate(someStringOrNumber)`
   does not compile at all. No overload accepts a union, and the compiler will not
   assemble one for you. That is the single biggest practical cost of overloading,
   and `solution.test.ts` pins it with a `@ts-expect-error`.

   The rule of thumb: overload when the return type depends on the argument type.
   Otherwise a union parameter is less code and more usable. */
export function parseDate(input: number): Date
export function parseDate(input: string): Date | undefined
export function parseDate(input: string | number): Date | undefined {
  if (typeof input === 'number') return new Date(input)

  const parsed = new Date(input)
  return Number.isNaN(parsed.getTime()) ? undefined : parsed
}

/* Identical behaviour, one signature, and honest about being less precise: a caller
   passing a number gets `Date | undefined` and has to handle an `undefined` that
   will never arrive.

   Which is the right trade far more often than people expect. It is one signature
   instead of three, it accepts a `string | number` variable, and the cost is one
   redundant check at the small number of call sites that pass a literal number. */
export function parseDateUnion(input: string | number): Date | undefined {
  if (typeof input === 'number') return new Date(input)

  const parsed = new Date(input)
  return Number.isNaN(parsed.getTime()) ? undefined : parsed
}

export interface DateParser {
  (input: string): Date | undefined
  readonly label: string
}

/* `Object.assign` is the tidy way to satisfy a call signature that also carries
   properties: build the function, then staple the data on. The alternative is a
   `function` declaration followed by `parse.label = label`, which needs a cast or a
   separate annotated binding because the freshly declared function does not have a
   `label` yet.

   This shape is common in real libraries — think `express()` which is also
   `express.static` — and it is the reason call-signature interfaces exist at all.
   A function type expression cannot express it. */
export function makeParser(label: string): DateParser {
  return Object.assign((input: string): Date | undefined => parseDate(input), { label })
}

/* A construct signature describes what goes after `new`, not what you call. So
   `ctor` here is a class (or any constructor function), and `new ctor(value)` is how
   you use it — the parameter name being lowercase is the only hint that it is a
   value rather than a type.

   `Date` satisfies `new (value: number) => Date`, which is why the test can pass the
   built-in constructor straight in with nothing wrapped around it. */
export function buildAll(
  ctor: new (value: number) => Date,
  values: readonly number[],
): readonly Date[] {
  return values.map((value) => new ctor(value))
}
