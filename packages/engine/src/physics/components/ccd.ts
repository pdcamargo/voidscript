/**
 * CCD (Continuous Collision Detection) Component
 *
 * Prevents fast-moving objects from tunneling through thin obstacles.
 * Shared between 2D and 3D physics.
 *
 * Use CCD for:
 * - Projectiles (bullets, arrows)
 * - Fast-moving player characters
 * - Any object that might move > collider size per frame
 *
 * Trade-off: More accurate collision detection but higher CPU cost.
 * Only enable for objects that truly need it.
 */

import { component } from '@voidscript/core';
import { EditorLayout } from '../../app/imgui/editor-layout.js';

export interface CcdData {
  /** Enable continuous collision detection (prevents tunneling at high speeds) */
  enabled: boolean;
}

export const Ccd = component<CcdData>(
  'Ccd',
  {
    enabled: {
      serializable: true,
      instanceType: Boolean,
    },
  },
  {
    path: 'physics',
    defaultValue: () => ({ enabled: false }),
    displayName: 'Continuous Collision Detection',
    description: 'Prevents fast-moving objects from tunneling through colliders',
    customEditor: ({ componentData }) => {
      EditorLayout.beginLabelsWidth(['Enabled']);

      const [enabled, changed] = EditorLayout.checkboxField(
        'Enabled',
        componentData.enabled,
        {
          tooltip: 'Enable CCD for projectiles and fast-moving objects (higher CPU cost)',
        }
      );
      if (changed) {
        componentData.enabled = enabled;
      }

      EditorLayout.endLabelsWidth();
    },
  },
);
