---
title: Reaching into a type
course: typescript-type-manipulation
order: 4
summary: Square brackets work on types the same way they work on values. It is the simplest tool in this course and the one that stops a codebase filling up with copies of somebody else's field types.
duration: 9
exercise: true
draft: false
---

A recipe says *use the flour from the third jar on the second shelf*. It does not say *use plain
flour* — because if you reorganise the pantry, the recipe should follow rather than argue.

Types can be written the same way, and it takes about a minute to learn.

## Square brackets, on a type

You already index values. You can index types with exactly the same syntax:

```ts
interface ApiResponse {
  user: {
    id: string
    profile: { city: string; postcode: string }
    tags: string[]
  }
}

type User = ApiResponse['user']
type City = ApiResponse['user']['profile']['city'] // string
```

Nothing runs. This is the compiler reading the declaration and handing back the type of that
property, and it chains as deep as the data does. Misspell a step and you get *Property 'citty' does
not exist on type …* — the same error you would get for a value, because it is the same idea.

Note the key is written as a **string literal**, not an identifier: `ApiResponse['user']`, never
`ApiResponse.user`. Dot notation does not exist in type positions, which trips up everybody once.

You can also index with a union, and with `keyof`:

```ts
type Field = User['id' | 'tags'] // string | string[]
type AnyField = User[keyof User] // union of every field type
```

```quiz
id: typescript-type-manipulation-indexed-access-types-q1
q: How do you write the type of the `city` property inside `response.user.profile`?
- [x] `ApiResponse['user']['profile']['city']`
- [ ] `ApiResponse.user.profile.city`
- [ ] `keyof ApiResponse['user']['profile']`
- [ ] `typeof ApiResponse['user']['profile']['city']`
explain: Indexed access uses bracket notation with string literals; dot notation does not exist in type positions. `keyof` would give you the *names* `'city' | 'postcode'`, and `typeof` is for turning a value into a type — `ApiResponse` is already a type.
```

## `[number]` is the one to remember

Getting an array's element type out is the single most common use, and the syntax surprises people:

```ts
type Tag = User['tags'][number] // string
```

`[number]` is not "index zero". It is the **index type** — "what do I get for any numeric index?" —
which on an array is the element type. `User['tags'][0]` also compiles and means something narrower
that is rarely useful.

On a **tuple** those two genuinely differ, and the difference is worth knowing before it confuses
you:

```ts
type Pair = [string, number]
type A = Pair[0] // string
type B = Pair[number] // string | number
```

This composes with everything else. Given a payload of visit records, the type of one visit's page is
`Response['user']['visits'][number]['page']` — long, and it never needs updating.

```quiz
id: typescript-type-manipulation-indexed-access-types-q2
q: `type Pair = [string, number]`. What is `Pair[number]`?
- [x] `string | number`
- [ ] `string`
- [ ] `number`
- [ ] `never`
explain: `[number]` asks what any numeric index yields, and on a tuple that is the union of every slot. `Pair[0]` is the one that gives `string` — on an array the two coincide, which is why the distinction only shows up on tuples.
```

## When to reach in, and when to name it

The temptation, once you know this, is to reach in everywhere. Two rules keep it useful.

**For shapes you own, prefer a named type.** Declaring `interface Visit { … }` and having the response
refer to it gives the concept a name, a place to put a docstring, and a shorter thing to write. If you
find yourself writing `Response['user']['visits'][number]` in six signatures, that type wanted a name
several signatures ago.

**For shapes you do not own, reach in.** A generated API client, a library's return type, a payload
somebody else defines — you cannot restructure those, and copying a field's type out by hand produces
a copy that will silently go stale. This is where indexed access is genuinely the right answer rather
than a clever one.

There is a small habit that follows from the second rule. Prefer

```ts
function pagesVisited(r: ApiResponse): readonly Visit['page'][]
```

to `readonly string[]`. Both compile today; only one of them still means "whatever a page is" after
somebody changes `page` to a branded id type. It costs nothing at the time of writing and saves a
grep later.

```quiz
id: typescript-type-manipulation-indexed-access-types-q3
type: true-false
q: Indexed access types are resolved at runtime by looking up the property.
answer: false
explain: There is no runtime involved at all — types are erased. `ApiResponse['user']` is the compiler reading a declaration during type checking, and the syntax borrowing from value indexing is a convenience for you rather than a description of what happens.
```

## What to take away

- `Type['key']` reads a property's type out of the declaration; dot notation does not exist in type
  positions.
- `[number]` gives an array's element type — and on a tuple it is the union of every slot, unlike
  `[0]`.
- Name the type for shapes you own; reach in for shapes you do not, where a hand-written copy would go
  stale.
- Writing `Visit['page']` instead of `string` in a signature costs nothing and survives a change to
  the field's type.
