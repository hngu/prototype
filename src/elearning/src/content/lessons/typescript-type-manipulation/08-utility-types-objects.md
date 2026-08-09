---
title: The standard-issue toolkit
course: typescript-type-manipulation
order: 8
summary: Six utility types cover most day-to-day type surgery on object shapes. You already know how every one of them is built, which is what makes the inconsistency in `Omit` worth knowing about.
duration: 11
exercise: true
draft: false
---

A carpenter's toolbox contains nothing a carpenter could not have made. It contains the six things
worth not making again.

You have written mapped types now, so this lesson is mostly recognition — and one genuine wart it is
better to hear about here than discover on a Friday.

## The six

Every one of these is a mapped type, and none of them is longer than a line:

| Utility | Does | Built as |
| --- | --- | --- |
| `Partial<T>` | every property optional | `{ [K in keyof T]?: T[K] }` |
| `Required<T>` | every property required | `{ [K in keyof T]-?: T[K] }` |
| `Readonly<T>` | every property readonly | `{ readonly [K in keyof T]: T[K] }` |
| `Pick<T, K>` | keep these keys | `{ [P in K]: T[P] }` |
| `Record<K, V>` | these keys, all holding `V` | `{ [P in K]: V }` |
| `Omit<T, K>` | drop these keys | `Pick<T, Exclude<keyof T, K>>` |

`Record` is the odd one out: it builds a shape out of nothing rather than transforming one, so the
value type is the same `V` for every key rather than `T[P]`. `Record<string, User>` is also just an
index signature by another name — which means reading one gives you `User | undefined` under
`noUncheckedIndexedAccess`, exactly as lesson 2.4 said.

They compose, and that is where they earn their keep:

```ts
type UserPatch = Partial<Omit<User, 'id' | 'createdAt'>>
```

"Anything a caller may change, all optional." One line, and it tracks `User` automatically. Compare
writing that interface out by hand and remembering to update it.

```quiz
id: typescript-type-manipulation-utility-types-objects-q1
q: `type UsersById = Record<string, User>`. With `noUncheckedIndexedAccess` on, what is the type of `usersById['u1']`?
- [x] `User | undefined`
- [ ] `User`
- [ ] `unknown`
- [ ] An error, because `Record` keys must be literals
explain: `Record<string, V>` is a string index signature, so it says which keys are *allowed* and never which are present — an empty object satisfies it. `Record<'a' | 'b', V>` is different: those keys are known to exist, and reading them gives you `V`.
```

## `Omit` is looser than `Pick`, and it matters

Look at the two signatures as shipped:

```ts
type Pick<T, K extends keyof T> // constrained to T's keys
type Omit<T, K extends keyof any> // any key at all
```

So this compiles, and does nothing:

```ts
type PublicUser = Omit<User, 'passwordHsh'> // typo. Omits nothing. No error.
```

while `Pick<User, 'passwordHsh'>` is a clean error. The looseness was a compatibility decision when
`Omit` was added in TypeScript 3.5 and cannot be tightened now without breaking real code. It is the
single most useful piece of trivia in this lesson, because the failure mode is a password hash
cheerfully sent to a browser.

If it matters to you, the strict version is three tokens:

```ts
type StrictOmit<T, K extends keyof T> = Omit<T, K>
```

```quiz
id: typescript-type-manipulation-utility-types-objects-q2
q: What does `Omit<User, 'passwordHsh'>` produce, given the typo?
- [x] `User` unchanged, with no error reported
- [ ] A compile error naming the unknown key
- [ ] `never`
- [ ] `Partial<User>`
explain: `Omit`'s second parameter is constrained to `keyof any`, so an unknown key is accepted and removes nothing. `Pick` constrains to `keyof T` and would have caught it — an inconsistency kept for backwards compatibility, and worth a `StrictOmit` alias in any codebase where the omitted field is a secret.
```

## The bug that hides behind `Partial`

This one is not about the types at all, and it is the most common way they get you:

```ts
function applyPatch(user: User, patch: Partial<User>): User {
  return { ...user, ...patch } // looks right
}

applyPatch(user, { name: undefined }) // user.name is now undefined
```

`{ name: undefined }` is a perfectly valid `Partial<User>` — the property is *present*, and its value
is `undefined`. An object spread copies present properties, so it overwrites a real name with nothing.

The types cannot help, because nothing is wrong with them. You have to decide what your API means and
implement it: either filter the undefined entries out before spreading, or document that an explicit
`undefined` clears the field. Both are defensible; silently doing the second while believing the first
is not.

There is a compiler flag in the neighbourhood — `exactOptionalPropertyTypes` — which makes
`{ name: undefined }` *not* assignable to `{ name?: string }`, separating "absent" from "present and
undefined" properly. It is not part of `strict`, it is genuinely useful, and Course 6 comes back to it.

```quiz
id: typescript-type-manipulation-utility-types-objects-q3
type: true-false
q: `{ ...user, ...patch }` where `patch: Partial<User>` can replace a real value with `undefined`.
answer: true
explain: A spread copies every *present* property, and `{ name: undefined }` has `name` present. It is valid against `Partial<User>`, so no type error is possible — the decision about what an explicit `undefined` means is yours to make and implement.
```

## What to take away

- All six utilities are one-line mapped types; `Record` is the only one that builds a shape rather
  than transforming one.
- They compose, and `Partial<Omit<T, K>>` tracks `T` automatically where a hand-written interface would
  not.
- `Omit` accepts keys the type does not have and silently omits nothing; `Pick` does not. Alias a
  `StrictOmit` where it matters.
- A `Partial` spread can overwrite real values with `undefined`, and no type will warn you —
  `exactOptionalPropertyTypes` is the flag that closes it.
