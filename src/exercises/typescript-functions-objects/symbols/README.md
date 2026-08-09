# A key cut just for you

Two flats can both have a front door labelled *3B*. The labels are identical and the
keys are not, and nobody thinks this is surprising.

`Symbol('audit')` cuts a key. Call it again and you get a **different** key with the
same label, because the string is a description for your debugger and carries no
identity whatsoever. Which is how two libraries can both annotate your objects under
the name "audit" and never once collide.

This exercise is a metadata store built on that guarantee.

## Goal

Implement the five functions in `starter.ts`:

- **`tag(doc, key, value)`** returns a copy with the metadata set.
- **`readTag(doc, key)`** reads it back, or `undefined`.
- **`publicKeys(doc)`** returns the ordinary string keys — `['title']`, never the
  symbols.
- **`metaKeys(doc)`** returns whichever metadata keys are actually present, in
  `[AUDIT, TRACE]` order.
- **`withoutMeta(doc)`** returns a copy with the public data and none of the metadata.
  `{ ...doc }` is **not** the answer, and the next section says why.

## Why there is a fifth file here

Every other exercise in this repo is four files. This one has `keys.ts`, and the
reason is the lesson itself.

`unique symbol` is the one **nominal** type TypeScript has — its identity is the
declaration, not its shape. So it cannot be declared twice. Two files each writing
`const AUDIT: unique symbol = Symbol('audit')` produce two unrelated types, and the
API-parity check in `solution.test.ts` fails with:

```
TS2322: Type 'typeof import("./starter")' is not assignable to
        type 'typeof import("./solution")'
```

That is not a problem with the check. It is the type system correctly refusing to
confuse two different keys — the exact property the exercise is about, showing up in
the exercise's own plumbing. So `starter.ts`, `solution.ts` and the tests share one
declaration.

## Invisible to enumeration, visible to copying

The popular summary is "symbol keys are hidden". It is half true, and the half that
is wrong is the one that bites:

| Operation | Sees symbol keys? |
| --- | --- |
| `Object.keys`, `for…in` | no |
| `JSON.stringify` | no |
| `{ ...doc }`, `Object.assign` | **yes** |
| `Object.getOwnPropertySymbols` | yes, on purpose |

The first two are why symbols are good for metadata: everything that walks or
serialises your object carries on as though the annotations were not there. The third
is why `withoutMeta` has to rebuild the object rather than spread it.

## `Symbol` versus `Symbol.for`

- `Symbol('x')` is a fresh key every time. Nobody else can reach it.
- `Symbol.for('x')` is the **global registry**: same string, same symbol, across every
  module and even across realms.

`Symbol.for` is the one that can collide, deliberately, and it is for protocols
everybody must agree on. For private metadata it is exactly the wrong choice. The last
test pins both behaviours down.

## Run it

```bash
pnpm --filter exercises attempt   # grade your starter.ts — start here
pnpm --filter exercises verify    # the full gate CI runs
```

Work in `starter.ts`. `solution.ts` is the reference answer, and the same tests
grade both — which is what keeps the answer and the tests honest.

## Hints

<details>
<summary>Hint 1 — setting a symbol key</summary>

A computed property name works with a symbol exactly as it does with a string:
`{ ...doc, [key]: value }`. The spread copies everything, and the computed property
overwrites one of them.

</details>

<details>
<summary>Hint 2 — metaKeys and the type of the list</summary>

`[AUDIT, TRACE]` on its own is inferred as `symbol[]`, and `doc[someSymbol]` will not
type-check. `as const` gives you a readonly tuple of the two `unique symbol` types
instead — the same trick as lesson 1.2, doing real work.

`Object.getOwnPropertySymbols(doc)` would also find them at run time, but it returns
`symbol[]` and would need a cast. Listing the keys you own is better typed and more
honest.

</details>

<details>
<summary>Hint 3 — withoutMeta</summary>

Build the public shape by hand. The return type keeps you right: add a required field
to `Doc` and this function stops compiling, which is the reminder you want.

</details>
