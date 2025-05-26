import { describe, it, expect } from "vitest";
import * as Event from "../src/Event.js"; // Adjust path as needed, using .js
import { TypeId as EventTypeId } from "../src/Event.js"; // Import TypeId
import * as S from "effect/Schema"; // Import as namespace S
import { pipe } from "effect/Function";
import {
  empty,
  handleEvent,
  withInitialState,
  build,
  isAggregateReducerBuilder, // Add import for the type guard
  // AggregateReducerBuilder type can be imported if needed for explicit typing, but not for instantiation
  type AggregateReducerBuilder // Import the type for type annotations if necessary
} from "../src/AggregateReducerBuilder.js"; // Adjust path as needed, using .js

// Define sample events
const EventA = Event.make({
  tag: "EventA",
  payload: S.Struct({ value: S.Number }),
  primaryKey: (_) => "key"
});
// EventAInstance defines the structure of an actual event instance
type EventAInstance = { readonly [EventTypeId]: typeof EventTypeId; readonly tag: "EventA"; readonly payload: S.Schema.Type<typeof EventA.payload> };

const EventB = Event.make({
  tag: "EventB",
  payload: S.Struct({ text: S.String }),
  primaryKey: (_) => "key"
});
type EventBInstance = { readonly [EventTypeId]: typeof EventTypeId; readonly tag: "EventB"; readonly payload: S.Schema.Type<typeof EventB.payload> };

const EventC = Event.make({
  tag: "EventC", // An event without a specific handler in some tests
  primaryKey: (_) => "key"
  // payload is implicitly Schema.Void here by Event.make if not specified
});
type EventCInstance = { readonly [EventTypeId]: typeof EventTypeId; readonly tag: "EventC"; readonly payload: S.Schema.Type<typeof S.Void> };


// Define a sample state
interface MyState {
  count: number;
  message: string;
  lastEventTimestamp?: number;
}

const initialState: MyState = {
  count: 0,
  message: "initial",
};

describe("AggregateReducerBuilder", () => {
  it("should build a reducer and process events using the pipeable API", () => {
    const reducer = pipe(
      empty<MyState>(), // Explicitly type empty if E is not inferrable initially
      handleEvent<MyState, typeof EventA, EventAInstance, Event.Event.Any>(EventA, (state, event) => ({
        ...state,
        count: state.count + event.payload.value,
      })),
      handleEvent<MyState, typeof EventB, EventBInstance, Event.Event.Any>(EventB, (state, event) => ({
        ...state,
        message: event.payload.text,
      })),
      withInitialState(initialState),
      build()
    );

    const eventA_10: EventAInstance = { [EventTypeId]: EventTypeId, tag: "EventA", payload: { value: 10 } };
    let state = reducer(undefined, eventA_10);
    expect(state.count).toBe(10);
    expect(state.message).toBe("initial");

    const eventB_hello: EventBInstance = { [EventTypeId]: EventTypeId, tag: "EventB", payload: { text: "hello" } };
    state = reducer(state, eventB_hello);
    expect(state.count).toBe(10);
    expect(state.message).toBe("hello");
  });

  it("should use initial state if provided state is undefined", () => {
    const reducer = pipe(
      empty<MyState>(),
      handleEvent<MyState, typeof EventA, EventAInstance, Event.Event.Any>(EventA, (state, event) => ({
        ...state,
        count: state.count + event.payload.value,
      })),
      withInitialState(initialState),
      build()
    );

    const eventA_5: EventAInstance = { [EventTypeId]: EventTypeId, tag: "EventA", payload: { value: 5 } };
    const newState = reducer(undefined, eventA_5); // Pass undefined for current state

    expect(newState.count).toBe(5);
    expect(newState.message).toBe("initial");
  });

  it("should return current state if no handler matches event tag", () => {
    const reducer = pipe(
      empty<MyState>(),
      handleEvent<MyState, typeof EventA, EventAInstance, Event.Event.Any>(EventA, (state, event) => ({
        ...state,
        count: state.count + event.payload.value,
      })),
      withInitialState(initialState),
      build()
    );

    const currentState: MyState = { count: 1, message: "test" };
    // For EventC, payload is void. Schema.Void has a type of `void` but Schema.decode(Schema.Void)(undefined) is undefined.
    // The actual payload value for a Void schema event is typically `undefined`.
    const eventC_Instance: EventCInstance = { [EventTypeId]: EventTypeId, tag: "EventC", payload: undefined as S.Schema.Type<typeof S.Void> };
    const newState = reducer(currentState, eventC_Instance);

    expect(newState).toBe(currentState); // Should be the same state object
    expect(newState.count).toBe(1);
    expect(newState.message).toBe("test");
  });
  
  it("reducer created by build() should use the most recent initial state provided", () => {
    const firstInitialState: MyState = { count: 100, message: "first" };
    const secondInitialState: MyState = { count: 200, message: "second" };

    const reducer = pipe(
      empty<MyState>(),
      withInitialState(firstInitialState), // First initial state
      handleEvent<MyState, typeof EventA, EventAInstance, Event.Event.Any>(EventA, (state, event) => ({
        ...state,
        count: state.count + event.payload.value,
      })),
      withInitialState(secondInitialState), // Overridden with second initial state
      build()
    );
    
    const eventA_1: EventAInstance = { [EventTypeId]: EventTypeId, tag: "EventA", payload: { value: 1 } };
    const state = reducer(undefined, eventA_1);
    expect(state.count).toBe(201); // 200 + 1
    expect(state.message).toBe("second");
  });

  it("build() should throw error if withInitialState is not called", () => {
    const builder = pipe(
      empty<MyState>(),
      handleEvent<MyState, typeof EventA, EventAInstance, Event.Event.Any>(EventA, (state, event) => ({
        ...state,
        count: state.count + event.payload.value,
      }))
      // No withInitialState
    );

    expect(() => build()(builder)).toThrowError(
      "Initial state must be provided before building the reducer. Call withInitialState()."
    );
  });
  
  it("handleEvent should return a new builder instance (immutability)", () => {
    const builder1 = empty<MyState>();
    const builder2 = handleEvent<MyState, typeof EventA, EventAInstance, Event.Event.Any>(EventA, (s, e) => ({...s, count: s.count + e.payload.value }))(builder1); // actual handler
    expect(builder1).not.toBe(builder2);

    const reducer1 = pipe(builder1, withInitialState(initialState), build());
    const eventA_val1: EventAInstance = { [EventTypeId]: EventTypeId, tag: "EventA", payload: { value: 1 } };
    // Reducer from builder1 should not handle EventA
    expect(reducer1(initialState, eventA_val1).count).toBe(0);


    const reducer2 = pipe(builder2, withInitialState(initialState), build());
    // Reducer from builder2 should handle EventA
    expect(reducer2(initialState, eventA_val1).count).toBe(1);
  });

  it("withInitialState should return a new builder instance (immutability)", () => {
    const builder1 = empty<MyState>();
    const builder2 = withInitialState(initialState)(builder1);
    expect(builder1).not.toBe(builder2);

    // Test that builder1 build would fail (if it could be built without initial state)
    // and builder2 build would succeed.
    expect(() => build()(builder1)).toThrowError();
    expect(() => build()(builder2)).not.toThrowError();
  });

  // More complex scenario: multiple events, chaining
  it("should handle a sequence of different events correctly", () => {
    const timestampInitialState: MyState = { ...initialState, lastEventTimestamp: 0 };

    // Define event instance types that include a timestamp for this test
    type EventAWithTimestamp = EventAInstance & { timestamp: number };
    type EventBWithTimestamp = EventBInstance & { timestamp: number };
    
    const eventWithTimestamp = <E extends {tag: string, payload: any}>(
      baseEvent: E, // This is not used for TypeId, tag, payload directly
      typeId: typeof EventTypeId,
      tag: E["tag"],
      payload: E["payload"],
      timestamp: number
    ): { [EventTypeId]: typeof EventTypeId; tag: E["tag"]; payload: E["payload"]; timestamp: number } => ({
        [EventTypeId]: typeId,
        tag: tag,
        payload,
        timestamp
    });


    const reducer = pipe(
      empty<MyState, EventAWithTimestamp | EventBWithTimestamp>(), // Union of specific timestamped events
      handleEvent<MyState, typeof EventA, EventAWithTimestamp, EventAWithTimestamp | EventBWithTimestamp>(EventA, (state, event) => ({
        ...state,
        count: state.count + event.payload.value, // event is EventAWithTimestamp
        lastEventTimestamp: event.timestamp 
      })),
      handleEvent<MyState, typeof EventB, EventBWithTimestamp, EventAWithTimestamp | EventBWithTimestamp>(EventB, (state, event) => ({
        ...state,
        message: event.payload.text, // event is EventBWithTimestamp
        lastEventTimestamp: event.timestamp
      })),
      withInitialState(timestampInitialState),
      build()
    );

    const eventA1 = eventWithTimestamp({tag: EventA.tag, payload: {value: 5}}, EventTypeId, EventA.tag, { value: 5 }, 123) as EventAWithTimestamp;
    const eventB1 = eventWithTimestamp({tag: EventB.tag, payload: {text: "first"}}, EventTypeId, EventB.tag, { text: "first" }, 124) as EventBWithTimestamp;
    const eventA2 = eventWithTimestamp({tag: EventA.tag, payload: {value: 3}}, EventTypeId, EventA.tag, { value: 3 }, 125) as EventAWithTimestamp;

    let state = reducer(undefined, eventA1);
    expect(state.count).toBe(5);
    expect(state.message).toBe("initial");
    expect(state.lastEventTimestamp).toBe(123);

    state = reducer(state, eventB1);
    expect(state.count).toBe(5);
    expect(state.message).toBe("first");
    expect(state.lastEventTimestamp).toBe(124);
    
    state = reducer(state, eventA2);
    expect(state.count).toBe(8); // 5 + 3
    expect(state.message).toBe("first");
    expect(state.lastEventTimestamp).toBe(125);
  });

  // Optional test for direct .pipe() method
  it("should allow direct use of .pipe() method on an instance", () => {
    const builder: AggregateReducerBuilder<MyState, Event.Event.Any> = empty<MyState>(); // Explicitly type builder
    
    // Define the handler function to be used with .pipe()
    const addValueToCountHandler = handleEvent<MyState, typeof EventA, EventAInstance, Event.Event.Any>(
      EventA, 
      (s, e) => ({...s, count: s.count + e.payload.value })
    );

    // Using the .pipe() method from the instance
    const reducer = builder
      .pipe(addValueToCountHandler) // Apply the event handler
      .pipe(withInitialState(initialState)) // Apply the initial state
      .pipe(build()); // Build the reducer

    // Create an event instance (ensure EventTypeId and tag are correct)
    const eventAInstance: EventAInstance = { [EventTypeId]: EventTypeId, tag: "EventA", payload: { value: 99 } };
    const state = reducer(undefined, eventAInstance); // Pass the event instance
    
    expect(state.count).toBe(99);
    expect(state.message).toBe("initial"); // Message should be from initialState
  });
});

describe("isAggregateReducerBuilder", () => {
  it("should correctly identify AggregateReducerBuilder instances", () => {
    const builderInstance = empty<MyState>();
    expect(isAggregateReducerBuilder(builderInstance)).toBe(true);
  });

  it("should correctly identify non-AggregateReducerBuilder instances", () => {
    expect(isAggregateReducerBuilder({})).toBe(false);
    expect(isAggregateReducerBuilder(null)).toBe(false);
    expect(isAggregateReducerBuilder(undefined)).toBe(false);
    expect(isAggregateReducerBuilder("string")).toBe(false);
    expect(isAggregateReducerBuilder(123)).toBe(false);
    
    // Test with an object that coincidentally has the TypeId property but is not a real instance
    const fakeBuilder = {
      [EventTypeId]: "fake-id-to-confuse" // Using EventTypeId from Event.js, not AggregateReducerBuilderTypeId
    };
    expect(isAggregateReducerBuilder(fakeBuilder)).toBe(false);

    // Test with an object that has a different TypeId
    const anotherObjectWithDifferentSymbol = {
      [Symbol("anotherTypeId")]: "anotherSymbol"
    };
    expect(isAggregateReducerBuilder(anotherObjectWithDifferentSymbol)).toBe(false);
  });
});
