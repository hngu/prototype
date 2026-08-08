---
title: Three ways to say I don't know
course: typescript-fundamentals
order: 7
# Quoted: YAML treats a leading backtick as a reserved indicator character.
summary: "`any`, `unknown` and `never` all describe uncertainty, and they behave nothing alike. Knowing which one to reach for is most of the difference between TypeScript helping you and TypeScript humouring you."
duration: 10
exercise: true
draft: false
---

A parcel arrives and nobody knows what is in it. There are three honest things to do. Shake it,
decide it is a kettle, and plug it in. Bring it inside unopened and refuse to treat it as a kettle
until somebody looks. Or insist that no parcel exists — which is fine if you are certain, and
embarrassing otherwise.

Those three attitudes are `any`, `unknown` and `never`.

## Stop asking

`any` switches the type checker off for one value. Not loosens — off.

```ts
const data: any = JSON.parse(text)
data.user.name.toUpperCase() // no complaint
data.usre.nmae.toUpperCase() // also no complaint
data() // still no complaint
```

Every one of those lines compiles. `any` says "assume I know what I am doing", and TypeScript takes
that literally, including for the typos.

Worse, it is **contagious**. Anything you pull out of an `any` is also `any`, so a single one in the
wrong place turns off checking for everything downstream of it:

```ts
const user = data.user // any
const name = user.name // any
const upper = name.toUpperCase() // any — and nobody has checked a thing
```

This is why an `any` in a widely-used helper does so much quiet damage. It does not fail; it stops
asking, and the whole chain of code that trusted it stops being checked without anybody noticing.

There is one place `any` is genuinely correct: describing an API that really does accept anything,
like a logging function. Everywhere else, it is a decision to find out later.

```quiz
id: typescript-fundamentals-any-unknown-never-q1
q: What is the type of `name` in `const name = data.user.name`, where `data: any`?
- [x] `any` — it spreads to everything derived from it
- [ ] `unknown`, because the property might not exist
- [ ] `string`, inferred from the property name
- [ ] An error, because `user` is not declared on `data`
explain: Reading a property off an `any` gives you another `any`, which is what makes a single one so expensive: the checking is switched off for the whole chain downstream, and the failure surfaces somewhere else entirely.
```

## Ask me later

`unknown` is the parcel brought inside unopened. It means the same thing as `any` — "nobody knows
what this is" — and it behaves like the opposite, because it refuses to let you use the value until
you have checked:

```ts
const data: unknown = JSON.parse(text)
data.user // Error: 'data' is of type 'unknown'.
```

Everything is assignable **to** `unknown`, and `unknown` is assignable to nothing but itself. So it
is a perfect inbox: you can put anything in it, and take nothing out without looking. Once you have
looked, all the narrowing you already know applies:

```ts
if (typeof data === 'object' && data !== null && 'user' in data) {
  // data: object & Record<'user', unknown>
}
```

Reach for it at every boundary where data enters your program — `JSON.parse`, `fetch` bodies, a
`catch` clause, `process.env`, a message from a worker. The cost is a few lines of checking at one
well-chosen place. The alternative is `any`, which costs nothing there and charges interest
everywhere else.

```quiz
id: typescript-fundamentals-any-unknown-never-q2
q: Which statements about `unknown` are true?
- [x] Any value can be assigned to a variable of type `unknown`
- [x] You must narrow an `unknown` before using its properties
- [ ] `unknown` can be assigned to a `string` variable without a check
- [ ] Reading a property off an `unknown` gives you another `unknown`
explain: `unknown` accepts everything and gives out nothing — that asymmetry is the whole design. Reading a property off it is not "another `unknown`", it is a compile error, which is precisely how it differs from `any`.
```

## That can't happen

`never` is the empty set: a type with no values at all. Nothing can be assigned to it, and that
uselessness is exactly what makes it useful.

A function whose return type is `never` does not return. It throws, or it loops forever:

```ts
function fail(message: string): never {
  throw new Error(message)
}
```

The real payoff is exhaustiveness. Remember the `switch` from the narrowing lesson that deliberately
had no `default`? Sometimes you do want a default — for values that arrive from outside your program
and might not be in the union at all. `never` lets you have both:

```ts
function assertNever(value: never, context: string): never {
  throw new Error(`unexpected ${context}: ${JSON.stringify(value)}`)
}

function statusLabel(status: 'queued' | 'running' | 'done'): string {
  switch (status) {
    case 'queued':
      return 'waiting to start'
    case 'running':
      return 'in progress'
    case 'done':
      return 'finished'
    default:
      return assertNever(status, 'status')
  }
}
```

Inside `default`, the three cases have removed every member of the union, so `status` is `never` —
and `assertNever` accepts it. Now add `'failed'` to the union. That line stops compiling, because
`status` is `'failed'` there and `'failed'` is not assignable to `never`. You get a build error
pointing at the function that forgot, **and** a sensible runtime message if a bad value shows up
anyway. `default: return '?'` gives you neither.

You will also meet `never` where you did not put it. `string & number` is `never`, because no value
is both. Filtering every member out of a union leaves `never`. It is not an error; it is the compiler
telling you the set is empty.

```quiz
id: typescript-fundamentals-any-unknown-never-q3
q: A `switch` ends with `default: return assertNever(status, 'status')`. What happens when a new member is added to the `status` union?
- [x] That line stops compiling, because the value is no longer `never`
- [ ] Nothing at compile time; it throws at runtime if the new value appears
- [ ] `assertNever` widens its parameter to accept the new member
- [ ] The `switch` becomes non-exhaustive and the function returns `undefined`
explain: The default arm only type-checked because the cases above it had eliminated the entire union. Add a member and one survives, so the argument is no longer assignable to `never` — a compile error at the exact line that needs a new case.
```

## What to take away

- `any` switches checking off for a value and everything derived from it. Treat each one as a
  decision to find out later.
- `unknown` accepts anything and releases nothing until you check — the right type for every
  boundary of your program.
- `never` has no values, so a `never` parameter can only be called with something the compiler
  believes is impossible.
- `assertNever` in a `default` arm gives you a compile error for the case you forgot *and* a clear
  runtime message for the value that should not exist.
