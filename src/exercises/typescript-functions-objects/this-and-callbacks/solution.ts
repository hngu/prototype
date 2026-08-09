/**
 * Reference solution: Whoever is holding the tool
 * Lesson: typescript-functions-objects/this-and-callbacks
 */

export type Handler = (this: Emitter, payload: string) => string

export interface Emitter {
  readonly name: string
  on(event: string, handler: Handler): void
  emit(event: string, payload: string): readonly string[]
}

/* Three things worth reading slowly here.

   **The closure variable.** `emitter` is referenced inside `emit`, which is defined
   in the very object literal being assigned to it. That is fine — the reference is
   only evaluated when `emit` is called, long after the assignment finished. The
   alternative is `h.call(this, payload)`, which also works, because TypeScript types
   `this` inside an object-literal method as the object's own type once
   `noImplicitThis` is on. Both are correct; the named variable is harder to misread.

   **`.call` is type-checked.** `strict` includes `strictBindCallApply`, so
   `handler.call(emitter, payload)` checks the first argument against the handler's
   declared `this` type and the rest against its parameters. Pass the wrong object and
   it is a compile error, which is what makes a `this` parameter worth declaring
   rather than just documenting.

   **`?? []`** rather than a `has` check, because `Map.get` returns
   `Handler[] | undefined` and there is nothing to distinguish "no handlers" from
   "event never registered". */
export function makeEmitter(name: string): Emitter {
  const handlers = new Map<string, Handler[]>()

  const emitter: Emitter = {
    name,

    on(event, handler) {
      const existing = handlers.get(event)
      if (existing === undefined) {
        handlers.set(event, [handler])
      } else {
        existing.push(handler)
      }
    },

    emit(event, payload) {
      return (handlers.get(event) ?? []).map((handler) => handler.call(emitter, payload))
    },
  }

  return emitter
}

/* `OmitThisParameter<Handler>` is `(payload: string) => string`. It is the right
   return type because the question the `this` parameter asked has now been answered
   — permanently — and a caller of the result should not have to think about it.

   The arrow function is doing the work. Arrows have no `this` of their own, so there
   is nothing to bind and nothing that could later be rebound; `emitter` comes from
   the closure and cannot be tampered with by a caller using `.call`. That is
   stronger than `handler.bind(emitter)`, which returns the same type and is exactly
   what `OmitThisParameter` was invented to describe. */
export function bindHandler(emitter: Emitter, handler: Handler): OmitThisParameter<Handler> {
  return (payload: string) => handler.call(emitter, payload)
}
