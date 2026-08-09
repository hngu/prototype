/**
 * The "core" module — given, and think of it as a library you installed.
 *
 * The two-interface shape below is not decoration. It is how a library makes itself safely
 * augmentable, and the reason is worth understanding before you augment anything.
 *
 * If `PluginContext` were a single interface that this file also *constructed*, then a
 * consumer adding a required member to it would break this file:
 *
 *   error TS2739: Type '{ appName: string; log(…): void }' is missing the following
 *   properties from type 'PluginContext': requestId, warn
 *
 * The library's own code stops compiling because somebody else made a promise on its behalf.
 * So a library that expects to be extended keeps two names: a concrete one it builds and
 * guarantees, and an empty extending one that consumers may add to.
 */

/** What the host itself guarantees. Not augmented, so the host can always build one. */
export interface PluginContextBase {
  readonly appName: string
  log(message: string): void
}

/**
 * What plugins receive.
 *
 * Empty on purpose: it exists to be augmented. Out of the box it is exactly
 * `PluginContextBase`, and every member a consumer adds arrives here.
 */
export interface PluginContext extends PluginContextBase {}

export interface Plugin {
  readonly name: string
  run(context: PluginContext): string
}

export interface HostResult {
  readonly outputs: readonly string[]
  readonly logs: readonly string[]
}

/**
 * Runs plugins against a context.
 *
 * `extend` is **required**, which is the other half of the same design. The host can only
 * build a `PluginContextBase`; turning that into whatever `PluginContext` has become is the
 * consumer's job, because only the consumer knows what they augmented it with. With no
 * augmentation in the program the two types are identical and `extend` is the identity
 * function, so the required parameter costs nothing.
 */
export function runPlugins(
  appName: string,
  plugins: readonly Plugin[],
  extend: (base: PluginContextBase) => PluginContext,
): HostResult {
  const logs: string[] = []

  const base: PluginContextBase = {
    appName,
    log(message: string): void {
      logs.push(message)
    },
  }

  const context = extend(base)

  return { outputs: plugins.map((plugin) => plugin.run(context)), logs }
}
