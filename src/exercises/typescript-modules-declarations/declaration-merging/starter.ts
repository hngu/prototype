/**
 * Exercise: Two people, one page
 * Lesson:   typescript-modules-declarations/declaration-merging
 *
 * Replace every `throw new Error('TODO: …')` with a real implementation.
 *
 * `core.ts` is given, and the rule is that you may not edit it — treat it as a library you
 * installed. Its `PluginContext` has two members and your plugins need four.
 *
 * Two mechanisms to use, and the exercise is partly about telling them apart:
 *
 *   - **Module augmentation** — `declare module './core.ts' { … }` — adds to an interface in
 *     another module. This is how you extend a library's types without forking it.
 *   - **Interface merging** — two `interface Foo` declarations in the same scope become one.
 *     It is the same underlying rule, applied locally.
 *
 * And one thing to keep in mind throughout: **a merged interface is a claim about a value.**
 * The compiler will believe whatever you declare here, and nothing checks that something
 * actually supplies it. Adding `requestId: string` to `PluginContext` does not create a
 * request id — it only stops the compiler complaining when you read one. That is why the
 * host's `extend` hook exists, and why `buildContext` below is not optional busywork.
 *
 * Read `core.ts` before you start. It keeps two interfaces — a concrete `PluginContextBase`
 * it builds itself, and an empty `PluginContext extends PluginContextBase` for you to add to
 * — and the comment there explains what breaks when a library does not do that.
 */

import type { Plugin, PluginContext, PluginContextBase } from './core.ts'
import { runPlugins } from './core.ts'

export type { Plugin, PluginContext, PluginContextBase }
export { runPlugins }

/* ── Part 1: augment the library's interface ───────────────────────────────────────────
 *
 * Add two members to `core.ts`'s `PluginContext`, from here:
 *
 *   readonly requestId: string
 *   warn(message: string): void
 *
 * Augmentation syntax is fussy in two ways worth knowing. The specifier has to match how
 * this file imports the module — `'./core.ts'` — and the file must already be a module, so
 * it needs a top-level `import` or `export` before `declare module` means augmentation
 * rather than "declare a brand-new ambient module of that name".
 */

// TODO: your `declare module './core.ts' { … }` block goes here.

/* ── Part 2: merge a local interface ───────────────────────────────────────────────────
 *
 * `PluginMeta` below is declared twice on purpose. Add a second declaration with
 * `readonly author: string` and leave the first one alone, so the exercise demonstrates the
 * merge rather than an edit.
 */

export interface PluginMeta {
  readonly title: string
}

// TODO: a second `export interface PluginMeta { … }` adding `author`.

/* ── Part 3: make the claims true ───────────────────────────────────────────────────── */

/**
 * Builds the extended context the augmentation promised.
 *
 * @param base what the host provides — `appName` and `log`.
 * @param requestId the id to attach.
 *
 * `warn(message)` must log `WARN: <message>` through the base context's `log`, so the host
 * can see it. Everything the base already provides must still work.
 */
export function buildContext(base: PluginContextBase, requestId: string): PluginContext {
  throw new Error('TODO: spread the base, then add what the augmentation declared')
}

/** A plugin that uses `appName` — available before any augmentation. */
export function corePlugin(): Plugin {
  throw new Error('TODO: name it "core"; run() returns `core:<appName>`')
}

/**
 * A plugin that uses `requestId` and `warn` — the augmented members.
 *
 * `run()` must call `warn('late')` and then return `trace:<requestId>`.
 */
export function tracePlugin(): Plugin {
  throw new Error('TODO: name it "trace"')
}

/** `<title> by <author>` — proves the locally merged interface is one type, not two. */
export function describeMeta(meta: PluginMeta): string {
  throw new Error('TODO: one line')
}
