/**
 * Reference solution: Two people, one page
 * Lesson: typescript-modules-declarations/declaration-merging
 */

import type { Plugin, PluginContext, PluginContextBase } from './core.ts'
import { runPlugins } from './core.ts'

export type { Plugin, PluginContext, PluginContextBase }
export { runPlugins }

/* ── Module augmentation ───────────────────────────────────────────────────────────────
   Adding two members to an interface that lives in a file we are pretending not to own.

   Two fussy requirements, and both produce confusing errors when missed:

   - **The specifier must match how this file imports the module.** `'./core.ts'` here,
     because that is what the import above says. Get it wrong and you have not augmented
     anything — you have declared a brand-new ambient module nobody imports, silently.
   - **The augmenting file must already be a module**, i.e. have a top-level `import` or
     `export`. In a script, `declare module 'x'` means "declare an ambient module called x"
     instead, which is a completely different feature wearing the same syntax.

   And the thing to hold on to: **this is a claim, not an implementation.** The compiler now
   believes every `PluginContext` has a `requestId`. Nothing here creates one. If no code
   actually supplies it, every read is `undefined` and the compiler is on the hook for having
   said otherwise — which is why `buildContext` below exists and why the host offers a hook
   to install it. An augmentation with nothing behind it is a type assertion spread across
   two files. */
declare module './core.ts' {
  interface PluginContext {
    readonly requestId: string
    warn(message: string): void
  }
}

/* ── Local interface merging ───────────────────────────────────────────────────────────
   The same underlying rule, without crossing a file boundary: two declarations of one name
   in one scope become a single type. Merging is **additive** — the result requires `title`
   *and* `author`, and there is no way to remove or loosen a member this way.

   Two members with the same name and *different* types is an error, not a resolution:
   `Subsequent property declarations must have the same type`. The one exception is a method,
   where a second declaration adds an **overload** rather than conflicting — which is how
   `declare global { interface Array<T> }` can add methods to something it did not write.

   Worth knowing why this is an `interface` and not a `type`. Merging is exactly what
   `interface` can do and `type` cannot: a second `type PluginMeta` is
   `Duplicate identifier`. That is the honest answer to "interface or type?" — if a consumer
   might need to extend it, it has to be an interface. */
export interface PluginMeta {
  readonly title: string
}

export interface PluginMeta {
  readonly author: string
}

/* ── Making the claims true ────────────────────────────────────────────────────────────
   The other half of every augmentation, and the half people forget.

   `...base` first, so `appName` and `log` survive. Then the two members the augmentation
   promised. `warn` routes through `base.log`, which means the host can see it — a `warn` that
   wrote to the console would satisfy the type and be invisible to every test. */
export function buildContext(base: PluginContextBase, requestId: string): PluginContext {
  return {
    ...base,
    requestId,
    warn(message: string): void {
      base.log(`WARN: ${message}`)
    },
  }
}

/* Uses only what `core.ts` declared itself. Included as the control: it compiles and runs
   whether or not anyone augments anything. */
export function corePlugin(): Plugin {
  return {
    name: 'core',
    run(context: PluginContext): string {
      return `core:${context.appName}`
    },
  }
}

/* And this one only compiles because of the augmentation twelve lines up. Delete that block
   and `context.requestId` becomes
   `Property 'requestId' does not exist on type 'PluginContext'`. */
export function tracePlugin(): Plugin {
  return {
    name: 'trace',
    run(context: PluginContext): string {
      context.warn('late')
      return `trace:${context.requestId}`
    },
  }
}

/* Reads both members of the merged interface. If the two declarations had stayed separate
   types this would not compile, which is the point of asserting it here rather than
   describing it. */
export function describeMeta(meta: PluginMeta): string {
  return `${meta.title} by ${meta.author}`
}
