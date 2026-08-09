import assert from 'node:assert/strict'
import { test } from 'node:test'
import * as solution from './solution.ts'
import * as starter from './starter.ts'
import type { Emitter, Handler } from './solution.ts'

/**
 * Compile-time API parity, both directions, so neither file can grow, drop or
 * retype an export without tsc saying so.
 */
const _starterMatchesSolution: typeof solution = starter
const _solutionMatchesStarter: typeof starter = solution
void _starterMatchesSolution
void _solutionMatchesStarter

const subject = process.env['EXERCISE_TARGET'] === 'starter' ? starter : solution

/**
 * `ThisParameterType<Handler>` extracts the declared `this` type out of a function
 * type — here, `Emitter`. This line is a compile-time assertion that it really is
 * the emitter and not, say, `unknown`: change `Handler`'s `this` to something else
 * and it stops building.
 */
const _handlerThisIsAnEmitter: ThisParameterType<Handler> = { } as Emitter
void _handlerThisIsAnEmitter

test('a handler sees the emitter as this', () => {
  const bus = subject.makeEmitter('bus')

  bus.on('greet', function (payload) {
    // `this` is `Emitter` here with no annotation of any kind. The contextual type
    // of the parameter supplied it — which is the entire point of declaring a `this`
    // parameter on `Handler`.
    return `${this.name}: ${payload}`
  })

  assert.deepEqual(bus.emit('greet', 'hi'), ['bus: hi'])
})

test('several handlers run in registration order', () => {
  const bus = subject.makeEmitter('bus')

  bus.on('greet', function (payload) {
    return `first ${payload}`
  })
  bus.on('greet', function (payload) {
    return `second ${payload} on ${this.name}`
  })

  assert.deepEqual(bus.emit('greet', 'hi'), ['first hi', 'second hi on bus'])
})

test('events are kept apart, and an unknown event emits nothing', () => {
  const bus = subject.makeEmitter('bus')

  bus.on('a', () => 'from a')
  bus.on('b', () => 'from b')

  assert.deepEqual(bus.emit('a', 'x'), ['from a'])
  assert.deepEqual(bus.emit('b', 'x'), ['from b'])
  assert.deepEqual(bus.emit('c', 'x'), [])
})

test('two emitters do not share handlers', () => {
  const one = subject.makeEmitter('one')
  const two = subject.makeEmitter('two')

  const report: Handler = function (payload) {
    return `${this.name}/${payload}`
  }

  one.on('ping', report)
  two.on('ping', report)

  // Same function object, two different `this` values. That is what a `this`
  // parameter is for: the handler is written once and answers to whoever calls it.
  assert.deepEqual(one.emit('ping', 'x'), ['one/x'])
  assert.deepEqual(two.emit('ping', 'x'), ['two/x'])
})

test('an arrow handler is accepted, and quietly ignores this', () => {
  const bus = subject.makeEmitter('bus')

  // Legal, and worth understanding why: a function *without* a `this` parameter is
  // assignable to one that has it, because ignoring `this` is always safe. Arrows
  // capture `this` lexically, so `.call()` cannot give them the emitter — which is
  // fine as long as you did not need it.
  bus.on('greet', () => 'no this here')

  assert.deepEqual(bus.emit('greet', 'hi'), ['no this here'])

  // The opposite case, and the reason `Handler` declares a `this` parameter at all.
  // A bare function expression has no idea what `this` is:
  const orphan = function (payload: string) {
    // @ts-expect-error — `noImplicitThis`, part of `strict`: with no declared `this`
    // parameter, `this` is an implicit `any` and reading a property off it is an
    // error. Adding `this: Emitter` to the signature is what makes it legal.
    return `${this.name}: ${payload}`
  }
  void orphan
})

test('bindHandler answers the this question once and for all', () => {
  const bus = subject.makeEmitter('bus')

  const bound = subject.bindHandler(bus, function (payload) {
    return `${this.name}/${payload}`
  })

  assert.equal(bound('hi'), 'bus/hi')

  // Half the point of this test is that it COMPILES. `OmitThisParameter<Handler>` is
  // `(payload: string) => string`, so the result drops into any plain function slot —
  // no `this`, no `.call`, nothing for a caller to get wrong.
  const asPlainFunction: (payload: string) => string = bound
  assert.equal(asPlainFunction('again'), 'bus/again')

  assert.deepEqual(['a', 'b'].map(bound), ['bus/a', 'bus/b'])
})

test('a bound handler cannot be talked out of its emitter', () => {
  const bus = subject.makeEmitter('bus')
  const other = subject.makeEmitter('other')

  const bound = subject.bindHandler(bus, function (payload) {
    return `${this.name}/${payload}`
  })

  // `bound` has no `this` parameter left, so `.call` has nothing to override.
  assert.equal(bound.call(other, 'hi'), 'bus/hi')
})
