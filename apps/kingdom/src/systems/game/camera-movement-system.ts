import {
  Camera,
  Input,
  KeyCode,
  MainCamera,
  system,
  Transform3D,
} from '@voidscript/engine';

const CAMERA_SPEED = 300;

// Camera movement system for arrow keys / WASD
export const cameraMovementSystem = system(({ commands }) => {
  const deltaTime = commands.getDeltaTime();

  let moveX = 0;
  let moveY = 0;

  if (Input.isKeyPressed(KeyCode.KeyW)) moveY += 1;
  if (Input.isKeyPressed(KeyCode.KeyS)) moveY -= 1;
  if (Input.isKeyPressed(KeyCode.KeyA)) moveX -= 1;
  if (Input.isKeyPressed(KeyCode.KeyD)) moveX += 1;

  if (Input.isKeyPressed(KeyCode.ArrowUp)) moveY += 1;
  if (Input.isKeyPressed(KeyCode.ArrowDown)) moveY -= 1;
  if (Input.isKeyPressed(KeyCode.ArrowLeft)) moveX -= 1;
  if (Input.isKeyPressed(KeyCode.ArrowRight)) moveX += 1;

  if (moveX === 0 && moveY === 0) return;

  commands
    .query()
    .all(Transform3D, Camera, MainCamera)
    .each((_entity, transform) => {
      transform.position.x += moveX * CAMERA_SPEED * deltaTime;
      transform.position.y += moveY * CAMERA_SPEED * deltaTime;
    });
});
