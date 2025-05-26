import type * as EventMod from "./Event.js"; // Renamed to avoid conflict with Event type alias
import type { Schema } from "effect/Schema"; // Keep Schema for internal use or future extensions
import { pipe } from "effect/Function"; // Add this import for the pipe function

// Type alias for Event from the module, using a clear name
type EventDefinition<Tag extends string, PayloadSchema extends Schema.Any = typeof Schema.Void> = EventMod.Event<Tag, PayloadSchema>;

// Type alias for any event instance that the reducer might receive.
// This should align with how actual event instances are structured and typed.
// For now, we use EventMod.Event.Any which is a minimal interface { tag: string }.
// If event instances are richer (e.g., always have a 'payload' property of a specific type), this could be refined.
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
  // The handler function takes the state and an *instance* of the event.
  readonly handler: (state: S, eventInstance: EvInst) => S;
}

/**
 * Builds an AggregateReducer by allowing registration of event handlers.
 * It is pure and idempotent; each method call returns a new instance.
 * @template S The type of the aggregate's state.
 * @template HandledEventsUnion The union type of all event *instances* for which handlers have been accumulated.
 */
export class AggregateReducerBuilder<S, HandledEventsUnion extends AnyEventInstance> {
  // internalHandlers stores configurations. Each handler within is specific to its event.
  // The common type `AnyEventInstance` is used for the array to hold diverse handlers.
  private constructor(
    private readonly internalHandlers: ReadonlyArray<EventHandlerConfig<S, EventDefinition<string, any>, AnyEventInstance>>,
    private readonly initialState: S | undefined
  ) {}

  /**
   * Creates an empty AggregateReducerBuilder.
   * @template S The type of the aggregate's state.
   * @template E The initial union of handled event instances (usually 'never').
   */
  public static empty<S, E extends AnyEventInstance = never>(): AggregateReducerBuilder<S, E> {
    return new AggregateReducerBuilder<S, E>([], undefined);
  }

  /**
   * Registers an event handler for a specific event type.
   * Returns a new builder instance including this handler.
   * @template EvDef The type of the event *definition*.
   * @template EvInst The type of the event *instance* that corresponds to the definition.
   * @param eventDefinition The event definition object (e.g., from Event.make).
   * @param handler The function to handle an *instance* of this event.
   */
  public handleEvent<
    EvDef extends EventDefinition<string, any>,
    // We need to ensure EvInst is compatible with EvDef, typically EvInst would be
    // something like { tag: EvDef["tag"], payload: Schema.TypeOf<EvDef["payload"]> } & EventMod.Event.Any
    // For now, let's assume EvInst is provided correctly by the caller, or make it simpler:
    EvInst extends { readonly tag: EvDef["tag"] } & AnyEventInstance 
  >(
    eventDefinition: EvDef,
    handler: (state: S, eventInstance: EvInst) => S
  ): AggregateReducerBuilder<S, HandledEventsUnion | EvInst> {
    const newHandlerEntry: EventHandlerConfig<S, EvDef, EvInst> = { eventDefinition, handler };
    
    const updatedInternalHandlers = [
      ...this.internalHandlers,
      // When adding to internalHandlers, we widen the event instance type to AnyEventInstance
      // as the array holds handlers for many different event types.
      // The specificity is preserved within the `handler` function's signature itself.
      newHandlerEntry as unknown as EventHandlerConfig<S, EventDefinition<string, any>, AnyEventInstance>
    ];

    return new AggregateReducerBuilder<S, HandledEventsUnion | EvInst>(
      updatedInternalHandlers,
      this.initialState
    );
  }

  /**
   * Sets the initial state for the aggregate.
   * Returns a new builder instance with the initial state set.
   * @param initialState The initial state object.
   */
  public withInitialState(initialState: S): AggregateReducerBuilder<S, HandledEventsUnion> {
    return new AggregateReducerBuilder<S, HandledEventsUnion>(this.internalHandlers, initialState);
  }

  /**
   * Builds the aggregate reducer function.
   * Throws an error if the initial state was not provided.
   */
  public build(): AggregateReducer<S, HandledEventsUnion> {
    if (this.initialState === undefined) {
      throw new Error("Initial state must be provided before building the reducer. Call withInitialState().");
    }

    // The handlerMap stores the specific handlers.
    // The key is the event tag (string).
    // The value is a function that takes (state, eventInstance) and returns new state.
    const handlerMap = new Map<string, (state: S, eventInstance: AnyEventInstance) => S>();
    for (const config of this.internalHandlers) {
      // config.handler is already (state: S, eventInstance: SpecificEventInst) => S
      // This is assignable to (state: S, eventInstance: AnyEventInstance) => S
      // because SpecificEventInst extends AnyEventInstance.
      handlerMap.set(config.eventDefinition.tag, config.handler);
    }
    
    const initState = this.initialState;

    // The returned reducer takes the current state and an event instance from the HandledEventsUnion.
    return (currentState: S | undefined, eventInstance: HandledEventsUnion): S => {
      const resolvedState = currentState === undefined ? initState : currentState;
      // Ensure resolvedState is not undefined (TypeScript might not infer this from the build guard)
      if (resolvedState === undefined) { 
          throw new Error("Internal error: Initial state was not properly applied.");
      }

      const handler = handlerMap.get(eventInstance.tag);
      if (handler) {
        // `eventInstance` is part of `HandledEventsUnion`.
        // The handler retrieved was stored with key `eventInstance.tag`.
        // This handler expects a specific subtype of `AnyEventInstance`.
        // Since `HandledEventsUnion` elements are subtypes of `AnyEventInstance`,
        // and the tag matches, this call is type-safe.
        return handler(resolvedState, eventInstance);
      }
      return resolvedState; // If no handler for this event tag, return state unchanged.
    };
  }
}

// Helper functions for pipeable API

/**
 * Creates an empty AggregateReducerBuilder.
 * Part of the pipeable API.
 * @template S The type of the aggregate's state.
 * @template E The initial union of handled event instances (usually 'never').
 */
export const empty = <S, E extends AnyEventInstance = never>(): AggregateReducerBuilder<S, E> =>
  AggregateReducerBuilder.empty<S, E>();

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

// Ensure all necessary types (AnyEventInstance, EventDefinition, AggregateReducer, AggregateReducerBuilder)
// are exported from the file if they are not already.
// The class and type exports should already be there from previous steps.
// export { AggregateReducerBuilder, AggregateReducer, EventDefinition, AnyEventInstance };
// Note: Actual export statements for these types are already present or implicitly handled by their definition.
