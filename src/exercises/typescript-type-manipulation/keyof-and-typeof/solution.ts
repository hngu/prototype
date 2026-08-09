/**
 * Reference solution: Two X-rays
 * Lesson: typescript-type-manipulation/keyof-and-typeof
 */

/* `as const` is doing all the work that makes the three derived types possible. Without
   it, this object's type is `{ dark: string; light: string; auto: string }`, so
   `keyof typeof MODES` would still give the three key names — but `ModeLabel` would
   collapse to plain `string` and `MODES.dark` would be useless for narrowing. Lesson 1.2
   again, now load-bearing. */
export const MODES = {
  dark: 'Dark',
  light: 'Light',
  auto: 'Follow system',
} as const

/* Two operators, easy to confuse because one is spelled like a JavaScript keyword.

   `typeof MODES` is the **type** operator: it takes a *value* and gives its type. It is
   not the runtime `typeof` that returns the string `'object'`; it only exists in type
   positions, which is how you can tell them apart.

   `keyof X` takes a *type* and gives a union of its keys.

   So `keyof typeof MODES` reads right to left: take the value `MODES`, get its type, get
   that type's keys. It is the standard way to derive a union from a real object, and it
   means the union cannot drift out of step with the data. */
export type Mode = keyof typeof MODES

/* An indexed access — lesson 3.4's subject — used here because it is the natural partner:
   `(typeof MODES)[Mode]` is the type of every value you can reach through those keys.
   The parentheses are required; `typeof MODES[Mode]` parses as `typeof (MODES[Mode])`
   and means something else entirely. */
export type ModeLabel = (typeof MODES)[Mode]

/* `MODES[mode]` where `mode` is the full `Mode` union produces the full `ModeLabel`
   union, which is exactly the declared return type. No switch, no default, nothing to
   forget when a fourth mode appears. */
export function labelFor(mode: Mode): ModeLabel {
  return MODES[mode]
}

/* The cast is the interesting line in this file.

   `Object.keys` is declared as returning `string[]`, and it has to be: it works on any
   object, and TypeScript cannot know whether the value you handed it has extra keys at
   run time — an object typed `{ dark: … }` might really be a wider one, because
   structural typing permits that.

   Here, though, `MODES` is a `const` object literal in this very file with `as const`
   applied. Nothing can have added a key to it. So the keys really are exactly `Mode`, and
   the cast is a claim we can actually justify — which is the standard for writing one.

   It is still a claim. If someone later builds `MODES` by spreading in another object,
   this line becomes a lie and nothing will tell you. Casts are where you take
   responsibility, so it is worth a comment at the site. */
export function allModes(): readonly Mode[] {
  return Object.keys(MODES) as Mode[]
}

/* Checking membership in the real object rather than a hand-written
   `value === 'dark' || value === 'light' || …`, so a fourth mode needs no edit here.

   `Object.hasOwn` rather than `value in MODES`, because `in` also finds inherited
   properties — `isMode('toString')` would be true with `in`, and that is a genuine
   security-shaped bug rather than a curiosity. `hasOwn` is the ES2022 replacement for
   `Object.prototype.hasOwnProperty.call`. */
export function isMode(value: unknown): value is Mode {
  return typeof value === 'string' && Object.hasOwn(MODES, value)
}

/* `Object.entries` has the same widening problem as `Object.keys` — it hands back
   `[string, string][]` — so the key needs the same justified cast on the way out. */
export function modeFromLabel(label: string): Mode | undefined {
  for (const [key, value] of Object.entries(MODES)) {
    if (value === label) return key as Mode
  }

  return undefined
}
