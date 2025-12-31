/**
 * Link Renderer
 *
 * Renders connections between nodes using straight lines.
 * Since we don't have ImDrawList, we use thin colored buttons to draw lines.
 */

import { ImGui } from '@mori2003/jsimgui';
import type { NodeEditorState } from './node-editor-state.js';
import type { LinkState, Vec2 } from './node-editor-types.js';
import type { CanvasContext } from './node-editor-canvas.js';

// ============================================================================
// Link Rendering
// ============================================================================

export interface LinkRenderResult {
  /** Link that was clicked */
  clickedLink: LinkState | null;
  /** Link that is being hovered */
  hoveredLink: LinkState | null;
}

/**
 * Render a single link as a straight line
 */
export function renderLink(
  state: NodeEditorState,
  link: LinkState,
  context: CanvasContext,
): { clicked: boolean; hovered: boolean } {
  const config = state.config;

  // Convert positions to screen space
  const startScreen = {
    x: (link.sourcePosition.x - context.scrollOffset.x) * context.zoom,
    y: (link.sourcePosition.y - context.scrollOffset.y) * context.zoom,
  };
  const endScreen = {
    x: (link.targetPosition.x - context.scrollOffset.x) * context.zoom,
    y: (link.targetPosition.y - context.scrollOffset.y) * context.zoom,
  };

  // Determine link color
  let linkColor = link.color || config.linkColor;
  if (link.isSelected) {
    linkColor = config.selectionColor;
  } else if (link.isHovered) {
    linkColor = {
      r: linkColor.r * 1.3,
      g: linkColor.g * 1.3,
      b: linkColor.b * 1.3,
      a: linkColor.a,
    };
  }

  // Draw the line using multiple segments
  const result = renderStraightLine(
    startScreen,
    endScreen,
    linkColor,
    link.isSelected ? 3 : 2,
    `link_${link.id}`,
  );

  // Draw arrow head at the end
  renderArrowHead(endScreen, startScreen, linkColor, context.zoom);

  return result;
}

/**
 * Render a straight line between two points using small overlapping squares.
 * This creates a smoother appearance by using many small squares along the line.
 */
function renderStraightLine(
  start: Vec2,
  end: Vec2,
  color: { r: number; g: number; b: number; a: number },
  thickness: number,
  id: string,
): { clicked: boolean; hovered: boolean } {
  // Calculate line properties
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.sqrt(dx * dx + dy * dy);

  if (length < 1) {
    return { clicked: false, hovered: false };
  }

  let clicked = false;
  let hovered = false;

  ImGui.PushStyleColorImVec4(ImGui.Col.Button, {
    x: color.r,
    y: color.g,
    z: color.b,
    w: color.a,
  });
  ImGui.PushStyleColorImVec4(ImGui.Col.ButtonHovered, {
    x: color.r * 1.2,
    y: color.g * 1.2,
    z: color.b * 1.2,
    w: color.a,
  });
  ImGui.PushStyleColorImVec4(ImGui.Col.ButtonActive, {
    x: color.r * 0.8,
    y: color.g * 0.8,
    z: color.b * 0.8,
    w: color.a,
  });

  // Use small overlapping squares along the line
  // The step size determines smoothness - smaller = smoother but more draw calls
  const stepSize = Math.max(thickness * 0.5, 1);
  const numSteps = Math.ceil(length / stepSize);
  const squareSize = thickness + 1; // Slightly larger to ensure overlap

  // Draw small squares along the line
  for (let i = 0; i <= numSteps; i++) {
    const t = i / numSteps;
    const posX = start.x + dx * t;
    const posY = start.y + dy * t;

    // Center the square on the line point
    const buttonX = posX - squareSize / 2;
    const buttonY = posY - squareSize / 2;

    ImGui.SetCursorPos({ x: buttonX, y: buttonY });

    if (ImGui.Button(`##${id}_${i}`, { x: squareSize, y: squareSize })) {
      clicked = true;
    }
    if (ImGui.IsItemHovered()) {
      hovered = true;
    }
  }

  ImGui.PopStyleColor(3);

  return { clicked, hovered };
}

/**
 * Render an arrow head at the end of a link
 */
function renderArrowHead(
  tipPos: Vec2,
  fromPos: Vec2,
  color: { r: number; g: number; b: number; a: number },
  zoom: number,
): void {
  const arrowSize = 8 * zoom;

  // Calculate direction
  const dx = tipPos.x - fromPos.x;
  const dy = tipPos.y - fromPos.y;
  const length = Math.sqrt(dx * dx + dy * dy);

  if (length < 1) return;

  const nx = dx / length;
  const ny = dy / length;

  // Arrow head points (simple triangle using two buttons)
  const backX = tipPos.x - nx * arrowSize;
  const backY = tipPos.y - ny * arrowSize;

  // Perpendicular direction
  const px = -ny;
  const py = nx;

  const halfWidth = arrowSize * 0.5;

  // Left wing
  const leftX = backX + px * halfWidth;
  const leftY = backY + py * halfWidth;

  // Right wing
  const rightX = backX - px * halfWidth;
  const rightY = backY - py * halfWidth;

  ImGui.PushStyleColorImVec4(ImGui.Col.Button, {
    x: color.r,
    y: color.g,
    z: color.b,
    w: color.a,
  });
  ImGui.PushStyleColorImVec4(ImGui.Col.ButtonHovered, {
    x: color.r,
    y: color.g,
    z: color.b,
    w: color.a,
  });
  ImGui.PushStyleColorImVec4(ImGui.Col.ButtonActive, {
    x: color.r,
    y: color.g,
    z: color.b,
    w: color.a,
  });

  // Draw arrow as a small filled area
  // Using two diagonal buttons to approximate the triangle
  const minX = Math.min(tipPos.x, leftX, rightX);
  const maxX = Math.max(tipPos.x, leftX, rightX);
  const minY = Math.min(tipPos.y, leftY, rightY);
  const maxY = Math.max(tipPos.y, leftY, rightY);

  ImGui.SetCursorPos({ x: minX, y: minY });
  ImGui.PushStyleVar(ImGui.StyleVar.FrameRounding, 0);
  ImGui.Button('##arrow', { x: maxX - minX, y: maxY - minY });
  ImGui.PopStyleVar();

  ImGui.PopStyleColor(3);
}

/**
 * Render the temporary link being created
 */
export function renderLinkCreation(
  state: NodeEditorState,
  context: CanvasContext,
): void {
  const config = state.config;

  // Handle pin-less mode (node-to-node link creation)
  if (state.nodeLinkCreationState) {
    const sourceNode = state.nodes.get(state.nodeLinkCreationState.sourceNodeId);
    if (!sourceNode) return;

    // Get source position (center of node) in screen space
    const sourceCenter = {
      x: sourceNode.position.x + sourceNode.size.width / 2,
      y: sourceNode.position.y + sourceNode.size.height / 2,
    };
    const startScreen = {
      x: (sourceCenter.x - context.scrollOffset.x) * context.zoom,
      y: (sourceCenter.y - context.scrollOffset.y) * context.zoom,
    };

    // Get target position (mouse or target node center)
    let endScreen: { x: number; y: number };
    if (state.nodeLinkCreationState.targetNodeId && state.nodeLinkCreationState.canConnect) {
      const targetNode = state.nodes.get(state.nodeLinkCreationState.targetNodeId);
      if (targetNode) {
        const targetCenter = {
          x: targetNode.position.x + targetNode.size.width / 2,
          y: targetNode.position.y + targetNode.size.height / 2,
        };
        endScreen = {
          x: (targetCenter.x - context.scrollOffset.x) * context.zoom,
          y: (targetCenter.y - context.scrollOffset.y) * context.zoom,
        };
      } else {
        const targetPos = state.nodeLinkCreationState.currentPosition;
        endScreen = {
          x: (targetPos.x - context.scrollOffset.x) * context.zoom,
          y: (targetPos.y - context.scrollOffset.y) * context.zoom,
        };
      }
    } else {
      const targetPos = state.nodeLinkCreationState.currentPosition;
      endScreen = {
        x: (targetPos.x - context.scrollOffset.x) * context.zoom,
        y: (targetPos.y - context.scrollOffset.y) * context.zoom,
      };
    }

    // Color based on whether connection is valid
    const color = state.nodeLinkCreationState.canConnect
      ? config.linkCreationColor
      : { r: 0.8, g: 0.3, b: 0.3, a: 0.8 };

    // Draw the temporary line
    renderStraightLine(startScreen, endScreen, color, 2, 'nodeLinkCreation');
    return;
  }

  // Standard pin mode
  if (!state.linkCreationState) return;

  const sourcePin = state.linkCreationState.sourcePin;

  // Get source position in screen space
  const startScreen = {
    x: (sourcePin.position.x - context.scrollOffset.x) * context.zoom,
    y: (sourcePin.position.y - context.scrollOffset.y) * context.zoom,
  };

  // Get target position in screen space
  const targetPos = state.linkCreationState.currentPosition;
  const endScreen = {
    x: (targetPos.x - context.scrollOffset.x) * context.zoom,
    y: (targetPos.y - context.scrollOffset.y) * context.zoom,
  };

  // Color based on whether connection is valid
  const color = state.linkCreationState.canConnect
    ? config.linkCreationColor
    : { r: 0.8, g: 0.3, b: 0.3, a: 0.8 };

  // Draw the temporary line
  renderStraightLine(startScreen, endScreen, color, 2, 'linkCreation');
}

/**
 * Render all links in the editor
 */
export function renderAllLinks(
  state: NodeEditorState,
  context: CanvasContext,
): LinkRenderResult {
  const result: LinkRenderResult = {
    clickedLink: null,
    hoveredLink: null,
  };

  // Render normal links first, selected links on top
  const sortedLinks = Array.from(state.links.values()).sort((a, b) => {
    if (a.isSelected && !b.isSelected) return 1;
    if (!a.isSelected && b.isSelected) return -1;
    return 0;
  });

  for (const link of sortedLinks) {
    const linkResult = renderLink(state, link, context);

    if (linkResult.clicked) {
      result.clickedLink = link;
    }
    if (linkResult.hovered) {
      result.hoveredLink = link;
      link.isHovered = true;
    } else {
      link.isHovered = false;
    }
  }

  // Render link being created
  renderLinkCreation(state, context);

  return result;
}

// ============================================================================
// Utility: Distance from point to line segment
// ============================================================================

/**
 * Calculate the distance from a point to a line segment
 * Useful for hit testing links
 */
export function distanceToLineSegment(
  point: Vec2,
  lineStart: Vec2,
  lineEnd: Vec2,
): number {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;
  const lengthSq = dx * dx + dy * dy;

  if (lengthSq === 0) {
    // Line segment is a point
    return Math.sqrt(
      (point.x - lineStart.x) ** 2 + (point.y - lineStart.y) ** 2,
    );
  }

  // Project point onto line
  const t = Math.max(
    0,
    Math.min(
      1,
      ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / lengthSq,
    ),
  );

  const projX = lineStart.x + t * dx;
  const projY = lineStart.y + t * dy;

  return Math.sqrt((point.x - projX) ** 2 + (point.y - projY) ** 2);
}

/**
 * Check if a point is near a link (for hit testing)
 */
export function isPointNearLink(
  point: Vec2,
  link: LinkState,
  threshold: number,
): boolean {
  return (
    distanceToLineSegment(point, link.sourcePosition, link.targetPosition) <=
    threshold
  );
}
