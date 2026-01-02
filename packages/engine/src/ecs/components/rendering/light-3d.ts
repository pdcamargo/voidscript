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

import { component } from '@voidscript/core';
import { EditorLayout } from '../../../app/imgui/editor-layout.js';

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

      EditorLayout.beginLabelsWidth(['Light Type']);

      // Light type selector dropdown
      const LightTypeEnum = {
        directional: 'directional',
        point: 'point',
        spot: 'spot',
        ambient: 'ambient',
      } as const;

      const [newType, typeChanged] = EditorLayout.enumField(
        'Light Type',
        lightData.type,
        LightTypeEnum,
        { tooltip: 'Type of light source' }
      );

      EditorLayout.endLabelsWidth();
      if (typeChanged && newType !== lightData.type) {
        // Preserve common properties when switching types
        const commonProps = {
          color: lightData.color,
          intensity: lightData.intensity,
        };

        // Transform to new type with appropriate defaults
        switch (newType) {
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

      // Transform usage hint
      EditorLayout.separator();
      if (lightData.type === 'directional') {
        EditorLayout.hint('Transform: Only rotation matters (light direction)');
      } else if (lightData.type === 'point') {
        EditorLayout.hint('Transform: Only position matters (light location)');
      } else if (lightData.type === 'spot') {
        EditorLayout.hint('Transform: Position & rotation both matter');
      } else if (lightData.type === 'ambient') {
        EditorLayout.hint('Transform: Neither position nor rotation matter');
      }

      EditorLayout.separator();

      // Common properties
      EditorLayout.header('Light Properties');
      EditorLayout.beginIndent();
      EditorLayout.beginLabelsWidth(['Color', 'Intensity']);

      // Color picker
      const [color, colorChanged] = EditorLayout.colorField('Color', lightData.color, {
        tooltip: 'Light color (RGB)',
        id: 'lightColor',
      });
      if (colorChanged) {
        lightData.color.r = color.r;
        lightData.color.g = color.g;
        lightData.color.b = color.b;
      }

      // Intensity
      const maxIntensity = lightData.type === 'ambient' ? 2 : 10;
      const [intensity, intensityChanged] = EditorLayout.numberField(
        'Intensity',
        lightData.intensity,
        { min: 0, max: maxIntensity, speed: 0.1, tooltip: 'Light intensity' }
      );
      if (intensityChanged) lightData.intensity = intensity;

      EditorLayout.endLabelsWidth();
      EditorLayout.endIndent();

      // Type-specific properties
      if (lightData.type === 'directional') {
        EditorLayout.separator();
        EditorLayout.header('Directional Properties');
        EditorLayout.beginIndent();
        EditorLayout.beginLabelsWidth(['Shadow Camera Size']);

        const dirLight = lightData as DirectionalLightData;
        const [shadowCameraSize, shadowCameraSizeChanged] = EditorLayout.numberField(
          'Shadow Camera Size',
          dirLight.shadowCameraSize,
          { min: 1, max: 100, speed: 0.5, tooltip: 'Orthographic frustum half-size for shadow camera' }
        );
        if (shadowCameraSizeChanged) dirLight.shadowCameraSize = shadowCameraSize;

        EditorLayout.endLabelsWidth();
        EditorLayout.endIndent();
      } else if (lightData.type === 'point') {
        EditorLayout.separator();
        EditorLayout.header('Point Light Properties');
        EditorLayout.beginIndent();
        EditorLayout.beginLabelsWidth(['Distance', 'Decay']);

        const pointLight = lightData as PointLightData;

        const [distance, distanceChanged] = EditorLayout.numberField(
          'Distance',
          pointLight.distance,
          { min: 0, max: 1000, speed: 1, tooltip: 'Maximum distance for light influence (0 = infinite)' }
        );
        if (distanceChanged) pointLight.distance = distance;
        EditorLayout.textDisabled('(0 = infinite range)');

        const [decay, decayChanged] = EditorLayout.numberField(
          'Decay',
          pointLight.decay,
          { min: 0, max: 5, speed: 0.1, tooltip: 'Light decay rate (realistic = 2)' }
        );
        if (decayChanged) pointLight.decay = decay;

        EditorLayout.endLabelsWidth();
        EditorLayout.endIndent();
      } else if (lightData.type === 'spot') {
        EditorLayout.separator();
        EditorLayout.header('Spot Light Properties');
        EditorLayout.beginIndent();
        EditorLayout.beginLabelsWidth(['Distance', 'Decay', 'Angle (degrees)', 'Penumbra']);

        const spotLight = lightData as SpotLightData;

        const [distance, distanceChanged] = EditorLayout.numberField(
          'Distance',
          spotLight.distance,
          { min: 0, max: 1000, speed: 1, tooltip: 'Maximum distance for light influence (0 = infinite)' }
        );
        if (distanceChanged) spotLight.distance = distance;
        EditorLayout.textDisabled('(0 = infinite range)');

        const [decay, decayChanged] = EditorLayout.numberField(
          'Decay',
          spotLight.decay,
          { min: 0, max: 5, speed: 0.1, tooltip: 'Light decay rate (realistic = 2)' }
        );
        if (decayChanged) spotLight.decay = decay;

        // Angle in degrees for user-friendly input
        const angleDeg = (spotLight.angle * 180) / Math.PI;
        const [newAngleDeg, angleChanged] = EditorLayout.numberField(
          'Angle (degrees)',
          angleDeg,
          { min: 0, max: 180, useSlider: true, tooltip: 'Maximum angle of light spread' }
        );
        if (angleChanged) spotLight.angle = (newAngleDeg * Math.PI) / 180;

        const [penumbra, penumbraChanged] = EditorLayout.numberField(
          'Penumbra',
          spotLight.penumbra,
          { min: 0, max: 1, useSlider: true, tooltip: 'Percentage of cone where light fades (0 = sharp, 1 = smooth)' }
        );
        if (penumbraChanged) spotLight.penumbra = penumbra;
        EditorLayout.textDisabled('(0 = sharp edge, 1 = smooth)');

        EditorLayout.endLabelsWidth();
        EditorLayout.endIndent();
      }

      // Shadow settings (for directional, point, spot)
      if (lightData.type !== 'ambient') {
        EditorLayout.separator();

        const shadowLight = lightData as DirectionalLightData | PointLightData | SpotLightData;

        if (EditorLayout.beginGroup('Shadow Settings', false)) {
          EditorLayout.beginLabelsWidth(['Enable Shadows', 'Map Size', 'Camera Near', 'Camera Far', 'Bias', 'Normal Bias']);

          // Shadow enabled checkbox
          const [enabled, enabledChanged] = EditorLayout.checkboxField(
            'Enable Shadows',
            shadowLight.shadow.enabled,
            { tooltip: 'Enable shadow casting for this light' }
          );
          if (enabledChanged) shadowLight.shadow.enabled = enabled;

          if (shadowLight.shadow.enabled) {
            EditorLayout.separator();

            // Shadow map size dropdown
            const MapSizeEnum = {
              '512': 512,
              '1024': 1024,
              '2048': 2048,
              '4096': 4096,
            } as const;
            const [mapSize, mapSizeChanged] = EditorLayout.enumField(
              'Map Size',
              shadowLight.shadow.mapSize as 512 | 1024 | 2048 | 4096,
              MapSizeEnum,
              { tooltip: 'Shadow map resolution (power of 2)' }
            );
            if (mapSizeChanged) shadowLight.shadow.mapSize = mapSize;

            // Camera near/far
            const [cameraNear, cameraNearChanged] = EditorLayout.numberField(
              'Camera Near',
              shadowLight.shadow.cameraNear,
              { min: 0.001, max: 10, speed: 0.1, tooltip: 'Shadow camera near plane' }
            );
            if (cameraNearChanged) shadowLight.shadow.cameraNear = cameraNear;

            const [cameraFar, cameraFarChanged] = EditorLayout.numberField(
              'Camera Far',
              shadowLight.shadow.cameraFar,
              { min: 1, max: 10000, speed: 1, tooltip: 'Shadow camera far plane' }
            );
            if (cameraFarChanged) shadowLight.shadow.cameraFar = cameraFar;

            // Bias settings
            const [bias, biasChanged] = EditorLayout.numberField(
              'Bias',
              shadowLight.shadow.bias,
              { min: -0.01, max: 0.01, speed: 0.0001, tooltip: 'Shadow bias to reduce artifacts' }
            );
            if (biasChanged) shadowLight.shadow.bias = bias;

            const [normalBias, normalBiasChanged] = EditorLayout.numberField(
              'Normal Bias',
              shadowLight.shadow.normalBias,
              { min: 0, max: 0.1, speed: 0.001, tooltip: 'Normal bias for additional artifact reduction' }
            );
            if (normalBiasChanged) shadowLight.shadow.normalBias = normalBias;
          }

          EditorLayout.endLabelsWidth();
          EditorLayout.endGroup();
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
