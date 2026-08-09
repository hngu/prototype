/**
 * The "before" picture — given, not part of the exercise.
 *
 * This is what a `namespace`-organised codebase looks like once you cannot use `namespace`
 * any more: one module exporting one deeply nested object, with everything reachable through
 * a single name.
 *
 * The original would have been written like this, and the shape below is what it compiled to:
 *
 *   namespace Geometry {
 *     export namespace Area {
 *       export function circle(r: number): number { … }
 *     }
 *     export namespace Convert {
 *       export function toMetres(feet: number): number { … }
 *     }
 *   }
 *
 * `namespace` needs code generation — it becomes an IIFE assigning to an object — so it is
 * `TS1294` under `erasableSyntaxOnly` and cannot appear in this package. The lesson page
 * shows the real syntax; this file shows the shape it produces, which is the thing you
 * actually have to migrate.
 *
 * Nothing here is well organised. That is the point.
 */

export const Geometry = {
  Area: {
    circle(radius: number): number {
      if (radius < 0) throw new RangeError(`radius must not be negative, got ${radius}`)
      return Math.PI * radius ** 2
    },

    rectangle(width: number, height: number): number {
      if (width < 0 || height < 0) throw new RangeError('sides must not be negative')
      return width * height
    },
  },

  Convert: {
    FEET_PER_METRE: 3.28084,

    toMetres(feet: number): number {
      return feet / Geometry.Convert.FEET_PER_METRE
    },

    toFeet(metres: number): number {
      return metres * Geometry.Convert.FEET_PER_METRE
    },
  },

  /* A nested namespace reaching into a sibling by its fully qualified name — the habit that
     makes this shape hard to pick apart, and the reason a bundler cannot tree-shake any of
     it. */
  describe(radius: number): string {
    return `circle r=${radius} area=${Geometry.Area.circle(radius).toFixed(2)}`
  },
}

/** The namespace-era way of exporting a type: nested inside the object's own type. */
export type GeometryShape = typeof Geometry
