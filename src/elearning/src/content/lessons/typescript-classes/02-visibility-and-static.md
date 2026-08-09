---
title: A sign and a lock
course: typescript-classes
order: 2
summary: "TypeScript's `private` and JavaScript's `#` both hide a field, and only one of them is still there when the code runs. You will be able to choose between them deliberately, use `protected` without regretting it, and write a run-time type check that nothing can fake."
duration: 11
exercise: true
draft: false
---

A door marked *staff only* keeps out everyone who reads the signs. A door with a lock on it keeps out
everyone.

Both are worth having, and they are not the same thing. TypeScript gives you both, they look almost
identical in the code, and picking the wrong one is the sort of mistake that goes unnoticed for years.

## The sign

`private` on a member means "only code inside this class may touch this":

```ts
class Session {
  private token: string

  constructor(token: string) {
    this.token = token
  }

  header(): string {
    return `Bearer ${this.token}`
  }
}

new Session('abc').token // Property 'token' is private
```

There is a third modifier between the two extremes. `protected` means "this class and anything that
extends it", which is how a base class hands a subclass something the outside world should not see:

```ts
abstract class Shape {
  protected readonly sides: number
  // …
}
```

The rule of thumb worth adopting: **default to private, promote to protected only when a subclass
actually needs it.** `protected` is part of your API — it is a promise to every future subclass, and
it is much harder to take back than a `private` you can rename freely. `public` is the default and
almost never worth writing.

```quiz
id: typescript-classes-visibility-and-static-q1
q: A base class has `protected refresh(): void`. Which code can call it?
- [x] Any method of the class or of a subclass, on `this`
- [ ] Any code in the same file
- [ ] Only methods of the class that declared it
- [ ] Any code holding a reference to an instance
explain: `protected` extends access to subclasses, which is the entire difference from `private`. Note that visibility in TypeScript is per *class*, not per file or per instance — a `private` member is reachable from any code inside the declaring class, including a static factory reaching into an instance it did not build, which is what makes named constructors able to do things callers cannot.
```

## The lock

Now the same field, hidden the other way:

```ts
class Session {
  #token: string

  constructor(token: string) {
    this.#token = token
  }

  header(): string {
    return `Bearer ${this.#token}`
  }
}
```

`#token` is a **JavaScript** private field — nothing to do with TypeScript, and supported by every
runtime you will meet. The syntax is odd because the privacy is lexical: `#token` is only a valid
*name* inside this class body. That is not a rule the compiler enforces; it is what the name means.

The consequence is that the two do genuinely different things once the types are gone:

| | `private token` | `#token` |
| --- | --- | --- |
| reaching it from outside in TypeScript | `token` is private | `session.#token` does not parse |
| after a `as unknown as { token: string }` cast | **readable** | no cast can express the name |
| `Object.keys(session)` | `['token']` | `[]` |
| `JSON.stringify(session)` | `{"token":"abc"}` | `{}` |
| from plain JavaScript | readable | unreachable |

`private` is a compile-time annotation and is **erased**, exactly like a type. So `private` documents
intent and catches honest mistakes — which is most of what visibility is for, and why it is not the
wrong choice by default. It is simply not a boundary to put a secret behind, and the `JSON.stringify`
row is the one that bites in practice: a `private` field lands in your logs.

```quiz
id: typescript-classes-visibility-and-static-q2
q: A class has `private apiKey: string`. An object is passed to `JSON.stringify`. What is in the output?
- [x] `apiKey` is included, because `private` is erased before the code runs
- [ ] Nothing, because `private` members are non-enumerable
- [ ] `apiKey` is included, but only under a mangled name
- [ ] `tsc` refuses to compile a `JSON.stringify` call on a class with private members
explain: `private` is a type-level annotation and leaves no trace in the emitted JavaScript, so the field is an ordinary enumerable property and serialises like one. `#apiKey` would have produced `{}`. This is the practical reason to reach for `#` on anything you would be unhappy to find in a log line — the compiler cannot help you, because as far as it is concerned nothing has gone wrong.
```

## What the class itself owns

`static` members live on the class object rather than on instances, and they can be hidden too —
`static #created` is one private counter for the whole class. The pairing worth knowing is a private
static field with a public static getter, which gives you a value the outside world can read and
cannot change.

The reason statics matter here is the **named constructor**. A class may have only one `constructor`,
so every other way of building one becomes a static factory:

```ts
class Session {
  #token: string
  #expires: Date

  private constructor(token: string, expires: Date) {
    this.#token = token
    this.#expires = expires
  }

  static fromHeader(header: string): Session | undefined {
    const token = header.replace(/^Bearer /, '')
    return token === header ? undefined : new Session(token, new Date(Date.now() + 3_600_000))
  }
}
```

Note `private constructor` — a legitimate and underused move. It says "you may not call `new` on
this", which forces every caller through a factory that can validate, cache, or return `undefined`
instead of throwing. A constructor cannot decline to build an object; a factory can.

And the trick that only `#` makes possible. A private field is the one thing about an object that
cannot be faked, so `#token in value` is a real run-time type test:

```ts
static isSession(value: unknown): value is Session {
  return typeof value === 'object' && value !== null && #token in value
}
```

That is called a **brand check**. A shape check would accept `{ token: 'x' }`. `instanceof` is usually
right, but breaks when two copies of the module exist — routine with bundlers and duplicated
dependencies — and can be lied to by reassigning `Symbol.hasInstance`. Nobody can forge a private
field. One trap: `#token in value` throws on a primitive, so the `typeof` guard is load-bearing rather
than defensive padding.

```quiz
id: typescript-classes-visibility-and-static-q3
q: Why is `#token in value` a better run-time check for "is this really a Session?" than `'token' in value`?
- [x] Only objects the class constructed carry the private field, so nothing can fake it
- [ ] It is faster, because private fields are looked up on the prototype
- [ ] `in` does not work with public property names on class instances
- [ ] It also narrows `value` to `Session`, which `'token' in value` cannot do
explain: Private fields are installed by the constructor and nameable only inside the class body, so their presence is proof of origin — that is what makes it a *brand*. The last option is tempting but wrong for a reason worth knowing: `'token' in value` narrows perfectly well, it just narrows to "an object with a `token` property", which an impostor also satisfies. The problem was never the narrowing; it was that the fact being checked was forgeable.
```

## What to take away

- `private` and `protected` are compile-time annotations, erased before the code runs — real
  protection against mistakes, no protection against casts, plain JavaScript, or `JSON.stringify`.
- `#field` is JavaScript's own privacy and is absolute, because outside the class body the name does
  not exist. Reach for it on anything you would be unhappy to see in a log.
- Visibility is per class, not per object: a static factory can touch the private members of any
  instance, which is why named constructors can do things callers cannot.
- `#field in value` is a brand check — the only run-time test of a class that nothing can fake, and
  it needs a `typeof` guard in front of it because `in` throws on primitives.
