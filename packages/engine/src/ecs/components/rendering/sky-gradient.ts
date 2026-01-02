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

import { component } from '@voidscript/core';
import { EditorLayout } from '../../../app/imgui/editor-layout.js';

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
// ============================================================================
// Custom Editor - Helper Functions
// ============================================================================

function renderGradientStopsSection(data: SkyGradient2DData): void {
  if (EditorLayout.beginGroup('Gradient Stops', true)) {
    let changed = false;
    let stopToRemove = -1;

    // Render each gradient stop
    for (let i = 0; i < data.stops.length; i++) {
      const stop = data.stops[i];
      if (!stop) continue;

      // Stop header with remove button
      EditorLayout.text(`Stop ${i}`);
      EditorLayout.sameLine();
      if (EditorLayout.smallButton(`X##stop_remove_${i}`)) {
        stopToRemove = i;
      }

      EditorLayout.beginLabelsWidth(['Color', 'Position']);

      // Color picker
      const [color, colorChanged] = EditorLayout.colorField('Color', stop.color, {
        hasAlpha: true,
        id: `stop_color_${i}`,
        tooltip: 'Color at this gradient stop',
      });
      if (colorChanged) {
        stop.color.r = color.r;
        stop.color.g = color.g;
        stop.color.b = color.b;
        stop.color.a = color.a ?? 1;
        changed = true;
      }

      // Position slider
      const [position, positionChanged] = EditorLayout.numberField('Position', stop.position, {
        min: 0,
        max: 1,
        useSlider: true,
        id: `stop_position_${i}`,
        tooltip: 'Position along gradient (0 = bottom, 1 = top)',
      });
      if (positionChanged) {
        stop.position = position;
        changed = true;
      }

      EditorLayout.endLabelsWidth();
      EditorLayout.separator();
    }

    // Add stop button
    if (EditorLayout.button('Add Stop##gradient_stops')) {
      const newStop: GradientStop = {
        color: { r: 0.5, g: 0.5, b: 0.5, a: 1 },
        position: 0.5,
      };
      data.stops.push(newStop);
      changed = true;
    }

    // Handle removal after iteration
    if (stopToRemove >= 0) {
      data.stops.splice(stopToRemove, 1);
      changed = true;
    }

    // Set dirty flag to regenerate gradient texture
    if (changed) {
      data.dirty = true;
    }

    EditorLayout.endGroup();
  }
}

function renderVisibilitySection(data: SkyGradient2DData): void {
  if (EditorLayout.beginGroup('Visibility & Rendering', false)) {
    EditorLayout.beginLabelsWidth(['Visible', 'Is Lit', 'Sorting Layer', 'Sorting Order']);

    const [visible, visibleChanged] = EditorLayout.checkboxField('Visible', data.visible, {
      tooltip: 'Whether the sky gradient is visible',
    });
    if (visibleChanged) data.visible = visible;

    const [isLit, isLitChanged] = EditorLayout.checkboxField('Is Lit', data.isLit, {
      tooltip: 'Whether the sky responds to scene lighting',
    });
    if (isLitChanged) data.isLit = isLit;

    const [sortingLayer, layerChanged] = EditorLayout.integerField('Sorting Layer', data.sortingLayer, {
      speed: 1,
      min: -1000,
      max: 1000,
      tooltip: 'Sorting layer for render order (use negative values for backgrounds)',
    });
    if (layerChanged) data.sortingLayer = sortingLayer;

    const [sortingOrder, orderChanged] = EditorLayout.integerField('Sorting Order', data.sortingOrder, {
      speed: 1,
      min: -1000,
      max: 1000,
      tooltip: 'Sorting order within the layer',
    });
    if (orderChanged) data.sortingOrder = sortingOrder;

    EditorLayout.endLabelsWidth();
    EditorLayout.endGroup();
  }
}

function renderTextureSection(data: SkyGradient2DData): void {
  if (EditorLayout.beginGroup('Texture Settings', false)) {
    EditorLayout.beginLabelsWidth(['Height']);

    const [height, heightChanged] = EditorLayout.integerField('Height', data.height, {
      speed: 1,
      min: 16,
      max: 1024,
      tooltip: 'Height of the gradient texture in pixels (higher = smoother)',
    });
    if (heightChanged) {
      data.height = height;
      data.dirty = true;
    }

    EditorLayout.endLabelsWidth();
    EditorLayout.endGroup();
  }
}

function renderStarsSection(data: SkyGradient2DData): void {
  if (EditorLayout.beginGroup('Stars', false)) {
    EditorLayout.beginLabelsWidth(['Enable Stars']);

    const [enableStars, enableChanged] = EditorLayout.checkboxField('Enable Stars', data.enableStars, {
      tooltip: 'Enable procedural star rendering',
    });
    if (enableChanged) data.enableStars = enableStars;

    EditorLayout.endLabelsWidth();

    if (data.enableStars) {
      EditorLayout.beginIndent();
      EditorLayout.beginLabelsWidth(['Star Count', 'Seed', 'Min Size', 'Max Size', 'Height Range', 'Flicker Speed', 'Flicker Intensity']);

      const [starCount, countChanged] = EditorLayout.integerField('Star Count', data.starCount, {
        speed: 10,
        min: 0,
        max: 2000,
        tooltip: 'Number of stars to generate',
      });
      if (countChanged) data.starCount = starCount;

      const [seed, seedChanged] = EditorLayout.integerField('Seed', data.starSeed, {
        speed: 1,
        min: 0,
        max: 999999,
        tooltip: 'Random seed for deterministic star placement',
      });
      if (seedChanged) data.starSeed = seed;

      const [minSize, minSizeChanged] = EditorLayout.numberField('Min Size', data.starMinSize, {
        speed: 0.1,
        min: 0.5,
        max: 10,
        tooltip: 'Minimum star size',
      });
      if (minSizeChanged) data.starMinSize = minSize;

      const [maxSize, maxSizeChanged] = EditorLayout.numberField('Max Size', data.starMaxSize, {
        speed: 0.1,
        min: 0.5,
        max: 10,
        tooltip: 'Maximum star size',
      });
      if (maxSizeChanged) data.starMaxSize = maxSize;

      const [heightRange, heightRangeChanged] = EditorLayout.numberField('Height Range', data.starHeightRange, {
        min: 0,
        max: 1,
        useSlider: true,
        tooltip: 'Height range for stars (0-1, where 0.5 = bottom half)',
      });
      if (heightRangeChanged) data.starHeightRange = heightRange;

      const [flickerSpeed, flickerSpeedChanged] = EditorLayout.numberField('Flicker Speed', data.flickerSpeed, {
        min: 0,
        max: 10,
        useSlider: true,
        tooltip: 'Flicker animation speed',
      });
      if (flickerSpeedChanged) data.flickerSpeed = flickerSpeed;

      const [flickerIntensity, flickerIntensityChanged] = EditorLayout.numberField('Flicker Intensity', data.flickerIntensity, {
        min: 0,
        max: 1,
        useSlider: true,
        tooltip: 'How much stars vary in brightness (0-1)',
      });
      if (flickerIntensityChanged) data.flickerIntensity = flickerIntensity;

      EditorLayout.endLabelsWidth();
      EditorLayout.endIndent();
    }

    EditorLayout.endGroup();
  }
}

// ============================================================================
// Component Definition
// ============================================================================

export const SkyGradient2D = component<SkyGradient2DData>(
  'SkyGradient2D',
  {
    stops: { serializable: true },
    height: { serializable: true },
    sortingLayer: { serializable: true },
    sortingOrder: { serializable: true },
    visible: { serializable: true },
    isLit: { serializable: true },
    dirty: { serializable: true },
    enableStars: { serializable: true },
    starCount: { serializable: true },
    starMinSize: { serializable: true },
    starMaxSize: { serializable: true },
    starHeightRange: { serializable: true },
    starSeed: { serializable: true },
    flickerSpeed: { serializable: true },
    flickerIntensity: { serializable: true },
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
      dirty: true,
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
    customEditor: ({ componentData }) => {
      renderGradientStopsSection(componentData);
      renderVisibilitySection(componentData);
      renderTextureSection(componentData);
      renderStarsSection(componentData);
    },
  },
);
