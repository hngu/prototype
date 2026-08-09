---
title: Whoever is holding the tool
course: typescript-functions-objects
order: 3
summary: In a regular function, `this` means whoever called it — and a callback is handed around constantly. TypeScript lets you write down who you expect, using a parameter that takes up no space.
duration: 10
exercise: true
draft: false
---

"Pass me that one" works fine across a table. Say it down the phone and it means nothing, because
the person on the other end cannot see what you are pointing at.

`this` is that word, and callbacks are the phone. This lesson is about saying who you meant.

## The word that depends on who is speaking

In a regular `function`, `this` is decided **at the call site**, not where the function was written:

```ts
const bus = { name: 'bus' }

function report() {
  return this.name // who is 'this'?
}

report.call(bus) // 'bus'
report() // undefined — and a crash on .name
```

That is JavaScript, not TypeScript, and it is why `this` has a bad reputation. TypeScript's
contribution is `noImplicitThis` — part of `strict` — which stops the guessing:

```ts
function report() {
  return this.name
  //     ^^^^ 'this' implicitly has type 'any' because it does not have a type annotation.
}
```

The fix is a **`this` parameter**: a first parameter, named `this`, that is not really a parameter at
all.

```ts
type Handler = (this: Emitter, payload: string) => string
```

It must come first. It occupies no argument slot — `handler('hi')` passes one argument, not two. And
it is erased completely, like every other type. While it exists, though, two things become true: the
body can write `this.name` with no annotation, and `handler.call(wrongThing, 'hi')` is a compile
error, because `strict` includes `strictBindCallApply` and `.call` checks its first argument against
that declared type.

```quiz
id: typescript-functions-objects-this-and-callbacks-q1
q: What is true of the `this` parameter in `(this: Emitter, payload: string) => string`?
- [x] It must be the first parameter, and callers pass only `payload`
- [x] It is erased at compile time and has no runtime cost
- [ ] It makes the function's `this` unchangeable at runtime
- [ ] It adds a second required argument at the call site
explain: A `this` parameter is a type annotation in a parameter position — first, free, and gone before the code runs. It does not *bind* anything: `this` is still decided by the caller, and all TypeScript does is check that the caller is passing the right thing.
```

## Arrows do not have one

Arrow functions have no `this` of their own. They use whatever `this` meant in the surrounding
scope, permanently, and no amount of `.call` or `.bind` can change it.

That is a feature far more often than a limitation. It is why the callback inside a method just works:

```ts
class Counter {
  private total = 0
  addAll(values: readonly number[]) {
    values.forEach((value) => {
      this.total += value // `this` is the Counter, because arrows inherit it
    })
  }
}
```

Write `function (value) { … }` there instead and `this` becomes whatever `forEach` decided, which is
`undefined`. The pre-arrow world was full of `const self = this` for exactly this reason.

Two consequences worth holding on to:

- A callback that needs `this` must be a `function`, not an arrow — an arrow cannot receive one.
- Assigning an arrow to a type that *declares* a `this` parameter is still allowed, because ignoring
  `this` is always safe. So the compiler will not warn you that your arrow handler is not going to
  see the emitter. That is a design choice, and it is the one thing here you have to remember rather
  than rely on.

```quiz
id: typescript-functions-objects-this-and-callbacks-q2
q: A parameter is typed `(this: Emitter, payload: string) => string`. You pass an arrow function `(payload) => payload`. What happens?
- [x] It compiles, and the arrow simply never sees the emitter
- [ ] A compile error, because an arrow has no `this` parameter
- [ ] It compiles and the arrow's `this` is bound to the emitter at runtime
- [ ] A compile error, because the parameter counts do not match
explain: A function without a `this` parameter is assignable to one with it — ignoring `this` cannot break anything. Which means this particular mistake is not caught for you: if the handler needed the emitter, it needed to be a `function`.
```

## Three utility types for `this`

The standard library ships three helpers that exist purely because of everything above.

**`ThisParameterType<T>`** pulls the declared `this` type back out — `ThisParameterType<Handler>` is
`Emitter`. Useful when you are writing a wrapper and need to accept the same receiver.

**`OmitThisParameter<T>`** removes it. `OmitThisParameter<Handler>` is `(payload: string) => string`,
which is precisely what `Function.prototype.bind` gives you at runtime:

```ts
function bindHandler(emitter: Emitter, handler: Handler): OmitThisParameter<Handler> {
  return (payload) => handler.call(emitter, payload)
}
```

Once the receiver is decided, nobody downstream should have to think about it. Returning the
`this`-free type is how you say so.

**`ThisType<T>`** is the odd one out: not a transformation but a **marker**. Put it in the type of an
object literal and it changes what `this` means inside that literal's methods, without contributing
any members:

```ts
interface Helpers {
  readonly total: number
  add(n: number): void
}

const helpers: Helpers & ThisType<Helpers & { log: (m: string) => void }> = {
  total: 0,
  add(n) {
    this.log(`adding ${n}`) // `log` is not in Helpers, but `this` has it
  },
}
```

It exists for APIs that hand your methods a richer `this` than the object you wrote — Vue's options
object being the canonical example. You will read it far more often than you write it.

```quiz
id: typescript-functions-objects-this-and-callbacks-q3
type: true-false
q: `OmitThisParameter<T>` describes the type that `Function.prototype.bind` returns.
answer: true
explain: Binding answers the `this` question once and for all, so the resulting function has the same parameters and return type with the `this` requirement gone — which is exactly what `OmitThisParameter` computes. Returning it from a wrapper stops callers having to care about a decision you already made for them.
```

## What to take away

- In a `function`, `this` is decided by the caller; `noImplicitThis` stops TypeScript guessing about
  it.
- A `this` parameter must come first, costs nothing at runtime, and makes `.call` type-checked.
- Arrows inherit `this` and can never be given one — which is why callbacks inside methods should be
  arrows, and callbacks that need a receiver must not be.
- `OmitThisParameter` is the return type of a binding wrapper; `ThisType` is a marker for APIs that
  enrich `this`.
