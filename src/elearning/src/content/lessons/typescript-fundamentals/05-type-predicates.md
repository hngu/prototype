---
title: Teaching TypeScript a new check
course: typescript-fundamentals
order: 5
summary: Pull a `typeof` check out into a helper and narrowing stops working. Type predicates and assertion functions are how you give the compiler back the knowledge you just moved.
duration: 10
exercise: true
draft: false
---

A bouncer checks IDs at the door. Once they have waved you through, nobody inside the club asks
again — the whole room is running on the bouncer having done the job properly.

TypeScript will let you be that bouncer, but only if you say out loud that you are one. This lesson
is the two ways of saying it.

## Why your check stopped counting

You already know that an inline `typeof` check narrows a value. The trouble starts the moment you
tidy it away into a function, which is the first thing any reasonable person does:

```ts
function isString(value: unknown) {
  return typeof value === 'string'
}

function shout(value: unknown) {
  if (isString(value)) {
    return value.toUpperCase() // Error: 'value' is of type 'unknown'.
  }
}
```

That looks like a bug in the compiler. It is not. `isString` returns `boolean` — and a `boolean` is
just a `boolean`. It says *true*; it does not say what was true. TypeScript sees an `if` on some
opaque yes-or-no and has no reason to conclude anything at all about `value`.

The inline version worked because the compiler recognises `typeof value === 'string'` as a *shape of
expression* it understands. Wrap it in a function and that shape is behind a wall.

```quiz
id: typescript-fundamentals-type-predicates-q1
q: Why does `if (isString(value))` fail to narrow, when the inline `typeof` check inside `isString` would have worked?
- [x] The function's return type is `boolean`, which carries no information about `value`
- [ ] Narrowing never works across a function call
- [ ] `unknown` cannot be narrowed, only `any` can
- [ ] The parameter needs to be `value: string | unknown`
explain: TypeScript reasons about narrowing from the *types* at the call site, and `boolean` is a dead end — it records that something was true, not what. Narrowing across a call is entirely possible; it just needs a return type that says more, which is the next section.
```

## Signing your name to it

The fix is a **type predicate**: a return type of the form `value is Something`.

```ts
function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}
```

Now `if (isNonEmptyString(x))` narrows `x` to `string`, exactly as an inline check would. The
function still returns a boolean at runtime — `value is string` is erased with everything else. It
is a note to the compiler about what that boolean *means*.

And here is the part to take seriously: **TypeScript does not check your claim.** It cannot. The body
could `return true` unconditionally and the compiler would nod along, then confidently let you call
`.toUpperCase()` on a number somewhere downstream. That is the trade you are making. You get to
teach the compiler a check it could never have derived — "is this a valid email", "is this one of my
three currencies", "did this JSON come back in the shape I expect" — and in exchange the body has to
actually be right.

Which is a good argument for keeping predicates small, obvious, and covered by tests. A wrong
predicate is worse than no predicate: it does not merely fail to help, it launders a false belief
into the type system and the error surfaces three files away.

```quiz
id: typescript-fundamentals-type-predicates-q2
q: What does TypeScript do with the body of a function declared `(value: unknown): value is string`?
- [x] Nothing — it trusts the signature and does not verify the logic
- [ ] It checks that the body actually proves the value is a string
- [ ] It requires the body to contain a `typeof` check
- [ ] It converts the return value to a string at runtime
explain: The predicate is an unverified assertion; that is precisely why it is powerful enough to express checks the compiler could never infer. It is also why a predicate deserves a unit test more than most functions do.
```

## The one that throws instead

Sometimes a failed check is not a branch, it is the end of the road. For that there is an
**assertion function**, which throws rather than returning:

```ts
function assertDefined<T>(value: T | null | undefined, label: string): asserts value is T {
  if (value === null || value === undefined) {
    throw new Error(`${label} is missing`)
  }
}
```

The `asserts value is T` return type means: if this call returned at all, the check passed. So
everything below it is narrowed, with no `if` and no reassignment:

```ts
const found = users.find((user) => user.id === id) // User | undefined
assertDefined(found, `user ${id}`)
return found.name // found: User
```

Compare that with the alternative people reach for. `found!.name` — the non-null assertion — gets you
the same silence from the compiler by simply asserting the problem away, and gives you
`Cannot read properties of undefined` at runtime with no clue whose id was wrong. The assertion
function does a real check and names the thing that was missing.

One sharp edge, because it will catch you exactly once. TypeScript only honours `asserts` when it can
see at the call site that the callee is an assertion function, which means every name in the call
target must have an explicit type annotation:

```ts
const check = assertDefined // type inferred
check(found, 'user') // Error TS2775, and no narrowing
```

Annotate the intermediate (`const check: typeof assertDefined = …`) or just call the function
directly. Ordinary imported functions and locally declared ones are fine — it is only inferred
aliases that trip it.

```quiz
id: typescript-fundamentals-type-predicates-q3
type: true-false
q: After calling `assertDefined(found, 'user')`, `found` is narrowed for the rest of the enclosing scope without any `if`.
answer: true
explain: That is the whole point of `asserts` — the call itself is the proof, because the only way execution continued is that the function did not throw. Nothing is reassigned; the compiler simply believes the signature.
```

## What to take away

- A helper returning `boolean` destroys narrowing, because `boolean` records that something was
  true and not what.
- `value is T` restores it, and TypeScript takes the claim entirely on trust — so test your
  predicates.
- `asserts value is T` narrows by throwing, which beats `!` because it actually looks and it
  actually says what was missing.
- Assertion calls need an explicitly annotated call target; an inferred alias fails with TS2775.
