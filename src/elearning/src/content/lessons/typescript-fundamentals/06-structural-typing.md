---
title: Job descriptions, not name badges
course: typescript-fundamentals
order: 6
summary: TypeScript decides whether two types are compatible by comparing their shapes, never their names. This single rule explains a great deal of behaviour that otherwise looks like the compiler being inconsistent.
duration: 10
exercise: true
draft: false
---

A café puts a card in the window: *wanted, someone who can make coffee.* Nobody turns up with a
certificate that says "Barista" on it. Somebody makes a coffee, and they are hired.

TypeScript hires the same way, and once you have seen it you will stop being surprised by about a
third of the language.

## Nobody checks your badge

Most typed languages you may have met are **nominally** typed: two types are compatible when they
share a name, or when one was explicitly declared to extend the other. TypeScript is
**structurally** typed. Two types are compatible when their shapes fit, and the names are decoration.

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

`marker` never heard of `Point`. It does not import it, extend it, or mention it. It is accepted
because it *has* an `x: number` and a `y: number` — it can make the coffee. The extra `label` is
nobody's business; it met the requirement and then some.

This is why you should type a parameter against the smallest shape it actually needs:

```ts
// Wants a name. Does not care whether that is a User, an Org, or a test fixture.
function greet(entity: { name: string }) {
  return `Hello, ${entity.name}`
}
```

Callers never import a type or reshape their data to satisfy you, which sounds like a small
convenience and turns out to be the reason TypeScript sits so comfortably on top of JSON,
third-party objects and code written years before anyone typed anything.

```quiz
id: typescript-fundamentals-structural-typing-q1
q: Why does `distance(marker)` compile, when `marker` was never declared as a `Point`?
- [x] Compatibility is decided by shape, and `marker` has every property `Point` requires
- [ ] TypeScript silently casts the argument to `Point`
- [ ] Extra properties are always ignored on function arguments
- [ ] `interface` declarations are erased, so the parameter is effectively `any`
explain: This is structural typing: any value carrying `x: number` and `y: number` is a `Point` as far as the compiler is concerned. Nothing is cast and nothing is loosened — the parameter keeps its full type, and `marker` genuinely satisfies it.
```

## One carve-out, and it is about typos

There is exactly one place TypeScript stops being relaxed about extra properties. Write the object
**inline** and the spare key is an error:

```ts
distance({ x: 3, y: 4, label: 'home' })
//                     ^^^^^ Object literal may only specify known properties
```

That looks like a flat contradiction of the previous section. It is a deliberate exception called
**excess property checking**, and its only purpose is catching mistakes.

Think about what an inline literal *is*. You wrote it right there, at the point of the call, for
this call. If it has a key the function does not want, there is no other variable it could be
serving and no other purpose the key could have — so it is almost certainly `lable` misspelled, or
the wrong function. TypeScript calls it out.

Assign the same object to a variable first and the check does not apply, because the object is no
longer **fresh**: it has an independent existence, and its extra key plausibly matters to somebody
else. Freshness is lost the moment a value is stored, which is exactly the moment the typo
explanation stops being the likeliest one.

```quiz
id: typescript-fundamentals-structural-typing-q2
q: Which of these does excess property checking reject?
- [x] `distance({ x: 1, y: 2, z: 3 })`
- [ ] `const p = { x: 1, y: 2, z: 3 }; distance(p)`
- [x] `const p: Point = { x: 1, y: 2, z: 3 }`
- [ ] `distance({ x: 1, y: 2 })`
explain: The check applies to *fresh* literals — one written inline as an argument, or one assigned straight to an annotated binding. Route it through an unannotated variable first and freshness is gone, so the ordinary structural rule takes over.
```

## Where you have seen this before

Two things worth knowing depending on where you arrived from.

**Coming from Java or C#**, the rule to unlearn is that `implements` matters. In TypeScript it is a
convenience: it makes the compiler check a class against an interface at the point of declaration and
give you a better error message. It creates no relationship that the shapes did not already create.
Two interfaces with different names and identical members are simply the same type wearing two hats.

**Coming from a functional language**, the useful frame is that a type is a **set of values**.
`string` is the set of all strings. `'usd' | 'eur'` is a set with two members. `A | B` is a union of
sets and `A & B` is an intersection, which is why `{ name: string } & { id: string }` demands both
fields rather than fewer — it is the set of values in both sets at once. And a value is assignable
to a type when it is a member of that set, which is all structural typing ever meant.

That frame also explains the strangest corner of the language, which we meet properly in the next
lesson: `never` is the empty set. Nothing is a member of it, so nothing can be assigned to it, and a
function returning `never` cannot return at all.

```quiz
id: typescript-fundamentals-structural-typing-q3
type: true-false
q: Two interfaces with different names but identical members are interchangeable.
answer: true
explain: Names carry no weight in a structural system, so identical members make the types mutually assignable — `interface Point` and `interface Vector2` with the same fields are one type described twice. `implements` and `extends` improve your error messages; they do not create the relationship.
```

## What to take away

- Compatibility is decided by shape. Names, `implements` and declared inheritance do not enter into
  it.
- Type parameters against the minimum shape you need and callers get flexibility for nothing.
- Extra properties are fine unless the value is a *fresh* literal, where they are flagged as likely
  typos — storing it in a variable removes the freshness.
- Reading a type as a set of values makes unions, intersections and eventually `never` fall into
  place.
