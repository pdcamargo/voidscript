/**
 * UIViewportBounds Resource
 *
 * Stores the bounds of the viewport where UI interactions are valid.
 * In editor mode, this is the Game View panel position.
 * In standalone mode, this is the full canvas.
 *
 * This resource is updated by EditorLayer when the Game View panel is rendered,
 * and read by UIInteractionManager to transform mouse coordinates.
 */

export class UIViewportBounds {
  /** Game View left edge (window coordinates) */
  x = 0;

  /** Game View top edge (window coordinates) */
  y = 0;

  /** Game View width */
  width = 0;

  /** Game View height */
  height = 0;

  /**
   * Set bounds for fullscreen/standalone mode.
   * Uses (0, 0) as origin with the full canvas dimensions.
   */
  setFromFullscreen(canvasWidth: number, canvasHeight: number): void {
    this.x = 0;
    this.y = 0;
    this.width = canvasWidth;
    this.height = canvasHeight;
  }

  /**
   * Set bounds from editor Game View panel position.
   * Used by EditorLayer when rendering the Game View.
   */
  setFromEditorPanel(
    x: number,
    y: number,
    width: number,
    height: number,
  ): void {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
  }

  /**
   * Check if a screen coordinate is inside the viewport bounds.
   */
  isInsideBounds(screenX: number, screenY: number): boolean {
    return (
      screenX >= this.x &&
      screenX < this.x + this.width &&
      screenY >= this.y &&
      screenY < this.y + this.height
    );
  }

  /**
   * Transform screen coordinates to viewport-relative coordinates.
   */
  toViewportCoordinates(
    screenX: number,
    screenY: number,
  ): { x: number; y: number } {
    return {
      x: screenX - this.x,
      y: screenY - this.y,
    };
  }
}
