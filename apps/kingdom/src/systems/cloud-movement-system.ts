import { system, LocalTransform3D, isGameplayActive } from '@voidscript/engine';
import { Cloud2D } from '../components/cloud-2d.js';

export const cloudMovementSystem = system(({ commands }) => {
  const deltaTime = commands.getDeltaTime();

  commands
    .query()
    .all(Cloud2D, LocalTransform3D)
    .each((_entity, cloud, transform) => {
      // Move cloud based on speed and direction
      transform.position.x += cloud.direction.x * cloud.speed * deltaTime;
      transform.position.y += cloud.direction.y * cloud.speed * deltaTime;

      // Wrap around when exceeding X boundaries
      if (transform.position.x > cloud.maxBoundX) {
        transform.position.x = cloud.minBoundX;
      } else if (transform.position.x < cloud.minBoundX) {
        transform.position.x = cloud.maxBoundX;
      }
    });
}).runIf(isGameplayActive());
