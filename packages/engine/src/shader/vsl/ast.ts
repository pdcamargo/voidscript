/**
 * VoidShader Language (VSL) - Abstract Syntax Tree
 *
 * Defines the AST node types for parsing VoidShader source code.
 * This is a Godot-inspired shader language that transpiles to THREE.js GLSL.
 */

/**
 * Shader types supported by VSL
 */
export type ShaderType = 'canvas_item' | 'spatial' | 'particles';

/**
 * Render modes for canvas_item shaders
 */
export type CanvasItemRenderMode =
  | 'unshaded' // No lighting (default)
  | 'light_only' // Only shows lit portions
  | 'blend_add' // Additive blending
  | 'blend_mul' // Multiplicative blending
  | 'blend_sub' // Subtractive blending
  | 'blend_premul_alpha' // Premultiplied alpha
  | 'skip_vertex_transform'; // Don't auto-transform vertex

/**
 * Render modes for spatial shaders
 */
export type SpatialRenderMode =
  | 'unshaded'
  | 'cull_front'
  | 'cull_back'
  | 'cull_disabled'
  | 'depth_draw_opaque'
  | 'depth_draw_always'
  | 'depth_draw_never'
  | 'depth_test_disabled';

/**
 * All possible render modes
 */
export type RenderMode = CanvasItemRenderMode | SpatialRenderMode | string;

/**
 * GLSL type names supported in VSL
 */
export type GLSLType =
  | 'void'
  | 'bool'
  | 'int'
  | 'uint'
  | 'float'
  | 'vec2'
  | 'vec3'
  | 'vec4'
  | 'ivec2'
  | 'ivec3'
  | 'ivec4'
  | 'uvec2'
  | 'uvec3'
  | 'uvec4'
  | 'bvec2'
  | 'bvec3'
  | 'bvec4'
  | 'mat2'
  | 'mat3'
  | 'mat4'
  | 'sampler2D'
  | 'samplerCube';

/**
 * Uniform hint types for editor UI generation
 */
export type UniformHintType =
  | 'hint_range' // Slider with min/max
  | 'source_color' // Color picker (sRGB color space)
  | 'hint_texture' // Texture picker
  | 'hint_normal' // Normal map texture
  | 'hint_white' // Default white texture
  | 'hint_black' // Default black texture
  | 'hint_aniso' // Anisotropy hint
  | 'hint_default_texture'; // Auto-generated noise texture

/**
 * Noise texture types for hint_default_texture
 */
export type NoiseTextureType = 'simplex' | 'perlin' | 'white' | 'fbm';

/**
 * Parameters for simplex noise texture generation
 * hint_default_texture("simplex", width, height, frequency, offsetX, offsetY, amplitude, seed)
 */
export interface SimplexNoiseParams {
  type: 'simplex';
  width: number;        // Texture width in pixels (default: 256)
  height: number;       // Texture height in pixels (default: 256)
  frequency: number;    // Noise frequency/scale (default: 4.0)
  offsetX: number;      // X offset for noise sampling (default: 0.0)
  offsetY: number;      // Y offset for noise sampling (default: 0.0)
  amplitude: number;    // Noise amplitude/strength (default: 1.0)
  seed: number;         // Random seed (0 = random) (default: 0)
}

/**
 * Parameters for Perlin noise texture generation
 * hint_default_texture("perlin", width, height, cellSize, levels, attenuation, seed, color, alpha)
 */
export interface PerlinNoiseParams {
  type: 'perlin';
  width: number;        // Texture width in pixels (default: 256)
  height: number;       // Texture height in pixels (default: 256)
  cellSize: number;     // Cell size for Perlin grid (default: 32)
  levels: number;       // Number of octaves/levels (default: 4)
  attenuation: number;  // Amplitude reduction per level (default: 0.5)
  seed: number;         // Random seed (0 = random) (default: 0)
  color: boolean;       // Generate color noise (default: false)
  alpha: boolean;       // Include alpha channel variation (default: false)
}

/**
 * Parameters for white noise texture generation
 * hint_default_texture("white", width, height, seed)
 */
export interface WhiteNoiseParams {
  type: 'white';
  width: number;        // Texture width in pixels (default: 256)
  height: number;       // Texture height in pixels (default: 256)
  seed: number;         // Random seed (0 = random) (default: 0)
}

/**
 * Parameters for FBM (Fractal Brownian Motion) noise texture generation
 * hint_default_texture("fbm", width, height, frequency, octaves, lacunarity, gain, seed)
 */
export interface FbmNoiseParams {
  type: 'fbm';
  width: number;        // Texture width in pixels (default: 256)
  height: number;       // Texture height in pixels (default: 256)
  frequency: number;    // Base frequency (default: 4.0)
  octaves: number;      // Number of octaves (default: 6)
  lacunarity: number;   // Frequency multiplier per octave (default: 2.0)
  gain: number;         // Amplitude multiplier per octave (default: 0.5)
  seed: number;         // Random seed (0 = random) (default: 0)
}

/**
 * Union of all noise parameter types
 */
export type NoiseTextureParams =
  | SimplexNoiseParams
  | PerlinNoiseParams
  | WhiteNoiseParams
  | FbmNoiseParams;

/**
 * Uniform hint with optional parameters
 */
export interface UniformHint {
  type: UniformHintType;
  /** Parameters for hint_range: [min, max, step?] */
  params?: number[];
  /** Parameters for hint_default_texture - typed noise generation params */
  noiseParams?: NoiseTextureParams;
}

/**
 * Source location for error reporting
 */
export interface SourceLocation {
  line: number;
  column: number;
  offset: number;
}

/**
 * Source range for error reporting
 */
export interface SourceRange {
  start: SourceLocation;
  end: SourceLocation;
}

/**
 * Base interface for all AST nodes
 */
export interface ASTNode {
  type: string;
  location?: SourceRange;
}

// ============================================================================
// Literal Expressions
// ============================================================================

export interface BoolLiteral extends ASTNode {
  type: 'BoolLiteral';
  value: boolean;
}

export interface IntLiteral extends ASTNode {
  type: 'IntLiteral';
  value: number;
}

export interface FloatLiteral extends ASTNode {
  type: 'FloatLiteral';
  value: number;
}

export interface VectorLiteral extends ASTNode {
  type: 'VectorLiteral';
  /** vec2, vec3, vec4, etc. */
  vectorType: GLSLType;
  components: Expression[];
}

/**
 * All literal types
 */
export type Literal = BoolLiteral | IntLiteral | FloatLiteral | VectorLiteral;

// ============================================================================
// Expressions
// ============================================================================

export interface Identifier extends ASTNode {
  type: 'Identifier';
  name: string;
}

export interface MemberExpression extends ASTNode {
  type: 'MemberExpression';
  object: Expression;
  property: Identifier;
  /** True for obj['prop'], false for obj.prop */
  computed: boolean;
}

export interface IndexExpression extends ASTNode {
  type: 'IndexExpression';
  object: Expression;
  index: Expression;
}

export interface CallExpression extends ASTNode {
  type: 'CallExpression';
  callee: Expression;
  arguments: Expression[];
}

export interface UnaryExpression extends ASTNode {
  type: 'UnaryExpression';
  operator: '-' | '+' | '!' | '~' | '++' | '--';
  argument: Expression;
  prefix: boolean;
}

export interface BinaryExpression extends ASTNode {
  type: 'BinaryExpression';
  operator:
    | '+'
    | '-'
    | '*'
    | '/'
    | '%'
    | '=='
    | '!='
    | '<'
    | '<='
    | '>'
    | '>='
    | '&&'
    | '||'
    | '&'
    | '|'
    | '^'
    | '<<'
    | '>>';
  left: Expression;
  right: Expression;
}

export interface AssignmentExpression extends ASTNode {
  type: 'AssignmentExpression';
  operator: '=' | '+=' | '-=' | '*=' | '/=' | '%=' | '&=' | '|=' | '^=';
  left: Expression;
  right: Expression;
}

export interface ConditionalExpression extends ASTNode {
  type: 'ConditionalExpression';
  test: Expression;
  consequent: Expression;
  alternate: Expression;
}

/**
 * All expression types
 */
export type Expression =
  | Literal
  | Identifier
  | MemberExpression
  | IndexExpression
  | CallExpression
  | UnaryExpression
  | BinaryExpression
  | AssignmentExpression
  | ConditionalExpression;

// ============================================================================
// Statements
// ============================================================================

export interface ExpressionStatement extends ASTNode {
  type: 'ExpressionStatement';
  expression: Expression;
}

export interface VariableDeclaration extends ASTNode {
  type: 'VariableDeclaration';
  /** Variable type (int, float, vec3, etc.) */
  varType: GLSLType;
  /** Variable name */
  name: string;
  /** Optional initializer */
  init?: Expression;
  /** const, varying, etc. */
  qualifier?: 'const';
}

export interface BlockStatement extends ASTNode {
  type: 'BlockStatement';
  body: Statement[];
}

export interface IfStatement extends ASTNode {
  type: 'IfStatement';
  test: Expression;
  consequent: Statement;
  alternate?: Statement;
}

export interface ForStatement extends ASTNode {
  type: 'ForStatement';
  init?: VariableDeclaration | ExpressionStatement;
  test?: Expression;
  update?: Expression;
  body: Statement;
}

export interface WhileStatement extends ASTNode {
  type: 'WhileStatement';
  test: Expression;
  body: Statement;
}

export interface DoWhileStatement extends ASTNode {
  type: 'DoWhileStatement';
  body: Statement;
  test: Expression;
}

export interface ReturnStatement extends ASTNode {
  type: 'ReturnStatement';
  argument?: Expression;
}

export interface BreakStatement extends ASTNode {
  type: 'BreakStatement';
}

export interface ContinueStatement extends ASTNode {
  type: 'ContinueStatement';
}

export interface DiscardStatement extends ASTNode {
  type: 'DiscardStatement';
}

/**
 * All statement types
 */
export type Statement =
  | ExpressionStatement
  | VariableDeclaration
  | BlockStatement
  | IfStatement
  | ForStatement
  | WhileStatement
  | DoWhileStatement
  | ReturnStatement
  | BreakStatement
  | ContinueStatement
  | DiscardStatement;

// ============================================================================
// Top-level Declarations
// ============================================================================

/**
 * Uniform variable declaration
 *
 * Example: uniform float speed : hint_range(0.0, 10.0) = 1.0;
 */
export interface UniformDeclaration extends ASTNode {
  type: 'UniformDeclaration';
  /** Uniform type (float, vec3, sampler2D, etc.) */
  uniformType: GLSLType;
  /** Uniform name */
  name: string;
  /** Optional hint for editor UI */
  hint?: UniformHint;
  /** Optional default value */
  defaultValue?: Expression;
}

/**
 * Varying variable declaration (for passing data between stages)
 *
 * Example: varying vec2 customUv;
 */
export interface VaryingDeclaration extends ASTNode {
  type: 'VaryingDeclaration';
  varyingType: GLSLType;
  name: string;
}

/**
 * Include directive for shader library
 *
 * Example: #include "noise/simplex"
 */
export interface IncludeDirective extends ASTNode {
  type: 'IncludeDirective';
  path: string;
}

/**
 * Function parameter
 */
export interface FunctionParameter extends ASTNode {
  type: 'FunctionParameter';
  paramType: GLSLType;
  name: string;
  /** in, out, inout */
  qualifier?: 'in' | 'out' | 'inout';
}

/**
 * Function declaration
 *
 * Example:
 * void vertex() { ... }
 * float customFunc(float x, out float y) { ... }
 */
export interface FunctionDeclaration extends ASTNode {
  type: 'FunctionDeclaration';
  /** Function name (vertex, fragment, light, or custom) */
  name: string;
  /** Return type */
  returnType: GLSLType;
  /** Function parameters */
  params: FunctionParameter[];
  /** Function body */
  body: BlockStatement;
}

/**
 * Shader type declaration
 *
 * Example: shader_type canvas_item;
 */
export interface ShaderTypeDeclaration extends ASTNode {
  type: 'ShaderTypeDeclaration';
  shaderType: ShaderType;
}

/**
 * Render mode declaration
 *
 * Example: render_mode unshaded, blend_add;
 */
export interface RenderModeDeclaration extends ASTNode {
  type: 'RenderModeDeclaration';
  modes: RenderMode[];
}

/**
 * All top-level declaration types
 */
export type Declaration =
  | ShaderTypeDeclaration
  | RenderModeDeclaration
  | UniformDeclaration
  | VaryingDeclaration
  | IncludeDirective
  | FunctionDeclaration;

// ============================================================================
// Root AST Node
// ============================================================================

/**
 * Root node of the VoidShader AST
 */
export interface ShaderAST extends ASTNode {
  type: 'Shader';
  /** Shader type (canvas_item, spatial, particles) */
  shaderType: ShaderType;
  /** Render modes */
  renderModes: RenderMode[];
  /** Include directives */
  includes: IncludeDirective[];
  /** Uniform declarations */
  uniforms: UniformDeclaration[];
  /** Varying declarations */
  varyings: VaryingDeclaration[];
  /** Function declarations (vertex, fragment, light, custom) */
  functions: FunctionDeclaration[];
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if a type is a sampler type
 */
export function isSamplerType(type: GLSLType): boolean {
  return type === 'sampler2D' || type === 'samplerCube';
}

/**
 * Check if a type is a vector type
 */
export function isVectorType(type: GLSLType): boolean {
  return (
    type === 'vec2' ||
    type === 'vec3' ||
    type === 'vec4' ||
    type === 'ivec2' ||
    type === 'ivec3' ||
    type === 'ivec4' ||
    type === 'uvec2' ||
    type === 'uvec3' ||
    type === 'uvec4' ||
    type === 'bvec2' ||
    type === 'bvec3' ||
    type === 'bvec4'
  );
}

/**
 * Check if a type is a matrix type
 */
export function isMatrixType(type: GLSLType): boolean {
  return type === 'mat2' || type === 'mat3' || type === 'mat4';
}

/**
 * Get the component count for a vector type
 */
export function getVectorComponentCount(type: GLSLType): number {
  if (type.endsWith('2')) return 2;
  if (type.endsWith('3')) return 3;
  if (type.endsWith('4')) return 4;
  return 1;
}

/**
 * Create an empty ShaderAST with default values
 */
export function createEmptyShaderAST(): ShaderAST {
  return {
    type: 'Shader',
    shaderType: 'canvas_item',
    renderModes: [],
    includes: [],
    uniforms: [],
    varyings: [],
    functions: [],
  };
}

/**
 * Find a function in the AST by name
 */
export function findFunction(
  ast: ShaderAST,
  name: string,
): FunctionDeclaration | undefined {
  return ast.functions.find((fn) => fn.name === name);
}

/**
 * Check if AST has a vertex function
 */
export function hasVertexFunction(ast: ShaderAST): boolean {
  return findFunction(ast, 'vertex') !== undefined;
}

/**
 * Check if AST has a fragment function
 */
export function hasFragmentFunction(ast: ShaderAST): boolean {
  return findFunction(ast, 'fragment') !== undefined;
}

/**
 * Check if AST has a light function
 */
export function hasLightFunction(ast: ShaderAST): boolean {
  return findFunction(ast, 'light') !== undefined;
}
