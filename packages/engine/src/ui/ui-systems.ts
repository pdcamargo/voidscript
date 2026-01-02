/**
 * UI Systems
 *
 * ECS systems for synchronizing UI components with three-mesh-ui
 * and rendering the UI layer.
 */

import ThreeMeshUI from 'three-mesh-ui';
import * as THREE from 'three';
import { system } from '@voidscript/core';
import { UIManager } from './ui-manager.js';
import { UICanvas, type UICanvasData } from './components/ui-canvas.js';
import { UIBlock, type UIBlockData, uiBlockDataToOptions, getAnchorOffset, getPivotOffset } from './components/ui-block.js';
import { UIText, type UITextData, uiTextDataToOptions } from './components/ui-text.js';
import { UIButton, type UIButtonData, uiButtonDataToOptions } from './components/ui-button.js';
import { Parent } from '@voidscript/core';
import { Transform3D, type Transform3DData } from '../ecs/components/rendering/transform-3d.js';
import type { Entity } from '@voidscript/core';
import { Application } from '../app/application.js';
import { UIInteractionManager } from './ui-interaction.js';
import { UIInteraction } from './components/ui-interaction.js';

// Default MSDF font paths (Roboto)
const DEFAULT_FONT_JSON = '/fonts/Roboto-msdf.json';
const DEFAULT_FONT_TEXTURE = '/fonts/Roboto-msdf.png';

// Track entities with UI components for cleanup on deletion
const trackedUIBlocks = new Map<Entity, ThreeMeshUI.Block>();
const trackedUIButtons = new Map<Entity, ThreeMeshUI.Block>();
const trackedUITexts = new Map<Entity, ThreeMeshUI.Text>();
const trackedUICanvases = new Set<Entity>();

/**
 * Clear all UI tracking maps.
 * Called when exiting play mode to prevent stale entity references.
 * The actual Three.js objects are disposed by UIManager.dispose().
 */
export function clearUITracking(): void {
  trackedUIBlocks.clear();
  trackedUIButtons.clear();
  trackedUITexts.clear();
  trackedUICanvases.clear();
}

/**
 * UI Canvas Sync System
 *
 * Creates and manages UICanvas root blocks.
 * Runs in render phase to ensure all canvas roots exist.
 */
export const uiCanvasSyncSystem = system(({ commands }) => {
  const app = Application.get();
  const uiManager = app.getResource(UIManager);

  if (!uiManager) return;

  // Process all UICanvas components
  commands
    .query()
    .all(UICanvas)
    .each((entity, canvas: UICanvasData) => {
      // Skip disabled canvases
      if (!canvas.enabled) {
        if (canvas._root) {
          uiManager.removeUIRoot(entity);
          canvas._root = undefined;
          trackedUICanvases.delete(entity);
        }
        return;
      }

      // Create root if needed
      if (!canvas._root || canvas._dirty) {
        if (canvas._root) {
          uiManager.removeUIRoot(entity);
        }
        canvas._root = uiManager.createUIRoot(entity);
        canvas._dirty = false;
        trackedUICanvases.add(entity);
      }
    });

  // Cleanup canvases for entities that were destroyed
  for (const entity of trackedUICanvases) {
    if (!commands.isAlive(entity)) {
      uiManager.removeUIRoot(entity);
      trackedUICanvases.delete(entity);
    }
  }
});

/**
 * UI Block Sync System
 *
 * Synchronizes UIBlock components with three-mesh-ui Block instances.
 * Handles parent-child relationships via the Parent component.
 */
export const uiBlockSyncSystem = system(({ commands }) => {
  const app = Application.get();
  const uiManager = app.getResource(UIManager);

  if (!uiManager) return;

  // Map to track entity -> Block for parent lookups
  const entityBlocks = new Map<Entity, ThreeMeshUI.Block>();

  // First pass: Create/update all blocks and collect them
  commands
    .query()
    .all(UIBlock)
    .each((entity, block: UIBlockData) => {
      // Skip invisible blocks
      if (!block.visible) {
        if (block._block) {
          block._block.visible = false;
        }
        return;
      }

      // Create block if needed
      if (!block._block || block._dirty) {
        if (block._block) {
          // Remove from parent if exists
          const parent = block._block.parent;
          if (parent) {
            parent.remove(block._block);
          }
        }

        // Create new block with current properties
        const options = uiBlockDataToOptions(block);
        block._block = new ThreeMeshUI.Block(options as ThreeMeshUI.BlockOptions);
        block._dirty = false;

        // Track for cleanup
        trackedUIBlocks.set(entity, block._block);
      } else {
        // Update existing block properties
        (block._block as any).set(uiBlockDataToOptions(block));
      }

      block._block.visible = true;
      entityBlocks.set(entity, block._block);
    });

  // Second pass: Setup parent-child relationships
  commands
    .query()
    .all(UIBlock, Parent)
    .each((entity, block: UIBlockData, parent) => {
      if (!block._block) return;

      const parentEntity = parent.id;

      // Check if parent is a UICanvas
      const parentCanvas = commands.tryGetComponent(parentEntity, UICanvas);
      if (parentCanvas && parentCanvas._root) {
        // Parent is a canvas - add to canvas root
        if (block._block.parent !== parentCanvas._root) {
          if (block._block.parent) {
            block._block.parent.remove(block._block);
          }
          parentCanvas._root.add(block._block);
        }
        return;
      }

      // Check if parent is another UIBlock
      const parentBlockComp = commands.tryGetComponent(parentEntity, UIBlock);
      if (parentBlockComp && parentBlockComp._block) {
        // Parent is a block - add to parent block
        if (block._block.parent !== parentBlockComp._block) {
          if (block._block.parent) {
            block._block.parent.remove(block._block);
          }
          parentBlockComp._block.add(block._block);
        }
        return;
      }
    });

  // Third pass: Add orphan blocks directly to UI scene
  // (blocks without Parent component or with invalid parent)
  commands
    .query()
    .all(UIBlock)
    .none(Parent)
    .each((entity, block: UIBlockData) => {
      if (!block._block) return;

      // If not already in scene, add it
      if (!block._block.parent) {
        uiManager.getUIScene().add(block._block);
      }
    });

  // Fourth pass: Apply anchor/pivot positioning + Transform3D offset to blocks
  const screenSize = uiManager.getScreenSize();

  commands
    .query()
    .all(UIBlock)
    .each((entity, block: UIBlockData) => {
      if (!block._block) return;

      // Get anchor position on screen (normalized -0.5 to 0.5, multiply by screen size)
      const anchorOffset = getAnchorOffset(block.anchor);
      const anchorX = anchorOffset.x * screenSize.width;
      const anchorY = anchorOffset.y * screenSize.height;

      // Get pivot offset on element (normalized -0.5 to 0.5, multiply by element size)
      const pivotOffset = getPivotOffset(block.pivot);
      const pivotX = pivotOffset.x * block.width;
      const pivotY = pivotOffset.y * block.height;

      // Get Transform3D offset if present
      const transform = commands.tryGetComponent(entity, Transform3D);
      const offsetX = transform?.position.x ?? 0;
      const offsetY = transform?.position.y ?? 0;

      // Final position = anchor position + pivot adjustment + transform offset
      block._block.position.x = anchorX + pivotX + offsetX;
      block._block.position.y = anchorY + pivotY + offsetY;
    });

  // Register blocks that have UIInteraction with the interaction manager
  const interactionManager = app.getResource(UIInteractionManager);
  if (interactionManager) {
    commands
      .query()
      .all(UIBlock, UIInteraction)
      .each((entity, block: UIBlockData, _interaction) => {
        if (block._block) {
          interactionManager.registerBlock(entity, block._block);
        }
      });
  }

  // Cleanup blocks for entities that were destroyed
  for (const [entity, block] of trackedUIBlocks) {
    if (!commands.isAlive(entity)) {
      // Remove from parent
      if (block.parent) {
        block.parent.remove(block);
      }
      // Unregister from interaction manager
      if (interactionManager) {
        interactionManager.unregisterBlock(entity);
      }
      // Remove from tracking
      trackedUIBlocks.delete(entity);
    }
  }
});

/**
 * UI Text Sync System
 *
 * Synchronizes UIText components with three-mesh-ui Text instances.
 * Text must be parented to a UIBlock or UICanvas to display.
 */
export const uiTextSyncSystem = system(({ commands }) => {
  const app = Application.get();
  const uiManager = app.getResource(UIManager);

  if (!uiManager) return;

  commands
    .query()
    .all(UIText, Parent)
    .each((entity, text: UITextData, parent) => {
      // Skip invisible text
      if (!text.visible) {
        if (text._text) {
          text._text.visible = false;
        }
        return;
      }

      // Find parent block to attach text to
      const parentEntity = parent.id;
      let parentBlock: ThreeMeshUI.Block | undefined;

      // Check if parent is a UICanvas
      const parentCanvas = commands.tryGetComponent(parentEntity, UICanvas);
      if (parentCanvas && parentCanvas._root) {
        parentBlock = parentCanvas._root;
      }

      // Check if parent is a UIBlock
      const parentBlockComp = commands.tryGetComponent(parentEntity, UIBlock);
      if (parentBlockComp && parentBlockComp._block) {
        parentBlock = parentBlockComp._block;
      }

      if (!parentBlock) {
        // No valid parent - can't display text
        return;
      }

      // Create text if needed
      if (!text._text || text._dirty) {
        if (text._text) {
          // Remove from parent
          const oldParent = text._text.parent;
          if (oldParent) {
            oldParent.remove(text._text);
          }
        }

        // Build text options
        const options = uiTextDataToOptions(text);

        // Add font files - use custom if available, otherwise use defaults
        if (text.fontFamily?.isLoaded && text.fontFamily.data) {
          (options as any).fontFamily = text.fontFamily.data;
        } else {
          (options as any).fontFamily = DEFAULT_FONT_JSON;
        }
        if (text.fontTexture?.isLoaded && text.fontTexture.data) {
          (options as any).fontTexture = text.fontTexture.data;
        } else {
          (options as any).fontTexture = DEFAULT_FONT_TEXTURE;
        }

        text._text = new ThreeMeshUI.Text(options as ThreeMeshUI.TextOptions);
        text._dirty = false;

        // Track for cleanup
        trackedUITexts.set(entity, text._text);
      } else {
        // Update existing text
        const options = uiTextDataToOptions(text);
        (text._text as any).set(options);
      }

      text._text.visible = true;

      // Attach to parent if not already
      if (text._text.parent !== parentBlock) {
        if (text._text.parent) {
          text._text.parent.remove(text._text);
        }
        parentBlock.add(text._text);
      }
    });

  // Cleanup texts for entities that were destroyed
  for (const [entity, textObj] of trackedUITexts) {
    if (!commands.isAlive(entity)) {
      // Remove from parent
      if (textObj.parent) {
        textObj.parent.remove(textObj);
      }
      // Remove from tracking
      trackedUITexts.delete(entity);
    }
  }
});

/**
 * UI Button Sync System
 *
 * Synchronizes UIButton components with three-mesh-ui Block instances.
 * Handles state-based styling and optional label text.
 */
export const uiButtonSyncSystem = system(({ commands }) => {
  const app = Application.get();
  const uiManager = app.getResource(UIManager);

  if (!uiManager) return;

  commands
    .query()
    .all(UIButton)
    .each((entity, button: UIButtonData) => {
      // Skip invisible buttons
      if (!button.visible) {
        if (button._block) {
          button._block.visible = false;
        }
        return;
      }

      // Initialize state if needed
      if (!button._state) {
        button._state = button.isDisabled ? 'disabled' : 'idle';
      }

      // Create block if needed
      if (!button._block || button._dirty) {
        if (button._block) {
          const parent = button._block.parent;
          if (parent) {
            parent.remove(button._block);
          }
        }

        // Create button block
        const options = uiButtonDataToOptions(button);
        button._block = new ThreeMeshUI.Block(options as ThreeMeshUI.BlockOptions);

        // Create label text if label is set
        if (button.label && button.label.length > 0) {
          const textOptions: Record<string, unknown> = {
            content: button.label,
            fontSize: button.labelFontSize,
            fontColor: colorToThree(button.labelColor),
          };

          // Add font files - use custom if available, otherwise use defaults
          if (button.labelFontFamily?.isLoaded && button.labelFontFamily.data) {
            textOptions['fontFamily'] = button.labelFontFamily.data;
          } else {
            textOptions['fontFamily'] = DEFAULT_FONT_JSON;
          }
          if (button.labelFontTexture?.isLoaded && button.labelFontTexture.data) {
            textOptions['fontTexture'] = button.labelFontTexture.data;
          } else {
            textOptions['fontTexture'] = DEFAULT_FONT_TEXTURE;
          }

          button._labelText = new ThreeMeshUI.Text(textOptions as ThreeMeshUI.TextOptions);
          button._block.add(button._labelText);
        }

        button._dirty = false;

        // Track for cleanup
        trackedUIButtons.set(entity, button._block);
      } else {
        // Update existing button
        (button._block as any).set(uiButtonDataToOptions(button));

        // Update label if exists
        if (button._labelText && button.label) {
          (button._labelText as any).set({
            content: button.label,
            fontSize: button.labelFontSize,
            fontColor: colorToThree(button.labelColor),
          });
        }
      }

      button._block.visible = true;
    });

  // Setup parent-child relationships for buttons
  commands
    .query()
    .all(UIButton, Parent)
    .each((entity, button: UIButtonData, parent) => {
      if (!button._block) return;

      const parentEntity = parent.id;

      // Check if parent is a UICanvas
      const parentCanvas = commands.tryGetComponent(parentEntity, UICanvas);
      if (parentCanvas && parentCanvas._root) {
        if (button._block.parent !== parentCanvas._root) {
          if (button._block.parent) {
            button._block.parent.remove(button._block);
          }
          parentCanvas._root.add(button._block);
        }
        return;
      }

      // Check if parent is a UIBlock
      const parentBlockComp = commands.tryGetComponent(parentEntity, UIBlock);
      if (parentBlockComp && parentBlockComp._block) {
        if (button._block.parent !== parentBlockComp._block) {
          if (button._block.parent) {
            button._block.parent.remove(button._block);
          }
          parentBlockComp._block.add(button._block);
        }
        return;
      }

      // Check if parent is another UIButton
      const parentButton = commands.tryGetComponent(parentEntity, UIButton);
      if (parentButton && parentButton._block) {
        if (button._block.parent !== parentButton._block) {
          if (button._block.parent) {
            button._block.parent.remove(button._block);
          }
          parentButton._block.add(button._block);
        }
        return;
      }
    });

  // Add orphan buttons to UI scene
  commands
    .query()
    .all(UIButton)
    .none(Parent)
    .each((entity, button: UIButtonData) => {
      if (!button._block) return;
      if (!button._block.parent) {
        uiManager.getUIScene().add(button._block);
      }
    });

  // Apply anchor/pivot positioning + Transform3D offset to buttons
  const buttonScreenSize = uiManager.getScreenSize();

  commands
    .query()
    .all(UIButton)
    .each((entity, button: UIButtonData) => {
      if (!button._block) return;

      // Get anchor position on screen
      const anchorOffset = getAnchorOffset(button.anchor);
      const anchorX = anchorOffset.x * buttonScreenSize.width;
      const anchorY = anchorOffset.y * buttonScreenSize.height;

      // Get pivot offset on element
      const pivotOffset = getPivotOffset(button.pivot);
      const pivotX = pivotOffset.x * button.width;
      const pivotY = pivotOffset.y * button.height;

      // Get Transform3D offset if present
      const transform = commands.tryGetComponent(entity, Transform3D);
      const offsetX = transform?.position.x ?? 0;
      const offsetY = transform?.position.y ?? 0;

      // Final position = anchor position + pivot adjustment + transform offset
      button._block.position.x = anchorX + pivotX + offsetX;
      button._block.position.y = anchorY + pivotY + offsetY;
    });

  // Register buttons that have UIInteraction with the interaction manager
  const interactionManager = app.getResource(UIInteractionManager);
  if (interactionManager) {
    commands
      .query()
      .all(UIButton, UIInteraction)
      .each((entity, button: UIButtonData, _interaction) => {
        if (button._block) {
          interactionManager.registerBlock(entity, button._block);
        }
      });
  }

  // Cleanup buttons for entities that were destroyed
  for (const [entity, block] of trackedUIButtons) {
    if (!commands.isAlive(entity)) {
      // Remove from parent
      if (block.parent) {
        block.parent.remove(block);
      }
      // Unregister from interaction manager
      if (interactionManager) {
        interactionManager.unregisterBlock(entity);
      }
      // Remove from tracking
      trackedUIButtons.delete(entity);
    }
  }
});

/**
 * Helper to convert color to THREE.Color
 */
function colorToThree(color: { r: number; g: number; b: number }): THREE.Color {
  return new THREE.Color(color.r, color.g, color.b);
}

/**
 * UI Update System
 *
 * Calls ThreeMeshUI.update() to process layout changes.
 * Must run after all sync systems.
 */
export const uiUpdateSystem = system(({ commands }) => {
  const app = Application.get();
  const uiManager = app.getResource(UIManager);

  if (!uiManager) return;

  // Update three-mesh-ui
  uiManager.update();
});

/**
 * UI Render System
 *
 * Renders the UI scene with the orthographic camera.
 * Runs in lateRender phase after the main scene render.
 */
export const uiRenderSystem = system(({ commands }) => {
  const app = Application.get();
  const uiManager = app.getResource(UIManager);

  if (!uiManager) return;

  // Render UI layer
  uiManager.render();
});

/**
 * UI Cleanup System
 *
 * Note: Cleanup for destroyed entities is now handled directly in each sync system
 * (uiCanvasSyncSystem, uiBlockSyncSystem, uiTextSyncSystem, uiButtonSyncSystem).
 * Each system tracks its entities and removes Three.js objects when entities are destroyed.
 *
 * This system is kept for backwards compatibility but is currently a no-op.
 */
export const uiCleanupSystem = system(({ commands }) => {
  // Cleanup is now handled in individual sync systems via tracking maps
  // and commands.isAlive() checks
});
