import {
  component,
  type Entity,
  type ComponentType,
  SkyGradient2D,
  entityPicker,
  ImGui,
} from '@voidscript/engine';

export interface FogSkySyncData {
  skyEntity: Entity | null;
}

export const FogSkySync = component<FogSkySyncData>(
  'FogSkySync',
  {
    skyEntity: {
      serializable: true,
      type: 'entity',
      whenNullish: 'keep',
      isNullable: true,
    },
  },
  {
    displayName: 'Fog Sky Sync',
    description: 'Syncs fog color to the bottom color of a SkyGradient2D',
    path: 'effects/environment',
    defaultValue: () => ({
      skyEntity: null,
    }),
    customEditor: ({ componentData, commands }) => {
      ImGui.Text('Sky Entity:');
      const result = entityPicker({
        label: 'skyEntity',
        currentEntity: componentData.skyEntity,
        commands,
        allowNone: true,
        requiredComponents: [SkyGradient2D] as ComponentType<unknown>[],
      });
      if (result.changed) {
        componentData.skyEntity = result.entity;
      }
    },
  },
);
