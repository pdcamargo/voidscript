import { system, SkyGradient2D, Fog2D } from '@voidscript/engine';
import { FogSkySync } from '../components/fog-sky-sync.js';

export const fogSkySyncSystem = system(({ commands }) => {
  commands
    .query()
    .all(FogSkySync, Fog2D)
    .each((_entity, fogSkySync, fog) => {
      if (fogSkySync.skyEntity === null) return;

      const skyGradient = commands.tryGetComponent(
        fogSkySync.skyEntity,
        SkyGradient2D,
      );
      if (!skyGradient || skyGradient.stops.length === 0) return;

      // Find the bottom color (stop with lowest position value)
      const firstStop = skyGradient.stops[0];
      if (!firstStop) return;

      const bottomStop = skyGradient.stops.reduce(
        (min, stop) => (stop.position < min.position ? stop : min),
        firstStop,
      );

      // Apply to fog (RGB only)
      fog.fogColor.r = bottomStop.color.r;
      fog.fogColor.g = bottomStop.color.g;
      fog.fogColor.b = bottomStop.color.b;
    });
});
