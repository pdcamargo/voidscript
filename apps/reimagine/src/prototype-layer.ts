import {
  Layer,
  system,
  Camera,
  MainCamera,
  Transform3D,
  Input,
  KeyCode,
  ImGuiLayer,
  DesiredMovement2D,
  isGameplayActive,
} from '@voidscript/engine';
import { Player2D } from './components/player-2d';
import { renderCloudGeneratorPanel } from './ui/cloud-generator-panel.js';
import { cloudMovementSystem } from './systems/cloud-movement-system.js';

const PROTOTYPE_CAMERA_SPEED = 300;

/**
 * PrototypeLayer - Game-specific layer for custom gameplay systems
 *
 * This layer handles game-specific logic like camera movement.
 * The editor UI (hierarchy, inspector, toolbar, etc.) is handled
 * by the EditorLayer which is set up via setupEditor().
 */
export class PrototypeLayer extends Layer {
  constructor() {
    super('PrototypeLayer');
  }

  override async onAttach(): Promise<void> {
    const app = this.getApplication();

    // Camera movement system for arrow keys / WASD
    const tiledCameraMovementSystem = system(({ commands }) => {
      // Don't process input if ImGui wants keyboard (e.g., typing in inspector)
      const imguiLayer = app.getLayer(
        ImGuiLayer as new (...args: unknown[]) => ImGuiLayer,
      );
      if (imguiLayer?.wantsKeyboard()) {
        return;
      }

      const deltaTime = app.getDeltaTime();

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
          transform.position.x += moveX * PROTOTYPE_CAMERA_SPEED * deltaTime;
          transform.position.y += moveY * PROTOTYPE_CAMERA_SPEED * deltaTime;
        });
    });

    app.addUpdateSystem(tiledCameraMovementSystem);

    // Player movement system (update phase, runs before physics sync)
    const playerMovementSystem = system(({ commands }) => {
      const deltaTime = app.getDeltaTime();

      // Check for left/right input with OR logic to prevent double speed
      const isLeftPressed =
        Input.isKeyPressed(KeyCode.KeyA) ||
        Input.isKeyPressed(KeyCode.ArrowLeft);
      const isRightPressed =
        Input.isKeyPressed(KeyCode.KeyD) ||
        Input.isKeyPressed(KeyCode.ArrowRight);

      // Calculate movement direction (-1, 0, or 1)
      let moveDirection = 0;
      if (isLeftPressed) moveDirection -= 1;
      if (isRightPressed) moveDirection += 1;

      // Set desired movement for character controller
      commands
        .query()
        .all(Player2D, DesiredMovement2D)
        .each((_entity, playerData, desiredMovement) => {
          desiredMovement.translation.x = moveDirection * playerData.movementSpeed * deltaTime;
          desiredMovement.translation.y = 0;
        });
    }).runIf(isGameplayActive());

    app.addUpdateSystem(playerMovementSystem);
    app.addUpdateSystem(cloudMovementSystem);

    console.log(
      '[PrototypeLayer] Layer attached - Camera movement, player movement, and cloud movement systems registered',
    );
  }

  override onDetach(): void {
    console.log('[PrototypeLayer] Layer detached');
  }

  override onImGuiRender(): void {
    // Render the Cloud Texture Generator window if opened via menu
    renderCloudGeneratorPanel(this.getApplication());
  }
}
