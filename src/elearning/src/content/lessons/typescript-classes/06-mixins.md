---
title: Bolt an ability on
course: typescript-classes
order: 6
summary: A mixin is a function that takes a class and returns a subclass with something extra, which is how you get several abilities into a class that can only extend one thing. You will be able to write one, type it so the result keeps everything the base had, and judge when a plain function would have been better.
duration: 11
exercise: true
draft: false
---

You cannot fit a second engine in a car with one engine bay. You can bolt on a roof rack and a tow bar,
because those attach rather than replace.

A class has exactly one `extends`. This lesson is about the attachments, and it closes the course by
building on almost everything in it.

## A function that returns a class

That is the entire trick:

```ts
type Constructor<T = object> = new (...args: any[]) => T

function withSerializable<TBase extends Constructor>(Base: TBase) {
  return class extends Base {
    serialize(): string {
      return JSON.stringify({ ...this })
    }
  }
}

class Note {
  title: string

  constructor(title: string) {
    this.title = title
  }
}

const SerializableNote = withSerializable(Note)
new SerializableNote('Shopping').serialize()
```

`class extends Base` is an ordinary class expression, and `Base` is an ordinary parameter. Because the
mixin is a *function*, mixins compose — and functions composing is precisely what a single `extends`
slot cannot do:

```ts
const TimestampedNote = withSerializable(withTimestamp(Note))
```

Read it inside-out: `Note`, then timestamped, then serialisable. The result is a real class. You can
`new` it, subclass it, and `instanceof Note` is still true, because every mixin really did extend what
it was given.

```quiz
id: typescript-classes-mixins-q1
q: What makes it possible to give one class two independent abilities with mixins, when `extends` allows only one base?
- [x] Each mixin returns a new subclass, so applying two builds a chain of two
- [ ] Mixins copy members onto the prototype rather than using inheritance
- [ ] TypeScript allows multiple inheritance for classes returned from functions
- [ ] The abilities are merged at the type level and erased at run time
explain: `withSerializable(withTimestamp(Note))` is a three-link chain — `Note`, then one anonymous subclass, then another — so nothing about single inheritance was bent. The second option describes a different pattern that some libraries do use (`Object.assign` onto a prototype), and it is worse here for a reason worth noticing: `super` stops working, and the type of the result has to be asserted rather than derived.
```

## Typing it so nothing is lost

The `any[]` in `Constructor` looks alarming and is genuinely required. A mixin's constructor forwards
its arguments to a `super` whose signature it cannot know:

```ts
function withTimestamp<TBase extends Constructor>(Base: TBase) {
  return class extends Base {
    readonly createdAt: Date

    constructor(...args: any[]) {
      super(...args)
      this.createdAt = new Date()
    }
  }
}
```

With `unknown[]` that `super(...args)` is an error every time. The looseness is contained, though —
`Constructor` describes only the plumbing, and `new TimestampedNote('Shopping', 'milk')` is still
checked against `Note`'s real constructor.

The other thing worth doing is writing the return type out rather than letting it be inferred:

```ts
function withSerializable<TBase extends Constructor>(
  Base: TBase,
): TBase & Constructor<Serializable> {
```

`TBase & Constructor<Serializable>` reads as "everything the base could do, plus this". It is the
contract, and it keeps anonymous class types out of your error messages.

One error you will meet if you try to improve `Constructor` to `abstract new (...) => T`, which sounds
strictly better because it would let you mix into an abstract base: `TS2797`, *a mixin class that
extends from a type variable containing an abstract construct signature must also be declared
'abstract'*. Do that and the composed result cannot be constructed at all, so you need a further
concrete `class X extends withThing(Base) {}` wrapper. Knowing why that error appears is worth more
than avoiding it.

```quiz
id: typescript-classes-mixins-q2
q: Why does a mixin's `Constructor` type use `...args: any[]` rather than `...args: unknown[]`?
- [x] The mixin's constructor forwards arguments to a `super` whose signature it cannot know
- [ ] `unknown[]` cannot be used in a rest parameter
- [ ] Because mixins are applied before types are resolved
- [ ] So the composed class accepts any arguments at every call site
explain: `super(...args)` has to be callable with whatever the base expects, and `unknown` is not assignable to anything specific — so the forwarding call fails to compile. The last option is the tempting misreading: callers are *not* unchecked, because the concrete constructor's real signature is what a `new` expression is checked against.
```

## Where the pattern earns its keep, and where it does not

Two habits make mixins worth using.

**Give each ability an interface, and take that rather than the class.** A function declared
`describeRecord(value: Serializable & Timestamped)` works for any class either mixin was applied to,
including ones written after it — with no shared base class anywhere. That is the actual payoff, and
without it a mixin is just an inheritance chain with extra steps.

**Watch out when names collide.** Independent mixins compose in any order. When two define the same
member the outermost application wins, exactly as the last `extends` in a chain does — which is easy to
reason about and easy to forget when composing mixins somebody else wrote.

Then the harder question: should this be a mixin at all? Usually not. A mixin is worth it when the
ability needs to be *part of the object* — participating in `this`, in `super`, in construction, in
`instanceof`. Serialising own properties qualifies; so does anything that has to run at construction
time.

If a plain function would do — `serialize(note)` rather than `note.serialize()` — write the plain
function. It is easier to test, easier to tree-shake, needs none of this machinery, and does not
lengthen a prototype chain that somebody will eventually have to debug. The cost of mixins is that
`TimestampedNote` has no source file: when you go looking for where `createdAt` came from, there is no
class to open.

```quiz
id: typescript-classes-mixins-q3
q: Which of these is the best reason to write an ability as a mixin rather than a plain function?
- [x] It needs to run at construction time and participate in `this`
- [ ] It is used by several unrelated classes
- [ ] It keeps the call site shorter — `note.serialize()` rather than `serialize(note)`
- [ ] It groups related helpers together under one name
explain: Construction, `this`, `super` and `instanceof` are the things a free function genuinely cannot do, and needing them is the honest reason to reach for a mixin. Being used by several classes is a fine reason to write a *function* — that is what functions are for. The other two are style preferences, and they are not worth a class with no source file to open when someone asks where a member came from.
```

## What to take away

- A mixin is a function taking a class and returning a subclass of it; two applications build a chain
  of two, so nothing about single inheritance had to bend.
- `Constructor<T> = new (...args: any[]) => T` needs `any[]`, because a mixin constructor forwards to a
  `super` it cannot know — and callers are still checked against the concrete constructor.
- Declare the return type as `TBase & Constructor<Ability>` and give every ability an interface, so
  functions can ask for the capability instead of the class.
- Prefer a plain function unless the ability must participate in construction, `this`, `super` or
  `instanceof`. A composed class has no source file for anyone to open.
