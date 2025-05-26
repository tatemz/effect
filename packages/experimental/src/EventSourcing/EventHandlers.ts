import type * as Event from "../Event.js"

export type EventReducer<State, Events extends Event.Event.Any> = <E extends Event.Event.TaggedPayload<Events>>(
  state: State,
  payload: E
) => State

export namespace EventReducer {
  export type Any = EventReducer<any, Event.Event.Any>
  export type State<R extends Any> = R extends EventReducer<infer S, Event.Event.Any> ? S : never
  export type Events<R extends Any> = R extends EventReducer<any, infer E> ? E : never
}

export type EventHandlers<State, Events extends Event.Event.Any> = {
  readonly [K in Event.Event.Tag<Events>]: EventReducer<State, Extract<Events, { tag: K }>>
}

export namespace EventHandlers {
  export type Any = EventHandlers<any, Event.Event.Any>
  export type State<H extends Any> = H extends EventHandlers<infer S, any> ? S : never
  export type Events<H extends Any> = H extends EventHandlers<any, infer E> ? E : never
}

export const makeEventReducer = <State, Events extends Event.Event.Any>(
  handlers: EventHandlers<State, Events>
): EventReducer<State, Events> =>
<E extends Events>(state: State, event: Event.Event.TaggedPayload<E>) => {
  const tag = event._tag as Event.Event.Tag<E>
  const handler = handlers[tag] as EventReducer<State, E>
  return handler(state, event)
}
