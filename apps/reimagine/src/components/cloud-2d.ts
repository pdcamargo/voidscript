import { component } from '@voidscript/engine';

export interface Cloud2DData {
  speed: number;
  direction: { x: number; y: number };
  minBoundX: number;
  maxBoundX: number;
}

export const Cloud2D = component<Cloud2DData>(
  'Cloud2D',
  {
    speed: {
      serializable: true,
      instanceType: Number,
    },
    direction: {
      serializable: true,
    },
    minBoundX: {
      serializable: true,
      instanceType: Number,
    },
    maxBoundX: {
      serializable: true,
      instanceType: Number,
    },
  },
  {
    displayName: 'Cloud 2D',
    description: 'Makes an entity move like a cloud with configurable speed and direction',
    path: 'effects/cloud',
    defaultValue: () => ({
      speed: 0.3,
      direction: { x: 1, y: 0 },
      minBoundX: -250,
      maxBoundX: 250,
    }),
  }
);
