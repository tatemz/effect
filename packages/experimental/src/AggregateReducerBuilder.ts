import type * as EventMod from "./Event.js"; // Renamed to avoid conflict with Event type alias
import type { Schema } from "effect/Schema"; // Keep Schema for internal use or future extensions
import { pipe } from "effect/Function"; // Add this import for the pipe function
import { pipeArguments } from "effect/Pipeable"; // For the pipe method signature - REMOVE TYPE
import * as Predicate from "effect/Predicate"; // Ensure this import is present

/**
 * @since next
 * @category type ids
 */
export const AggregateReducerBuilderTypeId: unique symbol = Symbol.for("@effect/experimental/AggregateReducerBuilder");

/**
 * @since next
 * @category type ids
 */
export type AggregateReducerBuilderTypeId = typeof AggregateReducerBuilderTypeId;

// Type alias for Event from the module, using a clear name
type EventDefinition<Tag extends string, PayloadSchema extends Schema.Any = typeof Schema.Void> = EventMod.Event<Tag, PayloadSchema>;

// Type alias for any event instance that the reducer might receive.
type AnyEventInstance = EventMod.Event.Any; // More descriptive alias for Event.Any in this context

/**
 * Represents a function that takes the current state and an event instance, and returns the new state.
 * @template S The type of the aggregate's state.
 * @template HandledEventsUnion The union type of all event *instances* that this reducer can process.
 */
export type AggregateReducer<S, HandledEventsUnion extends AnyEventInstance> = (
  state: S,
  event: HandledEventsUnion
) => S;

/**
 * Interface for a single event handler configuration within the builder.
 * @template S The type of the aggregate's state.
 * @template EvDef The specific event *definition* type this handler is for.
 * @template EvInst The specific event *instance* type that the handler function receives.
 */
export interface EventHandlerConfig<S, EvDef extends EventDefinition<string, any>, EvInst extends AnyEventInstance> {
  readonly eventDefinition: EvDef;
  readonly handler: (state: S, eventInstance: EvInst) => S;
}

export interface AggregateReducerBuilder<S, HandledEventsUnion extends AnyEventInstance> {
  readonly [AggregateReducerBuilderTypeId]: AggregateReducerBuilderTypeId;

  // Data properties (these will be on the instance)
  readonly internalHandlers: ReadonlyArray<EventHandlerConfig<S, EventDefinition<string, any>, AnyEventInstance>>;
  readonly initialState: S | undefined;

  // Methods (these will be implemented in the Proto object)
  // Note: 'this' is explicitly typed for methods.

  /**
   * Registers an event handler for a specific event type.
   * Returns a new builder instance including this handler.
   */
  handleEvent<
    EvDef extends EventDefinition<string, any>,
    EvInst extends { readonly tag: EvDef["tag"] } & AnyEventInstance
  >(
    this: AggregateReducerBuilder<S, HandledEventsUnion>,
    eventDefinition: EvDef,
    handler: (state: S, eventInstance: EvInst) => S
  ): AggregateReducerBuilder<S, HandledEventsUnion | EvInst>;

  /**
   * Sets the initial state for the aggregate.
   * Returns a new builder instance with the initial state set.
   */
  withInitialState(
    this: AggregateReducerBuilder<S, HandledEventsUnion>,
    initialState: S
  ): AggregateReducerBuilder<S, HandledEventsUnion>;

  /**
   * Builds the aggregate reducer function.
   * Throws an error if the initial state was not provided.
   */
  build(
    this: AggregateReducerBuilder<S, HandledEventsUnion>
  ): AggregateReducer<S, HandledEventsUnion>;
  
  /**
   * Enables pipeable operations on the builder instance.
   */
  pipe<Self extends AggregateReducerBuilder<S, HandledEventsUnion>, Args extends ReadonlyArray<any>>(
    this: Self,
    ...args: Args
  ): ReturnType<typeof pipeArguments<Self, Args>>; // More precise return type
}

// Placeholder for the factory function to be defined in the next step.
// REMOVE: declare const makeAggregateReducerBuilder... (this line will be deleted)


const AggregateReducerBuilderProto: Omit<AggregateReducerBuilder<any, any>, "internalHandlers" | "initialState"> & {
  // Omit data properties, as they are on the instance.
  // Add any specific types for the proto's version of methods if necessary,
  // but generally, they should align with the interface.
  // For simplicity here, we'll ensure the methods match the interface directly.
} = {
  [AggregateReducerBuilderTypeId]: AggregateReducerBuilderTypeId,

  handleEvent<S, HandledEventsUnion extends AnyEventInstance, EvDef extends EventDefinition<string, any>, EvInst extends { readonly tag: EvDef["tag"] } & AnyEventInstance>(
    this: AggregateReducerBuilder<S, HandledEventsUnion>, // 'this' is the current builder instance
    eventDefinition: EvDef,
    handler: (state: S, eventInstance: EvInst) => S
  ): AggregateReducerBuilder<S, HandledEventsUnion | EvInst> {
    const newHandlerEntry: EventHandlerConfig<S, EvDef, EvInst> = { eventDefinition, handler };
    const updatedInternalHandlers = [
      ...this.internalHandlers,
      newHandlerEntry as unknown as EventHandlerConfig<S, EventDefinition<string, any>, AnyEventInstance>
    ];
    // Use the declared makeAggregateReducerBuilder (implementation will follow)
    return makeAggregateReducerBuilder<S, HandledEventsUnion | EvInst>(updatedInternalHandlers, this.initialState);
  },

  withInitialState<S, HandledEventsUnion extends AnyEventInstance>(
    this: AggregateReducerBuilder<S, HandledEventsUnion>,
    initialStateValue: S // Renamed to avoid conflict with 'this.initialState'
  ): AggregateReducerBuilder<S, HandledEventsUnion> {
    // Use the declared makeAggregateReducerBuilder
    return makeAggregateReducerBuilder<S, HandledEventsUnion>(this.internalHandlers, initialStateValue);
  },

  build<S, HandledEventsUnion extends AnyEventInstance>(
    this: AggregateReducerBuilder<S, HandledEventsUnion>
  ): AggregateReducer<S, HandledEventsUnion> {
    if (this.initialState === undefined) {
      throw new Error("Initial state must be provided before building the reducer. Call withInitialState().");
    }

    const handlerMap = new Map<string, (state: S, eventInstance: AnyEventInstance) => S>();
    for (const config of this.internalHandlers) {
      handlerMap.set(config.eventDefinition.tag, config.handler);
    }
    
    const initState = this.initialState;

    return (currentState: S | undefined, eventInstance: HandledEventsUnion): S => {
      const resolvedState = currentState === undefined ? initState : currentState;
      if (resolvedState === undefined) { 
          throw new Error("Internal error: Initial state was not properly applied.");
      }
      const handler = handlerMap.get(eventInstance.tag);
      if (handler) {
        return handler(resolvedState, eventInstance);
      }
      return resolvedState;
    };
  },
  
  pipe<Self extends AggregateReducerBuilder<any, any>, Args extends ReadonlyArray<any>>(
    this: Self,
    ...args: Args
  ): ReturnType<typeof pipeArguments<Self, Args>> {
    return pipeArguments(this, args);
  }
};

/**
 * @since next
 * @category constructors
 */
const makeAggregateReducerBuilder = <S, HandledEventsUnion extends AnyEventInstance>(
  internalHandlers: ReadonlyArray<EventHandlerConfig<S, EventDefinition<string, any>, AnyEventInstance>>,
  initialState: S | undefined
): AggregateReducerBuilder<S, HandledEventsUnion> => {
  const instance = Object.create(AggregateReducerBuilderProto);
  // Ensure 'instance' is correctly typed before Object.assign, if necessary,
  // though Object.assign will return the first argument typed.
  return Object.assign(instance, {
    internalHandlers,
    initialState
  });
};

/**
 * Checks if a value is an AggregateReducerBuilder.
 * @since next
 * @category guards
 */
export const isAggregateReducerBuilder = (u: unknown): u is AggregateReducerBuilder<any, any> =>
  Predicate.hasProperty(u, AggregateReducerBuilderTypeId) && typeof (u as any)[AggregateReducerBuilderTypeId] === "symbol";
  // Adding the typeof check for the symbol makes the guard a bit more robust.


// Helper functions for pipeable API (their implementations might need updates in subsequent steps)

/**
 * Creates an empty AggregateReducerBuilder.
 * Part of the pipeable API.
 * @template S The type of the aggregate's state.
 * @template E The initial union of handled event instances (usually 'never').
 */
export const empty = <S, E extends AnyEventInstance = never>(): AggregateReducerBuilder<S, E> =>
  makeAggregateReducerBuilder<S, E>([], undefined);

/**
 * Returns a function that registers an event handler for a specific event type on an AggregateReducerBuilder.
 * Part of the pipeable API.
 * @template S The type of the aggregate's state.
 * @template EvDef The type of the event *definition*.
 * @template EvInst The type of the event *instance* that corresponds to the definition.
 * @template CurrentHandledEvents The union of event instances already handled by the input builder.
 * @param eventDefinition The event definition object.
 * @param handler The function to handle an *instance* of this event.
 */
export const handleEvent = <
  S,
  EvDef extends EventDefinition<string, any>,
  EvInst extends { readonly tag: EvDef["tag"] } & AnyEventInstance,
  CurrentHandledEvents extends AnyEventInstance
>(
  eventDefinition: EvDef,
  handler: (state: S, eventInstance: EvInst) => S
) => (builder: AggregateReducerBuilder<S, CurrentHandledEvents>): AggregateReducerBuilder<S, CurrentHandledEvents | EvInst> => {
  return builder.handleEvent(eventDefinition, handler);
};

/**
 * Returns a function that sets the initial state for the aggregate on an AggregateReducerBuilder.
 * Part of the pipeable API.
 * @template S The type of the aggregate's state.
 * @template HandledEventsUnion The union of event instances handled by the input builder.
 * @param initialState The initial state object.
 */
export const withInitialState = <S, HandledEventsUnion extends AnyEventInstance>(
  initialState: S
) => (builder: AggregateReducerBuilder<S, HandledEventsUnion>): AggregateReducerBuilder<S, HandledEventsUnion> => {
  return builder.withInitialState(initialState);
};

/**
 * Returns a function that builds the aggregate reducer function from an AggregateReducerBuilder.
 * Part of the pipeable API.
 * @template S The type of the aggregate's state.
 * @template HandledEventsUnion The union of event instances handled by the input builder.
 */
export const build = <S, HandledEventsUnion extends AnyEventInstance>() => (
  builder: AggregateReducerBuilder<S, HandledEventsUnion>
): AggregateReducer<S, HandledEventsUnion> => {
  return builder.build();
};
