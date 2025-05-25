import type * as Event from "./Event.ts"

/**
 * Represents an aggregate, which is a fundamental concept in Domain-Driven Design.
 * An aggregate is a cluster of domain objects that can be treated as a single unit.
 *
 * @template S The type of the aggregate's state.
 * @template E The type of the events that can be applied to the aggregate.
 */
export interface Aggregate<S, E extends Event.Any> {
  /**
   * The unique identifier of the aggregate.
   */
  readonly id: string

  /**
   * The current version of the aggregate.
   * This version is incremented each time an event is applied.
   */
  readonly version: number

  /**
   * A list of events that have occurred but have not yet been persisted.
   * These are new changes to the aggregate's state.
   */
  readonly uncommittedChanges: ReadonlyArray<E>

  /**
   * The current state of the aggregate.
   * This state is derived by applying all historical events.
   */
  readonly state: S
}
