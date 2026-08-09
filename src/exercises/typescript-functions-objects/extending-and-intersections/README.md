# Staple a page on, or demand both

There are two ways to ask for a longer form. Staple an extra page to the one you
already have, or hand someone two forms and say *fill in both*.

`interface X extends Y` is the staple. `A & B` is the two forms. Almost always they
give you the same thing, and this exercise is mostly about seeing that — plus the one
case where they diverge, which is the reason to have a preference.

## Goal

Implement the four functions in `starter.ts`:

- **`store(note, id, now)`** returns a `StoredNote`: the note, plus an `id`, plus
  both timestamps starting equal at `now`.
- **`touch(stored, now)`** returns a copy with a new `updatedAt` and nothing else
  changed. Everything is `readonly`, so a copy is the only option available to you.
- **`summarise(entity)`** → `'n1: Shopping'`. Note its parameter is `WithId<Note>` —
  the *minimum* it needs, not `StoredNote`.
- **`ageMs(entity, now)`** → `now - entity.createdAt`. Its parameter is `Timestamps`
  alone: no note, no id.

`WithId<T>` and `Timestamped<T>` take a type parameter. Course 3 is about writing
those properly; here you only have to read them, and `WithId<Note>` reads as "a
`Note`, plus an `id`".

## The two routes, and where they part company

`StoredNote` is built by composing intersections. `StoredNoteByExtends` is an
interface listing the same members. The test assigns one to the other **in both
directions**, which only compiles because they are the same type.

Then it shows the divergence. Given two types that both declare `x` with different
types:

- `interface Both extends HasStringX, HasNumberX {}` is an **error on the
  declaration** — TS2320, "cannot simultaneously extend".
- `type Both = HasStringX & HasNumberX` produces **no error at all**. It computes
  `x: string & number`, which is `never`, and stays quiet. The bill arrives later, at
  every attempt to build one: *Type 'string' is not assignable to type 'never'.*

Same disagreement, reported once at the declaration versus once per call site,
phrased as a puzzle. That is the whole argument for `extends` when either would do.

## Ask for the least you need

Look at the four parameter types. Only `touch` wants a whole `StoredNote`;
`summarise` wants an id and a title, and `ageMs` wants two numbers. A parameter type
is a **floor, not a ceiling** — a `StoredNote` satisfies all of them, and so does a
draft that has an id but no timestamps.

Writing `StoredNote` on every parameter would work today and be wrong the first time
somebody has one of the pieces and not the others.

## Run it

```bash
pnpm --filter exercises attempt   # grade your starter.ts — start here
pnpm --filter exercises verify    # the full gate CI runs
```

Work in `starter.ts`. `solution.ts` is the reference answer, and the same tests
grade both — which is what keeps the answer and the tests honest.

## Hints

<details>
<summary>Hint 1 — building the stored note</summary>

Spread the note rather than listing its fields. Then adding a field to `Note` needs no
edit here, and the return type still holds you to supplying everything `StoredNote`
requires.

</details>

<details>
<summary>Hint 2 — touch</summary>

`stored.updatedAt = now` will not compile, and that is deliberate. Spread and
override: the later property wins.

</details>

<details>
<summary>Hint 3 — the two small ones</summary>

`summarise` and `ageMs` are one line each. If you find yourself needing a field the
parameter type does not have, re-read the parameter type — it is the exercise.

</details>
