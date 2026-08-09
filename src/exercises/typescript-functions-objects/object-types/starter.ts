/**
 * Exercise: A form with optional rows
 * Lesson:   typescript-functions-objects/object-types
 *
 * Replace every `throw new Error('TODO: …')` with a real implementation.
 *
 * Read the two option types first. `RequestOptions` is what a caller writes — almost
 * everything optional. `ResolvedOptions` is what the rest of the program sees —
 * nothing optional at all. Turning the first into the second is the most useful
 * shape in this whole exercise, and `resolveOptions` is where it happens.
 */

export type Method = 'GET' | 'POST' | 'PUT' | 'DELETE'

/**
 * Header names are arbitrary, so the type cannot list them — it describes them all
 * at once with an **index signature**.
 *
 * `readonly` here applies to every property the signature covers.
 */
export interface HeaderBag {
  readonly [name: string]: string
}

/** What a caller passes. */
export interface RequestOptions {
  readonly method?: Method
  readonly headers?: HeaderBag
  readonly timeoutMs?: number
  readonly body?: string
  readonly retries?: number
}

/** What everything downstream receives. No optional properties, no guessing. */
export interface ResolvedOptions {
  readonly method: Method
  readonly headers: HeaderBag
  readonly timeoutMs: number
  /** `null` rather than optional: "there is deliberately no body". */
  readonly body: string | null
  readonly retries: number
}

/**
 * Fills in every default: `GET`, no headers, 5000ms, no body, no retries.
 *
 * A `timeoutMs` or `retries` of `0` is a real answer and must survive.
 */
export function resolveOptions(options?: RequestOptions): ResolvedOptions {
  throw new Error('TODO: fill in the defaults without discarding a legitimate 0')
}

/** Looks a header up, ignoring case, because HTTP does. */
export function headerValue(headers: HeaderBag, name: string): string | undefined {
  throw new Error('TODO: case-insensitive lookup')
}

/**
 * A copy of `headers` with `name` set, lowercased, replacing any existing spelling.
 *
 *   withHeader({ 'Content-Type': 'a' }, 'content-type', 'b')  →  { 'content-type': 'b' }
 */
export function withHeader(headers: HeaderBag, name: string, value: string): HeaderBag {
  throw new Error('TODO: return a new bag — the old one is readonly for a reason')
}

/**
 * One line describing the request.
 *
 *   describeRequest('/users')                                →  'GET /users (5000ms)'
 *   describeRequest('/users', { method: 'POST', body: 'hi' }) →  'POST /users (5000ms, body 2 chars)'
 *   describeRequest('/users', { retries: 1 })                →  'GET /users (5000ms, 1 retry)'
 */
export function describeRequest(url: string, options?: RequestOptions): string {
  throw new Error('TODO: resolve the options first, then describe them')
}
