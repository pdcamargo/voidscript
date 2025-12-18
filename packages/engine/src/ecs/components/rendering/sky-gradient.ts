/**
 * Sky Gradient 2D Component
 *
 * Renders a vertical gradient for sky backgrounds in 2D games.
 * The gradient is generated as a texture and rendered as a mesh.
 *
 * @example
 * ```typescript
 * commands.spawn()
 *   .with(Transform3D, {
 *     position: { x: 0, y: 0, z: -100 },
 *     scale: { x: 2000, y: 2000, z: 1 },
 *   })
 *   .with(SkyGradient2D, {
 *     stops: [
 *       { color: { r: 0.53, g: 0.81, b: 0.92, a: 1 }, position: 0.0 },
 *       { color: { r: 0.25, g: 0.41, b: 0.88, a: 1 }, position: 1.0 },
 *     ],
 *     height: 256,
 *     sortingLayer: -1000,
 *   })
 *   .build();
 * ```
 */

import { component } from '../../component.js';
import { ImGui } from '@mori2003/jsimgui';

/**
 * Gradient stop defining a color at a specific position
 */
export interface GradientStop {
  /**
   * Color at this stop (RGBA, 0-1 range)
   */
  color: { r: number; g: number; b: number; a: number };

  /**
   * Position along the gradient (0-1, bottom to top)
   */
  position: number;
}

/**
 * Sky gradient 2D component data
 */
export interface SkyGradient2DData {
  /**
   * Gradient stops defining the sky colors from bottom to top
   */
  stops: GradientStop[];

  /**
   * Height of the gradient texture in pixels
   * Higher values = smoother gradients but more memory
   * @default 256
   */
  height: number;

  /**
   * Sorting layer for render order
   * Use a very negative value to render behind everything
   * @default -1000
   */
  sortingLayer: number;

  /**
   * Sorting order within the layer
   * @default 0
   */
  sortingOrder: number;

  /**
   * Whether the sky is visible
   * @default true
   */
  visible: boolean;

  /**
   * Whether this sky gradient receives THREE.js lighting
   * When false: Uses MeshBasicMaterial (unlit, better for backgrounds)
   * When true: Uses MeshLambertMaterial (lit, responds to lights in scene)
   * @default false
   */
  isLit: boolean;

  /**
   * Internal flag to track if gradient needs regeneration
   * Set this to true when changing stops
   * @internal
   */
  dirty: boolean;

  /**
   * Enable star rendering with procedural generation
   * @default false
   */
  enableStars: boolean;

  /**
   * Number of stars to generate
   * @default 500
   */
  starCount: number;

  /**
   * Minimum star size
   * @default 1.0
   */
  starMinSize: number;

  /**
   * Maximum star size
   * @default 3.0
   */
  starMaxSize: number;

  /**
   * Height range for stars (0-1, where 0.5 = bottom half, 1.0 = full height)
   * @default 0.6
   */
  starHeightRange: number;

  /**
   * Random seed for deterministic star placement
   * @default 0
   */
  starSeed: number;

  /**
   * Flicker animation speed
   * @default 2.0
   */
  flickerSpeed: number;

  /**
   * Flicker intensity (0-1, how much stars vary in brightness)
   * @default 0.3
   */
  flickerIntensity: number;
}

/**
 * Sky Gradient 2D Component
 *
 * Renders a vertical gradient background for 2D scenes.
 * The gradient is generated as a DataTexture and rendered as a mesh.
 *
 * **Gradient Generation:**
 * - Texture is `1 x height` pixels (vertical gradient)
 * - Colors are interpolated linearly between stops
 * - Uses `NearestFilter` for pixel-art style (no smoothing)
 *
 * **Render Order:**
 * - Use very negative sortingLayer (e.g., -1000) to render behind everything
 * - Position at negative Z (e.g., z: -100) to ensure it's in the back
 *
 * **Performance:**
 * - Set `dirty: true` only when gradient stops change
 * - Texture is only regenerated when dirty flag is true
 * - Use lower `height` values (64-256) for pixel art style
 */
export const SkyGradient2D = component<SkyGradient2DData>(
  'SkyGradient2D',
  {
    stops: {
      serializable: true,
      customEditor: ({ label, value, onChange, componentData }) => {
        ImGui.Text(`${label}:`);
        ImGui.Indent();

        let changed = false;
        let stopToRemove = -1;

        // Render each gradient stop
        for (let i = 0; i < value.length; i++) {
          const stop = value[i];
          if (!stop) continue;

          ImGui.PushID(`stop_${i}`);

          // Stop header with remove button
          ImGui.AlignTextToFramePadding();
          ImGui.Text(`Stop ${i}`);
          ImGui.SameLine();
          if (ImGui.SmallButton('X')) {
            stopToRemove = i;
          }

          // Color picker
          const colorArr: [number, number, number, number] = [
            stop.color.r,
            stop.color.g,
            stop.color.b,
            stop.color.a,
          ];
          if (ImGui.ColorEdit4(`Color##${i}`, colorArr)) {
            stop.color.r = colorArr[0];
            stop.color.g = colorArr[1];
            stop.color.b = colorArr[2];
            stop.color.a = colorArr[3];
            changed = true;
          }

          // Position slider
          const posArr: [number] = [stop.position];
          if (ImGui.SliderFloat(`Position##${i}`, posArr, 0, 1)) {
            stop.position = posArr[0];
            changed = true;
          }

          ImGui.PopID();
          ImGui.Separator();
        }

        // Add stop button
        if (ImGui.Button('Add Stop')) {
          // Add new stop at middle position
          const newStop: GradientStop = {
            color: { r: 0.5, g: 0.5, b: 0.5, a: 1 },
            position: 0.5,
          };
          value.push(newStop);
          changed = true;
        }

        ImGui.Unindent();

        // Handle removal after iteration
        if (stopToRemove >= 0) {
          value.splice(stopToRemove, 1);
          changed = true;
        }

        // Trigger onChange if any modifications were made
        if (changed) {
          onChange([...value]); // Create new array reference to trigger reactivity
          // Set dirty flag to regenerate gradient texture
          if (componentData) {
            componentData.dirty = true;
          }
        }
      },
    },
    height: {
      serializable: true,
    },
    sortingLayer: {
      serializable: true,
    },
    sortingOrder: {
      serializable: true,
    },
    visible: {
      serializable: true,
    },
    isLit: {
      serializable: true,
    },
    dirty: {
      serializable: true,
    },
    enableStars: {
      serializable: true,
      customEditor: ({ label, value, onChange, componentData }) => {
        const checkboxValue: [boolean] = [value];
        if (ImGui.Checkbox(label, checkboxValue)) {
          onChange(checkboxValue[0]);
        }

        // Show star configuration when enabled
        if (value && componentData) {
          ImGui.Indent();

          // Star Count
          const countArr: [number] = [componentData.starCount];
          if (ImGui.DragInt('Star Count', countArr, 10, 0, 2000)) {
            componentData.starCount = countArr[0];
          }

          // Seed
          const seedArr: [number] = [componentData.starSeed];
          if (ImGui.DragInt('Seed', seedArr, 1, 0, 999999)) {
            componentData.starSeed = seedArr[0];
          }

          // Min Size
          const minSizeArr: [number] = [componentData.starMinSize];
          if (ImGui.DragFloat('Min Size', minSizeArr, 0.1, 0.5, 10)) {
            componentData.starMinSize = minSizeArr[0];
          }

          // Max Size
          const maxSizeArr: [number] = [componentData.starMaxSize];
          if (ImGui.DragFloat('Max Size', maxSizeArr, 0.1, 0.5, 10)) {
            componentData.starMaxSize = maxSizeArr[0];
          }

          // Height Range
          const heightRangeArr: [number] = [componentData.starHeightRange];
          if (ImGui.SliderFloat('Height Range', heightRangeArr, 0, 1)) {
            componentData.starHeightRange = heightRangeArr[0];
          }

          // Flicker Speed
          const flickerSpeedArr: [number] = [componentData.flickerSpeed];
          if (ImGui.SliderFloat('Flicker Speed', flickerSpeedArr, 0, 10)) {
            componentData.flickerSpeed = flickerSpeedArr[0];
          }

          // Flicker Intensity
          const flickerIntensityArr: [number] = [componentData.flickerIntensity];
          if (ImGui.SliderFloat('Flicker Intensity', flickerIntensityArr, 0, 1)) {
            componentData.flickerIntensity = flickerIntensityArr[0];
          }

          ImGui.Unindent();
        }
      },
    },
    starCount: {
      serializable: true,
    },
    starMinSize: {
      serializable: true,
    },
    starMaxSize: {
      serializable: true,
    },
    starHeightRange: {
      serializable: true,
    },
    starSeed: {
      serializable: true,
    },
    flickerSpeed: {
      serializable: true,
    },
    flickerIntensity: {
      serializable: true,
    },
  },
  {
    path: 'rendering/2d',
    defaultValue: () => ({
      stops: [
        { color: { r: 0.53, g: 0.81, b: 0.92, a: 1 }, position: 0.0 },
        { color: { r: 0.25, g: 0.41, b: 0.88, a: 1 }, position: 1.0 },
      ],
      height: 256,
      sortingLayer: -1000,
      sortingOrder: 0,
      visible: true,
      isLit: false,
      dirty: true, // Start dirty to generate initial texture
      enableStars: false,
      starCount: 500,
      starMinSize: 1.0,
      starMaxSize: 3.0,
      starHeightRange: 0.6,
      starSeed: 0,
      flickerSpeed: 2.0,
      flickerIntensity: 0.3,
    }),
    displayName: 'Sky Gradient 2D',
    description: 'Vertical gradient background for 2D scenes',
  },
);
