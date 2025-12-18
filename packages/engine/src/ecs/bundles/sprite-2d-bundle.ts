/**
 * Example Bundle: Sprite2D Entity
 *
 * A bundle for spawning 2D sprite entities with Transform3D and Sprite2D components.
 * Demonstrates required, optional, and hidden properties.
 */

import {
  componentConfig,
  requiredProperty,
  optionalProperty,
  hiddenProperty,
} from '../bundle.js';
import { registerBundle } from '../bundle-registry.js';
import { Transform3D } from '../components/rendering/transform-3d.js';
import { Sprite2D } from '../components/rendering/sprite-2d.js';
import { Vector3 } from '../../math/index.js';
import type { RuntimeAsset } from '../runtime-asset.js';

/**
 * Sprite2D Bundle
 *
 * A bundle for spawning 2D sprite entities.
 *
 * Required properties:
 * - transform.position: Vector3 - The position of the sprite in 3D space
 *
 * Optional properties:
 * - transform.rotation: Vector3 - The rotation of the sprite (defaults to zero)
 * - transform.scale: Vector3 - The scale of the sprite (defaults to 1, 1, 1)
 * - sprite.texture: RuntimeAsset | null - The texture to use (defaults to null)
 * - sprite.color: {r, g, b, a} - The tint color (defaults to white)
 * - All other Sprite2D properties use component defaults
 *
 * Hidden properties:
 * - sprite.pixelsPerUnit: Always 100 (cannot be overridden at spawn)
 *
 * @example
 * ```ts
 * import { Sprite2DBundle } from '@voidscript/engine/ecs/bundles';
 *
 * // Minimal usage with just required properties
 * commands.spawn().withBundle(Sprite2DBundle, {
 *   transform: {
 *     position: new Vector3(10, 5, 0)
 *   }
 * }).build();
 *
 * // With optional property overrides
 * commands.spawn().withBundle(Sprite2DBundle, {
 *   transform: {
 *     position: new Vector3(10, 5, 0),
 *     rotation: new Vector3(0, 0, Math.PI / 4),
 *     scale: new Vector3(2, 2, 1)
 *   },
 *   sprite: {
 *     texture: myTexture,
 *     color: { r: 1, g: 0, b: 0, a: 1 }
 *   }
 * }).build();
 * ```
 */
export const Sprite2DBundle = registerBundle('Sprite2D', {
  transform: componentConfig(Transform3D, {
    position: requiredProperty<Vector3>(),
    rotation: optionalProperty<Vector3>({ default: () => new Vector3(0, 0, 0) }),
    scale: optionalProperty<Vector3>({ default: () => new Vector3(1, 1, 1) }),
  }),
  sprite: componentConfig(Sprite2D, {
    texture: optionalProperty<RuntimeAsset | null>({ default: null }),
    color: optionalProperty<{ r: number; g: number; b: number; a: number }>({
      default: { r: 1, g: 1, b: 1, a: 1 },
    }),
    pixelsPerUnit: hiddenProperty({ default: 100 }), // Hidden from spawn API
  }),
});
