/**
 * @since 2.0.0
 */
import type * as Event from "../Event.js"

/**
 * @since 2.0.0
 * @category types
 */
export type EventReducer<State, Events extends Event.Event.Any> = <E extends Event.Event.TaggedPayload<Events>>(
  state: State,
  payload: E
) => State

/**
 * @since 2.0.0
 * @category modules
 */
export namespace EventReducer {
  /**
   * @since 2.0.0
   * @category types
   */
  export type Any = EventReducer<any, Event.Event.Any>
  /**
   * @since 2.0.0
   * @category types
   */
  export type State<R extends Any> = R extends EventReducer<infer S, Event.Event.Any> ? S : never
  /**
   * @since 2.0.0
   * @category types
   */
  export type Events<R extends Any> = R extends EventReducer<any, infer E> ? E : never
}

/**
 * @since 2.0.0
 * @category types
 */
export type EventHandlers<State, Events extends Event.Event.Any> = {
  readonly [K in Event.Event.Tag<Events>]: EventReducer<State, Extract<Events, { tag: K }>>
}

/**
 * @since 2.0.0
 * @category modules
 */
export namespace EventHandlers {
  /**
   * @since 2.0.0
   * @category types
   */
  export type Any = EventHandlers<any, Event.Event.Any>
  /**
   * @since 2.0.0
   * @category types
   */
  export type State<H extends Any> = H extends EventHandlers<infer S, any> ? S : never
  /**
   * @since 2.0.0
   * @category types
   */
  export type Events<H extends Any> = H extends EventHandlers<any, infer E> ? E : never
}

/**
 * Creates an `EventReducer` from a map of `EventHandlers`.
 *
 * This function takes an object where keys are event tags and values are reducers for those events,
 * and returns a single reducer function that can process any of the specified events.
 *
 * @example
 * import * as Event from "@effect/experimental/EventSourcing/Event"
 * import * as EventHandlers from "@effect/experimental/EventSourcing/EventHandlers"
 *
 * // Define some events
 * const event1 = Event.make("Event1")<{ value: number }>()
 * const event2 = Event.make("Event2")<{ text: string }>()
 * type MyEvents = typeof event1.Type | typeof event2.Type
 *
 * // Define the state
 * type MyState = { count: number; message: string }
 * const initialState: MyState = { count: 0, message: "" }
 *
 * // Define handlers for each event
 * const handlers: EventHandlers.EventHandlers<MyState, MyEvents> = {
 *   Event1: (state, event) => ({ ...state, count: state.count + event.value }),
 *   Event2: (state, event) => ({ ...state, message: event.text })
 * }
 *
 * // Create the aggregate event reducer
 * const reducer = EventHandlers.makeEventReducer(handlers)
 *
 * // Usage
 * let state = initialState
 * state = reducer(state, event1({ value: 10 }))
 * state = reducer(state, event2({ text: "hello" }))
 *
 * @since 2.0.0
 * @category constructors
 */
export const makeEventReducer = <State, Events extends Event.Event.Any>(
  handlers: EventHandlers<State, Events>
): EventReducer<State, Events> =>
<E extends Events>(state: State, event: Event.Event.TaggedPayload<E>) => {
  // The `_tag` property is asserted here. This is generally safe in practice
  // for tagged unions when the `event` parameter is constrained by `Events`.
  const tag = event._tag as Event.Event.Tag<E>
  const handler = handlers[tag] as EventReducer<State, E>
  return handler(state, event)
}
