/**
 * Sprite2DMaterial Component
 *
 * Optional companion component to Sprite2D that allows applying
 * custom VSL shaders to sprites. When attached to an entity with
 * Sprite2D, overrides the default sprite material with a custom shader.
 *
 * @example
 * ```typescript
 * // In scene setup:
 * commands.spawn()
 *   .with(Transform3D, { position: new Vector3(0, 0, 0) })
 *   .with(Sprite2D, { texture: myTexture })
 *   .with(Sprite2DMaterial, {
 *     shader: waterShaderAsset,
 *     uniforms: {
 *       wave_speed: 2.0,
 *       wave_amplitude: 0.1,
 *     },
 *   })
 *   .build();
 * ```
 */

import { component } from '../../component.js';
import { RuntimeAsset } from '../../runtime-asset.js';
import { AssetType } from '../../asset-metadata.js';
import { EditorLayout } from '../../../app/imgui/editor-layout.js';
import type { ShaderAsset } from '../../../shader/shader-asset.js';
import type { TranspiledUniform } from '../../../shader/vsl/transpiler.js';

/**
 * Serializable uniform value types
 * Complex types (Vector2, Vector3, etc.) are stored as plain objects
 */
export type UniformValue =
  | number
  | boolean
  | { x: number; y: number }
  | { x: number; y: number; z: number }
  | { x: number; y: number; z: number; w: number }
  | { r: number; g: number; b: number }
  | { r: number; g: number; b: number; a: number }
  | RuntimeAsset
  | null;

export interface Sprite2DMaterialData {
  /**
   * Reference to the shader asset (.vsl file)
   * null means use the default sprite shader
   */
  shader: RuntimeAsset | null;

  /**
   * Custom uniform values to pass to the shader
   * Keys should match uniform names defined in the VSL shader
   * Values are serializable representations (converted to THREE.js types at runtime)
   */
  uniforms: Record<string, UniformValue>;

  /**
   * Whether to create a unique material instance for this sprite
   * When true: Creates a new material instance (allows per-entity uniform changes)
   * When false: Shares material with other sprites using the same shader (more efficient)
   * @default true
   */
  uniqueInstance: boolean;

  /**
   * Whether the shader is currently enabled
   * When false, falls back to default sprite rendering
   * @default true
   */
  enabled: boolean;
}

export const Sprite2DMaterial = component<Sprite2DMaterialData>(
  'Sprite2DMaterial',
  {
    shader: {
      serializable: true,
      type: 'runtimeAsset',
      assetTypes: [AssetType.Shader],
      whenNullish: 'keep',
    },
    uniforms: {
      serializable: true,
      whenNullish: 'keep',
    },
    uniqueInstance: {
      serializable: true,
    },
    enabled: {
      serializable: true,
    },
  },
  {
    path: 'rendering/2d',
    defaultValue: () => ({
      shader: null,
      uniforms: {},
      uniqueInstance: true,
      enabled: true,
    }),
    displayName: 'Sprite 2D Material',
    description:
      'Custom shader material for Sprite2D. Requires Sprite2D component on the same entity.',
    customEditor: ({ componentData }) => {
      // === Shader Section ===
      if (EditorLayout.beginGroup('Shader', true)) {
        EditorLayout.beginLabelsWidth(['Shader', 'Enabled', 'Unique Instance']);

        // Shader asset picker
        const [shader, shaderChanged] = EditorLayout.runtimeAssetField(
          'Shader',
          componentData.shader,
          {
            assetTypes: [AssetType.Shader],
            tooltip: 'VSL shader file to use for this sprite',
          },
        );
        if (shaderChanged) {
          componentData.shader = shader;
          // Clear uniforms when shader changes
          componentData.uniforms = {};
        }

        // Enabled toggle
        const [enabled, enabledChanged] = EditorLayout.checkboxField(
          'Enabled',
          componentData.enabled,
          { tooltip: 'Whether to use the custom shader (unchecked = default sprite rendering)' },
        );
        if (enabledChanged) {
          componentData.enabled = enabled;
        }

        // Unique instance toggle
        const [unique, uniqueChanged] = EditorLayout.checkboxField(
          'Unique Instance',
          componentData.uniqueInstance,
          {
            tooltip:
              'Create a unique material instance for this sprite. Required for per-entity uniform changes.',
          },
        );
        if (uniqueChanged) {
          componentData.uniqueInstance = unique;
        }

        EditorLayout.endLabelsWidth();
        EditorLayout.endGroup();
      }

      // === Uniforms Section ===
      // Only show if shader is selected and loaded
      if (componentData.shader && componentData.shader.guid && componentData.shader.isLoaded) {
        const shaderAsset = componentData.shader.data as ShaderAsset;

        if (shaderAsset && shaderAsset.uniforms) {
          // Filter out built-in uniforms (user shouldn't edit TIME, TEXTURE, etc.)
          const userUniforms = shaderAsset.uniforms.filter((u) => !u.isBuiltIn);

          if (userUniforms.length > 0) {
            if (EditorLayout.beginGroup('Uniforms', true)) {
              // Calculate label width from uniform names
              const uniformLabels = userUniforms.map((u) => u.name);
              EditorLayout.beginLabelsWidth(uniformLabels);

              for (const uniform of userUniforms) {
                renderUniformEditor(componentData, uniform);
              }

              EditorLayout.endLabelsWidth();
              EditorLayout.endGroup();
            }
          } else {
            // No custom uniforms defined in shader
            if (EditorLayout.beginGroup('Uniforms', false)) {
              EditorLayout.textDisabled('No custom uniforms defined in shader');
              EditorLayout.endGroup();
            }
          }
        }
      } else if (componentData.shader && componentData.shader.guid && !componentData.shader.isLoaded) {
        // Shader is selected but not yet loaded
        if (EditorLayout.beginGroup('Uniforms', false)) {
          EditorLayout.textDisabled('Loading shader...');
          EditorLayout.endGroup();
        }
      }
    },
  },
);

// ============================================================================
// Uniform Editor Helpers
// ============================================================================

/**
 * Parse a default value string from the shader into a serializable format
 */
function parseDefaultValue(type: string, defaultValue: string | undefined): UniformValue {
  if (!defaultValue) {
    return getTypeDefault(type);
  }

  // Handle simple number values
  if (type === 'float' || type === 'int' || type === 'uint') {
    const parsed = parseFloat(defaultValue);
    return isNaN(parsed) ? 0 : parsed;
  }

  if (type === 'bool') {
    return defaultValue === 'true';
  }

  // Handle vector constructors like "vec2(1.0, 2.0)" or "vec4(0.0, 0.911, 1.0, 0.045)"
  const vecMatch = defaultValue.match(/^(vec[234]|ivec[234]|uvec[234])\s*\(\s*(.+)\s*\)$/);
  if (vecMatch && vecMatch[2]) {
    const components = vecMatch[2].split(',').map((c) => parseFloat(c.trim()));
    switch (type) {
      case 'vec2':
      case 'ivec2':
      case 'uvec2':
        return { x: components[0] ?? 0, y: components[1] ?? 0 };
      case 'vec3':
      case 'ivec3':
      case 'uvec3':
        return { x: components[0] ?? 0, y: components[1] ?? 0, z: components[2] ?? 0 };
      case 'vec4':
      case 'ivec4':
      case 'uvec4':
        return {
          x: components[0] ?? 0,
          y: components[1] ?? 0,
          z: components[2] ?? 0,
          w: components[3] ?? 1,
        };
    }
  }

  return getTypeDefault(type);
}

/**
 * Get default value for a GLSL type
 */
function getTypeDefault(type: string): UniformValue {
  switch (type) {
    case 'bool':
      return false;
    case 'int':
    case 'uint':
    case 'float':
      return 0;
    case 'vec2':
    case 'ivec2':
    case 'uvec2':
      return { x: 0, y: 0 };
    case 'vec3':
    case 'ivec3':
    case 'uvec3':
      return { x: 0, y: 0, z: 0 };
    case 'vec4':
    case 'ivec4':
    case 'uvec4':
      return { x: 0, y: 0, z: 0, w: 1 };
    case 'sampler2D':
    case 'samplerCube':
      return null;
    default:
      return 0;
  }
}

/**
 * Convert vec4 to RGBA color format for source_color uniforms
 */
function vec4ToColor(value: UniformValue): { r: number; g: number; b: number; a: number } | null {
  if (value && typeof value === 'object' && 'x' in value && 'y' in value && 'z' in value && 'w' in value) {
    return { r: value.x, g: value.y, b: value.z, a: value.w };
  }
  if (value && typeof value === 'object' && 'r' in value && 'g' in value && 'b' in value) {
    return { r: value.r, g: value.g, b: value.b, a: 'a' in value ? value.a : 1 };
  }
  return null;
}

/**
 * Render an editor for a single uniform based on its type and hints
 */
function renderUniformEditor(
  componentData: Sprite2DMaterialData,
  uniform: TranspiledUniform,
): void {
  const { name, type, defaultValue, hint } = uniform;

  // Get current value or initialize from shader default
  let currentValue = componentData.uniforms[name];
  if (currentValue === undefined) {
    // Initialize with shader's default value
    currentValue = parseDefaultValue(type, defaultValue);
    componentData.uniforms[name] = currentValue;
  }

  // Determine if this is a color uniform (source_color)
  const isColorUniform = hint?.type === 'source_color';

  // Determine if this has a range hint
  const hasRangeHint = hint?.type === 'hint_range' && hint.params && hint.params.length >= 2;

  // Determine if this is a texture uniform
  const isTextureUniform = type === 'sampler2D' || hint?.type === 'hint_texture';

  // Build tooltip with type info
  let tooltip = `Shader uniform: ${name} (${type})`;
  if (hasRangeHint) {
    tooltip += ` [${hint!.params![0]} - ${hint!.params![1]}]`;
  }

  // Render based on type and hints
  if (isTextureUniform) {
    // Texture uniform - use RuntimeAsset picker
    const textureAsset = currentValue instanceof RuntimeAsset ? currentValue : null;
    const [val, changed] = EditorLayout.runtimeAssetField(name, textureAsset, {
      assetTypes: [AssetType.Texture],
      tooltip: `${tooltip} - Texture asset`,
    });
    if (changed) {
      componentData.uniforms[name] = val;
    }
  } else if (type === 'bool') {
    const boolVal = typeof currentValue === 'boolean' ? currentValue : false;
    const [val, changed] = EditorLayout.checkboxField(name, boolVal, { tooltip });
    if (changed) {
      componentData.uniforms[name] = val;
    }
  } else if (type === 'float' || type === 'int' || type === 'uint') {
    const numVal = typeof currentValue === 'number' ? currentValue : 0;
    const isInteger = type === 'int' || type === 'uint';

    if (hasRangeHint) {
      // Use slider for hint_range
      const min = hint!.params![0]!;
      const max = hint!.params![1]!;

      if (isInteger) {
        const [val, changed] = EditorLayout.integerField(name, numVal, {
          min,
          max,
          useSlider: true,
          tooltip,
        });
        if (changed) {
          componentData.uniforms[name] = val;
        }
      } else {
        const [val, changed] = EditorLayout.numberField(name, numVal, {
          min,
          max,
          useSlider: true,
          tooltip,
        });
        if (changed) {
          componentData.uniforms[name] = val;
        }
      }
    } else {
      // Use drag input for numbers without range hint
      if (isInteger) {
        const [val, changed] = EditorLayout.integerField(name, numVal, { tooltip });
        if (changed) {
          componentData.uniforms[name] = val;
        }
      } else {
        const [val, changed] = EditorLayout.numberField(name, numVal, { speed: 0.01, tooltip });
        if (changed) {
          componentData.uniforms[name] = val;
        }
      }
    }
  } else if (type === 'vec2' || type === 'ivec2' || type === 'uvec2') {
    const vec2Val =
      currentValue && typeof currentValue === 'object' && 'x' in currentValue && 'y' in currentValue
        ? { x: currentValue.x, y: currentValue.y }
        : { x: 0, y: 0 };
    const [val, changed] = EditorLayout.vector2Field(name, vec2Val, { speed: 0.01, tooltip });
    if (changed) {
      componentData.uniforms[name] = { x: val.x, y: val.y };
    }
  } else if (type === 'vec3' || type === 'ivec3' || type === 'uvec3') {
    if (isColorUniform) {
      // Render as RGB color
      const colorVal = vec4ToColor(currentValue) ?? { r: 1, g: 1, b: 1, a: 1 };
      const [val, changed] = EditorLayout.colorField(name, colorVal, { tooltip, hasAlpha: false });
      if (changed) {
        componentData.uniforms[name] = { x: val.r, y: val.g, z: val.b };
      }
    } else {
      // Render as vec3
      const vec3Val =
        currentValue && typeof currentValue === 'object' && 'x' in currentValue && 'y' in currentValue && 'z' in currentValue
          ? { x: currentValue.x, y: currentValue.y, z: currentValue.z }
          : { x: 0, y: 0, z: 0 };
      const [val, changed] = EditorLayout.vector3Field(name, vec3Val, { speed: 0.01, tooltip });
      if (changed) {
        componentData.uniforms[name] = { x: val.x, y: val.y, z: val.z };
      }
    }
  } else if (type === 'vec4' || type === 'ivec4' || type === 'uvec4') {
    if (isColorUniform) {
      // Render as RGBA color
      const colorVal = vec4ToColor(currentValue) ?? { r: 1, g: 1, b: 1, a: 1 };
      const [val, changed] = EditorLayout.colorField(name, colorVal, { tooltip, hasAlpha: true });
      if (changed) {
        componentData.uniforms[name] = { x: val.r, y: val.g, z: val.b, w: val.a ?? 1 };
      }
    } else {
      // Render as vec4
      const vec4Val =
        currentValue && typeof currentValue === 'object' && 'x' in currentValue && 'y' in currentValue && 'z' in currentValue && 'w' in currentValue
          ? { x: currentValue.x, y: currentValue.y, z: currentValue.z, w: currentValue.w }
          : { x: 0, y: 0, z: 0, w: 1 };
      const [val, changed] = EditorLayout.vector4Field(name, vec4Val, { speed: 0.01, tooltip });
      if (changed) {
        componentData.uniforms[name] = { x: val.x, y: val.y, z: val.z, w: val.w };
      }
    }
  } else {
    // Unknown type - just show the name and type
    EditorLayout.text(`${name}:`);
    EditorLayout.sameLine();
    EditorLayout.textDisabled(`(${type} - unsupported)`);
  }
}
