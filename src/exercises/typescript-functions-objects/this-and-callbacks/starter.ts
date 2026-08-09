/**
 * Exercise: Whoever is holding the tool
 * Lesson:   typescript-functions-objects/this-and-callbacks
 *
 * Replace every `throw new Error('TODO: …')` with a real implementation.
 *
 * The interesting type in this file is the first one. `this: Emitter` is a
 * *parameter* as far as TypeScript is concerned — it must come first, it is erased
 * completely, and it does not take up an argument slot at the call site.
 */

/** A handler called with `this` bound to the emitter it was registered on. */
export type Handler = (this: Emitter, payload: string) => string

export interface Emitter {
  readonly name: string
  /** Registers a handler for `event`. Several may share one event. */
  on(event: string, handler: Handler): void
  /** Calls every handler for `event`, in registration order, and collects results. */
  emit(event: string, payload: string): readonly string[]
}

/**
 * Builds an emitter whose handlers see it as `this`.
 *
 *   const bus = makeEmitter('bus')
 *   bus.on('greet', function (payload) { return `${this.name}: ${payload}` })
 *   bus.emit('greet', 'hi')   →  ['bus: hi']
 *
 * An unknown event emits nothing and returns `[]`.
 */
export function makeEmitter(name: string): Emitter {
  throw new Error('TODO: keep handlers per event, and call them with the emitter as this')
}

/**
 * Ties a handler to an emitter up front, giving back a plain function.
 *
 * `OmitThisParameter<Handler>` is `(payload: string) => string` — the same
 * signature with the `this` requirement stripped off, because it has been answered.
 */
export function bindHandler(emitter: Emitter, handler: Handler): OmitThisParameter<Handler> {
  throw new Error('TODO: return a function that no longer needs a this')
}
