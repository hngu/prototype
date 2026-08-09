/**
 * Reference solution: A form with optional rows
 * Lesson: typescript-functions-objects/object-types
 */

export type Method = 'GET' | 'POST' | 'PUT' | 'DELETE'

export interface HeaderBag {
  readonly [name: string]: string
}

export interface RequestOptions {
  readonly method?: Method
  readonly headers?: HeaderBag
  readonly timeoutMs?: number
  readonly body?: string
  readonly retries?: number
}

export interface ResolvedOptions {
  readonly method: Method
  readonly headers: HeaderBag
  readonly timeoutMs: number
  readonly body: string | null
  readonly retries: number
}

/* This pattern — "optional in, required out" — is worth stealing outright.

   Every function downstream takes a `ResolvedOptions`, so not one of them contains a
   `?? 5000`. The defaults live in exactly one place, and the type system enforces
   that: if you add a field to `ResolvedOptions` and forget it here, this function
   stops compiling. Sprinkle `options?.timeoutMs ?? 5000` through fifteen functions
   instead and nothing enforces anything.

   Every fallback is `??`, never `||`. `timeoutMs: 0` and `retries: 0` are both real
   answers a caller might mean, and `||` would silently overrule them.

   `body` becomes `string | null` rather than staying optional, which is a deliberate
   shift: on the way in, "I did not mention a body" is what a caller says; on the way
   out, "there is no body" is a fact the code can rely on without an `in` check. */
export function resolveOptions(options?: RequestOptions): ResolvedOptions {
  return {
    method: options?.method ?? 'GET',
    headers: options?.headers ?? {},
    timeoutMs: options?.timeoutMs ?? 5000,
    body: options?.body ?? null,
    retries: options?.retries ?? 0,
  }
}

/* `headers[name]` would be the obvious implementation and it would be wrong, because
   HTTP header names are case-insensitive and object keys are not. So: walk the
   entries and compare lowercased.

   Note the return type is `string | undefined` and it would be that anyway.
   `noUncheckedIndexedAccess` makes *every* read through an index signature
   possibly-missing, which is simply the truth — an index signature says "any string
   key is allowed", not "any string key is present". */
export function headerValue(headers: HeaderBag, name: string): string | undefined {
  const wanted = name.toLowerCase()

  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === wanted) return value
  }

  return undefined
}

/* A copy, because `HeaderBag` is `readonly` and mutating the argument would be a
   compile error — which is the point of putting `readonly` there. Callers can hand
   over a shared default bag without wondering whether this function will edit it.

   The `filter` is what makes this correct rather than nearly correct: setting
   `content-type` on a bag that already holds `Content-Type` has to remove the old
   spelling, or the result has two headers that HTTP considers the same one. */
export function withHeader(headers: HeaderBag, name: string, value: string): HeaderBag {
  const lowered = name.toLowerCase()
  const kept = Object.entries(headers).filter(([key]) => key.toLowerCase() !== lowered)

  return Object.fromEntries([...kept, [lowered, value]])
}

/* Resolve once at the top, then read plain non-optional fields. Compare this with
   the version where `options` is threaded through directly: every line would need
   its own `??`, and the defaults would be restated four times.

   `body !== null` rather than a truthiness check, because an empty body is a body a
   caller deliberately sent, and `'body 0 chars'` is the honest description of it. */
export function describeRequest(url: string, options?: RequestOptions): string {
  const resolved = resolveOptions(options)

  const parts = [`${resolved.timeoutMs}ms`]
  if (resolved.body !== null) parts.push(`body ${resolved.body.length} chars`)
  if (resolved.retries > 0) {
    parts.push(`${resolved.retries} ${resolved.retries === 1 ? 'retry' : 'retries'}`)
  }

  return `${resolved.method} ${url} (${parts.join(', ')})`
}
