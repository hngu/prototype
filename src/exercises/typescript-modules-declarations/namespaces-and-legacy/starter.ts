/**
 * Exercise: Moving house
 * Lesson:   typescript-modules-declarations/namespaces-and-legacy
 *
 * Replace every `throw new Error('TODO: …')` with a real implementation.
 *
 * `legacy-shape.ts` next door holds one deeply nested object — the shape a `namespace`
 * leaves behind. Your job is to flatten it into ordinary module exports, and then provide a
 * shim so the old callers keep working while they are migrated.
 *
 * That second half is the part worth learning. Nobody gets to convert a codebase in one
 * commit, so a migration that cannot be done gradually does not get done.
 *
 * (The `namespace` keyword itself needs code generation and is `TS1294` under
 * `erasableSyntaxOnly`, so it appears only on the lesson page. What you are migrating here
 * is the shape it produces, which is what you would actually be handed.)
 */

/** Feet per metre. Flat, named, and importable on its own. */
export const FEET_PER_METRE = 3.28084

/** Area of a circle. `RangeError` on a negative radius. */
export function circleArea(radius: number): number {
  throw new Error('TODO: and keep the guard the original had')
}

/** Area of a rectangle. `RangeError` if either side is negative. */
export function rectangleArea(width: number, height: number): number {
  throw new Error('TODO: and keep the guard')
}

/** Feet to metres. */
export function toMetres(feet: number): number {
  throw new Error('TODO: one line')
}

/** Metres to feet. */
export function toFeet(metres: number): number {
  throw new Error('TODO: one line')
}

/** `circle r=2 area=12.57` — area to two decimal places. */
export function describeCircle(radius: number): string {
  throw new Error('TODO: call circleArea directly, not through any shim')
}

/**
 * The old nested shape, for callers that have not moved yet.
 *
 * Note what this type does *not* do: it does not describe a new nested world. It is a
 * description of the thing being retired, written down once so the compiler can check the
 * shim against it and so it is obvious what needs deleting later.
 */
export interface LegacyShape {
  readonly Area: {
    readonly circle: (radius: number) => number
    readonly rectangle: (width: number, height: number) => number
  }
  readonly Convert: {
    readonly FEET_PER_METRE: number
    readonly toMetres: (feet: number) => number
    readonly toFeet: (metres: number) => number
  }
  readonly describe: (radius: number) => string
}

/**
 * Builds the compatibility shim.
 *
 * **Reference the flat functions, do not reimplement them.** The tests check identity —
 * `shim.Area.circle` must be the very same function object as `circleArea` — because a shim
 * that copies logic is a second implementation to keep in step, which is the failure mode
 * this pattern exists to avoid.
 *
 * (It is a function rather than a `const` for a boring reason: a `const` built by a stub that
 * throws would make this module impossible to import, and the tests import it.)
 */
export function asLegacyShape(): LegacyShape {
  throw new Error('TODO: assemble it from the exports above, by reference')
}
