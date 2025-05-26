import * as Option from "effect/Option"
import type * as Event from "./Event.js"

export type Aggregate<State, Events extends Event.Event.Any> = {
  readonly id: string
  readonly state: Option.Option<State>
  readonly version: number
  readonly uncommittedChanges: ReadonlyArray<Event.Event.TaggedPayload<Events>>
}

type Handler<State, Events extends Event.Event.Any> = (
  state: State,
  event: Event.Event.TaggedPayload<Events>
) => State

namespace Handler {
  export type Any = Handler<any, Event.Event.Any>
  export type State<H extends Any> = H extends Handler<infer S, Event.Event.Any> ? S : never
  export type Event<H extends Any> = H extends Handler<any, infer E> ? E : never
}

type Handlers<State, Events extends Event.Event.Any> = {
  [K in Events as K["tag"]]: Handler<State, K>
}

namespace Handlers {
  export type Any = Handlers<any, Event.Event.Any>
  export type State<H extends Any> = H extends Handlers<infer S, Event.Event.Any> ? S : never
  export type Event<H extends Any> = H extends Handlers<any, infer E> ? E : never
}

type AggregateBuilder<State, H extends Handlers.Any> = {
  readonly getInitialState: () => State
  readonly handlers: H
}

export namespace AggregateBuilder {
  export type Any = AggregateBuilder<any, Handlers.Any>
  export type State<A extends Any> = A extends AggregateBuilder<infer S, Handlers.Any> ? S : never
  export type Handlers<A extends Any> = A extends AggregateBuilder<any, infer H> ? H : never
  export type Events<A extends Any> = Handlers.Event<AggregateBuilder.Handlers<A>>
}

const AggregateBuilderProto: AggregateBuilder.Any = {
  getInitialState: () => undefined,
  handlers: {}
}

function makeAggregateBuilder<State, H extends Handlers.Any>(
  options: {
    getInitialState: () => State
    handlers: H
  }
): AggregateBuilder<State, H> {
  const builder = Object.create(AggregateBuilderProto)
  builder.getInitialState = options.getInitialState
  builder.handlers = options.handlers
  return builder as AggregateBuilder<State, H>
}

export const empty = makeAggregateBuilder<unknown, Handlers.Any>({
  getInitialState: () => undefined as unknown,
  handlers: {}
})

export const withInitialState = <State>(getInitialState: () => State) =>
<A extends AggregateBuilder.Any>(
  aggregateBuilder: A
): AggregateBuilder<State, AggregateBuilder.Handlers<A>> => {
  const builder = Object.create(AggregateBuilderProto)
  builder.getInitialState = getInitialState
  builder.handlers = aggregateBuilder.handlers
  return builder as AggregateBuilder<State, AggregateBuilder.Handlers<A>>
}

export const withHandlers = <H extends Handlers.Any>(
  handlers: H
) =>
<A extends AggregateBuilder.Any>(
  aggregateBuilder: A
): AggregateBuilder<AggregateBuilder.State<A>, H> => {
  const builder = Object.create(AggregateBuilderProto)
  builder.getInitialState = aggregateBuilder.getInitialState
  builder.handlers = handlers
  return builder as AggregateBuilder<AggregateBuilder.State<A>, H>
}

export const addHandler = <State, E extends Event.Event.Any>(
  event: E,
  handler: Handler<State, E>
) =>
<A extends AggregateBuilder.Any>(
  aggregateBuilder: A
): AggregateBuilder<
  AggregateBuilder.State<A>,
  AggregateBuilder.Handlers<A> & { [K in E["tag"]]: Handler<AggregateBuilder.State<A>, E> }
> => {
  const builder = Object.create(AggregateBuilderProto)
  builder.getInitialState = aggregateBuilder.getInitialState
  builder.handlers = {
    ...aggregateBuilder.handlers,
    [event.tag]: handler
  }
  return builder
}

type EnsureStateAndHandlersAreCompatible<A extends AggregateBuilder.Any> = [AggregateBuilder.State<A>] extends
  [Handlers.State<AggregateBuilder.Handlers<A>>] ? A :
  `The state ${AggregateBuilder.State<A>} is not compatible with the handlers`

type AggregateReducer<State, Events extends Event.Event.Any> = {
  readonly apply: <E extends Events>(
    event: E,
    payload: Event.Event.Payload<E>
  ) => (aggregate: Aggregate<State, Events>) => Aggregate<State, Events>
}

namespace AggregateReducer {
  export type FromAggregateBuilder<A extends AggregateBuilder.Any> = AggregateReducer<
    AggregateBuilder.State<A>,
    AggregateBuilder.Events<A>
  >
}

export const build = <A extends AggregateBuilder.Any>(
  aggregateBuilder: EnsureStateAndHandlersAreCompatible<A>
): AggregateReducer.FromAggregateBuilder<A> => {
  type S = AggregateBuilder.State<A>
  type H = AggregateBuilder.Handlers<A>

  return {
    apply: <E extends AggregateBuilder.Events<A>>(
      event: E,
      payload: Event.Event.Payload<E>
    ) =>
    (aggregate) => {
      const builder = aggregateBuilder as AggregateBuilder<S, H>
      const handler = builder.handlers[event.tag] as Handler<S, E>

      const state = aggregate.state.pipe(
        Option.getOrElse(() => builder.getInitialState())
      )

      const taggedPayload = { _tag: event.tag, payload } as Event.Event.TaggedPayload<E>
      const newState = handler(state, taggedPayload)

      return {
        id: aggregate.id,
        state: Option.some(newState),
        version: aggregate.version + 1,
        uncommittedChanges: [...aggregate.uncommittedChanges, taggedPayload]
      }
    }
  }
}
