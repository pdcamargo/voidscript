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
import { AssetDatabase } from '../../asset-database.js';
import { AssetType, isShaderMetadata } from '../../asset-metadata.js';
import { EditorLayout } from '../../../app/imgui/editor-layout.js';

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
    customEditor: ({ componentData, commands }) => {
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
      // Only show if shader is selected
      if (componentData.shader && componentData.shader.guid) {
        const metadata = AssetDatabase.getMetadata(componentData.shader.guid);

        if (metadata && isShaderMetadata(metadata)) {
          const uniformNames = metadata.uniformNames || [];

          if (uniformNames.length > 0) {
            if (EditorLayout.beginGroup('Uniforms', true)) {
              EditorLayout.beginLabelsWidth(uniformNames);

              for (const uniformName of uniformNames) {
                const currentValue = componentData.uniforms[uniformName];

                // Render uniform editor based on current value type
                // If no value set, show a type picker
                if (currentValue === undefined || currentValue === null) {
                  EditorLayout.text(`${uniformName}:`);
                  EditorLayout.sameLine();
                  EditorLayout.textDisabled('(Not set)');
                  EditorLayout.sameLine();

                  // Type selection buttons
                  if (EditorLayout.button(`Number##${uniformName}`)) {
                    componentData.uniforms[uniformName] = 0;
                  }
                  EditorLayout.sameLine();
                  if (EditorLayout.button(`Vec2##${uniformName}`)) {
                    componentData.uniforms[uniformName] = { x: 0, y: 0 };
                  }
                  EditorLayout.sameLine();
                  if (EditorLayout.button(`Color##${uniformName}`)) {
                    componentData.uniforms[uniformName] = { r: 1, g: 1, b: 1 };
                  }
                } else if (typeof currentValue === 'number') {
                  const [val, changed] = EditorLayout.numberField(uniformName, currentValue, {
                    speed: 0.01,
                    tooltip: `Shader uniform: ${uniformName}`,
                  });
                  if (changed) {
                    componentData.uniforms[uniformName] = val;
                  }
                } else if (typeof currentValue === 'boolean') {
                  const [val, changed] = EditorLayout.checkboxField(uniformName, currentValue, {
                    tooltip: `Shader uniform: ${uniformName}`,
                  });
                  if (changed) {
                    componentData.uniforms[uniformName] = val;
                  }
                } else if (isVec2(currentValue)) {
                  const [val, changed] = EditorLayout.vector2Field(uniformName, currentValue, {
                    speed: 0.01,
                    tooltip: `Shader uniform: ${uniformName}`,
                  });
                  if (changed) {
                    componentData.uniforms[uniformName] = { x: val.x, y: val.y };
                  }
                } else if (isVec3(currentValue)) {
                  const [val, changed] = EditorLayout.vector3Field(uniformName, currentValue, {
                    speed: 0.01,
                    tooltip: `Shader uniform: ${uniformName}`,
                  });
                  if (changed) {
                    componentData.uniforms[uniformName] = { x: val.x, y: val.y, z: val.z };
                  }
                } else if (isColor3(currentValue)) {
                  const [val, changed] = EditorLayout.colorField(uniformName, currentValue, {
                    tooltip: `Shader uniform: ${uniformName}`,
                  });
                  if (changed) {
                    componentData.uniforms[uniformName] = { r: val.r, g: val.g, b: val.b };
                  }
                } else if (isColor4(currentValue)) {
                  const [val, changed] = EditorLayout.colorField(uniformName, currentValue, {
                    tooltip: `Shader uniform: ${uniformName}`,
                    hasAlpha: true,
                  });
                  if (changed) {
                    componentData.uniforms[uniformName] = {
                      r: val.r,
                      g: val.g,
                      b: val.b,
                      a: val.a ?? 1,
                    };
                  }
                }

                // Clear button for each uniform
                if (currentValue !== undefined && currentValue !== null) {
                  EditorLayout.sameLine();
                  if (EditorLayout.button(`X##clear-${uniformName}`)) {
                    delete componentData.uniforms[uniformName];
                  }
                }
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
      }

      // Show warning if no Sprite2D component is present
      // This would require entity context which we don't have in the custom editor
      // The system will handle this validation at runtime
    },
  },
);

// Type guards for uniform values
function isVec2(value: UniformValue): value is { x: number; y: number } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'x' in value &&
    'y' in value &&
    !('z' in value) &&
    !('r' in value)
  );
}

function isVec3(value: UniformValue): value is { x: number; y: number; z: number } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'x' in value &&
    'y' in value &&
    'z' in value &&
    !('w' in value)
  );
}

function isColor3(value: UniformValue): value is { r: number; g: number; b: number } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'r' in value &&
    'g' in value &&
    'b' in value &&
    !('a' in value)
  );
}

function isColor4(value: UniformValue): value is { r: number; g: number; b: number; a: number } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'r' in value &&
    'g' in value &&
    'b' in value &&
    'a' in value
  );
}
