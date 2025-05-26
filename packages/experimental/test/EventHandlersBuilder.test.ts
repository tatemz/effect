import * as Event from "@effect/experimental/Event"
import * as EventHandlers from "@effect/experimental/EventSourcing/EventHandlers"
import * as Builder from "@effect/experimental/EventSourcing/EventHandlersBuilder"
import * as Array from "@effect/typeclass/data/Array"
import * as Monoid from "@effect/typeclass/Monoid"
import * as Semigroup from "@effect/typeclass/Semigroup"
import { describe, expect, it } from "@effect/vitest"
import { pipe } from "effect/Function"
import * as Schema from "effect/Schema"

const buildEvent = <E extends Event.Event.Any>(
  event: E,
  payload: Event.Event.Payload<E>
): Event.Event.TaggedPayload<E> =>
  ({
    _tag: event.tag,
    payload
  }) as Event.Event.TaggedPayload<E>

describe("EventHandlersBuilder", () => {
  it("should have tests", () => {
    const UserCreated = Event.make({
      tag: "UserCreated",
      primaryKey: ({ id }) => id,
      payload: Schema.Struct({
        id: Schema.String,
        name: Schema.String,
        email: Schema.String
      })
    })

    const UserRenamed = Event.make({
      tag: "UserRenamed",
      primaryKey: ({ id }) => id,
      payload: Schema.Struct({
        id: Schema.String,
        newName: Schema.String
      })
    })

    const EmailChanged = Event.make({
      tag: "EmailChanged",
      primaryKey: ({ id }) => id,
      payload: Schema.Struct({
        id: Schema.String,
        newEmail: Schema.String
      })
    })

    const UserDeactivated = Event.make({
      tag: "UserDeactivated",
      primaryKey: ({ id }) => id,
      payload: Schema.Struct({
        id: Schema.String
      })
    })

    const UserSemigroup = Semigroup.struct({
      id: Semigroup.first<string>(),
      name: Semigroup.first<string>(),
      email: Semigroup.first<string>(),
      active: Semigroup.first<boolean>()
    })

    // Helper type to extract the type from a Monoid
    type MonoidType<M> = M extends Monoid.Monoid<infer A> ? A : never

    type UserState = MonoidType<typeof UserMonoid>
    const UserMonoid = Monoid.fromSemigroup(UserSemigroup, {
      id: "",
      name: "",
      email: "",
      active: true
    })

    const userEventHandlersBuilder = pipe(
      Builder.empty<UserState>(),
      Builder.add(UserCreated, (state, { email, id, name }) => ({
        id,
        name,
        email,
        active: true
      })),
      Builder.add(UserRenamed, (state, { newName }) => ({ ...state, name: newName })),
      Builder.add(EmailChanged, (state, { newEmail }) => ({ ...state, email: newEmail })),
      Builder.add(UserDeactivated, (state) => ({ ...state, active: false }))
    )

    const userReducer1 = pipe(
      userEventHandlersBuilder,
      Builder.toReducer
    )

    const userReducer2 = pipe(
      userEventHandlersBuilder,
      Builder.build,
      EventHandlers.makeEventReducer
    )

    const initialState = UserMonoid.empty

    const userCreated = buildEvent(UserCreated, {
      id: "1",
      name: "John Doe",
      email: "john@doe.com"
    })

    const userRenamed = buildEvent(UserRenamed, {
      id: "1",
      newName: "Jane Doe"
    })

    const emailChanged = buildEvent(EmailChanged, {
      id: "1",
      newEmail: "jane@doe.com"
    })

    const userDeactivated = buildEvent(UserDeactivated, {
      id: "1"
    })

    const events = [
      userCreated,
      userRenamed,
      emailChanged,
      userDeactivated
    ] as const

    const finalState1 = Array.Foldable.reduce(events, initialState, userReducer1)
    const finalState2 = Array.Foldable.reduce(events, initialState, userReducer2)

    expect(finalState1).toStrictEqual({
      id: "1",
      name: "Jane Doe",
      email: "jane@doe.com",
      active: false
    })
    expect(finalState2).toStrictEqual(finalState1)
  })
})
