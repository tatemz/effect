import * as Aggregate from "../src/Aggregate.ts"
import * as Event from "@effect/experimental/Event"
import * as Schema from "@effect/schema/Schema"
import { describe, it, expect } from "vitest"

// Define a sample event type
const UserCreated = Event.make<"UserCreated", { userId: Schema.String, name: Schema.String }>("UserCreated")({
  userId: Schema.String,
  name: Schema.String
})

// Define a sample state interface
interface UserState {
  readonly userId: string
  readonly name: string
  readonly status: string
}

describe("Aggregate", () => {
  it("should allow creation of a valid Aggregate object", () => {
    // Create a sample UserCreated event instance
    const userCreatedEvent = UserCreated({ userId: "user-123", name: "John Doe" })

    // Create an object that conforms to Aggregate<UserState, ReturnType<typeof UserCreated>>
    const aggregate: Aggregate.Aggregate<UserState, typeof UserCreated> = {
      id: "aggregate-1",
      version: 1,
      uncommittedChanges: [userCreatedEvent],
      state: {
        userId: "user-123",
        name: "John Doe",
        status: "active"
      }
    }

    // Basic assertion
    expect(aggregate.id).toBe("aggregate-1")
    expect(aggregate.version).toBe(1)
    expect(aggregate.uncommittedChanges).toEqual([userCreatedEvent])
    expect(aggregate.state.status).toBe("active")
  })
})
