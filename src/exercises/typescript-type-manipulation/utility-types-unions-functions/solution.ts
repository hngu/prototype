/**
 * Reference solution: Read the types off what exists
 * Lesson: typescript-type-manipulation/utility-types-unions-functions
 */

export interface User {
  readonly id: string
  readonly name: string
}

export interface ApiClient {
  getUser(id: string): Promise<User>
  listUsers(page: number, size?: number): Promise<readonly User[]>
  deleteUser(id: string): Promise<void>
}

export type Endpoint = keyof ApiClient

/* `Extract<T, U>` is `T extends U ? T : never` — one distributive conditional, from lesson
   5. It runs on each endpoint name separately and keeps the ones assignable to
   `` `delete${string}` ``, which is lesson 7 supplying the pattern.

   Two features composing to answer "which of my endpoints mutate?" from the names alone,
   with nothing written down twice. */
export type MutatingEndpoint = Extract<Endpoint, `delete${string}`>

/* And `Exclude<T, U>` is the same conditional with the branches swapped:
   `T extends U ? never : T`. That is genuinely all it is — the standard library's union
   utilities are each one line, and now you can read them. */
export type ReadEndpoint = Exclude<Endpoint, MutatingEndpoint>

/* `Parameters<F>` is `F extends (...args: infer A) => unknown ? A : never` — `infer` in an
   argument-list position, giving a *tuple* including its parameter names and optionality.
   `ArgsOf<'listUsers'>` is `[page: number, size?: number | undefined]`, labels and all. */
export type ArgsOf<E extends Endpoint> = Parameters<ApiClient[E]>

/* `ReturnType` is the same shape of trick on the other side of the arrow, and `Awaited`
   peels promises recursively — the `Unwrap` you wrote in lesson 5, done properly.

   Nesting them is the useful move: `Awaited<ReturnType<F>>` is "what you actually get after
   awaiting", which is the type a caller cares about. */
export type ResultOf<E extends Endpoint> = Awaited<ReturnType<ApiClient[E]>>

/* `readonly` fields declared and then assigned in the constructor, rather than
   `constructor(readonly status: number)`. Parameter properties need code generation and
   Node's type stripping cannot do it — see `src/exercises/README.md`. Course 4 is about
   classes and says more. */
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

/* `typeof ApiError`, not `ApiError`. The class *name* used as a type means an instance; the
   constructor is a different type, and `typeof` is how you name it. Getting this backwards
   is the standard mistake with all four function utilities:

     ConstructorParameters<typeof ApiError>   →  [status: number, detail: string]
     InstanceType<typeof ApiError>            →  ApiError */
export type ApiErrorArgs = ConstructorParameters<typeof ApiError>

/* Two casts, and they are the same kind as lesson 5's.

   `client[endpoint]` is a union of the three method types, because `E` is unresolved. You
   cannot call a union of functions whose parameter lists differ — the compiler would have to
   intersect the parameters, and `string` intersected with `number` is `never`. So the
   function has to be narrowed to "something accepting exactly `ArgsOf<E>`", which is true
   for every concrete `E` and unprovable in general.

   `.apply(client, args)` rather than `client[endpoint](...args)` for the same reason, and it
   keeps `this` bound to the client — lesson 2.3's point, arriving where it matters. */
export function callEndpoint<E extends Endpoint>(
  client: ApiClient,
  endpoint: E,
  ...args: ArgsOf<E>
): Promise<ResultOf<E>> {
  const method = client[endpoint] as (...callArgs: ArgsOf<E>) => Promise<ResultOf<E>>
  return method.apply(client, args)
}

/* And the one that needs no cast, which is worth the contrast.

   `NonNullable<T>` is `T & {}` in modern TypeScript, and comparing against both `null` and
   `undefined` narrows a generic `T` to exactly that — so the `return` type-checks on its own.
   A truthiness check would not have done: it would also have dropped `0` and `''`, which are
   perfectly good non-null values. Lesson 1.8's distinction, one more time. */
export function firstDefined<T>(values: readonly T[]): NonNullable<T> | undefined {
  for (const value of values) {
    if (value !== null && value !== undefined) return value
  }

  return undefined
}

/* A rest parameter typed by `ConstructorParameters`, spread straight into `new`. If
   `ApiError`'s constructor gains a third argument, this signature follows and every caller
   is told. */
export function makeError(...args: ApiErrorArgs): ApiError {
  return new ApiError(...args)
}
