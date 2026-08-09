/**
 * Exercise: Two dialects, one phrasebook
 * Lesson:   typescript-modules-declarations/esm-cjs-interop
 *
 * Replace every `throw new Error('TODO: …')` with a real implementation.
 *
 * Four files are given: two real CommonJS modules and a `.d.cts` for each.
 *
 *   legacy-config.cjs    module.exports = { DEFAULTS, load, describe, version }
 *   single-export.cjs    module.exports = function slugify(…)
 *
 * They are genuinely CommonJS and this file is genuinely ESM, so every import below is a
 * real interop boundary rather than a simulation of one.
 */

import type { DbConfig } from './legacy-config.cjs'

export type { DbConfig }

/** Something that may or may not have been wrapped in a `default` on the way here. */
export type MaybeDefault<T> = T | { readonly default: T }

/**
 * Unwraps one layer of `default`, if there is one.
 *
 * This is the phrasebook entry, and it is the same function every bundler ships under a
 * name like `interopRequireDefault`. Rules:
 *
 * - An object with a `default` key returns that key's value. **One layer only** — the
 *   result of unwrapping `{ default: { default: 1 } }` is `{ default: 1 }`.
 * - Anything else comes back untouched, including objects with no `default`.
 * - It must not throw on `null`, `undefined`, or a primitive. Those are all "no wrapper".
 */
export function unwrapDefault<T>(mod: MaybeDefault<T>): T {
  throw new Error('TODO: one condition, and mind what `in` does to a primitive')
}

/**
 * Loads database config from the legacy CommonJS module, applying `overrides`.
 *
 * Use a **static named import** of `legacy-config.cjs`. It works, and the types come
 * through — which is the point being made.
 */
export function loadConfig(overrides?: Partial<DbConfig>): DbConfig {
  throw new Error('TODO: delegate to the legacy module')
}

/** Renders a config, via the legacy module's own `describe`. */
export function describeConfig(config: DbConfig): string {
  throw new Error('TODO: one line')
}

/**
 * Slugifies text using `single-export.cjs`.
 *
 * That module assigns a *function* to `module.exports`, which its `.d.cts` describes with
 * `export =`. Work out what shape of import reaches a callable.
 */
export function slug(text: string): string {
  throw new Error('TODO: one line, once the import is right')
}

/**
 * The legacy module's `version` string.
 *
 * This one is a trap, and it is a real one rather than a contrived one. `legacy-config.d.cts`
 * declares `version`, so `import { version } from './legacy-config.cjs'` typechecks
 * perfectly — and then Node throws:
 *
 *   SyntaxError: Named export 'version' not found. The requested module
 *   './legacy-config.cjs' is a CommonJS module, which may not support all
 *   module.exports as named exports.
 *
 * Look at how `module.exports` is written in the `.cjs` file and work out why `load` and
 * `describe` survive as named imports while `version` does not. Then reach it a way that
 * works.
 */
export function legacyVersion(): string {
  throw new Error('TODO: a named import will not do it — see the note above')
}

/**
 * The same config, loaded through `await import()` instead.
 *
 * A dynamic import of a CommonJS module hands back a namespace object with **both** a
 * `default` and the named exports Node's lexer managed to detect. So this is where
 * `unwrapDefault` earns its keep — use it rather than reaching for `.default` directly,
 * because the same code has to survive the module being converted to ESM one day.
 */
export async function loadConfigDynamically(overrides?: Partial<DbConfig>): Promise<DbConfig> {
  throw new Error('TODO: await the import, unwrap it, then load')
}
