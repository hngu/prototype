# Bolt an ability on

You cannot fit two engines in a car with one engine bay. You can bolt on a roof rack and
a tow bar, because those are attachments rather than replacements.

A class has exactly one `extends`. Mixins are how you bolt things on.

## Goal

Write two mixins, then a class composed from both.

- **`withSerializable(Base)`** — returns a subclass of `Base` with `toRecord()` (own
  enumerable properties as a plain object) and `serialize()` (that, as JSON).
- **`withTimestamp(Base)`** — returns a subclass with a `readonly createdAt` set at
  construction and `ageInSeconds(now)`, floored to whole seconds and **never negative**.
- **`timestampedNote()`** — returns `Note` with both applied.
- **`describeRecord(value, now)`** — `<serialize() output> @ <ageInSeconds(now)>s`, taking
  the two *interfaces* rather than the composed class.

`Note` is given, and nothing about it knows the mixins exist. That is the point.

## The whole trick

A mixin is a function that takes a class and returns a subclass of it:

```ts
export function withSerializable<TBase extends Constructor>(
  Base: TBase,
): TBase & Constructor<Serializable> {
  return class extends Base {
    serialize(): string {
      /* … */
    }
  }
}
```

Functions compose; a single `extends` slot does not. Everything good about the pattern
follows from that one substitution.

Two details in the signature:

- **`Constructor<T> = new (...args: any[]) => T`.** `any[]` is genuinely required here — a
  mixin constructor forwards `...args` to a `super` whose signature it cannot know, and
  `unknown[]` makes every such call an error. It is contained: this type describes only the
  plumbing, and `new TimestampedNote('a', 'b')` is still checked against `Note`.
- **The return type is written out**, not inferred. `TBase & Constructor<Serializable>`
  reads as "everything the base could do, plus this", and an inferred anonymous class type
  is unpleasant in an error message.

## A mixin constructor has one legal shape

```ts
constructor(...args: any[]) {
  super(...args)
  this.createdAt = new Date()
}
```

Forced rather than chosen: this code cannot know what `Base` takes, so it accepts anything
and forwards it untouched. `super(...args)` before any `this`, as in any subclass.

## Two things worth knowing before you use this for real

**Order matters only when names collide.** These two mixins are independent, so
`withSerializable(withTimestamp(Note))` and the reverse are equivalent. When two mixins
define the same member, the outermost application wins — exactly as the last `extends` in a
chain does. `solution.test.ts` demonstrates it with a pair of local mixins, because it is the
part people get wrong when composing mixins they did not write.

**`abstract new` is the tempting change that does not work.** Widening `Constructor` to
`abstract new (...) => T` would let you mix into an abstract base, which sounds strictly
better. But then `TS2797` requires the returned class to be declared `abstract` too, and an
abstract class cannot be constructed — so the composed result is unusable without a further
concrete `class X extends withThing(Base) {}` wrapper. Worth knowing when you meet the error;
not worth paying for here.

## One cast, and it is a familiar rule

`toRecord` returns `{ ...this } as Record<string, unknown>`. The cast is needed for the same
reason lesson 4.4's constraint trap exists: a class instance type has no **implicit** index
signature, so it is not assignable to `Record<string, unknown>` even though every property it
has is a string key. Only object type aliases get that courtesy.

`Object.fromEntries(Object.entries(this))` avoids the cast by doing real work at run time to
produce a value the compiler already believes in. Either is defensible.

Note what `{ ...this }` leaves out, because it is a genuine advantage: methods live on the
prototype, and `#private` fields are not own properties. So `serialize` on an object with a
`#secret` cannot leak it — whereas a TypeScript `private` field would appear in full.

## Run it

```bash
pnpm --filter exercises attempt   # grade your starter.ts — start here
pnpm --filter exercises verify    # the full gate CI runs
```

Work in `starter.ts`. `solution.ts` is the reference answer, and the same tests
grade both — which is what keeps the answer and the tests honest.

## Hints

<details>
<summary>Hint 1 — withSerializable</summary>

An anonymous `class extends Base` needs no name, because the only thing that refers to it is
the value being returned. Write `toRecord` first and have `serialize` call it, so the two
cannot disagree about what is included.

</details>

<details>
<summary>Hint 2 — ageInSeconds</summary>

`Math.max(0, Math.floor((now.getTime() - this.createdAt.getTime()) / 1000))`.

The `Math.max` is not defensive padding — a caller can pass any `now`, including one before
the object existed, and a negative age is not a thing.

</details>

<details>
<summary>Hint 3 — timestampedNote</summary>

`return withSerializable(withTimestamp(Note))`. It reads inside-out: `Note`, then
timestamped, then serialisable.

</details>
