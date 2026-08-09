---
title: What fits in, what drops out
course: typescript-functions-objects
order: 1
summary: A signature says what a function accepts and what it hands back. Optional parameters, defaults, rest parameters and `void` each answer a different question, and picking the wrong one is how types start lying.
duration: 10
exercise: true
draft: false
---

A vending machine has a slot and a tray. The slot says exactly what fits: a coin of this size, and
nothing else. The tray says what drops out. You can use the machine correctly knowing nothing about
the mechanism, because those two openings tell you everything.

A function signature is that slot and that tray, and this lesson is about writing them precisely.

## Describing the slot

There are two ways to write down a function's type, and they mean the same thing:

```ts
type Visit = (line: string, index: number) => void // function type expression
interface Visitor {
  (line: string, index: number): void // call signature
}
```

Use the first one. The second exists because an interface can carry other members alongside the
call signature — which is how you describe a function that also has properties on it, and is rare
enough that you will recognise it when you need it.

Parameters come in four flavours, and three of them are easy to mix up:

```ts
function f(a: string, b?: number, c = 8, ...rest: readonly string[]) {}
```

- `a` is **required**.
- `b` is **optional**. Its type inside the body is `number | undefined`, and you have to deal with
  that.
- `c` has a **default**. It is optional at the call site and plain `number` in the body, because the
  `undefined` was resolved before your code started.
- `rest` collects everything else, and is always an array type.

That distinction between `b` and `c` is the one worth holding on to. An optional parameter hands you
the missing case; a default absorbs it. If you find yourself writing `b ?? 8` on the first line of
every function, you wanted a default.

One trap: passing `undefined` explicitly also triggers a default. `pad('7', undefined)` gets `8`,
which surprises people who expected the argument to win.

```quiz
id: typescript-functions-objects-function-signatures-q1
q: What is the type of `limit` inside `function truncate(text: string, limit?: number) { … }`?
- [x] `number | undefined`
- [ ] `number`
- [ ] `number | null`
- [ ] `unknown`
explain: The `?` adds `undefined`, exactly as it does on an object property — so the body must resolve it. Writing `limit = 20` instead gives you a plain `number` in the body and the same convenience at the call site, which is usually what people actually wanted.
```

## `void` is a promise about the caller

`void` is the return type people think they understand. It does not mean "returns nothing". It means
**"whatever comes back, ignore it"** — and read from the right direction, that turns out to matter a
great deal.

When `void` is the return type of a *callback parameter*, it is a promise you are making to whoever
passes the callback: I will not look at your result. So a function that returns something is a
perfectly legal argument:

```ts
function forEachLine(text: string, visit: (line: string) => void): number {
  /* … */
}

const seen: string[] = []
forEachLine('a\nb', (line) => seen.push(line)) // push returns a number. Fine.
```

That rule is not a curiosity — it is the reason `items.forEach(x => list.push(x))` compiles, and
without it half the callbacks ever written would need a pointless `{ }` wrapper.

The other half of the rule points the other way. If a function's *own* declared return type is
`void`, the caller cannot use the result, whatever the body did:

```ts
const noop: () => void = () => 42
const answer: number = noop() // Error: Type 'void' is not assignable to type 'number'.
```

Both are the same idea seen from opposite ends: `void` describes what the caller may rely on, not
what the body does. It is also different from `undefined` — a function typed `(): undefined` must
actually return `undefined`, and cannot simply run off the end.

```quiz
id: typescript-functions-objects-function-signatures-q2
q: A parameter is declared `visit: (line: string) => void`. Which arguments are legal?
- [x] `(line) => { console.log(line) }`
- [x] `(line) => seen.push(line)`
- [x] `() => {}`
- [ ] `(line, index) => {}`
explain: `void` promises the caller's result will be ignored, so returning a number is fine — and a callback may always ignore parameters it does not need. What it may not do is demand *more* parameters than the signature supplies, because nothing would be there to fill them.
```

## Returns worth writing down

TypeScript infers return types well, and most of the time you should let it. Two cases earn an
explicit annotation.

The first is a public API you intend to keep stable. An inferred return type changes silently when
you edit the body; a written one turns that into an error at the function you edited rather than a
surprise at every call site.

The second is when you want the compiler to check the body against your intent, which is exactly
what the exhaustive `switch` from the previous course relied on:

```ts
function symbolFor(currency: Currency): string {
  switch (currency) {
    /* … */
  }
}
```

Without the `: string`, adding a currency makes the inferred return type `string | undefined` and
the error appears wherever somebody uses the result. With it, the error is here.

Two return types are special. `never` means the function does not come back at all — it throws or
loops forever — and is what `assertNever` used. And an `async` function always returns a `Promise`,
so `Promise<string>` is the type to write, never `string`.

```quiz
id: typescript-functions-objects-function-signatures-q3
type: true-false
q: A function whose return type is `void` and one whose return type is `undefined` are interchangeable.
answer: false
explain: A `(): undefined` function must genuinely produce `undefined`, and returning nothing at all is an error. `void` is weaker and more useful: it says the result is not for you to use, which is why every callback parameter you write should prefer it.
```

## What to take away

- Prefer a function type expression to a call-signature interface unless the function also carries
  properties.
- An optional parameter hands you `undefined`; a default absorbs it. Reach for the default.
- `void` on a callback parameter promises the caller's result will be ignored, which is why
  `forEach(x => list.push(x))` compiles.
- Let return types be inferred, except on a stable public API or where you want the body checked
  against your intent.
