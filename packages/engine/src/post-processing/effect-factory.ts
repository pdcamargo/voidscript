/**
 * Effect Factory
 *
 * Creates, updates, and disposes Three.js post-processing passes
 * based on effect configuration.
 */

import * as THREE from "three";
import type { Pass } from "three/examples/jsm/postprocessing/Pass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { SSAOPass } from "three/examples/jsm/postprocessing/SSAOPass.js";
import { SAOPass } from "three/examples/jsm/postprocessing/SAOPass.js";
import { GTAOPass } from "three/examples/jsm/postprocessing/GTAOPass.js";
import { OutlinePass } from "three/examples/jsm/postprocessing/OutlinePass.js";
import { FilmPass } from "three/examples/jsm/postprocessing/FilmPass.js";
import { GlitchPass } from "three/examples/jsm/postprocessing/GlitchPass.js";
import { DotScreenPass } from "three/examples/jsm/postprocessing/DotScreenPass.js";
import { BokehPass } from "three/examples/jsm/postprocessing/BokehPass.js";
import { RenderPixelatedPass } from "three/examples/jsm/postprocessing/RenderPixelatedPass.js";
import { AfterimagePass } from "three/examples/jsm/postprocessing/AfterimagePass.js";
import { HalftonePass } from "three/examples/jsm/postprocessing/HalftonePass.js";
import { SSAARenderPass } from "three/examples/jsm/postprocessing/SSAARenderPass.js";
import { TAARenderPass } from "three/examples/jsm/postprocessing/TAARenderPass.js";
import { SMAAPass } from "three/examples/jsm/postprocessing/SMAAPass.js";

// Shaders
import { VignetteShader } from "three/examples/jsm/shaders/VignetteShader.js";
import { SepiaShader } from "three/examples/jsm/shaders/SepiaShader.js";
import { BrightnessContrastShader } from "three/examples/jsm/shaders/BrightnessContrastShader.js";
import { HueSaturationShader } from "three/examples/jsm/shaders/HueSaturationShader.js";
import { RGBShiftShader } from "three/examples/jsm/shaders/RGBShiftShader.js";
import { ColorCorrectionShader } from "three/examples/jsm/shaders/ColorCorrectionShader.js";
import { FXAAShader } from "three/examples/jsm/shaders/FXAAShader.js";

import type {
  EffectConfig,
  EffectType,
  FXAAConfig,
  SMAAConfig,
  SSAAConfig,
  TAAConfig,
  BloomConfig,
  SSAOConfig,
  SAOConfig,
  GTAOConfig,
  OutlineConfig,
  BokehConfig,
  FilmConfig,
  VignetteConfig,
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
} from "./types.js";
import type { PostProcessingManager } from "./managers/post-processing-manager.js";
import type { Command } from "@voidscript/core";

/**
 * Create a Three.js pass for the given effect configuration
 */
export function createPass(
  type: EffectType,
  config: EffectConfig,
  scene: THREE.Scene,
  camera: THREE.Camera,
  width: number,
  height: number,
  commands: Command,
  manager: PostProcessingManager
): Pass | null {
  switch (type) {
    // ========== Anti-Aliasing ==========
    case "fxaa": {
      const pass = new ShaderPass(FXAAShader);
      const resolution = pass.uniforms["resolution"];
      if (resolution) {
        resolution.value.set(1 / width, 1 / height);
      }
      return pass;
    }

    case "smaa": {
      return new SMAAPass();
    }

    case "ssaa": {
      const c = config as SSAAConfig;
      const pass = new SSAARenderPass(scene, camera);
      pass.sampleLevel = c.sampleLevel;
      pass.unbiased = c.unbiased;
      return pass;
    }

    case "taa": {
      const c = config as TAAConfig;
      const pass = new TAARenderPass(scene, camera);
      pass.sampleLevel = c.sampleLevel;
      pass.accumulate = c.accumulate;
      return pass;
    }

    // ========== Bloom ==========
    case "bloom": {
      const c = config as BloomConfig;
      return new UnrealBloomPass(
        new THREE.Vector2(width, height),
        c.strength,
        c.radius,
        c.threshold
      );
    }

    // ========== Ambient Occlusion ==========
    case "ssao": {
      const c = config as SSAOConfig;
      const pass = new SSAOPass(scene, camera, width, height);
      pass.kernelRadius = c.kernelRadius;
      pass.minDistance = c.minDistance;
      pass.maxDistance = c.maxDistance;
      // Output mode: 0=Default, 1=SSAO, 2=Blur, 3=Beauty, 4=Depth, 5=Normal
      const outputMap: Record<SSAOConfig["output"], number> = {
        default: 0,
        ssao: 1,
        blur: 2,
        beauty: 3,
        depth: 4,
        normal: 5,
      };
      pass.output = outputMap[c.output];
      return pass;
    }

    case "sao": {
      const c = config as SAOConfig;
      const pass = new SAOPass(scene, camera);
      pass.params.saoBias = c.saoBias;
      pass.params.saoIntensity = c.saoIntensity;
      pass.params.saoScale = c.saoScale;
      pass.params.saoKernelRadius = c.saoKernelRadius;
      pass.params.saoMinResolution = c.saoMinResolution;
      pass.params.saoBlur = c.saoBlur;
      pass.params.saoBlurRadius = c.saoBlurRadius;
      pass.params.saoBlurStdDev = c.saoBlurStdDev;
      pass.params.saoBlurDepthCutoff = c.saoBlurDepthCutoff;
      return pass;
    }

    case "gtao": {
      const c = config as GTAOConfig;
      const pass = new GTAOPass(scene, camera, width, height);
      pass.blendIntensity = c.blendIntensity;
      // Output mode
      const outputMap: Record<GTAOConfig["output"], number> = {
        default: 0,
        ao: 1,
        denoise: 2,
        depth: 3,
        normal: 4,
      };
      pass.output = outputMap[c.output];
      return pass;
    }

    // ========== Outline ==========
    case "outline": {
      const c = config as OutlineConfig;
      const pass = new OutlinePass(
        new THREE.Vector2(width, height),
        scene,
        camera
      );
      pass.visibleEdgeColor.setRGB(
        c.visibleEdgeColor.r,
        c.visibleEdgeColor.g,
        c.visibleEdgeColor.b
      );
      pass.hiddenEdgeColor.setRGB(
        c.hiddenEdgeColor.r,
        c.hiddenEdgeColor.g,
        c.hiddenEdgeColor.b
      );
      pass.edgeThickness = c.edgeThickness;
      pass.edgeStrength = c.edgeStrength;
      pass.edgeGlow = c.edgeGlow;
      pass.pulsePeriod = c.pulsePeriod;

      // Resolve entity references to Object3D
      pass.selectedObjects = c.selectedObjects
        .map((entity) => manager.getObject3DForEntity(entity, commands))
        .filter((obj): obj is THREE.Object3D => obj !== null);

      return pass;
    }

    // ========== Depth of Field ==========
    case "bokeh": {
      const c = config as BokehConfig;
      return new BokehPass(scene, camera, {
        focus: c.focus,
        aperture: c.aperture,
        maxblur: c.maxblur,
      });
    }

    // ========== Color / Film Effects ==========
    case "film": {
      const c = config as FilmConfig;
      return new FilmPass(c.intensity);
    }

    case "vignette": {
      const c = config as VignetteConfig;
      const pass = new ShaderPass(VignetteShader);
      if (pass.uniforms["offset"]) pass.uniforms["offset"].value = c.offset;
      if (pass.uniforms["darkness"]) pass.uniforms["darkness"].value = c.darkness;
      return pass;
    }

    case "sepia": {
      const c = config as SepiaConfig;
      const pass = new ShaderPass(SepiaShader);
      if (pass.uniforms["amount"]) pass.uniforms["amount"].value = c.amount;
      return pass;
    }

    case "brightnessContrast": {
      const c = config as BrightnessContrastConfig;
      const pass = new ShaderPass(BrightnessContrastShader);
      if (pass.uniforms["brightness"]) pass.uniforms["brightness"].value = c.brightness;
      if (pass.uniforms["contrast"]) pass.uniforms["contrast"].value = c.contrast;
      return pass;
    }

    case "hueSaturation": {
      const c = config as HueSaturationConfig;
      const pass = new ShaderPass(HueSaturationShader);
      if (pass.uniforms["hue"]) pass.uniforms["hue"].value = c.hue;
      if (pass.uniforms["saturation"]) pass.uniforms["saturation"].value = c.saturation;
      return pass;
    }

    case "colorCorrection": {
      const c = config as ColorCorrectionConfig;
      const pass = new ShaderPass(ColorCorrectionShader);
      if (pass.uniforms["powRGB"]) pass.uniforms["powRGB"].value.set(c.powRGB.r, c.powRGB.g, c.powRGB.b);
      if (pass.uniforms["mulRGB"]) pass.uniforms["mulRGB"].value.set(c.mulRGB.r, c.mulRGB.g, c.mulRGB.b);
      if (pass.uniforms["addRGB"]) pass.uniforms["addRGB"].value.set(c.addRGB.r, c.addRGB.g, c.addRGB.b);
      return pass;
    }

    case "rgbShift": {
      const c = config as RGBShiftConfig;
      const pass = new ShaderPass(RGBShiftShader);
      if (pass.uniforms["amount"]) pass.uniforms["amount"].value = c.amount;
      if (pass.uniforms["angle"]) pass.uniforms["angle"].value = c.angle;
      return pass;
    }

    // ========== Stylized Effects ==========
    case "glitch": {
      const c = config as GlitchConfig;
      const pass = new GlitchPass();
      pass.goWild = c.goWild;
      return pass;
    }

    case "dotScreen": {
      const c = config as DotScreenConfig;
      return new DotScreenPass(undefined, c.angle, c.scale);
    }

    case "pixelate": {
      const c = config as PixelateConfig;
      return new RenderPixelatedPass(c.pixelSize, scene, camera, {
        normalEdgeStrength: c.normalEdgeStrength,
        depthEdgeStrength: c.depthEdgeStrength,
      });
    }

    case "halftone": {
      const c = config as HalftoneConfig;
      const pass = new HalftonePass({
        shape: c.shape,
        radius: c.radius,
        scatter: c.scatter,
        blending: c.blending,
        blendingMode: c.blendingMode,
        greyscale: c.greyscale,
      });
      return pass;
    }

    case "afterimage": {
      const c = config as AfterimageConfig;
      const pass = new AfterimagePass();
      if (pass.uniforms["damp"]) pass.uniforms["damp"].value = c.damp;
      return pass;
    }

    default: {
      console.warn(`[PostProcessing] Unknown effect type: ${type}`);
      return null;
    }
  }
}

/**
 * Update an existing pass with new configuration
 * Returns true if update was successful, false if rebuild is needed
 */
export function updatePass(
  type: EffectType,
  pass: Pass,
  config: EffectConfig,
  scene: THREE.Scene,
  camera: THREE.Camera,
  width: number,
  height: number,
  commands: Command,
  manager: PostProcessingManager
): boolean {
  switch (type) {
    // ========== Anti-Aliasing ==========
    case "fxaa": {
      const p = pass as ShaderPass;
      if (p.uniforms["resolution"]) p.uniforms["resolution"].value.set(1 / width, 1 / height);
      return true;
    }

    case "smaa": {
      // SMAA doesn't have runtime-updateable properties
      return true;
    }

    case "ssaa": {
      const c = config as SSAAConfig;
      const p = pass as SSAARenderPass;
      p.scene = scene;
      p.camera = camera;
      p.sampleLevel = c.sampleLevel;
      p.unbiased = c.unbiased;
      return true;
    }

    case "taa": {
      const c = config as TAAConfig;
      const p = pass as TAARenderPass;
      p.scene = scene;
      p.camera = camera;
      p.sampleLevel = c.sampleLevel;
      p.accumulate = c.accumulate;
      return true;
    }

    // ========== Bloom ==========
    case "bloom": {
      const c = config as BloomConfig;
      const p = pass as UnrealBloomPass;
      p.strength = c.strength;
      p.radius = c.radius;
      p.threshold = c.threshold;
      return true;
    }

    // ========== Ambient Occlusion ==========
    case "ssao": {
      const c = config as SSAOConfig;
      const p = pass as SSAOPass;
      p.scene = scene;
      p.camera = camera;
      p.kernelRadius = c.kernelRadius;
      p.minDistance = c.minDistance;
      p.maxDistance = c.maxDistance;
      const outputMap: Record<SSAOConfig["output"], number> = {
        default: 0,
        ssao: 1,
        blur: 2,
        beauty: 3,
        depth: 4,
        normal: 5,
      };
      p.output = outputMap[c.output];
      return true;
    }

    case "sao": {
      const c = config as SAOConfig;
      const p = pass as SAOPass;
      p.scene = scene;
      p.camera = camera;
      p.params.saoBias = c.saoBias;
      p.params.saoIntensity = c.saoIntensity;
      p.params.saoScale = c.saoScale;
      p.params.saoKernelRadius = c.saoKernelRadius;
      p.params.saoMinResolution = c.saoMinResolution;
      p.params.saoBlur = c.saoBlur;
      p.params.saoBlurRadius = c.saoBlurRadius;
      p.params.saoBlurStdDev = c.saoBlurStdDev;
      p.params.saoBlurDepthCutoff = c.saoBlurDepthCutoff;
      return true;
    }

    case "gtao": {
      const c = config as GTAOConfig;
      const p = pass as GTAOPass;
      p.scene = scene;
      p.camera = camera;
      p.blendIntensity = c.blendIntensity;
      const outputMap: Record<GTAOConfig["output"], number> = {
        default: 0,
        ao: 1,
        denoise: 2,
        depth: 3,
        normal: 4,
      };
      p.output = outputMap[c.output];
      return true;
    }

    // ========== Outline ==========
    case "outline": {
      const c = config as OutlineConfig;
      const p = pass as OutlinePass;
      p.renderScene = scene;
      p.renderCamera = camera;
      p.visibleEdgeColor.setRGB(
        c.visibleEdgeColor.r,
        c.visibleEdgeColor.g,
        c.visibleEdgeColor.b
      );
      p.hiddenEdgeColor.setRGB(
        c.hiddenEdgeColor.r,
        c.hiddenEdgeColor.g,
        c.hiddenEdgeColor.b
      );
      p.edgeThickness = c.edgeThickness;
      p.edgeStrength = c.edgeStrength;
      p.edgeGlow = c.edgeGlow;
      p.pulsePeriod = c.pulsePeriod;

      // Update selected objects
      p.selectedObjects = c.selectedObjects
        .map((entity) => manager.getObject3DForEntity(entity, commands))
        .filter((obj): obj is THREE.Object3D => obj !== null);

      return true;
    }

    // ========== Depth of Field ==========
    case "bokeh": {
      const c = config as BokehConfig;
      const p = pass as BokehPass;
      const uniforms = p.uniforms as Record<string, { value: unknown }>;
      if (uniforms["focus"]) uniforms["focus"].value = c.focus;
      if (uniforms["aperture"]) uniforms["aperture"].value = c.aperture;
      if (uniforms["maxblur"]) uniforms["maxblur"].value = c.maxblur;
      return true;
    }

    // ========== Color / Film Effects ==========
    case "film": {
      const c = config as FilmConfig;
      const p = pass as FilmPass;
      const uniforms = p.uniforms as Record<string, { value: unknown }>;
      if (uniforms["intensity"]) uniforms["intensity"].value = c.intensity;
      return true;
    }

    case "vignette": {
      const c = config as VignetteConfig;
      const p = pass as ShaderPass;
      if (p.uniforms["offset"]) p.uniforms["offset"].value = c.offset;
      if (p.uniforms["darkness"]) p.uniforms["darkness"].value = c.darkness;
      return true;
    }

    case "sepia": {
      const c = config as SepiaConfig;
      const p = pass as ShaderPass;
      if (p.uniforms["amount"]) p.uniforms["amount"].value = c.amount;
      return true;
    }

    case "brightnessContrast": {
      const c = config as BrightnessContrastConfig;
      const p = pass as ShaderPass;
      if (p.uniforms["brightness"]) p.uniforms["brightness"].value = c.brightness;
      if (p.uniforms["contrast"]) p.uniforms["contrast"].value = c.contrast;
      return true;
    }

    case "hueSaturation": {
      const c = config as HueSaturationConfig;
      const p = pass as ShaderPass;
      if (p.uniforms["hue"]) p.uniforms["hue"].value = c.hue;
      if (p.uniforms["saturation"]) p.uniforms["saturation"].value = c.saturation;
      return true;
    }

    case "colorCorrection": {
      const c = config as ColorCorrectionConfig;
      const p = pass as ShaderPass;
      if (p.uniforms["powRGB"]) p.uniforms["powRGB"].value.set(c.powRGB.r, c.powRGB.g, c.powRGB.b);
      if (p.uniforms["mulRGB"]) p.uniforms["mulRGB"].value.set(c.mulRGB.r, c.mulRGB.g, c.mulRGB.b);
      if (p.uniforms["addRGB"]) p.uniforms["addRGB"].value.set(c.addRGB.r, c.addRGB.g, c.addRGB.b);
      return true;
    }

    case "rgbShift": {
      const c = config as RGBShiftConfig;
      const p = pass as ShaderPass;
      if (p.uniforms["amount"]) p.uniforms["amount"].value = c.amount;
      if (p.uniforms["angle"]) p.uniforms["angle"].value = c.angle;
      return true;
    }

    // ========== Stylized Effects ==========
    case "glitch": {
      const c = config as GlitchConfig;
      const p = pass as GlitchPass;
      p.goWild = c.goWild;
      return true;
    }

    case "dotScreen": {
      const c = config as DotScreenConfig;
      const p = pass as DotScreenPass;
      const uniforms = p.uniforms as Record<string, { value: unknown }>;
      if (uniforms["scale"]) uniforms["scale"].value = c.scale;
      if (uniforms["angle"]) uniforms["angle"].value = c.angle;
      return true;
    }

    case "pixelate": {
      const c = config as PixelateConfig;
      const p = pass as RenderPixelatedPass;
      p.setPixelSize(c.pixelSize);
      p.normalEdgeStrength = c.normalEdgeStrength;
      p.depthEdgeStrength = c.depthEdgeStrength;
      return true;
    }

    case "halftone": {
      const c = config as HalftoneConfig;
      const p = pass as HalftonePass;
      const uniforms = p.uniforms as Record<string, { value: unknown }>;
      if (uniforms["shape"]) uniforms["shape"].value = c.shape;
      if (uniforms["radius"]) uniforms["radius"].value = c.radius;
      if (uniforms["scatter"]) uniforms["scatter"].value = c.scatter;
      if (uniforms["blending"]) uniforms["blending"].value = c.blending;
      if (uniforms["blendingMode"]) uniforms["blendingMode"].value = c.blendingMode;
      if (uniforms["greyscale"]) uniforms["greyscale"].value = c.greyscale ? 1 : 0;
      return true;
    }

    case "afterimage": {
      const c = config as AfterimageConfig;
      const p = pass as AfterimagePass;
      if (p.uniforms["damp"]) p.uniforms["damp"].value = c.damp;
      return true;
    }

    default:
      return false;
  }
}

/**
 * Dispose a pass and free its resources
 */
export function disposePass(pass: Pass): void {
  if ("dispose" in pass && typeof pass.dispose === "function") {
    pass.dispose();
  }
}
