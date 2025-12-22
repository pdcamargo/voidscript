import { component } from '@voidscript/engine';

export interface SunLightData {
  /** true for ambient light, false for directional */
  isAmbient: boolean;
}

/**
 * SunLight Component
 *
 * Marker component to identify sun/main lights that should be affected by weather.
 * Attach this to Light3D entities that should change when entering/exiting forests.
 */
export const SunLight = component<SunLightData>(
  'SunLight',
  {
    isAmbient: { serializable: true },
  },
  {
    displayName: 'Sun Light',
    description: 'Marker for sun/main light affected by weather',
    path: 'game/lighting',
    defaultValue: () => ({ isAmbient: false }),
  },
);
