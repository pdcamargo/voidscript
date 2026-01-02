/**
 * Bundle Registry
 *
 * Global registry for bundles, similar to the component registry.
 * Allows bundles to be discovered and used in the editor.
 */

import type { BundleSchema, BundleType } from './bundle.js';
import { bundle } from './bundle.js';

/**
 * Registry for bundle types
 */
export class BundleRegistry {
  private bundles = new Map<string, BundleType<any>>();

  /**
   * Register a bundle type
   * If a bundle with the same name already exists, it will be overwritten
   * (useful for hot-reloading scenarios)
   */
  register<S extends BundleSchema>(bundleType: BundleType<S>): void {
    if (this.bundles.has(bundleType.name)) {
      console.warn(
        `Bundle "${bundleType.name}" already registered, overwriting`,
      );
    }
    this.bundles.set(bundleType.name, bundleType);
  }

  /**
   * Get bundle by name
   */
  get(name: string): BundleType<any> | undefined {
    return this.bundles.get(name);
  }

  /**
   * Check if bundle is registered
   */
  has(name: string): boolean {
    return this.bundles.has(name);
  }

  /**
   * Get all registered bundles
   */
  getAll(): BundleType<any>[] {
    return Array.from(this.bundles.values());
  }

  /**
   * Clear all registered bundles
   */
  clear(): void {
    this.bundles.clear();
  }
}

/**
 * Global bundle registry instance
 */
export const globalBundleRegistry = new BundleRegistry();

/**
 * Helper to create and auto-register a bundle
 *
 * @param name - Bundle name (used for registry and debugging)
 * @param schema - Bundle schema
 * @returns Bundle type
 *
 * @example
 * ```ts
 * export const Sprite2DBundle = registerBundle('Sprite2D', {
 *   transform: {
 *     component: Transform3D,
 *     properties: {
 *       position: requiredProperty<Vector3>()
 *     }
 *   },
 *   sprite: {
 *     component: Sprite2D
 *   }
 * });
 * ```
 */
export function registerBundle<const S extends BundleSchema>(
  name: string,
  schema: S,
): BundleType<S> {
  const bundleType = bundle(schema, name);
  globalBundleRegistry.register(bundleType);
  return bundleType;
}
