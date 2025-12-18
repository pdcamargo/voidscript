/**
 * Collider Geometry Factory Functions
 *
 * Creates LineSegmentsGeometry for visualizing different collider shapes in the editor.
 * All geometries are designed to be used with LineSegments2 for wireframe rendering.
 */

import * as THREE from 'three';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';

/**
 * Create wireframe geometry for a 3D cuboid (box)
 */
export function createCuboidWireframe(
  halfWidth: number,
  halfHeight: number,
  halfDepth: number
): LineSegmentsGeometry {
  const positions = [
    // Bottom face
    -halfWidth, -halfHeight, -halfDepth,
    halfWidth, -halfHeight, -halfDepth,

    halfWidth, -halfHeight, -halfDepth,
    halfWidth, -halfHeight, halfDepth,

    halfWidth, -halfHeight, halfDepth,
    -halfWidth, -halfHeight, halfDepth,

    -halfWidth, -halfHeight, halfDepth,
    -halfWidth, -halfHeight, -halfDepth,

    // Top face
    -halfWidth, halfHeight, -halfDepth,
    halfWidth, halfHeight, -halfDepth,

    halfWidth, halfHeight, -halfDepth,
    halfWidth, halfHeight, halfDepth,

    halfWidth, halfHeight, halfDepth,
    -halfWidth, halfHeight, halfDepth,

    -halfWidth, halfHeight, halfDepth,
    -halfWidth, halfHeight, -halfDepth,

    // Vertical edges
    -halfWidth, -halfHeight, -halfDepth,
    -halfWidth, halfHeight, -halfDepth,

    halfWidth, -halfHeight, -halfDepth,
    halfWidth, halfHeight, -halfDepth,

    halfWidth, -halfHeight, halfDepth,
    halfWidth, halfHeight, halfDepth,

    -halfWidth, -halfHeight, halfDepth,
    -halfWidth, halfHeight, halfDepth,
  ];

  const geometry = new LineSegmentsGeometry();
  geometry.setPositions(positions);
  return geometry;
}

/**
 * Create wireframe geometry for a 2D cuboid (rectangle in XY plane)
 */
export function createCuboid2DWireframe(
  halfWidth: number,
  halfHeight: number
): LineSegmentsGeometry {
  const positions = [
    // Rectangle outline (8 vertices for 4 line segments)
    -halfWidth, -halfHeight, 0,
    halfWidth, -halfHeight, 0,

    halfWidth, -halfHeight, 0,
    halfWidth, halfHeight, 0,

    halfWidth, halfHeight, 0,
    -halfWidth, halfHeight, 0,

    -halfWidth, halfHeight, 0,
    -halfWidth, -halfHeight, 0,
  ];

  const geometry = new LineSegmentsGeometry();
  geometry.setPositions(positions);
  return geometry;
}

/**
 * Create wireframe geometry for a 3D sphere
 */
export function createSphereWireframe(
  radius: number,
  segments: number = 16
): LineSegmentsGeometry {
  const positions: number[] = [];

  // Create three orthogonal circles (XY, XZ, YZ planes)
  const addCircle = (
    getX: (t: number) => number,
    getY: (t: number) => number,
    getZ: (t: number) => number
  ) => {
    for (let i = 0; i <= segments; i++) {
      const t1 = (i / segments) * Math.PI * 2;
      const t2 = ((i + 1) / segments) * Math.PI * 2;

      positions.push(getX(t1), getY(t1), getZ(t1));
      positions.push(getX(t2), getY(t2), getZ(t2));
    }
  };

  // XY plane circle
  addCircle(
    (t) => radius * Math.cos(t),
    (t) => radius * Math.sin(t),
    () => 0
  );

  // XZ plane circle
  addCircle(
    (t) => radius * Math.cos(t),
    () => 0,
    (t) => radius * Math.sin(t)
  );

  // YZ plane circle
  addCircle(
    () => 0,
    (t) => radius * Math.cos(t),
    (t) => radius * Math.sin(t)
  );

  const geometry = new LineSegmentsGeometry();
  geometry.setPositions(positions);
  return geometry;
}

/**
 * Create wireframe geometry for a 2D circle (in XY plane)
 */
export function createCircleWireframe(
  radius: number,
  segments: number = 32
): LineSegmentsGeometry {
  const positions: number[] = [];

  for (let i = 0; i <= segments; i++) {
    const t1 = (i / segments) * Math.PI * 2;
    const t2 = ((i + 1) / segments) * Math.PI * 2;

    const x1 = radius * Math.cos(t1);
    const y1 = radius * Math.sin(t1);
    const x2 = radius * Math.cos(t2);
    const y2 = radius * Math.sin(t2);

    positions.push(x1, y1, 0);
    positions.push(x2, y2, 0);
  }

  const geometry = new LineSegmentsGeometry();
  geometry.setPositions(positions);
  return geometry;
}

/**
 * Create wireframe geometry for a 3D capsule (cylinder with hemisphere caps)
 */
export function createCapsuleWireframe(
  halfHeight: number,
  radius: number,
  segments: number = 16
): LineSegmentsGeometry {
  const positions: number[] = [];

  // Vertical edge lines (4 lines connecting top and bottom hemispheres)
  const numVerticalLines = 4;
  for (let i = 0; i < numVerticalLines; i++) {
    const angle = (i / numVerticalLines) * Math.PI * 2;
    const x = radius * Math.cos(angle);
    const z = radius * Math.sin(angle);

    positions.push(x, halfHeight, z);
    positions.push(x, -halfHeight, z);
  }

  // Top and bottom circles
  for (let i = 0; i <= segments; i++) {
    const t1 = (i / segments) * Math.PI * 2;
    const t2 = ((i + 1) / segments) * Math.PI * 2;

    const x1 = radius * Math.cos(t1);
    const z1 = radius * Math.sin(t1);
    const x2 = radius * Math.cos(t2);
    const z2 = radius * Math.sin(t2);

    // Top circle
    positions.push(x1, halfHeight, z1);
    positions.push(x2, halfHeight, z2);

    // Bottom circle
    positions.push(x1, -halfHeight, z1);
    positions.push(x2, -halfHeight, z2);
  }

  // Hemisphere arcs (simplified - show quarter circles on 4 sides)
  const numArcs = 4;
  for (let i = 0; i < numArcs; i++) {
    const angle = (i / numArcs) * Math.PI * 2;
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);

    // Top hemisphere arc
    for (let j = 0; j < segments / 4; j++) {
      const t1 = (j / (segments / 4)) * (Math.PI / 2);
      const t2 = ((j + 1) / (segments / 4)) * (Math.PI / 2);

      const y1 = halfHeight + radius * Math.sin(t1);
      const r1 = radius * Math.cos(t1);
      const y2 = halfHeight + radius * Math.sin(t2);
      const r2 = radius * Math.cos(t2);

      positions.push(r1 * cosA, y1, r1 * sinA);
      positions.push(r2 * cosA, y2, r2 * sinA);

      // Bottom hemisphere arc
      positions.push(r1 * cosA, -y1, r1 * sinA);
      positions.push(r2 * cosA, -y2, r2 * sinA);
    }
  }

  const geometry = new LineSegmentsGeometry();
  geometry.setPositions(positions);
  return geometry;
}

/**
 * Create wireframe geometry for a 2D capsule (rounded rectangle in XY plane)
 */
export function createCapsule2DWireframe(
  halfHeight: number,
  radius: number,
  segments: number = 16
): LineSegmentsGeometry {
  const positions: number[] = [];

  // Left and right straight edges
  positions.push(-radius, -halfHeight, 0);
  positions.push(-radius, halfHeight, 0);

  positions.push(radius, -halfHeight, 0);
  positions.push(radius, halfHeight, 0);

  // Top semicircle
  for (let i = 0; i <= segments / 2; i++) {
    const t1 = (i / (segments / 2)) * Math.PI;
    const t2 = ((i + 1) / (segments / 2)) * Math.PI;

    const x1 = radius * Math.cos(t1);
    const y1 = halfHeight + radius * Math.sin(t1);
    const x2 = radius * Math.cos(t2);
    const y2 = halfHeight + radius * Math.sin(t2);

    positions.push(x1, y1, 0);
    positions.push(x2, y2, 0);
  }

  // Bottom semicircle
  for (let i = 0; i <= segments / 2; i++) {
    const t1 = (i / (segments / 2)) * Math.PI + Math.PI;
    const t2 = ((i + 1) / (segments / 2)) * Math.PI + Math.PI;

    const x1 = radius * Math.cos(t1);
    const y1 = -halfHeight + radius * Math.sin(t1);
    const x2 = radius * Math.cos(t2);
    const y2 = -halfHeight + radius * Math.sin(t2);

    positions.push(x1, y1, 0);
    positions.push(x2, y2, 0);
  }

  const geometry = new LineSegmentsGeometry();
  geometry.setPositions(positions);
  return geometry;
}

/**
 * Create wireframe geometry for a 3D cylinder
 */
export function createCylinderWireframe(
  halfHeight: number,
  radius: number,
  segments: number = 16
): LineSegmentsGeometry {
  const positions: number[] = [];

  // Vertical edge lines
  const numVerticalLines = 4;
  for (let i = 0; i < numVerticalLines; i++) {
    const angle = (i / numVerticalLines) * Math.PI * 2;
    const x = radius * Math.cos(angle);
    const z = radius * Math.sin(angle);

    positions.push(x, halfHeight, z);
    positions.push(x, -halfHeight, z);
  }

  // Top and bottom circles
  for (let i = 0; i <= segments; i++) {
    const t1 = (i / segments) * Math.PI * 2;
    const t2 = ((i + 1) / segments) * Math.PI * 2;

    const x1 = radius * Math.cos(t1);
    const z1 = radius * Math.sin(t1);
    const x2 = radius * Math.cos(t2);
    const z2 = radius * Math.sin(t2);

    // Top circle
    positions.push(x1, halfHeight, z1);
    positions.push(x2, halfHeight, z2);

    // Bottom circle
    positions.push(x1, -halfHeight, z1);
    positions.push(x2, -halfHeight, z2);
  }

  const geometry = new LineSegmentsGeometry();
  geometry.setPositions(positions);
  return geometry;
}

/**
 * Create wireframe geometry for a 3D cone
 */
export function createConeWireframe(
  halfHeight: number,
  radius: number,
  segments: number = 16
): LineSegmentsGeometry {
  const positions: number[] = [];

  // Bottom circle
  for (let i = 0; i <= segments; i++) {
    const t1 = (i / segments) * Math.PI * 2;
    const t2 = ((i + 1) / segments) * Math.PI * 2;

    const x1 = radius * Math.cos(t1);
    const z1 = radius * Math.sin(t1);
    const x2 = radius * Math.cos(t2);
    const z2 = radius * Math.sin(t2);

    positions.push(x1, -halfHeight, z1);
    positions.push(x2, -halfHeight, z2);
  }

  // Lines from apex to base (4 lines evenly distributed)
  const numApexLines = 4;
  for (let i = 0; i < numApexLines; i++) {
    const angle = (i / numApexLines) * Math.PI * 2;
    const x = radius * Math.cos(angle);
    const z = radius * Math.sin(angle);

    positions.push(0, halfHeight, 0);
    positions.push(x, -halfHeight, z);
  }

  const geometry = new LineSegmentsGeometry();
  geometry.setPositions(positions);
  return geometry;
}
