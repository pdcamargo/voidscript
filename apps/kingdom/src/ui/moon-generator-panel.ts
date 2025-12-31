/**
 * Moon Texture Generator Panel
 *
 * ImGui panel for generating pixel art moon textures with comprehensive real-time controls.
 */

import { ImGui, ImVec4, ImVec2, ImTextureRef, ImGuiImplWeb } from '@voidscript/imgui';
import * as THREE from 'three';
import type { Application } from '@voidscript/engine';
import {
  generateMoonTexture,
  type MoonTextureOptions,
} from '../generators/moon-texture-generator.js';

/**
 * State for the moon generator panel
 */
interface MoonGeneratorState {
  seed: number;
  resolutionIndex: number; // 0=64, 1=128, 2=256

  // Crater controls
  craterCount: number;
  craterMinSize: number;
  craterMaxSize: number;
  craterDepth: number;
  craterRimBrightness: number;
  craterRimWidth: number;

  // Surface controls
  surfaceNoiseScale: number;
  surfaceNoiseStrength: number;
  fineDetailScale: number;
  fineDetailStrength: number;

  // Maria controls
  mariaCount: number;
  mariaDarkness: number;
  mariaSize: number;

  // Phase and lighting
  phase: number;
  lightingContrast: number;

  // Pixelation
  craterPixelation: number;
  mariaPixelation: number;

  // Colors
  baseColor: ImVec4;
  mariaColor: ImVec4;
  highlightColor: ImVec4;

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
const state: MoonGeneratorState = {
  seed: 0,
  resolutionIndex: 1, // 128 default

  // Crater defaults
  craterCount: 12,
  craterMinSize: 0.03,
  craterMaxSize: 0.15,
  craterDepth: 0.6,
  craterRimBrightness: 0.3,
  craterRimWidth: 0.15,

  // Surface defaults
  surfaceNoiseScale: 0.15,
  surfaceNoiseStrength: 0.2,
  fineDetailScale: 0.5,
  fineDetailStrength: 0.1,

  // Maria defaults
  mariaCount: 3,
  mariaDarkness: 0.3,
  mariaSize: 0.3,

  // Phase and lighting
  phase: 0.5,
  lightingContrast: 0.4,

  // Pixelation
  craterPixelation: 0.3,
  mariaPixelation: 0.2,

  // Colors
  baseColor: new ImVec4(0.88, 0.88, 0.90, 1.0),
  mariaColor: new ImVec4(0.25, 0.25, 0.30, 1.0),
  highlightColor: new ImVec4(0.98, 0.98, 1.0, 1.0),

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
  previewState.scene.background = new THREE.Color(0x0a0a0a);

  // Create orthographic camera
  previewState.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
  previewState.camera.position.z = 1;

  // Create sprite for displaying the moon texture
  const material = new THREE.SpriteMaterial({
    map: null,
    transparent: true,
  });
  previewState.sprite = new THREE.Sprite(material);
  previewState.scene.add(previewState.sprite);
}

/**
 * Build MoonTextureOptions from current state
 */
function buildOptionsFromState(): MoonTextureOptions {
  const pixelSize = RESOLUTION_OPTIONS[state.resolutionIndex] ?? 128;

  return {
    seed: state.seed,
    width: pixelSize,
    height: pixelSize,

    // Crater options
    craterCount: state.craterCount,
    craterMinSize: state.craterMinSize,
    craterMaxSize: state.craterMaxSize,
    craterDepth: state.craterDepth,
    craterRimBrightness: state.craterRimBrightness,
    craterRimWidth: state.craterRimWidth,

    // Surface options
    surfaceNoiseScale: state.surfaceNoiseScale,
    surfaceNoiseStrength: state.surfaceNoiseStrength,
    fineDetailScale: state.fineDetailScale,
    fineDetailStrength: state.fineDetailStrength,

    // Maria options
    mariaCount: state.mariaCount,
    mariaDarkness: state.mariaDarkness,
    mariaSize: state.mariaSize,

    // Phase and lighting
    phase: state.phase,
    lightingContrast: state.lightingContrast,

    // Pixelation
    craterPixelation: state.craterPixelation,
    mariaPixelation: state.mariaPixelation,

    // Colors
    baseColor: {
      r: state.baseColor.x,
      g: state.baseColor.y,
      b: state.baseColor.z,
      a: state.baseColor.w,
    },
    mariaColor: {
      r: state.mariaColor.x,
      g: state.mariaColor.y,
      b: state.mariaColor.z,
      a: state.mariaColor.w,
    },
    highlightColor: {
      r: state.highlightColor.x,
      g: state.highlightColor.y,
      b: state.highlightColor.z,
      a: state.highlightColor.w,
    },
  };
}

/**
 * Regenerate moon texture if needed
 */
function regenerateIfNeeded(): void {
  if (!state.needsRegeneration) {
    return;
  }

  // Dispose old texture
  state.currentTexture?.dispose();

  // Generate new texture
  const options = buildOptionsFromState();
  state.currentTexture = generateMoonTexture(options);

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
 * Download the current moon texture as PNG (always 512×512)
 */
async function downloadMoonTexture(): Promise<void> {
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
    link.download = `moon_${state.seed}_512x512.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    console.log(`Moon texture downloaded: moon_${state.seed}_512x512.png`);
  } catch (error) {
    console.error('Failed to download moon texture:', error);
  }
}

/**
 * Open the Moon Texture Generator window
 */
export function openMoonGeneratorWindow(): void {
  isWindowOpen = true;
}

/**
 * Close the Moon Texture Generator window
 */
export function closeMoonGeneratorWindow(): void {
  isWindowOpen = false;
}

/**
 * Check if the Moon Texture Generator window is open
 */
export function isMoonGeneratorWindowOpen(): boolean {
  return isWindowOpen;
}

/**
 * Render the Moon Texture Generator panel as a standalone window
 */
export function renderMoonGeneratorPanel(app: Application): void {
  if (!isWindowOpen) return;

  initializePreview(app);

  ImGui.SetNextWindowSize(new ImVec2(1000, 700), ImGui.Cond.FirstUseEver);

  const isOpenArr: [boolean] = [isWindowOpen];
  if (!ImGui.Begin('Moon Texture Generator', isOpenArr)) {
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

  // === Crater Controls ===
  if (ImGui.CollapsingHeader('Crater Controls', ImGui.TreeNodeFlags.DefaultOpen)) {
    const craterCountArr: [number] = [state.craterCount];
    if (ImGui.SliderInt('Count##Crater', craterCountArr, 0, 40)) {
      state.craterCount = craterCountArr[0];
      state.needsRegeneration = true;
    }
    if (ImGui.IsItemHovered()) {
      ImGui.SetTooltip('Number of craters to generate');
    }

    const craterMinSizeArr: [number] = [state.craterMinSize];
    if (ImGui.SliderFloat('Min Size##Crater', craterMinSizeArr, 0.01, 0.2, '%.3f')) {
      state.craterMinSize = craterMinSizeArr[0];
      state.needsRegeneration = true;
    }
    if (ImGui.IsItemHovered()) {
      ImGui.SetTooltip('Minimum crater size (fraction of moon radius)');
    }

    const craterMaxSizeArr: [number] = [state.craterMaxSize];
    if (ImGui.SliderFloat('Max Size##Crater', craterMaxSizeArr, 0.05, 0.4, '%.3f')) {
      state.craterMaxSize = Math.max(craterMaxSizeArr[0], state.craterMinSize);
      state.needsRegeneration = true;
    }
    if (ImGui.IsItemHovered()) {
      ImGui.SetTooltip('Maximum crater size (fraction of moon radius)');
    }

    const craterDepthArr: [number] = [state.craterDepth];
    if (ImGui.SliderFloat('Depth##Crater', craterDepthArr, 0.0, 1.0)) {
      state.craterDepth = craterDepthArr[0];
      state.needsRegeneration = true;
    }
    if (ImGui.IsItemHovered()) {
      ImGui.SetTooltip('How dark/deep craters appear');
    }

    const craterRimBrightnessArr: [number] = [state.craterRimBrightness];
    if (ImGui.SliderFloat('Rim Brightness##Crater', craterRimBrightnessArr, 0.0, 1.0)) {
      state.craterRimBrightness = craterRimBrightnessArr[0];
      state.needsRegeneration = true;
    }
    if (ImGui.IsItemHovered()) {
      ImGui.SetTooltip('Brightness of the bright rim around craters');
    }

    const craterRimWidthArr: [number] = [state.craterRimWidth];
    if (ImGui.SliderFloat('Rim Width##Crater', craterRimWidthArr, 0.05, 0.4, '%.3f')) {
      state.craterRimWidth = craterRimWidthArr[0];
      state.needsRegeneration = true;
    }
    if (ImGui.IsItemHovered()) {
      ImGui.SetTooltip('Width of crater rim (fraction of crater radius)');
    }
  }

  // === Surface Detail Controls ===
  if (ImGui.CollapsingHeader('Surface Detail', ImGui.TreeNodeFlags.DefaultOpen)) {
    const surfaceNoiseScaleArr: [number] = [state.surfaceNoiseScale];
    if (ImGui.SliderFloat('Surface Scale##Surface', surfaceNoiseScaleArr, 0.05, 0.5, '%.3f')) {
      state.surfaceNoiseScale = surfaceNoiseScaleArr[0];
      state.needsRegeneration = true;
    }
    if (ImGui.IsItemHovered()) {
      ImGui.SetTooltip('Scale of main surface texture (lower = larger features)');
    }

    const surfaceNoiseStrengthArr: [number] = [state.surfaceNoiseStrength];
    if (ImGui.SliderFloat('Surface Strength##Surface', surfaceNoiseStrengthArr, 0.0, 0.5)) {
      state.surfaceNoiseStrength = surfaceNoiseStrengthArr[0];
      state.needsRegeneration = true;
    }
    if (ImGui.IsItemHovered()) {
      ImGui.SetTooltip('Strength of surface texture variation');
    }

    const fineDetailScaleArr: [number] = [state.fineDetailScale];
    if (ImGui.SliderFloat('Detail Scale##Surface', fineDetailScaleArr, 0.2, 1.0, '%.3f')) {
      state.fineDetailScale = fineDetailScaleArr[0];
      state.needsRegeneration = true;
    }
    if (ImGui.IsItemHovered()) {
      ImGui.SetTooltip('Scale of fine surface details (lower = larger features)');
    }

    const fineDetailStrengthArr: [number] = [state.fineDetailStrength];
    if (ImGui.SliderFloat('Detail Strength##Surface', fineDetailStrengthArr, 0.0, 0.3)) {
      state.fineDetailStrength = fineDetailStrengthArr[0];
      state.needsRegeneration = true;
    }
    if (ImGui.IsItemHovered()) {
      ImGui.SetTooltip('Strength of fine detail variation');
    }
  }

  // === Maria Controls (Dark Patches) ===
  if (ImGui.CollapsingHeader('Maria (Dark Patches)', ImGui.TreeNodeFlags.DefaultOpen)) {
    const mariaCountArr: [number] = [state.mariaCount];
    if (ImGui.SliderInt('Count##Maria', mariaCountArr, 0, 8)) {
      state.mariaCount = mariaCountArr[0];
      state.needsRegeneration = true;
    }
    if (ImGui.IsItemHovered()) {
      ImGui.SetTooltip('Number of dark maria regions');
    }

    const mariaDarknessArr: [number] = [state.mariaDarkness];
    if (ImGui.SliderFloat('Darkness##Maria', mariaDarknessArr, 0.0, 0.8)) {
      state.mariaDarkness = mariaDarknessArr[0];
      state.needsRegeneration = true;
    }
    if (ImGui.IsItemHovered()) {
      ImGui.SetTooltip('How dark the maria patches are');
    }

    const mariaSizeArr: [number] = [state.mariaSize];
    if (ImGui.SliderFloat('Size##Maria', mariaSizeArr, 0.1, 0.6, '%.3f')) {
      state.mariaSize = mariaSizeArr[0];
      state.needsRegeneration = true;
    }
    if (ImGui.IsItemHovered()) {
      ImGui.SetTooltip('Size of maria patches (fraction of moon radius)');
    }
  }

  // === Phase and Lighting ===
  if (ImGui.CollapsingHeader('Phase & Lighting', ImGui.TreeNodeFlags.DefaultOpen)) {
    const phaseArr: [number] = [state.phase];
    if (ImGui.SliderFloat('Phase##Lighting', phaseArr, 0.0, 1.0)) {
      state.phase = phaseArr[0];
      state.needsRegeneration = true;
    }
    if (ImGui.IsItemHovered()) {
      ImGui.SetTooltip('Moon phase (0.0 = new moon, 0.5 = full moon, 1.0 = new moon)');
    }

    const lightingContrastArr: [number] = [state.lightingContrast];
    if (ImGui.SliderFloat('Lighting Contrast##Lighting', lightingContrastArr, 0.0, 1.0)) {
      state.lightingContrast = lightingContrastArr[0];
      state.needsRegeneration = true;
    }
    if (ImGui.IsItemHovered()) {
      ImGui.SetTooltip('Contrast of 3D sphere lighting (higher = darker edges)');
    }
  }

  // === Pixelation Controls ===
  if (ImGui.CollapsingHeader('Pixelation', ImGui.TreeNodeFlags.DefaultOpen)) {
    const craterPixelationArr: [number] = [state.craterPixelation];
    if (ImGui.SliderFloat('Crater Edges##Pixelation', craterPixelationArr, 0.0, 1.0)) {
      state.craterPixelation = craterPixelationArr[0];
      state.needsRegeneration = true;
    }
    if (ImGui.IsItemHovered()) {
      ImGui.SetTooltip('Pixelation of crater edges (higher = more chunky/pixel-art style)');
    }

    const mariaPixelationArr: [number] = [state.mariaPixelation];
    if (ImGui.SliderFloat('Maria Edges##Pixelation', mariaPixelationArr, 0.0, 1.0)) {
      state.mariaPixelation = mariaPixelationArr[0];
      state.needsRegeneration = true;
    }
    if (ImGui.IsItemHovered()) {
      ImGui.SetTooltip('Pixelation of maria patch edges (higher = more chunky/pixel-art style)');
    }
  }

  // === Colors ===
  if (ImGui.CollapsingHeader('Colors')) {
    const baseColorArr: [number, number, number, number] = [
      state.baseColor.x,
      state.baseColor.y,
      state.baseColor.z,
      state.baseColor.w,
    ];
    if (ImGui.ColorEdit4('Base Color', baseColorArr)) {
      state.baseColor.x = baseColorArr[0];
      state.baseColor.y = baseColorArr[1];
      state.baseColor.z = baseColorArr[2];
      state.baseColor.w = baseColorArr[3];
      state.needsRegeneration = true;
    }

    const mariaColorArr: [number, number, number, number] = [
      state.mariaColor.x,
      state.mariaColor.y,
      state.mariaColor.z,
      state.mariaColor.w,
    ];
    if (ImGui.ColorEdit4('Maria/Crater Color', mariaColorArr)) {
      state.mariaColor.x = mariaColorArr[0];
      state.mariaColor.y = mariaColorArr[1];
      state.mariaColor.z = mariaColorArr[2];
      state.mariaColor.w = mariaColorArr[3];
      state.needsRegeneration = true;
    }

    const highlightColorArr: [number, number, number, number] = [
      state.highlightColor.x,
      state.highlightColor.y,
      state.highlightColor.z,
      state.highlightColor.w,
    ];
    if (ImGui.ColorEdit4('Highlight Color', highlightColorArr)) {
      state.highlightColor.x = highlightColorArr[0];
      state.highlightColor.y = highlightColorArr[1];
      state.highlightColor.z = highlightColorArr[2];
      state.highlightColor.w = highlightColorArr[3];
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
      0x0a0a0a,
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
    downloadMoonTexture();
  }
  if (ImGui.IsItemHovered()) {
    ImGui.SetTooltip('Save moon texture as PNG file (512×512)');
  }

  ImGui.EndChild(); // End preview column

  ImGui.End();
}

/**
 * Cleanup function to dispose resources
 */
export function cleanupMoonGeneratorPanel(app: Application): void {
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
