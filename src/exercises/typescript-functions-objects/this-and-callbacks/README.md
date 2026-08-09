# Whoever is holding the tool

"Pass me that" only works if someone can see what you are pointing at. Say it down
the phone and it means nothing at all.

`this` is that word. In a `function`, it means whoever called it — and callbacks
change hands constantly, so by the time your handler runs, the caller may be
somebody you have never heard of. TypeScript's answer is to let you write down who
you expect, as a parameter that vanishes at compile time.

## Goal

Implement the two functions in `starter.ts`:

- **`makeEmitter(name)`** returns an `Emitter`. `on(event, handler)` registers a
  handler; several may share one event. `emit(event, payload)` calls every handler
  for that event **in registration order**, with `this` bound to the emitter, and
  returns their results. An unknown event returns `[]`.
- **`bindHandler(emitter, handler)`** ties the two together up front and returns a
  plain function. The return type is `OmitThisParameter<Handler>`, which is
  `(payload: string) => string` — the same signature with the `this` requirement
  removed, because it has been answered.

The type that makes it work is the first line of the file:

```ts
export type Handler = (this: Emitter, payload: string) => string
```

`this: Emitter` is a **fake first parameter**. It must come first, it takes up no
argument slot, and it is erased entirely — but while it exists, it means a handler
can write `this.name` with no annotation, and `handler.call(wrongThing, …)` is a
compile error rather than a Tuesday afternoon.

## Three utility types in the neighbourhood

- **`ThisParameterType<Handler>`** is `Emitter` — it pulls the `this` type back out.
  The test asserts this at compile time, so changing `Handler`'s `this` breaks the
  build.
- **`OmitThisParameter<Handler>`** is `(payload: string) => string`. This is
  `bindHandler`'s return type, and exactly what `Function.prototype.bind` produces.
- **`ThisType<T>`** is the odd one out — it is a marker that changes `this` inside an
  object literal rather than a transformation you apply. The lesson covers it; no
  exercise, because a realistic use needs generics you have not met yet.

## What the tests pin down

- `two emitters do not share handlers` registers **the same function object** on two
  emitters and gets different answers. That is the payoff: one handler, written once,
  answering to whoever calls it.
- `an arrow handler is accepted, and quietly ignores this` — a function *without* a
  `this` parameter is assignable to one that has it, because ignoring `this` is
  always safe. It also holds a `@ts-expect-error` showing what `noImplicitThis` does
  to a bare function expression that tries to use `this` anyway.
- `a bound handler cannot be talked out of its emitter` calls `.call(other, …)` on
  the bound function and still gets the original emitter.

## Run it

```bash
pnpm --filter exercises attempt   # grade your starter.ts — start here
pnpm --filter exercises verify    # the full gate CI runs
```

Work in `starter.ts`. `solution.ts` is the reference answer, and the same tests
grade both — which is what keeps the answer and the tests honest.

## Hints

<details>
<summary>Hint 1 — storing the handlers</summary>

`Map<string, Handler[]>` keyed by event name. `Map.get` returns
`Handler[] | undefined`, so decide up front whether "no handlers" and "never
registered" need to be different — for this exercise they do not.

</details>

<details>
<summary>Hint 2 — calling with a specific this</summary>

`handler.call(thisValue, payload)`. And because `strict` includes
`strictBindCallApply`, that first argument is type-checked against the handler's
declared `this` — pass the wrong object and the compiler stops you, which is the
whole return on declaring it.

</details>

<details>
<summary>Hint 3 — referring to the emitter from inside its own methods</summary>

Annotate the object as `const emitter: Emitter = { … }` and refer to `emitter`
inside `emit`. The reference is only evaluated when `emit` runs, so there is no
chicken-and-egg problem.

`this` also works — TypeScript types `this` inside an object-literal method as the
object's own type once `noImplicitThis` is on. Either is fine.

</details>

<details>
<summary>Hint 4 — bindHandler</summary>

Return an arrow function. Arrows have no `this` of their own, which means there is
nothing for a later `.call` to override — the emitter comes from the closure and
cannot be tampered with. `handler.bind(emitter)` gives you the same type and almost
the same guarantee.

</details>
