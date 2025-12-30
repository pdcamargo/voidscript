import { system, SkyGradient2D, Sprite2DMaterial } from '@voidscript/engine';
import { FogSkySync } from '../components/fog-sky-sync.js';

export const fogSkySyncSystem = system(({ commands }) => {
  commands
    .query()
    .all(FogSkySync, Sprite2DMaterial)
    .each((_entity, fogSkySync, material) => {
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

      // Apply to fog_color uniform (vec3 stored as {x,y,z} in component)
      material.uniforms['fog_color'] = {
        x: bottomStop.color.r,
        y: bottomStop.color.g,
        z: bottomStop.color.b,
      };
    });
});
