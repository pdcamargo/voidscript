/**
 * UI Interaction Event System
 *
 * Bridges UIInteractionManager callbacks to ECS events.
 * When a user interacts with a UI element that has UIInteraction component,
 * this system dispatches the configured events.
 *
 * This system only runs during play mode.
 */

import { system } from '@voidscript/core';
import { Events } from '@voidscript/core';
import { isGameplayActive } from '../editor/system-conditions.js';
import { UIInteractionManager, type UIInteractionEvent } from './ui-interaction.js';
import { UIInteraction, type UIInteractionData } from './components/ui-interaction.js';
import type { Entity } from '@voidscript/core';

/**
 * Initialize the UI interaction event dispatching.
 * This should be called once when setting up the application.
 */
export function setupUIInteractionEvents(
  uiInteractionManager: UIInteractionManager,
  events: Events,
  getUIInteraction: (entity: Entity) => UIInteractionData | undefined,
): void {
  uiInteractionManager.addCallback((event: UIInteractionEvent) => {
    // Get the UIInteraction component for this entity
    const interactionData = getUIInteraction(event.entity);
    if (!interactionData || !interactionData.enabled) {
      return;
    }

    // Get event names based on interaction type
    let eventNames: string[] = [];

    switch (event.type) {
      case 'click':
        eventNames = interactionData.onClickEventNames;
        break;
      case 'press':
        eventNames = interactionData.onPressEventNames;
        break;
      case 'release':
        eventNames = interactionData.onReleaseEventNames;
        break;
      case 'hover-enter':
        eventNames = interactionData.onHoverEnterEventNames;
        break;
      case 'hover-exit':
        eventNames = interactionData.onHoverExitEventNames;
        break;
    }

    // Dispatch each configured event
    for (const eventName of eventNames) {
      const EventClass = events.getEventClass(eventName);
      if (EventClass) {
        try {
          // Events follow the convention: new EventClass(entity)
          const eventInstance = new EventClass(event.entity);
          const writer = events.writer(EventClass);
          writer.send(eventInstance);
        } catch (error) {
          console.warn(
            `Failed to dispatch UI event "${eventName}":`,
            error instanceof Error ? error.message : error,
          );
        }
      } else {
        console.warn(
          `UIInteraction: Event "${eventName}" not found. ` +
            `Make sure to register it with app.addEvent()`,
        );
      }
    }
  });
}

/**
 * UI Interaction Update System
 *
 * Updates the UIInteractionManager each frame to process hover states
 * and button states. Also handles interaction event callbacks.
 *
 * Only runs during play mode.
 */
export const uiInteractionUpdateSystem = system(({ commands }) => {
  const uiInteractionManager = commands.tryGetResource(UIInteractionManager);
  if (!uiInteractionManager) {
    return;
  }

  // Update hover detection
  uiInteractionManager.update();

  // Update button states for entities with UIInteraction
  commands
    .query()
    .all(UIInteraction)
    .each((entity, interaction) => {
      // Button state is handled by uiButtonSyncSystem
      // UIInteraction just needs to be checked by the callback
    });
}).runIf(isGameplayActive());
