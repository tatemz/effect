import * as Aggregate from "@effect/experimental/Aggregate"
import { describe, expect, it } from "@effect/vitest"
import { pipe } from "effect/Function"
import * as Option from "effect/Option"

describe("Aggregate", () => {
  it("should create an aggregate with initial state and apply handlers", () => {
    const aggregateBuilder = pipe(
      Aggregate.empty,
      Aggregate.withInitialState(() => 0),
      Aggregate.withHandlers({
        increment: (state: number, payload: { value: number }) => state + payload.value,
        decrement: (state: number, payload: { value: number }) => state - payload.value
      })
    )

    const aggregateReducer = Aggregate.build(aggregateBuilder)
    const initialAggregate = {
      id: "test-aggregate",
      version: 0,
      state: Option.none(),
      uncommittedChanges: []
    }

    const incrementByFive = aggregateReducer.apply("increment", {
      value: 5
    })

    const newAggregate = incrementByFive(initialAggregate)

    expect(newAggregate.state).toStrictEqual(Option.some(5))
  })
})
