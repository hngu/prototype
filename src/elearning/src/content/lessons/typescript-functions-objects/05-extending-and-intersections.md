---
title: Staple a page on, or demand both
course: typescript-functions-objects
order: 5
summary: There are two ways to combine object types, and they usually produce the same thing. The case where they differ decides which one you should reach for by default.
duration: 10
exercise: true
draft: false
---

There are two ways to ask somebody for more information. Staple an extra page to the form they
already have. Or hand them two separate forms and say *fill in both*.

TypeScript has both moves. They almost always end up in the same place, and the one time they do not
is worth the whole lesson.

## The staple

`extends` on an interface means "everything from there, plus these":

```ts
interface Note {
  readonly title: string
  readonly body: string
}

interface StoredNote extends Note {
  readonly id: string
  readonly createdAt: number
}
```

A `StoredNote` is a `Note` and can go anywhere a `Note` is wanted. It can extend several at once —
`interface A extends B, C` — and an interface may extend a `type` alias, so this is not a fork in the
road you get locked into.

## The two forms

`&` builds an **intersection**: a type whose values satisfy both sides at once.

```ts
type StoredNote = Note & { readonly id: string; readonly createdAt: number }
```

Read as sets, `&` is genuinely intersection — the values that are in both. For object types that
means *more* members and therefore *fewer* possible values, which trips people up: `A & B` feels like
it should be smaller and is in fact stricter. `A | B` is the loose one.

Intersections do the thing interfaces cannot: they compose. Give a name to the addition and it becomes
reusable:

```ts
type WithId<T> = T & { readonly id: string }
type Timestamped<T> = T & { readonly createdAt: number; readonly updatedAt: number }

type StoredNote = Timestamped<WithId<Note>>
type StoredUser = Timestamped<WithId<User>>
```

Two helpers, and every "same thing, but stored" type in the codebase stops being a hand-written copy
with three fields bolted on. When the id becomes a `number`, there is one line to change. (Those take a
type parameter, which the next course is about — for now `WithId<Note>` reads as "a `Note`, plus an
`id`".)

```quiz
id: typescript-functions-objects-extending-and-intersections-q1
q: `Stored = Note & { id: string }`. Which are true?
- [x] A `Stored` can be passed to a function expecting a `Note`
- [x] `Stored` has more members than `Note` and therefore fewer possible values
- [ ] A `Note` can be passed to a function expecting a `Stored`
- [ ] `&` makes both sides' properties optional
explain: An intersection is assignable *up* to either side, because it has everything each side asked for. The reverse fails — a plain `Note` has no `id`. And despite the name, intersecting object types adds requirements: fewer values satisfy it, not more.
```

## Where they part company

Now the divergence. Take two types that both declare `x`, with different types:

```ts
interface HasStringX {
  x: string
}
interface HasNumberX {
  x: number
}
```

With `extends`, TypeScript refuses at the declaration:

```ts
interface Both extends HasStringX, HasNumberX {}
//        ^^^^ Interface 'Both' cannot simultaneously extend types
//             'HasStringX' and 'HasNumberX'.
```

With `&`, it says nothing whatsoever:

```ts
type Both = HasStringX & HasNumberX // no error
```

It computes `x: string & number`, which is `never` — the empty set, because no value is both a string
and a number. The type is legal and impossible to build, and you find out later, once per attempt:

```ts
const both: Both = { x: 'a' } // Type 'string' is not assignable to type 'never'.
```

Same disagreement, two experiences: an error at the declaration with a sentence explaining it, or a
puzzle at every call site. **Prefer `extends` when either would do**, and reach for `&` when you need
composition — a reusable `WithId<T>`, or combining types you do not own.

```quiz
id: typescript-functions-objects-extending-and-intersections-q2
q: `type Both = { x: string } & { x: number }`. What does TypeScript report?
- [x] Nothing at the declaration; `x` becomes `never` and errors appear at every use
- [ ] An error at the declaration, like the `extends` version
- [ ] `x` becomes `string | number`
- [ ] The second `x` silently wins
explain: `&` intersects each member's type too, and `string & number` is `never`. The declaration is perfectly legal — it is simply a type nothing can satisfy — so the error surfaces wherever somebody tries to create one.
```

## Ask for the least you need

The reason all of this matters day to day is not the syntax; it is that composing types lets you write
*small* parameter types.

```ts
function summarise(entity: WithId<Note>): string
function ageMs(entity: Timestamps, now: number): number
```

Neither asks for a whole `StoredNote`. `summarise` needs an id and a title; `ageMs` needs two numbers
and does not care what they are attached to. A `StoredNote` satisfies both, because a parameter type is
a **floor and not a ceiling** — and so does a draft that has an id but no timestamps, and so does a
test fixture with nothing else in it at all.

Writing `StoredNote` on every parameter works today and is wrong the first time somebody holds one of
the pieces and not the others. Naming the pieces — `Timestamps`, `WithId<T>` — is what makes asking for
just one of them possible.

```quiz
id: typescript-functions-objects-extending-and-intersections-q3
type: true-false
q: Typing a parameter as `Timestamps` rather than `StoredNote` means callers must strip the extra fields off before calling.
answer: false
explain: Structural typing means anything carrying `createdAt` and `updatedAt` qualifies, extra fields included — nobody strips anything. Asking for the smallest shape costs the caller nothing and buys you every future caller who has only that piece.
```

## What to take away

- `extends` and `&` usually produce the same type, and an intersection is assignable up to either
  side.
- Intersecting object types *adds* requirements — `A & B` is the strict one, `A | B` the loose one.
- On a conflicting member, `extends` errors at the declaration and `&` produces `never` and errors at
  every use. Prefer `extends` unless you need composition.
- Compose named pieces so parameters can ask for the minimum; a parameter type is a floor, not a
  ceiling.
