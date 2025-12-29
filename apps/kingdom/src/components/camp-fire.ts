/**
 * CampFire Component
 *
 * Marker component for the campfire entity.
 * The campfire is the central building of the kingdom.
 * Position is managed by BuildingManager and synced to Transform3D.
 */

import { component } from '@voidscript/engine';

/**
 * CampFire component data (empty marker).
 */
export interface CampFireData {}

/**
 * CampFire marker component.
 */
export const CampFire = component<CampFireData>(
  'CampFire',
  {},
  {
    path: 'kingdom/camp-fire',
    defaultValue: () => ({}),
  },
);
