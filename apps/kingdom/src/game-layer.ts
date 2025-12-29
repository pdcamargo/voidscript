import { Layer } from '@voidscript/engine';
import { renderCloudGeneratorPanel } from './ui/cloud-generator-panel.js';
import { renderMoonGeneratorPanel } from './ui/moon-generator-panel.js';
import { renderSunGeneratorPanel } from './ui/sun-generator-panel.js';
import { cloudMovementSystem } from './systems/cloud-movement-system.js';
import { fogSkySyncSystem } from './systems/fog-sky-sync-system.js';
import { cameraMovementSystem } from './systems/game/camera-movement-system.js';
import { playerMovementSystem } from './systems/player-movement-system.js';
import { forestLightSystem } from './systems/forest-light-system.js';
import { gameTimeSystem } from './systems/game-time-system.js';
import { weatherScheduleSystem } from './systems/weather-schedule-system.js';
import { campFireSyncSystem } from './systems/camp-fire-sync-system.js';

/**
 * Main loop layer for the Kingdom game
 */
export class GameLayer extends Layer {
  constructor() {
    super('GameLayer');
  }

  override async onAttach(): Promise<void> {
    const app = this.getApplication();

    // Core game systems (run in order)
    app.addUpdateSystem(gameTimeSystem);
    app.addUpdateSystem(weatherScheduleSystem);

    // Player and camera
    app.addUpdateSystem(cameraMovementSystem);
    app.addUpdateSystem(playerMovementSystem);

    // Environment systems
    app.addUpdateSystem(cloudMovementSystem);
    app.addUpdateSystem(fogSkySyncSystem);
    app.addUpdateSystem(forestLightSystem);

    // Building sync systems (runs in editor and play mode)
    app.addUpdateSystem(campFireSyncSystem);
  }

  override onDetach(): void {}

  override onImGuiRender(): void {
    // Render texture generator windows if opened via menu
    renderCloudGeneratorPanel(this.getApplication());
    renderMoonGeneratorPanel(this.getApplication());
    renderSunGeneratorPanel(this.getApplication());
  }
}
