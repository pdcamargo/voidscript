/**
 * Trigger Zone 3D System
 *
 * Listens for 3D collision events and dispatches configured trigger events
 * when entities matching the component filter enter or leave sensor zones.
 *
 * Runs AFTER physics3DCollisionEventSystem to process collision events.
 */

import { system } from '@voidscript/core';
import { isGameplayActive } from '../../../editor/system-conditions.js';
import { physics3DCollisionEventSystem } from '../../../physics/3d/physics-3d-collision-event-system.js';
import {
  CollisionStarted3D,
  CollisionEnded3D,
} from '../../../physics/collision/collision-events.js';
import { TriggerZone3D } from '../../components/trigger/trigger-zone-3d.js';
import {
  passesTriggerFilter,
  dispatchTriggerEvents,
} from './trigger-utils.js';

export const triggerZone3DSystem = system(({ commands }) => {
  // ==========================================================================
  // Process Enter Events
  // ==========================================================================

  const startReader = commands.eventReader(CollisionStarted3D);
  for (const event of startReader.read()) {
    // Only interested in sensor collisions
    if (!event.isSensor()) continue;

    // Determine which entity is the trigger zone and which is triggering
    const zoneA = commands.tryGetComponent(event.entityA, TriggerZone3D);
    const zoneB = commands.tryGetComponent(event.entityB, TriggerZone3D);

    // Process when entityA is the zone
    if (zoneA && zoneA.enabled) {
      const triggeringEntity = event.entityB;

      if (
        passesTriggerFilter(
          commands,
          triggeringEntity,
          zoneA.requiredComponentNames,
          zoneA.filterMode
        )
      ) {
        dispatchTriggerEvents(
          commands,
          zoneA.onEnterEventNames,
          event.entityA,
          triggeringEntity
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
          zoneB.filterMode
        )
      ) {
        dispatchTriggerEvents(
          commands,
          zoneB.onEnterEventNames,
          event.entityB,
          triggeringEntity
        );
      }
    }
  }

  // ==========================================================================
  // Process Leave Events
  // ==========================================================================

  const endReader = commands.eventReader(CollisionEnded3D);
  for (const event of endReader.read()) {
    // Only interested in sensor collisions
    if (!event.isSensor()) continue;

    // Skip if collision ended due to entity removal
    if (event.isRemoved()) continue;

    // Determine which entity is the trigger zone and which is triggering
    const zoneA = commands.tryGetComponent(event.entityA, TriggerZone3D);
    const zoneB = commands.tryGetComponent(event.entityB, TriggerZone3D);

    // Process when entityA is the zone
    if (zoneA && zoneA.enabled) {
      const triggeringEntity = event.entityB;

      if (
        passesTriggerFilter(
          commands,
          triggeringEntity,
          zoneA.requiredComponentNames,
          zoneA.filterMode
        )
      ) {
        dispatchTriggerEvents(
          commands,
          zoneA.onLeaveEventNames,
          event.entityA,
          triggeringEntity
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
          zoneB.filterMode
        )
      ) {
        dispatchTriggerEvents(
          commands,
          zoneB.onLeaveEventNames,
          event.entityB,
          triggeringEntity
        );
      }
    }
  }
})
  .runAfter(physics3DCollisionEventSystem)
  .runIf(isGameplayActive());
