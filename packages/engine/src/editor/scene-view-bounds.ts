/**
 * SceneViewBounds Resource
 *
 * Stores the bounds of the Scene View panel for TransformControls mouse handling.
 *
 * Uses min-tracking: tracks the minimum mouse canvas position seen while hovering
 * the Scene View image, which approximates the image's top-left corner.
 *
 * This approach is necessary because jsimgui doesn't support GetCursorScreenPos()
 * or GetWindowPos() which would be needed for direct computation.
 *
 * Updated by EditorLayer when Scene View is rendered.
 */

export class SceneViewBounds {
  /** Scene View left edge (canvas coordinates) - best estimate */
  x = 0;

  /** Scene View top edge (canvas coordinates) - best estimate */
  y = 0;

  /** Scene View width */
  width = 0;

  /** Scene View height */
  height = 0;

  /** Whether bounds have been calibrated (user has hovered the Scene View) */
  private calibrated = false;

  /** Last known image position in window */
  private lastImgPosInWindowX = 0;
  private lastImgPosInWindowY = 0;
  /** Tracks if we've done initial calibration */
  private initialCalibrationDone = false;

  // Track last mouse position for edge detection
  private lastMouseCanvasX = 0;
  private lastMouseCanvasY = 0;
  private wasHovering = false;

  // Dual-bound tracking for X: converges from both directions
  // When mouse is at position M inside image of width W:
  //   imageLeft must be in range [M - W, M]
  // By tracking both bounds, we converge quickly regardless of where user enters
  private xMinBound = -Infinity;  // Lower bound for image left edge
  private xMaxBound = Infinity;   // Upper bound for image left edge

  // Y uses single-direction tracking with known minimum
  private yMinPossible = 0;  // Minimum possible Y from layout

  /**
   * Update bounds using edge-detection calibration.
   *
   * When the mouse enters the image from an edge, we can determine that edge's
   * canvas position exactly. By tracking entry from all four edges over time,
   * we get accurate bounds.
   *
   * Additionally, we use min-tracking to refine the top-left corner position.
   *
   * @param mouseCanvasX - Mouse X in canvas coordinates
   * @param mouseCanvasY - Mouse Y in canvas coordinates
   * @param imgPosInWindowX - Image X position within window (window-local)
   * @param imgPosInWindowY - Image Y position within window (window-local)
   * @param contentWidth - Image width
   * @param contentHeight - Image height
   */
  updateFromHover(
    mouseCanvasX: number,
    mouseCanvasY: number,
    imgPosInWindowX: number,
    imgPosInWindowY: number,
    contentWidth: number,
    contentHeight: number,
    minPossibleY: number = 0,  // Minimum possible Y (toolbar + title bar height)
  ): void {
    this.width = contentWidth;
    this.height = contentHeight;

    // Store imgPosInWindow for reference
    this.lastImgPosInWindowX = imgPosInWindowX;
    this.lastImgPosInWindowY = imgPosInWindowY;

    // Store minimum possible Y for Y tracking
    this.yMinPossible = minPossibleY;

    // DUAL-BOUND TRACKING FOR X:
    //
    // When mouse at position M is inside an image of width W:
    //   M - W < imageLeft <= M
    //
    // We maintain both bounds and use a weighted estimate.
    // Initially, we assume the mouse is near the center of the image.
    // As bounds narrow (user moves around), we converge to the true value.
    //
    // Update bounds: narrow the range based on current mouse position
    const newXMinBound = mouseCanvasX - contentWidth;  // Image left must be > this
    const newXMaxBound = mouseCanvasX;                  // Image left must be <= this

    if (newXMinBound > this.xMinBound) {
      this.xMinBound = newXMinBound;
    }
    if (newXMaxBound < this.xMaxBound) {
      this.xMaxBound = newXMaxBound;
    }

    // Compute X estimate using weighted approach:
    // - If bounds are wide (initial state), assume mouse is near center of image
    // - As bounds narrow, use the midpoint
    const boundsWidth = this.xMaxBound - this.xMinBound;

    if (boundsWidth > contentWidth * 0.5) {
      // Bounds are still wide - use center-weighted estimate
      // Assume mouse is roughly at center of image
      this.x = mouseCanvasX - contentWidth / 2;
      // But clamp to known bounds
      this.x = Math.max(this.xMinBound, Math.min(this.xMaxBound, this.x));
    } else {
      // Bounds have narrowed - use midpoint
      this.x = (this.xMinBound + this.xMaxBound) / 2;
    }

    // EDGE DETECTION FOR PRECISE CALIBRATION:
    // When entering from an edge, we can determine that edge's position exactly.
    if (!this.wasHovering && this.initialCalibrationDone) {
      const deltaX = mouseCanvasX - this.lastMouseCanvasX;
      const deltaY = mouseCanvasY - this.lastMouseCanvasY;

      // If moving right and entered, we likely crossed left edge
      if (Math.abs(deltaX) > Math.abs(deltaY) && deltaX > 2) {
        // The left edge is approximately at lastMouseCanvasX (just outside)
        // Set both bounds to narrow range dramatically
        const edgeX = (this.lastMouseCanvasX + mouseCanvasX) / 2;
        this.xMinBound = edgeX - 1;  // Allow tiny margin
        this.xMaxBound = edgeX + 1;
        this.x = edgeX;
      }
      // If moving down and entered, we likely crossed top edge
      if (Math.abs(deltaY) > Math.abs(deltaX) && deltaY > 2) {
        const edgeY = (this.lastMouseCanvasY + mouseCanvasY) / 2;
        // Only update if this gives a value above minPossibleY
        if (edgeY >= minPossibleY) {
          this.y = edgeY;
        }
      }
    }

    // Y TRACKING:
    // For Y, we use minPossibleY as baseline and only update if we find a LOWER value
    // that's still above minPossibleY, OR a higher value from edge detection.
    if (!this.initialCalibrationDone) {
      // First calibration: start with minPossibleY
      this.y = minPossibleY;
    }
    // Refine Y toward mouse position if it's above current and above minimum
    if (mouseCanvasY < this.y && mouseCanvasY >= minPossibleY) {
      this.y = mouseCanvasY;
    }

    // Store current position for next frame's edge detection
    this.lastMouseCanvasX = mouseCanvasX;
    this.lastMouseCanvasY = mouseCanvasY;
    this.wasHovering = true;

    this.initialCalibrationDone = true;
    this.calibrated = true;
  }

  /**
   * Call when mouse leaves the image area.
   * Preserves calibration but resets hovering state for edge detection.
   */
  onMouseLeave(): void {
    this.wasHovering = false;
  }

  /**
   * Update mouse position while NOT hovering (for edge detection on entry).
   * Call this from EditorLayer when mouse is on canvas but not hovering image.
   */
  updateMousePosition(mouseCanvasX: number, mouseCanvasY: number): void {
    this.lastMouseCanvasX = mouseCanvasX;
    this.lastMouseCanvasY = mouseCanvasY;
  }

  /**
   * @deprecated Use updateFromHover instead
   */
  updateFromCursorDelta(
    mouseCanvasX: number,
    mouseCanvasY: number,
    cursorRelativeX: number,
    cursorRelativeY: number,
    contentWidth: number,
    contentHeight: number,
  ): void {
    this.updateFromHover(mouseCanvasX, mouseCanvasY, cursorRelativeX, cursorRelativeY, contentWidth, contentHeight);
  }

  /**
   * @deprecated Use updateFromCursorDelta instead
   * Legacy method kept for compatibility during transition
   */
  updateFromMouseHover(
    mouseCanvasX: number,
    mouseCanvasY: number,
    contentWidth: number,
    contentHeight: number,
    _titleBarHeight: number = 0,
  ): void {
    // Legacy edge-tracking approach - redirect to just setting size
    // This maintains backward compatibility but won't set x/y correctly
    this.width = contentWidth;
    this.height = contentHeight;
  }

  /**
   * Reset calibration (call when panel might have moved).
   * Resets all tracking state so calibration starts fresh.
   */
  resetCalibration(): void {
    this.calibrated = false;
    this.initialCalibrationDone = false;
    this.wasHovering = false;
    this.x = 0;
    this.y = 0;
    this.xMinBound = -Infinity;
    this.xMaxBound = Infinity;
  }

  /**
   * Get the image position in canvas coordinates.
   * Returns the min-tracked position (x, y).
   */
  private getImageCanvasPos(): { x: number; y: number } {
    return { x: this.x, y: this.y };
  }

  /**
   * Calculate NDC coordinates for a given canvas position.
   */
  calculateNDC(canvasX: number, canvasY: number): { x: number; y: number } | null {
    if (!this.calibrated) {
      return null;
    }

    // Use the computed image position for more accurate NDC calculation
    const imagePos = this.getImageCanvasPos();
    const viewX = canvasX - imagePos.x;
    const viewY = canvasY - imagePos.y;

    const ndcX = (viewX / this.width) * 2 - 1;
    const ndcY = -(viewY / this.height) * 2 + 1;

    return { x: ndcX, y: ndcY };
  }

  /**
   * Set size only (when not hovered, we still know dimensions)
   */
  setSize(width: number, height: number): void {
    this.width = width;
    this.height = height;
  }

  /**
   * Check if bounds have been calibrated
   */
  isCalibrated(): boolean {
    return this.calibrated;
  }

  /**
   * Get the X bounds for debugging
   */
  getXBounds(): { min: number; max: number } {
    return { min: this.xMinBound, max: this.xMaxBound };
  }

  /**
   * Check if a screen coordinate is inside the Scene View bounds
   */
  isInsideBounds(screenX: number, screenY: number): boolean {
    const imagePos = this.getImageCanvasPos();
    return (
      screenX >= imagePos.x &&
      screenX < imagePos.x + this.width &&
      screenY >= imagePos.y &&
      screenY < imagePos.y + this.height
    );
  }

  /**
   * Transform screen coordinates to viewport-relative coordinates
   */
  toViewportCoordinates(
    screenX: number,
    screenY: number,
  ): { x: number; y: number } {
    const imagePos = this.getImageCanvasPos();
    return {
      x: screenX - imagePos.x,
      y: screenY - imagePos.y,
    };
  }
}
