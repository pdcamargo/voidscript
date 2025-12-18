/**
 * Bevy-inspired Event System
 *
 * Provides type-safe event communication between systems with frame-based retention.
 * Events are automatically cleaned up after a configurable number of frames.
 *
 * @example
 * ```ts
 * // Define an event class
 * class PlayerDamagedEvent {
 *   constructor(public damage: number, public source: string) {}
 * }
 *
 * // Register the event type
 * app.addEvent(PlayerDamagedEvent);
 *
 * // Send events from a system
 * const damageSystem = system(({ commands }) => {
 *   const writer = commands.eventWriter(PlayerDamagedEvent);
 *   writer.send(new PlayerDamagedEvent(10, 'enemy'));
 * });
 *
 * // Read events from another system
 * const uiSystem = system(({ commands }) => {
 *   const reader = commands.eventReader(PlayerDamagedEvent);
 *   for (const event of reader.read()) {
 *     console.log(`Took ${event.damage} damage from ${event.source}`);
 *   }
 * });
 * ```
 */

export type EventClass<T> = new (...args: any[]) => T;

type EventEnvelope<T> = {
  seq: number;
  frame: number;
  value: T;
};

class EventChannel<T> {
  #events: EventEnvelope<T>[] = [];
  #nextSeq = 1;

  public push(value: T, frame: number): void {
    this.#events.push({ seq: this.#nextSeq++, frame, value });
  }

  public readFrom(seqExclusive: number): { events: T[]; lastSeq: number } {
    if (this.#events.length === 0) return { events: [], lastSeq: seqExclusive };
    const startIdx = this.#findFirstIndexAfter(seqExclusive);
    if (startIdx < 0 || startIdx >= this.#events.length) {
      const last = this.#events[this.#events.length - 1]!.seq;
      return { events: [], lastSeq: last };
    }
    const slice = this.#events.slice(startIdx);
    const last = slice[slice.length - 1]!.seq;
    return { events: slice.map((e) => e.value), lastSeq: last };
  }

  public retainFromFrame(minFrameInclusive: number): void {
    if (this.#events.length === 0) return;
    let firstIdx = 0;
    while (
      firstIdx < this.#events.length &&
      this.#events[firstIdx]!.frame < minFrameInclusive
    ) {
      firstIdx++;
    }
    if (firstIdx > 0) this.#events.splice(0, firstIdx);
  }

  #findFirstIndexAfter(seq: number): number {
    // Linear is fine for small counts; could binary search if needed later
    for (let i = 0; i < this.#events.length; i++) {
      if (this.#events[i]!.seq > seq) return i;
    }
    return -1;
  }
}

/**
 * EventWriter - Used to send events of a specific type
 *
 * Obtained via `commands.eventWriter(EventClass)` in systems.
 */
export class EventWriter<T> {
  #channel: EventChannel<T>;
  #getFrame: () => number;

  constructor(channel: EventChannel<T>, getFrame: () => number) {
    this.#channel = channel;
    this.#getFrame = getFrame;
  }

  /**
   * Send an event to all listeners
   */
  public send(value: T): void {
    this.#channel.push(value, this.#getFrame());
  }
}

/**
 * EventReader - Used to receive events of a specific type
 *
 * Obtained via `commands.eventReader(EventClass)` in systems.
 * Each system maintains its own read cursor, so multiple systems
 * can independently consume the same events.
 */
export class EventReader<T> {
  #channel: EventChannel<T>;
  #getLastSeq: () => number;
  #setLastSeq: (seq: number) => void;

  constructor(
    channel: EventChannel<T>,
    getLastSeq: () => number,
    setLastSeq: (seq: number) => void
  ) {
    this.#channel = channel;
    this.#getLastSeq = getLastSeq;
    this.#setLastSeq = setLastSeq;
  }

  /**
   * Read all new events since the last read
   * @returns Array of events (empty if no new events)
   */
  public read(): T[] {
    const { events, lastSeq } = this.#channel.readFrom(this.#getLastSeq());
    if (events.length > 0) {
      this.#setLastSeq(lastSeq);
    }
    return events;
  }

  /**
   * Check if there are any new events ready to be read
   * Note: This consumes the events (same as calling read())
   */
  public hasEventsReady(): boolean {
    return this.read().length > 0;
  }
}

/**
 * Events - Central event management resource
 *
 * Manages all event channels and provides reader/writer access.
 * Registered as a resource in the Application and accessed via commands.
 */
export class Events {
  #channels: Map<string, EventChannel<any>> = new Map();
  #readerSeqBySystem: WeakMap<object, Map<string, number>> = new WeakMap();
  #frame = 0;
  #retentionFrames = 2; // keep events for at least 2 frames
  #autoClear = true;

  /**
   * Register an event type for use in the system
   * Must be called before using eventWriter/eventReader for this type
   */
  public addEvent<T>(cls: EventClass<T>): void {
    const key = this.#keyFor(cls);
    if (!this.#channels.has(key)) {
      this.#channels.set(key, new EventChannel<T>());
    }
  }

  /**
   * Get an event writer for sending events
   * @internal Used by Command.eventWriter()
   */
  public writer<T>(cls: EventClass<T>): EventWriter<T> {
    const channel = this.#getOrCreateChannel(cls) as EventChannel<T>;
    return new EventWriter<T>(channel, () => this.#frame);
  }

  /**
   * Get an event reader for receiving events
   * @param systemIdentity Unique object identity for the calling system
   * @internal Used by Command.eventReader()
   */
  public reader<T>(cls: EventClass<T>, systemIdentity: object): EventReader<T> {
    const channel = this.#getOrCreateChannel(cls) as EventChannel<T>;
    const readers = this.#getOrCreateReaderMap(systemIdentity);
    const key = this.#keyFor(cls);
    const getLastSeq = () => readers.get(key) ?? 0;
    const setLastSeq = (seq: number) => readers.set(key, seq);
    return new EventReader<T>(channel, getLastSeq, setLastSeq);
  }

  /**
   * Called at the end of each frame to advance frame counter and clean up old events
   * @internal Called by Application.gameLoop()
   */
  public onFrameEnd(): void {
    // advance to next frame and optionally run maintenance
    this.#frame++;
    if (this.#autoClear) this.maintain();
  }

  /**
   * Clean up old events based on retention settings
   */
  public maintain(): void {
    // Keep events for the last `#retentionFrames` frames
    const minFrameInclusive = this.#frame - (this.#retentionFrames - 1);
    for (const ch of this.#channels.values()) {
      ch.retainFromFrame(minFrameInclusive);
    }
  }

  /**
   * Enable or disable automatic event cleanup at frame end
   */
  public setAutoClear(auto: boolean): void {
    this.#autoClear = auto;
  }

  /**
   * Set the number of frames to retain events
   * @param frames Minimum 1, events older than this many frames are cleaned up
   */
  public setRetentionFrames(frames: number): void {
    this.#retentionFrames = Math.max(1, Math.floor(frames));
  }

  #getOrCreateChannel<T>(cls: EventClass<T>): EventChannel<T> {
    const key = this.#keyFor(cls);
    let ch = this.#channels.get(key) as EventChannel<T> | undefined;
    if (!ch) {
      ch = new EventChannel<T>();
      this.#channels.set(key, ch as unknown as EventChannel<any>);
    }
    return ch;
  }

  #getOrCreateReaderMap(systemIdentity: object): Map<string, number> {
    let map = this.#readerSeqBySystem.get(systemIdentity);
    if (!map) {
      map = new Map<string, number>();
      this.#readerSeqBySystem.set(systemIdentity, map);
    }
    return map;
  }

  #keyFor<T>(cls: EventClass<T>): string {
    return cls.name;
  }
}

/**
 * API interface for event access (for type documentation)
 */
export type EventsApi = {
  writer<T>(cls: EventClass<T>): EventWriter<T>;
  reader<T>(cls: EventClass<T>): EventReader<T>;
};
