/**
 * VoidShader Language (VSL) - Built-in Variables and Functions
 *
 * Defines the built-in variables and functions available in each shader type.
 * These are auto-injected during transpilation to THREE.js GLSL.
 */

import type { GLSLType, ShaderType } from './ast.js';

/**
 * Shader stage (vertex or fragment)
 */
export type ShaderStage = 'vertex' | 'fragment';

/**
 * Built-in variable definition
 */
export interface BuiltInVariable {
  /** Variable name in VSL (e.g., VERTEX, UV, COLOR) */
  name: string;
  /** GLSL type (e.g., vec2, vec4, sampler2D) */
  type: GLSLType;
  /** Which stages can access this variable */
  stages: ShaderStage[];
  /** Whether the variable is writable */
  writable: boolean;
  /** How this maps to THREE.js GLSL */
  glslMapping: string;
  /** Description for documentation/editor */
  description: string;
  /** For uniforms: the uniform name in THREE.js */
  uniformName?: string;
  /** Whether this is a varying (passed from vertex to fragment) */
  isVarying?: boolean;
  /** Whether this is a uniform */
  isUniform?: boolean;
  /** Default value expression (GLSL) */
  defaultValue?: string;
}

/**
 * Built-in function definition
 */
export interface BuiltInFunction {
  /** Function name */
  name: string;
  /** Return type */
  returnType: GLSLType;
  /** Parameter types */
  params: { name: string; type: GLSLType }[];
  /** Whether this is a GLSL built-in or needs custom implementation */
  isNative: boolean;
  /** Custom GLSL implementation (if not native) */
  implementation?: string;
  /** Description */
  description: string;
}

// ============================================================================
// Canvas Item (2D) Built-in Variables
// ============================================================================

/**
 * Built-in variables for canvas_item shaders (2D sprites, UI, etc.)
 */
export const CANVAS_ITEM_BUILTINS: BuiltInVariable[] = [
  // Vertex Stage Variables
  {
    name: 'VERTEX',
    type: 'vec2',
    stages: ['vertex'],
    writable: true,
    glslMapping: 'vsl_vertex',
    description: 'Vertex position in local space (writable)',
  },
  {
    name: 'UV',
    type: 'vec2',
    stages: ['vertex', 'fragment'],
    writable: true,
    glslMapping: 'vsl_uv',
    description: 'Texture coordinates',
    isVarying: true,
  },
  {
    name: 'COLOR',
    type: 'vec4',
    stages: ['vertex', 'fragment'],
    writable: true,
    glslMapping: 'vsl_color',
    description: 'Vertex color (vertex) / Final output color (fragment)',
    isVarying: true,
  },
  {
    name: 'NORMAL',
    type: 'vec3',
    stages: ['vertex', 'fragment'],
    writable: true,
    glslMapping: 'vsl_normal',
    description: 'Normal vector',
    isVarying: true,
  },
  {
    name: 'MODEL_MATRIX',
    type: 'mat4',
    stages: ['vertex'],
    writable: false,
    glslMapping: 'modelMatrix',
    description: 'Model transformation matrix',
  },
  {
    name: 'VIEW_MATRIX',
    type: 'mat4',
    stages: ['vertex'],
    writable: false,
    glslMapping: 'viewMatrix',
    description: 'View/camera transformation matrix',
  },
  {
    name: 'PROJECTION_MATRIX',
    type: 'mat4',
    stages: ['vertex'],
    writable: false,
    glslMapping: 'projectionMatrix',
    description: 'Projection matrix',
  },

  // Fragment Stage Variables
  {
    name: 'TEXTURE',
    type: 'sampler2D',
    stages: ['fragment'],
    writable: false,
    glslMapping: 'map',
    description: 'Main sprite/texture',
    isUniform: true,
    uniformName: 'map',
  },
  {
    name: 'TEXTURE_SIZE',
    type: 'vec2',
    stages: ['fragment'],
    writable: false,
    glslMapping: 'vsl_textureSize',
    description: 'Texture dimensions in pixels',
    isUniform: true,
    uniformName: 'vsl_textureSize',
  },
  {
    name: 'SCREEN_UV',
    type: 'vec2',
    stages: ['fragment'],
    writable: false,
    glslMapping: 'gl_FragCoord.xy / vsl_screenSize',
    description: 'Screen-space UV coordinates (0-1)',
  },
  {
    name: 'SCREEN_TEXTURE',
    type: 'sampler2D',
    stages: ['fragment'],
    writable: false,
    glslMapping: 'vsl_screenTexture',
    description: 'Screen capture texture (for effects)',
    isUniform: true,
    uniformName: 'vsl_screenTexture',
  },
  {
    name: 'FRAGCOORD',
    type: 'vec4',
    stages: ['fragment'],
    writable: false,
    glslMapping: 'gl_FragCoord',
    description: 'Fragment coordinates (window-space)',
  },
  {
    name: 'CLIP_POSITION',
    type: 'vec4',
    stages: ['vertex', 'fragment'],
    writable: false,
    glslMapping: 'vsl_clipPosition',
    description: 'Clip-space position (for mesh-relative screen UV calculations)',
    isVarying: true,
  },
  {
    name: 'MODEL_POSITION',
    type: 'vec3',
    stages: ['vertex', 'fragment'],
    writable: false,
    glslMapping: 'vsl_modelPosition',
    description: 'Object world position (extracted from model matrix)',
    isVarying: true,
  },
  {
    name: 'MODEL_CENTER_SCREEN_Y',
    type: 'float',
    stages: ['vertex', 'fragment'],
    writable: false,
    glslMapping: 'vsl_modelCenterScreenY',
    description: 'Model center Y position in screen space (0-1), for reflection calculations',
    isVarying: true,
  },
  {
    name: 'MESH_SCREEN_BOUNDS',
    type: 'vec4',
    stages: ['fragment'],
    writable: false,
    glslMapping: 'vsl_meshScreenBounds',
    description: 'Mesh screen-space bounds (minX, minY, maxX, maxY) in UV space (0-1). Calculated from mesh corners projected to screen.',
    isUniform: true,
    uniformName: 'vsl_meshScreenBounds',
  },

  // Global Variables (both stages)
  {
    name: 'TIME',
    type: 'float',
    stages: ['vertex', 'fragment'],
    writable: false,
    glslMapping: 'vsl_time',
    description: 'Elapsed time in seconds',
    isUniform: true,
    uniformName: 'vsl_time',
  },
  {
    name: 'DELTA_TIME',
    type: 'float',
    stages: ['vertex', 'fragment'],
    writable: false,
    glslMapping: 'vsl_deltaTime',
    description: 'Frame delta time in seconds',
    isUniform: true,
    uniformName: 'vsl_deltaTime',
  },
  {
    name: 'SCREEN_SIZE',
    type: 'vec2',
    stages: ['vertex', 'fragment'],
    writable: false,
    glslMapping: 'vsl_screenSize',
    description: 'Screen/viewport size in pixels',
    isUniform: true,
    uniformName: 'vsl_screenSize',
  },
];

// ============================================================================
// Spatial (3D) Built-in Variables
// ============================================================================

/**
 * Built-in variables for spatial shaders (3D objects)
 */
export const SPATIAL_BUILTINS: BuiltInVariable[] = [
  // Vertex Stage Variables
  {
    name: 'VERTEX',
    type: 'vec3',
    stages: ['vertex'],
    writable: true,
    glslMapping: 'vsl_vertex',
    description: 'Vertex position in local space (writable)',
  },
  {
    name: 'NORMAL',
    type: 'vec3',
    stages: ['vertex', 'fragment'],
    writable: true,
    glslMapping: 'vsl_normal',
    description: 'Normal vector',
    isVarying: true,
  },
  {
    name: 'TANGENT',
    type: 'vec3',
    stages: ['vertex', 'fragment'],
    writable: true,
    glslMapping: 'vsl_tangent',
    description: 'Tangent vector',
    isVarying: true,
  },
  {
    name: 'BINORMAL',
    type: 'vec3',
    stages: ['vertex', 'fragment'],
    writable: true,
    glslMapping: 'vsl_binormal',
    description: 'Binormal/bitangent vector',
    isVarying: true,
  },
  {
    name: 'UV',
    type: 'vec2',
    stages: ['vertex', 'fragment'],
    writable: true,
    glslMapping: 'vsl_uv',
    description: 'Primary texture coordinates',
    isVarying: true,
  },
  {
    name: 'UV2',
    type: 'vec2',
    stages: ['vertex', 'fragment'],
    writable: true,
    glslMapping: 'vsl_uv2',
    description: 'Secondary texture coordinates (lightmaps)',
    isVarying: true,
  },
  {
    name: 'COLOR',
    type: 'vec4',
    stages: ['vertex', 'fragment'],
    writable: true,
    glslMapping: 'vsl_color',
    description: 'Vertex color',
    isVarying: true,
  },
  {
    name: 'MODEL_MATRIX',
    type: 'mat4',
    stages: ['vertex'],
    writable: false,
    glslMapping: 'modelMatrix',
    description: 'Model transformation matrix',
  },
  {
    name: 'VIEW_MATRIX',
    type: 'mat4',
    stages: ['vertex', 'fragment'],
    writable: false,
    glslMapping: 'viewMatrix',
    description: 'View/camera transformation matrix',
  },
  {
    name: 'PROJECTION_MATRIX',
    type: 'mat4',
    stages: ['vertex'],
    writable: false,
    glslMapping: 'projectionMatrix',
    description: 'Projection matrix',
  },
  {
    name: 'INV_VIEW_MATRIX',
    type: 'mat4',
    stages: ['vertex', 'fragment'],
    writable: false,
    glslMapping: 'vsl_invViewMatrix',
    description: 'Inverse view matrix',
    isUniform: true,
    uniformName: 'vsl_invViewMatrix',
  },
  {
    name: 'CAMERA_POSITION',
    type: 'vec3',
    stages: ['vertex', 'fragment'],
    writable: false,
    glslMapping: 'cameraPosition',
    description: 'Camera world position',
  },

  // Fragment Stage Variables (PBR outputs)
  {
    name: 'ALBEDO',
    type: 'vec3',
    stages: ['fragment'],
    writable: true,
    glslMapping: 'vsl_albedo',
    description: 'Base color (RGB)',
    defaultValue: 'vec3(1.0)',
  },
  {
    name: 'ALPHA',
    type: 'float',
    stages: ['fragment'],
    writable: true,
    glslMapping: 'vsl_alpha',
    description: 'Alpha/opacity',
    defaultValue: '1.0',
  },
  {
    name: 'METALLIC',
    type: 'float',
    stages: ['fragment'],
    writable: true,
    glslMapping: 'vsl_metallic',
    description: 'Metallic factor (0-1)',
    defaultValue: '0.0',
  },
  {
    name: 'ROUGHNESS',
    type: 'float',
    stages: ['fragment'],
    writable: true,
    glslMapping: 'vsl_roughness',
    description: 'Roughness factor (0-1)',
    defaultValue: '0.5',
  },
  {
    name: 'SPECULAR',
    type: 'float',
    stages: ['fragment'],
    writable: true,
    glslMapping: 'vsl_specular',
    description: 'Specular intensity',
    defaultValue: '0.5',
  },
  {
    name: 'EMISSION',
    type: 'vec3',
    stages: ['fragment'],
    writable: true,
    glslMapping: 'vsl_emission',
    description: 'Emission color',
    defaultValue: 'vec3(0.0)',
  },
  {
    name: 'AO',
    type: 'float',
    stages: ['fragment'],
    writable: true,
    glslMapping: 'vsl_ao',
    description: 'Ambient occlusion',
    defaultValue: '1.0',
  },
  {
    name: 'NORMAL_MAP',
    type: 'vec3',
    stages: ['fragment'],
    writable: true,
    glslMapping: 'vsl_normalMap',
    description: 'Normal map (tangent space)',
    defaultValue: 'vec3(0.5, 0.5, 1.0)',
  },
  {
    name: 'NORMAL_MAP_DEPTH',
    type: 'float',
    stages: ['fragment'],
    writable: true,
    glslMapping: 'vsl_normalMapDepth',
    description: 'Normal map strength',
    defaultValue: '1.0',
  },

  // Fragment read-only
  {
    name: 'FRAGCOORD',
    type: 'vec4',
    stages: ['fragment'],
    writable: false,
    glslMapping: 'gl_FragCoord',
    description: 'Fragment coordinates (window-space)',
  },
  {
    name: 'FRONT_FACING',
    type: 'bool',
    stages: ['fragment'],
    writable: false,
    glslMapping: 'gl_FrontFacing',
    description: 'True if front-facing fragment',
  },

  // Global Variables
  {
    name: 'TIME',
    type: 'float',
    stages: ['vertex', 'fragment'],
    writable: false,
    glslMapping: 'vsl_time',
    description: 'Elapsed time in seconds',
    isUniform: true,
    uniformName: 'vsl_time',
  },
  {
    name: 'DELTA_TIME',
    type: 'float',
    stages: ['vertex', 'fragment'],
    writable: false,
    glslMapping: 'vsl_deltaTime',
    description: 'Frame delta time in seconds',
    isUniform: true,
    uniformName: 'vsl_deltaTime',
  },
  {
    name: 'SCREEN_SIZE',
    type: 'vec2',
    stages: ['vertex', 'fragment'],
    writable: false,
    glslMapping: 'vsl_screenSize',
    description: 'Screen/viewport size in pixels',
    isUniform: true,
    uniformName: 'vsl_screenSize',
  },
];

// ============================================================================
// Particles Built-in Variables (Future)
// ============================================================================

/**
 * Built-in variables for particle shaders
 */
export const PARTICLES_BUILTINS: BuiltInVariable[] = [
  {
    name: 'TRANSFORM',
    type: 'mat4',
    stages: ['vertex'],
    writable: true,
    glslMapping: 'vsl_transform',
    description: 'Particle transformation matrix',
  },
  {
    name: 'VELOCITY',
    type: 'vec3',
    stages: ['vertex'],
    writable: true,
    glslMapping: 'vsl_velocity',
    description: 'Particle velocity',
  },
  {
    name: 'COLOR',
    type: 'vec4',
    stages: ['vertex', 'fragment'],
    writable: true,
    glslMapping: 'vsl_color',
    description: 'Particle color',
    isVarying: true,
  },
  {
    name: 'CUSTOM',
    type: 'vec4',
    stages: ['vertex', 'fragment'],
    writable: true,
    glslMapping: 'vsl_custom',
    description: 'Custom particle data',
    isVarying: true,
  },
  {
    name: 'INDEX',
    type: 'int',
    stages: ['vertex'],
    writable: false,
    glslMapping: 'gl_VertexID',
    description: 'Particle index',
  },
  {
    name: 'NUMBER',
    type: 'int',
    stages: ['vertex'],
    writable: false,
    glslMapping: 'vsl_particleCount',
    description: 'Total number of particles',
    isUniform: true,
    uniformName: 'vsl_particleCount',
  },
  {
    name: 'LIFETIME',
    type: 'float',
    stages: ['vertex'],
    writable: false,
    glslMapping: 'vsl_lifetime',
    description: 'Particle lifetime (0-1)',
  },
  {
    name: 'ACTIVE',
    type: 'bool',
    stages: ['vertex'],
    writable: true,
    glslMapping: 'vsl_active',
    description: 'Whether particle is active',
  },
  {
    name: 'RESTART',
    type: 'bool',
    stages: ['vertex'],
    writable: false,
    glslMapping: 'vsl_restart',
    description: 'True on first frame of particle life',
  },
  {
    name: 'TIME',
    type: 'float',
    stages: ['vertex', 'fragment'],
    writable: false,
    glslMapping: 'vsl_time',
    description: 'Elapsed time in seconds',
    isUniform: true,
    uniformName: 'vsl_time',
  },
  {
    name: 'DELTA_TIME',
    type: 'float',
    stages: ['vertex', 'fragment'],
    writable: false,
    glslMapping: 'vsl_deltaTime',
    description: 'Frame delta time in seconds',
    isUniform: true,
    uniformName: 'vsl_deltaTime',
  },
];

// ============================================================================
// Built-in Functions
// ============================================================================

/**
 * Common GLSL built-in functions available in all shader types
 */
export const BUILTIN_FUNCTIONS: BuiltInFunction[] = [
  // Texture sampling
  {
    name: 'texture',
    returnType: 'vec4',
    params: [
      { name: 'sampler', type: 'sampler2D' },
      { name: 'uv', type: 'vec2' },
    ],
    isNative: true,
    description: 'Sample a texture at the given UV coordinates',
  },
  {
    name: 'textureLod',
    returnType: 'vec4',
    params: [
      { name: 'sampler', type: 'sampler2D' },
      { name: 'uv', type: 'vec2' },
      { name: 'lod', type: 'float' },
    ],
    isNative: true,
    description: 'Sample a texture at a specific LOD level',
  },

  // Math functions
  {
    name: 'mix',
    returnType: 'float',
    params: [
      { name: 'x', type: 'float' },
      { name: 'y', type: 'float' },
      { name: 'a', type: 'float' },
    ],
    isNative: true,
    description: 'Linear interpolation between x and y',
  },
  {
    name: 'clamp',
    returnType: 'float',
    params: [
      { name: 'x', type: 'float' },
      { name: 'minVal', type: 'float' },
      { name: 'maxVal', type: 'float' },
    ],
    isNative: true,
    description: 'Clamp value between min and max',
  },
  {
    name: 'step',
    returnType: 'float',
    params: [
      { name: 'edge', type: 'float' },
      { name: 'x', type: 'float' },
    ],
    isNative: true,
    description: 'Returns 0.0 if x < edge, otherwise 1.0',
  },
  {
    name: 'smoothstep',
    returnType: 'float',
    params: [
      { name: 'edge0', type: 'float' },
      { name: 'edge1', type: 'float' },
      { name: 'x', type: 'float' },
    ],
    isNative: true,
    description: 'Smooth Hermite interpolation between 0 and 1',
  },
  {
    name: 'fract',
    returnType: 'float',
    params: [{ name: 'x', type: 'float' }],
    isNative: true,
    description: 'Returns the fractional part of x',
  },
  {
    name: 'floor',
    returnType: 'float',
    params: [{ name: 'x', type: 'float' }],
    isNative: true,
    description: 'Returns the largest integer less than or equal to x',
  },
  {
    name: 'ceil',
    returnType: 'float',
    params: [{ name: 'x', type: 'float' }],
    isNative: true,
    description: 'Returns the smallest integer greater than or equal to x',
  },
  {
    name: 'mod',
    returnType: 'float',
    params: [
      { name: 'x', type: 'float' },
      { name: 'y', type: 'float' },
    ],
    isNative: true,
    description: 'Returns x modulo y',
  },
  {
    name: 'abs',
    returnType: 'float',
    params: [{ name: 'x', type: 'float' }],
    isNative: true,
    description: 'Returns the absolute value of x',
  },
  {
    name: 'sign',
    returnType: 'float',
    params: [{ name: 'x', type: 'float' }],
    isNative: true,
    description: 'Returns -1.0, 0.0, or 1.0 depending on sign of x',
  },
  {
    name: 'min',
    returnType: 'float',
    params: [
      { name: 'x', type: 'float' },
      { name: 'y', type: 'float' },
    ],
    isNative: true,
    description: 'Returns the minimum of x and y',
  },
  {
    name: 'max',
    returnType: 'float',
    params: [
      { name: 'x', type: 'float' },
      { name: 'y', type: 'float' },
    ],
    isNative: true,
    description: 'Returns the maximum of x and y',
  },
  {
    name: 'pow',
    returnType: 'float',
    params: [
      { name: 'x', type: 'float' },
      { name: 'y', type: 'float' },
    ],
    isNative: true,
    description: 'Returns x raised to the power of y',
  },
  {
    name: 'exp',
    returnType: 'float',
    params: [{ name: 'x', type: 'float' }],
    isNative: true,
    description: 'Returns e raised to the power of x',
  },
  {
    name: 'log',
    returnType: 'float',
    params: [{ name: 'x', type: 'float' }],
    isNative: true,
    description: 'Returns the natural logarithm of x',
  },
  {
    name: 'sqrt',
    returnType: 'float',
    params: [{ name: 'x', type: 'float' }],
    isNative: true,
    description: 'Returns the square root of x',
  },
  {
    name: 'inversesqrt',
    returnType: 'float',
    params: [{ name: 'x', type: 'float' }],
    isNative: true,
    description: 'Returns 1/sqrt(x)',
  },

  // Trigonometric functions
  {
    name: 'sin',
    returnType: 'float',
    params: [{ name: 'x', type: 'float' }],
    isNative: true,
    description: 'Returns the sine of x',
  },
  {
    name: 'cos',
    returnType: 'float',
    params: [{ name: 'x', type: 'float' }],
    isNative: true,
    description: 'Returns the cosine of x',
  },
  {
    name: 'tan',
    returnType: 'float',
    params: [{ name: 'x', type: 'float' }],
    isNative: true,
    description: 'Returns the tangent of x',
  },
  {
    name: 'asin',
    returnType: 'float',
    params: [{ name: 'x', type: 'float' }],
    isNative: true,
    description: 'Returns the arc sine of x',
  },
  {
    name: 'acos',
    returnType: 'float',
    params: [{ name: 'x', type: 'float' }],
    isNative: true,
    description: 'Returns the arc cosine of x',
  },
  {
    name: 'atan',
    returnType: 'float',
    params: [{ name: 'y_over_x', type: 'float' }],
    isNative: true,
    description: 'Returns the arc tangent of y/x',
  },
  {
    name: 'radians',
    returnType: 'float',
    params: [{ name: 'degrees', type: 'float' }],
    isNative: true,
    description: 'Converts degrees to radians',
  },
  {
    name: 'degrees',
    returnType: 'float',
    params: [{ name: 'radians', type: 'float' }],
    isNative: true,
    description: 'Converts radians to degrees',
  },

  // Vector functions
  {
    name: 'length',
    returnType: 'float',
    params: [{ name: 'v', type: 'vec3' }],
    isNative: true,
    description: 'Returns the length of the vector',
  },
  {
    name: 'distance',
    returnType: 'float',
    params: [
      { name: 'p0', type: 'vec3' },
      { name: 'p1', type: 'vec3' },
    ],
    isNative: true,
    description: 'Returns the distance between two points',
  },
  {
    name: 'dot',
    returnType: 'float',
    params: [
      { name: 'x', type: 'vec3' },
      { name: 'y', type: 'vec3' },
    ],
    isNative: true,
    description: 'Returns the dot product of two vectors',
  },
  {
    name: 'cross',
    returnType: 'vec3',
    params: [
      { name: 'x', type: 'vec3' },
      { name: 'y', type: 'vec3' },
    ],
    isNative: true,
    description: 'Returns the cross product of two vectors',
  },
  {
    name: 'normalize',
    returnType: 'vec3',
    params: [{ name: 'v', type: 'vec3' }],
    isNative: true,
    description: 'Returns a normalized vector',
  },
  {
    name: 'reflect',
    returnType: 'vec3',
    params: [
      { name: 'I', type: 'vec3' },
      { name: 'N', type: 'vec3' },
    ],
    isNative: true,
    description: 'Returns the reflection direction',
  },
  {
    name: 'refract',
    returnType: 'vec3',
    params: [
      { name: 'I', type: 'vec3' },
      { name: 'N', type: 'vec3' },
      { name: 'eta', type: 'float' },
    ],
    isNative: true,
    description: 'Returns the refraction direction',
  },
  {
    name: 'faceforward',
    returnType: 'vec3',
    params: [
      { name: 'N', type: 'vec3' },
      { name: 'I', type: 'vec3' },
      { name: 'Nref', type: 'vec3' },
    ],
    isNative: true,
    description: 'Returns N if dot(Nref, I) < 0, otherwise -N',
  },

  // Matrix functions
  {
    name: 'transpose',
    returnType: 'mat4',
    params: [{ name: 'm', type: 'mat4' }],
    isNative: true,
    description: 'Returns the transpose of a matrix',
  },
  {
    name: 'inverse',
    returnType: 'mat4',
    params: [{ name: 'm', type: 'mat4' }],
    isNative: true,
    description: 'Returns the inverse of a matrix',
  },
  {
    name: 'determinant',
    returnType: 'float',
    params: [{ name: 'm', type: 'mat4' }],
    isNative: true,
    description: 'Returns the determinant of a matrix',
  },
];

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get built-in variables for a specific shader type
 */
export function getBuiltInsForShaderType(shaderType: ShaderType): BuiltInVariable[] {
  switch (shaderType) {
    case 'canvas_item':
      return CANVAS_ITEM_BUILTINS;
    case 'spatial':
      return SPATIAL_BUILTINS;
    case 'particles':
      return PARTICLES_BUILTINS;
    default:
      return CANVAS_ITEM_BUILTINS;
  }
}

/**
 * Get built-in variables available in a specific stage
 */
export function getBuiltInsForStage(
  shaderType: ShaderType,
  stage: ShaderStage,
): BuiltInVariable[] {
  const builtins = getBuiltInsForShaderType(shaderType);
  return builtins.filter((b) => b.stages.includes(stage));
}

/**
 * Get writable built-in variables for a stage
 */
export function getWritableBuiltIns(
  shaderType: ShaderType,
  stage: ShaderStage,
): BuiltInVariable[] {
  return getBuiltInsForStage(shaderType, stage).filter((b) => b.writable);
}

/**
 * Get read-only built-in variables for a stage
 */
export function getReadOnlyBuiltIns(
  shaderType: ShaderType,
  stage: ShaderStage,
): BuiltInVariable[] {
  return getBuiltInsForStage(shaderType, stage).filter((b) => !b.writable);
}

/**
 * Get all varying built-ins (passed from vertex to fragment)
 */
export function getVaryingBuiltIns(shaderType: ShaderType): BuiltInVariable[] {
  return getBuiltInsForShaderType(shaderType).filter((b) => b.isVarying);
}

/**
 * Get all uniform built-ins
 */
export function getUniformBuiltIns(shaderType: ShaderType): BuiltInVariable[] {
  return getBuiltInsForShaderType(shaderType).filter((b) => b.isUniform);
}

/**
 * Find a built-in variable by name
 */
export function findBuiltIn(
  shaderType: ShaderType,
  name: string,
): BuiltInVariable | undefined {
  return getBuiltInsForShaderType(shaderType).find((b) => b.name === name);
}

/**
 * Check if a name is a built-in variable
 */
export function isBuiltInVariable(shaderType: ShaderType, name: string): boolean {
  return findBuiltIn(shaderType, name) !== undefined;
}

/**
 * Check if a name is a built-in function
 */
export function isBuiltInFunction(name: string): boolean {
  return BUILTIN_FUNCTIONS.some((f) => f.name === name);
}

/**
 * Find a built-in function by name
 */
export function findBuiltInFunction(name: string): BuiltInFunction | undefined {
  return BUILTIN_FUNCTIONS.find((f) => f.name === name);
}

/**
 * Get the GLSL type for a built-in variable
 */
export function getBuiltInType(
  shaderType: ShaderType,
  name: string,
): GLSLType | undefined {
  const builtin = findBuiltIn(shaderType, name);
  return builtin?.type;
}

/**
 * Get all custom uniforms required by the VSL runtime
 * These are the uniforms that need to be provided by the material
 */
export function getRequiredVSLUniforms(shaderType: ShaderType): {
  name: string;
  type: GLSLType;
  description: string;
}[] {
  const builtins = getUniformBuiltIns(shaderType);
  return builtins
    .filter((b) => b.uniformName?.startsWith('vsl_'))
    .map((b) => ({
      name: b.uniformName!,
      type: b.type,
      description: b.description,
    }));
}
