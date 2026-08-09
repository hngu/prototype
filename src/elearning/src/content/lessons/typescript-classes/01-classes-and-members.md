---
title: A cutter and a checklist
course: typescript-classes
order: 1
summary: A class declares what every one of its objects will have before a single one exists. You will be able to declare fields and getters, keep an object's invariants in its constructor, and explain why the one piece of shorthand TypeScript offers here is the only piece that cannot be simply deleted.
duration: 10
exercise: true
draft: false
---

A cookie cutter makes cookies the same shape every time. You do not inspect each cookie to find out
whether it came out star-shaped — the cutter settled that.

A class is the cutter. It says what every object made from it will have, once, before a single one
exists. That is the whole idea, and the interesting part is what TypeScript adds to it.

## What every object will have

A class body is a list of promises about each instance. In JavaScript those promises are implicit —
you find out what an object has by reading every method that might have assigned something.
TypeScript makes you say it up front:

```ts
class Reading {
  station: string
  celsius: number
  recordedAt: Date

  constructor(station: string, celsius: number) {
    this.station = station
    this.celsius = celsius
    this.recordedAt = new Date()
  }
}
```

Three **field declarations**, then a constructor that assigns them. Miss one and the compiler
objects — `Property 'recordedAt' has no initializer and is not definitely assigned in the
constructor` — which is a genuinely useful complaint, because a field the compiler thinks is a `Date`
and is actually `undefined` will fail somewhere far away from the mistake.

Fields can carry an initialiser instead, and then the type is inferred exactly as it is for a `const`:

```ts
class Counter {
  count = 0 // number
  readonly createdAt = new Date() // Date
}
```

`readonly` means "assignable in the constructor or the initialiser, nowhere else". It is a
compile-time promise only — nothing about the built JavaScript stops a write — which makes it a good
description of intent and a bad security boundary.

```quiz
id: typescript-classes-classes-and-members-q1
q: A class declares `total: number` with no initialiser, and the constructor never assigns it. What happens?
- [x] `tsc` reports an error, because the field is not definitely assigned
- [ ] Nothing — the field is inferred as `number | undefined`
- [ ] Nothing at compile time; it fails at run time on first read
- [ ] `tsc` reports an error, because fields always require an initialiser
explain: Under `strictPropertyInitialization` (part of `strict`) the compiler insists that a declared, non-optional field is definitely assigned by the time the constructor finishes. It does *not* silently widen the type to include `undefined` — that would make every field on every class optional, and the annotation you wrote would stop meaning anything. Fields declared with an initialiser are fine, which is why the last option is wrong.
```

## Methods, getters, and the one shorthand you cannot use

Methods are functions on the prototype, with the return type usually inferred and better written
down for anything public. Getters are the interesting ones:

```ts
class Reading {
  celsius: number

  constructor(celsius: number) {
    this.celsius = celsius
  }

  get fahrenheit(): number {
    return this.celsius * 1.8 + 32
  }
}
```

`reading.fahrenheit` reads like a field and computes on access. The reason to prefer it over a stored
field is not syntax — it is that **a derived value cannot drift**. There is no second copy of the
truth to forget to update.

Now the shorthand. Writing `this.x = x` for six fields is dull, so TypeScript offers a **parameter
property**:

```ts
class Reading {
  constructor(
    readonly station: string,
    private celsius: number,
  ) {}
}
```

That declares both fields *and* assigns them. You will meet it constantly in real code, and it is
worth knowing precisely what it is: **not a type annotation, but an instruction to generate an
assignment**. Every other piece of TypeScript on this page can be deleted, leaving working
JavaScript. This one cannot — delete the annotations and you get an empty constructor.

Which is exactly why the exercises in this course write the long form. Node runs TypeScript by
*erasing* types, not compiling them, so a parameter property parses fine and then never assigns
anything: every read is `undefined`, with no error at all. The exercises set `erasableSyntaxOnly`,
which turns it into a compiler error instead. Course 6 gives that flag its own lesson.

```quiz
id: typescript-classes-classes-and-members-q2
q: Which of these is *not* simply deleted when TypeScript is turned into JavaScript?
- [x] `constructor(private celsius: number) {}`
- [ ] `readonly station: string`
- [ ] `get fahrenheit(): number`
- [ ] `private celsius: number`
explain: A parameter property has to *generate* `this.celsius = celsius`, so removing the type information removes the behaviour. The others are all erasable: a field declaration leaves `celsius;` or disappears, `readonly` and `private` are compile-time-only annotations, and a getter is plain JavaScript with its return type stripped. This is the seam that decides which TypeScript a runtime can execute directly.
```

## Statics, and the object the class itself is

A class is also a value — an object sitting there at run time — and `static` members hang off *that*
rather than off instances:

```ts
class Reading {
  static readonly UNIT = '°C'

  static parse(line: string): Reading | undefined {
    const [station, raw] = line.split(',')
    const celsius = Number(raw)
    if (station === undefined || Number.isNaN(celsius)) return undefined
    return new Reading(station, celsius)
  }

  // …
}
```

`Reading.parse('KEW,14')` needs no instance, because it is the thing that makes one. That is the
**named constructor** pattern, and it exists because a class may have only one `constructor`: every
other way of building the object becomes a static factory with a name that says what it does.

Two things surprise people. A static member **cannot see the class's type parameter** — `class
Box<T> { static empty(): Box<T> }` is an error, because no `T` has been chosen yet; declare the
static's own parameter instead. And `static` blocks let you run setup code once when the class is
first evaluated:

```ts
class Registry {
  static known: readonly string[]

  static {
    Registry.known = Object.freeze(['kew', 'heathrow'])
  }
}
```

```quiz
id: typescript-classes-classes-and-members-q3
q: Why is `class Box<T> { static empty(): Box<T> { … } }` an error?
- [x] `T` is chosen per instance, and a static member exists before any instance does
- [ ] Static methods cannot have return types that mention their own class
- [ ] `T` is only in scope inside the constructor
- [ ] Static generics need an explicit `<T>` on the `static` keyword
explain: There is one `Box` class object, shared by every `Box<string>` and `Box<number>` ever made, so there is nothing for `T` to refer to in a static member. The fix is for the static to take its own type parameter — `static empty<U>(): Box<U>` — which is why the exercise's `static of<U>()` uses a different letter deliberately rather than by accident.
```

## What to take away

- A class body is a list of promises about every instance, and `strict` makes the compiler hold you
  to them: a declared field must be definitely assigned by the end of the constructor.
- Prefer a getter to a stored field for anything derived — a computed value cannot drift out of sync,
  because there is no second copy to update.
- A parameter property is the one piece of class syntax that generates code rather than annotating
  it, which is why a runtime that only erases types cannot run it.
- `static` members belong to the class object, not to instances; they are how a class gets more than
  one way to build itself, and they cannot see its type parameters.
