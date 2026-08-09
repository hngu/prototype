---
title: Chains that remember what they are
course: typescript-classes
order: 4
summary: A generic class is one class specialised per use, and `this` as a return type is what stops a chain of calls forgetting which class it started on. You will be able to write both, say why a static member cannot see the class's type parameter, and spot the constraint that quietly disables every key check you wrote.
duration: 11
exercise: true
draft: false
---

A conversation goes wrong the moment one reply forgets who was talking. You said something specific;
they answered as though anyone could have said it.

Chained method calls have the same failure, and it is the second half of this lesson. The first half
is the class knowing what it holds.

## One class, specialised per use

A class takes type parameters exactly as a function does, and every member can use them:

```ts
class Cache<K, V> {
  #entries = new Map<K, V>()

  set(key: K, value: V): this {
    this.#entries.set(key, value)
    return this
  }

  get(key: K): V | undefined {
    return this.#entries.get(key)
  }
}

const users = new Cache<string, { name: string }>()
users.get('u1')?.name // known to be a string
```

That is course 3's generics with a longer lifetime: a function's type parameter is chosen per call,
a class's is chosen per **instance** and then holds for everything you do with it.

Which explains the one rule that surprises everybody. A `static` member cannot see the class's type
parameters:

```ts
class Cache<K, V> {
  static empty(): Cache<K, V> {} // Static members cannot reference class type parameters
  static empty<A, B>(): Cache<A, B> {} // ✓ its own parameters
}
```

There is one `Cache` class object, shared by every `Cache<string, User>` and `Cache<number, Post>`
ever made. `K` was never chosen for it, so there is nothing to refer to.

```quiz
id: typescript-classes-generic-classes-and-this-q1
q: Why can a `static` member not use the class's type parameter `T`?
- [x] There is a single class object shared by every instantiation, so no `T` has been chosen for it
- [ ] Static members are erased before generics are resolved
- [ ] Because `static` members cannot be generic at all
- [ ] Because `T` is only in scope after the constructor has run
explain: `Cache<string>` and `Cache<number>` are the same class object at run time — the type argument belongs to the instance, and a static member exists whether or not an instance ever does. Statics *can* be generic; they just have to declare their own parameters, which is why the exercise's `static of<U>()` uses a different letter deliberately.
```

## The chain that forgets

Now the conversation problem. A chainable method has to return something, and the obvious choice is
wrong:

```ts
class QueryBuilder {
  where(clause: string): QueryBuilder {
    /* … */ return this
  }
}

class PagedQuery extends QueryBuilder {
  limit(n: number): PagedQuery {
    /* … */ return this
  }
}

new PagedQuery().where('id = 1').limit(10) // Property 'limit' does not exist on type 'QueryBuilder'
```

The object is a `PagedQuery` throughout — `return this` never made a new one. It is the *type* that
forgot, because `where` promised a `QueryBuilder` and the compiler holds it to exactly that.

The fix is one word:

```ts
where(clause: string): this
```

`this` as a return type is a **polymorphic this type**: it means "whatever class the receiver actually
is". Called on a `PagedQuery` it is a `PagedQuery`, and the chain arrives at `.limit` intact. Write
`this` on every chaining method and inheritance stops being a trap.

`this` also works as a parameter type, and it is how you say "another one of exactly me":

```ts
class Money {
  add(other: this): this {
    /* … */
  }
}
```

That is stricter than `other: Money` — it refuses to add a `Money` to a `Discount`, which is usually
what you want and occasionally too strict. Reach for it deliberately.

```quiz
id: typescript-classes-generic-classes-and-this-q2
q: A base class declares `where(clause: string): QueryBuilder` and returns `this`. Calling `.where(…).limit(…)` on a subclass fails to compile. Why?
- [x] The declared return type is `QueryBuilder`, so the compiler forgets the subclass even though the object never changed
- [ ] `return this` copies the object, losing the subclass
- [ ] The subclass needs to redeclare `where` with its own return type
- [ ] `limit` needs to be declared on the base class
explain: Nothing happens at run time — `this` is the same object all the way through. The declaration is the only thing that narrowed, and `this` as the return type fixes it without touching either subclass. The third option is the workaround people reach for first, and it means redeclaring every chaining method in every subclass, which is the maintenance cost `this` exists to avoid.
```

## Where a constraint quietly costs you the check

Constraints on a class parameter work exactly as they do on a function, and one common choice has a
consequence worth knowing about. Suppose a builder wants to check column names against a row type:

```ts
class QueryBuilder<T extends Record<string, unknown>> {
  where<K extends keyof T & string>(column: K, value: T[K]): this {
    /* … */
  }
}
```

`where('age', 'thirty-three')` on a row whose `age` is a number is a compile error, because `K` is
fixed by the first argument and that makes the second's type `T[K]`. Two arguments, checked against
each other, from one signature.

Now the trap. `Record<string, unknown>` is an **index signature**, and `keyof` of anything carrying
one includes all of `string`. So a caller who satisfies the constraint the obvious way —

```ts
interface User extends Row {
  id: string
  age: number
}
```

— inherits the index signature, `keyof User` becomes `string`, and **every column check silently
passes**. `where('emial', 'typo')` compiles. Nothing broke loudly; the feature just stopped working.

Written as a type alias instead, `type User = { id: string; age: number }` satisfies the constraint
through an *implicit* index signature that TypeScript grants object type aliases, without the
signature becoming part of the type. `keyof User` stays `'id' | 'age'` and the checks bite. (An
`interface` gets no implicit index signature, which is why it has to say `extends Row` and why doing
so costs you the check.)

The general lesson is worth more than the specific fix: `T extends Record<string, unknown>` is a
weaker constraint than it looks, and any key-level guarantee built on top of it is only as good as
how the caller declared their type.

```quiz
id: typescript-classes-generic-classes-and-this-q3
q: `type Row = Record<string, unknown>`. For which declaration of `User` does `where<K extends keyof User & string>` actually restrict the column name?
- [x] `type User = { id: string; age: number }`
- [ ] `interface User extends Row { id: string; age: number }`
- [ ] Both — the constraint is on `where`, not on the declaration
- [ ] Neither — `keyof` always includes `string` once there is a constraint
explain: The interface inherits `Row`'s index signature, so `keyof User` includes all of `string` and any column name is accepted. The type alias satisfies the constraint through an implicit index signature that never becomes part of the type, so `keyof User` stays `'id' | 'age'`. The last option is the tempting one: the constraint on `T` does not affect `keyof T` at all — only what the caller actually passed does.
```

## What to take away

- A class's type parameters are chosen per instance and hold for its lifetime; `static` members
  cannot see them, because the class object exists before any instance does.
- Return `this` rather than the class name from every chaining method, or inheritance breaks the chain
  at the first inherited call.
- `this` as a *parameter* type means "another one of exactly me", which is stricter than naming the
  class and occasionally too strict.
- `T extends Record<string, unknown>` is weaker than it looks: if the caller declares their type as
  an interface extending it, `keyof T` widens to `string` and every key check silently stops working.
