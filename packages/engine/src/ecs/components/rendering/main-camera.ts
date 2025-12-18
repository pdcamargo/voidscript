import { component } from '../../component.js';

export interface MainCameraData {
  // Empty marker component - no data needed
}

/**
 * Main camera marker component.
 *
 * Attach this to a camera entity to mark it as the active rendering camera.
 * Only one entity should have this component at a time.
 *
 * If multiple entities have MainCamera, the first one found will be used (with a warning).
 *
 * If no entity has MainCamera:
 * - The first PerspectiveCamera entity is used
 * - If no PerspectiveCamera, the first OrthographicCamera entity is used
 * - If no cameras at all, the renderer's default camera is used
 *
 * @example
 * ```typescript
 * commands.spawn()
 *   .with(Transform3D, { position: new Vector3(0, 0, 10) })
 *   .with(PerspectiveCamera, { fov: 75 })
 *   .with(MainCamera, {})
 *   .build();
 * ```
 */
export const MainCamera = component<MainCameraData>(
  'MainCamera',
  {},
  {
    displayName: 'Main Camera',
    description: 'The main camera for the scene',
    path: 'rendering/camera',
  },
);
