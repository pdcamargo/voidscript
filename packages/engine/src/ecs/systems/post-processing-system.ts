/**
 * Post-Processing System
 *
 * Syncs PostProcessing component effects to the Renderer's EffectComposer.
 * The Renderer always owns the composer; this system just configures which
 * effect passes are active via the PostProcessingManager.
 *
 * Note: When the editor is using viewport rendering (useViewportRendering = true),
 * this system skips syncing since the editor handles it separately via EditorLayer.
 * Actual rendering happens via renderer.renderPipeline() called by Application/EditorLayer.
 */

import { system } from '@voidscript/core';
import { PostProcessing, type PostProcessingData } from "../components/rendering/post-processing.js";
import { PostProcessingManager } from "../../post-processing/managers/post-processing-manager.js";
import { EditorManager } from "../../editor/editor-manager.js";
import { Render3DManager } from "./renderer-sync-system.js";
import type { Entity } from '@voidscript/core';

// Track the last known post-processing entity for detecting changes
let lastPostProcessingEntity: Entity | null = null;

/**
 * Post-processing sync system
 *
 * Runs in lateRender phase to sync effect configuration.
 *
 * This system:
 * 1. Finds any entity with PostProcessing component (uses first one found)
 * 2. Syncs enabled effects to the Renderer via PostProcessingManager
 * 3. Clears effects when disabled or no component found
 *
 * Note: Actual rendering happens via renderer.renderPipeline() - not in this system.
 */
export const postProcessingSystem = system(({ commands }) => {
  // Skip when editor is using viewport rendering
  // In this mode, the editor handles effect syncing separately
  const editorManager = commands.tryGetResource(EditorManager);
  if (editorManager?.useViewportRendering) {
    return;
  }

  // Get the PostProcessingManager resource
  const manager = commands.tryGetResource(PostProcessingManager);
  if (!manager) {
    return;
  }

  // Find any entity with PostProcessing component
  let postProcessingEntity: Entity | null = null;
  let postProcessingData: PostProcessingData | null = null;

  commands
    .query()
    .all(PostProcessing)
    .each((entity, pp) => {
      if (!postProcessingEntity) {
        postProcessingEntity = entity;
        postProcessingData = pp;
      }
    });

  // No PostProcessing component found - clear effects
  if (!postProcessingEntity || !postProcessingData) {
    manager.clearEffects();
    lastPostProcessingEntity = null;
    return;
  }

  // Store locally for type safety
  const ppData: PostProcessingData = postProcessingData;

  // Check if globally disabled - clear effects
  if (!ppData.globalEnabled) {
    manager.clearEffects();
    return;
  }

  // Check if any effects are enabled
  let hasEnabledEffects = false;
  for (const config of ppData.effects.values()) {
    if (config.enabled) {
      hasEnabledEffects = true;
      break;
    }
  }

  if (!hasEnabledEffects) {
    manager.clearEffects();
    return;
  }

  // Get renderer info for sizing
  const renderManager = commands.tryGetResource(Render3DManager);
  if (!renderManager) {
    return;
  }

  const renderer = renderManager.getRenderer();
  const scene = renderer.getScene();
  const camera = renderer.getCamera();
  const { width, height } = renderer.getSize();

  // Sync effects to the renderer
  manager.syncEffects(
    ppData.effects,
    scene,
    camera,
    width,
    height,
    commands
  );

  // Clear dirty flag if set
  if (ppData._dirty) {
    ppData._dirty = false;
  }

  lastPostProcessingEntity = postProcessingEntity;
});

/**
 * Post-processing cleanup system
 *
 * Clears entity cache when the world is loaded/reset.
 * Runs in lateStartup phase.
 */
export const postProcessingCleanupSystem = system(({ commands }) => {
  const manager = commands.tryGetResource(PostProcessingManager);
  if (manager) {
    manager.clearEntityCache();
  }
});
