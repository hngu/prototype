---
title: The types you use every day
course: typescript-fundamentals
order: 3
summary: A handful of building blocks covers almost every type you will ever write — primitives, arrays, object shapes, unions and the optional marker. This is the whole everyday vocabulary in one lesson.
duration: 10
exercise: true
draft: false
---

A three-year-old gets a remarkable amount done with about fifty words. Not because fifty is many,
but because they are the right fifty — *more*, *mine*, *gone*, *up* — and everything else can be
pointed at.

TypeScript's everyday vocabulary is roughly that size, and this lesson is all of it. Almost every
type you write for the rest of your career is these pieces stacked together.

## The words you will actually use

Start with the primitives. They are lowercase, always:

```ts
let title: string
let count: number
let ready: boolean
```

`number` is the only number — no `int`, no `float`, no `double`. JavaScript has one numeric type
and TypeScript does not invent more. (`bigint` exists for the enormous ones, and you will know when
you need it.)

Lists come in two spellings of the same idea, and one extra kind:

```ts
let tags: string[] // most common
let tags: Array<string> // identical, just noisier
let tags: readonly string[] // I promise not to push to this
```

Reach for `readonly string[]` on function parameters by default. It says "I will read this and not
touch it", which is true of nearly every function you write, and it lets a caller hand you a frozen
list without an argument.

The most important thing on this page, though, is that you usually write none of it. TypeScript
infers all of the above from the value; annotations are for the places a value has not arrived yet
— parameters, and the occasional variable you want to pin deliberately.

```quiz
id: typescript-fundamentals-everyday-types-q1
q: Which of these annotations is TypeScript most likely to need you to write?
- [x] The parameters of a function
- [ ] A `const` initialised with a string literal
- [ ] The result of `items.map(x => x.name)`
- [ ] A `let` initialised with `0`
explain: Parameters have no value to inspect at the point they are declared, so inference has nothing to work from — that is where annotations genuinely earn their keep. In the other three cases TypeScript can see the value, and an annotation just restates what it already knows.
```

## One of these, or that one

Two ideas combine into the most useful pattern in the language.

The first is that a specific string can be a type all by itself. `'usd'` is a **literal type**: not
"some text", but exactly that text. The second is that `|` means "or":

```ts
type Currency = 'usd' | 'eur' | 'gbp'
```

`Currency` is now a type with exactly three allowed values. Assigning `'jpy'` is an error, and your
editor will offer you the three real ones as you type — a spelling mistake has become impossible
rather than merely unlikely.

The payoff shows up when you handle one:

```ts
function symbolFor(currency: Currency): string {
  switch (currency) {
    case 'usd':
      return '$'
    case 'eur':
      return '€'
    case 'gbp':
      return '£'
  }
}
```

There is no `default`, and no `return` after the switch, and TypeScript is satisfied — it can see
those three cases *are* the type, so every path returns. Now the good part: add `'jpy'` to
`Currency` and this function stops compiling, because suddenly a path falls out of the bottom
returning `undefined`. The union turned "we forgot to handle the new currency" from a bug someone
reports into a build error with a line number on it.

Unions are not only for strings. `string | number` is the honest type for a form field, and
`Order | undefined` is the honest type for a lookup that might miss.

```quiz
id: typescript-fundamentals-everyday-types-q2
q: A `switch` covers all three members of a string-literal union and returns in each case. Why does TypeScript accept it with no `default` branch?
- [x] It can see the three cases exhaust the type, so every path returns
- [ ] `switch` statements are exempt from return checking
- [ ] The return type is inferred as `string | undefined`
- [ ] `default` is only required when switching on a `number`
explain: Exhaustiveness is the point of the union. Because the type is exactly those three values, the compiler knows no other case can occur — and if you widen the union later, this same reasoning makes the now-incomplete switch an error.
```

## The field that might not be there

Object types are the workhorse. Write the shape down and the compiler checks every use of it:

```ts
interface Order {
  readonly id: string
  quantity: number
  currency: Currency
  express: boolean
  note?: string
}
```

Two markers are doing real work there. `readonly` means the property cannot be reassigned after the
object is built — the compiler enforces it, though nothing stops it at runtime, because by then the
`readonly` is gone.

And `note?: string` is the one worth slowing down for. The `?` does not mean "may be empty". It
means the property's type is `string | undefined`, and TypeScript will not let you use it as a
string until you have dealt with the missing case:

```ts
order.note.trim() // Error: 'order.note' is possibly 'undefined'.
if (order.note !== undefined) order.note.trim() // fine
```

That nag is the feature. An optional field you forgot to check is one of the most common bugs in
untyped JavaScript, and here it cannot get past you.

Finally, `interface` and `type` are near-interchangeable for object shapes. `type` also names
unions, tuples and everything else, so if you want one rule: use `interface` for object shapes,
`type` for everything else, and do not spend an afternoon on it.

```quiz
id: typescript-fundamentals-everyday-types-q3
type: true-false
q: Declaring `note?: string` means `note` may hold an empty string but never `undefined`.
answer: false
explain: It is the other way round. The `?` adds `undefined` to the type, so `note` is `string | undefined` and must be checked before use. An empty string is a perfectly ordinary `string` and TypeScript has no opinion about it at all.
```

## What to take away

- The primitives are lowercase and there is only one `number`; prefer `readonly T[]` for
  parameters.
- Most annotations you *think* you need are already inferred — parameters are the real exception.
- A union of string literals makes typos impossible and makes a forgotten case a build error.
- `?` adds `undefined` to a property's type, and the compiler will make you handle it.
