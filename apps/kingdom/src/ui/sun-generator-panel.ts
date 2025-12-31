/**
 * Sun Texture Generator Panel
 *
 * ImGui panel for generating pixel art sun textures with comprehensive real-time controls.
 */

import { ImGui, ImVec4, ImVec2, ImTextureRef, ImGuiImplWeb } from '@voidscript/imgui';
import * as THREE from 'three';
import type { Application } from '@voidscript/engine';
import {
  generateSunTexture,
  type SunTextureOptions,
} from '../generators/sun-texture-generator.js';

/**
 * State for the sun generator panel
 */
interface SunGeneratorState {
  seed: number;
  resolutionIndex: number; // 0=64, 1=128, 2=256

  // Core controls
  coreRadius: number;
  coreBrightness: number;
  corePulse: number;

  // Surface controls
  surfaceScale: number;
  surfaceStrength: number;
  detailScale: number;
  detailStrength: number;

  // Flare controls
  flareCount: number;
  flareMinLength: number;
  flareMaxLength: number;
  flareWidth: number;
  flareIntensity: number;

  // Glow controls
  glowIntensity: number;
  glowSize: number;
  glowFalloff: number;

  // Pixelation
  edgePixelation: number;
  flarePixelation: number;

  // Colors
  coreColor: ImVec4;
  midColor: ImVec4;
  edgeColor: ImVec4;
  glowColor: ImVec4;

  currentTexture: THREE.DataTexture | null;
  needsRegeneration: boolean;
}

/**
 * Preview rendering state
 */
interface PreviewState {
  renderTarget: THREE.WebGLRenderTarget | null;
  scene: THREE.Scene | null;
  camera: THREE.OrthographicCamera | null;
  sprite: THREE.Sprite | null;
  textureId: bigint | null;
}

// Window visibility state
let isWindowOpen = false;

// Module-level state
const state: SunGeneratorState = {
  seed: 0,
  resolutionIndex: 1, // 128 default

  // Core defaults
  coreRadius: 0.35,
  coreBrightness: 1.0,
  corePulse: 0.1,

  // Surface defaults
  surfaceScale: 0.08,
  surfaceStrength: 0.08,
  detailScale: 0.2,
  detailStrength: 0.05,

  // Flare defaults
  flareCount: 8,
  flareMinLength: 0.15,
  flareMaxLength: 0.4,
  flareWidth: 0.12,
  flareIntensity: 0.5,

  // Glow defaults
  glowIntensity: 0.7,
  glowSize: 1.5,
  glowFalloff: 2.0,

  // Pixelation defaults
  edgePixelation: 0.2,
  flarePixelation: 0.3,

  // Colors
  coreColor: new ImVec4(1.0, 0.98, 0.85, 1.0),
  midColor: new ImVec4(1.0, 0.75, 0.3, 1.0),
  edgeColor: new ImVec4(1.0, 0.45, 0.15, 1.0),
  glowColor: new ImVec4(1.0, 0.45, 0.15, 1.0),

  currentTexture: null,
  needsRegeneration: true,
};

const previewState: PreviewState = {
  renderTarget: null,
  scene: null,
  camera: null,
  sprite: null,
  textureId: null,
};

// Resolution options (pixel art detail level)
const RESOLUTION_OPTIONS = [64, 128, 256];
const RESOLUTION_LABELS = ['64px (Chunky)', '128px (Medium)', '256px (Fine)'];

// Canvas is always 512x512
const CANVAS_SIZE = 512;

/**
 * Initialize preview rendering system
 */
function initializePreview(app: Application): void {
  if (previewState.renderTarget) {
    return; // Already initialized
  }

  const renderer = app.getRenderer();

  // Create render target for preview
  previewState.renderTarget = renderer.createRenderTarget(512, 512, {
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
  });

  // Create preview scene
  previewState.scene = new THREE.Scene();
  previewState.scene.background = new THREE.Color(0x0a0a1a);

  // Create orthographic camera
  previewState.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
  previewState.camera.position.z = 1;

  // Create sprite for displaying the sun texture
  const material = new THREE.SpriteMaterial({
    map: null,
    transparent: true,
  });
  previewState.sprite = new THREE.Sprite(material);
  previewState.scene.add(previewState.sprite);
}

/**
 * Build SunTextureOptions from current state
 */
function buildOptionsFromState(): SunTextureOptions {
  const pixelSize = RESOLUTION_OPTIONS[state.resolutionIndex] ?? 128;

  return {
    seed: state.seed,
    width: pixelSize,
    height: pixelSize,

    // Core options
    coreRadius: state.coreRadius,
    coreBrightness: state.coreBrightness,
    corePulse: state.corePulse,

    // Surface options
    surfaceScale: state.surfaceScale,
    surfaceStrength: state.surfaceStrength,
    detailScale: state.detailScale,
    detailStrength: state.detailStrength,

    // Flare options
    flareCount: state.flareCount,
    flareMinLength: state.flareMinLength,
    flareMaxLength: state.flareMaxLength,
    flareWidth: state.flareWidth,
    flareIntensity: state.flareIntensity,

    // Glow options
    glowIntensity: state.glowIntensity,
    glowSize: state.glowSize,
    glowFalloff: state.glowFalloff,

    // Pixelation
    edgePixelation: state.edgePixelation,
    flarePixelation: state.flarePixelation,

    // Colors
    coreColor: {
      r: state.coreColor.x,
      g: state.coreColor.y,
      b: state.coreColor.z,
      a: state.coreColor.w,
    },
    midColor: {
      r: state.midColor.x,
      g: state.midColor.y,
      b: state.midColor.z,
      a: state.midColor.w,
    },
    edgeColor: {
      r: state.edgeColor.x,
      g: state.edgeColor.y,
      b: state.edgeColor.z,
      a: state.edgeColor.w,
    },
    glowColor: {
      r: state.glowColor.x,
      g: state.glowColor.y,
      b: state.glowColor.z,
      a: state.glowColor.w,
    },
  };
}

/**
 * Regenerate sun texture if needed
 */
function regenerateIfNeeded(): void {
  if (!state.needsRegeneration) {
    return;
  }

  // Dispose old texture
  state.currentTexture?.dispose();

  // Generate new texture
  const options = buildOptionsFromState();
  state.currentTexture = generateSunTexture(options);

  // Update sprite material
  if (previewState.sprite) {
    (previewState.sprite.material as THREE.SpriteMaterial).map =
      state.currentTexture;
    (previewState.sprite.material as THREE.SpriteMaterial).needsUpdate = true;
  }

  state.needsRegeneration = false;
}

/**
 * Upscale texture data from source resolution to 512×512 using nearest neighbor
 */
function upscaleTextureData(sourceData: Uint8Array, sourceSize: number): Uint8Array {
  const targetSize = CANVAS_SIZE;
  const scale = targetSize / sourceSize;
  const targetData = new Uint8Array(targetSize * targetSize * 4);

  for (let y = 0; y < targetSize; y++) {
    for (let x = 0; x < targetSize; x++) {
      const srcX = Math.floor(x / scale);
      const srcY = Math.floor(y / scale);
      const srcIndex = (srcY * sourceSize + srcX) * 4;
      const targetIndex = (y * targetSize + x) * 4;

      targetData[targetIndex] = sourceData[srcIndex]!;
      targetData[targetIndex + 1] = sourceData[srcIndex + 1]!;
      targetData[targetIndex + 2] = sourceData[srcIndex + 2]!;
      targetData[targetIndex + 3] = sourceData[srcIndex + 3]!;
    }
  }

  return targetData;
}

/**
 * Download the current sun texture as PNG (always 512×512)
 */
async function downloadSunTexture(): Promise<void> {
  if (!state.currentTexture) {
    console.error('No texture to download');
    return;
  }

  try {
    const sourceData = state.currentTexture.image.data as Uint8Array;
    const sourceSize = state.currentTexture.image.width;

    const finalData = sourceSize === CANVAS_SIZE
      ? sourceData
      : upscaleTextureData(sourceData, sourceSize);

    const canvas = document.createElement('canvas');
    canvas.width = CANVAS_SIZE;
    canvas.height = CANVAS_SIZE;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      console.error('Failed to get canvas context');
      return;
    }

    const imageData = ctx.createImageData(CANVAS_SIZE, CANVAS_SIZE);
    imageData.data.set(finalData);
    ctx.putImageData(imageData, 0, 0);

    const dataUrl = canvas.toDataURL('image/png');

    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `sun_${state.seed}_512x512.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    console.log(`Sun texture downloaded: sun_${state.seed}_512x512.png`);
  } catch (error) {
    console.error('Failed to download sun texture:', error);
  }
}

/**
 * Open the Sun Texture Generator window
 */
export function openSunGeneratorWindow(): void {
  isWindowOpen = true;
}

/**
 * Close the Sun Texture Generator window
 */
export function closeSunGeneratorWindow(): void {
  isWindowOpen = false;
}

/**
 * Check if the Sun Texture Generator window is open
 */
export function isSunGeneratorWindowOpen(): boolean {
  return isWindowOpen;
}

/**
 * Render the Sun Texture Generator panel as a standalone window
 */
export function renderSunGeneratorPanel(app: Application): void {
  if (!isWindowOpen) return;

  initializePreview(app);

  ImGui.SetNextWindowSize(new ImVec2(1000, 800), ImGui.Cond.FirstUseEver);

  const isOpenArr: [boolean] = [isWindowOpen];
  if (!ImGui.Begin('Sun Texture Generator', isOpenArr)) {
    isWindowOpen = isOpenArr[0];
    ImGui.End();
    return;
  }
  isWindowOpen = isOpenArr[0];

  const windowWidth = ImGui.GetWindowWidth();
  const windowHeight = ImGui.GetWindowHeight();
  const controlsWidth = 400;
  const previewWidth = windowWidth - controlsWidth - 30; // 30 for spacing

  // Left column - Controls
  ImGui.BeginChild('Controls', new ImVec2(controlsWidth, windowHeight - 50), ImGui.ChildFlags.Borders);

  // === Basic Settings ===
  ImGui.Text('Basic Settings');
  ImGui.Separator();

  // Seed control
  const seedArr: [number] = [state.seed];
  if (ImGui.InputInt('Seed', seedArr)) {
    state.seed = seedArr[0];
    state.needsRegeneration = true;
  }

  ImGui.SameLine();
  if (ImGui.Button('Randomize')) {
    state.seed = Math.floor(Math.random() * 1000000);
    state.needsRegeneration = true;
  }
  if (ImGui.IsItemHovered()) {
    ImGui.SetTooltip('Generate a random seed');
  }

  // Resolution control
  const resolutionIndexArr: [number] = [state.resolutionIndex];
  if (ImGui.Combo('Resolution', resolutionIndexArr, RESOLUTION_LABELS.join('\0') + '\0')) {
    state.resolutionIndex = resolutionIndexArr[0];
    state.needsRegeneration = true;
  }
  if (ImGui.IsItemHovered()) {
    ImGui.SetTooltip('Pixel art detail level - higher = more detail (output always 512×512)');
  }

  ImGui.Spacing();

  // === Core Controls ===
  if (ImGui.CollapsingHeader('Core Controls', ImGui.TreeNodeFlags.DefaultOpen)) {
    const coreRadiusArr: [number] = [state.coreRadius];
    if (ImGui.SliderFloat('Radius##Core', coreRadiusArr, 0.2, 0.5, '%.3f')) {
      state.coreRadius = coreRadiusArr[0];
      state.needsRegeneration = true;
    }
    if (ImGui.IsItemHovered()) {
      ImGui.SetTooltip('Sun core size (fraction of texture)');
    }

    const coreBrightnessArr: [number] = [state.coreBrightness];
    if (ImGui.SliderFloat('Brightness##Core', coreBrightnessArr, 0.5, 2.0)) {
      state.coreBrightness = coreBrightnessArr[0];
      state.needsRegeneration = true;
    }
    if (ImGui.IsItemHovered()) {
      ImGui.SetTooltip('Core brightness intensity');
    }

    const corePulseArr: [number] = [state.corePulse];
    if (ImGui.SliderFloat('Pulse Amount##Core', corePulseArr, 0.0, 0.3)) {
      state.corePulse = corePulseArr[0];
      state.needsRegeneration = true;
    }
    if (ImGui.IsItemHovered()) {
      ImGui.SetTooltip('Radial pulsing effect strength');
    }
  }

  // === Surface Detail Controls ===
  if (ImGui.CollapsingHeader('Surface Detail', ImGui.TreeNodeFlags.DefaultOpen)) {
    const surfaceScaleArr: [number] = [state.surfaceScale];
    if (ImGui.SliderFloat('Surface Scale##Surface', surfaceScaleArr, 0.02, 0.2, '%.3f')) {
      state.surfaceScale = surfaceScaleArr[0];
      state.needsRegeneration = true;
    }
    if (ImGui.IsItemHovered()) {
      ImGui.SetTooltip('Scale of main surface turbulence (lower = larger features)');
    }

    const surfaceStrengthArr: [number] = [state.surfaceStrength];
    if (ImGui.SliderFloat('Surface Strength##Surface', surfaceStrengthArr, 0.0, 0.4)) {
      state.surfaceStrength = surfaceStrengthArr[0];
      state.needsRegeneration = true;
    }
    if (ImGui.IsItemHovered()) {
      ImGui.SetTooltip('Strength of surface turbulence variation');
    }

    const detailScaleArr: [number] = [state.detailScale];
    if (ImGui.SliderFloat('Detail Scale##Surface', detailScaleArr, 0.1, 0.5, '%.3f')) {
      state.detailScale = detailScaleArr[0];
      state.needsRegeneration = true;
    }
    if (ImGui.IsItemHovered()) {
      ImGui.SetTooltip('Scale of fine surface details (lower = larger features)');
    }

    const detailStrengthArr: [number] = [state.detailStrength];
    if (ImGui.SliderFloat('Detail Strength##Surface', detailStrengthArr, 0.0, 0.3)) {
      state.detailStrength = detailStrengthArr[0];
      state.needsRegeneration = true;
    }
    if (ImGui.IsItemHovered()) {
      ImGui.SetTooltip('Strength of fine detail variation');
    }
  }

  // === Corona Flare Controls ===
  if (ImGui.CollapsingHeader('Corona Flares', ImGui.TreeNodeFlags.DefaultOpen)) {
    const flareCountArr: [number] = [state.flareCount];
    if (ImGui.SliderInt('Count##Flare', flareCountArr, 0, 24)) {
      state.flareCount = flareCountArr[0];
      state.needsRegeneration = true;
    }
    if (ImGui.IsItemHovered()) {
      ImGui.SetTooltip('Number of corona flares radiating from sun');
    }

    const flareMinLengthArr: [number] = [state.flareMinLength];
    if (ImGui.SliderFloat('Min Length##Flare', flareMinLengthArr, 0.05, 0.3, '%.3f')) {
      state.flareMinLength = Math.min(flareMinLengthArr[0], state.flareMaxLength - 0.05);
      state.needsRegeneration = true;
    }
    if (ImGui.IsItemHovered()) {
      ImGui.SetTooltip('Minimum flare length (fraction of sun radius)');
    }

    const flareMaxLengthArr: [number] = [state.flareMaxLength];
    if (ImGui.SliderFloat('Max Length##Flare', flareMaxLengthArr, 0.1, 0.8, '%.3f')) {
      state.flareMaxLength = Math.max(flareMaxLengthArr[0], state.flareMinLength + 0.05);
      state.needsRegeneration = true;
    }
    if (ImGui.IsItemHovered()) {
      ImGui.SetTooltip('Maximum flare length (fraction of sun radius)');
    }

    const flareWidthArr: [number] = [state.flareWidth];
    if (ImGui.SliderFloat('Width##Flare', flareWidthArr, 0.05, 0.3, '%.3f')) {
      state.flareWidth = flareWidthArr[0];
      state.needsRegeneration = true;
    }
    if (ImGui.IsItemHovered()) {
      ImGui.SetTooltip('Angular width of flares');
    }

    const flareIntensityArr: [number] = [state.flareIntensity];
    if (ImGui.SliderFloat('Intensity##Flare', flareIntensityArr, 0.0, 1.0)) {
      state.flareIntensity = flareIntensityArr[0];
      state.needsRegeneration = true;
    }
    if (ImGui.IsItemHovered()) {
      ImGui.SetTooltip('Brightness boost for flares');
    }
  }

  // === Glow Controls ===
  if (ImGui.CollapsingHeader('Atmospheric Glow', ImGui.TreeNodeFlags.DefaultOpen)) {
    const glowIntensityArr: [number] = [state.glowIntensity];
    if (ImGui.SliderFloat('Intensity##Glow', glowIntensityArr, 0.0, 1.0)) {
      state.glowIntensity = glowIntensityArr[0];
      state.needsRegeneration = true;
    }
    if (ImGui.IsItemHovered()) {
      ImGui.SetTooltip('Outer glow halo intensity');
    }

    const glowSizeArr: [number] = [state.glowSize];
    if (ImGui.SliderFloat('Size##Glow', glowSizeArr, 1.0, 2.5)) {
      state.glowSize = glowSizeArr[0];
      state.needsRegeneration = true;
    }
    if (ImGui.IsItemHovered()) {
      ImGui.SetTooltip('Glow halo size multiplier');
    }

    const glowFalloffArr: [number] = [state.glowFalloff];
    if (ImGui.SliderFloat('Falloff##Glow', glowFalloffArr, 1.0, 4.0)) {
      state.glowFalloff = glowFalloffArr[0];
      state.needsRegeneration = true;
    }
    if (ImGui.IsItemHovered()) {
      ImGui.SetTooltip('Glow falloff curve (higher = sharper edge)');
    }
  }

  // === Pixelation Controls ===
  if (ImGui.CollapsingHeader('Pixelation', ImGui.TreeNodeFlags.DefaultOpen)) {
    const edgePixelationArr: [number] = [state.edgePixelation];
    if (ImGui.SliderFloat('Edge Pixelation##Pixel', edgePixelationArr, 0.0, 1.0)) {
      state.edgePixelation = edgePixelationArr[0];
      state.needsRegeneration = true;
    }
    if (ImGui.IsItemHovered()) {
      ImGui.SetTooltip('Pixelation of sun edges (higher = more chunky/pixel-art style)');
    }

    const flarePixelationArr: [number] = [state.flarePixelation];
    if (ImGui.SliderFloat('Flare Pixelation##Pixel', flarePixelationArr, 0.0, 1.0)) {
      state.flarePixelation = flarePixelationArr[0];
      state.needsRegeneration = true;
    }
    if (ImGui.IsItemHovered()) {
      ImGui.SetTooltip('Pixelation of corona flares (higher = more chunky/pixel-art style)');
    }
  }

  // === Colors ===
  if (ImGui.CollapsingHeader('Colors')) {
    const coreColorArr: [number, number, number, number] = [
      state.coreColor.x,
      state.coreColor.y,
      state.coreColor.z,
      state.coreColor.w,
    ];
    if (ImGui.ColorEdit4('Core Color', coreColorArr)) {
      state.coreColor.x = coreColorArr[0];
      state.coreColor.y = coreColorArr[1];
      state.coreColor.z = coreColorArr[2];
      state.coreColor.w = coreColorArr[3];
      state.needsRegeneration = true;
    }

    const midColorArr: [number, number, number, number] = [
      state.midColor.x,
      state.midColor.y,
      state.midColor.z,
      state.midColor.w,
    ];
    if (ImGui.ColorEdit4('Mid Color', midColorArr)) {
      state.midColor.x = midColorArr[0];
      state.midColor.y = midColorArr[1];
      state.midColor.z = midColorArr[2];
      state.midColor.w = midColorArr[3];
      state.needsRegeneration = true;
    }

    const edgeColorArr: [number, number, number, number] = [
      state.edgeColor.x,
      state.edgeColor.y,
      state.edgeColor.z,
      state.edgeColor.w,
    ];
    if (ImGui.ColorEdit4('Edge Color', edgeColorArr)) {
      state.edgeColor.x = edgeColorArr[0];
      state.edgeColor.y = edgeColorArr[1];
      state.edgeColor.z = edgeColorArr[2];
      state.edgeColor.w = edgeColorArr[3];
      state.needsRegeneration = true;
    }

    const glowColorArr: [number, number, number, number] = [
      state.glowColor.x,
      state.glowColor.y,
      state.glowColor.z,
      state.glowColor.w,
    ];
    if (ImGui.ColorEdit4('Glow Color', glowColorArr)) {
      state.glowColor.x = glowColorArr[0];
      state.glowColor.y = glowColorArr[1];
      state.glowColor.z = glowColorArr[2];
      state.glowColor.w = glowColorArr[3];
      state.needsRegeneration = true;
    }
  }

  ImGui.EndChild(); // End controls column

  // Right column - Preview
  ImGui.SameLine();
  ImGui.BeginChild('Preview', new ImVec2(previewWidth, windowHeight - 50), ImGui.ChildFlags.Borders);

  ImGui.Text('Preview');
  ImGui.Separator();
  ImGui.Spacing();

  regenerateIfNeeded();

  if (previewState.renderTarget && previewState.scene && previewState.camera) {
    const renderer = app.getRenderer();

    renderer.renderToTarget(
      previewState.renderTarget,
      previewState.scene,
      previewState.camera,
      0x0a0a1a,
    );

    if (previewState.textureId === null) {
      const threeRenderer = renderer.getThreeRenderer();
      threeRenderer.initTexture(previewState.renderTarget.texture);

      const textureProps = threeRenderer.properties.get(
        previewState.renderTarget.texture,
      ) as { __webglTexture?: WebGLTexture };
      const webglTexture = textureProps.__webglTexture;

      if (webglTexture) {
        previewState.textureId = ImGuiImplWeb.LoadTexture(undefined, {
          processFn: () => webglTexture,
        });
      }
    }

    if (previewState.textureId !== null) {
      const maxPreviewSize = Math.min(previewWidth - 20, windowHeight - 150, 512);
      const previewSize = maxPreviewSize;

      const offsetX = (previewWidth - previewSize) / 2;
      ImGui.SetCursorPosX(ImGui.GetCursorPosX() + offsetX);

      ImGui.Image(
        new ImTextureRef(previewState.textureId),
        new ImVec2(previewSize, previewSize),
      );
    } else {
      ImGui.Text('Loading preview...');
    }
  }

  ImGui.Spacing();
  ImGui.Separator();

  // === Download Section ===
  const downloadButtonWidth = 200;
  const buttonOffsetX = (previewWidth - downloadButtonWidth) / 2;
  ImGui.SetCursorPosX(ImGui.GetCursorPosX() + buttonOffsetX);

  if (ImGui.Button('Download PNG (512x512)', new ImVec2(downloadButtonWidth, 40))) {
    downloadSunTexture();
  }
  if (ImGui.IsItemHovered()) {
    ImGui.SetTooltip('Save sun texture as PNG file (512×512)');
  }

  ImGui.EndChild(); // End preview column

  ImGui.End();
}

/**
 * Cleanup function to dispose resources
 */
export function cleanupSunGeneratorPanel(app: Application): void {
  state.currentTexture?.dispose();
  state.currentTexture = null;

  if (previewState.renderTarget) {
    const renderer = app.getRenderer();
    renderer.disposeRenderTarget(previewState.renderTarget);
    previewState.renderTarget = null;
  }

  if (previewState.sprite) {
    previewState.sprite.material.dispose();
    previewState.sprite = null;
  }

  previewState.scene = null;
  previewState.camera = null;
}
