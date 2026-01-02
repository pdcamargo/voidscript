/**
 * Name Component
 *
 * Stores a friendly name for entities to display in the editor hierarchy.
 * If not present or empty, the entity label falls back to "Entity #ID (Components...)".
 */

import { component } from '../component.js';

export interface NameData {
  /**
   * Display name for this entity in the editor
   * Can be empty string (will show as "Unnamed Entity" in hierarchy)
   */
  name: string;
}

export const Name = component<NameData>(
  'Name',
  {
    name: {
      serializable: true,
      instanceType: String,
    },
  },
  {
    displayName: 'Name',
    description: 'The name of the entity',
    path: 'ecs/name',
    defaultValue: () => {
      return {
        name: '',
      };
    },
  },
);
