# Moving house

You do not move house by throwing everything on the lawn and hoping. You pack one room,
move it, unpack it, and keep sleeping somewhere the whole time.

## Goal

`legacy-shape.ts` holds one deeply nested object — the shape a `namespace` leaves behind.
Flatten it into ordinary module exports, then provide a shim so the old callers keep working.

- **`circleArea`, `rectangleArea`, `toMetres`, `toFeet`, `describeCircle`** — flat, top-level,
  one name per thing. Keep the guards the originals had: `RangeError` on a negative radius or
  side.
- **`describeCircle(2)`** renders `circle r=2 area=12.57`.
- **`asLegacyShape()`** returns the old nested shape, built by **referencing** the flat
  functions.

The tests check identity — `shim.Area.circle` must be the very same function object as
`circleArea`. A shim that copies logic is a second implementation to keep in step, which is
the failure this pattern exists to prevent.

## Why the second half is the real exercise

Flattening is mechanical. The interesting question is how you ship it, because nobody gets to
convert a codebase in one commit — and a migration that cannot be done gradually does not get
done at all.

The order that works:

1. Add the flat exports beside the old shape.
2. Add a shim so nothing breaks. Mark it `@deprecated` so editors nag.
3. Move call sites over, a few at a time, at whatever pace the team has.
4. Delete the shim. That commit is the one that proves the migration finished.

`describeCircle` should call `circleArea` **directly**, not through the shim. The shim is the
thing being retired, so nothing new should depend on it — otherwise step 4 never happens.

## Why flat is better, concretely

Not a style preference. Three things change:

- **Tree-shaking works.** A bundler can see a caller imported `circleArea` and nothing else.
  It cannot see that through a nested object, because reading one property requires the whole
  object to exist.
- **Renaming is a rename.** `import { circleArea as area }` at the call site, rather than an
  alias for a property path that a search will not find.
- **The file boundary does the organising.** `Geometry.Area.circle` encoded a hierarchy in a
  *name* because there was nowhere else to put it. Modules have a directory and a filename.
  Two mechanisms for one job is one too many — that is the actual argument against namespaces,
  and it is why they are legacy rather than merely unfashionable.

Look at `legacy-shape.ts`'s internal references while you are in there: `toMetres` reaches its
own sibling constant as `Geometry.Convert.FEET_PER_METRE`. Every internal reference going
through the top-level object is what makes this shape so hard to pick apart, because nothing
can move without its callers moving too.

## Why there is no `namespace` keyword anywhere

`namespace` compiles to an IIFE that assembles an object, so it needs code generation and is
`TS1294` under `erasableSyntaxOnly`. The lesson page shows the real syntax; this directory
shows the *shape* it produces, which is what you would actually be handed on a real
migration.

## Run it

```bash
pnpm --filter exercises attempt   # grade your starter.ts — start here
pnpm --filter exercises verify    # the full gate CI runs
```

Work in `starter.ts`. `solution.ts` is the reference answer, and the same tests
grade both — which is what keeps the answer and the tests honest.

## Hints

<details>
<summary>Hint 1 — the flat functions</summary>

Copy the bodies across and replace every `Geometry.Convert.FEET_PER_METRE` with
`FEET_PER_METRE`, and every `Geometry.Area.circle(…)` with `circleArea(…)`. That substitution
*is* the migration; the rest is checking you did not drop a guard.

</details>

<details>
<summary>Hint 2 — asLegacyShape</summary>

```ts
return {
  Area: { circle: circleArea, rectangle: rectangleArea },
  Convert: { FEET_PER_METRE, toMetres, toFeet },
  describe: describeCircle,
}
```

Bare references, no arrow wrappers. `circle: (r) => circleArea(r)` would pass every
behavioural test and fail the identity one — correctly, because it is a second function that
could later disagree with the first.

</details>

<details>
<summary>Hint 3 — why it returns a fresh object</summary>

A shared `const` shim is an object callers can monkey-patch, and a shim is not somewhere you
want anyone getting comfortable. Returning a new wrapper each call keeps the *functions*
shared while giving nobody a communal object to modify.

</details>
