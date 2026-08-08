---
title: Looking before you reach in
course: typescript-fundamentals
order: 4
summary: A union type says a value is one of several things. Narrowing is how TypeScript follows the checks you already write to work out which one it is on any given line.
duration: 10
exercise: true
draft: false
---

There is a closed box on the table. Inside is either a kitten or a hammer, and nobody told you
which. You would look before putting your hand in — not because you are timid, but because the two
cases want completely different handling.

TypeScript reasons about unions the same way, and it refuses to let you reach in blind.

## Looking in the box

A union type is a box that might hold one of several things:

```ts
function format(input: string | number) {
  input.toUpperCase() // Error: Property 'toUpperCase' does not exist on type 'number'.
}
```

The complaint is fair. `toUpperCase` exists on strings and not on numbers, and TypeScript only lets
you use what is available on **every** member of the union. Right now, `input` might be either.

The fix is not a cast. It is the check you would have written anyway:

```ts
function format(input: string | number) {
  if (typeof input === 'string') {
    return input.toUpperCase() // input: string
  }
  return input.toFixed(2) // input: number
}
```

TypeScript read your `if` and drew the obvious conclusion. Inside the branch, the only surviving
member is `string`. And look at the line after it: because the branch `return`s, anything below is
only reachable when the check was **false** — so `string` has been eliminated and what is left is
`number`. No `else` needed. The compiler did the subtraction for you.

This is **narrowing**, and it is the reason good TypeScript looks so much like ordinary defensive
JavaScript. You are not writing extra ceremony to please a type checker; you are writing the checks
a careful programmer writes, and the type checker is reading along.

```quiz
id: typescript-fundamentals-narrowing-q1
q: After `if (typeof input === 'string') { return … }` returns, what is the type of `input`?
- [ ] `string | number`
- [x] `number`
- [ ] `string`
- [ ] `unknown`
explain: The branch returns, so the code below it only runs when the check failed. TypeScript removes `string` from the union, leaving `number` — which is why an `else` is usually unnecessary noise.
```

## The other ways to look

`typeof` is only one lens, and it is the wrong one surprisingly often. Each of these narrows a
different shape of type:

| Check | Narrows | Reach for it when |
| --- | --- | --- |
| `typeof x === 'string'` | primitives | `string`, `number`, `boolean`, `symbol` |
| `x instanceof Date` | class instances | anything made with `new` |
| `'radius' in shape` | object shapes | unions of plain objects with no tag |
| `x === null`, `x !== undefined` | exact values | absence checks |
| `Array.isArray(x)` | arrays | `T[] \| T` |

`typeof` on an object is the classic trap: `typeof new Date()` is `'object'`, and so is `typeof {}`,
and so — infamously — is `typeof null`. For anything built with `new`, use `instanceof`.

The one people underuse is `in`. When two object types have nothing to tell them apart, the mere
*presence* of a property is a check the compiler understands:

```ts
type Shape = { radius: number } | { side: number }

function areaOf(shape: Shape) {
  if ('radius' in shape) {
    return Math.PI * shape.radius ** 2 // shape: { radius: number }
  }
  return shape.side ** 2 // shape: { side: number }
}
```

A caution about the laziest check of all. `if (x)` does narrow — but it removes every *falsy* value,
and `''`, `0`, `NaN` and `false` are all falsy. For a `string | undefined` that is usually harmless;
for a `number | undefined` it silently treats a legitimate `0` as missing. When you mean "is it
there", write `!== undefined` and say so.

```quiz
id: typescript-fundamentals-narrowing-q2
q: `count` is typed `number | undefined`. Why is `if (count) { … }` a risky way to check it?
- [x] `0` is falsy, so a real count of zero takes the "missing" path
- [ ] `if` cannot narrow a union containing `undefined`
- [ ] It narrows to `number | null` rather than `number`
- [ ] Truthiness checks are erased before the program runs
explain: The narrowing works exactly as advertised — it removes every falsy value, and `0` is one of them. The type is right and the logic is wrong, which is the hardest kind of bug to spot. `count !== undefined` asks the question you actually meant.
```

## Unions built to be narrowed

You can make narrowing almost effortless by designing the union for it. Give every member a field
whose type is a single literal string, and that field becomes a **discriminant**:

```ts
type Result =
  | { kind: 'ok'; data: string }
  | { kind: 'empty' }
  | { kind: 'error'; message: string; code: number }

function render(result: Result): string {
  switch (result.kind) {
    case 'ok':
      return `ok: ${result.data}`
    case 'empty':
      return 'nothing to show'
    case 'error':
      return `error ${result.code}: ${result.message}`
  }
}
```

One comparison collapses the union to exactly one member, so `result.data` is available in the `ok`
branch and nowhere else. The field must be literal-typed for this to work — `kind: string` would
tell the compiler nothing, because comparing it could not rule anything out.

Now notice what is missing: there is no `default`, and no `return` after the `switch`, and
TypeScript is content. It can see the three cases *are* the type. That absence is worth guarding
jealously, because it means adding a fourth member to `Result` makes this function fall out of the
bottom returning `undefined` — a compile error, in the one file that needs changing. Write
`default: return '?'` and you have traded that for a silent question mark in production.

```quiz
id: typescript-fundamentals-narrowing-q3
q: A `switch` on a discriminated union has a case for every member and no `default`. What happens when a new member is added to the union?
- [x] The function stops compiling, because a path now falls through without returning
- [ ] Nothing — the new member falls through and returns `undefined` at runtime
- [ ] TypeScript inserts a `default` branch automatically
- [ ] The union becomes `any` until a case is added
explain: This is the payoff for leaving `default` out. The compiler was relying on the cases exhausting the type; once they do not, the declared return type is no longer satisfied on every path, and it says so — at the exact place you need to know.
```

## What to take away

- Narrowing follows the checks you would write anyway; reaching for a cast usually means you skipped
  one.
- A branch that `return`s narrows everything after it, so `else` is often unnecessary.
- `typeof` for primitives, `instanceof` for anything built with `new`, `in` for untagged object
  shapes — and `!== undefined` when you mean absence rather than falsiness.
- Give every union member a literal-typed tag, leave `default` off the `switch`, and the compiler
  will tell you the day someone adds a case.
