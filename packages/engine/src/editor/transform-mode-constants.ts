/**
 * Transform mode keyboard shortcuts
 *
 * Matches Unity/Unreal conventions:
 * - W: Translate (move)
 * - E: Rotate
 * - R: Scale
 */

import { KeyCode } from '../app/input.js';

export const TRANSFORM_MODE_SHORTCUTS = {
  TRANSLATE: KeyCode.KeyW,
  ROTATE: KeyCode.KeyE,
  SCALE: KeyCode.KeyR,
} as const;
