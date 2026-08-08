/**
 * Reference solution: Look before you reach in
 * Lesson: typescript-fundamentals/narrowing
 */

export interface Circle {
  readonly radius: number
}

export interface Square {
  readonly side: number
}

export type Result =
  | { readonly kind: 'ok'; readonly data: string }
  | { readonly kind: 'empty' }
  | { readonly kind: 'error'; readonly message: string; readonly code: number }

/* Three checks, three types, and not a cast in sight.

   `typeof` covers the two primitives; `instanceof` covers the class instance,
   because `typeof someDate` is `'object'` and would tell you nothing useful.

   Note there is no `else` and no final `if`. After the two `return`s, the only
   member of the union still standing is `Date`, so `value.toISOString()` compiles
   — the compiler followed the control flow and did the subtraction for you. If
   you add `boolean` to the parameter type, this function stops compiling, which is
   exactly the reminder you want. */
export function describe(value: string | number | Date): string {
  if (typeof value === 'string') {
    return `text "${value}" (${value.length} characters)`
  }
  if (typeof value === 'number') {
    return `number ${value.toFixed(2)}`
  }
  return `date ${value.toISOString().slice(0, 10)}`
}

/* Neither shape has a tag, so there is nothing to switch on — but the *presence*
   of a property is itself a check the compiler understands. `'radius' in shape`
   narrows to `Circle` inside the `if` and to `Square` after it.

   `in` is the one narrowing operator people reach for least and should reach for
   most: it is the only one that works on plain object shapes you did not design. */
export function areaOf(shape: Circle | Square): number {
  if ('radius' in shape) {
    return Math.PI * shape.radius ** 2
  }
  return shape.side ** 2
}

/* This is the shape to design *towards*. Every member carries a `kind` whose type
   is a single literal, so one comparison collapses the union to exactly one
   member — and `result.data` is available in the `'ok'` branch and nowhere else.

   The `switch` has no `default`. That is deliberate: because the three cases
   exhaust the type, adding a fourth member to `Result` makes this function fall
   out of the bottom returning `undefined`, which is a compile error against the
   `string` return type. A `default: return '?'` would have swallowed that
   warning, silently, forever. Lesson 7 shows how to get the same protection when
   you genuinely do need a default branch. */
export function render(result: Result): string {
  switch (result.kind) {
    case 'ok':
      return `ok: ${result.data}`
    case 'empty':
      return 'nothing to show'
    case 'error':
      return `error ${result.code}: ${result.message}`
  }
}
