---
title: A form with optional rows
course: typescript-functions-objects
order: 4
summary: Required properties, optional ones, `readonly`, and index signatures for keys nobody can list in advance. Plus the single most useful shape in applied TypeScript — optional in, required out.
duration: 11
exercise: true
draft: false
---

Every paper form has three kinds of row. The ones you must fill in. The ones you may leave blank. And
at the bottom, a note saying *use the space below for anything else*, because whoever printed it could
not list everything in advance.

Object types have all three, and knowing which to reach for is most of what "modelling your data"
means.

## The rows you must fill in, and the ones you may not

You have met the basics already, so here they are together with the parts that are easy to get wrong:

```ts
interface RequestOptions {
  readonly url: string // required
  readonly method?: Method // optional: type is Method | undefined
  readonly body?: string | null // optional AND nullable: three states
  readonly timeoutMs?: number
}
```

`readonly` stops the property being reassigned. It is checked at compile time and erased afterwards,
so it is a promise between authors, not a lock — `Object.freeze` is the runtime version. It is also
shallow: `readonly items: string[]` prevents `obj.items = []` and permits `obj.items.push('x')` all
day.

`body?: string | null` is worth pausing on because it has **three** states — absent, `null`, and a
string — and if you cannot say what each means, you do not want all three. Pick one absence and stick
to it.

Two things do not do what people expect. `interface` and `type` are interchangeable for object
shapes; the real difference is that interfaces can be *reopened* later by declaring them again, which
matters for augmenting library types and is otherwise a way to confuse yourself. And an interface can
`extends` a type alias, and vice versa, so the choice is not a fork in the road.

```quiz
id: typescript-functions-objects-object-types-q1
q: `config` is typed `{ readonly items: string[] }`. Which of these are errors?
- [x] `config.items = []`
- [ ] `config.items.push('x')`
- [ ] `config.items[0] = 'y'`
- [ ] `config.items.sort()`
explain: `readonly` is shallow — it protects the *property*, not what the property points at. Reassigning `items` is refused; mutating the array it holds is not. `readonly string[]` on the inner type is what you want if the contents matter.
```

## The space below for anything else

Some objects genuinely have keys you cannot list. HTTP headers, a translation table, a cache. That is
an **index signature**:

```ts
interface HeaderBag {
  readonly [name: string]: string
}
```

Three things follow, and all three surprise people at least once.

**It is a promise about *every* property.** Adding `contentLength: number` to that interface is an
error, because `number` is not `string`. If you need a bag with one differently-typed member, the
index signature has to widen to include it — `string | number` — and now every read is a union.

**Reading gives you `string | undefined`.** With `noUncheckedIndexedAccess` on, `headers['accept']` is
possibly-missing even for a key you can see two lines above, and that is simply correct: the signature
says which keys are *allowed*, never which are *present*.

**You lose typo protection.** This is the real cost, and it is why an index signature should be a
deliberate choice rather than a default:

```ts
interface Options {
  timeoutMs?: number
}
resolveOptions({ timeoutMS: 250 }) // Error: unknown property. Good.

interface LooseOptions {
  [key: string]: unknown
}
resolve({ timeoutMS: 250 }) // Fine. Silently ignored. Bad afternoon.
```

If you know the keys, list them. `Record<string, string>` — which you will meet properly in the next
course — is the same thing in fewer characters.

```quiz
id: typescript-functions-objects-object-types-q2
q: `HeaderBag` is `{ readonly [name: string]: string }`. Which statements are true?
- [x] `const b: HeaderBag = { 'content-length': 12 }` is an error
- [x] Reading `b['accept']` gives `string | undefined` under `noUncheckedIndexedAccess`
- [ ] A named property `contentType: string` cannot be added alongside the signature
- [ ] The signature guarantees at least one property exists
explain: An index signature constrains every property, so a number value is rejected — but a named property is fine as long as its type is compatible with the signature. And it says nothing about what is present: an empty object satisfies it perfectly.
```

## Optional in, required out

Here is the pattern to take away from the whole lesson. Write **two** types: one for what a caller
supplies, one for what your code reads.

```ts
interface RequestOptions {
  readonly method?: Method
  readonly timeoutMs?: number
}

interface ResolvedOptions {
  readonly method: Method
  readonly timeoutMs: number
}

function resolveOptions(options?: RequestOptions): ResolvedOptions {
  return {
    method: options?.method ?? 'GET',
    timeoutMs: options?.timeoutMs ?? 5000,
  }
}
```

Resolve once, at the entrance. Everything downstream takes a `ResolvedOptions` and reads plain
non-optional fields — not one `?? 5000` anywhere else in the codebase.

The compiler is what makes this pay. Add a field to `ResolvedOptions` and forget it in
`resolveOptions`, and the build stops, in the one place the defaults live. Compare the usual
alternative, where `options?.timeoutMs ?? 5000` is threaded through fifteen functions: the default is
now stated fifteen times, nothing enforces agreement, and the fourteenth one has said `3000` since
2023.

Notice too that a property can legitimately change shape on the way through — `body?: string` becoming
`body: string | null`. On the way in, "I did not mention a body" is what a caller says. On the way out,
"there is no body" is a fact every reader can rely on without checking whether the key is there.

```quiz
id: typescript-functions-objects-object-types-q3
type: true-false
q: Resolving defaults once into a fully-required type means the compiler will tell you if you add a new option and forget to give it a default.
answer: true
explain: The resolver has to return a `ResolvedOptions`, and a new required field with no value assigned is a missing property — an error, in the single file where defaults belong. Scattering `??` through the call sites gets you the same behaviour today and no enforcement at all tomorrow.
```

## What to take away

- `readonly` is compile-time and shallow: it protects the property, not what the property points at.
- An index signature constrains *every* property, makes every read possibly-missing, and switches
  typo detection off — use it only when the keys are genuinely unknowable.
- Before adding a third absence state, be able to say what each of absent, `null` and empty means.
- Resolve optional input into a required type once, at the boundary, and let the compiler police the
  defaults.
