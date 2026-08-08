---
title: An empty box and no box
course: typescript-fundamentals
order: 8
summary: Missing values are the most common source of runtime crashes, and the flags that catch them are the most valuable thing in tsconfig.json. Here is what each one costs you and what it buys.
duration: 11
exercise: true
draft: false
---

Somebody asks you to fetch the biscuit tin. You come back and say "it's empty". That is a different
sentence from "there is no tin", and everyone agrees the two call for different next steps.

JavaScript has two words for the second sentence and used to let you confuse it with the first. This
lesson is about the settings that stop it.

## Two words for nothing

`undefined` means nobody put anything there. `null` means somebody deliberately put nothing there. The
distinction is real, and the useful version of it is not philosophical — it is about who wrote the
value:

```ts
interface Profile {
  name: string
  nickname?: string // the property may be absent
  bio: string | null // the property is always present, and may hold nothing
}
```

`nickname?: string` is a property that might not be in the object at all. `bio: string | null` is a
property that is always in the object, where `null` is a value with meaning: this user has no bio.
Those are different designs, and choosing between them deliberately makes downstream code clearer.

By default, TypeScript used to allow `null` and `undefined` everywhere — you could assign either to a
`string` and it would shrug. **`strictNullChecks`** is the flag that stops it, and it is switched on
by `strict: true`. With it on, `string` means a string, and "a string or nothing" has to be spelled
out as `string | undefined`. The compiler then refuses to let you use one until you have dealt with
the nothing:

```ts
function firstWord(text?: string) {
  return text.trim().split(' ')[0]
  //     ^^^^ 'text' is possibly 'undefined'.
}
```

That nag is the single highest-value thing in the entire compiler. `Cannot read properties of
undefined` is the most common runtime error in JavaScript, and this is the flag that turns it into a
red squiggle.

```quiz
id: typescript-fundamentals-null-and-strictness-q1
q: With `strictNullChecks` on, what is the type of `text` inside `function f(text?: string) { … }`?
- [x] `string | undefined`
- [ ] `string`
- [ ] `string | null`
- [ ] `unknown`
explain: The `?` on a parameter adds `undefined` to its type — it does not mean "usually a string". Which is why the body has to handle both cases before touching it.
```

## Three operators, three different questions

Dealing with absence has a small vocabulary, and the whole game is picking the one that asks your
actual question.

```ts
a || b // fall back when a is FALSY: '', 0, NaN, false, null, undefined
a ?? b // fall back when a is null or undefined. Nothing else.
a?.b // read b only when a is neither null nor undefined
```

`||` is the one to be suspicious of, because it works right up until a legitimate `0` or `''` comes
along:

```ts
function pageSize(configured?: number) {
  return configured || 20 // pageSize(0) is 20. Nobody asked for that.
}
```

Use `??` by default. Keep `||` for the cases where you genuinely mean "falsy".

And then there is `!`, the **non-null assertion**:

```ts
const user = users.find((u) => u.id === id)!
```

It does nothing at runtime. It tells the compiler "trust me, not null", with no check of any kind —
so it is `any`'s smaller cousin, and it carries the same risk in a smaller package. It is
occasionally the right call in a test fixture. In application code, a real check reads about as
short and tells you *which* id was missing when it fails.

```quiz
id: typescript-fundamentals-null-and-strictness-q2
q: `size` is typed `number | undefined` and holds `0`. What does `size || 10` evaluate to?
- [x] `10`, because `0` is falsy
- [ ] `0`, because `0` is not `undefined`
- [ ] `10`, because `??` and `||` behave identically
- [ ] A compile error, because the types do not match
explain: `||` asks about truthiness, not absence, and `0` is falsy — so a deliberate zero silently becomes the default. `size ?? 10` asks the question you meant and gives `0`.
```

## The lie the array was telling

One more flag, and it fixes something the language had been quietly fibbing about for years:

```ts
const items = ['a', 'b']
const third = items[2] // typed string. It is undefined.
third.toUpperCase() // compiles. Crashes.
```

Every array index is declared to return the element type, and every JavaScript engine ever shipped
returns `undefined` when the index is not there. **`noUncheckedIndexedAccess`** closes the gap: with
it on, `items[2]` is typed `string | undefined`, which is the truth.

It is not part of `strict`, and it is the flag people turn on and then off again — because it
suddenly complains about a hundred lines that were fine. Two things make it pleasant rather than
irritating. First, the honest signature and the obvious implementation now agree, so functions
like this need no annotation gymnastics:

```ts
function pick(items: readonly string[], index: number): string | undefined {
  return items[index] // already the right type
}
```

Second, iteration is unaffected. `for (const item of items)` and `items.map(…)` hand you an element,
not a maybe-element, because those forms cannot run out of bounds. The flag only complains where you
genuinely wrote an index — which is exactly where the bug was.

```quiz
id: typescript-fundamentals-null-and-strictness-q3
type: true-false
q: With `noUncheckedIndexedAccess` on, `for (const item of items)` gives you `string | undefined`.
answer: false
explain: `item` is `string`. The flag only widens *indexed* access, because that is the only form that can address a position with nothing in it — iteration visits the elements that exist. This is why the flag is far less disruptive in practice than its reputation suggests.
```

## What to take away

- `undefined` is "nobody set it", `null` is "somebody set it to nothing", and `?:` versus
  `| null` is a design choice worth making on purpose.
- `strictNullChecks` is the highest-value flag in the compiler: it turns the most common runtime
  crash in JavaScript into a compile error.
- Prefer `??` to `||` unless you really mean falsy, and treat every `!` as a check you decided not
  to write.
- `noUncheckedIndexedAccess` makes indexing tell the truth, and leaves `for…of` and `map` alone.
