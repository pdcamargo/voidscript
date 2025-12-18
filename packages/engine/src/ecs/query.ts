/**
 * Query System - Type-safe entity queries
 *
 * Supports All/None/Any/Exclusive filters with full TypeScript type inference.
 */

import type { ComponentType } from './component.js';
import type { Entity } from './entity.js';
import type { World } from './world.js';

/**
 * Extract component data type from ComponentType
 */
type ComponentData<T> = T extends ComponentType<infer U> ? U : never;

/**
 * Tuple of component data types from array of ComponentTypes
 */
type ComponentDataTuple<T extends readonly ComponentType[]> = {
  [K in keyof T]: ComponentData<T[K]>;
};

/**
 * Query Builder - Fluent API for entity queries
 *
 * @example
 * ```ts
 * // All: entities WITH Position AND Velocity
 * world.query()
 *   .all(Position, Velocity)
 *   .each((entity, pos, vel) => {
 *     pos.x += vel.x;
 *   });
 *
 * // None: entities WITH Pickaxe EXCEPT Elvesto
 * world.query()
 *   .all(Pickaxe)
 *   .none(Elvesto)
 *   .each((entity, pickaxe) => {
 *     mine(entity);
 *   });
 *
 * // Any: entities WITH Sword OR Axe OR Bow
 * world.query()
 *   .any(Sword, Axe, Bow)
 *   .each((entity) => {
 *     defend(entity);
 *   });
 *
 * // Exclusive: entities with EXACTLY Dwarf AND NewType
 * world.query()
 *   .exclusive(Dwarf, NewType)
 *   .each((entity, dwarf, newType) => {
 *     specialTask(entity);
 *   });
 * ```
 */
export class Query<
  TAll extends readonly ComponentType[] = [],
  TAny extends readonly ComponentType[] = [],
  TNone extends readonly ComponentType[] = [],
  TExclusive extends readonly ComponentType[] = [],
> {
  private allTypes: ComponentType[] = [];
  private anyTypes: ComponentType[] = [];
  private noneTypes: ComponentType[] = [];
  private exclusiveTypes: ComponentType[] = [];

  constructor(private world: World) {}

  /**
   * All filter: entities must have ALL specified components
   *
   * @example
   * ```ts
   * world.query()
   *   .all(Position, Velocity)
   *   .each((entity, pos, vel) => {
   *     // pos and vel are fully typed
   *   });
   * ```
   */
  all<T extends readonly ComponentType[]>(
    ...types: T
  ): Query<T, TAny, TNone, TExclusive> {
    const query = new Query<T, TAny, TNone, TExclusive>(this.world);
    query.allTypes = [...types];
    query.anyTypes = this.anyTypes;
    query.noneTypes = this.noneTypes;
    query.exclusiveTypes = this.exclusiveTypes;
    return query;
  }

  /**
   * Any filter: entities must have AT LEAST ONE of specified components
   *
   * @example
   * ```ts
   * world.query()
   *   .any(Sword, Axe, Bow)
   *   .each((entity) => {
   *     // Use hasComponent to check which weapon
   *   });
   * ```
   */
  any<T extends readonly ComponentType[]>(
    ...types: T
  ): Query<TAll, T, TNone, TExclusive> {
    const query = new Query<TAll, T, TNone, TExclusive>(this.world);
    query.allTypes = this.allTypes;
    query.anyTypes = [...types];
    query.noneTypes = this.noneTypes;
    query.exclusiveTypes = this.exclusiveTypes;
    return query;
  }

  /**
   * None filter: entities must NOT have any specified components
   *
   * @example
   * ```ts
   * world.query()
   *   .all(Pickaxe)
   *   .none(Elvesto)
   *   .each((entity, pickaxe) => {
   *     // All entities with pickaxe except Elvesto
   *   });
   * ```
   */
  none<T extends readonly ComponentType[]>(
    ...types: T
  ): Query<TAll, TAny, T, TExclusive> {
    const query = new Query<TAll, TAny, T, TExclusive>(this.world);
    query.allTypes = this.allTypes;
    query.anyTypes = this.anyTypes;
    query.noneTypes = [...types];
    query.exclusiveTypes = this.exclusiveTypes;
    return query;
  }

  /**
   * Exclusive filter: entities must have EXACTLY these components (no more, no less)
   *
   * @example
   * ```ts
   * world.query()
   *   .exclusive(Dwarf, NewType)
   *   .each((entity, dwarf, newType) => {
   *     // Only entities with exactly these two components
   *   });
   * ```
   */
  exclusive<T extends readonly ComponentType[]>(
    ...types: T
  ): Query<[], [], [], T> {
    const query = new Query<[], [], [], T>(this.world);
    query.allTypes = [];
    query.anyTypes = [];
    query.noneTypes = [];
    query.exclusiveTypes = [...types];
    return query;
  }

  /**
   * Execute query and iterate results
   *
   * Type safety: callback parameters are inferred from query filters
   *
   * @example
   * ```ts
   * world.query()
   *   .all(Position, Velocity)
   *   .each((entity, pos, vel) => {
   *     // pos: PositionData, vel: VelocityData
   *     pos.x += vel.x;
   *   });
   * ```
   */
  each(
    callback: TExclusive extends readonly [any, ...any[]]
      ? (entity: Entity, ...components: ComponentDataTuple<TExclusive>) => void
      : TAll extends readonly [any, ...any[]]
        ? (entity: Entity, ...components: ComponentDataTuple<TAll>) => void
        : (entity: Entity) => void,
  ): void {
    this.world.executeQuery(
      this.allTypes,
      this.anyTypes,
      this.noneTypes,
      this.exclusiveTypes,
      callback,
    );
  }

  map<T>(callback: (entity: Entity, ...components: any[]) => T): T[] {
    const results: T[] = [];
    this.world.executeQuery(
      this.allTypes,
      this.anyTypes,
      this.noneTypes,
      this.exclusiveTypes,
      (entity: Entity, ...components: any[]) => {
        results.push(callback(entity, ...components));
      },
    );
    return results;
  }

  /**
   * Get first entity matching query
   * @returns First entity or undefined if no matches
   */
  first():
    | (TExclusive extends readonly [any, ...any[]]
        ? { entity: Entity; components: ComponentDataTuple<TExclusive> }
        : TAll extends readonly [any, ...any[]]
          ? { entity: Entity; components: ComponentDataTuple<TAll> }
          : { entity: Entity })
    | undefined {
    let result:
      | { entity: Entity; components: any[] }
      | { entity: Entity }
      | undefined = undefined;

    (this.each as any)((entity: Entity, ...components: any[]) => {
      if (!result) {
        if (components.length > 0) {
          result = { entity, components };
        } else {
          result = { entity };
        }
      }
    });

    return result as any;
  }

  /**
   * Count entities matching query
   */
  count(): number {
    let count = 0;
    (this.each as any)(() => {
      count++;
    });
    return count;
  }

  /**
   * Check if any entities match query
   */
  isEmpty(): boolean {
    return this.count() === 0;
  }

  /**
   * Collect all matching entities into array
   * @returns Array of entities
   */
  entities(): Entity[] {
    const entities: Entity[] = [];
    (this.each as any)((entity: Entity) => {
      entities.push(entity);
    });
    return entities;
  }
}
