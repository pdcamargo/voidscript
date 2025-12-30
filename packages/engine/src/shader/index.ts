/**
 * Shader Module - VoidShader Language (VSL) and Shader Management
 *
 * A Godot-inspired shader language system that transpiles to THREE.js GLSL.
 * Provides shader compilation, material creation, and runtime management.
 *
 * @example
 * ```typescript
 * import { ShaderAsset, ShaderManager, MaterialFactory } from '@voidscript/engine';
 *
 * // Compile a shader from source
 * const shader = ShaderAsset.fromSource(`
 *   shader_type canvas_item;
 *   uniform float wave_speed = 1.0;
 *
 *   void fragment() {
 *     COLOR = texture(TEXTURE, UV);
 *   }
 * `);
 *
 * // Create a material
 * const material = shader.createMaterial({ wave_speed: 2.0 });
 * ```
 */

// ============================================================================
// VSL Language (Lexer, Parser, Transpiler)
// ============================================================================

export * from './vsl/index.js';

// ============================================================================
// Shader Asset
// ============================================================================

export { ShaderAsset, compileShader } from './shader-asset.js';
export type { UniformValue, ShaderUniform } from './shader-asset.js';

// ============================================================================
// Shader Manager (Runtime Resource)
// ============================================================================

export { ShaderManager } from './shader-manager.js';

// ============================================================================
// Shader Library (Reusable Snippets)
// ============================================================================

export { ShaderLibrary } from './shader-library.js';
export type { ShaderSnippet } from './shader-library.js';

// ============================================================================
// Material Factory
// ============================================================================

export { MaterialFactory } from './material-factory.js';
export type { SpriteMaterialOptions } from './material-factory.js';
