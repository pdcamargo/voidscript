/**
 * Post-Processing Module
 *
 * Provides Unity-style post-processing support for the VoidScript engine.
 * Add the PostProcessing component to a camera entity to enable effects.
 */

// Types
export * from "./types.js";

// Registry
export {
  EFFECT_REGISTRY,
  getEffectMetadata,
  getEffectsByCategory,
  getEffectCategories,
  formatCategoryName,
} from "./effect-registry.js";

// Factory
export { createPass, updatePass, disposePass } from "./effect-factory.js";

// Manager
export { PostProcessingManager } from "./managers/post-processing-manager.js";
