import * as Option from "effect/Option"
import type * as Event from "./Event.js"
import type { Handler } from "./Machine/Procedure.js"

type Aggregate<State, Events extends Event.Event.Any> = {
  readonly id: string
  readonly state: Option.Option<State>
  readonly version: number
  readonly uncommittedChanges: ReadonlyArray<Event.Event.TaggedPayload<Events>>
}

type Handler<State, Events extends Event.Event.Any> = (
  state: State,
  event: Event.Event.TaggedPayload<Events>
) => State

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

type EnsureStateAndHandlersAreCompatible<A extends AggregateBuilder.Any> = [AggregateBuilder.State<A>] extends
  [Handlers.State<AggregateBuilder.Handlers<A>>] ? A :
  `The state ${AggregateBuilder.State<A>} is not compatible with the handlers`

type AggregateReducer<State, Events extends Event.Event.Any> = {
  readonly apply: <Tag extends Events["tag"]>(
    tag: Tag,
    payload: Event.Event.Payload<Event.Event.WithTag<Events, Tag>>
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
  return {
    apply: (tag, payload) => (aggregate) => {
      const builder = aggregateBuilder as AggregateBuilder<
        AggregateBuilder.State<A>,
        AggregateBuilder.Handlers<A>
      >
      const handler = builder.handlers[tag]
      const state = aggregate.state.pipe(
        Option.getOrElse(() => builder.getInitialState())
      )
      const taggedPayload = {
        _tag: tag,
        payload
      }
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
