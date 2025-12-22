/**
 * Trigger Zone 2D System
 *
 * Listens for 2D collision events and dispatches configured trigger events
 * when entities matching the component filter enter or leave sensor zones.
 *
 * Runs AFTER physics2DCollisionEventSystem to process collision events.
 */

import { system } from '../../system.js';
import { isGameplayActive } from '../../../editor/system-conditions.js';
import { physics2DCollisionEventSystem } from '../../../physics/2d/physics-2d-collision-event-system.js';
import {
  CollisionStarted2D,
  CollisionEnded2D,
} from '../../../physics/collision/collision-events.js';
import { TriggerZone2D } from '../../components/trigger/trigger-zone-2d.js';
import { passesTriggerFilter, dispatchTriggerEvents } from './trigger-utils.js';

export const triggerZone2DSystem = system(({ commands }) => {
  // ==========================================================================
  // Process Enter Events
  // ==========================================================================

  const startReader = commands.eventReader(CollisionStarted2D);
  for (const event of startReader.read()) {
    // Only interested in sensor collisions
    if (!event.isSensor()) continue;

    // Determine which entity is the trigger zone and which is triggering
    const zoneA = commands.tryGetComponent(event.entityA, TriggerZone2D);
    const zoneB = commands.tryGetComponent(event.entityB, TriggerZone2D);

    // Process when entityA is the zone
    if (zoneA && zoneA.enabled) {
      const triggeringEntity = event.entityB;

      if (
        passesTriggerFilter(
          commands,
          triggeringEntity,
          zoneA.requiredComponentNames,
          zoneA.filterMode,
        )
      ) {
        dispatchTriggerEvents(
          commands,
          zoneA.onEnterEventNames,
          event.entityA,
          triggeringEntity,
        );
      }
    }

    // Process when entityB is the zone
    if (zoneB && zoneB.enabled) {
      const triggeringEntity = event.entityA;

      if (
        passesTriggerFilter(
          commands,
          triggeringEntity,
          zoneB.requiredComponentNames,
          zoneB.filterMode,
        )
      ) {
        dispatchTriggerEvents(
          commands,
          zoneB.onEnterEventNames,
          event.entityB,
          triggeringEntity,
        );
      }
    }
  }

  // ==========================================================================
  // Process Leave Events
  // ==========================================================================

  const endReader = commands.eventReader(CollisionEnded2D);
  for (const event of endReader.read()) {
    // Only interested in sensor collisions
    if (!event.isSensor()) continue;

    // Skip if collision ended due to entity removal
    if (event.isRemoved()) continue;

    // Determine which entity is the trigger zone and which is triggering
    const zoneA = commands.tryGetComponent(event.entityA, TriggerZone2D);
    const zoneB = commands.tryGetComponent(event.entityB, TriggerZone2D);

    // Process when entityA is the zone
    if (zoneA && zoneA.enabled) {
      const triggeringEntity = event.entityB;

      if (
        passesTriggerFilter(
          commands,
          triggeringEntity,
          zoneA.requiredComponentNames,
          zoneA.filterMode,
        )
      ) {
        dispatchTriggerEvents(
          commands,
          zoneA.onLeaveEventNames,
          event.entityA,
          triggeringEntity,
        );
      }
    }

    // Process when entityB is the zone
    if (zoneB && zoneB.enabled) {
      const triggeringEntity = event.entityA;

      if (
        passesTriggerFilter(
          commands,
          triggeringEntity,
          zoneB.requiredComponentNames,
          zoneB.filterMode,
        )
      ) {
        dispatchTriggerEvents(
          commands,
          zoneB.onLeaveEventNames,
          event.entityB,
          triggeringEntity,
        );
      }
    }
  }
})
  .runAfter(physics2DCollisionEventSystem)
  .runIf(isGameplayActive());
