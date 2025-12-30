/**
 * VoidShader Language (VSL) Module
 *
 * A Godot-inspired shader language that transpiles to THREE.js GLSL.
 * Provides lexer, parser, AST types, built-ins, and transpiler.
 */

// AST types
export type {
  ShaderType,
  CanvasItemRenderMode,
  SpatialRenderMode,
  RenderMode,
  GLSLType,
  UniformHintType,
  UniformHint,
  SourceLocation,
  SourceRange,
  ASTNode,
  BoolLiteral,
  IntLiteral,
  FloatLiteral,
  VectorLiteral,
  Literal,
  Identifier,
  MemberExpression,
  IndexExpression,
  CallExpression,
  UnaryExpression,
  BinaryExpression,
  AssignmentExpression,
  ConditionalExpression,
  Expression,
  ExpressionStatement,
  VariableDeclaration,
  BlockStatement,
  IfStatement,
  ForStatement,
  WhileStatement,
  DoWhileStatement,
  ReturnStatement,
  BreakStatement,
  ContinueStatement,
  DiscardStatement,
  Statement,
  UniformDeclaration,
  VaryingDeclaration,
  IncludeDirective,
  FunctionParameter,
  FunctionDeclaration,
  ShaderTypeDeclaration,
  RenderModeDeclaration,
  Declaration,
  ShaderAST,
} from './ast.js';

export {
  isSamplerType,
  isVectorType,
  isMatrixType,
  getVectorComponentCount,
  createEmptyShaderAST,
  findFunction,
  hasVertexFunction,
  hasFragmentFunction,
  hasLightFunction,
} from './ast.js';

// Lexer
export type { TokenType, Token } from './lexer.js';
export { Lexer, tokenize } from './lexer.js';

// Parser
export type { ParseError } from './parser.js';
export { Parser, parse } from './parser.js';

// Built-ins
export type {
  ShaderStage,
  BuiltInVariable,
  BuiltInFunction,
} from './built-ins.js';

export {
  CANVAS_ITEM_BUILTINS,
  SPATIAL_BUILTINS,
  PARTICLES_BUILTINS,
  BUILTIN_FUNCTIONS,
  getBuiltInsForShaderType,
  getBuiltInsForStage,
  getWritableBuiltIns,
  getReadOnlyBuiltIns,
  getVaryingBuiltIns,
  getUniformBuiltIns,
  findBuiltIn,
  isBuiltInVariable,
  isBuiltInFunction,
  findBuiltInFunction,
  getBuiltInType,
  getRequiredVSLUniforms,
} from './built-ins.js';

// Transpiler
export type {
  TranspiledShader,
  TranspiledUniform,
  MaterialOptions,
  TranspileError,
} from './transpiler.js';

export { Transpiler, transpile, parseAndTranspile } from './transpiler.js';
