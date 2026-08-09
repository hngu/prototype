---
title: A sticker or a welded bracket
course: typescript-tooling-config
order: 4
summary: "Most TypeScript can be deleted from a file leaving working JavaScript; a handful of features have to be compiled instead, and that distinction decides which runtimes can run your code directly. You will be able to name every non-erasable feature, replace an `enum` with something better, and explain what `erasableSyntaxOnly` does and does not catch."
duration: 12
exercise: true
draft: false
---

A sticker comes off a laptop and the laptop still works. A welded-on bracket does not — and trying to peel
it off leaves you with neither the bracket nor a working laptop.

Almost all TypeScript is a sticker. About six features are welded on, and knowing which is what decides
whether Node can run your file as it stands.

## Erasing is not compiling

There are two ways to get from TypeScript to running code, and they are genuinely different operations.

**Compiling** reads the types, checks them, and emits JavaScript that may look quite unlike the input.
That is `tsc`.

**Erasing** deletes the type syntax and runs what is left. That is Node's built-in type stripping,
esbuild, swc, and Babel's TypeScript plugin. It is much faster, it can be done one file at a time with no
knowledge of any other file, and — the important part — **it never type-checks anything.**

Erasing only works for syntax that leaves valid JavaScript behind when removed. These do not:

| Feature | Why it needs code generation |
| --- | --- |
| `enum` | produces an object that must exist at run time |
| `namespace` | produces an object, via an IIFE |
| `constructor(private x)` | must generate `this.x = x` |
| `export =` / `import x = require()` | not valid ESM |
| decorators | must generate the calls that apply them |
| `.tsx` / JSX | not type syntax at all; needs transforming |

The parameter-property case is the nastiest, because it fails **silently**: the parameter is accepted, the
field is never assigned, and every read is `undefined` with no error anywhere.

`erasableSyntaxOnly` is the flag that moves those failures to authoring time, where they are a `TS1294` on
the offending line. This site's exercises set it, which is why course 4 declares class fields the long way.

Worth knowing precisely what it misses, because it is less than people assume. **Decorators are not
caught** — `tsc --noEmit` says nothing and Node then fails at the parser with `SyntaxError: Invalid or
unexpected token`. Nor is `accessor x = 0`, which is a JavaScript proposal rather than TypeScript syntax.
And `declare` on a class field is perfectly legal and erases correctly, despite widespread belief
otherwise. Three conventions, not gates.

```quiz
id: typescript-tooling-config-erasable-syntax-and-enums-q1
q: Which of these fails *silently* at run time under a type-stripping runtime, rather than throwing?
- [x] `constructor(private count: number) {}` — the field is never assigned and reads as `undefined`
- [ ] `enum Status { A }` — the object does not exist
- [ ] `namespace Foo {}` — the object does not exist
- [ ] A decorator — the file will not parse
explain: A parameter property strips to an ordinary parameter, so the constructor runs happily and the field simply never gets set — every later read is `undefined` with nothing to point at. The other three fail loudly: a missing enum or namespace object is a `TypeError` at first use, and a decorator does not parse at all. Silent wrongness is why this is the case worth having a compiler flag for.
```

## Why enums are the interesting case

An `enum` is not just non-erasable. It is the one on the list you would not have wanted anyway, and it is
worth knowing why before replacing it.

The replacement:

```ts
export const STATUS = {
  Queued: 'queued',
  Running: 'running',
  Done: 'done',
} as const

export type StatusKey = keyof typeof STATUS // 'Queued' | 'Running' | 'Done'
export type Status = (typeof STATUS)[StatusKey] // 'queued' | 'running' | 'done'
```

Four things that buys, none of them about erasability:

**Two types instead of one.** An enum member is a name *and* a value simultaneously, so code that wants
only the values, or only the keys, has no way to ask. Here they are separate types and neither was written
by hand.

**The values are plain strings.** `Object.values(STATUS)` is correctly typed. `Object.values(SomeEnum)`
gives `string[]` and needs a cast, because the enum object also carries a reverse mapping for numeric
members and the typing cannot know yours has none.

**A predicate needs no cast.** `isStatus(value): value is Status` can check against a real, typed
run-time list. With a string enum there is no such list.

**Interoperability.** `'queued'` from a JSON payload *is* a `Status`. An enum member is not
interchangeable with its own value in either direction without help, which is a surprising amount of
friction at every boundary.

And you keep the thing enums are actually good at: exhaustiveness. A `switch` with no `default` plus an
`assertNever`, or a `Record<Status, string>` table, both stop compiling when a member is added.

```quiz
id: typescript-tooling-config-erasable-syntax-and-enums-q2
q: What happens if you write the object above without `as const`?
- [x] Every value widens to `string`, so `Status` becomes `string` and every guarantee silently disappears
- [ ] A compile error, since `keyof typeof` requires a readonly object
- [ ] The types are correct but the object becomes mutable at run time
- [ ] `Status` becomes `'queued' | 'running' | 'done' | string`, which is the same thing
explain: Property values in a mutable object could be reassigned, so TypeScript widens them to `string` — and then `Status` is `string`, `isStatus` accepts anything, and `describe` needs a `default` arm. Nothing errors; the feature just quietly stops existing. Note that `as const` makes the properties `readonly` only at the type level: it is not `Object.freeze`, and a write at run time really does land.
```

## Numeric enums, and the one case for keeping an enum

If you have inherited enums, the numeric ones deserve more suspicion than the string ones.

```ts
enum Level {
  Debug, // 0
  Info, // 1
}

const level: Level = 4 // legal, until TypeScript 5.0 made it an error for literal enums
```

Numeric enums also generate a **reverse mapping** — `Level[0]` is `'Debug'` — which is why the emitted
object has twice the entries you expected and why `Object.values` includes the names as well as the
numbers. And `const enum` is worse again: it inlines at every use site, which means it cannot be used
across a package boundary at all and is incompatible with any single-file transform. `isolatedModules`
rejects it for exactly that reason.

The honest case for keeping an enum: **you are already using them consistently and the codebase compiles
with `tsc`.** Churning a large codebase from enums to `as const` objects for uniformity is not obviously
worth the diff. The rule worth adopting is narrower and more useful — **do not add new ones**, and reach
for the object when you write something new.

```quiz
id: typescript-tooling-config-erasable-syntax-and-enums-q3
q: Why does `isolatedModules` reject `const enum`?
- [x] A `const enum` is inlined at each use site, which requires knowing another file's contents
- [ ] `const enum` produces no object, so imports of it fail at run time
- [ ] `const enum` cannot be exported
- [ ] Because `const enum` values are always numeric
explain: `isolatedModules` promises every file can be transformed on its own, and inlining `Level.Debug` as `0` means reading the file that declared it — precisely the cross-file knowledge that guarantee rules out. It is the same reason every single-file transform tool, including Node's own stripping, cannot support it.
```

## What to take away

- Erasing deletes type syntax and never checks anything; compiling reads types and may emit quite
  different code. Six features need the second, and a parameter property is the one that fails silently.
- `erasableSyntaxOnly` catches `enum`, `namespace`, parameter properties and `export =` — and **not**
  decorators, `accessor`, or `declare` class fields.
- Replace an enum with `as const` plus `keyof typeof`: you gain two separate types, plain string values, a
  cast-free predicate and easy interop, and keep exhaustiveness.
- `as const` is compile-time only — it is not `Object.freeze`. And leaving it off makes the whole pattern
  silently stop working.
