# Inherit the machine, sign the contract

`extends` hands you a working machine and lets you change part of it. `implements` only
makes you sign a form promising you have one.

This exercise uses both, so the difference is visible rather than described.

## Goal

Build a small shape hierarchy: an `abstract class Shape` that writes `describe` once, and
two subclasses that supply the parts it cannot know.

- **`Shape`** — assign `name` in the constructor. Implement `describe()` as
  `square with area 9.00` (areas to two decimal places) and `isLargerThan(other)`, both in
  terms of the `abstract` members.
- **`Square` / `Circle`** — validate the argument with a `RangeError` unless it is a
  positive, finite number, then implement `area()` and `sides`. A circle answers **zero**
  sides.
- **`Circle.describe()`** overrides the inherited one and calls it: `circle with area
  12.57 (r=2)`.
- **`largestFirst(shapes)`** — largest area first, without modifying the array and without
  asking what any shape is.
- **`describeAll(items)`** — takes `Describable`, not `Shape`. That is the whole reason the
  interface exists separately from the class.

## The ordering rule in a subclass constructor

Two rules, and only one of them is about `this`:

```ts
constructor(side: number) {
  if (!Number.isFinite(side) || side <= 0) throw new RangeError(…) // fine before super
  super('square')
  this.side = side // only after
}
```

You **may** run statements before `super(…)` as long as they do not touch `this` —
validating an argument is the standard reason to, and doing it first means nothing
half-built exists when the argument is bad. You **may not** assign a field before it: the
base constructor is what brings `this` into existence, and JavaScript enforces that with a
`ReferenceError` rather than a compiler message.

The stubs already contain `super(…)`, which is not a freebie. `TS2377` requires a derived
constructor to contain a `super` call, so a stub of pure `throw` would not compile — and a
fresh clone of this package has to typecheck. Rewrite the whole body.

## `override`, and when it is compulsory

Under `noImplicitOverride`:

| Replacing | `override` required? |
| --- | --- |
| a concrete inherited method (`describe`) | **yes** — `TS4114` otherwise |
| an `abstract` member (`area`, `sides`) | no — there was no working code to replace |

It is allowed in both cases, and this exercise writes it in both, because it documents
intent for free. The failure it prevents is the expensive one: rename `describe` on the
base and, without the flag, `Circle.describe` silently stops overriding anything and
becomes a method nobody calls.

## Why the parity check looks different here

`Shape` has a `protected` member, and `protected` is nominal in exactly the way `private`
is — so the two files' `Shape`s are unrelated types and the usual mutual-assignability
check cannot work. `solution.test.ts` declares the API once instead.

One detail in that contract is worth knowing about generally: every member is written with
**method syntax**. `largestFirst: (shapes: readonly ShapeApi[]) => …` would be checked
contravariantly under `strictFunctionTypes` and fail; a method declaration is bivariant.

## Run it

```bash
pnpm --filter exercises attempt   # grade your starter.ts — start here
pnpm --filter exercises verify    # the full gate CI runs
```

Work in `starter.ts`. `solution.ts` is the reference answer, and the same tests
grade both — which is what keeps the answer and the tests honest.

## Hints

<details>
<summary>Hint 1 — describe, on the base</summary>

`` `${this.name} with area ${this.area().toFixed(2)}` ``.

The interesting part is that this compiles at all: `this.area()` has no implementation
anywhere in `Shape`. `abstract` is the promise that makes it legal, and the compiler
collects on that promise from every subclass.

</details>

<details>
<summary>Hint 2 — Circle.describe</summary>

`super.describe()` reaches the implementation you just replaced. Build on it rather than
restating its format, so the format lives in one place.

</details>

<details>
<summary>Hint 3 — largestFirst</summary>

`[...shapes].sort((a, b) => b.area() - a.area())`. The spread matters: `sort` mutates in
place, and `readonly` is erased before this runs, so it is the copy that protects the
caller rather than the type.

</details>

<details>
<summary>Hint 4 — why zero sides</summary>

The alternatives are worse. `Infinity` is a joke the caller has to be in on, and throwing
means every consumer of `sides` needs a `try`. It is worth noticing that the awkwardness
is real information: when a subclass cannot sensibly answer an abstract member, that
member often belongs somewhere narrower than the base.

</details>
