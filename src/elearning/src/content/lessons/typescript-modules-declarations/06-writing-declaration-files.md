---
title: A label on something you cannot touch
course: typescript-modules-declarations
order: 6
summary: "A `.d.ts` describes code without touching it, emits nothing, and is believed unconditionally — so a wrong one is worse than none at all. You will be able to write declarations for an untyped module, choose honestly between `any` and `unknown`, and avoid the three mistakes that make a declaration file actively harmful."
duration: 12
exercise: true
draft: false
---

A museum label tells you what the exhibit is. It does not touch the exhibit, and nobody checks the two
against each other. If the label says *bronze, 400 BC* and the thing is plastic, the label is wrong and
every visitor believes it anyway.

That is a declaration file, and it is why writing one well is a distinct skill from writing TypeScript.

## What a `.d.ts` is

A file of types and nothing else. No implementations, no emitted output, no run-time existence:

```ts
export declare function slugify(text: string): string
export declare const WORD_SEPARATOR: RegExp

declare const textUtils: {
  slugify(text: string): string
}
export default textUtils
```

Three mechanical things to know before the interesting part.

`declare` means "this exists somewhere else; expect no definition here". At the top level of a `.d.ts`
every declaration is implicitly ambient, so `export function slugify(text: string): string` means the
same thing — being consistent matters more than which you pick.

**You cannot write a value.** `export default { slugify }` is an expression, and a declaration file
contains no expressions. Hence `declare const` followed by `export default`, which looks roundabout and
is the only way.

And they arrive by convention: the compiler looking for `./text-utils.js` finds `./text-utils.d.ts`
beside it, or follows a `types` field in `package.json`. Nothing links them explicitly, which is worth
remembering when a declaration file is mysteriously not being picked up.

```quiz
id: typescript-modules-declarations-writing-declaration-files-q1
q: Why does a declaration file use `declare const x: Shape` followed by `export default x` rather than `export default { … }`?
- [x] A `.d.ts` contains no values, and an object literal is a value expression
- [ ] Default exports must be named before they can be exported
- [ ] It is a style convention from DefinitelyTyped
- [ ] `export default` cannot appear in a file that also has named exports
explain: Declaration files describe types and emit nothing, so there is nowhere for an object literal to live — the two-step form is how you name a *shape* and then say that shape is the default export. The last option is simply false, and mixing default and named exports is normal in both source and declaration files.
```

## The judgement calls, which are the actual skill

The syntax takes an afternoon. Deciding what to write down takes longer, and these four come up
constantly.

**Describe the contract, not the implementation.** If a function calls `String(text)` internally it
would survive being handed a number — declare `text: string` anyway. A declaration is the API, and
blessing `slugify(42)` today is a promise you cannot withdraw without a breaking change.

**Be honest about ownership.** A function that builds and returns a fresh array should declare
`string[]`, not `readonly string[]`. The caller owns it. Declaring `readonly` is a lie in the *safe*
direction, and a safe lie is still a lie — plus it forces callers to copy an array that was already
theirs.

**Prefer `unknown` to `any`, and never invent a shape.** For a function that parses arbitrary JSON there
are three options and only one is defensible:

```ts
export declare function parseHeader(text: string): any // no help, and `any` spreads
export declare function parseHeader(text: string): Frontmatter // a lie
export declare function parseHeader(text: string): unknown // the truth
```

Callers finding `unknown` inconvenient is the feature. The inconvenience *is* the check that was
missing, and the `Frontmatter` version is worse than useless: the compiler now vouches for a shape
nobody verified.

**Use overloads for genuinely different shapes, not a union of everything.** If a function returns a
string for one argument and a number for another, two call signatures say so precisely; a
`string | number` return makes every caller narrow something that was never uncertain.

```quiz
id: typescript-modules-declarations-writing-declaration-files-q2
q: You are declaring a JavaScript function that `JSON.parse`s its input and returns the result. What return type?
- [x] `unknown`, because it genuinely can return anything and callers should have to check
- [ ] `any`, so callers are not inconvenienced
- [ ] The shape your codebase happens to pass it
- [ ] `object | string | number | boolean | null`
explain: `unknown` is what is true, and forcing a check is the point rather than a cost. `any` disables checking wherever the value flows; naming a specific shape is a lie the compiler will then defend on your behalf. The explicit union is closer to honest but adds nothing over `unknown` while being longer and missing `undefined` and arrays-of-anything — narrowing it is the same work either way.
```

## The three ways to make things worse

**A wrong declaration is worse than no declaration.** With no types you get `TS7016` and know you are on
your own. With wrong ones you get confident autocompletion for a function that does not exist, and the
failure surfaces at run time in production. If you are unsure, declare less.

**`declare module 'thing'` with no body means `any`.** This is the escape hatch people reach for to
silence `TS7016`:

```ts
declare module 'untyped-package' // every import from it is now `any`
```

It works and it turns off type checking for that entire package, silently and permanently. Sometimes
that is the right trade for an afternoon. It should be a comment explaining why, not a habit.

**A declaration for a package you did not write goes stale.** Publishing types to DefinitelyTyped is a
commitment to track someone else's releases. Checking whether a package already ships its own types, or
whether `@types/thing` exists, takes ten seconds and saves that.

Two smaller things worth knowing. `export =` — the only way to describe `module.exports = fn` — is
**legal in a `.d.ts` even under `erasableSyntaxOnly`**, because a declaration file emits nothing for the
flag to object to. And a `.d.ts` with no top-level `import` or `export` is a **script**, so everything
in it becomes global; that is how `declare global` files work, and it is also how a stray declaration
file accidentally pollutes an entire project.

```quiz
id: typescript-modules-declarations-writing-declaration-files-q3
q: What does `declare module 'untyped-package'` with no body do?
- [x] Silences the missing-declaration error by typing every import from that package as `any`
- [ ] Declares that the package exists but has no exports, so imports are errors
- [ ] Nothing, unless a matching `.d.ts` is also present
- [ ] Re-exports the package's own types under a new name
explain: A shorthand ambient declaration makes every import from that specifier `any`, which is exactly the checking you were trying to add — it converts a loud error into silence, permanently and invisibly. It is a legitimate short-term unblock, and it belongs next to a comment saying which package and why, because nothing will ever remind you it is there.
```

## What to take away

- A `.d.ts` is types only, emits nothing, and is believed unconditionally — a wrong one is worse than
  none, because it replaces a loud error with confident wrong answers.
- Describe the contract you want callers to depend on, not everything the implementation tolerates.
- `unknown` over `any`, and never invent a shape: the inconvenience `unknown` causes at the call site is
  the check that was missing.
- `declare module 'x'` with no body types a whole package as `any`, and `export =` is legal in a
  declaration file even where the compiler forbids it everywhere else.
