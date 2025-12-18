/**
 * PostProcessing Component
 *
 * Configures post-processing effects for the scene. Add this component to any entity
 * to enable post-processing effects.
 *
 * Features a Unity-style editor where all effects are shown in a flat list with
 * checkboxes to enable/disable. When enabled, effect-specific settings appear inline.
 *
 * @example
 * ```typescript
 * // Add post-processing to a dedicated entity
 * commands.spawn()
 *   .with(Name, { name: 'Post Processing' })
 *   .with(PostProcessing, {
 *     globalEnabled: true,
 *     effects: new Map([
 *       ['bloom', { type: 'bloom', enabled: true, order: 0, strength: 1.5, radius: 0.4, threshold: 0.8 }],
 *       ['vignette', { type: 'vignette', enabled: true, order: 1, offset: 1, darkness: 1.2 }],
 *     ]),
 *   })
 *   .build();
 * ```
 */

import { component } from "../../component.js";
import type { Command } from "../../command.js";
import type { Entity } from "../../entity.js";
import { ImGui } from "@mori2003/jsimgui";
import { entityPicker } from "../../../app/imgui/entity-picker.js";
import { Name } from "../name.js";

import type {
  EffectConfig,
  EffectType,
  BloomConfig,
  VignetteConfig,
  SSAOConfig,
  SAOConfig,
  GTAOConfig,
  OutlineConfig,
  BokehConfig,
  FilmConfig,
  SepiaConfig,
  BrightnessContrastConfig,
  HueSaturationConfig,
  ColorCorrectionConfig,
  DotScreenConfig,
  GlitchConfig,
  PixelateConfig,
  HalftoneConfig,
  AfterimageConfig,
  RGBShiftConfig,
  SSAAConfig,
  TAAConfig,
  EffectCategory,
} from "../../../post-processing/types.js";

import {
  EFFECT_REGISTRY,
  getEffectsByCategory,
  getEffectCategories,
  formatCategoryName,
  getEffectMetadata,
} from "../../../post-processing/effect-registry.js";

// ============================================================================
// Component Data
// ============================================================================

export interface PostProcessingData {
  /**
   * Map of effect type to its configuration.
   * Only effects present in this map are considered (enabled or disabled).
   */
  effects: Map<EffectType, EffectConfig>;

  /**
   * Master toggle for all post-processing.
   * When false, no effects are rendered regardless of individual settings.
   * @default true
   */
  globalEnabled: boolean;

  /**
   * Runtime flag indicating effects need to be rebuilt.
   * Set to true when effects are added/removed/reordered.
   * Not serialized.
   */
  _dirty: boolean;
}

// ============================================================================
// Effect Settings Renderers
// ============================================================================

function renderBloomSettings(
  config: BloomConfig,
  markDirty: () => void
): void {
  const strength: [number] = [config.strength];
  if (ImGui.DragFloat("Strength##bloom", strength, 0.01, 0, 3)) {
    config.strength = strength[0];
    markDirty();
  }

  const radius: [number] = [config.radius];
  if (ImGui.DragFloat("Radius##bloom", radius, 0.01, 0, 1)) {
    config.radius = radius[0];
    markDirty();
  }

  const threshold: [number] = [config.threshold];
  if (ImGui.DragFloat("Threshold##bloom", threshold, 0.01, 0, 1)) {
    config.threshold = threshold[0];
    markDirty();
  }
}

function renderVignetteSettings(
  config: VignetteConfig,
  markDirty: () => void
): void {
  const offset: [number] = [config.offset];
  if (ImGui.DragFloat("Offset##vignette", offset, 0.01, 0, 2)) {
    config.offset = offset[0];
    markDirty();
  }

  const darkness: [number] = [config.darkness];
  if (ImGui.DragFloat("Darkness##vignette", darkness, 0.01, 0, 2)) {
    config.darkness = darkness[0];
    markDirty();
  }
}

function renderSSAOSettings(
  config: SSAOConfig,
  markDirty: () => void
): void {
  const kernelRadius: [number] = [config.kernelRadius];
  if (ImGui.DragFloat("Kernel Radius##ssao", kernelRadius, 0.5, 1, 32)) {
    config.kernelRadius = kernelRadius[0];
    markDirty();
  }

  const minDist: [number] = [config.minDistance];
  if (ImGui.DragFloat("Min Distance##ssao", minDist, 0.001, 0, 1)) {
    config.minDistance = minDist[0];
    markDirty();
  }

  const maxDist: [number] = [config.maxDistance];
  if (ImGui.DragFloat("Max Distance##ssao", maxDist, 0.01, 0, 1)) {
    config.maxDistance = maxDist[0];
    markDirty();
  }

  const outputs: SSAOConfig["output"][] = [
    "default",
    "ssao",
    "blur",
    "beauty",
    "depth",
    "normal",
  ];
  if (ImGui.BeginCombo("Output##ssao", config.output)) {
    for (const output of outputs) {
      if (ImGui.Selectable(output, config.output === output)) {
        config.output = output;
        markDirty();
      }
    }
    ImGui.EndCombo();
  }
}

function renderSAOSettings(
  config: SAOConfig,
  markDirty: () => void
): void {
  const bias: [number] = [config.saoBias];
  if (ImGui.DragFloat("Bias##sao", bias, 0.01, 0, 1)) {
    config.saoBias = bias[0];
    markDirty();
  }

  const intensity: [number] = [config.saoIntensity];
  if (ImGui.DragFloat("Intensity##sao", intensity, 0.01, 0, 1)) {
    config.saoIntensity = intensity[0];
    markDirty();
  }

  const scale: [number] = [config.saoScale];
  if (ImGui.DragFloat("Scale##sao", scale, 0.1, 0, 10)) {
    config.saoScale = scale[0];
    markDirty();
  }

  const kernelRadius: [number] = [config.saoKernelRadius];
  if (ImGui.DragFloat("Kernel Radius##sao", kernelRadius, 1, 1, 200)) {
    config.saoKernelRadius = kernelRadius[0];
    markDirty();
  }

  const blur: [boolean] = [config.saoBlur];
  if (ImGui.Checkbox("Blur##sao", blur)) {
    config.saoBlur = blur[0];
    markDirty();
  }

  if (config.saoBlur) {
    const blurRadius: [number] = [config.saoBlurRadius];
    if (ImGui.DragFloat("Blur Radius##sao", blurRadius, 0.5, 1, 25)) {
      config.saoBlurRadius = blurRadius[0];
      markDirty();
    }
  }
}

function renderGTAOSettings(
  config: GTAOConfig,
  markDirty: () => void
): void {
  const intensity: [number] = [config.blendIntensity];
  if (ImGui.DragFloat("Blend Intensity##gtao", intensity, 0.01, 0, 1)) {
    config.blendIntensity = intensity[0];
    markDirty();
  }

  const outputs: GTAOConfig["output"][] = [
    "default",
    "ao",
    "denoise",
    "depth",
    "normal",
  ];
  if (ImGui.BeginCombo("Output##gtao", config.output)) {
    for (const output of outputs) {
      if (ImGui.Selectable(output, config.output === output)) {
        config.output = output;
        markDirty();
      }
    }
    ImGui.EndCombo();
  }
}

function renderOutlineSettings(
  config: OutlineConfig,
  commands: Command,
  markDirty: () => void
): void {
  // Visible edge color
  const visColor: [number, number, number] = [
    config.visibleEdgeColor.r,
    config.visibleEdgeColor.g,
    config.visibleEdgeColor.b,
  ];
  if (ImGui.ColorEdit3("Visible Edge##outline", visColor)) {
    config.visibleEdgeColor = { r: visColor[0], g: visColor[1], b: visColor[2] };
    markDirty();
  }

  // Hidden edge color
  const hidColor: [number, number, number] = [
    config.hiddenEdgeColor.r,
    config.hiddenEdgeColor.g,
    config.hiddenEdgeColor.b,
  ];
  if (ImGui.ColorEdit3("Hidden Edge##outline", hidColor)) {
    config.hiddenEdgeColor = { r: hidColor[0], g: hidColor[1], b: hidColor[2] };
    markDirty();
  }

  // Thickness
  const thickness: [number] = [config.edgeThickness];
  if (ImGui.DragFloat("Thickness##outline", thickness, 0.1, 1, 4)) {
    config.edgeThickness = thickness[0];
    markDirty();
  }

  // Strength
  const strength: [number] = [config.edgeStrength];
  if (ImGui.DragFloat("Strength##outline", strength, 0.1, 0, 10)) {
    config.edgeStrength = strength[0];
    markDirty();
  }

  // Glow
  const glow: [number] = [config.edgeGlow];
  if (ImGui.DragFloat("Glow##outline", glow, 0.01, 0, 1)) {
    config.edgeGlow = glow[0];
    markDirty();
  }

  // Pulse period
  const pulse: [number] = [config.pulsePeriod];
  if (ImGui.DragFloat("Pulse Period##outline", pulse, 0.1, 0, 10)) {
    config.pulsePeriod = pulse[0];
    markDirty();
  }

  // Selected objects section
  ImGui.Separator();
  ImGui.Text("Selected Objects:");

  // Show current entities with remove buttons
  const toRemove: number[] = [];
  for (let i = 0; i < config.selectedObjects.length; i++) {
    const entity = config.selectedObjects[i];
    if (entity === undefined) continue;

    ImGui.PushID(`outline_entity_${i}`);

    if (ImGui.Button("X##remove")) {
      toRemove.push(i);
    }
    ImGui.SameLine();

    // Show entity name
    const nameComp = commands.tryGetComponent(entity, Name);
    ImGui.Text(nameComp?.name ?? `Entity #${entity}`);

    ImGui.PopID();
  }

  // Remove marked entities (reverse order to maintain indices)
  for (let i = toRemove.length - 1; i >= 0; i--) {
    const idx = toRemove[i];
    if (idx !== undefined) {
      config.selectedObjects.splice(idx, 1);
      markDirty();
    }
  }

  // Add new entity picker
  ImGui.Spacing();
  ImGui.Text("Add Object:");
  const result = entityPicker({
    label: "addOutlineObject",
    currentEntity: null,
    commands,
    allowNone: false,
    filter: (e) => !config.selectedObjects.includes(e),
  });
  if (result.changed && result.entity !== null) {
    config.selectedObjects.push(result.entity);
    markDirty();
  }
}

function renderBokehSettings(
  config: BokehConfig,
  markDirty: () => void
): void {
  const focus: [number] = [config.focus];
  if (ImGui.DragFloat("Focus##bokeh", focus, 0.1, 0, 100)) {
    config.focus = focus[0];
    markDirty();
  }

  const aperture: [number] = [config.aperture];
  if (ImGui.DragFloat("Aperture##bokeh", aperture, 0.001, 0, 1)) {
    config.aperture = aperture[0];
    markDirty();
  }

  const maxblur: [number] = [config.maxblur];
  if (ImGui.DragFloat("Max Blur##bokeh", maxblur, 0.001, 0, 0.1)) {
    config.maxblur = maxblur[0];
    markDirty();
  }
}

function renderFilmSettings(
  config: FilmConfig,
  markDirty: () => void
): void {
  const intensity: [number] = [config.intensity];
  if (ImGui.DragFloat("Intensity##film", intensity, 0.01, 0, 1)) {
    config.intensity = intensity[0];
    markDirty();
  }
}

function renderSepiaSettings(
  config: SepiaConfig,
  markDirty: () => void
): void {
  const amount: [number] = [config.amount];
  if (ImGui.DragFloat("Amount##sepia", amount, 0.01, 0, 1)) {
    config.amount = amount[0];
    markDirty();
  }
}

function renderBrightnessContrastSettings(
  config: BrightnessContrastConfig,
  markDirty: () => void
): void {
  const brightness: [number] = [config.brightness];
  if (ImGui.DragFloat("Brightness##bc", brightness, 0.01, -1, 1)) {
    config.brightness = brightness[0];
    markDirty();
  }

  const contrast: [number] = [config.contrast];
  if (ImGui.DragFloat("Contrast##bc", contrast, 0.01, -1, 1)) {
    config.contrast = contrast[0];
    markDirty();
  }
}

function renderHueSaturationSettings(
  config: HueSaturationConfig,
  markDirty: () => void
): void {
  const hue: [number] = [config.hue];
  if (ImGui.DragFloat("Hue##hs", hue, 0.01, -1, 1)) {
    config.hue = hue[0];
    markDirty();
  }

  const saturation: [number] = [config.saturation];
  if (ImGui.DragFloat("Saturation##hs", saturation, 0.01, -1, 1)) {
    config.saturation = saturation[0];
    markDirty();
  }
}

function renderColorCorrectionSettings(
  config: ColorCorrectionConfig,
  markDirty: () => void
): void {
  ImGui.Text("Power RGB:");
  const powRGB: [number, number, number] = [
    config.powRGB.r,
    config.powRGB.g,
    config.powRGB.b,
  ];
  if (ImGui.DragFloat3("##powRGB", powRGB, 0.01, 0, 5)) {
    config.powRGB = { r: powRGB[0], g: powRGB[1], b: powRGB[2] };
    markDirty();
  }

  ImGui.Text("Multiply RGB:");
  const mulRGB: [number, number, number] = [
    config.mulRGB.r,
    config.mulRGB.g,
    config.mulRGB.b,
  ];
  if (ImGui.DragFloat3("##mulRGB", mulRGB, 0.01, 0, 5)) {
    config.mulRGB = { r: mulRGB[0], g: mulRGB[1], b: mulRGB[2] };
    markDirty();
  }

  ImGui.Text("Add RGB:");
  const addRGB: [number, number, number] = [
    config.addRGB.r,
    config.addRGB.g,
    config.addRGB.b,
  ];
  if (ImGui.DragFloat3("##addRGB", addRGB, 0.01, -1, 1)) {
    config.addRGB = { r: addRGB[0], g: addRGB[1], b: addRGB[2] };
    markDirty();
  }
}

function renderRGBShiftSettings(
  config: RGBShiftConfig,
  markDirty: () => void
): void {
  const amount: [number] = [config.amount];
  if (ImGui.DragFloat("Amount##rgbshift", amount, 0.001, 0, 0.1)) {
    config.amount = amount[0];
    markDirty();
  }

  const angle: [number] = [config.angle];
  if (ImGui.DragFloat("Angle##rgbshift", angle, 0.1, 0, Math.PI * 2)) {
    config.angle = angle[0];
    markDirty();
  }
}

function renderDotScreenSettings(
  config: DotScreenConfig,
  markDirty: () => void
): void {
  const scale: [number] = [config.scale];
  if (ImGui.DragFloat("Scale##dotscreen", scale, 0.1, 1, 10)) {
    config.scale = scale[0];
    markDirty();
  }

  const angle: [number] = [config.angle];
  if (ImGui.DragFloat("Angle##dotscreen", angle, 0.01, 0, Math.PI)) {
    config.angle = angle[0];
    markDirty();
  }
}

function renderGlitchSettings(
  config: GlitchConfig,
  markDirty: () => void
): void {
  const goWild: [boolean] = [config.goWild];
  if (ImGui.Checkbox("Go Wild##glitch", goWild)) {
    config.goWild = goWild[0];
    markDirty();
  }
}

function renderPixelateSettings(
  config: PixelateConfig,
  markDirty: () => void
): void {
  const pixelSize: [number] = [config.pixelSize];
  if (ImGui.DragInt("Pixel Size##pixelate", pixelSize, 1, 1, 32)) {
    config.pixelSize = pixelSize[0];
    markDirty();
  }

  const normalEdge: [number] = [config.normalEdgeStrength];
  if (ImGui.DragFloat("Normal Edge##pixelate", normalEdge, 0.01, 0, 1)) {
    config.normalEdgeStrength = normalEdge[0];
    markDirty();
  }

  const depthEdge: [number] = [config.depthEdgeStrength];
  if (ImGui.DragFloat("Depth Edge##pixelate", depthEdge, 0.01, 0, 1)) {
    config.depthEdgeStrength = depthEdge[0];
    markDirty();
  }
}

function renderHalftoneSettings(
  config: HalftoneConfig,
  markDirty: () => void
): void {
  const shapes = ["Dot", "Ellipse", "Line", "Square"];
  const currentShapeLabel = shapes[config.shape - 1] ?? "Dot";
  if (ImGui.BeginCombo("Shape##halftone", currentShapeLabel)) {
    for (let i = 1; i <= 4; i++) {
      const shapeLabel = shapes[i - 1] ?? "Unknown";
      if (ImGui.Selectable(shapeLabel, config.shape === i)) {
        config.shape = i as 1 | 2 | 3 | 4;
        markDirty();
      }
    }
    ImGui.EndCombo();
  }

  const radius: [number] = [config.radius];
  if (ImGui.DragFloat("Radius##halftone", radius, 0.1, 1, 10)) {
    config.radius = radius[0];
    markDirty();
  }

  const scatter: [number] = [config.scatter];
  if (ImGui.DragFloat("Scatter##halftone", scatter, 0.01, 0, 1)) {
    config.scatter = scatter[0];
    markDirty();
  }

  const blending: [number] = [config.blending];
  if (ImGui.DragFloat("Blending##halftone", blending, 0.01, 0, 1)) {
    config.blending = blending[0];
    markDirty();
  }

  const greyscale: [boolean] = [config.greyscale];
  if (ImGui.Checkbox("Greyscale##halftone", greyscale)) {
    config.greyscale = greyscale[0];
    markDirty();
  }
}

function renderAfterimageSettings(
  config: AfterimageConfig,
  markDirty: () => void
): void {
  const damp: [number] = [config.damp];
  if (ImGui.DragFloat("Damp##afterimage", damp, 0.01, 0, 1)) {
    config.damp = damp[0];
    markDirty();
  }
}

function renderSSAASettings(
  config: SSAAConfig,
  markDirty: () => void
): void {
  const levels = [2, 4, 8, 16];
  if (ImGui.BeginCombo("Sample Level##ssaa", `${config.sampleLevel}x`)) {
    for (const level of levels) {
      if (ImGui.Selectable(`${level}x`, config.sampleLevel === level)) {
        config.sampleLevel = level;
        markDirty();
      }
    }
    ImGui.EndCombo();
  }

  const unbiased: [boolean] = [config.unbiased];
  if (ImGui.Checkbox("Unbiased##ssaa", unbiased)) {
    config.unbiased = unbiased[0];
    markDirty();
  }
}

function renderTAASettings(
  config: TAAConfig,
  markDirty: () => void
): void {
  const sampleLevel: [number] = [config.sampleLevel];
  if (ImGui.DragInt("Sample Level##taa", sampleLevel, 1, 0, 5)) {
    config.sampleLevel = sampleLevel[0];
    markDirty();
  }

  const accumulate: [boolean] = [config.accumulate];
  if (ImGui.Checkbox("Accumulate##taa", accumulate)) {
    config.accumulate = accumulate[0];
    markDirty();
  }
}

/**
 * Render effect-specific settings based on type
 */
function renderEffectSettings(
  type: EffectType,
  config: EffectConfig,
  commands: Command,
  markDirty: () => void
): void {
  switch (type) {
    case "bloom":
      renderBloomSettings(config as BloomConfig, markDirty);
      break;
    case "vignette":
      renderVignetteSettings(config as VignetteConfig, markDirty);
      break;
    case "ssao":
      renderSSAOSettings(config as SSAOConfig, markDirty);
      break;
    case "sao":
      renderSAOSettings(config as SAOConfig, markDirty);
      break;
    case "gtao":
      renderGTAOSettings(config as GTAOConfig, markDirty);
      break;
    case "outline":
      renderOutlineSettings(config as OutlineConfig, commands, markDirty);
      break;
    case "bokeh":
      renderBokehSettings(config as BokehConfig, markDirty);
      break;
    case "film":
      renderFilmSettings(config as FilmConfig, markDirty);
      break;
    case "sepia":
      renderSepiaSettings(config as SepiaConfig, markDirty);
      break;
    case "brightnessContrast":
      renderBrightnessContrastSettings(config as BrightnessContrastConfig, markDirty);
      break;
    case "hueSaturation":
      renderHueSaturationSettings(config as HueSaturationConfig, markDirty);
      break;
    case "colorCorrection":
      renderColorCorrectionSettings(config as ColorCorrectionConfig, markDirty);
      break;
    case "rgbShift":
      renderRGBShiftSettings(config as RGBShiftConfig, markDirty);
      break;
    case "dotScreen":
      renderDotScreenSettings(config as DotScreenConfig, markDirty);
      break;
    case "glitch":
      renderGlitchSettings(config as GlitchConfig, markDirty);
      break;
    case "pixelate":
      renderPixelateSettings(config as PixelateConfig, markDirty);
      break;
    case "halftone":
      renderHalftoneSettings(config as HalftoneConfig, markDirty);
      break;
    case "afterimage":
      renderAfterimageSettings(config as AfterimageConfig, markDirty);
      break;
    case "ssaa":
      renderSSAASettings(config as SSAAConfig, markDirty);
      break;
    case "taa":
      renderTAASettings(config as TAAConfig, markDirty);
      break;
    case "fxaa":
    case "smaa":
      // No additional settings for these AA methods
      ImGui.TextDisabled("No configurable settings");
      break;
  }
}

// ============================================================================
// Custom Editor
// ============================================================================

function renderPostProcessingEditor({
  componentData,
  commands,
}: {
  componentData: PostProcessingData;
  commands: Command;
}): void {
  const markDirty = () => {
    componentData._dirty = true;
  };

  // Global enable checkbox
  const globalEnabled: [boolean] = [componentData.globalEnabled];
  if (ImGui.Checkbox("##globalEnabled", globalEnabled)) {
    componentData.globalEnabled = globalEnabled[0];
    markDirty();
  }
  ImGui.SameLine();
  ImGui.Text("Post Processing");

  if (!componentData.globalEnabled) {
    ImGui.TextDisabled("(Disabled)");
  }

  ImGui.Separator();

  // Render effects by category
  const categories = getEffectCategories();

  for (const category of categories) {
    const categoryEffects = getEffectsByCategory(category);
    if (categoryEffects.length === 0) continue;

    // Category header
    ImGui.TextColored({ x: 0.6, y: 0.8, z: 1, w: 1 }, formatCategoryName(category));
    ImGui.Indent();

    for (const effectMeta of categoryEffects) {
      const existingConfig = componentData.effects.get(effectMeta.type);
      const isEnabled = existingConfig?.enabled ?? false;

      // Checkbox for enable/disable
      const enabled: [boolean] = [isEnabled];
      if (ImGui.Checkbox(`##${effectMeta.type}_enabled`, enabled)) {
        if (enabled[0] && !existingConfig) {
          // Enabling - create default config
          const newConfig = effectMeta.defaultConfig();
          // Assign order based on current count
          newConfig.order = componentData.effects.size;
          componentData.effects.set(effectMeta.type, newConfig);
          markDirty();
        } else if (existingConfig) {
          existingConfig.enabled = enabled[0];
          markDirty();
        }
      }

      ImGui.SameLine();

      // Effect name (collapsible if enabled)
      if (isEnabled && existingConfig) {
        if (ImGui.TreeNode(`${effectMeta.displayName}##${effectMeta.type}`)) {
          ImGui.Indent();
          renderEffectSettings(effectMeta.type, existingConfig, commands, markDirty);
          ImGui.Unindent();
          ImGui.TreePop();
        }
      } else {
        ImGui.TextDisabled(effectMeta.displayName);
      }
    }

    ImGui.Unindent();
    ImGui.Spacing();
  }
}

// ============================================================================
// Component Definition
// ============================================================================

export const PostProcessing = component<PostProcessingData>(
  "PostProcessing",
  {
    effects: {
      serializable: true,
      customSerializer: {
        serialize: (effects) => {
          // Serialize Map as array of [type, config] entries
          const entries: Array<[EffectType, EffectConfig]> = [];
          for (const [type, config] of effects) {
            entries.push([type, config]);
          }
          return entries;
        },
        deserialize: (data) => {
          const map = new Map<EffectType, EffectConfig>();
          const entries = data as Array<[EffectType, EffectConfig]>;
          for (const [type, config] of entries) {
            map.set(type, config);
          }
          return map;
        },
      },
    },
    globalEnabled: { serializable: true },
    // Runtime state - not serialized
    _dirty: { serializable: false },
  },
  {
    defaultValue: () => ({
      effects: new Map(),
      globalEnabled: true,
      _dirty: true,
    }),
    displayName: "Post Processing",
    description:
      "Post-processing effects stack (bloom, vignette, SSAO, etc.). Add to any entity.",
    path: "rendering/effects",
    customEditor: renderPostProcessingEditor,
  }
);
