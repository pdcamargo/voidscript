import { component } from '@voidscript/engine';

export interface Player2DData {
  movementSpeed: number;
}

export const Player2D = component<Player2DData>(
  'Player2D',
  {
    movementSpeed: {
      serializable: true,
      instanceType: Number,
    },
  },
  {
    displayName: 'Player 2D',
    description: '2D player character component',
    path: 'game/player',
    defaultValue: () => ({
      movementSpeed: 75,
    }),
  },
);
