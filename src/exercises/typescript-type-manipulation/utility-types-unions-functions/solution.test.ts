import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { Equals, Expect } from '../../tools/type-assert.ts'
import * as solution from './solution.ts'
import * as starter from './starter.ts'
import type {
  ApiClient,
  ApiErrorArgs,
  ArgsOf,
  Endpoint,
  MutatingEndpoint,
  ReadEndpoint,
  ResultOf,
  User,
} from './solution.ts'

/**
 * Compile-time API parity, both directions, so neither file can grow, drop or
 * retype an export without tsc saying so.
 */
const _starterMatchesSolution: typeof solution = starter
const _solutionMatchesStarter: typeof starter = solution
void _starterMatchesSolution
void _solutionMatchesStarter

const subject = process.env['EXERCISE_TARGET'] === 'starter' ? starter : solution

/* ── The derived types, asserted directly ─────────────────────────────────────── */

type _endpoint = Expect<Equals<Endpoint, 'getUser' | 'listUsers' | 'deleteUser'>>
type _mutating = Expect<Equals<MutatingEndpoint, 'deleteUser'>>
type _read = Expect<Equals<ReadEndpoint, 'getUser' | 'listUsers'>>

/* `Parameters` gives a tuple, keeping the labels and the optionality. */
type _getArgs = Expect<Equals<ArgsOf<'getUser'>, [id: string]>>
type _listArgs = Expect<Equals<ArgsOf<'listUsers'>, [page: number, size?: number | undefined]>>

/* `Awaited<ReturnType<F>>` is what a caller gets after awaiting — the useful nesting. */
type _getResult = Expect<Equals<ResultOf<'getUser'>, User>>
type _listResult = Expect<Equals<ResultOf<'listUsers'>, readonly User[]>>
type _deleteResult = Expect<Equals<ResultOf<'deleteUser'>, void>>

/* Without `Awaited`, the result would still be wrapped. Pinning the difference. */
type _stillAPromise = Expect<Equals<ReturnType<ApiClient['getUser']>, Promise<User>>>

/* `typeof ApiError`, not `ApiError` — the constructor, not an instance. */
type _ctorArgs = Expect<Equals<ApiErrorArgs, [status: number, detail: string]>>
type _instance = Expect<Equals<InstanceType<typeof solution.ApiError>, solution.ApiError>>

/* The union utilities, on their own. */
type _nonNullable = Expect<Equals<NonNullable<string | null | undefined>, string>>
type _excludeDistributes = Expect<Equals<Exclude<'a' | 'b' | 'c', 'b'>, 'a' | 'c'>>
type _extractDistributes = Expect<Equals<Extract<'a' | 1 | 'b', string>, 'a' | 'b'>>

/* ── Runtime ──────────────────────────────────────────────────────────────────── */

const users: readonly User[] = [
  { id: 'u1', name: 'ada' },
  { id: 'u2', name: 'grace' },
]

function makeClient(): ApiClient & { readonly calls: string[] } {
  const calls: string[] = []

  return {
    calls,

    async getUser(id) {
      calls.push(`getUser(${id})`)
      return users.find((user) => user.id === id) ?? { id, name: 'unknown' }
    },

    async listUsers(page, size = 10) {
      calls.push(`listUsers(${page},${size})`)
      return users.slice(page * size, page * size + size)
    },

    async deleteUser(id) {
      calls.push(`deleteUser(${id})`)
    },
  }
}

test('callEndpoint calls the named method', async () => {
  const client = makeClient()

  assert.deepEqual(await subject.callEndpoint(client, 'getUser', 'u1'), { id: 'u1', name: 'ada' })
  assert.deepEqual(await subject.callEndpoint(client, 'listUsers', 0), users)
  assert.equal(await subject.callEndpoint(client, 'deleteUser', 'u2'), undefined)

  assert.deepEqual(client.calls, ['getUser(u1)', 'listUsers(0,10)', 'deleteUser(u2)'])
})

test('callEndpoint passes optional arguments through', async () => {
  const client = makeClient()

  assert.deepEqual(await subject.callEndpoint(client, 'listUsers', 0, 1), [users[0]])
  assert.deepEqual(client.calls, ['listUsers(0,1)'])
})

test('callEndpoint keeps this bound to the client', async () => {
  // `.apply(client, args)` rather than pulling the function out and calling it bare. A
  // method that reads `this` would break otherwise — and `calls` above is only populated
  // because the closure captured it, so here is a client that genuinely uses `this`.
  const client: ApiClient & { readonly seen: string[] } = {
    seen: [],
    async getUser(id) {
      this.seen.push(id)
      return { id, name: 'via this' }
    },
    async listUsers() {
      return []
    },
    async deleteUser() {},
  }

  await subject.callEndpoint(client, 'getUser', 'u9')
  assert.deepEqual(client.seen, ['u9'])
})

test('callEndpoint checks arguments against the endpoint it was given', async () => {
  const client = makeClient()

  /* Compile-time assertions only, and deliberately never invoked: `@ts-expect-error`
     silences the *type* error and the call would still run, and `'patchUser'` would throw.
     The point is that the compiler stops you before any of this can happen. */
  const rejected = async (): Promise<void> => {
    // @ts-expect-error — `getUser` takes a string, not a number.
    await subject.callEndpoint(client, 'getUser', 42)

    // @ts-expect-error — and `listUsers` takes a number, not a string.
    await subject.callEndpoint(client, 'listUsers', 'first')

    // @ts-expect-error — too many arguments for `getUser`.
    await subject.callEndpoint(client, 'getUser', 'u1', 2)

    // @ts-expect-error — and an endpoint that does not exist.
    await subject.callEndpoint(client, 'patchUser', 'u1')
  }
  void rejected

  // The correct call, which does run.
  assert.deepEqual(await subject.callEndpoint(client, 'getUser', 'u1'), { id: 'u1', name: 'ada' })
})

test('callEndpoint returns the right result type for each endpoint', async () => {
  const client = makeClient()

  // Half the point of this test is that it COMPILES. Three different result types from
  // one signature, each derived rather than declared.
  const user = await subject.callEndpoint(client, 'getUser', 'u1')
  type _user = Expect<Equals<typeof user, User>>
  assert.equal(user.name, 'ada')

  const list = await subject.callEndpoint(client, 'listUsers', 0)
  type _list = Expect<Equals<typeof list, readonly User[]>>
  assert.equal(list.length, 2)

  // @ts-expect-error — `.name` is on a `User`, not on a list of them.
  void list.name
})

test('firstDefined skips null and undefined, and nothing else', () => {
  assert.equal(subject.firstDefined([null, undefined, 'ada', 'grace']), 'ada')
  assert.equal(subject.firstDefined([undefined, null]), undefined)
  assert.equal(subject.firstDefined([]), undefined)

  // The falsy values that a truthiness check would have wrongly skipped. `0` and `''` are
  // perfectly good non-null values.
  assert.equal(subject.firstDefined([null, 0, 1]), 0)
  assert.equal(subject.firstDefined([undefined, '', 'a']), '')
  assert.equal(subject.firstDefined([null, false, true]), false)
})

test('firstDefined removes the nullish part of the type', () => {
  // Compile-only. `.toUpperCase()` is available after one `!== undefined` check rather than
  // two, because `NonNullable<T>` already took `null` out.
  const found = subject.firstDefined<string | null>([null, 'ada'])
  type _found = Expect<Equals<typeof found, string | undefined>>

  assert.ok(found !== undefined)
  assert.equal(found.toUpperCase(), 'ADA')
})

test('makeError builds from its own constructor arguments', () => {
  const error = subject.makeError(404, 'not found')

  assert.ok(error instanceof solution.ApiError)
  assert.equal(error.status, 404)
  assert.equal(error.detail, 'not found')
  assert.equal(String(error), '404: not found')

  // @ts-expect-error — the tuple came from the constructor, so a wrong argument type is
  // caught here and would follow a change to the constructor automatically.
  subject.makeError('404', 'not found')

  // @ts-expect-error — and a missing argument.
  subject.makeError(404)
})
