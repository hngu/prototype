/**
 * Reference solution: An empty box and no box
 * Lesson: typescript-fundamentals/null-and-strictness
 */

export interface Profile {
  readonly name: string
  readonly nickname?: string
  readonly bio: string | null
}

/* `text?: string` makes the *parameter* optional, which means its type inside the
   function is `string | undefined`. So `text.trim()` does not compile, and that is
   the whole reason `strictNullChecks` exists — before it, this function looked fine
   and threw on the day somebody called it with nothing.

   The `?? ''` handles the missing case by turning it into the empty case, which
   works because "no text" and "blank text" both have no first word. That will not
   always be true, and when it is not, an early `return undefined` is clearer than
   a clever default. */
export function firstWord(text?: string): string | undefined {
  const words = (text ?? '').trim().split(/\s+/)
  const first = words[0]
  return first === undefined || first === '' ? undefined : first
}

/* Two very different questions live behind the `?` marker, and `??` only answers
   one of them.

   `profile.nickname ?? profile.name` asks "is the nickname *there*", which is not
   what we want here: a nickname of `''` is there, and would win, and the profile
   would render with no name at all. What we want is "is the nickname *usable*",
   which is a content check, not an absence check.

   Getting this wrong is one of the most common bugs in TypeScript that the
   compiler cannot help with — the types are correct either way. */
export function displayName(profile: Profile): string {
  const nickname = profile.nickname?.trim()
  return nickname !== undefined && nickname !== '' ? nickname : profile.name
}

/* And here `??` is exactly right. `bio` is `string | null`: the property is always
   present, and `null` is a deliberate value meaning "this user has no bio". An
   empty string means something different — "this user saved an empty bio" — and
   `??` is the operator that keeps the two apart.

   `||` would collapse them, which is the argument for `??` in one line. */
export function bioOrDefault(profile: Profile, fallback: string): string {
  return profile.bio ?? fallback
}

/* The classic case. `configured || 20` reads beautifully and is wrong: `0` is
   falsy, so a deliberate page size of zero silently becomes twenty.

   `??` only falls back for `null` and `undefined`, which is the question the
   parameter was asking. Reach for `??` by default and keep `||` for the cases where
   you genuinely mean "falsy". */
export function pageSize(configured?: number): number {
  return configured ?? 20
}

/* One line, and the interesting part is why it type-checks.

   `items[index]` is declared as returning `string`, and it has always been able to
   return `undefined` — `['a'][7]` is `undefined` in every JavaScript engine ever
   shipped. `noUncheckedIndexedAccess` closes that gap: with the flag on, the
   expression is typed `string | undefined`, which is the truth.

   So the honest signature and the naive body agree, and there is nothing to write.
   Without the flag you would have had to remember to widen the return type by hand,
   on every function like this, forever. */
export function pick(items: readonly string[], index: number): string | undefined {
  return items[index]
}
