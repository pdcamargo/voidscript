import { component } from '../../component.js';

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
  },
);
