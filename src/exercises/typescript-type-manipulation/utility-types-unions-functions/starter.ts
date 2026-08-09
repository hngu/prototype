/**
 * Exercise: Read the types off what exists
 * Lesson:   typescript-type-manipulation/utility-types-unions-functions
 *
 * Replace every `throw new Error('TODO: …')` with a real implementation.
 *
 * The types below are **given**, and the thing to notice is that not one of them restates
 * anything. `ApiClient` declares three methods; every argument list, every result type and
 * every subset of the endpoint names is *read off* that declaration. Change a method's
 * signature and all of it follows.
 */

export interface User {
  readonly id: string
  readonly name: string
}

/** The one declaration everything else is derived from. */
export interface ApiClient {
  getUser(id: string): Promise<User>
  listUsers(page: number, size?: number): Promise<readonly User[]>
  deleteUser(id: string): Promise<void>
}

/** `'getUser' | 'listUsers' | 'deleteUser'`. */
export type Endpoint = keyof ApiClient

/** `Extract` keeps the union members that match — here, by name pattern. */
export type MutatingEndpoint = Extract<Endpoint, `delete${string}`>

/** `Exclude` drops them. The two are opposites and both distribute. */
export type ReadEndpoint = Exclude<Endpoint, MutatingEndpoint>

/** The argument list of an endpoint, as a tuple. */
export type ArgsOf<E extends Endpoint> = Parameters<ApiClient[E]>

/** What an endpoint resolves to, with the promise peeled off. */
export type ResultOf<E extends Endpoint> = Awaited<ReturnType<ApiClient[E]>>

/** A small class, so `ConstructorParameters` and `InstanceType` have something to read. */
export class ApiError {
  readonly status: number
  readonly detail: string

  constructor(status: number, detail: string) {
    this.status = status
    this.detail = detail
  }

  toString(): string {
    return `${this.status}: ${this.detail}`
  }
}

/** `[status: number, detail: string]`. Note `typeof ApiError`, not `ApiError`. */
export type ApiErrorArgs = ConstructorParameters<typeof ApiError>

/**
 * Calls an endpoint by name.
 *
 * The arguments are checked against *that* endpoint's parameters and the result is *that*
 * endpoint's resolved type. Two casts are needed inside; working out why is the exercise.
 */
export function callEndpoint<E extends Endpoint>(
  client: ApiClient,
  endpoint: E,
  ...args: ArgsOf<E>
): Promise<ResultOf<E>> {
  throw new Error('TODO: look the method up and apply it')
}

/** The first value that is neither `null` nor `undefined`. */
export function firstDefined<T>(values: readonly T[]): NonNullable<T> | undefined {
  throw new Error('TODO: no cast should be necessary here')
}

/** Builds an `ApiError` from a tuple of its own constructor arguments. */
export function makeError(...args: ApiErrorArgs): ApiError {
  throw new Error('TODO: one line')
}
