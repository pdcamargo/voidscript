/**
 * TextRenderer - Canvas-based text rendering utilities
 *
 * Provides utilities for creating text textures and sprites using HTML5 Canvas.
 * Useful for UI elements, labels, damage numbers, etc.
 *
 * Features:
 * - Configurable font, size, color, alignment
 * - Outline/stroke support
 * - Shadow support
 * - Automatic size calculation
 * - Three.js texture and sprite creation
 */

import * as THREE from 'three';

/**
 * Text alignment options
 */
export type TextAlign = 'left' | 'center' | 'right';

/**
 * Text baseline options
 */
export type TextBaseline = 'top' | 'middle' | 'bottom';

/**
 * Text rendering options
 */
export interface TextOptions {
  /** Font family (default: 'Arial') */
  fontFamily?: string;

  /** Font size in pixels (default: 32) */
  fontSize?: number;

  /** Font weight (default: 'normal') */
  fontWeight?: 'normal' | 'bold' | '100' | '200' | '300' | '400' | '500' | '600' | '700' | '800' | '900';

  /** Font style (default: 'normal') */
  fontStyle?: 'normal' | 'italic' | 'oblique';

  /** Fill color (default: '#ffffff') */
  fillColor?: string;

  /** Stroke/outline color (default: null - no stroke) */
  strokeColor?: string | null;

  /** Stroke width in pixels (default: 2) */
  strokeWidth?: number;

  /** Text alignment (default: 'center') */
  align?: TextAlign;

  /** Text baseline (default: 'middle') */
  baseline?: TextBaseline;

  /** Shadow color (default: null - no shadow) */
  shadowColor?: string | null;

  /** Shadow blur radius (default: 4) */
  shadowBlur?: number;

  /** Shadow offset X (default: 2) */
  shadowOffsetX?: number;

  /** Shadow offset Y (default: 2) */
  shadowOffsetY?: number;

  /** Padding around text in pixels (default: 4) */
  padding?: number;

  /** Fixed canvas width (auto-calculated if not provided) */
  width?: number;

  /** Fixed canvas height (auto-calculated if not provided) */
  height?: number;

  /** Use power-of-two texture dimensions for better GPU compatibility (default: false) */
  powerOfTwo?: boolean;

  /** Texture filtering mode (default: 'linear') */
  filtering?: 'nearest' | 'linear';
}

/**
 * Result of text measurement
 */
export interface TextMeasurement {
  /** Text width in pixels */
  width: number;
  /** Text height in pixels */
  height: number;
  /** Canvas width (may differ due to padding/power-of-two) */
  canvasWidth: number;
  /** Canvas height (may differ due to padding/power-of-two) */
  canvasHeight: number;
}

/**
 * Default text rendering options
 */
const DEFAULT_OPTIONS: Required<Omit<TextOptions, 'width' | 'height'>> = {
  fontFamily: 'Arial',
  fontSize: 32,
  fontWeight: 'normal',
  fontStyle: 'normal',
  fillColor: '#ffffff',
  strokeColor: null,
  strokeWidth: 2,
  align: 'center',
  baseline: 'middle',
  shadowColor: null,
  shadowBlur: 4,
  shadowOffsetX: 2,
  shadowOffsetY: 2,
  padding: 4,
  powerOfTwo: false,
  filtering: 'linear',
};

/**
 * Shared canvas for text measurement (avoid creating new canvases)
 */
let measureCanvas: HTMLCanvasElement | null = null;
let measureContext: CanvasRenderingContext2D | null = null;

/**
 * Get or create measurement canvas
 */
function getMeasureContext(): CanvasRenderingContext2D {
  if (!measureCanvas || !measureContext) {
    measureCanvas = document.createElement('canvas');
    measureContext = measureCanvas.getContext('2d');
    if (!measureContext) {
      throw new Error('Failed to create 2D context for text measurement');
    }
  }
  return measureContext;
}

/**
 * Round up to the nearest power of two
 */
function nextPowerOfTwo(n: number): number {
  return Math.pow(2, Math.ceil(Math.log2(n)));
}

/**
 * Build CSS font string from options
 */
function buildFontString(options: TextOptions): string {
  const fontStyle = options.fontStyle ?? DEFAULT_OPTIONS.fontStyle;
  const fontWeight = options.fontWeight ?? DEFAULT_OPTIONS.fontWeight;
  const fontSize = options.fontSize ?? DEFAULT_OPTIONS.fontSize;
  const fontFamily = options.fontFamily ?? DEFAULT_OPTIONS.fontFamily;
  return `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}`;
}

/**
 * TextRenderer class - Canvas-based text rendering
 */
export class TextRenderer {
  /**
   * Measure text dimensions without rendering
   */
  static measureText(text: string, options: TextOptions = {}): TextMeasurement {
    const ctx = getMeasureContext();
    const font = buildFontString(options);
    const padding = options.padding ?? DEFAULT_OPTIONS.padding;
    const strokeWidth = options.strokeColor ? (options.strokeWidth ?? DEFAULT_OPTIONS.strokeWidth) : 0;
    const shadowBlur = options.shadowColor ? (options.shadowBlur ?? DEFAULT_OPTIONS.shadowBlur) : 0;
    const shadowOffsetX = options.shadowColor ? Math.abs(options.shadowOffsetX ?? DEFAULT_OPTIONS.shadowOffsetX) : 0;
    const shadowOffsetY = options.shadowColor ? Math.abs(options.shadowOffsetY ?? DEFAULT_OPTIONS.shadowOffsetY) : 0;

    ctx.font = font;
    const metrics = ctx.measureText(text);

    // Calculate text dimensions
    const fontSize = options.fontSize ?? DEFAULT_OPTIONS.fontSize;
    const textWidth = metrics.width;
    const textHeight = fontSize * 1.2; // Approximate line height

    // Calculate canvas dimensions with padding and effects
    const extraWidth = padding * 2 + strokeWidth * 2 + shadowBlur * 2 + shadowOffsetX;
    const extraHeight = padding * 2 + strokeWidth * 2 + shadowBlur * 2 + shadowOffsetY;

    let canvasWidth = options.width ?? Math.ceil(textWidth + extraWidth);
    let canvasHeight = options.height ?? Math.ceil(textHeight + extraHeight);

    // Apply power-of-two if requested
    if (options.powerOfTwo ?? DEFAULT_OPTIONS.powerOfTwo) {
      canvasWidth = nextPowerOfTwo(canvasWidth);
      canvasHeight = nextPowerOfTwo(canvasHeight);
    }

    return {
      width: textWidth,
      height: textHeight,
      canvasWidth,
      canvasHeight,
    };
  }

  /**
   * Create a canvas with rendered text
   */
  static createTextCanvas(text: string, options: TextOptions = {}): HTMLCanvasElement {
    const measurement = TextRenderer.measureText(text, options);
    const canvas = document.createElement('canvas');
    canvas.width = measurement.canvasWidth;
    canvas.height = measurement.canvasHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to create 2D context for text rendering');
    }

    // Apply font
    const font = buildFontString(options);
    ctx.font = font;

    // Calculate text position
    const align = options.align ?? DEFAULT_OPTIONS.align;
    const baseline = options.baseline ?? DEFAULT_OPTIONS.baseline;
    const padding = options.padding ?? DEFAULT_OPTIONS.padding;

    let x: number;
    switch (align) {
      case 'left':
        x = padding;
        ctx.textAlign = 'left';
        break;
      case 'right':
        x = canvas.width - padding;
        ctx.textAlign = 'right';
        break;
      case 'center':
      default:
        x = canvas.width / 2;
        ctx.textAlign = 'center';
        break;
    }

    let y: number;
    switch (baseline) {
      case 'top':
        y = padding + (options.fontSize ?? DEFAULT_OPTIONS.fontSize) * 0.5;
        ctx.textBaseline = 'top';
        break;
      case 'bottom':
        y = canvas.height - padding;
        ctx.textBaseline = 'bottom';
        break;
      case 'middle':
      default:
        y = canvas.height / 2;
        ctx.textBaseline = 'middle';
        break;
    }

    // Apply shadow
    const shadowColor = options.shadowColor ?? DEFAULT_OPTIONS.shadowColor;
    if (shadowColor) {
      ctx.shadowColor = shadowColor;
      ctx.shadowBlur = options.shadowBlur ?? DEFAULT_OPTIONS.shadowBlur;
      ctx.shadowOffsetX = options.shadowOffsetX ?? DEFAULT_OPTIONS.shadowOffsetX;
      ctx.shadowOffsetY = options.shadowOffsetY ?? DEFAULT_OPTIONS.shadowOffsetY;
    }

    // Draw stroke first (if any)
    const strokeColor = options.strokeColor ?? DEFAULT_OPTIONS.strokeColor;
    if (strokeColor) {
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = options.strokeWidth ?? DEFAULT_OPTIONS.strokeWidth;
      ctx.lineJoin = 'round';
      ctx.miterLimit = 2;
      ctx.strokeText(text, x, y);
    }

    // Clear shadow for fill (unless intentional)
    if (shadowColor && !strokeColor) {
      // Keep shadow for fill
    } else {
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
    }

    // Draw fill
    ctx.fillStyle = options.fillColor ?? DEFAULT_OPTIONS.fillColor;
    ctx.fillText(text, x, y);

    return canvas;
  }

  /**
   * Create a Three.js texture from text
   */
  static createTextTexture(text: string, options: TextOptions = {}): THREE.CanvasTexture {
    const canvas = TextRenderer.createTextCanvas(text, options);
    const texture = new THREE.CanvasTexture(canvas);

    // Apply filtering
    const filtering = options.filtering ?? DEFAULT_OPTIONS.filtering;
    if (filtering === 'nearest') {
      texture.minFilter = THREE.NearestFilter;
      texture.magFilter = THREE.NearestFilter;
    } else {
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;
    }

    // Don't generate mipmaps for text (sharper)
    texture.generateMipmaps = false;

    // Mark as needing update
    texture.needsUpdate = true;

    return texture;
  }

  /**
   * Create a Three.js sprite with text
   *
   * @param text - Text to render
   * @param options - Text rendering options
   * @param pixelsPerUnit - Pixels per world unit (default: 100)
   */
  static createTextSprite(
    text: string,
    options: TextOptions = {},
    pixelsPerUnit: number = 100,
  ): THREE.Sprite {
    const texture = TextRenderer.createTextTexture(text, options);
    const measurement = TextRenderer.measureText(text, options);

    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });

    const sprite = new THREE.Sprite(material);

    // Scale sprite based on canvas size and pixels per unit
    sprite.scale.set(
      measurement.canvasWidth / pixelsPerUnit,
      measurement.canvasHeight / pixelsPerUnit,
      1,
    );

    return sprite;
  }

  /**
   * Update an existing sprite's text
   * More efficient than creating a new sprite
   */
  static updateTextSprite(
    sprite: THREE.Sprite,
    text: string,
    options: TextOptions = {},
    pixelsPerUnit: number = 100,
  ): void {
    // Dispose old texture
    const oldTexture = sprite.material.map;
    if (oldTexture) {
      oldTexture.dispose();
    }

    // Create new texture
    const texture = TextRenderer.createTextTexture(text, options);
    const measurement = TextRenderer.measureText(text, options);

    // Update material
    sprite.material.map = texture;
    sprite.material.needsUpdate = true;

    // Update scale
    sprite.scale.set(
      measurement.canvasWidth / pixelsPerUnit,
      measurement.canvasHeight / pixelsPerUnit,
      1,
    );
  }

  /**
   * Create a simple colored sprite (for health bars, backgrounds, etc.)
   */
  static createColorSprite(
    color: number | string,
    width: number,
    height: number,
    pixelsPerUnit: number = 100,
  ): THREE.Sprite {
    const canvas = document.createElement('canvas');
    canvas.width = 4;
    canvas.height = 4;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to create 2D context');
    }

    // Fill with color
    if (typeof color === 'number') {
      const r = (color >> 16) & 0xff;
      const g = (color >> 8) & 0xff;
      const b = color & 0xff;
      ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
    } else {
      ctx.fillStyle = color;
    }
    ctx.fillRect(0, 0, 4, 4);

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.NearestFilter;
    texture.magFilter = THREE.NearestFilter;

    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });

    const sprite = new THREE.Sprite(material);
    sprite.scale.set(width / pixelsPerUnit, height / pixelsPerUnit, 1);

    return sprite;
  }
}
