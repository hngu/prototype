# One door onto three rooms

A house has rooms. It also has a front door, and the front door is not a list of every
room — it is a decision about how people get in.

## Goal

Three modules already exist and are given. Make `starter.ts` the single public entry
point — a **barrel** — that re-exports exactly the right things.

| Module | Types | Values |
| --- | --- | --- |
| `money.ts` | `Currency`, `Money` | `SYMBOLS`, `money`, `add` |
| `format.ts` | `FormatOptions` | `formatMoney`, `symbolFor` |
| `cart.ts` | `CartLine`, `CartInternals` | `line`, **default** `total` |

**Required surface.** Types: `Currency`, `Money`, `FormatOptions`, `CartLine`. Values:
`SYMBOLS`, `money`, `add`, `formatMoney`, `symbolFor`, `line`, `total`, `formatLine`.

**Deliberately excluded:** `CartInternals`. And `money.ts`'s `round`, which is not
exported from `money.ts` at all — the submodule's own boundary is the first gate, and the
barrel is the second.

**One function to write.** `formatLine(cartLine)` renders `2 × Coffee — £7.00`, where the
price is the **line total** (unit price × quantity). When the quantity is 1, drop the count
entirely: `Coffee — £3.50`. (`×` is U+00D7, `—` is U+2014.)

There are no `throw new Error('TODO')` stubs in this one. The work is the export statements,
and all of them are missing.

## The rule the compiler is enforcing

`verbatimModuleSyntax` is on, so re-exporting a type with a plain `export { … }` is an
error — `TS1205: Re-exporting a type when 'verbatimModuleSyntax' is enabled requires using
'export type'`.

That is not fussiness. Node runs these files by **erasing** types, so a plain
`export { Money }` survives as a genuine re-export instruction, and at run time `money.ts`
has no `Money` to give:

```text
SyntaxError: The requested module './money.ts' does not provide an export named 'Money'
```

`export type { … }` is erased completely, which is the correct outcome. The rule to
internalise: the compiler makes you say which of the two universes a name lives in, because
only one of them still exists when the program runs.

## The default export needs renaming

`cart.ts` exports `total` as its default. Passing that through takes the rename form:

```ts
export { default as total } from './cart.ts'
```

`default` is a real export name, just an unusual one. A bare `export { default }` would make
`total` **this** module's default instead of a named export, which is a surprise for every
caller — so the rename is not optional, and one of the tests checks the barrel did not
quietly acquire a default of its own.

## Why the parity check looks different here

Every other exercise in this repo asserts at compile time that `starter.ts` and
`solution.ts` expose the same API. This is the one exercise where the API **is** the
deliverable: `starter.ts` starts with no exports, so that assertion would be red on a fresh
clone and break the package's second invariant.

The shape is therefore checked at **run time**, by the first test, and `subject` is cast.
That is the honest cost of grading a module's surface. You still get your compile errors
where they matter — in `starter.ts`, from `verbatimModuleSyntax`, the moment you reach for
the wrong `export`.

## Run it

```bash
pnpm --filter exercises attempt   # grade your starter.ts — start here
pnpm --filter exercises verify    # the full gate CI runs
```

Work in `starter.ts`. `solution.ts` is the reference answer, and the same tests
grade both — which is what keeps the answer and the tests honest.

## Hints

<details>
<summary>Hint 1 — the two kinds of re-export</summary>

```ts
export type { Currency, Money } from './money.ts'
export { SYMBOLS, add, money } from './money.ts'
```

Two statements per module when it exports both kinds of thing. Group them, rather than
interleaving — a reader can then see the type surface and the value surface separately.

</details>

<details>
<summary>Hint 2 — formatLine's imports</summary>

`formatLine` needs `CartLine` as a type and `money` plus `formatMoney` as values, so it
takes the same `import type` / `import` split the exports do. `format.ts` at the top of the
directory is worth reading first — it already does exactly this.

</details>

<details>
<summary>Hint 3 — why formatLine lives in the barrel</summary>

Because it is the only code that needs both `cart` and `format`. Pushing it into either one
would make those two modules depend on each other for no reason, and a barrel adding the
function that joins its submodules is the one thing a barrel should add.

</details>
