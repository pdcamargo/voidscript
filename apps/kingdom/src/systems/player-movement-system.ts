import {
  system,
  Input,
  KeyCode,
  DesiredMovement2D,
  isGameplayActive,
} from '@voidscript/engine';
import { Player2D } from '../components/player-2d.js';

export const playerMovementSystem = system(({ commands }) => {
  const deltaTime = commands.getDeltaTime();

  // Check for left/right input with OR logic to prevent double speed
  const isLeftPressed =
    Input.isKeyPressed(KeyCode.KeyA) || Input.isKeyPressed(KeyCode.ArrowLeft);
  const isRightPressed =
    Input.isKeyPressed(KeyCode.KeyD) || Input.isKeyPressed(KeyCode.ArrowRight);

  // Calculate movement direction (-1, 0, or 1)
  let moveDirection = 0;
  if (isLeftPressed) moveDirection -= 1;
  if (isRightPressed) moveDirection += 1;

  // Set desired movement for character controller
  commands
    .query()
    .all(Player2D, DesiredMovement2D)
    .each((_entity, playerData, desiredMovement) => {
      desiredMovement.translation.x =
        moveDirection * playerData.movementSpeed * deltaTime;
      desiredMovement.translation.y = 0;
    });
}).runIf(isGameplayActive());
