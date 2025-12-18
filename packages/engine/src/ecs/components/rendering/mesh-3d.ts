/**
 * Mesh3D Component
 *
 * Renders procedural 3D geometry with material properties.
 * Supports 15 primitive geometry types with configurable parameters.
 *
 * IMPORTANT: This component MUST be used with Transform3D component.
 * The renderer sync system will only render entities that have both.
 */

import { component } from "../../component.js";
import { RuntimeAsset } from "../../runtime-asset.js";

// ============================================================================
// Geometry Type Definitions
// ============================================================================

export type GeometryType =
  | "box"
  | "capsule"
  | "circle"
  | "cone"
  | "cylinder"
  | "dodecahedron"
  | "icosahedron"
  | "lathe"
  | "octahedron"
  | "plane"
  | "ring"
  | "sphere"
  | "tetrahedron"
  | "torus"
  | "torusKnot";

export interface BoxGeometryData {
  type: "box";
  width: number;
  height: number;
  depth: number;
  widthSegments: number;
  heightSegments: number;
  depthSegments: number;
}

export interface CapsuleGeometryData {
  type: "capsule";
  radius: number;
  length: number;
  capSegments: number;
  radialSegments: number;
}

export interface CircleGeometryData {
  type: "circle";
  radius: number;
  segments: number;
  thetaStart: number;
  thetaLength: number;
}

export interface ConeGeometryData {
  type: "cone";
  radius: number;
  height: number;
  radialSegments: number;
  heightSegments: number;
  openEnded: boolean;
  thetaStart: number;
  thetaLength: number;
}

export interface CylinderGeometryData {
  type: "cylinder";
  radiusTop: number;
  radiusBottom: number;
  height: number;
  radialSegments: number;
  heightSegments: number;
  openEnded: boolean;
  thetaStart: number;
  thetaLength: number;
}

export interface DodecahedronGeometryData {
  type: "dodecahedron";
  radius: number;
  detail: number;
}

export interface IcosahedronGeometryData {
  type: "icosahedron";
  radius: number;
  detail: number;
}

export interface LatheGeometryData {
  type: "lathe";
  points: Array<{ x: number; y: number }>;
  segments: number;
  phiStart: number;
  phiLength: number;
}

export interface OctahedronGeometryData {
  type: "octahedron";
  radius: number;
  detail: number;
}

export interface PlaneGeometryData {
  type: "plane";
  width: number;
  height: number;
  widthSegments: number;
  heightSegments: number;
}

export interface RingGeometryData {
  type: "ring";
  innerRadius: number;
  outerRadius: number;
  thetaSegments: number;
  phiSegments: number;
  thetaStart: number;
  thetaLength: number;
}

export interface SphereGeometryData {
  type: "sphere";
  radius: number;
  widthSegments: number;
  heightSegments: number;
  phiStart: number;
  phiLength: number;
  thetaStart: number;
  thetaLength: number;
}

export interface TetrahedronGeometryData {
  type: "tetrahedron";
  radius: number;
  detail: number;
}

export interface TorusGeometryData {
  type: "torus";
  radius: number;
  tube: number;
  radialSegments: number;
  tubularSegments: number;
  arc: number;
}

export interface TorusKnotGeometryData {
  type: "torusKnot";
  radius: number;
  tube: number;
  tubularSegments: number;
  radialSegments: number;
  p: number;
  q: number;
}

/**
 * Discriminated union of all geometry types.
 * The `type` field determines which geometry is used.
 */
export type GeometryData =
  | BoxGeometryData
  | CapsuleGeometryData
  | CircleGeometryData
  | ConeGeometryData
  | CylinderGeometryData
  | DodecahedronGeometryData
  | IcosahedronGeometryData
  | LatheGeometryData
  | OctahedronGeometryData
  | PlaneGeometryData
  | RingGeometryData
  | SphereGeometryData
  | TetrahedronGeometryData
  | TorusGeometryData
  | TorusKnotGeometryData;

// ============================================================================
// Default Geometry Factories
// ============================================================================

export function createBoxGeometry(): BoxGeometryData {
  return {
    type: "box",
    width: 1,
    height: 1,
    depth: 1,
    widthSegments: 1,
    heightSegments: 1,
    depthSegments: 1,
  };
}

export function createSphereGeometry(): SphereGeometryData {
  return {
    type: "sphere",
    radius: 0.5,
    widthSegments: 32,
    heightSegments: 16,
    phiStart: 0,
    phiLength: Math.PI * 2,
    thetaStart: 0,
    thetaLength: Math.PI,
  };
}

export function createPlaneGeometry(): PlaneGeometryData {
  return {
    type: "plane",
    width: 1,
    height: 1,
    widthSegments: 1,
    heightSegments: 1,
  };
}

export function createCylinderGeometry(): CylinderGeometryData {
  return {
    type: "cylinder",
    radiusTop: 0.5,
    radiusBottom: 0.5,
    height: 1,
    radialSegments: 32,
    heightSegments: 1,
    openEnded: false,
    thetaStart: 0,
    thetaLength: Math.PI * 2,
  };
}

export function createCapsuleGeometry(): CapsuleGeometryData {
  return {
    type: "capsule",
    radius: 0.5,
    length: 1,
    capSegments: 4,
    radialSegments: 8,
  };
}

export function createConeGeometry(): ConeGeometryData {
  return {
    type: "cone",
    radius: 0.5,
    height: 1,
    radialSegments: 32,
    heightSegments: 1,
    openEnded: false,
    thetaStart: 0,
    thetaLength: Math.PI * 2,
  };
}

export function createTorusGeometry(): TorusGeometryData {
  return {
    type: "torus",
    radius: 0.5,
    tube: 0.2,
    radialSegments: 16,
    tubularSegments: 100,
    arc: Math.PI * 2,
  };
}

export function createTorusKnotGeometry(): TorusKnotGeometryData {
  return {
    type: "torusKnot",
    radius: 0.5,
    tube: 0.2,
    tubularSegments: 64,
    radialSegments: 8,
    p: 2,
    q: 3,
  };
}

export function createCircleGeometry(): CircleGeometryData {
  return {
    type: "circle",
    radius: 0.5,
    segments: 32,
    thetaStart: 0,
    thetaLength: Math.PI * 2,
  };
}

export function createRingGeometry(): RingGeometryData {
  return {
    type: "ring",
    innerRadius: 0.3,
    outerRadius: 0.5,
    thetaSegments: 32,
    phiSegments: 8,
    thetaStart: 0,
    thetaLength: Math.PI * 2,
  };
}

export function createDodecahedronGeometry(): DodecahedronGeometryData {
  return {
    type: "dodecahedron",
    radius: 0.5,
    detail: 0,
  };
}

export function createIcosahedronGeometry(): IcosahedronGeometryData {
  return {
    type: "icosahedron",
    radius: 0.5,
    detail: 0,
  };
}

export function createOctahedronGeometry(): OctahedronGeometryData {
  return {
    type: "octahedron",
    radius: 0.5,
    detail: 0,
  };
}

export function createTetrahedronGeometry(): TetrahedronGeometryData {
  return {
    type: "tetrahedron",
    radius: 0.5,
    detail: 0,
  };
}

export function createLatheGeometry(): LatheGeometryData {
  return {
    type: "lathe",
    points: [
      { x: 0, y: -0.5 },
      { x: 0.5, y: 0 },
      { x: 0, y: 0.5 },
    ],
    segments: 12,
    phiStart: 0,
    phiLength: Math.PI * 2,
  };
}

// ============================================================================
// Mesh3D Component
// ============================================================================

export interface Mesh3DData {
  /**
   * Geometry configuration (type + parameters)
   * Defines the shape of the mesh
   */
  geometry: GeometryData;

  /**
   * Reference to the material asset (.vsmat file)
   * null means use default material (white MeshStandardMaterial)
   */
  material: RuntimeAsset | null;

  /**
   * Whether to cast shadows
   * @default true
   */
  castShadow: boolean;

  /**
   * Whether to receive shadows
   * @default true
   */
  receiveShadow: boolean;
}

export const Mesh3D = component<Mesh3DData>(
  "Mesh3D",
  {
    geometry: {
      serializable: true,
    },
    material: {
      serializable: true,
      type: "runtimeAsset",
      whenNullish: "keep",
      assetType: "material",
    } as any, // Custom hint for AssetInput to show Material asset type
    castShadow: {
      serializable: true,
    },
    receiveShadow: {
      serializable: true,
    },
  },
  {
    defaultValue: () => ({
      geometry: createBoxGeometry(),
      material: null,
      castShadow: true,
      receiveShadow: true,
    }),
    displayName: "Mesh 3D",
    description: "A 3D mesh with procedural geometry",
    path: "rendering/3d",
  }
);
