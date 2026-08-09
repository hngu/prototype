/**
 * Declarations for `text-utils.js` — a worked example, given, and the thing to read closely.
 *
 * A `.d.ts` is a museum label. It tells the compiler what something is without touching it,
 * emits nothing, and is believed **unconditionally** — nothing checks it against the
 * JavaScript it describes. Every line here is a promise somebody has to keep by hand.
 *
 * The comments below are about the decisions, not the syntax. The syntax is the easy part.
 */

/* `declare` says "this exists somewhere else; do not expect a definition here". In a `.d.ts`
   every top-level declaration is implicitly ambient, so `export function slugify(…): string`
   would mean the same thing — the explicit `declare` is a readability habit rather than a
   requirement, and being consistent about it matters more than which way you go. */
export declare function slugify(text: string): string

/* The parameter is `string`, not `string | number`, even though the implementation calls
   `String(text)` and would survive a number.

   That is the central judgement call in declaration writing, and the rule is: **describe the
   contract you want callers to rely on, not every input that happens not to crash.** A
   declaration is the API. Widening it here would bless `slugify(42)` forever, and taking it
   back later is a breaking change. */

/* `suffix?: string` — optional, because the implementation defaults it. An optional parameter
   in a declaration is exactly a parameter the caller may omit; the default *value* lives in
   the JavaScript and cannot be expressed here, which is fine, because it is not the caller's
   business. */
export declare function truncate(text: string, maxLength: number, suffix?: string): string

/* Returns `string[]`, mutable and not `readonly`. Honest: the implementation builds a fresh
   array on every call, so the caller owns it and may do as they like. Declaring
   `readonly string[]` would be a lie in the *safe* direction, which is still a lie and still
   annoying — the caller would have to copy an array that was already theirs. */
export declare function parseList(text: string, separator?: string): string[]

/* And the one worth arguing about.

   `parseJsonHeader` can genuinely return anything: a number, a string, `null`, an array, an
   object of any shape. Three ways to write that down, and only one is defensible:

     : any          — the caller gets no help and no warning. Every downstream mistake is
                      silent, and `any` spreads through everything it touches.
     : Frontmatter  — a lie. Convenient at the call site and wrong the first time somebody
                      feeds it `{"title": 42}`, at which point the compiler is vouching for
                      a shape nobody checked.
     : unknown      — the truth, and it forces the caller to narrow before use.

   `unknown` is the answer, and callers finding it inconvenient is the feature: the
   inconvenience is exactly the check that was missing. See lesson 1.7. */
export declare function parseJsonHeader(text: string): unknown

/* A value rather than a function, declared with `const` so it cannot be reassigned by the
   consumer's types. `RegExp` is a lib type and needs no import. */
export declare const WORD_SEPARATOR: RegExp

/* The default export. `declare const` then `export default` — you cannot write
   `export default { … }` in a declaration file, because that is a value expression and a
   `.d.ts` contains no values.

   Note the shape is written out rather than described as `typeof slugify`-style shorthand,
   because a reader of a declaration file should not have to reconstruct anything. */
declare const textUtils: {
  slugify(text: string): string
  truncate(text: string, maxLength: number, suffix?: string): string
  parseList(text: string, separator?: string): string[]
  parseJsonHeader(text: string): unknown
}

export default textUtils
