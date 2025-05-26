import * as Event from "@effect/experimental/Event"
import * as EventHandlers from "@effect/experimental/EventSourcing/EventHandlers"
import * as Builder from "@effect/experimental/EventSourcing/EventHandlersBuilder"
import * as Array from "@effect/typeclass/data/Array"
import * as Monoid from "@effect/typeclass/Monoid"
import * as Semigroup from "@effect/typeclass/Semigroup"
import { describe, expect, it } from "@effect/vitest"
import { pipe } from "effect/Function"
import * as Schema from "effect/Schema"

describe("EventHandlersBuilder", () => {
  // Static Setup: Event definitions, Monoid/Semigroup, and buildEvent helper
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

  type MonoidType<M> = M extends Monoid.Monoid<infer A> ? A : never

  const UserMonoid = Monoid.fromSemigroup(UserSemigroup, {
    id: "",
    name: "",
    email: "",
    active: true
  })
  type UserState = MonoidType<typeof UserMonoid>

  const buildEvent = <E extends Event.Event.Any>(
    event: E,
    payload: Event.Event.Payload<E>
  ): Event.Event.TaggedPayload<E> =>
    ({
      _tag: event.tag,
      payload
    }) as Event.Event.TaggedPayload<E>

  // Integration Test
  it("toReducer should create a reducer that correctly processes a sequence of events", () => {
    const initialState = UserMonoid.empty

    const userEventHandlersBuilder = pipe(
      Builder.empty<UserState>(),
      Builder.add(UserCreated, (_state, { email, id, name }) => ({
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

    const userCreatedEvent = buildEvent(UserCreated, {
      id: "1",
      name: "John Doe",
      email: "john@doe.com"
    })

    const userRenamedEvent = buildEvent(UserRenamed, {
      id: "1",
      newName: "Jane Doe"
    })

    const emailChangedEvent = buildEvent(EmailChanged, {
      id: "1",
      newEmail: "jane@doe.com"
    })

    const userDeactivatedEvent = buildEvent(UserDeactivated, {
      id: "1"
    })

    const events = [
      userCreatedEvent,
      userRenamedEvent,
      emailChangedEvent,
      userDeactivatedEvent
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

  // Focused Test Cases
  describe("empty", () => {
    it("should create a builder with no handlers", () => {
      const builder = Builder.empty<UserState>()
      expect(builder.handlers).toStrictEqual({})
    })
  })

  describe("add", () => {
    it("should correctly add a new event handler", () => {
      const builder = pipe(
        Builder.empty<UserState>(),
        Builder.add(UserCreated, (_state, _payload) => UserMonoid.empty)
      )
      expect(builder.handlers[UserCreated.tag]).toBeDefined()
      expect(typeof builder.handlers[UserCreated.tag]).toBe("function")
    })

    it("should create a handler that correctly transforms state", () => {
      const builder = pipe(
        Builder.empty<UserState>(),
        Builder.add(UserCreated, (_state, { email, id, name }) => ({
          id,
          name,
          email,
          active: true
        }))
      )
      const handler = builder.handlers[UserCreated.tag]
      const initialState = UserMonoid.empty
      const userCreatedPayload = { id: "test", name: "Test User", email: "test@example.com" }
      const userCreatedEvent = buildEvent(UserCreated, userCreatedPayload)

      const newState = handler(initialState, userCreatedEvent)
      expect(newState).toStrictEqual({
        id: "test",
        name: "Test User",
        email: "test@example.com",
        active: true
      })
    })
  })

  describe("combine", () => {
    it("should merge handlers from two builders", () => {
      const builder1 = pipe(
        Builder.empty<UserState>(),
        Builder.add(UserCreated, (_state, _payload) => UserMonoid.empty)
      )
      const builder2 = pipe(
        Builder.empty<UserState>(),
        Builder.add(UserRenamed, (_state, _payload) => UserMonoid.empty)
      )

      const combinedBuilder = pipe(builder1, Builder.combine(builder2))

      expect(combinedBuilder.handlers[UserCreated.tag]).toBeDefined()
      expect(combinedBuilder.handlers[UserRenamed.tag]).toBeDefined()
    })

    it("should overwrite handlers from the first builder if tags conflict", () => {
      const handler1 = (_state: UserState, _payload: typeof UserCreated.Type["payload"]) => ({
        ...UserMonoid.empty,
        name: "Handler1"
      })
      const handler2 = (_state: UserState, _payload: typeof UserCreated.Type["payload"]) => ({
        ...UserMonoid.empty,
        name: "Handler2"
      })

      const builder1 = pipe(Builder.empty<UserState>(), Builder.add(UserCreated, handler1))
      const builder2 = pipe(Builder.empty<UserState>(), Builder.add(UserCreated, handler2))

      const combinedBuilder = pipe(builder1, Builder.combine(builder2))
      const finalHandler = combinedBuilder.handlers[UserCreated.tag]

      const initialState = UserMonoid.empty
      const eventPayload = { id: "conflict", name: "Test", email: "conflict@example.com" }
      const testEvent = buildEvent(UserCreated, eventPayload)
      const state = finalHandler(initialState, testEvent)

      expect(state.name).toBe("Handler2") // Handler from builder2 should overwrite
    })
  })

  describe("build", () => {
    it("should return the underlying handlers object", () => {
      const builder = pipe(
        Builder.empty<UserState>(),
        Builder.add(UserCreated, (_state, _payload) => UserMonoid.empty)
      )
      const handlers = Builder.build(builder)
      expect(handlers).toBe(builder.handlers)
    })
  })

  describe("fromHandlers", () => {
    it("should create a builder from an existing handlers object", () => {
      const existingHandlers: EventHandlers.EventHandlers<UserState, typeof UserCreated.Type> = {
        [UserCreated.tag]: (_state, { email, id, name }) => ({
          id,
          name,
          email,
          active: true
        })
      }
      const builder = Builder.fromHandlers(existingHandlers)
      expect(builder.handlers).toBe(existingHandlers)
      expect(builder.handlers[UserCreated.tag]).toBeDefined()
    })
  })
})
