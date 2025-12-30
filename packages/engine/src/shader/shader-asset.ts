/**
 * ShaderAsset - Compiled VoidShader Language (.vsl) asset
 *
 * Holds the source code, compiled GLSL shaders, and provides material creation.
 * Works with RuntimeAsset for lazy loading and the asset system.
 */

import * as THREE from 'three';
import type { ShaderAST } from './vsl/ast.js';
import type { TranspiledShader, TranspiledUniform, MaterialOptions } from './vsl/transpiler.js';
import { parse } from './vsl/parser.js';
import { transpile } from './vsl/transpiler.js';

/**
 * Uniform value types that can be set on a shader
 */
export type UniformValue =
  | number
  | boolean
  | THREE.Vector2
  | THREE.Vector3
  | THREE.Vector4
  | THREE.Color
  | THREE.Matrix3
  | THREE.Matrix4
  | THREE.Texture
  | null;

/**
 * Shader uniform definition with current value
 */
export interface ShaderUniform {
  name: string;
  type: string;
  value: THREE.IUniform<unknown>;
  hint?: {
    type: string;
    params?: number[];
  };
  isBuiltIn: boolean;
}

/**
 * ShaderAsset - Compiled shader ready for use
 *
 * @example
 * ```typescript
 * // Create from source
 * const shader = ShaderAsset.fromSource(`
 *   shader_type canvas_item;
 *   uniform float wave_speed = 1.0;
 *
 *   void fragment() {
 *     COLOR = texture(TEXTURE, UV);
 *   }
 * `);
 *
 * // Create a material instance
 * const material = shader.createMaterial();
 * material.uniforms.wave_speed.value = 2.0;
 * ```
 */
export class ShaderAsset {
  /** Original VSL source code */
  readonly source: string;

  /** Parsed AST */
  readonly ast: ShaderAST;

  /** Transpiled shader result */
  readonly transpiled: TranspiledShader;

  /** Compiled vertex shader GLSL */
  readonly vertexShader: string;

  /** Compiled fragment shader GLSL */
  readonly fragmentShader: string;

  /** Uniform definitions */
  readonly uniforms: TranspiledUniform[];

  /** Material options from render modes */
  readonly materialOptions: MaterialOptions;

  private constructor(
    source: string,
    ast: ShaderAST,
    transpiled: TranspiledShader,
  ) {
    this.source = source;
    this.ast = ast;
    this.transpiled = transpiled;
    this.vertexShader = transpiled.vertexShader;
    this.fragmentShader = transpiled.fragmentShader;
    this.uniforms = transpiled.uniforms;
    this.materialOptions = transpiled.materialOptions;
  }

  /**
   * Create a ShaderAsset from VSL source code
   *
   * @param source - VSL source code
   * @returns Compiled ShaderAsset
   * @throws Error if parsing or transpilation fails
   */
  static fromSource(source: string): ShaderAsset {
    const ast = parse(source);
    const transpiled = transpile(ast);

    if (transpiled.errors.length > 0) {
      const errorMessages = transpiled.errors.map((e) => e.message).join('\n');
      throw new Error(`Shader transpilation failed:\n${errorMessages}`);
    }

    return new ShaderAsset(source, ast, transpiled);
  }

  /**
   * Create default uniform values for this shader
   */
  createDefaultUniforms(): Record<string, THREE.IUniform<unknown>> {
    const result: Record<string, THREE.IUniform<unknown>> = {};

    for (const uniform of this.uniforms) {
      result[uniform.name] = { value: this.getDefaultUniformValue(uniform) };
    }

    return result;
  }

  /**
   * Create a THREE.ShaderMaterial from this shader
   *
   * @param customUniforms - Optional override uniform values
   * @returns Configured ShaderMaterial
   */
  createMaterial(
    customUniforms?: Record<string, unknown>,
  ): THREE.ShaderMaterial {
    let uniforms = this.createDefaultUniforms();

    // Merge with THREE.js lighting uniforms when lights are enabled
    // This provides ambientLightColor and other lighting uniforms automatically
    if (this.materialOptions.lights) {
      uniforms = THREE.UniformsUtils.merge([
        THREE.UniformsLib.lights,
        uniforms,
      ]) as Record<string, THREE.IUniform<unknown>>;
    }

    // Apply custom uniform values
    if (customUniforms) {
      for (const [name, value] of Object.entries(customUniforms)) {
        if (uniforms[name]) {
          uniforms[name].value = value;
        }
      }
    }

    const material = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: this.vertexShader,
      fragmentShader: this.fragmentShader,
      transparent: this.materialOptions.transparent,
      depthTest: this.materialOptions.depthTest,
      depthWrite: this.materialOptions.depthWrite,
      side: this.getSide(),
      lights: this.materialOptions.lights,
    });

    // Set blending mode
    if (this.materialOptions.blending) {
      switch (this.materialOptions.blending) {
        case 'additive':
          material.blending = THREE.AdditiveBlending;
          break;
        case 'multiply':
          material.blending = THREE.MultiplyBlending;
          break;
        case 'subtractive':
          material.blending = THREE.SubtractiveBlending;
          break;
        default:
          material.blending = THREE.NormalBlending;
      }
    }

    return material;
  }

  /**
   * Get the shader type (canvas_item, spatial, particles)
   */
  get shaderType(): string {
    return this.ast.shaderType;
  }

  /**
   * Get render modes active in this shader
   */
  get renderModes(): string[] {
    return this.ast.renderModes;
  }

  /**
   * Get user-defined uniform names (excluding built-ins)
   */
  get userUniformNames(): string[] {
    return this.uniforms
      .filter((u) => !u.isBuiltIn)
      .map((u) => u.name);
  }

  /**
   * Check if this shader has a vertex function
   */
  get hasVertexFunction(): boolean {
    return this.ast.functions.some((f) => f.name === 'vertex');
  }

  /**
   * Check if this shader has a fragment function
   */
  get hasFragmentFunction(): boolean {
    return this.ast.functions.some((f) => f.name === 'fragment');
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  private getSide(): THREE.Side {
    switch (this.materialOptions.side) {
      case 'front':
        return THREE.FrontSide;
      case 'back':
        return THREE.BackSide;
      case 'double':
        return THREE.DoubleSide;
      default:
        return THREE.FrontSide;
    }
  }

  private getDefaultUniformValue(uniform: TranspiledUniform): unknown {
    // Handle array uniforms - THREE.js requires Float32Array for uniform arrays
    if (uniform.arraySize && uniform.arraySize > 0) {
      return this.getArrayDefault(uniform.type, uniform.arraySize);
    }

    // Parse default value if provided
    if (uniform.defaultValue) {
      return this.parseDefaultValue(uniform.type, uniform.defaultValue);
    }

    // Built-in defaults
    if (uniform.isBuiltIn) {
      switch (uniform.name) {
        case 'vsl_time':
        case 'vsl_deltaTime':
          return 0;
        case 'vsl_screenSize':
        case 'vsl_textureSize':
          return new THREE.Vector2(1, 1);
        case 'map':
        case 'vsl_screenTexture':
          return null;
        default:
          return this.getTypeDefault(uniform.type);
      }
    }

    return this.getTypeDefault(uniform.type);
  }

  private getArrayDefault(type: string, size: number): unknown {
    // THREE.js requires Float32Array for float array uniforms
    switch (type) {
      case 'float':
        return new Float32Array(size);
      case 'int':
      case 'uint':
        return new Int32Array(size);
      case 'vec2':
        // Array of vec2 = size * 2 floats
        return new Float32Array(size * 2);
      case 'vec3':
        // Array of vec3 = size * 3 floats
        return new Float32Array(size * 3);
      case 'vec4':
        // Array of vec4 = size * 4 floats
        return new Float32Array(size * 4);
      default:
        // Fallback to Float32Array for unknown types
        return new Float32Array(size);
    }
  }

  private getTypeDefault(type: string): unknown {
    switch (type) {
      case 'bool':
        return false;
      case 'int':
      case 'uint':
      case 'float':
        return 0;
      case 'vec2':
        return new THREE.Vector2(0, 0);
      case 'vec3':
        return new THREE.Vector3(0, 0, 0);
      case 'vec4':
        return new THREE.Vector4(0, 0, 0, 1);
      case 'mat3':
        return new THREE.Matrix3();
      case 'mat4':
        return new THREE.Matrix4();
      case 'sampler2D':
      case 'samplerCube':
        return null;
      default:
        return 0;
    }
  }

  private parseDefaultValue(type: string, value: string): unknown {
    // Handle simple number values
    if (type === 'float' || type === 'int' || type === 'uint') {
      return parseFloat(value);
    }

    if (type === 'bool') {
      return value === 'true';
    }

    // Handle vector constructors like "vec3(1.0, 0.0, 0.0)"
    const vecMatch = value.match(/^(vec[234]|ivec[234]|uvec[234])\s*\(\s*(.+)\s*\)$/);
    if (vecMatch && vecMatch[2]) {
      const components = vecMatch[2].split(',').map((c) => parseFloat(c.trim()));
      switch (type) {
        case 'vec2':
        case 'ivec2':
        case 'uvec2':
          return new THREE.Vector2(components[0] ?? 0, components[1] ?? 0);
        case 'vec3':
        case 'ivec3':
        case 'uvec3':
          return new THREE.Vector3(components[0] ?? 0, components[1] ?? 0, components[2] ?? 0);
        case 'vec4':
        case 'ivec4':
        case 'uvec4':
          return new THREE.Vector4(
            components[0] ?? 0,
            components[1] ?? 0,
            components[2] ?? 0,
            components[3] ?? 1,
          );
      }
    }

    return this.getTypeDefault(type);
  }
}

/**
 * Compile VSL source to a ShaderAsset
 * Convenience function equivalent to ShaderAsset.fromSource()
 */
export function compileShader(source: string): ShaderAsset {
  return ShaderAsset.fromSource(source);
}
