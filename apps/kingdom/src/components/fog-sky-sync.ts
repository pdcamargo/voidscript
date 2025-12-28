import {
  component,
  type Entity,
  type ComponentType,
  SkyGradient2D,
  EditorLayout,
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
    customEditor: ({ componentData }) => {
      const [entity, changed] = EditorLayout.entityField('Sky Entity', componentData.skyEntity, {
        allowNone: true,
        requiredComponents: [SkyGradient2D] as ComponentType<unknown>[],
        tooltip: 'Entity with SkyGradient2D component to sync fog color from',
      });
      if (changed) {
        componentData.skyEntity = entity;
      }
    },
  },
);
