/**
 * Cloud Texture Generator Panel
 *
 * ImGui panel for generating pixel art cloud textures with real-time preview.
 */

import { ImGui, ImVec4, ImVec2, ImTextureRef, ImGuiImplWeb } from '@voidscript/imgui';
import * as THREE from 'three';
import type { Application } from '@voidscript/engine';
import {
  generateCloudTexture,
  type CloudTextureOptions,
} from '../generators/cloud-texture-generator.js';

/**
 * State for the cloud generator panel
 */
interface CloudGeneratorState {
  seed: number;
  resolutionIndex: number; // 0=64, 1=128, 2=256 - pixel art resolution factor
  circleCount: number; // Number of circles to use for cloud shape
  horizontalStretch: number; // 0.5 = 256px wide, 2.0 = 512px wide (within 512x512 canvas)
  verticalStretch: number; // 0.5 = 256px tall, 2.0 = 512px tall (within 512x512 canvas)
  weatherType: 'normal' | 'rainy';
  normalBase: ImVec4;
  normalShade: ImVec4;
  normalHighlight: ImVec4;
  rainyBase: ImVec4;
  rainyShade: ImVec4;
  rainyHighlight: ImVec4;
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
const state: CloudGeneratorState = {
  seed: 0,
  resolutionIndex: 1, // 128 default
  circleCount: 8,
  horizontalStretch: 1.0,
  verticalStretch: 1.0,
  weatherType: 'normal',
  normalBase: new ImVec4(0.95, 0.95, 0.98, 1.0),
  normalShade: new ImVec4(0.7, 0.72, 0.8, 1.0),
  normalHighlight: new ImVec4(1.0, 1.0, 1.0, 1.0),
  rainyBase: new ImVec4(0.4, 0.42, 0.48, 1.0),
  rainyShade: new ImVec4(0.2, 0.22, 0.28, 1.0),
  rainyHighlight: new ImVec4(0.55, 0.57, 0.63, 1.0),
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
  previewState.scene.background = new THREE.Color(0x1a1a1a);

  // Create orthographic camera
  previewState.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
  previewState.camera.position.z = 1;

  // Create sprite for displaying the cloud texture
  const material = new THREE.SpriteMaterial({
    map: null,
    transparent: true,
  });
  previewState.sprite = new THREE.Sprite(material);
  previewState.scene.add(previewState.sprite);
}

/**
 * Build CloudTextureOptions from current state
 */
function buildOptionsFromState(): CloudTextureOptions {
  // Generate at lower resolution, will upscale to 512×512 later
  const pixelSize = RESOLUTION_OPTIONS[state.resolutionIndex] ?? 128;

  return {
    seed: state.seed,
    width: pixelSize,
    height: pixelSize,
    circleCount: state.circleCount,
    horizontalStretch: state.horizontalStretch,
    verticalStretch: state.verticalStretch,
    weatherType: state.weatherType,
    normalBase: {
      r: state.normalBase.x,
      g: state.normalBase.y,
      b: state.normalBase.z,
      a: state.normalBase.w,
    },
    normalShade: {
      r: state.normalShade.x,
      g: state.normalShade.y,
      b: state.normalShade.z,
      a: state.normalShade.w,
    },
    normalHighlight: {
      r: state.normalHighlight.x,
      g: state.normalHighlight.y,
      b: state.normalHighlight.z,
      a: state.normalHighlight.w,
    },
    rainyBase: {
      r: state.rainyBase.x,
      g: state.rainyBase.y,
      b: state.rainyBase.z,
      a: state.rainyBase.w,
    },
    rainyShade: {
      r: state.rainyShade.x,
      g: state.rainyShade.y,
      b: state.rainyShade.z,
      a: state.rainyShade.w,
    },
    rainyHighlight: {
      r: state.rainyHighlight.x,
      g: state.rainyHighlight.y,
      b: state.rainyHighlight.z,
      a: state.rainyHighlight.w,
    },
  };
}

/**
 * Regenerate cloud texture if needed
 */
function regenerateIfNeeded(): void {
  if (!state.needsRegeneration) {
    return;
  }

  // Dispose old texture
  state.currentTexture?.dispose();

  // Generate new texture
  const options = buildOptionsFromState();
  state.currentTexture = generateCloudTexture(options);

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
      // Find source pixel using nearest neighbor
      const srcX = Math.floor(x / scale);
      const srcY = Math.floor(y / scale);
      const srcIndex = (srcY * sourceSize + srcX) * 4;
      const targetIndex = (y * targetSize + x) * 4;

      // Copy RGBA values
      targetData[targetIndex] = sourceData[srcIndex]!;
      targetData[targetIndex + 1] = sourceData[srcIndex + 1]!;
      targetData[targetIndex + 2] = sourceData[srcIndex + 2]!;
      targetData[targetIndex + 3] = sourceData[srcIndex + 3]!;
    }
  }

  return targetData;
}

/**
 * Download the current cloud texture as PNG (always 512×512)
 */
async function downloadCloudTexture(): Promise<void> {
  if (!state.currentTexture) {
    console.error('No texture to download');
    return;
  }

  try {
    const sourceData = state.currentTexture.image.data as Uint8Array;
    const sourceSize = state.currentTexture.image.width;

    // Upscale to 512×512 if needed
    const finalData = sourceSize === CANVAS_SIZE
      ? sourceData
      : upscaleTextureData(sourceData, sourceSize);

    // Create canvas and draw pixels (always 512×512)
    const canvas = document.createElement('canvas');
    canvas.width = CANVAS_SIZE;
    canvas.height = CANVAS_SIZE;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      console.error('Failed to get canvas context');
      return;
    }

    // Create ImageData from upscaled texture data
    const imageData = ctx.createImageData(CANVAS_SIZE, CANVAS_SIZE);
    imageData.data.set(finalData);
    ctx.putImageData(imageData, 0, 0);

    // Convert to data URL (base64 PNG)
    const dataUrl = canvas.toDataURL('image/png');

    // Trigger browser download
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `cloud_${state.seed}_512x512.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    console.log(`Cloud texture downloaded: cloud_${state.seed}_512x512.png`);
  } catch (error) {
    console.error('Failed to download cloud texture:', error);
  }
}

/**
 * Open the Cloud Texture Generator window
 */
export function openCloudGeneratorWindow(): void {
  isWindowOpen = true;
}

/**
 * Close the Cloud Texture Generator window
 */
export function closeCloudGeneratorWindow(): void {
  isWindowOpen = false;
}

/**
 * Check if the Cloud Texture Generator window is open
 */
export function isCloudGeneratorWindowOpen(): boolean {
  return isWindowOpen;
}

/**
 * Render the Cloud Texture Generator panel as a standalone window
 */
export function renderCloudGeneratorPanel(app: Application): void {
  if (!isWindowOpen) return;

  // Initialize preview on first render
  initializePreview(app);

  ImGui.SetNextWindowSize(new ImVec2(600, 750), ImGui.Cond.FirstUseEver);

  const isOpenArr: [boolean] = [isWindowOpen];
  if (!ImGui.Begin('Cloud Texture Generator', isOpenArr)) {
    isWindowOpen = isOpenArr[0];
    ImGui.End();
    return;
  }
  isWindowOpen = isOpenArr[0];

  // === Parameters Section ===
  ImGui.Text('Parameters');
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

  // Resolution control (pixel art detail level)
  const resolutionIndexArr: [number] = [state.resolutionIndex];
  if (ImGui.Combo('Resolution', resolutionIndexArr, RESOLUTION_LABELS.join('\0') + '\0')) {
    state.resolutionIndex = resolutionIndexArr[0];
    state.needsRegeneration = true;
  }
  if (ImGui.IsItemHovered()) {
    ImGui.SetTooltip('Pixel art detail level - higher = more detail (output always 512×512)');
  }

  // Circle count control
  const circleCountArr: [number] = [state.circleCount];
  if (ImGui.SliderInt('Circle Count', circleCountArr, 3, 50)) {
    state.circleCount = circleCountArr[0];
    state.needsRegeneration = true;
  }
  if (ImGui.IsItemHovered()) {
    ImGui.SetTooltip('Number of overlapping circles to generate cloud shape');
  }

  // Horizontal stretch control (0.5-2.0 range)
  const horizontalStretchArr: [number] = [state.horizontalStretch];
  if (ImGui.SliderFloat('Horizontal Stretch', horizontalStretchArr, 0.5, 2.0)) {
    state.horizontalStretch = horizontalStretchArr[0];
    state.needsRegeneration = true;
  }
  if (ImGui.IsItemHovered()) {
    ImGui.SetTooltip('Cloud width (0.5 = 256px, 1.0 = 512px, 2.0 = full width minus margin)');
  }

  // Vertical stretch control (0.5-2.0 range)
  const verticalStretchArr: [number] = [state.verticalStretch];
  if (ImGui.SliderFloat('Vertical Stretch', verticalStretchArr, 0.5, 2.0)) {
    state.verticalStretch = verticalStretchArr[0];
    state.needsRegeneration = true;
  }
  if (ImGui.IsItemHovered()) {
    ImGui.SetTooltip('Cloud height (0.5 = 256px, 1.0 = 512px, 2.0 = full height minus margin)');
  }

  // Weather type
  ImGui.Text('Weather Type');
  if (ImGui.RadioButton('Normal', state.weatherType === 'normal')) {
    state.weatherType = 'normal';
    state.needsRegeneration = true;
  }
  ImGui.SameLine();
  if (ImGui.RadioButton('Rainy', state.weatherType === 'rainy')) {
    state.weatherType = 'rainy';
    state.needsRegeneration = true;
  }

  ImGui.Spacing();

  // Color pickers based on weather type
  if (state.weatherType === 'normal') {
    ImGui.Text('Normal Weather Colors');
    const normalBaseArr: [number, number, number, number] = [
      state.normalBase.x,
      state.normalBase.y,
      state.normalBase.z,
      state.normalBase.w,
    ];
    if (ImGui.ColorEdit4('Base Color##normal', normalBaseArr)) {
      state.normalBase.x = normalBaseArr[0];
      state.normalBase.y = normalBaseArr[1];
      state.normalBase.z = normalBaseArr[2];
      state.normalBase.w = normalBaseArr[3];
      state.needsRegeneration = true;
    }
    const normalShadeArr: [number, number, number, number] = [
      state.normalShade.x,
      state.normalShade.y,
      state.normalShade.z,
      state.normalShade.w,
    ];
    if (ImGui.ColorEdit4('Shade Color##normal', normalShadeArr)) {
      state.normalShade.x = normalShadeArr[0];
      state.normalShade.y = normalShadeArr[1];
      state.normalShade.z = normalShadeArr[2];
      state.normalShade.w = normalShadeArr[3];
      state.needsRegeneration = true;
    }
    const normalHighlightArr: [number, number, number, number] = [
      state.normalHighlight.x,
      state.normalHighlight.y,
      state.normalHighlight.z,
      state.normalHighlight.w,
    ];
    if (ImGui.ColorEdit4('Highlight Color##normal', normalHighlightArr)) {
      state.normalHighlight.x = normalHighlightArr[0];
      state.normalHighlight.y = normalHighlightArr[1];
      state.normalHighlight.z = normalHighlightArr[2];
      state.normalHighlight.w = normalHighlightArr[3];
      state.needsRegeneration = true;
    }
  } else {
    ImGui.Text('Rainy Weather Colors');
    const rainyBaseArr: [number, number, number, number] = [
      state.rainyBase.x,
      state.rainyBase.y,
      state.rainyBase.z,
      state.rainyBase.w,
    ];
    if (ImGui.ColorEdit4('Base Color##rainy', rainyBaseArr)) {
      state.rainyBase.x = rainyBaseArr[0];
      state.rainyBase.y = rainyBaseArr[1];
      state.rainyBase.z = rainyBaseArr[2];
      state.rainyBase.w = rainyBaseArr[3];
      state.needsRegeneration = true;
    }
    const rainyShadeArr: [number, number, number, number] = [
      state.rainyShade.x,
      state.rainyShade.y,
      state.rainyShade.z,
      state.rainyShade.w,
    ];
    if (ImGui.ColorEdit4('Shade Color##rainy', rainyShadeArr)) {
      state.rainyShade.x = rainyShadeArr[0];
      state.rainyShade.y = rainyShadeArr[1];
      state.rainyShade.z = rainyShadeArr[2];
      state.rainyShade.w = rainyShadeArr[3];
      state.needsRegeneration = true;
    }
    const rainyHighlightArr: [number, number, number, number] = [
      state.rainyHighlight.x,
      state.rainyHighlight.y,
      state.rainyHighlight.z,
      state.rainyHighlight.w,
    ];
    if (ImGui.ColorEdit4('Highlight Color##rainy', rainyHighlightArr)) {
      state.rainyHighlight.x = rainyHighlightArr[0];
      state.rainyHighlight.y = rainyHighlightArr[1];
      state.rainyHighlight.z = rainyHighlightArr[2];
      state.rainyHighlight.w = rainyHighlightArr[3];
      state.needsRegeneration = true;
    }
  }

  ImGui.Spacing();
  ImGui.Separator();

  // === Preview Section ===
  ImGui.Text('Preview');
  ImGui.Separator();

  // Regenerate texture if needed
  regenerateIfNeeded();

  // Render preview
  if (previewState.renderTarget && previewState.scene && previewState.camera) {
    const renderer = app.getRenderer();

    // Render scene to render target
    renderer.renderToTarget(
      previewState.renderTarget,
      previewState.scene,
      previewState.camera,
      0x1a1a1a,
    );

    // Get or create ImGui texture ID
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
      // Calculate preview size (always square, fit to window)
      const windowWidth = ImGui.GetWindowWidth();
      const maxPreviewSize = Math.min(windowWidth - 40, 512);
      const previewSize = maxPreviewSize;

      // Center the preview horizontally
      const offsetX = (windowWidth - previewSize) / 2;
      ImGui.SetCursorPosX(offsetX);

      // Display preview with ImTextureRef wrapper (always square)
      ImGui.Image(
        new ImTextureRef(previewState.textureId),
        new ImVec2(previewSize, previewSize),
      );
    } else {
      // Show loading text if texture not ready
      ImGui.Text('Loading preview...');
    }
  }

  ImGui.Spacing();
  ImGui.Separator();

  // === Download Section ===
  ImGui.Text('Export');
  ImGui.Separator();

  const windowWidth = ImGui.GetWindowWidth();
  const buttonWidth = 200;
  const offsetX = (windowWidth - buttonWidth) / 2;
  ImGui.SetCursorPosX(offsetX);

  if (ImGui.Button('Download PNG', new ImVec2(buttonWidth, 40))) {
    downloadCloudTexture();
  }
  if (ImGui.IsItemHovered()) {
    ImGui.SetTooltip('Save cloud texture as PNG file (512×512)');
  }

  ImGui.End();
}

/**
 * Cleanup function to dispose resources
 * Call this when the panel is no longer needed
 */
export function cleanupCloudGeneratorPanel(app: Application): void {
  // Dispose texture
  state.currentTexture?.dispose();
  state.currentTexture = null;

  // Dispose preview resources
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
