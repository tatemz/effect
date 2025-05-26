import { pipeArguments } from "effect/Pipeable"
import type * as Event from "../Event.js"
import type { EventHandlers, EventReducer } from "./EventHandlers.js"
import { makeEventReducer } from "./EventHandlers.js"

export const TypeId: unique symbol = Symbol.for("@effect/experimental/EventSourcing/EventHandlersBuilder")

export type TypeId = typeof TypeId

export interface EventHandlersBuilder<State, Events extends Event.Event.Any> {
  readonly [TypeId]: [TypeId]
  readonly handlers: EventHandlers<State, Events>
}

const proto = {
  [TypeId]: TypeId,
  pipe() {
    return pipeArguments(this, arguments)
  }
}

export namespace EventHandlersBuilder {
  export type Any = EventHandlersBuilder<any, Event.Event.Any>
  export type StateOf<B extends Any> = B extends EventHandlersBuilder<infer S, any> ? S : never
  export type EventsOf<B extends Any> = B extends EventHandlersBuilder<any, infer E> ? E : never
}

export const empty = <State>(): EventHandlersBuilder<State, never> => {
  const op = Object.create(proto)
  op.handlers = {} as EventHandlers<State, never>
  return op
}

export const fromHandlers = <H extends EventHandlers.Any>(
  handlers: H
): EventHandlersBuilder<EventHandlers.State<H>, EventHandlers.Events<H>> => {
  const op = Object.create(proto)
  op.handlers = handlers
  return op
}

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

export const build = <State, Events extends Event.Event.Any>(
  self: EventHandlersBuilder<State, Events>
): EventHandlers<State, Events> => self.handlers

export const toReducer = <State, Events extends Event.Event.Any>(
  self: EventHandlersBuilder<State, Events>
): EventReducer<State, Events> => makeEventReducer(self.handlers)
