/**
 * Reference solution: Two dialects, one phrasebook
 * Lesson: typescript-modules-declarations/esm-cjs-interop
 */

/* A **static named import** of a CommonJS module, from an ESM file, and it works.

   Node manages this by running `cjs-module-lexer` over the file before executing it, and
   statically detecting which properties end up on `module.exports`. What it finds becomes
   real named exports.

   What it *misses* is the whole problem — see `legacyVersion` at the bottom of this file.

   Note the specifier is `./legacy-config.cjs`, the runtime file. The compiler finds
   `legacy-config.d.cts` beside it on its own. Importing the `.d.cts` path directly also
   typechecks, and is wrong: nothing by that name exists at run time. */
import { describe as describeLegacy, load as loadLegacy } from './legacy-config.cjs'
import type { DbConfig } from './legacy-config.cjs'

/* The default import of a CommonJS module is `module.exports` itself — the whole object, no
   lexer guesswork involved. Which is why it is the reliable route, and the one to prefer for
   any package you do not control. */
import legacyApi from './legacy-config.cjs'

/* `single-export.cjs` assigns a *function* to `module.exports`, which its `.d.cts` describes
   with `export =`. There is exactly one import form that reaches it: the default import.
   `import * as slugify` would give you a namespace *object*, which is not callable —
   `esModuleInterop` (on by default under `module: nodenext`) exists to make this work and to
   stop you calling a namespace. */
import slugify from './single-export.cjs'

export type { DbConfig }

export type MaybeDefault<T> = T | { readonly default: T }

/* The phrasebook entry. Every bundler ships this function; esbuild and Babel call it
   `interopRequireDefault`, and it is four lines because the edge cases are all about what
   `in` does to things that are not objects.

   Three guards, and each one is load-bearing:
     - `mod !== null`, because `'default' in null` is a TypeError, not `false`.
     - `typeof mod === 'object' || typeof mod === 'function'`, because `in` also throws on a
       string or a number — and because a *function* can legitimately carry a `default`
       property, which is exactly what a transpiled ESM module looks like.
     - one layer only. Unwrapping recursively would be wrong: `{ default: { default: 1 } }`
       is a module whose default export happens to be an object with a `default` key, and
       eating that second layer corrupts real data. */
export function unwrapDefault<T>(mod: MaybeDefault<T>): T {
  if (mod !== null && (typeof mod === 'object' || typeof mod === 'function') && 'default' in mod) {
    return (mod as { readonly default: T }).default
  }

  return mod as T
}

/* Nothing clever. The point of the two functions below is that they are *ordinary* — the
   interop boundary cost nothing here, because a static import of a lexer-friendly CommonJS
   module behaves exactly like any other import. */
export function loadConfig(overrides?: Partial<DbConfig>): DbConfig {
  return loadLegacy(overrides)
}

export function describeConfig(config: DbConfig): string {
  return describeLegacy(config)
}

export function slug(text: string): string {
  return slugify(text)
}

/* The trap, and the reason the paragraph at the top matters.

   `legacy-config.cjs` ends with:

     module.exports = { DEFAULTS, load, describe, version: '1.4.2' }

   The lexer reported `DEFAULTS`, `load` and `describe` — the shorthand properties, whose
   values are identifiers it can follow — and **not** `version`, whose value is a string
   literal. Verified: `Object.keys(await import('./legacy-config.cjs'))` is
   `['DEFAULTS', 'default', 'describe', 'load', 'module.exports']`.

   So `import { version } from './legacy-config.cjs'` typechecks — the `.d.cts` declares it,
   and the `.d.cts` is not wrong, because the property genuinely exists at run time — and
   then Node refuses to load the file at all:

     SyntaxError: Named export 'version' not found.

   A compile-time green light and a load-time failure, decided by whether a property was
   written in shorthand. That is not something to reason about per property; it is a reason
   to reach for the default import whenever the module is not yours. */
export function legacyVersion(): string {
  return legacyApi.version
}

/* And here is where it stops being ordinary.

   `await import()` of a CommonJS module gives a namespace object carrying *both* a `default`
   (which is `module.exports`) and whatever named exports the lexer found — plus, on Node, a
   literal `'module.exports'` key. So `mod.load` and `mod.default.load` are both present and
   are the same function, which is confusing enough that reaching for either directly is a
   habit worth not forming.

   `unwrapDefault` is the right move because it keeps working when this module is converted
   to ESM: then there is no `default` wrapper, the namespace is the surface, and the same
   line still does the right thing. Code that hard-codes `.default` breaks on that day. */
export async function loadConfigDynamically(overrides?: Partial<DbConfig>): Promise<DbConfig> {
  const mod = await import('./legacy-config.cjs')
  const api = unwrapDefault(mod)
  return api.load(overrides)
}
