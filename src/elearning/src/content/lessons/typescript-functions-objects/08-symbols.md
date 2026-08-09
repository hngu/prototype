---
title: A key cut just for you
course: typescript-functions-objects
order: 8
summary: A symbol is a property key that cannot be guessed or duplicated, and `unique symbol` is the only nominal type TypeScript has. Together they are how libraries annotate your objects without ever colliding.
duration: 10
exercise: true
draft: false
---

Two flats can both have a front door labelled *3B*. The labels are identical, the keys are not, and
nobody finds this surprising.

JavaScript has a value that works exactly like that key, and TypeScript has a type for "this one key
specifically" that behaves unlike anything else in the language.

## Same label, different key

`Symbol()` creates a value equal to nothing but itself:

```ts
const a = Symbol('audit')
const b = Symbol('audit')

a === b // false
a.description // 'audit'
```

The string is a **description for your debugger**. It carries no identity at all. Which makes symbols
the right key for metadata that must not collide:

```ts
const AUDIT = Symbol('audit')
const doc = { title: 'Report', [AUDIT]: 'ada' }
```

Another library can write `Symbol('audit')` all it likes and never reach that property. Compare a
string key `'audit'`, where two libraries with the same idea silently overwrite each other and the bug
report says "the audit field is sometimes wrong".

There is a second, related habit worth knowing. Symbol-keyed properties are skipped by everything that
*enumerates* an object:

| Operation | Sees symbol keys? |
| --- | --- |
| `Object.keys`, `for…in` | no |
| `JSON.stringify` | no |
| `{ ...doc }`, `Object.assign` | **yes** |
| `Object.getOwnPropertySymbols` | yes, deliberately |

The first two are the point: code that walks or serialises your object carries on as though the
annotations were not there. The third is the trap — "symbols are hidden" is only true of enumeration,
and a spread copies them along with everything else.

```quiz
id: typescript-functions-objects-symbols-q1
q: `doc` has a symbol-keyed property. Which of these still see it?
- [x] `{ ...doc }`
- [x] `Object.getOwnPropertySymbols(doc)`
- [ ] `Object.keys(doc)`
- [ ] `JSON.stringify(doc)`
explain: Symbol keys are invisible to *enumeration* and perfectly visible to *copying* — spread and `Object.assign` both carry them over. That asymmetry is what makes them good for metadata, and it is also the part people get wrong when they need to strip it.
```

## The one nominal type

Now the TypeScript half, which is stranger and more interesting.

Annotate a `const` as `unique symbol` and you get a type with **exactly one value**:

```ts
const AUDIT: unique symbol = Symbol('audit')
type AuditKey = typeof AUDIT // the type whose only value is AUDIT
```

Two rules come with it. It must be `const` — a `let` could be reassigned, and the claim would be a lie.
And the annotation is required, because inference gives you plain `symbol`, meaning "some symbol, who
knows which", which is not specific enough to be a property key in a type:

```ts
interface Doc {
  readonly title: string
  readonly [AUDIT]?: string // legal: AUDIT is a unique symbol
}
```

Here is what makes it unusual. Every other type in TypeScript is **structural** — compatibility is
decided by shape, as lesson 1.6 laboured. `unique symbol` is **nominal**: its identity *is* the
declaration. Two files declaring `const AUDIT: unique symbol = Symbol('audit')` produce two unrelated
types that are not assignable to one another, however identical they look.

That is not a wart, it is the entire guarantee — and it is load-bearing enough that the exercise for
this lesson needed an extra file to accommodate it. `starter.ts` and `solution.ts` cannot each declare
their own keys, because the compiler correctly refuses to treat two different keys as the same one. They
share one declaration instead.

```quiz
id: typescript-functions-objects-symbols-q2
q: Two separate files each declare `const KEY: unique symbol = Symbol('k')`. How do the two types relate?
- [x] They are unrelated and not assignable to each other
- [ ] They are the same type, because the declarations are identical
- [ ] They are both simply `symbol`, so they are interchangeable
- [ ] The second declaration is a compile error
explain: `unique symbol` is nominal — the declaration *is* the identity. Identical source produces two different types, which is exactly right, because it produces two different keys at run time. It is the only place TypeScript abandons structural typing.
```

## `Symbol.for`, and the ones already in use

`Symbol.for` is the deliberate opposite. It looks a symbol up in a **global registry**, so the same
string gives the same symbol everywhere — across modules, and even across realms like an iframe or a
worker:

```ts
Symbol.for('app.audit') === Symbol.for('app.audit') // true
Symbol('app.audit') === Symbol('app.audit') // false
Symbol.keyFor(Symbol.for('app.audit')) // 'app.audit'
```

Use it for a protocol everybody must agree on. Never for private metadata — the whole benefit of a
symbol is that nobody else has it, and `Symbol.for` hands it out to anyone who knows the string.

Then there are the **well-known symbols**, which are how JavaScript exposes its own protocols as
properties you can implement. You have already used one:

```ts
class Playlist {
  *[Symbol.iterator]() {
    /* … */
  }
}
```

`Symbol.iterator` is what `for…of` looks for, exactly as the previous lesson described. Its siblings are
worth knowing by name: `Symbol.asyncIterator` for `for await…of`, `Symbol.hasInstance` to customise
`instanceof`, `Symbol.toPrimitive` for coercion, and `Symbol.toStringTag` for what `Object.prototype
.toString` reports. They are all keyed by symbols rather than strings for the reason this lesson opened
with — so adding a protocol to the language can never clash with a property somebody already had.

```quiz
id: typescript-functions-objects-symbols-q3
type: true-false
q: `Symbol.for('x')` is a good way to create a private metadata key that other libraries cannot reach.
answer: false
explain: It is the exact opposite. `Symbol.for` is a global registry keyed by that string, so any code anywhere that knows `'x'` gets the identical symbol. For a key nobody else can reach, use `Symbol('x')` and export the value rather than the name.
```

## What to take away

- `Symbol('x')` is a fresh, unguessable key every time; the description is for debugging and carries
  no identity.
- Symbol keys are skipped by `Object.keys`, `for…in` and `JSON.stringify` — and copied by spread and
  `Object.assign`.
- `unique symbol` is TypeScript's only nominal type, which is why it cannot be declared twice and why
  it works as a property key in a type.
- `Symbol.for` is a global registry for shared protocols; well-known symbols like `Symbol.iterator`
  are how the language uses the same trick on itself.
