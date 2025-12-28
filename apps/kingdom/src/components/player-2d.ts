import { component, EditorLayout } from '@voidscript/engine';

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
    customEditor: ({ componentData }) => {
      EditorLayout.beginLabelsWidth(['Movement Speed']);

      const [speed, speedChanged] = EditorLayout.numberField(
        'Movement Speed',
        componentData.movementSpeed,
        {
          speed: 1,
          min: 0,
          max: 500,
          tooltip: 'Player movement speed in units per second',
        }
      );
      if (speedChanged) {
        componentData.movementSpeed = speed;
      }

      EditorLayout.endLabelsWidth();
    },
  },
);
