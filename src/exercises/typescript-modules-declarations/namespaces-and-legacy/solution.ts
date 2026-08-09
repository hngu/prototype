/**
 * Reference solution: Moving house
 * Lesson: typescript-modules-declarations/namespaces-and-legacy
 */

/* Flat, top-level, one name per thing. Compare with `legacy-shape.ts`, where all of this
   hung off a single exported object.

   Three concrete things the flat version buys, none of them stylistic:

   - **Tree-shaking works.** A bundler can see that a caller imported `circleArea` and
     nothing else. It cannot do that through a nested object, because reading one property
     off it requires the whole object to exist.
   - **Renaming is a rename.** `import { circleArea as area }` at the call site, rather than
     an alias for a property path that a search will not find.
   - **The file boundary does the organising.** `Geometry.Area.circle` encoded a hierarchy in
     a *name* because there was nowhere else to put it. With modules there is: a directory
     and a filename. Two mechanisms for one job is one too many, which is the actual argument
     against namespaces. */
export const FEET_PER_METRE = 3.28084

export function circleArea(radius: number): number {
  if (radius < 0) throw new RangeError(`radius must not be negative, got ${radius}`)
  return Math.PI * radius ** 2
}

export function rectangleArea(width: number, height: number): number {
  if (width < 0 || height < 0) throw new RangeError('sides must not be negative')
  return width * height
}

/* `FEET_PER_METRE` rather than `Geometry.Convert.FEET_PER_METRE`. The fully qualified names
   the original used everywhere are the single biggest reason namespace code is hard to pick
   apart: every internal reference goes through the top-level object, so nothing can be moved
   without touching its callers. */
export function toMetres(feet: number): number {
  return feet / FEET_PER_METRE
}

export function toFeet(metres: number): number {
  return metres * FEET_PER_METRE
}

/* Calls `circleArea` directly. Routing this through the shim would work and would be
   backwards: the shim is the thing being retired, so nothing new should depend on it. */
export function describeCircle(radius: number): string {
  return `circle r=${radius} area=${circleArea(radius).toFixed(2)}`
}

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

/* The shim, and the whole technique in one function.

   Every member is a **reference** to the flat export, not a wrapper around it and certainly
   not a copy of its body. So there is exactly one implementation of each behaviour, the old
   callers cannot drift from the new ones, and deleting this function is the only work left
   at the end of the migration.

   This is what makes the conversion incremental, which is the only kind that finishes. The
   order that works in practice:

     1. Add the flat exports beside the old shape.
     2. Add a shim so nothing breaks. Mark it deprecated so editors nag.
     3. Move call sites over, a few at a time, at whatever pace the team has.
     4. Delete the shim. That commit is the one that proves the migration is done.

   Note it hands back a fresh object each call rather than a shared `const`. That is a small
   deliberate choice: a shared mutable object is a thing callers can patch, and a shim is not
   somewhere you want anyone getting comfortable. */
export function asLegacyShape(): LegacyShape {
  return {
    Area: { circle: circleArea, rectangle: rectangleArea },
    Convert: { FEET_PER_METRE, toMetres, toFeet },
    describe: describeCircle,
  }
}
