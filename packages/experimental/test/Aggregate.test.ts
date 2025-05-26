import * as Aggregate from "@effect/experimental/Aggregate"
import * as Event from "@effect/experimental/Event"
import { describe, expect, it } from "@effect/vitest"
import { pipe } from "effect/Function"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"

describe("Aggregate", () => {
  it("should create an aggregate with initial state and apply handlers", () => {
    const Increment = Event.make({
      tag: "increment",
      payload: Schema.Number,
      primaryKey: () => "1"
    })

    const Decrement = Event.make({
      tag: "decrement",
      payload: Schema.Number,
      primaryKey: () => "1"
    })

    // Define handlers that match the expected signature
    const handlers = {
      [Increment.tag]: (state: number, { payload }: Event.Event.TaggedPayload<typeof Increment>) => state + payload
    }

    const aggregateBuilder = pipe(
      Aggregate.empty,
      Aggregate.withInitialState(() => 0),
      Aggregate.withHandlers(handlers),
      Aggregate.addHandler(Decrement, (state: number, { payload }) => {
        return state - payload
      })
    )

    const aggregateReducer = Aggregate.build(aggregateBuilder)
    const initialAggregate: Aggregate.Aggregate<number, typeof Increment | typeof Decrement> = {
      id: "test-aggregate",
      version: 0,
      state: Option.none(),
      uncommittedChanges: []
    }

    const withIcrementByTwo = aggregateReducer.apply(Increment, 2)
    const withDerementByOne = aggregateReducer.apply(Decrement, 1)

    const incrementedAggregate = withIcrementByTwo(initialAggregate)
    expect(incrementedAggregate.state).toStrictEqual(Option.some(2))
    expect(incrementedAggregate.version).toBe(1)
    expect(incrementedAggregate.uncommittedChanges).toHaveLength(1)
    expect(incrementedAggregate.uncommittedChanges[0]).toStrictEqual(
      {
        "_tag": "increment",
        "payload": 2
      }
    )

    const decrementedAggregate = withDerementByOne(incrementedAggregate)
    expect(decrementedAggregate.state).toStrictEqual(Option.some(1))
    expect(decrementedAggregate.version).toBe(2)
    expect(decrementedAggregate.uncommittedChanges).toHaveLength(2)
    expect(decrementedAggregate.uncommittedChanges[1]).toStrictEqual(
      {
        "_tag": "decrement",
        "payload": 1
      }
    )
  })
})
