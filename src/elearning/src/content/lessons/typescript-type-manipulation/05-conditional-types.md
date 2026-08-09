---
title: An if-statement for types
course: typescript-type-manipulation
order: 5
summary: A conditional type branches at compile time, and `infer` pulls a piece out of whatever it matched. The rule that makes them powerful and occasionally baffling is what they do to a union.
duration: 12
exercise: true
draft: false
---

You cannot ask "was it raining?" about a whole week and get one answer. Ask it about Monday, Tuesday,
Wednesday, and you get seven answers — and only then can you say something about the week.

TypeScript makes exactly that choice for you, silently, and which one it made decides your answer.
That is the real content of this lesson.

## Branching at compile time

The syntax is the ternary you already know, with `extends` where the condition goes:

```ts
type IsString<T> = T extends string ? true : false

type A = IsString<'ada'> // true
type B = IsString<42> // false
```

Read `A extends B` as "is `A` assignable to `B`?" — the same question the compiler asks everywhere
else, now available as an expression.

On its own that is a curiosity. It becomes useful with **`infer`**, which names a piece of whatever
you matched:

```ts
type Unwrap<T> = T extends Promise<infer U> ? U : T

type C = Unwrap<Promise<string>> // string
type D = Unwrap<number> // number
```

"If `T` is a promise of something, call that something `U` and give me `U`." `infer` only makes sense
in the checked position of a conditional, and it can appear inside a pattern as deep as you like:
`T extends readonly (infer U)[]` gets an element type, `T extends (...args: infer A) => unknown` gets
an argument list.

Conditionals can also recurse, and sometimes must:

```ts
type Unwrap<T> = T extends Promise<infer U> ? Unwrap<U> : T
```

Without the recursive call, `Unwrap<Promise<Promise<number>>>` is `Promise<number>` — while `await`
at runtime keeps going until it reaches a plain value. The type would be lying about the
implementation it describes, and both halves would look right on their own. This one ships as
`Awaited<T>`; write it once to understand it, then use the built-in.

```quiz
id: typescript-type-manipulation-conditional-types-q1
q: `type Element<T> = T extends readonly (infer U)[] ? U : never`. What is `Element<string[]>`?
- [x] `string`
- [ ] `string[]`
- [ ] `never`
- [ ] `unknown`
explain: The pattern matches an array and `infer U` names its element type, so `U` is `string`. Writing the pattern as `readonly (infer U)[]` rather than `(infer U)[]` matters — it matches both mutable and readonly arrays, where the mutable-only version would silently fall to `never` for a `readonly string[]`.
```

## The rule that surprises everybody

Here is the week-versus-days question. When the checked type is a **naked type parameter** — just `T`,
not `[T]` or `T & {}` — and the argument is a union, the conditional runs **once per member** and the
results are unioned back together:

```ts
type StringsOnly<T> = T extends string ? T : never

StringsOnly<'a' | 1 | 'b'>
// runs three times:  ('a'|never|'b')
// →  'a' | 'b'
```

That is **distributivity**, and two things follow from it. `never` disappears, because `never` in a
union contributes nothing — which is what turns "keep or drop" into a filter. And this is how the
standard library's union utilities are built: `Exclude`, `Extract` and `NonNullable` are all one
distributive conditional each.

Switch it off by making `T` non-naked, conventionally by wrapping both sides in a tuple:

```ts
type IsAllStrings<T> = [T] extends [string] ? true : false

IsAllStrings<'a' | 'b'> // true
IsAllStrings<'a' | 1> // false
```

Same comparison, same argument, completely different shape of answer: `StringsOnly<'a' | 1>` is `'a'`
and `IsAllStrings<'a' | 1>` is `false`. Neither is wrong. You have to know which question you asked.

```quiz
id: typescript-type-manipulation-conditional-types-q2
q: `type F<T> = T extends string ? T : never`. What is `F<'a' | 1 | 'b'>`?
- [x] `'a' | 'b'`
- [ ] `never`
- [ ] `'a' | 1 | 'b'`
- [ ] `false`
explain: `T` is naked, so the conditional distributes: it runs on `'a'`, on `1` and on `'b'` separately, giving `'a' | never | 'b'`. `never` contributes nothing to a union, so the result is `'a' | 'b'`. Writing `[T] extends [string]` instead asks about the union as a whole and answers `false`.
```

## Two things to know before they bite

**Testing for `never` needs the tuple trick.** `T extends never ? true : false` given `never` returns
`never`, not `true` — because `never` is the empty union, distributing over it produces no members at
all. `[T] extends [never]` is the check that works, and this is the most common half-hour anybody
loses to distributivity.

**Generic code often needs a cast the concrete version would not.** Inside a function whose return
type is a conditional over an unresolved `T`, the compiler cannot evaluate that conditional, so it
cannot verify your `return`:

```ts
async function unwrap<T>(value: T): Promise<Unwrap<T>> {
  return (await value) as Unwrap<T> // the cast is not laziness
}
```

`await value` is `Awaited<T>`, which *is* `Unwrap<T>` for every concrete `T` — and unprovably so in
general. That is a real limitation rather than a mistake, and the honest response is a cast with a
comment. It is also a reason to keep conditional types near the edges of an API rather than threaded
through its middle: each one you add is a place someone will have to assert something.

Which is the note to end on. Conditional types are the most powerful tool in this course and the
easiest to overuse. A four-line conditional that saves a reader nothing has cost them a great deal,
and `Unwrap` earns its place precisely because everyone already knows what awaiting means.

```quiz
id: typescript-type-manipulation-conditional-types-q3
type: true-false
q: `type IsNever<T> = T extends never ? true : false` correctly returns `true` for `IsNever<never>`.
answer: false
explain: It returns `never`. `never` is the union with no members, so a distributive conditional has nothing to run on and produces nothing. `[T] extends [never] ? true : false` switches distribution off and gives the answer you wanted — the standard reason to reach for the tuple wrapper.
```

## What to take away

- `T extends U ? X : Y` branches at compile time, and `infer` names a piece of what was matched.
- A naked type parameter distributes over a union, running once per member — which is how `Exclude`
  and `NonNullable` work, and why `never` acts as "drop this".
- `[T] extends [U]` switches distribution off, and is the only reliable way to test for `never`.
- A conditional return type usually forces a cast inside the function; that is a real limitation, so
  spend conditionals where they buy a reader something.
