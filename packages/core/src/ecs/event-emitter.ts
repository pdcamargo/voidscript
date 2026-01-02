/**
 * Simple EventEmitter for ECS World events
 */

export type EventHandler<T> = (event: T) => void;

/**
 * EventEmitter - Simple pub/sub for typed events
 */
export class EventEmitter<TEvent> {
  private handlers: EventHandler<TEvent>[] = [];

  /**
   * Subscribe to events
   * @param handler Event handler function
   * @returns Unsubscribe function
   */
  on(handler: EventHandler<TEvent>): () => void {
    this.handlers.push(handler);
    return () => this.off(handler);
  }

  /**
   * Unsubscribe from events
   * @param handler Event handler to remove
   */
  off(handler: EventHandler<TEvent>): void {
    const index = this.handlers.indexOf(handler);
    if (index !== -1) {
      this.handlers.splice(index, 1);
    }
  }

  /**
   * Emit event to all subscribers
   * @param event Event data
   */
  emit(event: TEvent): void {
    // Copy handlers array to avoid issues if handler modifies the array
    const handlers = this.handlers.slice();
    for (const handler of handlers) {
      handler(event);
    }
  }

  /**
   * Clear all handlers
   */
  clear(): void {
    this.handlers = [];
  }

  /**
   * Get number of active handlers
   */
  get handlerCount(): number {
    return this.handlers.length;
  }
}
