# Two people, one page

Two people write on the same page and the page keeps both. That is declaration merging, and
it is the mechanism behind every "add a field to the Express `Request` object" answer you
have ever copied.

## Goal

`core.ts` is given and you may not edit it — treat it as a library you installed. Its
`PluginContext` has two members and your plugins need four.

1. **Augment the library's interface** from `starter.ts`, adding
   `readonly requestId: string` and `warn(message: string): void` to `core.ts`'s
   `PluginContext`.
2. **Merge a local interface** — add a second `export interface PluginMeta` declaring
   `readonly author: string`, leaving the first one alone.
3. **Make the claims true** — `buildContext`, `corePlugin`, `tracePlugin`, `describeMeta`.
   `warn` logs `WARN: <message>` through the base context's `log`; `tracePlugin.run` calls
   `warn('late')` and returns `trace:<requestId>`.

## Read `core.ts` first

It keeps **two** interfaces:

```ts
export interface PluginContextBase { appName: string; log(m: string): void }
export interface PluginContext extends PluginContextBase {}
```

That is not decoration, and the reason is the sharpest practical warning about this feature.
If `PluginContext` were a single interface the library also *constructed*, your augmentation
would break the library's own code:

```text
error TS2739: Type '{ appName: string; log(…): void }' is missing the following
properties from type 'PluginContext': requestId, warn
```

Which is exactly what happened while this exercise was being written. A library expecting to
be extended keeps a concrete type it builds and guarantees, and an empty extending one that
consumers add to. `runPlugins`' `extend` parameter is the other half: the host can only build
a `PluginContextBase`, so turning that into whatever `PluginContext` has become is the
consumer's job — because only the consumer knows what they added.

If you are augmenting a library that did *not* anticipate this, declare your additions
**optional**. It is the difference between extending a type and breaking one.

## A merged interface is a claim, not an implementation

The compiler believes whatever you declare. Nothing checks that anything supplies it.

Adding `requestId: string` does not create a request id — it stops the compiler complaining
when you read one. If no code actually puts it there, every read is `undefined` and the
compiler has told you otherwise. An augmentation with nothing behind it is a type assertion
spread across two files.

That is why `buildContext` exists, and it is the half people forget.

## Two ways to get the augmentation wrong

Both verified against tsc 6.0.3:

- **A conflicting type** is caught properly. Declare `requestId: number` while `buildContext`
  assigns a string and you get `TS2322` at the assignment.
- **A mistyped specifier is silent.** `declare module './core-typo.ts'` produces **no error at
  the `declare module` line** — TypeScript reads it as declaring a brand-new ambient module
  that nobody imports. The only symptom is `Property 'requestId' does not exist on type
  'PluginContext'` at every *use site*, which points everywhere except at the mistake.

The specifier has to match how the file imports the module, and the augmenting file must
already be a module — a top-level `import` or `export`. In a script, `declare module 'x'`
means something else entirely.

## One thing about the tests

**Module augmentation is program-global.** `solution.ts`'s `declare module './core.ts'` block
applies to every file in the compilation, `starter.ts` included. So a starter with no
augmentation still typechecks, because the solution's is already in effect — the type half of
part 1 is not graded per-file. A wrong augmentation *is* caught, and the runtime half is
graded normally.

That leakage is not a flaw in the exercise so much as the thing worth taking away: augmenting
a shared interface is not a local decision, and in a real codebase it is visible to every file
that ever touches that type.

## Run it

```bash
pnpm --filter exercises attempt   # grade your starter.ts — start here
pnpm --filter exercises verify    # the full gate CI runs
```

Work in `starter.ts`. `solution.ts` is the reference answer, and the same tests
grade both — which is what keeps the answer and the tests honest.

## Hints

<details>
<summary>Hint 1 — the augmentation block</summary>

```ts
declare module './core.ts' {
  interface PluginContext {
    readonly requestId: string
    warn(message: string): void
  }
}
```

No `export` inside the block — you are adding to an interface that is already exported.

</details>

<details>
<summary>Hint 2 — the local merge</summary>

Just declare it again. Two `export interface PluginMeta` blocks in one file become one type
requiring both members. Note this is something `interface` can do and `type` cannot: a second
`type PluginMeta` is `Duplicate identifier`. It is the honest answer to "interface or type?" —
if a consumer might need to extend it, it has to be an interface.

</details>

<details>
<summary>Hint 3 — buildContext</summary>

```ts
return {
  ...base,
  requestId,
  warn(message) { base.log(`WARN: ${message}`) },
}
```

`...base` first, or you lose `log` — and that failure shows up as a missing line somewhere far
away rather than as an error here.

</details>
