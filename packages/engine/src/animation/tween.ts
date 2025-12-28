/**
 * Tween Animation System
 *
 * A lightweight tweening system for animating object properties over time.
 * Supports various easing functions, sequences, parallel groups, and callbacks.
 *
 * Usage:
 * ```typescript
 * // Create a tween manager (usually as a resource)
 * const tweenManager = new TweenManager();
 * app.insertResource(tweenManager);
 *
 * // Create tweens
 * Tween.to(sprite.position, { x: 100, y: 50 }, 0.5, Easing.easeOutQuad)
 *   .onComplete(() => console.log('Done!'))
 *   .start(tweenManager);
 *
 * // Update in your game loop
 * tweenManager.update(deltaTime);
 * ```
 */

// ============================================================================
// Easing Functions
// ============================================================================

export type EasingFunction = (t: number) => number;

/**
 * Collection of common easing functions.
 * All functions take t in [0, 1] and return a value (usually in [0, 1]).
 */
export const Easing = {
  /** Linear interpolation (no easing) */
  linear: (t: number): number => t,

  // Quad
  easeInQuad: (t: number): number => t * t,
  easeOutQuad: (t: number): number => t * (2 - t),
  easeInOutQuad: (t: number): number => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),

  // Cubic
  easeInCubic: (t: number): number => t * t * t,
  easeOutCubic: (t: number): number => --t * t * t + 1,
  easeInOutCubic: (t: number): number =>
    t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1,

  // Quart
  easeInQuart: (t: number): number => t * t * t * t,
  easeOutQuart: (t: number): number => 1 - --t * t * t * t,
  easeInOutQuart: (t: number): number => (t < 0.5 ? 8 * t * t * t * t : 1 - 8 * --t * t * t * t),

  // Quint
  easeInQuint: (t: number): number => t * t * t * t * t,
  easeOutQuint: (t: number): number => 1 + --t * t * t * t * t,
  easeInOutQuint: (t: number): number =>
    t < 0.5 ? 16 * t * t * t * t * t : 1 + 16 * --t * t * t * t * t,

  // Sine
  easeInSine: (t: number): number => 1 - Math.cos((t * Math.PI) / 2),
  easeOutSine: (t: number): number => Math.sin((t * Math.PI) / 2),
  easeInOutSine: (t: number): number => -(Math.cos(Math.PI * t) - 1) / 2,

  // Expo
  easeInExpo: (t: number): number => (t === 0 ? 0 : Math.pow(2, 10 * (t - 1))),
  easeOutExpo: (t: number): number => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  easeInOutExpo: (t: number): number => {
    if (t === 0) return 0;
    if (t === 1) return 1;
    if (t < 0.5) return Math.pow(2, 20 * t - 10) / 2;
    return (2 - Math.pow(2, -20 * t + 10)) / 2;
  },

  // Circ
  easeInCirc: (t: number): number => 1 - Math.sqrt(1 - t * t),
  easeOutCirc: (t: number): number => Math.sqrt(1 - --t * t),
  easeInOutCirc: (t: number): number =>
    t < 0.5 ? (1 - Math.sqrt(1 - 4 * t * t)) / 2 : (Math.sqrt(1 - (-2 * t + 2) * (-2 * t + 2)) + 1) / 2,

  // Back (overshoot)
  easeInBack: (t: number): number => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return c3 * t * t * t - c1 * t * t;
  },
  easeOutBack: (t: number): number => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
  easeInOutBack: (t: number): number => {
    const c1 = 1.70158;
    const c2 = c1 * 1.525;
    return t < 0.5
      ? (Math.pow(2 * t, 2) * ((c2 + 1) * 2 * t - c2)) / 2
      : (Math.pow(2 * t - 2, 2) * ((c2 + 1) * (t * 2 - 2) + c2) + 2) / 2;
  },

  // Elastic
  easeInElastic: (t: number): number => {
    if (t === 0) return 0;
    if (t === 1) return 1;
    const c4 = (2 * Math.PI) / 3;
    return -Math.pow(2, 10 * t - 10) * Math.sin((t * 10 - 10.75) * c4);
  },
  easeOutElastic: (t: number): number => {
    if (t === 0) return 0;
    if (t === 1) return 1;
    const c4 = (2 * Math.PI) / 3;
    return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
  },
  easeInOutElastic: (t: number): number => {
    if (t === 0) return 0;
    if (t === 1) return 1;
    const c5 = (2 * Math.PI) / 4.5;
    return t < 0.5
      ? -(Math.pow(2, 20 * t - 10) * Math.sin((20 * t - 11.125) * c5)) / 2
      : (Math.pow(2, -20 * t + 10) * Math.sin((20 * t - 11.125) * c5)) / 2 + 1;
  },

  // Bounce
  easeInBounce: (t: number): number => 1 - Easing.easeOutBounce(1 - t),
  easeOutBounce: (t: number): number => {
    const n1 = 7.5625;
    const d1 = 2.75;
    if (t < 1 / d1) {
      return n1 * t * t;
    } else if (t < 2 / d1) {
      return n1 * (t -= 1.5 / d1) * t + 0.75;
    } else if (t < 2.5 / d1) {
      return n1 * (t -= 2.25 / d1) * t + 0.9375;
    } else {
      return n1 * (t -= 2.625 / d1) * t + 0.984375;
    }
  },
  easeInOutBounce: (t: number): number =>
    t < 0.5 ? (1 - Easing.easeOutBounce(1 - 2 * t)) / 2 : (1 + Easing.easeOutBounce(2 * t - 1)) / 2,
} as const;

// ============================================================================
// Tween Types
// ============================================================================

export type TweenState = 'idle' | 'running' | 'paused' | 'completed';

export interface TweenConfig {
  /** Duration in seconds */
  duration: number;
  /** Easing function (default: linear) */
  easing?: EasingFunction;
  /** Delay before starting in seconds */
  delay?: number;
  /** Number of times to repeat (0 = no repeat, -1 = infinite) */
  repeat?: number;
  /** Yoyo mode (reverse on each repeat) */
  yoyo?: boolean;
}

type TweenTarget = Record<string, number>;

interface TweenProperty {
  key: string;
  startValue: number;
  endValue: number;
}

// ============================================================================
// Tween Class
// ============================================================================

/**
 * A single tween animation that interpolates object properties over time.
 */
export class Tween {
  private target: TweenTarget;
  private properties: TweenProperty[] = [];
  private duration: number;
  private easing: EasingFunction;
  private delay: number;
  private repeat: number;
  private yoyo: boolean;

  private state: TweenState = 'idle';
  private elapsed: number = 0;
  private delayRemaining: number = 0;
  private repeatCount: number = 0;
  private isReversed: boolean = false;

  // Callbacks
  private onStartCallback?: () => void;
  private onUpdateCallback?: (progress: number) => void;
  private onCompleteCallback?: () => void;
  private onRepeatCallback?: (count: number) => void;

  // Manager reference
  private manager: TweenManager | null = null;

  private constructor(target: TweenTarget, endValues: Partial<TweenTarget>, config: TweenConfig) {
    this.target = target;
    this.duration = config.duration;
    this.easing = config.easing ?? Easing.linear;
    this.delay = config.delay ?? 0;
    this.repeat = config.repeat ?? 0;
    this.yoyo = config.yoyo ?? false;

    this.delayRemaining = this.delay;

    // Capture start values and end values
    for (const key of Object.keys(endValues)) {
      if (typeof target[key] === 'number' && typeof endValues[key] === 'number') {
        this.properties.push({
          key,
          startValue: target[key],
          endValue: endValues[key]!,
        });
      }
    }
  }

  /**
   * Create a tween that animates from current values to target values.
   */
  static to(target: TweenTarget, endValues: Partial<TweenTarget>, duration: number, easing?: EasingFunction): Tween {
    return new Tween(target, endValues, { duration, easing });
  }

  /**
   * Create a tween with full configuration options.
   */
  static create(target: TweenTarget, endValues: Partial<TweenTarget>, config: TweenConfig): Tween {
    return new Tween(target, endValues, config);
  }

  // -------------------------------------------------------------------------
  // Fluent Configuration
  // -------------------------------------------------------------------------

  /** Set the easing function */
  setEasing(easing: EasingFunction): this {
    this.easing = easing;
    return this;
  }

  /** Set the delay before starting */
  setDelay(delay: number): this {
    this.delay = delay;
    this.delayRemaining = delay;
    return this;
  }

  /** Set the number of repeats (-1 for infinite) */
  setRepeat(count: number): this {
    this.repeat = count;
    return this;
  }

  /** Enable yoyo mode (reverse on each repeat) */
  setYoyo(enabled: boolean): this {
    this.yoyo = enabled;
    return this;
  }

  /** Callback when tween starts */
  onStart(callback: () => void): this {
    this.onStartCallback = callback;
    return this;
  }

  /** Callback on each update (progress is 0-1) */
  onUpdate(callback: (progress: number) => void): this {
    this.onUpdateCallback = callback;
    return this;
  }

  /** Callback when tween completes */
  onComplete(callback: () => void): this {
    this.onCompleteCallback = callback;
    return this;
  }

  /** Callback on each repeat */
  onRepeat(callback: (count: number) => void): this {
    this.onRepeatCallback = callback;
    return this;
  }

  // -------------------------------------------------------------------------
  // Control
  // -------------------------------------------------------------------------

  /** Start the tween (registers with manager) */
  start(manager: TweenManager): this {
    if (this.state === 'running') return this;

    this.manager = manager;
    this.state = 'running';
    this.elapsed = 0;
    this.delayRemaining = this.delay;
    this.repeatCount = 0;
    this.isReversed = false;

    // Capture current start values
    for (const prop of this.properties) {
      prop.startValue = this.target[prop.key] ?? 0;
    }

    manager.add(this);
    return this;
  }

  /** Pause the tween */
  pause(): this {
    if (this.state === 'running') {
      this.state = 'paused';
    }
    return this;
  }

  /** Resume the tween */
  resume(): this {
    if (this.state === 'paused') {
      this.state = 'running';
    }
    return this;
  }

  /** Stop the tween immediately */
  stop(): this {
    this.state = 'completed';
    this.manager?.remove(this);
    return this;
  }

  /** Reset the tween to initial state */
  reset(): this {
    this.state = 'idle';
    this.elapsed = 0;
    this.delayRemaining = this.delay;
    this.repeatCount = 0;
    this.isReversed = false;

    // Reset target to start values
    for (const prop of this.properties) {
      this.target[prop.key] = prop.startValue;
    }

    return this;
  }

  // -------------------------------------------------------------------------
  // State
  // -------------------------------------------------------------------------

  getState(): TweenState {
    return this.state;
  }

  isRunning(): boolean {
    return this.state === 'running';
  }

  isComplete(): boolean {
    return this.state === 'completed';
  }

  getProgress(): number {
    return Math.min(1, this.elapsed / this.duration);
  }

  // -------------------------------------------------------------------------
  // Update (called by TweenManager)
  // -------------------------------------------------------------------------

  /** Update the tween. Returns true if still active, false if completed. */
  update(deltaTime: number): boolean {
    if (this.state !== 'running') {
      return this.state !== 'completed';
    }

    // Handle delay
    if (this.delayRemaining > 0) {
      this.delayRemaining -= deltaTime;
      if (this.delayRemaining > 0) {
        return true;
      }
      // Delay finished, trigger start
      this.onStartCallback?.();
      deltaTime = -this.delayRemaining; // Use remaining time
      this.delayRemaining = 0;
    }

    // Update elapsed time
    this.elapsed += deltaTime;

    // Calculate progress (0 to 1)
    const t = Math.min(1, this.elapsed / this.duration);

    // Apply easing
    let easedT = this.easing(t);

    // Handle yoyo reversal
    if (this.isReversed) {
      easedT = 1 - easedT;
    }

    // Update properties
    for (const prop of this.properties) {
      const value = prop.startValue + (prop.endValue - prop.startValue) * easedT;
      this.target[prop.key] = value;
    }

    // Trigger update callback
    this.onUpdateCallback?.(t);

    // Check for completion
    if (t >= 1) {
      // Handle repeat
      if (this.repeat !== 0) {
        this.repeatCount++;

        if (this.repeat === -1 || this.repeatCount < this.repeat) {
          // Reset for another iteration
          this.elapsed = 0;

          if (this.yoyo) {
            this.isReversed = !this.isReversed;
          } else {
            // Reset properties to start values
            for (const prop of this.properties) {
              this.target[prop.key] = prop.startValue;
            }
          }

          this.onRepeatCallback?.(this.repeatCount);
          return true;
        }
      }

      // Truly complete
      this.state = 'completed';
      this.onCompleteCallback?.();
      return false;
    }

    return true;
  }
}

// ============================================================================
// TweenSequence
// ============================================================================

/**
 * A sequence of tweens that play one after another.
 */
export class TweenSequence {
  private tweens: Tween[] = [];
  private currentIndex: number = 0;
  private state: TweenState = 'idle';
  private manager: TweenManager | null = null;

  private onCompleteCallback?: () => void;

  private constructor() {}

  /** Create a new sequence from tweens */
  static create(...tweens: Tween[]): TweenSequence {
    const sequence = new TweenSequence();
    sequence.tweens = tweens;
    return sequence;
  }

  /** Append a tween to the sequence */
  append(tween: Tween): this {
    this.tweens.push(tween);
    return this;
  }

  /** Callback when entire sequence completes */
  onComplete(callback: () => void): this {
    this.onCompleteCallback = callback;
    return this;
  }

  /** Start the sequence */
  start(manager: TweenManager): this {
    if (this.tweens.length === 0) {
      this.state = 'completed';
      return this;
    }

    this.manager = manager;
    this.state = 'running';
    this.currentIndex = 0;

    this.startCurrentTween();
    return this;
  }

  private startCurrentTween(): void {
    if (this.currentIndex >= this.tweens.length) {
      this.state = 'completed';
      this.onCompleteCallback?.();
      return;
    }

    const current = this.tweens[this.currentIndex]!;
    current.onComplete(() => {
      this.currentIndex++;
      this.startCurrentTween();
    });
    current.start(this.manager!);
  }

  getState(): TweenState {
    return this.state;
  }
}

// ============================================================================
// TweenParallel
// ============================================================================

/**
 * A group of tweens that play simultaneously.
 */
export class TweenParallel {
  private tweens: Tween[] = [];
  private activeTweens: Set<Tween> = new Set();
  private state: TweenState = 'idle';

  private onCompleteCallback?: () => void;

  private constructor() {}

  /** Create a parallel group from tweens */
  static create(...tweens: Tween[]): TweenParallel {
    const parallel = new TweenParallel();
    parallel.tweens = tweens;
    return parallel;
  }

  /** Add a tween to the group */
  add(tween: Tween): this {
    this.tweens.push(tween);
    return this;
  }

  /** Callback when all tweens complete */
  onComplete(callback: () => void): this {
    this.onCompleteCallback = callback;
    return this;
  }

  /** Start all tweens */
  start(manager: TweenManager): this {
    if (this.tweens.length === 0) {
      this.state = 'completed';
      return this;
    }

    this.state = 'running';
    this.activeTweens = new Set(this.tweens);

    for (const tween of this.tweens) {
      tween.onComplete(() => {
        this.activeTweens.delete(tween);
        if (this.activeTweens.size === 0) {
          this.state = 'completed';
          this.onCompleteCallback?.();
        }
      });
      tween.start(manager);
    }

    return this;
  }

  getState(): TweenState {
    return this.state;
  }
}

// ============================================================================
// TweenManager
// ============================================================================

/**
 * Manages and updates all active tweens.
 * Register as a resource with your Application.
 */
export class TweenManager {
  private tweens: Set<Tween> = new Set();
  private toAdd: Tween[] = [];
  private toRemove: Tween[] = [];
  private isUpdating: boolean = false;

  /** Add a tween to be managed */
  add(tween: Tween): void {
    if (this.isUpdating) {
      this.toAdd.push(tween);
    } else {
      this.tweens.add(tween);
    }
  }

  /** Remove a tween from management */
  remove(tween: Tween): void {
    if (this.isUpdating) {
      this.toRemove.push(tween);
    } else {
      this.tweens.delete(tween);
    }
  }

  /** Update all managed tweens */
  update(deltaTime: number): void {
    this.isUpdating = true;

    for (const tween of this.tweens) {
      const stillActive = tween.update(deltaTime);
      if (!stillActive) {
        this.toRemove.push(tween);
      }
    }

    this.isUpdating = false;

    // Process deferred additions/removals
    for (const tween of this.toAdd) {
      this.tweens.add(tween);
    }
    this.toAdd.length = 0;

    for (const tween of this.toRemove) {
      this.tweens.delete(tween);
    }
    this.toRemove.length = 0;
  }

  /** Stop and remove all tweens */
  clear(): void {
    for (const tween of this.tweens) {
      tween.stop();
    }
    this.tweens.clear();
    this.toAdd.length = 0;
    this.toRemove.length = 0;
  }

  /** Get the number of active tweens */
  getCount(): number {
    return this.tweens.size;
  }

  /** Check if any tweens are active */
  hasActiveTweens(): boolean {
    return this.tweens.size > 0;
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Simple linear interpolation between two values.
 */
export function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * t;
}

/**
 * Interpolate between two values with clamped t.
 */
export function lerpClamped(from: number, to: number, t: number): number {
  return lerp(from, to, Math.max(0, Math.min(1, t)));
}

/**
 * Calculate progress for smooth damping (useful for camera follow).
 * Returns a t value that creates smooth decay.
 */
export function smoothDamp(smoothTime: number, deltaTime: number): number {
  return 1 - Math.exp(-deltaTime / Math.max(0.0001, smoothTime));
}

/**
 * Move towards a target value at a constant speed.
 */
export function moveTowards(current: number, target: number, maxDelta: number): number {
  const diff = target - current;
  if (Math.abs(diff) <= maxDelta) {
    return target;
  }
  return current + Math.sign(diff) * maxDelta;
}

/**
 * Ping-pong a value between 0 and length.
 */
export function pingPong(t: number, length: number): number {
  const cycle = t % (length * 2);
  return cycle > length ? length * 2 - cycle : cycle;
}

/**
 * Repeat a value in the range [0, length].
 */
export function repeat(t: number, length: number): number {
  return t - Math.floor(t / length) * length;
}

// Register TweenManager as a resource (internal, not serializable)
import { registerResource } from '../ecs/resource.js';
registerResource(TweenManager, false, {
  path: 'animation',
  displayName: 'Tween Manager',
  description: 'Manages active tween animations',
  builtIn: true,
});
