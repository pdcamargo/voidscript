/**
 * Entity Query Evaluator
 *
 * Evaluates parsed queries against entities to determine if they match.
 */

import type { Entity } from '@voidscript/core';
import type { Scene } from '@voidscript/core';
import type {
  ParsedQuery,
  QueryFilter,
  QueryTerm,
  AndExpression,
} from './entity-query-parser.js';
import { globalComponentRegistry, type ComponentType } from '@voidscript/core';
import { Name } from '@voidscript/core';

/**
 * Cache for case-insensitive component name lookups
 * Maps lowercase name -> ComponentType
 */
let componentNameCache: Map<string, ComponentType> | null = null;
let cacheVersion = 0;

/**
 * Build or refresh the case-insensitive component name cache
 */
function getComponentByNameCaseInsensitive(name: string): ComponentType | undefined {
  // Rebuild cache if registry has changed (simple version check based on count)
  const currentCount = globalComponentRegistry.getAll().length;
  if (componentNameCache === null || cacheVersion !== currentCount) {
    componentNameCache = new Map();
    for (const comp of globalComponentRegistry.getAll()) {
      componentNameCache.set(comp.name.toLowerCase(), comp);
    }
    cacheVersion = currentCount;
  }

  return componentNameCache.get(name.toLowerCase());
}

/**
 * Check if a single filter matches an entity
 */
function evaluateFilter(
  entity: Entity,
  scene: Scene,
  filter: QueryFilter,
): boolean {
  switch (filter.type) {
    case 'name': {
      const nameComp = scene.getComponent(entity, Name);
      const displayName = nameComp?.name || `Entity #${entity}`;
      return displayName.toLowerCase().includes(filter.value.toLowerCase());
    }

    case 'hasComponent': {
      // Entity must have ALL components in the list
      return filter.names.every((name) => {
        const compType = getComponentByNameCaseInsensitive(name);
        return compType ? scene.hasComponent(entity, compType) : false;
      });
    }

    case 'hasAnyComponent': {
      // Entity must have AT LEAST ONE component in the list
      return filter.names.some((name) => {
        const compType = getComponentByNameCaseInsensitive(name);
        return compType ? scene.hasComponent(entity, compType) : false;
      });
    }

    case 'notComponent': {
      // Entity must NOT have ANY of these components
      return filter.names.every((name) => {
        const compType = getComponentByNameCaseInsensitive(name);
        // If component type doesn't exist, treat as "not having it"
        return compType ? !scene.hasComponent(entity, compType) : true;
      });
    }
  }
}

/**
 * Check if a term matches an entity (all filters must pass)
 */
function evaluateTerm(entity: Entity, scene: Scene, term: QueryTerm): boolean {
  return term.filters.every((filter) => evaluateFilter(entity, scene, filter));
}

/**
 * Check if an AND expression matches (all terms must pass)
 */
function evaluateAndExpression(
  entity: Entity,
  scene: Scene,
  expr: AndExpression,
): boolean {
  return expr.terms.every((term) => evaluateTerm(entity, scene, term));
}

/**
 * Check if an entity matches a parsed query
 *
 * The query is in Disjunctive Normal Form (DNF):
 * - Top level: OR of expressions (any must match)
 * - Second level: AND of terms (all must match)
 * - Third level: Individual filters within a term (all must match)
 *
 * @param entity - The entity to check
 * @param scene - The scene containing the entity
 * @param query - The parsed query to evaluate
 * @returns true if the entity matches the query
 */
export function evaluateQuery(
  entity: Entity,
  scene: Scene,
  query: ParsedQuery,
): boolean {
  // Empty query matches everything
  if (query.orExpressions.length === 0) {
    return true;
  }

  // Any OR expression matching is sufficient
  return query.orExpressions.some((expr) =>
    evaluateAndExpression(entity, scene, expr),
  );
}
