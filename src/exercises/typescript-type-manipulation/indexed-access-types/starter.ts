/**
 * Exercise: Reaching into a type
 * Lesson:   typescript-type-manipulation/indexed-access-types
 *
 * Replace every `throw new Error('TODO: …')` with a real implementation.
 *
 * The types below are **given**. Read them: every one is reached out of `ApiResponse`
 * with square brackets, and not one of them restates a field `ApiResponse` already
 * declares. Rename `city` to `town` in the response and the build breaks *here*, once,
 * rather than silently in whichever function still expects the old name.
 *
 * Your job is the runtime half.
 */

/** The shape the server sends. The one place any of this is written down. */
export interface ApiResponse {
  readonly user: {
    readonly id: string
    readonly profile: {
      readonly city: string
      readonly postcode: string
    }
    readonly tags: readonly string[]
    readonly visits: readonly {
      readonly at: number
      readonly page: string
    }[]
  }
}

/** Reaching in one level. */
export type User = ApiResponse['user']

/** And another. Chains as deep as you like. */
export type City = ApiResponse['user']['profile']['city']

/**
 * `[number]` is how you get an array's *element* type — the index type, not a literal
 * index. `Tag` is `string`, not `readonly string[]`.
 */
export type Tag = User['tags'][number]

/** Same trick on an array of objects. */
export type Visit = User['visits'][number]

/** The city on the response. */
export function cityOf(response: ApiResponse): City {
  throw new Error('TODO: reach in')
}

/** The first tag, or `undefined`. */
export function firstTag(response: ApiResponse): Tag | undefined {
  throw new Error('TODO: mind noUncheckedIndexedAccess')
}

/** Every visited page, in order. Note the return type reaches two levels in. */
export function pagesVisited(response: ApiResponse): readonly Visit['page'][] {
  throw new Error('TODO: map the visits')
}

/** The most recent visit by `at`, or `undefined` when there are none. */
export function latestVisit(response: ApiResponse): Visit | undefined {
  throw new Error('TODO: highest at wins')
}

/**
 * One field of the user, chosen by the caller.
 *
 * `User[K]` is the same `T[K]` from lesson 3.2 — ask for `'profile'` and you get the
 * profile object, not a union of every field type.
 */
export function fieldOf<K extends keyof User>(response: ApiResponse, key: K): User[K] {
  throw new Error('TODO: one lookup')
}
