---
title: One door, several labelled ways through
course: typescript-functions-objects
order: 2
summary: Overloads let one function present several signatures, which is occasionally exactly right and usually a trap. Here is the rule for telling those apart, plus the two signature kinds an interface can express and an arrow cannot.
duration: 11
exercise: true
draft: false
---

A cinema box office has one window with three signs above it: *adults*, *children*, *members*. Same
window, same person behind it — but which sign you stand under decides what you get handed.

TypeScript can put those signs on a function. This lesson is about when that is worth doing, and
about the bill that arrives with it.

## Several signs, one window

An overloaded function declares its public signatures first, with no bodies, and then one
implementation that has to satisfy all of them:

```ts
function parseDate(input: number): Date
function parseDate(input: string): Date | undefined
function parseDate(input: string | number): Date | undefined {
  if (typeof input === 'number') return new Date(input)
  const parsed = new Date(input)
  return Number.isNaN(parsed.getTime()) ? undefined : parsed
}
```

Now `parseDate(0)` is typed `Date` and `parseDate(text)` is typed `Date | undefined`. That is
something a single signature genuinely cannot say, and it is the one thing that justifies the whole
mechanism: **the return type depends on the argument type.**

Which gives you the rule. If your overloads all return the same type, you do not want overloads —
you want a union parameter. Two signs saying the same thing are just two signs.

```quiz
id: typescript-functions-objects-overloads-and-call-signatures-q1
q: When is an overload the right tool rather than a union parameter?
- [x] When the return type differs depending on which argument type was passed
- [ ] Whenever a function accepts more than one type of argument
- [ ] Whenever a function has optional parameters
- [ ] When you want better error messages for wrong arguments
explain: A union parameter already handles "accepts several types" with one signature and less code. Overloads earn their keep only when the *result* changes with the input — otherwise you have added complexity and, as the next section shows, taken something away.
```

## The bill

Here is the part nobody mentions until it bites. That third signature — the implementation one — is
**not public**. Callers see the first two and nothing else. So:

```ts
const raw: string | number = readConfig()
parseDate(raw) // Error: No overload matches this call.
```

The implementation obviously handles both. The compiler will not assemble a union overload for you,
and `string | number` is the exact shape of every value that comes out of config, JSON, a form field
or a CLI argument. Meanwhile the single-signature version accepts it without comment.

There are two more sharp edges worth knowing.

**Order matters.** Overloads are resolved top to bottom, first match wins. A broad signature above a
narrow one makes the narrow one unreachable, and TypeScript will not warn you.

**The implementation signature is barely checked.** It has to be *compatible* with each overload, and
that bar is low — an overload promising `Date` alongside an implementation returning
`Date | undefined` is accepted, which quietly hands your callers a lie. Overloads are one of the few
places the compiler stops being paranoid on your behalf, so keep them few and keep them tested.

```quiz
id: typescript-functions-objects-overloads-and-call-signatures-q2
q: `f` is overloaded for `string` and for `number`. What happens at `const x: string | number = …; f(x)`?
- [x] A compile error — no overload accepts `string | number`
- [ ] It resolves to the implementation signature, which accepts the union
- [ ] It resolves to the first overload and narrows silently
- [ ] It compiles and the return type becomes a union of both returns
explain: The implementation signature is invisible to callers, and TypeScript does not synthesise a combined overload. This is the main practical cost of overloading, and it is why a value read from JSON or config is so awkward to pass to an overloaded function.
```

## Two things an arrow cannot say

You already know the function type expression, `(input: string) => Date`. Two shapes need an
interface or object type instead.

The first is a **call signature**, which lets a function also carry properties:

```ts
interface DateParser {
  (input: string): Date | undefined
  readonly label: string
}
```

A value of that type is callable *and* has a `label`. This is not an exotic corner — it is how
`express()` can also be `express.static`, and how a great many libraries export one thing that is both
a function and a namespace. `Object.assign(fn, { label })` is the tidy way to build one.

The second is a **construct signature**, which describes what goes after `new`:

```ts
function buildAll(ctor: new (value: number) => Date, values: readonly number[]) {
  return values.map((value) => new ctor(value))
}

buildAll(Date, [0, 86_400_000]) // the constructor itself, not an instance
```

Calling and constructing are separate capabilities, and a value can have either, both or neither. An
ordinary arrow function has a call signature and no construct signature, so it is *not* assignable to
the parameter above however right its arguments look — which is where the runtime
`X is not a constructor` comes from.

```quiz
id: typescript-functions-objects-overloads-and-call-signatures-q3
type: true-false
q: An arrow function `(value: number) => new Date(value)` satisfies the type `new (value: number) => Date`.
answer: false
explain: The parameters and return type line up, but arrow functions have no construct signature at all — you cannot `new` one, and the type system knows. Call and construct are independent capabilities, which is why they have separate syntax.
```

## What to take away

- Overload only when the return type depends on the argument type; otherwise use a union parameter.
- The implementation signature is not public, so an overloaded function rejects the very union its
  body handles.
- Overloads are resolved top to bottom, and the implementation is checked loosely — keep them few
  and test them.
- A call signature on an interface describes a function with properties; a construct signature
  describes something you can `new`.
