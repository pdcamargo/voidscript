import { system, LocalTransform3D, isGameplayActive } from '@voidscript/engine';
import { Cloud2D } from '../components/cloud-2d.js';

export const cloudMovementSystem = system(({ commands }) => {
  const deltaTime = commands.getDeltaTime();

  commands
    .query()
    .all(Cloud2D, LocalTransform3D)
    .each((_entity, cloud, transform) => {
      // Initialize actualSpeed with random variation (90%-110%) on first frame
      if (!cloud.actualSpeed) {
        const variation = 0.9 + Math.random() * 0.2; // Random between 0.9 and 1.1
        cloud.actualSpeed = cloud.speed * variation;
      }

      // Move cloud based on actualSpeed and direction
      transform.position.x += cloud.direction.x * cloud.actualSpeed * deltaTime;
      transform.position.y += cloud.direction.y * cloud.actualSpeed * deltaTime;

      // Wrap around when exceeding X boundaries
      if (transform.position.x > cloud.maxBoundX) {
        transform.position.x = cloud.minBoundX;
      } else if (transform.position.x < cloud.minBoundX) {
        transform.position.x = cloud.maxBoundX;
      }
    });
}).runIf(isGameplayActive());
