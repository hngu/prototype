---
title: One door onto three rooms
course: typescript-modules-declarations
order: 1
summary: "A module is a file with a decision attached: what leaves it. You will be able to design a public surface with `export` and `export type`, explain why `import type` is not optional when a runtime only erases types, and re-export a default without accidentally becoming one."
duration: 11
exercise: true
draft: false
---

A house has rooms. It also has a front door, and the front door is not a list of every room — it is a
decision about how people get in.

Every file in a modern TypeScript project is a room. This course is about the doors, and this lesson is
about the one you control completely.

## A file is a room with a door

The rule is short: **a file with a top-level `import` or `export` is a module, and everything in it is
private unless exported.** A file without either is a script, and its top-level names are global — which
is almost never what you want, and is the reason an otherwise empty `export {}` sometimes appears at the
bottom of a file.

```ts
const RATE = 0.2 // private to this file, whatever else happens

export interface Invoice {
  readonly total: number
}

export function withTax(amount: number): number {
  return amount * (1 + RATE)
}
```

There are two ways out, and the useful default is the boring one:

```ts
export function parse(text: string): Invoice {} // named
export default function parse(text: string) {} // default
```

Prefer named exports. A default export has no name at the definition site, so every importer invents
one — and three files calling the same function `parse`, `parseInvoice` and `doParse` is a genuine cost
when you later grep for callers. Defaults also rename silently: change what a module default-exports and
no importer breaks, they just get a different thing.

```quiz
id: typescript-modules-declarations-modules-q1
q: A file declares `const helper = …` at the top level and has no `import` or `export` anywhere. What is `helper`?
- [x] A global, because a file with no imports or exports is a script rather than a module
- [ ] Private to the file, since top-level `const` is always file-scoped
- [ ] An error — TypeScript requires every file to be a module
- [ ] Private, but only if `isolatedModules` is on
explain: Module scope is what makes top-level names private, and a file only gets module scope by having a top-level `import` or `export`. Without one it is a script, its declarations join the global scope, and a second script declaring `helper` is a redeclaration error from somewhere apparently unrelated. This is why an empty `export {}` is a real fix rather than a superstition.
```

## Saying which universe a name lives in

Here is the thing that trips people up, and it stops being confusing the moment you see *why* it exists.

TypeScript has two universes: types, which vanish, and values, which do not. An `import` statement can
carry either, and it looks identical:

```ts
import { Invoice, withTax } from './invoice.ts' // one type, one function
```

A compiler that *compiles* can work out which is which and drop the type. A runtime that only **erases**
types cannot — it never type-checked anything, so it does not know `Invoice` was a type. The import
survives, and:

```text
SyntaxError: The requested module './invoice.ts' does not provide an export named 'Invoice'
```

Which is why `verbatimModuleSyntax` exists, and why it is on in this course's exercises. It makes you say
it:

```ts
import type { Invoice } from './invoice.ts'
import { withTax } from './invoice.ts'
```

The flag's promise is exactly its name: **imports and exports are emitted verbatim**. What you wrote is
what runs, so there is no gap between the two for a bug to live in. The same rule applies on the way out —
re-exporting a type needs `export type`, or you get `TS1205`.

There is also an inline form, handy when a module gives you both:

```ts
import { type Invoice, withTax } from './invoice.ts'
```

Use whichever reads better. Separate statements group the type surface and the value surface visibly,
which is worth something in a file with a dozen imports.

```quiz
id: typescript-modules-declarations-modules-q2
q: Why does `verbatimModuleSyntax` require `import type` for types, rather than working it out?
- [x] So the emitted import matches what was written, which a runtime that only erases types depends on
- [ ] Because resolving whether a name is a type is too slow at scale
- [ ] To support circular imports between type-only modules
- [ ] Because `import type` is faster at run time than a plain import
explain: The compiler could work it out — it has the types. The problem is everyone downstream who does not: Node's type stripping, esbuild, swc and every other tool that deletes annotations without checking them. Declaring the intent means the import needs no type information to transform correctly, which is what makes single-file transforms possible at all.
```

## The front door

Once a feature is three or four files, callers should not have to know which. A **barrel** is one module
that re-exports a chosen surface:

```ts
export type { Currency, Money } from './money.ts'
export { money, add } from './money.ts'
export { formatMoney } from './format.ts'
export { default as total } from './cart.ts'
```

Three things worth knowing about that last line. `default` is a real export name, just an unusual one, so
it can be renamed on the way through. The rename is not optional — a bare `export { default }` would make
`total` *this* module's default instead of a named export, and a barrel that quietly adopts a submodule's
default surprises everyone. And a re-export **binds to the original**: there is one `money` function in
the program, so a barrel costs nothing at run time beyond loading what is behind it.

The discipline that makes barrels worth having is subtraction. A barrel is not an index of everything that
exists — it is the decision about what leaves the building. Anything you re-export becomes something
callers may depend on, and withdrawing it later is a breaking change. Export less than you have.

Two cautions. A barrel that re-exports a module which imports the barrel is a **cycle**, and the symptom
is an `undefined` at import time rather than a helpful error. And barrels can defeat tree-shaking: one
import from the front door can pull in every room behind it, which matters for a browser bundle and not at
all for a Node script.

```quiz
id: typescript-modules-declarations-modules-q3
q: A barrel does `export { default } from './cart.ts'` instead of `export { default as total } from './cart.ts'`. What is the consequence?
- [x] `total` becomes the barrel's own default export rather than a named one
- [ ] A compile error, because `default` cannot appear in a re-export
- [ ] The barrel re-exports it under the name `default`, importable as `{ default }`
- [ ] Nothing — the two forms are equivalent
explain: The first form forwards the default *as* a default, so the barrel acquires one it was never meant to have and `import { total }` fails. The third option is the tempting one, and it describes what a namespace object looks like at run time — but in a static re-export `default` is the default slot, not an ordinary name, which is exactly why the rename form exists.
```

## What to take away

- A file is a module only if it has a top-level `import` or `export`; without one it is a script and its
  declarations are global. An empty `export {}` is a real fix.
- Prefer named exports. A default has no name at the definition site, so every importer invents one, and
  changing it breaks nobody loudly.
- `import type` and `export type` are not decoration: a runtime that erases types cannot tell which names
  were types, so what you wrote has to be what runs.
- A barrel is a decision about what leaves, not an index of what exists — and re-exporting a default
  needs `as`, or the barrel becomes a default itself.
