import { component } from '../../component.js';
import { EditorLayout } from '../../../app/imgui/editor-layout.js';

export enum FogType {
  Smooth = 'smooth',
  Hard = 'hard',
  Limited = 'limited',
}

export interface Fog2DData {
  baseSize: { x: number; y: number };
  fogColor: { r: number; g: number; b: number };
  fogOpacity: number;
  fogType: FogType;
  fogStart: number;
  fogEnd: number;
  noiseStrength: number;
  pixelResolution: { x: number; y: number };
  sortingLayer: number;
  sortingOrder: number;
  visible: boolean;
  isLit: boolean;
}

export const Fog2D = component<Fog2DData>(
  'Fog2D',
  {
    baseSize: {
      serializable: true,
    },
    fogColor: {
      serializable: true,
    },
    fogOpacity: {
      serializable: true,
    },
    fogType: {
      serializable: true,
      type: 'enum',
      enum: FogType,
    },
    fogStart: {
      serializable: true,
    },
    fogEnd: {
      serializable: true,
    },
    noiseStrength: {
      serializable: true,
    },
    pixelResolution: {
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
  },
  {
    path: 'rendering/2d/fog-2d',
    defaultValue: (): Fog2DData => ({
      baseSize: { x: 10, y: 10 },
      fogColor: { r: 0.8, g: 0.8, b: 0.8 },
      fogOpacity: 1.0,
      fogType: FogType.Smooth,
      fogStart: 0.3,
      fogEnd: 0.7,
      noiseStrength: 0.15,
      pixelResolution: { x: 160, y: 90 },
      sortingLayer: 50,
      sortingOrder: 0,
      visible: true,
      isLit: false,
    }),
    displayName: 'Fog 2D',
    description: '2D fog effect with customizable appearance',
    customEditor: ({ componentData }) => {
      // Appearance section
      if (EditorLayout.beginGroup('Appearance', true)) {
        EditorLayout.beginLabelsWidth(['Fog Type', 'Fog Color', 'Opacity', 'Visible']);

        const fogTypes = ['smooth', 'hard', 'limited'] as const;
        const [fogType, typeChanged] = EditorLayout.comboField(
          'Fog Type',
          componentData.fogType,
          [...fogTypes],
          { tooltip: 'Fog blending style' }
        );
        if (typeChanged) {
          componentData.fogType = fogType as FogType;
        }

        const [color, colorChanged] = EditorLayout.colorField(
          'Fog Color',
          componentData.fogColor,
          { tooltip: 'Color of the fog' }
        );
        if (colorChanged) {
          componentData.fogColor.r = color.r;
          componentData.fogColor.g = color.g;
          componentData.fogColor.b = color.b;
        }

        const [opacity, opacityChanged] = EditorLayout.numberField(
          'Opacity',
          componentData.fogOpacity,
          { speed: 0.01, min: 0, max: 1, tooltip: 'Fog opacity (0-1)' }
        );
        if (opacityChanged) {
          componentData.fogOpacity = opacity;
        }

        const [visible, visibleChanged] = EditorLayout.checkboxField(
          'Visible',
          componentData.visible,
          { tooltip: 'Toggle fog visibility' }
        );
        if (visibleChanged) {
          componentData.visible = visible;
        }

        EditorLayout.endLabelsWidth();
        EditorLayout.endGroup();
      }

      // Size & Resolution section
      if (EditorLayout.beginGroup('Size & Resolution', false)) {
        EditorLayout.beginLabelsWidth(['Base Size', 'Pixel Resolution']);

        const [baseSize, baseSizeChanged] = EditorLayout.vector2Field(
          'Base Size',
          componentData.baseSize,
          { speed: 0.1, tooltip: 'Size of the fog area in world units' }
        );
        if (baseSizeChanged) {
          componentData.baseSize.x = baseSize.x;
          componentData.baseSize.y = baseSize.y;
        }

        const [pixelRes, pixelResChanged] = EditorLayout.vector2Field(
          'Pixel Resolution',
          componentData.pixelResolution,
          { speed: 1, tooltip: 'Render resolution (lower = more pixelated)' }
        );
        if (pixelResChanged) {
          componentData.pixelResolution.x = Math.round(pixelRes.x);
          componentData.pixelResolution.y = Math.round(pixelRes.y);
        }

        EditorLayout.endLabelsWidth();
        EditorLayout.endGroup();
      }

      // Fog Range section
      if (EditorLayout.beginGroup('Fog Range', false)) {
        EditorLayout.beginLabelsWidth(['Fog Start', 'Fog End', 'Noise Strength']);

        const [fogStart, startChanged] = EditorLayout.numberField(
          'Fog Start',
          componentData.fogStart,
          { speed: 0.01, min: 0, max: 1, tooltip: 'Distance where fog begins (0-1)' }
        );
        if (startChanged) {
          componentData.fogStart = fogStart;
        }

        const [fogEnd, endChanged] = EditorLayout.numberField(
          'Fog End',
          componentData.fogEnd,
          { speed: 0.01, min: 0, max: 1, tooltip: 'Distance where fog is fully opaque (0-1)' }
        );
        if (endChanged) {
          componentData.fogEnd = fogEnd;
        }

        const [noise, noiseChanged] = EditorLayout.numberField(
          'Noise Strength',
          componentData.noiseStrength,
          { speed: 0.01, min: 0, max: 1, tooltip: 'Amount of noise variation in the fog' }
        );
        if (noiseChanged) {
          componentData.noiseStrength = noise;
        }

        EditorLayout.endLabelsWidth();
        EditorLayout.endGroup();
      }

      // Sorting section
      if (EditorLayout.beginGroup('Sorting', false)) {
        EditorLayout.beginLabelsWidth(['Sorting Layer', 'Sorting Order', 'Is Lit']);

        const [layer, layerChanged] = EditorLayout.integerField(
          'Sorting Layer',
          componentData.sortingLayer,
          { speed: 1, tooltip: 'Render layer (higher = rendered later)' }
        );
        if (layerChanged) {
          componentData.sortingLayer = layer;
        }

        const [order, orderChanged] = EditorLayout.integerField(
          'Sorting Order',
          componentData.sortingOrder,
          { speed: 1, tooltip: 'Order within layer (higher = rendered later)' }
        );
        if (orderChanged) {
          componentData.sortingOrder = order;
        }

        const [isLit, litChanged] = EditorLayout.checkboxField(
          'Is Lit',
          componentData.isLit,
          { tooltip: 'Whether fog is affected by lighting' }
        );
        if (litChanged) {
          componentData.isLit = isLit;
        }

        EditorLayout.endLabelsWidth();
        EditorLayout.endGroup();
      }
    },
  },
);
