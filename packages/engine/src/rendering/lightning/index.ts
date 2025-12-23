/**
 * Lightning Rendering Module
 *
 * Provides materials and utilities for rendering procedural lightning effects.
 */

export {
  Lightning2DMaterial,
} from './Lightning2DMaterial.js';

export {
  createLightningUniforms,
  updateLightningUniforms,
  lightningVertexShader,
  lightningFragmentShader,
  MAX_BOLTS,
  MAX_SEGMENTS,
  type LightningUniforms,
  type LightningMaterialOptions,
  type BoltState,
} from './lightning-shader-utils.js';
