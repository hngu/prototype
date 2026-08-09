/**
 * Reference solution: Reaching into a type
 * Lesson: typescript-type-manipulation/indexed-access-types
 */

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

/* The whole idea in one line: square brackets work on *types* the same way they work on
   values. `ApiResponse['user']` is not a lookup that happens at run time — there is no
   run time — it is the compiler reading the declaration and handing back the type of
   that property.

   The alternative is to declare `interface User { … }` separately and have `ApiResponse`
   refer to it, which is often the better design for code you own. Indexed access earns
   its keep for shapes you *do not* own: a generated API client, a library's return type,
   a third-party payload. You cannot restructure those, and copying a field out by hand
   is a copy that will go stale. */
export type User = ApiResponse['user']

/* Chains as deep as the data does, and each step is checked. Misspell one and you get
   "Property 'citty' does not exist on type …", which is the same error you would get for
   a value — because it is the same idea. */
export type City = ApiResponse['user']['profile']['city']

/* `[number]` is the one people have to be shown. It is not "index 0"; it is the *index
   type*, so it asks "what do I get for any numeric index?" — which is the element type.

   `User['tags'][number]` is `string`. `User['tags'][0]` also works and means something
   narrower and rarely useful on an array. On a *tuple* the difference matters:
   `[string, number][0]` is `string` while `[string, number][number]` is `string | number`. */
export type Tag = User['tags'][number]

export type Visit = User['visits'][number]

export function cityOf(response: ApiResponse): City {
  return response.user.profile.city
}

/* `tags[0]` is already `string | undefined` under `noUncheckedIndexedAccess`, and the
   declared return type is `Tag | undefined` — which is `string | undefined`. They agree
   without help, as they did in lesson 1.8. */
export function firstTag(response: ApiResponse): Tag | undefined {
  return response.user.tags[0]
}

/* `Visit['page']` in the return type rather than `string`. Both compile today; only one
   of them still means "whatever a visit's page is" after somebody changes `page` to a
   branded id type. Reaching in costs nothing and never needs revisiting. */
export function pagesVisited(response: ApiResponse): readonly Visit['page'][] {
  return response.user.visits.map((visit) => visit.page)
}

/* `reduce` with no initial value takes the first element as the seed, which is why the
   length check has to come first — the same shape as `hottest` in lesson 1.1. */
export function latestVisit(response: ApiResponse): Visit | undefined {
  const { visits } = response.user
  if (visits.length === 0) return undefined

  return visits.reduce((latest, visit) => (visit.at > latest.at ? visit : latest))
}

/* `User[K]` with `K` pinned by the constraint, exactly as `pluck` did in lesson 3.2.
   Ask for `'profile'` and you get the profile object; ask for `'id'` and you get a
   string. Writing the parameter as `keyof User` instead would collapse the return type
   into a union of all four field types and push a narrowing job onto every caller. */
export function fieldOf<K extends keyof User>(response: ApiResponse, key: K): User[K] {
  return response.user[key]
}
