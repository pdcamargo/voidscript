/**
 * Light3D Component
 *
 * Defines lights in the 3D scene. Uses a discriminated union to support
 * different light types (Directional, Point, Spot, Ambient).
 *
 * The entity's Transform3D component controls light position and direction:
 * - Directional: rotation determines light direction (position ignored)
 * - Point: position determines light location (rotation ignored)
 * - Spot: position and rotation both matter
 * - Ambient: neither position nor rotation matter
 */

import { component } from '../../component.js';
import { ImGui } from '@mori2003/jsimgui';

/**
 * Light color representation (RGB, 0-1 range)
 */
export interface LightColor {
  r: number;
  g: number;
  b: number;
}

/**
 * Shadow configuration (shared by all shadowable lights)
 */
export interface ShadowConfig {
  /** Enable shadow casting */
  enabled: boolean;
  /** Shadow map size (power of 2, e.g., 512, 1024, 2048) */
  mapSize: number;
  /** Shadow camera near plane */
  cameraNear: number;
  /** Shadow camera far plane */
  cameraFar: number;
  /** Shadow bias to reduce artifacts */
  bias: number;
  /** Normal bias for additional artifact reduction */
  normalBias: number;
}

/**
 * Default shadow configuration
 */
export const DEFAULT_SHADOW_CONFIG: ShadowConfig = {
  enabled: false,
  mapSize: 1024,
  cameraNear: 0.5,
  cameraFar: 500,
  bias: -0.0001,
  normalBias: 0.02,
};

/**
 * Light type discriminator
 */
export type LightType = 'directional' | 'point' | 'spot' | 'ambient';

/**
 * Directional light data (sun-like, parallel rays)
 *
 * Position is ignored - only rotation matters for direction.
 * Illuminates all objects equally regardless of distance.
 */
export interface DirectionalLightData {
  type: 'directional';
  /** Light color */
  color: LightColor;
  /** Light intensity (default: 1) */
  intensity: number;
  /** Shadow configuration */
  shadow: ShadowConfig;
  /** Shadow camera bounds (orthographic frustum half-size) */
  shadowCameraSize: number;
}

/**
 * Point light data (light bulb-like, radiates in all directions)
 *
 * Rotation is ignored - only position matters.
 * Light intensity decreases with distance.
 */
export interface PointLightData {
  type: 'point';
  /** Light color */
  color: LightColor;
  /** Light intensity (default: 1) */
  intensity: number;
  /** Maximum distance for light influence (0 = infinite) */
  distance: number;
  /** Light decay rate (realistic = 2, Three.js default = 2) */
  decay: number;
  /** Shadow configuration */
  shadow: ShadowConfig;
}

/**
 * Spot light data (flashlight-like, cone of light)
 *
 * Both position and rotation matter.
 * Light shines in the direction of the -Z axis of the Transform3D.
 */
export interface SpotLightData {
  type: 'spot';
  /** Light color */
  color: LightColor;
  /** Light intensity (default: 1) */
  intensity: number;
  /** Maximum distance for light influence (0 = infinite) */
  distance: number;
  /** Light decay rate (realistic = 2) */
  decay: number;
  /** Maximum angle of light spread in radians (default: PI/3) */
  angle: number;
  /** Percentage of cone where light fades (0 = sharp edge, 1 = smooth) */
  penumbra: number;
  /** Shadow configuration */
  shadow: ShadowConfig;
}

/**
 * Ambient light data (uniform lighting from all directions)
 *
 * Neither position nor rotation matter.
 * Provides base illumination to prevent completely dark areas.
 */
export interface AmbientLightData {
  type: 'ambient';
  /** Light color */
  color: LightColor;
  /** Light intensity (default: 0.5) */
  intensity: number;
}

/**
 * Combined light data type (discriminated union)
 */
export type Light3DData =
  | DirectionalLightData
  | PointLightData
  | SpotLightData
  | AmbientLightData;

/**
 * Light3D component
 *
 * Note: The component stores the discriminated union type.
 * Systems should check `light.type` to determine which properties are available.
 */
// Use 'any' cast because Light3DData is a discriminated union where not all
// properties exist on all variants (e.g., 'shadow' doesn't exist on AmbientLightData)
export const Light3D = component<Light3DData>(
  'Light3D',
  {
    type: {
      serializable: true,
    },
    color: {
      serializable: true,
    },
    intensity: {
      serializable: true,
    },
    // Optional fields (not all light types have these)
    shadow: {
      serializable: true,
      whenNullish: 'skip',
    },
    shadowCameraSize: {
      serializable: true,
      whenNullish: 'skip',
    },
    distance: {
      serializable: true,
      whenNullish: 'skip',
    },
    decay: {
      serializable: true,
      whenNullish: 'skip',
    },
    angle: {
      serializable: true,
      whenNullish: 'skip',
    },
    penumbra: {
      serializable: true,
      whenNullish: 'skip',
    },
  } as any,
  {
    defaultValue: () => ({
      type: 'directional' as const,
      color: { r: 1, g: 1, b: 1 },
      intensity: 1,
      shadow: { ...DEFAULT_SHADOW_CONFIG },
      shadowCameraSize: 10,
    }),
    displayName: 'Light 3D',
    description: 'Light source in 3D space',
    path: 'rendering/3d',
    customEditor: ({ componentData }) => {
      const lightData = componentData as Light3DData;

      // Light type selector dropdown
      ImGui.Text('Light Type:');
      ImGui.SameLine();
      if (ImGui.BeginCombo('##lightType', lightData.type)) {
        const types: LightType[] = ['directional', 'point', 'spot', 'ambient'];
        for (const type of types) {
          const isSelected = lightData.type === type;
          if (ImGui.Selectable(type, isSelected)) {
            // Preserve common properties when switching types
            const commonProps = {
              color: lightData.color,
              intensity: lightData.intensity,
            };

            // Transform to new type with appropriate defaults
            switch (type) {
              case 'directional':
                Object.assign(lightData, createDirectionalLight(commonProps));
                break;
              case 'point':
                Object.assign(lightData, createPointLight(commonProps));
                break;
              case 'spot':
                Object.assign(lightData, createSpotLight(commonProps));
                break;
              case 'ambient':
                Object.assign(lightData, createAmbientLight(commonProps));
                break;
            }
          }
          if (isSelected) {
            ImGui.SetItemDefaultFocus();
          }
        }
        ImGui.EndCombo();
      }

      // Transform usage hint
      ImGui.Separator();
      const hintColor = { x: 0.7, y: 0.7, z: 0.7, w: 1 };
      if (lightData.type === 'directional') {
        ImGui.TextColored(hintColor, 'Transform: Only rotation matters (light direction)');
      } else if (lightData.type === 'point') {
        ImGui.TextColored(hintColor, 'Transform: Only position matters (light location)');
      } else if (lightData.type === 'spot') {
        ImGui.TextColored(hintColor, 'Transform: Position & rotation both matter');
      } else if (lightData.type === 'ambient') {
        ImGui.TextColored(hintColor, 'Transform: Neither position nor rotation matter');
      }

      ImGui.Separator();

      // Common properties
      ImGui.Text('Light Properties');
      ImGui.Indent();

      // Color picker
      const color: [number, number, number] = [
        lightData.color.r,
        lightData.color.g,
        lightData.color.b,
      ];
      if (ImGui.ColorEdit3('Color##lightColor', color)) {
        lightData.color.r = color[0];
        lightData.color.g = color[1];
        lightData.color.b = color[2];
      }

      // Intensity
      const intensity: [number] = [lightData.intensity];
      const maxIntensity = lightData.type === 'ambient' ? 2 : 10;
      if (ImGui.DragFloat('Intensity##lightIntensity', intensity, 0.1, 0, maxIntensity)) {
        lightData.intensity = Math.max(0, intensity[0]);
      }

      ImGui.Unindent();

      // Type-specific properties
      if (lightData.type === 'directional') {
        ImGui.Separator();
        ImGui.Text('Directional Properties');
        ImGui.Indent();

        const dirLight = lightData as DirectionalLightData;
        const shadowCameraSize: [number] = [dirLight.shadowCameraSize];
        if (ImGui.DragFloat('Shadow Camera Size##shadowCameraSize', shadowCameraSize, 0.5, 1, 100)) {
          dirLight.shadowCameraSize = Math.max(1, shadowCameraSize[0]);
        }

        ImGui.Unindent();
      } else if (lightData.type === 'point') {
        ImGui.Separator();
        ImGui.Text('Point Light Properties');
        ImGui.Indent();

        const pointLight = lightData as PointLightData;

        const distance: [number] = [pointLight.distance];
        if (ImGui.DragFloat('Distance##pointDistance', distance, 1, 0, 1000)) {
          pointLight.distance = Math.max(0, distance[0]);
        }
        ImGui.TextColored(hintColor, '(0 = infinite range)');

        const decay: [number] = [pointLight.decay];
        if (ImGui.DragFloat('Decay##pointDecay', decay, 0.1, 0, 5)) {
          pointLight.decay = Math.max(0, decay[0]);
        }

        ImGui.Unindent();
      } else if (lightData.type === 'spot') {
        ImGui.Separator();
        ImGui.Text('Spot Light Properties');
        ImGui.Indent();

        const spotLight = lightData as SpotLightData;

        const distance: [number] = [spotLight.distance];
        if (ImGui.DragFloat('Distance##spotDistance', distance, 1, 0, 1000)) {
          spotLight.distance = Math.max(0, distance[0]);
        }
        ImGui.TextColored(hintColor, '(0 = infinite range)');

        const decay: [number] = [spotLight.decay];
        if (ImGui.DragFloat('Decay##spotDecay', decay, 0.1, 0, 5)) {
          spotLight.decay = Math.max(0, decay[0]);
        }

        // Angle in degrees for user-friendly input
        const angleDeg: [number] = [(spotLight.angle * 180) / Math.PI];
        if (ImGui.SliderFloat('Angle (degrees)##spotAngle', angleDeg, 0, 180)) {
          spotLight.angle = (angleDeg[0] * Math.PI) / 180;
        }

        const penumbra: [number] = [spotLight.penumbra];
        if (ImGui.SliderFloat('Penumbra##spotPenumbra', penumbra, 0, 1)) {
          spotLight.penumbra = Math.max(0, Math.min(1, penumbra[0]));
        }
        ImGui.TextColored(hintColor, '(0 = sharp edge, 1 = smooth)');

        ImGui.Unindent();
      }

      // Shadow settings (for directional, point, spot)
      if (lightData.type !== 'ambient') {
        ImGui.Separator();

        const shadowLight = lightData as DirectionalLightData | PointLightData | SpotLightData;

        if (ImGui.CollapsingHeader('Shadow Settings##shadowSettings')) {
          ImGui.Indent();

          // Shadow enabled checkbox
          const enabled: [boolean] = [shadowLight.shadow.enabled];
          if (ImGui.Checkbox('Enable Shadows##shadowEnabled', enabled)) {
            shadowLight.shadow.enabled = enabled[0];
          }

          if (shadowLight.shadow.enabled) {
            ImGui.Separator();

            // Shadow map size dropdown
            ImGui.Text('Map Size:');
            ImGui.SameLine();
            const currentMapSize = shadowLight.shadow.mapSize.toString();
            if (ImGui.BeginCombo('##shadowMapSize', currentMapSize)) {
              const mapSizes = [512, 1024, 2048, 4096];
              for (const size of mapSizes) {
                const sizeStr = size.toString();
                const isSelected = shadowLight.shadow.mapSize === size;
                if (ImGui.Selectable(sizeStr, isSelected)) {
                  shadowLight.shadow.mapSize = size;
                }
                if (isSelected) {
                  ImGui.SetItemDefaultFocus();
                }
              }
              ImGui.EndCombo();
            }

            // Camera near/far
            const cameraNear: [number] = [shadowLight.shadow.cameraNear];
            if (ImGui.DragFloat('Camera Near##shadowNear', cameraNear, 0.1, 0.001, 10)) {
              shadowLight.shadow.cameraNear = Math.max(0.001, cameraNear[0]);
            }

            const cameraFar: [number] = [shadowLight.shadow.cameraFar];
            if (ImGui.DragFloat('Camera Far##shadowFar', cameraFar, 1, 1, 10000)) {
              shadowLight.shadow.cameraFar = Math.max(1, cameraFar[0]);
            }

            // Bias settings
            const bias: [number] = [shadowLight.shadow.bias];
            if (ImGui.DragFloat('Bias##shadowBias', bias, 0.0001, -0.01, 0.01, '%.5f')) {
              shadowLight.shadow.bias = bias[0];
            }

            const normalBias: [number] = [shadowLight.shadow.normalBias];
            if (ImGui.DragFloat('Normal Bias##shadowNormalBias', normalBias, 0.001, 0, 0.1, '%.4f')) {
              shadowLight.shadow.normalBias = Math.max(0, normalBias[0]);
            }
          }

          ImGui.Unindent();
        }
      }
    },
  },
);

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create directional light data
 */
export function createDirectionalLight(options: {
  color?: LightColor;
  intensity?: number;
  shadow?: Partial<ShadowConfig>;
  shadowCameraSize?: number;
} = {}): DirectionalLightData {
  return {
    type: 'directional',
    color: options.color ?? { r: 1, g: 1, b: 1 },
    intensity: options.intensity ?? 1,
    shadow: { ...DEFAULT_SHADOW_CONFIG, ...options.shadow },
    shadowCameraSize: options.shadowCameraSize ?? 10,
  };
}

/**
 * Create point light data
 */
export function createPointLight(options: {
  color?: LightColor;
  intensity?: number;
  distance?: number;
  decay?: number;
  shadow?: Partial<ShadowConfig>;
} = {}): PointLightData {
  return {
    type: 'point',
    color: options.color ?? { r: 1, g: 1, b: 1 },
    intensity: options.intensity ?? 1,
    distance: options.distance ?? 0,
    decay: options.decay ?? 2,
    shadow: { ...DEFAULT_SHADOW_CONFIG, ...options.shadow },
  };
}

/**
 * Create spot light data
 */
export function createSpotLight(options: {
  color?: LightColor;
  intensity?: number;
  distance?: number;
  decay?: number;
  angle?: number;
  penumbra?: number;
  shadow?: Partial<ShadowConfig>;
} = {}): SpotLightData {
  return {
    type: 'spot',
    color: options.color ?? { r: 1, g: 1, b: 1 },
    intensity: options.intensity ?? 1,
    distance: options.distance ?? 0,
    decay: options.decay ?? 2,
    angle: options.angle ?? Math.PI / 3,
    penumbra: options.penumbra ?? 0,
    shadow: { ...DEFAULT_SHADOW_CONFIG, ...options.shadow },
  };
}

/**
 * Create ambient light data
 */
export function createAmbientLight(options: {
  color?: LightColor;
  intensity?: number;
} = {}): AmbientLightData {
  return {
    type: 'ambient',
    color: options.color ?? { r: 1, g: 1, b: 1 },
    intensity: options.intensity ?? 0.5,
  };
}

// ============================================================================
// Type Guards
// ============================================================================

export function isDirectionalLight(light: Light3DData): light is DirectionalLightData {
  return light.type === 'directional';
}

export function isPointLight(light: Light3DData): light is PointLightData {
  return light.type === 'point';
}

export function isSpotLight(light: Light3DData): light is SpotLightData {
  return light.type === 'spot';
}

export function isAmbientLight(light: Light3DData): light is AmbientLightData {
  return light.type === 'ambient';
}
