---
title: Structural typing
course: typescript-fundamentals
order: 3
summary: TypeScript compares types by shape, not by name. This explains a surprising amount of behaviour that otherwise looks like the compiler being inconsistent.
duration: 7
draft: false
---

Most typed languages you may have used are **nominally** typed: two types are compatible when
they share a name or an explicit declaration. TypeScript is **structurally** typed. Two types are
compatible when their shapes are compatible, regardless of what they are called.

```ts
interface Point {
  x: number
  y: number
}

function distance(p: Point) {
  return Math.hypot(p.x, p.y)
}

const marker = { x: 3, y: 4, label: 'home' }
distance(marker) // fine
```

`marker` was never declared as a `Point` and does not mention it. It is accepted because it *has*
an `x: number` and a `y: number`. The extra `label` is irrelevant — it satisfies the requirement
and then some.

```quiz
id: typescript-fundamentals-structural-typing-q1
q: Why does `distance(marker)` compile, even though `marker` was never declared as a `Point`?
- [x] TypeScript compares types by shape, and `marker` has every property `Point` requires
- [ ] TypeScript silently casts the argument to `Point`
- [ ] Extra properties are always ignored on function arguments
- [ ] `interface` declarations are erased, so the parameter is effectively `any`
explain: This is structural typing. Compatibility is decided by shape, so any value carrying `x: number` and `y: number` is a valid `Point`. Nothing is cast, and the parameter keeps its full type.
```

## The exception: fresh object literals

There is one deliberate carve-out. Pass an object literal *directly* and the extra property is an
error:

```ts
distance({ x: 3, y: 4, label: 'home' })
//                     ^^^^^ Object literal may only specify known properties
```

This is **excess property checking**, and it exists purely to catch typos. If you write a literal
inline, the extra key almost certainly means you misspelled something or targeted the wrong
function — there is no other variable it could have been meant for. Assign it to a variable first
and the check does not apply, because now the extra property plausibly serves another purpose.

```quiz
id: typescript-fundamentals-structural-typing-q2
q: Which of these are rejected by excess property checking?
- [x] `distance({ x: 1, y: 2, z: 3 })`
- [ ] `const p = { x: 1, y: 2, z: 3 }; distance(p)`
- [x] `const p: Point = { x: 1, y: 2, z: 3 }`
- [ ] `distance({ x: 1, y: 2 })`
explain: Excess property checking only applies to *fresh* object literals — one passed directly as an argument, or one assigned straight to an annotated binding. Going through an intermediate variable removes the freshness, so the ordinary structural rule applies instead.
```

## Why this matters in practice

Structural typing is what lets you type a function against the smallest shape it actually needs:

```ts
// Needs a name — does not care whether it is a User, an Org or a test fixture
function greet(entity: { name: string }) {
  return `Hello, ${entity.name}`
}
```

Callers never have to import a type or restructure their data to satisfy you. It is also why
TypeScript works so comfortably over plain JSON, third-party objects and code that predates any
type declarations at all.

```quiz
id: typescript-fundamentals-structural-typing-q3
type: true-false
q: Two TypeScript interfaces with different names but identical members are interchangeable.
answer: true
explain: Names carry no weight in a structural system. If the members match, the types are mutually assignable — which is why `interface Point` and `interface Vector2` with the same fields can be used in place of one another.
```

## What to take away

- Compatibility is decided by shape, not by name or declared inheritance.
- Extra properties are fine — unless the value is a fresh object literal, where they are flagged
  as likely typos.
- Type parameters against the minimum shape you need, and callers get flexibility for free.
