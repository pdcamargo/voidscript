/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * VoidShader Language (VSL) - Transpiler
 *
 * Converts VSL AST to THREE.js compatible GLSL vertex and fragment shaders.
 * Handles built-in variable injection, uniform mapping, and render mode configuration.
 */

import type {
  ShaderAST,
  Expression,
  Statement,
  FunctionDeclaration,
  GLSLType,
  RenderMode,
  ShaderType,
  BinaryExpression,
  UnaryExpression,
  CallExpression,
  MemberExpression,
  IndexExpression,
  AssignmentExpression,
  ConditionalExpression,
  Identifier,
  VectorLiteral,
  IfStatement,
  ForStatement,
  WhileStatement,
  DoWhileStatement,
  VariableDeclaration,
  BlockStatement,
  ReturnStatement,
  NoiseTextureParams,
} from './ast.js';
import {
  getVaryingBuiltIns,
  getUniformBuiltIns,
  findBuiltIn,
} from './built-ins.js';

/**
 * Result of transpiling a VSL shader
 */
export interface TranspiledShader {
  /** Generated vertex shader GLSL */
  vertexShader: string;
  /** Generated fragment shader GLSL */
  fragmentShader: string;
  /** Uniforms that need to be provided by the material */
  uniforms: TranspiledUniform[];
  /** Material options based on render modes */
  materialOptions: MaterialOptions;
  /** Original shader type */
  shaderType: ShaderType;
  /** Errors encountered during transpilation */
  errors: TranspileError[];
}

/**
 * Uniform extracted from the shader
 */
export interface TranspiledUniform {
  /** Uniform name */
  name: string;
  /** GLSL type */
  type: GLSLType;
  /** Default value expression (for initialization) */
  defaultValue?: string;
  /** Hint for editor UI */
  hint?: {
    type: string;
    params?: number[];
  };
  /** Noise texture params for hint_default_texture */
  noiseParams?: NoiseTextureParams;
  /** Whether this is a VSL built-in uniform (TIME, etc.) */
  isBuiltIn: boolean;
}

/**
 * THREE.js material options derived from render modes
 */
export interface MaterialOptions {
  /** Whether lighting is enabled */
  lights: boolean;
  /** Blending mode */
  blending?: 'normal' | 'additive' | 'subtractive' | 'multiply';
  /** Whether the material is transparent */
  transparent: boolean;
  /** Depth testing */
  depthTest: boolean;
  /** Depth writing */
  depthWrite: boolean;
  /** Face culling */
  side: 'front' | 'back' | 'double';
}

/**
 * Transpilation error
 */
export interface TranspileError {
  message: string;
  line?: number;
  column?: number;
}

/**
 * Transpiler class for converting VSL AST to GLSL
 */
export class Transpiler {
  private ast: ShaderAST;
  private errors: TranspileError[] = [];
  private indentLevel = 0;

  constructor(ast: ShaderAST) {
    this.ast = ast;
  }

  /**
   * Transpile the AST to THREE.js compatible GLSL
   */
  transpile(): TranspiledShader {
    this.errors = [];

    // Extract uniforms (both user-defined and built-in)
    const uniforms = this.extractUniforms();

    // Generate material options from render modes
    const materialOptions = this.generateMaterialOptions();

    // Generate vertex shader
    const vertexShader = this.generateVertexShader();

    // Generate fragment shader
    const fragmentShader = this.generateFragmentShader();

    return {
      vertexShader,
      fragmentShader,
      uniforms,
      materialOptions,
      shaderType: this.ast.shaderType,
      errors: this.errors,
    };
  }

  /**
   * Get transpilation errors
   */
  getErrors(): TranspileError[] {
    return this.errors;
  }

  // ============================================================================
  // Uniform Extraction
  // ============================================================================

  private extractUniforms(): TranspiledUniform[] {
    const uniforms: TranspiledUniform[] = [];

    // Add built-in uniforms required by this shader type
    const builtInUniforms = getUniformBuiltIns(this.ast.shaderType);
    for (const builtin of builtInUniforms) {
      uniforms.push({
        name: builtin.uniformName || builtin.name,
        type: builtin.type,
        isBuiltIn: true,
      });
    }

    // Add user-defined uniforms
    for (const uniform of this.ast.uniforms) {
      uniforms.push({
        name: uniform.name,
        type: uniform.uniformType,
        defaultValue: uniform.defaultValue
          ? this.transpileExpression(uniform.defaultValue)
          : undefined,
        hint: uniform.hint
          ? {
              type: uniform.hint.type,
              params: uniform.hint.params,
            }
          : undefined,
        noiseParams: uniform.hint?.noiseParams,
        isBuiltIn: false,
      });
    }

    return uniforms;
  }

  // ============================================================================
  // Material Options
  // ============================================================================

  private generateMaterialOptions(): MaterialOptions {
    const modes = this.ast.renderModes;
    const options: MaterialOptions = {
      lights: !modes.includes('unshaded'),
      transparent: true,
      depthTest: !modes.includes('depth_test_disabled'),
      depthWrite: this.getDepthWriteMode(modes),
      side: this.getCullMode(modes),
    };

    // Blending modes
    if (modes.includes('blend_add')) {
      options.blending = 'additive';
    } else if (modes.includes('blend_mul')) {
      options.blending = 'multiply';
    } else if (modes.includes('blend_sub')) {
      options.blending = 'subtractive';
    }

    return options;
  }

  private getDepthWriteMode(modes: RenderMode[]): boolean {
    if (modes.includes('depth_draw_never')) return false;
    if (modes.includes('depth_draw_always')) return true;
    if (modes.includes('depth_draw_opaque')) return true;
    return true;
  }

  private getCullMode(modes: RenderMode[]): 'front' | 'back' | 'double' {
    if (modes.includes('cull_disabled')) return 'double';
    if (modes.includes('cull_front')) return 'back'; // THREE.js FrontSide means cull back
    if (modes.includes('cull_back')) return 'front'; // THREE.js BackSide means cull front
    return 'front'; // Default: cull back faces (THREE.js FrontSide)
  }

  // ============================================================================
  // Vertex Shader Generation
  // ============================================================================

  private generateVertexShader(): string {
    const lines: string[] = [];

    // Note: THREE.js ShaderMaterial automatically injects:
    // - Attributes: position, normal, uv
    // - Uniforms: modelMatrix, modelViewMatrix, projectionMatrix, viewMatrix, normalMatrix, cameraPosition
    // We should NOT declare these ourselves to avoid redefinition errors.
    lines.push('');

    // VSL built-in uniforms
    lines.push('// VSL Built-in Uniforms');
    const builtInUniforms = getUniformBuiltIns(this.ast.shaderType);
    for (const builtin of builtInUniforms) {
      if (builtin.stages.includes('vertex')) {
        lines.push(
          `uniform ${builtin.type} ${builtin.uniformName || builtin.glslMapping};`,
        );
      }
    }
    lines.push('');

    // User-defined uniforms
    if (this.ast.uniforms.length > 0) {
      lines.push('// User Uniforms');
      for (const uniform of this.ast.uniforms) {
        lines.push(`uniform ${uniform.uniformType} ${uniform.name};`);
      }
      lines.push('');
    }

    // Varyings (for passing to fragment shader)
    lines.push('// Varyings');
    const varyings = getVaryingBuiltIns(this.ast.shaderType);
    for (const varying of varyings) {
      lines.push(`varying ${varying.type} ${varying.glslMapping};`);
    }
    // User-defined varyings
    for (const varying of this.ast.varyings) {
      lines.push(`varying ${varying.varyingType} ${varying.name};`);
    }
    lines.push('');

    // Helper functions (user-defined, non-vertex/fragment)
    const helperFunctions = this.ast.functions.filter(
      (f) => f.name !== 'vertex' && f.name !== 'fragment' && f.name !== 'light',
    );
    for (const fn of helperFunctions) {
      lines.push(this.transpileFunction(fn));
      lines.push('');
    }

    // Main function
    lines.push('void main() {');
    this.indentLevel++;

    // Initialize VSL built-in variables from THREE.js attributes
    // Note: varyings (vsl_uv, vsl_color, vsl_normal) are assigned directly
    // Non-varying locals (vsl_vertex) are declared as local variables
    lines.push(this.indent() + '// Initialize VSL built-ins from THREE.js');
    if (this.ast.shaderType === 'canvas_item') {
      lines.push(this.indent() + 'vec2 vsl_vertex = position.xy;');
      // Assign to varyings directly (don't redeclare with vec2/vec4/vec3)
      lines.push(this.indent() + 'vsl_uv = uv;');
      lines.push(this.indent() + 'vsl_color = vec4(1.0);');
      lines.push(this.indent() + 'vsl_normal = normal;');
    } else if (this.ast.shaderType === 'spatial') {
      lines.push(this.indent() + 'vec3 vsl_vertex = position;');
      // Assign to varyings directly (don't redeclare)
      lines.push(this.indent() + 'vsl_uv = uv;');
      lines.push(this.indent() + 'vsl_uv2 = uv;'); // Default to same as UV
      lines.push(this.indent() + 'vsl_color = vec4(1.0);');
      lines.push(this.indent() + 'vsl_normal = normal;');
      lines.push(this.indent() + 'vsl_tangent = vec3(1.0, 0.0, 0.0);');
      lines.push(this.indent() + 'vsl_binormal = vec3(0.0, 1.0, 0.0);');
    }
    lines.push('');

    // Create user-facing aliases for built-ins (VERTEX, UV, COLOR, etc.)
    // These are the names users write in their VSL code
    lines.push(this.indent() + '// Built-in aliases for user code');
    if (this.ast.shaderType === 'canvas_item') {
      lines.push(this.indent() + 'vec2 VERTEX = vsl_vertex;');
      lines.push(this.indent() + 'vec2 UV = vsl_uv;');
      lines.push(this.indent() + 'vec4 COLOR = vsl_color;');
      lines.push(this.indent() + 'vec3 NORMAL = vsl_normal;');
      lines.push(this.indent() + 'float TIME = vsl_time;');
      lines.push(this.indent() + 'float DELTA_TIME = vsl_deltaTime;');
      lines.push(this.indent() + 'vec2 SCREEN_SIZE = vsl_screenSize;');
    } else if (this.ast.shaderType === 'spatial') {
      lines.push(this.indent() + 'vec3 VERTEX = vsl_vertex;');
      lines.push(this.indent() + 'vec2 UV = vsl_uv;');
      lines.push(this.indent() + 'vec2 UV2 = vsl_uv2;');
      lines.push(this.indent() + 'vec4 COLOR = vsl_color;');
      lines.push(this.indent() + 'vec3 NORMAL = vsl_normal;');
      lines.push(this.indent() + 'vec3 TANGENT = vsl_tangent;');
      lines.push(this.indent() + 'vec3 BINORMAL = vsl_binormal;');
      lines.push(this.indent() + 'float TIME = vsl_time;');
      lines.push(this.indent() + 'float DELTA_TIME = vsl_deltaTime;');
      lines.push(this.indent() + 'vec2 SCREEN_SIZE = vsl_screenSize;');
    }
    lines.push('');

    // Call user's vertex function if it exists
    const vertexFn = this.ast.functions.find((f) => f.name === 'vertex');
    if (vertexFn) {
      lines.push(this.indent() + '// User vertex() code');
      for (const stmt of vertexFn.body.body) {
        lines.push(this.transpileStatement(stmt));
      }
      lines.push('');
    }

    // Copy modified user aliases back to varyings for fragment shader
    lines.push(this.indent() + '// Pass modified values to fragment shader');
    if (this.ast.shaderType === 'canvas_item') {
      lines.push(this.indent() + 'vsl_uv = UV;');
      lines.push(this.indent() + 'vsl_color = COLOR;');
      lines.push(this.indent() + 'vsl_normal = NORMAL;');
    } else if (this.ast.shaderType === 'spatial') {
      lines.push(this.indent() + 'vsl_uv = UV;');
      lines.push(this.indent() + 'vsl_uv2 = UV2;');
      lines.push(this.indent() + 'vsl_color = COLOR;');
      lines.push(this.indent() + 'vsl_normal = NORMAL;');
      lines.push(this.indent() + 'vsl_tangent = TANGENT;');
      lines.push(this.indent() + 'vsl_binormal = BINORMAL;');
    }
    lines.push('');

    // Final vertex position calculation (use VERTEX which user may have modified)
    lines.push(this.indent() + '// Calculate final position');
    if (this.ast.shaderType === 'canvas_item') {
      // 2D: Use VERTEX.xy for position, keep z from original
      lines.push(
        this.indent() +
          'vec4 mvPosition = modelViewMatrix * vec4(VERTEX, position.z, 1.0);',
      );
    } else {
      // 3D: Use full VERTEX
      lines.push(
        this.indent() +
          'vec4 mvPosition = modelViewMatrix * vec4(VERTEX, 1.0);',
      );
    }
    lines.push(this.indent() + 'gl_Position = projectionMatrix * mvPosition;');
    lines.push('');
    lines.push(
      this.indent() + '// Pass clip-space position for mesh-relative screen UV',
    );
    lines.push(this.indent() + 'vsl_clipPosition = gl_Position;');
    lines.push('');
    lines.push(
      this.indent() +
        '// Extract model world position from model matrix (translation column)',
    );
    lines.push(this.indent() + 'vsl_modelPosition = vec3(modelMatrix[3].xyz);');
    lines.push('');
    lines.push(
      this.indent() +
        '// Calculate model center screen Y position for reflection effects',
    );
    lines.push(
      this.indent() +
        '// Transform model center (world position) to clip space',
    );
    lines.push(
      this.indent() +
        'vec4 modelCenterClip = projectionMatrix * viewMatrix * vec4(vsl_modelPosition, 1.0);',
    );
    lines.push(
      this.indent() + '// Convert to normalized screen coordinates (0 to 1)',
    );
    lines.push(
      this.indent() +
        'vsl_modelCenterScreenY = (modelCenterClip.y / modelCenterClip.w) * 0.5 + 0.5;',
    );

    this.indentLevel--;
    lines.push('}');

    return lines.join('\n');
  }

  // ============================================================================
  // Fragment Shader Generation
  // ============================================================================

  private generateFragmentShader(): string {
    const lines: string[] = [];

    // Precision
    lines.push('precision highp float;');
    lines.push('');

    // Sampler aliases (must use #define since samplers can't be assigned to variables)
    if (this.ast.shaderType === 'canvas_item') {
      lines.push('// Sampler aliases');
      lines.push('#define TEXTURE map');
      lines.push('');
    }

    // VSL built-in uniforms
    lines.push('// VSL Built-in Uniforms');
    const builtInUniforms = getUniformBuiltIns(this.ast.shaderType);
    for (const builtin of builtInUniforms) {
      if (builtin.stages.includes('fragment')) {
        lines.push(
          `uniform ${builtin.type} ${builtin.uniformName || builtin.glslMapping};`,
        );
      }
    }
    lines.push('');

    // User-defined uniforms
    if (this.ast.uniforms.length > 0) {
      lines.push('// User Uniforms');
      for (const uniform of this.ast.uniforms) {
        lines.push(`uniform ${uniform.uniformType} ${uniform.name};`);
      }
      lines.push('');
    }

    // Varyings (received from vertex shader)
    lines.push('// Varyings');
    const varyings = getVaryingBuiltIns(this.ast.shaderType);
    for (const varying of varyings) {
      lines.push(`varying ${varying.type} ${varying.glslMapping};`);
    }
    // User-defined varyings
    for (const varying of this.ast.varyings) {
      lines.push(`varying ${varying.varyingType} ${varying.name};`);
    }
    lines.push('');

    // Helper functions
    const helperFunctions = this.ast.functions.filter(
      (f) => f.name !== 'vertex' && f.name !== 'fragment' && f.name !== 'light',
    );
    for (const fn of helperFunctions) {
      lines.push(this.transpileFunction(fn));
      lines.push('');
    }

    // Main function
    lines.push('void main() {');
    this.indentLevel++;

    // Initialize VSL built-in variables from varyings
    lines.push(this.indent() + '// Initialize VSL built-ins from varyings');
    if (this.ast.shaderType === 'canvas_item') {
      lines.push(this.indent() + 'vec2 UV = vsl_uv;');
      lines.push(this.indent() + 'vec4 COLOR = vsl_color;');
      lines.push(this.indent() + 'vec3 NORMAL = vsl_normal;');
    } else if (this.ast.shaderType === 'spatial') {
      lines.push(this.indent() + 'vec2 UV = vsl_uv;');
      lines.push(this.indent() + 'vec2 UV2 = vsl_uv2;');
      lines.push(this.indent() + 'vec4 COLOR = vsl_color;');
      lines.push(this.indent() + 'vec3 NORMAL = normalize(vsl_normal);');
      lines.push(this.indent() + 'vec3 TANGENT = vsl_tangent;');
      lines.push(this.indent() + 'vec3 BINORMAL = vsl_binormal;');
      // PBR outputs with defaults
      lines.push(this.indent() + 'vec3 ALBEDO = vec3(1.0);');
      lines.push(this.indent() + 'float ALPHA = 1.0;');
      lines.push(this.indent() + 'float METALLIC = 0.0;');
      lines.push(this.indent() + 'float ROUGHNESS = 0.5;');
      lines.push(this.indent() + 'float SPECULAR = 0.5;');
      lines.push(this.indent() + 'vec3 EMISSION = vec3(0.0);');
      lines.push(this.indent() + 'float AO = 1.0;');
      lines.push(this.indent() + 'vec3 NORMAL_MAP = vec3(0.5, 0.5, 1.0);');
      lines.push(this.indent() + 'float NORMAL_MAP_DEPTH = 1.0;');
    }
    lines.push('');

    // Alias built-ins for Godot-style access
    // Note: TEXTURE is defined via #define at the top since samplers can't be assigned
    lines.push(this.indent() + '// Built-in aliases');
    lines.push(this.indent() + 'float TIME = vsl_time;');
    lines.push(this.indent() + 'float DELTA_TIME = vsl_deltaTime;');
    lines.push(this.indent() + 'vec2 SCREEN_SIZE = vsl_screenSize;');
    if (this.ast.shaderType === 'canvas_item') {
      lines.push(this.indent() + 'vec2 TEXTURE_SIZE = vsl_textureSize;');
      lines.push(
        this.indent() + 'vec2 SCREEN_UV = gl_FragCoord.xy / vsl_screenSize;',
      );
      lines.push(this.indent() + 'vec4 FRAGCOORD = gl_FragCoord;');
      lines.push(this.indent() + 'vec4 CLIP_POSITION = vsl_clipPosition;');
      lines.push(this.indent() + 'vec3 MODEL_POSITION = vsl_modelPosition;');
      lines.push(
        this.indent() + 'float MODEL_CENTER_SCREEN_Y = vsl_modelCenterScreenY;',
      );
    }
    lines.push('');

    // Call user's fragment function if it exists
    const fragmentFn = this.ast.functions.find((f) => f.name === 'fragment');
    if (fragmentFn) {
      lines.push(this.indent() + '// User fragment() code');
      for (const stmt of fragmentFn.body.body) {
        lines.push(this.transpileStatement(stmt));
      }
      lines.push('');
    }

    // Final output
    lines.push(this.indent() + '// Final output');
    if (this.ast.shaderType === 'canvas_item') {
      lines.push(this.indent() + 'gl_FragColor = COLOR;');
    } else if (this.ast.shaderType === 'spatial') {
      // For spatial shaders, we output to gl_FragColor with ALBEDO and ALPHA
      // In a full implementation, this would integrate with THREE.js lighting
      lines.push(
        this.indent() + 'gl_FragColor = vec4(ALBEDO + EMISSION, ALPHA);',
      );
    }

    this.indentLevel--;
    lines.push('}');

    return lines.join('\n');
  }

  // ============================================================================
  // Function Transpilation
  // ============================================================================

  private transpileFunction(fn: FunctionDeclaration): string {
    const params = fn.params
      .map((p) => {
        const qualifier = p.qualifier ? `${p.qualifier} ` : '';
        return `${qualifier}${p.paramType} ${p.name}`;
      })
      .join(', ');

    const lines: string[] = [];
    lines.push(`${fn.returnType} ${fn.name}(${params}) {`);
    this.indentLevel++;

    for (const stmt of fn.body.body) {
      lines.push(this.transpileStatement(stmt));
    }

    this.indentLevel--;
    lines.push('}');

    return lines.join('\n');
  }

  // ============================================================================
  // Statement Transpilation
  // ============================================================================

  private transpileStatement(stmt: Statement): string {
    switch (stmt.type) {
      case 'ExpressionStatement':
        return this.indent() + this.transpileExpression(stmt.expression) + ';';

      case 'VariableDeclaration':
        return this.transpileVariableDeclaration(stmt);

      case 'BlockStatement':
        return this.transpileBlockStatement(stmt);

      case 'IfStatement':
        return this.transpileIfStatement(stmt);

      case 'ForStatement':
        return this.transpileForStatement(stmt);

      case 'WhileStatement':
        return this.transpileWhileStatement(stmt);

      case 'DoWhileStatement':
        return this.transpileDoWhileStatement(stmt);

      case 'ReturnStatement':
        return this.transpileReturnStatement(stmt);

      case 'BreakStatement':
        return this.indent() + 'break;';

      case 'ContinueStatement':
        return this.indent() + 'continue;';

      case 'DiscardStatement':
        return this.indent() + 'discard;';

      default:
        this.errors.push({
          message: `Unknown statement type: ${(stmt as any).type}`,
        });
        return this.indent() + `// Unknown statement: ${(stmt as any).type}`;
    }
  }

  private transpileVariableDeclaration(decl: VariableDeclaration): string {
    const qualifier = decl.qualifier ? `${decl.qualifier} ` : '';
    if (decl.init) {
      return (
        this.indent() +
        `${qualifier}${decl.varType} ${decl.name} = ${this.transpileExpression(decl.init)};`
      );
    }
    return this.indent() + `${qualifier}${decl.varType} ${decl.name};`;
  }

  private transpileBlockStatement(block: BlockStatement): string {
    const lines: string[] = [];
    lines.push(this.indent() + '{');
    this.indentLevel++;
    for (const stmt of block.body) {
      lines.push(this.transpileStatement(stmt));
    }
    this.indentLevel--;
    lines.push(this.indent() + '}');
    return lines.join('\n');
  }

  private transpileIfStatement(stmt: IfStatement): string {
    const lines: string[] = [];
    lines.push(this.indent() + `if (${this.transpileExpression(stmt.test)}) {`);
    this.indentLevel++;
    if (stmt.consequent.type === 'BlockStatement') {
      for (const s of (stmt.consequent as BlockStatement).body) {
        lines.push(this.transpileStatement(s));
      }
    } else {
      lines.push(this.transpileStatement(stmt.consequent));
    }
    this.indentLevel--;

    if (stmt.alternate) {
      if (stmt.alternate.type === 'IfStatement') {
        lines.push(
          this.indent() +
            '} else ' +
            this.transpileIfStatement(stmt.alternate as IfStatement).trim(),
        );
      } else {
        lines.push(this.indent() + '} else {');
        this.indentLevel++;
        if (stmt.alternate.type === 'BlockStatement') {
          for (const s of (stmt.alternate as BlockStatement).body) {
            lines.push(this.transpileStatement(s));
          }
        } else {
          lines.push(this.transpileStatement(stmt.alternate));
        }
        this.indentLevel--;
        lines.push(this.indent() + '}');
      }
    } else {
      lines.push(this.indent() + '}');
    }

    return lines.join('\n');
  }

  private transpileForStatement(stmt: ForStatement): string {
    const lines: string[] = [];

    // Init
    let initStr = '';
    if (stmt.init) {
      if (stmt.init.type === 'VariableDeclaration') {
        const decl = stmt.init as VariableDeclaration;
        initStr = decl.init
          ? `${decl.varType} ${decl.name} = ${this.transpileExpression(decl.init)}`
          : `${decl.varType} ${decl.name}`;
      } else {
        initStr = this.transpileExpression((stmt.init as any).expression);
      }
    }

    // Test
    const testStr = stmt.test ? this.transpileExpression(stmt.test) : '';

    // Update
    const updateStr = stmt.update ? this.transpileExpression(stmt.update) : '';

    lines.push(this.indent() + `for (${initStr}; ${testStr}; ${updateStr}) {`);
    this.indentLevel++;

    if (stmt.body.type === 'BlockStatement') {
      for (const s of (stmt.body as BlockStatement).body) {
        lines.push(this.transpileStatement(s));
      }
    } else {
      lines.push(this.transpileStatement(stmt.body));
    }

    this.indentLevel--;
    lines.push(this.indent() + '}');

    return lines.join('\n');
  }

  private transpileWhileStatement(stmt: WhileStatement): string {
    const lines: string[] = [];
    lines.push(
      this.indent() + `while (${this.transpileExpression(stmt.test)}) {`,
    );
    this.indentLevel++;

    if (stmt.body.type === 'BlockStatement') {
      for (const s of (stmt.body as BlockStatement).body) {
        lines.push(this.transpileStatement(s));
      }
    } else {
      lines.push(this.transpileStatement(stmt.body));
    }

    this.indentLevel--;
    lines.push(this.indent() + '}');

    return lines.join('\n');
  }

  private transpileDoWhileStatement(stmt: DoWhileStatement): string {
    const lines: string[] = [];
    lines.push(this.indent() + 'do {');
    this.indentLevel++;

    if (stmt.body.type === 'BlockStatement') {
      for (const s of (stmt.body as BlockStatement).body) {
        lines.push(this.transpileStatement(s));
      }
    } else {
      lines.push(this.transpileStatement(stmt.body));
    }

    this.indentLevel--;
    lines.push(
      this.indent() + `} while (${this.transpileExpression(stmt.test)});`,
    );

    return lines.join('\n');
  }

  private transpileReturnStatement(stmt: ReturnStatement): string {
    if (stmt.argument) {
      return (
        this.indent() + `return ${this.transpileExpression(stmt.argument)};`
      );
    }
    return this.indent() + 'return;';
  }

  // ============================================================================
  // Expression Transpilation
  // ============================================================================

  private transpileExpression(expr: Expression): string {
    switch (expr.type) {
      case 'BoolLiteral':
        return expr.value ? 'true' : 'false';

      case 'IntLiteral':
        return String(expr.value);

      case 'FloatLiteral': // Ensure float literal has decimal point
      {
        const floatStr = String(expr.value);
        return floatStr.includes('.') ? floatStr : floatStr + '.0';
      }

      case 'VectorLiteral':
        return this.transpileVectorLiteral(expr);

      case 'Identifier':
        return this.transpileIdentifier(expr);

      case 'MemberExpression':
        return this.transpileMemberExpression(expr);

      case 'IndexExpression':
        return this.transpileIndexExpression(expr);

      case 'CallExpression':
        return this.transpileCallExpression(expr);

      case 'UnaryExpression':
        return this.transpileUnaryExpression(expr);

      case 'BinaryExpression':
        return this.transpileBinaryExpression(expr);

      case 'AssignmentExpression':
        return this.transpileAssignmentExpression(expr);

      case 'ConditionalExpression':
        return this.transpileConditionalExpression(expr);

      default:
        this.errors.push({
          message: `Unknown expression type: ${(expr as any).type}`,
        });
        return `/* unknown: ${(expr as any).type} */`;
    }
  }

  private transpileVectorLiteral(expr: VectorLiteral): string {
    const components = expr.components
      .map((c) => this.transpileExpression(c))
      .join(', ');
    return `${expr.vectorType}(${components})`;
  }

  private transpileIdentifier(expr: Identifier): string {
    // Map VSL built-in names to GLSL names
    const builtin = findBuiltIn(this.ast.shaderType, expr.name);
    if (builtin) {
      // Some built-ins need special handling
      if (builtin.isUniform && builtin.uniformName) {
        return builtin.uniformName;
      }
      // For fragment stage, use the local variables we created (UV, COLOR, etc.)
      // Return the name as-is since we create locals with the same name
      return expr.name;
    }
    return expr.name;
  }

  private transpileMemberExpression(expr: MemberExpression): string {
    const obj = this.transpileExpression(expr.object);
    return `${obj}.${expr.property.name}`;
  }

  private transpileIndexExpression(expr: IndexExpression): string {
    const obj = this.transpileExpression(expr.object);
    const index = this.transpileExpression(expr.index);
    return `${obj}[${index}]`;
  }

  private transpileCallExpression(expr: CallExpression): string {
    let callee = this.transpileExpression(expr.callee);
    const args = expr.arguments
      .map((a) => this.transpileExpression(a))
      .join(', ');

    // Map GLSL ES 3.0 functions to WebGL1 (GLSL ES 1.0) equivalents
    // THREE.js uses WebGL1 by default, which requires texture2D instead of texture
    if (callee === 'texture') {
      callee = 'texture2D';
    } else if (callee === 'textureLod') {
      callee = 'texture2DLodEXT';
    }

    return `${callee}(${args})`;
  }

  private transpileUnaryExpression(expr: UnaryExpression): string {
    const arg = this.transpileExpression(expr.argument);
    if (expr.prefix) {
      return `${expr.operator}${arg}`;
    }
    return `${arg}${expr.operator}`;
  }

  private transpileBinaryExpression(expr: BinaryExpression): string {
    const left = this.transpileExpression(expr.left);
    const right = this.transpileExpression(expr.right);
    return `(${left} ${expr.operator} ${right})`;
  }

  private transpileAssignmentExpression(expr: AssignmentExpression): string {
    const left = this.transpileExpression(expr.left);
    const right = this.transpileExpression(expr.right);
    return `${left} ${expr.operator} ${right}`;
  }

  private transpileConditionalExpression(expr: ConditionalExpression): string {
    const test = this.transpileExpression(expr.test);
    const consequent = this.transpileExpression(expr.consequent);
    const alternate = this.transpileExpression(expr.alternate);
    return `(${test} ? ${consequent} : ${alternate})`;
  }

  // ============================================================================
  // Helpers
  // ============================================================================

  private indent(): string {
    return '    '.repeat(this.indentLevel);
  }
}

/**
 * Transpile VSL source code to THREE.js GLSL
 *
 * @param ast - Parsed VSL AST
 * @returns Transpiled shader with vertex/fragment GLSL and uniforms
 */
export function transpile(ast: ShaderAST): TranspiledShader {
  const transpiler = new Transpiler(ast);
  return transpiler.transpile();
}

/**
 * Parse and transpile VSL source code in one step
 */
export async function parseAndTranspile(
  source: string,
): Promise<TranspiledShader> {
  // Dynamic import to avoid circular dependency
  const { parse } = await import('./parser.js');
  const ast = parse(source);
  return transpile(ast);
}
