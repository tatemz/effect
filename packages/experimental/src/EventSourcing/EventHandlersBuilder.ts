/**
 * @since 2.0.0
 */
import { pipeArguments } from "effect/Pipeable"
import type * as Event from "../Event.js"
import type { EventHandlers, EventReducer } from "./EventHandlers.js"
import { makeEventReducer } from "./EventHandlers.js"

/**
 * @since 2.0.0
 * @category symbols
 */
export const TypeId: unique symbol = Symbol.for("@effect/experimental/EventSourcing/EventHandlersBuilder")

/**
 * @since 2.0.0
 * @category symbols
 */
export type TypeId = typeof TypeId

/**
 * An `EventHandlersBuilder` provides a way to construct `EventHandlers` in a type-safe manner.
 * It allows defining event handlers incrementally and ensures that all events are handled.
 *
 * @since 2.0.0
 * @category models
 */
export interface EventHandlersBuilder<State, Events extends Event.Event.Any> {
  readonly [TypeId]: [TypeId]
  readonly handlers: EventHandlers<State, Events>
}

const proto: Omit<EventHandlersBuilder<any, any>, "handlers"> = {
  [TypeId]: [TypeId],
  pipe() {
    return pipeArguments(this, arguments)
  }
}

/**
 * @since 2.0.0
 * @category modules
 */
export namespace EventHandlersBuilder {
  /**
   * Represents an `EventHandlersBuilder` with any state and events.
   *
   * @since 2.0.0
   * @category types
   */
  export type Any = EventHandlersBuilder<any, Event.Event.Any>
  /**
   * Extracts the `State` type from an `EventHandlersBuilder`.
   *
   * @since 2.0.0
   * @category types
   */
  export type StateOf<B extends Any> = B extends EventHandlersBuilder<infer S, any> ? S : never
  /**
   * Extracts the `Events` type from an `EventHandlersBuilder`.
   *
   * @since 2.0.0
   * @category types
   */
  export type EventsOf<B extends Any> = B extends EventHandlersBuilder<any, infer E> ? E : never
}

/**
 * Creates an empty `EventHandlersBuilder`.
 *
 * @example
 * import * as EventHandlersBuilder from "@effect/experimental/EventSourcing/EventHandlersBuilder"
 *
 * const builder = EventHandlersBuilder.empty<MyState>()
 *
 * @since 2.0.0
 * @category constructors
 */
export const empty = <State>(): EventHandlersBuilder<State, never> => {
  const op = Object.create(proto)
  op.handlers = {} as EventHandlers<State, never>
  return op
}

/**
 * Creates an `EventHandlersBuilder` from an existing `EventHandlers` map.
 *
 * @example
 * import * as Event from "@effect/experimental/EventSourcing/Event"
 * import * as EventHandlers from "@effect/experimental/EventSourcing/EventHandlers"
 * import * as EventHandlersBuilder from "@effect/experimental/EventSourcing/EventHandlersBuilder"
 *
 * const event1 = Event.make("Event1")<{ value: number }>()
 * type MyState = { count: number }
 *
 * const handlers: EventHandlers.EventHandlers<MyState, typeof event1.Type> = {
 *  Event1: (state, event) => ({ ...state, count: state.count + event.value })
 * }
 * const builder = EventHandlersBuilder.fromHandlers(handlers)
 *
 * @since 2.0.0
 * @category constructors
 */
export const fromHandlers = <H extends EventHandlers.Any>(
  handlers: H
): EventHandlersBuilder<EventHandlers.State<H>, EventHandlers.Events<H>> => {
  const op = Object.create(proto)
  op.handlers = handlers
  return op
}

/**
 * Adds an event handler to the `EventHandlersBuilder`.
 *
 * @example
 * import * as Event from "@effect/experimental/EventSourcing/Event"
 * import * as EventHandlersBuilder from "@effect/experimental/EventSourcing/EventHandlersBuilder"
 *
 * const event1 = Event.make("Event1")<{ value: number }>()
 * type MyState = { count: number }
 *
 * const builder = EventHandlersBuilder.empty<MyState>()
 *   .pipe(EventHandlersBuilder.add(event1, (state, payload) => ({ ...state, count: state.count + payload.value })))
 *
 * @since 2.0.0
 * @category combinators
 */
export const add = <State, E extends Event.Event.Any>(
  event: E,
  handler: (state: State, payload: Event.Event.Payload<E>) => State
) =>
<Events extends Event.Event.Any>(
  self: EventHandlersBuilder<State, Events>
): EventHandlersBuilder<State, Events | E> => {
  const op = Object.create(proto)
  op.handlers = {
    ...self.handlers,
    [event.tag]: (state: State, taggedPayload: Event.Event.TaggedPayload<E>) => handler(state, taggedPayload.payload)
  } as EventHandlers<State, Events | E>
  return op
}

/**
 * Combines two `EventHandlersBuilder` instances.
 * If both builders handle the same event, the handler from `that` builder will overwrite the one from `self`.
 *
 * @example
 * import * as Event from "@effect/experimental/EventSourcing/Event"
 * import * as EventHandlersBuilder from "@effect/experimental/EventSourcing/EventHandlersBuilder"
 *
 * const event1 = Event.make("Event1")<{ value: number }>()
 * const event2 = Event.make("Event2")<{ text: string }>()
 * type MyState = { count: number, message: string }
 *
 * const builder1 = EventHandlersBuilder.empty<MyState>()
 *   .pipe(EventHandlersBuilder.add(event1, (state, payload) => ({ ...state, count: state.count + payload.value })))
 *
 * const builder2 = EventHandlersBuilder.empty<MyState>()
 *   .pipe(EventHandlersBuilder.add(event2, (state, payload) => ({ ...state, message: payload.text })))
 *
 * const combinedBuilder = builder1.pipe(EventHandlersBuilder.combine(builder2))
 *
 * @since 2.0.0
 * @category combinators
 */
export const combine = <State, Events2 extends Event.Event.Any>(
  that: EventHandlersBuilder<State, Events2>
) =>
<Events1 extends Event.Event.Any>(
  self: EventHandlersBuilder<State, Events1>
): EventHandlersBuilder<State, Events1 | Events2> => {
  const op = Object.create(proto)
  op.handlers = {
    ...self.handlers,
    ...that.handlers
  } as EventHandlers<State, Events1 | Events2>
  return op
}

/**
 * Builds the `EventHandlers` map from the `EventHandlersBuilder`.
 *
 * @since 2.0.0
 * @category utils
 */
export const build = <State, Events extends Event.Event.Any>(
  self: EventHandlersBuilder<State, Events>
): EventHandlers<State, Events> => self.handlers

/**
 * Builds an `EventReducer` from the `EventHandlersBuilder`.
 * This is a convenience function that first builds the `EventHandlers` and then creates an `EventReducer`.
 *
 * @since 2.0.0
 * @category utils
 */
export const toReducer = <State, Events extends Event.Event.Any>(
  self: EventHandlersBuilder<State, Events>
): EventReducer<State, Events> => makeEventReducer(self.handlers)
