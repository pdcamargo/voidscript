/**
 * VoidShader Language (VSL) - Parser
 *
 * Parses tokens into an Abstract Syntax Tree (AST).
 * Uses recursive descent parsing for GLSL-like grammar.
 */

import { Lexer, Token, TokenType, TYPES, SHADER_TYPES, UNIFORM_HINTS } from './lexer.js';
import type {
  ShaderAST,
  ShaderType,
  RenderMode,
  GLSLType,
  UniformHint,
  UniformHintType,
  Declaration,
  UniformDeclaration,
  VaryingDeclaration,
  IncludeDirective,
  FunctionDeclaration,
  FunctionParameter,
  Statement,
  BlockStatement,
  VariableDeclaration,
  ExpressionStatement,
  IfStatement,
  ForStatement,
  WhileStatement,
  DoWhileStatement,
  ReturnStatement,
  Expression,
  Identifier,
  Literal,
  BinaryExpression,
  UnaryExpression,
  CallExpression,
  MemberExpression,
  IndexExpression,
  AssignmentExpression,
  ConditionalExpression,
  VectorLiteral,
  SourceRange,
} from './ast.js';
import { createEmptyShaderAST } from './ast.js';

/**
 * Parser error with location information
 */
export class ParseError extends Error {
  constructor(
    message: string,
    public line: number,
    public column: number,
  ) {
    super(`[VSL Parse Error] Line ${line}, Column ${column}: ${message}`);
    this.name = 'ParseError';
  }
}

/**
 * VSL Parser
 *
 * Parses VoidShader source code into an AST.
 */
export class Parser {
  private tokens: Token[] = [];
  private current: number = 0;
  private errors: ParseError[] = [];

  /**
   * Parse VSL source code into an AST
   */
  parse(source: string): ShaderAST {
    // Tokenize
    const lexer = new Lexer(source);
    this.tokens = lexer.tokenize();
    this.current = 0;
    this.errors = [];

    // Create AST
    const ast = createEmptyShaderAST();

    // Parse declarations
    while (!this.isAtEnd()) {
      try {
        const decl = this.parseDeclaration();
        if (decl) {
          this.addDeclaration(ast, decl);
        }
      } catch (e) {
        if (e instanceof ParseError) {
          this.errors.push(e);
          this.synchronize();
        } else {
          throw e;
        }
      }
    }

    // Check for required shader_type
    if (ast.shaderType === 'canvas_item' && !this.hasShaderType) {
      // Default to canvas_item if not specified
    }

    return ast;
  }

  private hasShaderType = false;

  /**
   * Add a declaration to the appropriate AST array
   */
  private addDeclaration(ast: ShaderAST, decl: Declaration): void {
    switch (decl.type) {
      case 'ShaderTypeDeclaration':
        ast.shaderType = decl.shaderType;
        this.hasShaderType = true;
        break;
      case 'RenderModeDeclaration':
        ast.renderModes.push(...decl.modes);
        break;
      case 'UniformDeclaration':
        ast.uniforms.push(decl);
        break;
      case 'VaryingDeclaration':
        ast.varyings.push(decl);
        break;
      case 'IncludeDirective':
        ast.includes.push(decl);
        break;
      case 'FunctionDeclaration':
        ast.functions.push(decl);
        break;
    }
  }

  /**
   * Parse a top-level declaration
   */
  private parseDeclaration(): Declaration | null {
    // #include "path"
    if (this.check(TokenType.Hash)) {
      return this.parseInclude();
    }

    // shader_type
    if (this.checkKeyword('shader_type')) {
      return this.parseShaderType();
    }

    // render_mode
    if (this.checkKeyword('render_mode')) {
      return this.parseRenderMode();
    }

    // uniform
    if (this.checkKeyword('uniform')) {
      return this.parseUniform();
    }

    // varying
    if (this.checkKeyword('varying')) {
      return this.parseVarying();
    }

    // Function declaration (type name(...) { ... })
    if (this.check(TokenType.Type) || this.check(TokenType.Identifier)) {
      // Look ahead to see if this is a function
      if (this.isFunction()) {
        return this.parseFunction();
      }
    }

    // Skip unknown tokens
    this.advance();
    return null;
  }

  /**
   * Check if current position is a function declaration
   */
  private isFunction(): boolean {
    // Save position
    const saved = this.current;

    // Try to match: type name (
    if (this.check(TokenType.Type) || this.check(TokenType.Identifier)) {
      this.advance();
      if (this.check(TokenType.Identifier)) {
        this.advance();
        if (this.check(TokenType.LeftParen)) {
          this.current = saved;
          return true;
        }
      }
    }

    this.current = saved;
    return false;
  }

  // ============================================================================
  // Declaration Parsers
  // ============================================================================

  /**
   * Parse: #include "path"
   */
  private parseInclude(): IncludeDirective {
    const start = this.peek().location;
    this.advance(); // #

    if (!this.checkKeyword('include')) {
      throw this.error('Expected "include" after #');
    }
    this.advance(); // include

    if (!this.check(TokenType.StringLiteral)) {
      throw this.error('Expected string path after #include');
    }
    const path = this.advance().value;

    return {
      type: 'IncludeDirective',
      path,
      location: this.makeRange(start),
    };
  }

  /**
   * Parse: shader_type canvas_item;
   */
  private parseShaderType(): Declaration {
    const start = this.peek().location;
    this.advance(); // shader_type

    if (!this.check(TokenType.Identifier)) {
      throw this.error('Expected shader type (canvas_item, spatial, particles)');
    }

    const typeName = this.advance().value;
    if (!SHADER_TYPES.has(typeName)) {
      throw this.error(
        `Unknown shader type "${typeName}". Expected: canvas_item, spatial, or particles`,
      );
    }

    this.consume(TokenType.Semicolon, 'Expected ";" after shader_type');

    return {
      type: 'ShaderTypeDeclaration',
      shaderType: typeName as ShaderType,
      location: this.makeRange(start),
    };
  }

  /**
   * Parse: render_mode mode1, mode2, ...;
   */
  private parseRenderMode(): Declaration {
    const start = this.peek().location;
    this.advance(); // render_mode

    const modes: RenderMode[] = [];

    do {
      if (!this.check(TokenType.Identifier)) {
        throw this.error('Expected render mode identifier');
      }
      modes.push(this.advance().value as RenderMode);
    } while (this.match(TokenType.Comma));

    this.consume(TokenType.Semicolon, 'Expected ";" after render_mode');

    return {
      type: 'RenderModeDeclaration',
      modes,
      location: this.makeRange(start),
    };
  }

  /**
   * Parse: uniform type name : hint = value;
   */
  private parseUniform(): UniformDeclaration {
    const start = this.peek().location;
    this.advance(); // uniform

    // Type
    if (!this.check(TokenType.Type)) {
      throw this.error('Expected type after "uniform"');
    }
    const uniformType = this.advance().value as GLSLType;

    // Name
    if (!this.check(TokenType.Identifier)) {
      throw this.error('Expected uniform name');
    }
    const name = this.advance().value;

    // Optional hint
    let hint: UniformHint | undefined;
    if (this.match(TokenType.Colon)) {
      hint = this.parseUniformHint();
    }

    // Optional default value
    let defaultValue: Expression | undefined;
    if (this.match(TokenType.Equals)) {
      defaultValue = this.parseExpression();
    }

    this.consume(TokenType.Semicolon, 'Expected ";" after uniform declaration');

    return {
      type: 'UniformDeclaration',
      uniformType,
      name,
      hint,
      defaultValue,
      location: this.makeRange(start),
    };
  }

  /**
   * Parse uniform hint: hint_range(0.0, 1.0) or source_color
   */
  private parseUniformHint(): UniformHint {
    if (!this.check(TokenType.Identifier)) {
      throw this.error('Expected hint identifier');
    }

    const hintName = this.advance().value;
    if (!UNIFORM_HINTS.has(hintName)) {
      throw this.error(`Unknown uniform hint "${hintName}"`);
    }

    const hint: UniformHint = {
      type: hintName as UniformHintType,
    };

    // Check for parameters (e.g., hint_range(0.0, 1.0))
    if (this.match(TokenType.LeftParen)) {
      hint.params = [];
      do {
        // Parse number
        if (
          this.check(TokenType.IntLiteral) ||
          this.check(TokenType.FloatLiteral)
        ) {
          hint.params.push(parseFloat(this.advance().value));
        } else if (this.check(TokenType.Minus)) {
          // Handle negative numbers
          this.advance();
          if (
            this.check(TokenType.IntLiteral) ||
            this.check(TokenType.FloatLiteral)
          ) {
            hint.params.push(-parseFloat(this.advance().value));
          }
        }
      } while (this.match(TokenType.Comma));

      this.consume(TokenType.RightParen, 'Expected ")" after hint parameters');
    }

    return hint;
  }

  /**
   * Parse: varying type name;
   */
  private parseVarying(): VaryingDeclaration {
    const start = this.peek().location;
    this.advance(); // varying

    if (!this.check(TokenType.Type)) {
      throw this.error('Expected type after "varying"');
    }
    const varyingType = this.advance().value as GLSLType;

    if (!this.check(TokenType.Identifier)) {
      throw this.error('Expected varying name');
    }
    const name = this.advance().value;

    this.consume(TokenType.Semicolon, 'Expected ";" after varying declaration');

    return {
      type: 'VaryingDeclaration',
      varyingType,
      name,
      location: this.makeRange(start),
    };
  }

  /**
   * Parse function declaration
   */
  private parseFunction(): FunctionDeclaration {
    const start = this.peek().location;

    // Return type
    const returnType = this.advance().value as GLSLType;

    // Function name
    if (!this.check(TokenType.Identifier)) {
      throw this.error('Expected function name');
    }
    const name = this.advance().value;

    // Parameters
    this.consume(TokenType.LeftParen, 'Expected "(" after function name');
    const params = this.parseFunctionParams();
    this.consume(TokenType.RightParen, 'Expected ")" after parameters');

    // Body
    const body = this.parseBlock();

    return {
      type: 'FunctionDeclaration',
      name,
      returnType,
      params,
      body,
      location: this.makeRange(start),
    };
  }

  /**
   * Parse function parameters
   */
  private parseFunctionParams(): FunctionParameter[] {
    const params: FunctionParameter[] = [];

    if (this.check(TokenType.RightParen)) {
      return params;
    }

    do {
      const param = this.parseFunctionParam();
      params.push(param);
    } while (this.match(TokenType.Comma));

    return params;
  }

  /**
   * Parse single function parameter
   */
  private parseFunctionParam(): FunctionParameter {
    const start = this.peek().location;

    // Optional qualifier (in, out, inout)
    let qualifier: 'in' | 'out' | 'inout' | undefined;
    if (this.checkKeyword('in') || this.checkKeyword('out') || this.checkKeyword('inout')) {
      qualifier = this.advance().value as 'in' | 'out' | 'inout';
    }

    // Type
    if (!this.check(TokenType.Type)) {
      throw this.error('Expected parameter type');
    }
    const paramType = this.advance().value as GLSLType;

    // Name
    if (!this.check(TokenType.Identifier)) {
      throw this.error('Expected parameter name');
    }
    const name = this.advance().value;

    return {
      type: 'FunctionParameter',
      paramType,
      name,
      qualifier,
      location: this.makeRange(start),
    };
  }

  // ============================================================================
  // Statement Parsers
  // ============================================================================

  /**
   * Parse a block statement { ... }
   */
  private parseBlock(): BlockStatement {
    const start = this.peek().location;
    this.consume(TokenType.LeftBrace, 'Expected "{"');

    const body: Statement[] = [];
    while (!this.check(TokenType.RightBrace) && !this.isAtEnd()) {
      const stmt = this.parseStatement();
      if (stmt) {
        body.push(stmt);
      }
    }

    this.consume(TokenType.RightBrace, 'Expected "}"');

    return {
      type: 'BlockStatement',
      body,
      location: this.makeRange(start),
    };
  }

  /**
   * Parse a statement
   */
  private parseStatement(): Statement | null {
    // Block
    if (this.check(TokenType.LeftBrace)) {
      return this.parseBlock();
    }

    // If
    if (this.checkKeyword('if')) {
      return this.parseIf();
    }

    // For
    if (this.checkKeyword('for')) {
      return this.parseFor();
    }

    // While
    if (this.checkKeyword('while')) {
      return this.parseWhile();
    }

    // Do-while
    if (this.checkKeyword('do')) {
      return this.parseDoWhile();
    }

    // Return
    if (this.checkKeyword('return')) {
      return this.parseReturn();
    }

    // Break
    if (this.checkKeyword('break')) {
      const start = this.peek().location;
      this.advance();
      this.consume(TokenType.Semicolon, 'Expected ";" after break');
      return { type: 'BreakStatement', location: this.makeRange(start) };
    }

    // Continue
    if (this.checkKeyword('continue')) {
      const start = this.peek().location;
      this.advance();
      this.consume(TokenType.Semicolon, 'Expected ";" after continue');
      return { type: 'ContinueStatement', location: this.makeRange(start) };
    }

    // Discard
    if (this.checkKeyword('discard')) {
      const start = this.peek().location;
      this.advance();
      this.consume(TokenType.Semicolon, 'Expected ";" after discard');
      return { type: 'DiscardStatement', location: this.makeRange(start) };
    }

    // Variable declaration or expression statement
    if (this.check(TokenType.Type) || this.checkKeyword('const')) {
      return this.parseVariableDeclaration();
    }

    // Expression statement
    return this.parseExpressionStatement();
  }

  /**
   * Parse variable declaration
   */
  private parseVariableDeclaration(): VariableDeclaration {
    const start = this.peek().location;

    // Optional const
    let qualifier: 'const' | undefined;
    if (this.checkKeyword('const')) {
      qualifier = 'const';
      this.advance();
    }

    // Type
    if (!this.check(TokenType.Type)) {
      throw this.error('Expected type');
    }
    const varType = this.advance().value as GLSLType;

    // Name
    if (!this.check(TokenType.Identifier)) {
      throw this.error('Expected variable name');
    }
    const name = this.advance().value;

    // Optional initializer
    let init: Expression | undefined;
    if (this.match(TokenType.Equals)) {
      init = this.parseExpression();
    }

    this.consume(TokenType.Semicolon, 'Expected ";" after variable declaration');

    return {
      type: 'VariableDeclaration',
      varType,
      name,
      init,
      qualifier,
      location: this.makeRange(start),
    };
  }

  /**
   * Parse if statement
   */
  private parseIf(): IfStatement {
    const start = this.peek().location;
    this.advance(); // if

    this.consume(TokenType.LeftParen, 'Expected "(" after if');
    const test = this.parseExpression();
    this.consume(TokenType.RightParen, 'Expected ")" after condition');

    const consequent = this.parseStatement()!;

    let alternate: Statement | undefined;
    if (this.checkKeyword('else')) {
      this.advance();
      alternate = this.parseStatement()!;
    }

    return {
      type: 'IfStatement',
      test,
      consequent,
      alternate,
      location: this.makeRange(start),
    };
  }

  /**
   * Parse for statement
   */
  private parseFor(): ForStatement {
    const start = this.peek().location;
    this.advance(); // for

    this.consume(TokenType.LeftParen, 'Expected "(" after for');

    // Init (optional)
    let init: VariableDeclaration | ExpressionStatement | undefined;
    if (!this.check(TokenType.Semicolon)) {
      if (this.check(TokenType.Type)) {
        init = this.parseVariableDeclaration();
        // Note: parseVariableDeclaration already consumes semicolon
      } else {
        const expr = this.parseExpression();
        this.consume(TokenType.Semicolon, 'Expected ";" after for init');
        init = { type: 'ExpressionStatement', expression: expr };
      }
    } else {
      this.advance(); // consume ;
    }

    // Test (optional)
    let test: Expression | undefined;
    if (!this.check(TokenType.Semicolon)) {
      test = this.parseExpression();
    }
    this.consume(TokenType.Semicolon, 'Expected ";" after for condition');

    // Update (optional)
    let update: Expression | undefined;
    if (!this.check(TokenType.RightParen)) {
      update = this.parseExpression();
    }

    this.consume(TokenType.RightParen, 'Expected ")" after for clauses');

    const body = this.parseStatement()!;

    return {
      type: 'ForStatement',
      init,
      test,
      update,
      body,
      location: this.makeRange(start),
    };
  }

  /**
   * Parse while statement
   */
  private parseWhile(): WhileStatement {
    const start = this.peek().location;
    this.advance(); // while

    this.consume(TokenType.LeftParen, 'Expected "(" after while');
    const test = this.parseExpression();
    this.consume(TokenType.RightParen, 'Expected ")" after condition');

    const body = this.parseStatement()!;

    return {
      type: 'WhileStatement',
      test,
      body,
      location: this.makeRange(start),
    };
  }

  /**
   * Parse do-while statement
   */
  private parseDoWhile(): DoWhileStatement {
    const start = this.peek().location;
    this.advance(); // do

    const body = this.parseStatement()!;

    if (!this.checkKeyword('while')) {
      throw this.error('Expected "while" after do body');
    }
    this.advance();

    this.consume(TokenType.LeftParen, 'Expected "(" after while');
    const test = this.parseExpression();
    this.consume(TokenType.RightParen, 'Expected ")" after condition');
    this.consume(TokenType.Semicolon, 'Expected ";" after do-while');

    return {
      type: 'DoWhileStatement',
      body,
      test,
      location: this.makeRange(start),
    };
  }

  /**
   * Parse return statement
   */
  private parseReturn(): ReturnStatement {
    const start = this.peek().location;
    this.advance(); // return

    let argument: Expression | undefined;
    if (!this.check(TokenType.Semicolon)) {
      argument = this.parseExpression();
    }

    this.consume(TokenType.Semicolon, 'Expected ";" after return');

    return {
      type: 'ReturnStatement',
      argument,
      location: this.makeRange(start),
    };
  }

  /**
   * Parse expression statement
   */
  private parseExpressionStatement(): ExpressionStatement {
    const start = this.peek().location;
    const expression = this.parseExpression();
    this.consume(TokenType.Semicolon, 'Expected ";" after expression');

    return {
      type: 'ExpressionStatement',
      expression,
      location: this.makeRange(start),
    };
  }

  // ============================================================================
  // Expression Parsers (Precedence Climbing)
  // ============================================================================

  /**
   * Parse expression
   */
  private parseExpression(): Expression {
    return this.parseAssignment();
  }

  /**
   * Parse assignment expression
   */
  private parseAssignment(): Expression {
    const expr = this.parseTernary();

    if (
      this.check(TokenType.Equals) ||
      this.check(TokenType.PlusEquals) ||
      this.check(TokenType.MinusEquals) ||
      this.check(TokenType.StarEquals) ||
      this.check(TokenType.SlashEquals) ||
      this.check(TokenType.PercentEquals) ||
      this.check(TokenType.AmpersandEquals) ||
      this.check(TokenType.PipeEquals) ||
      this.check(TokenType.CaretEquals)
    ) {
      const operator = this.advance().value as AssignmentExpression['operator'];
      const right = this.parseAssignment();
      return {
        type: 'AssignmentExpression',
        operator,
        left: expr,
        right,
      };
    }

    return expr;
  }

  /**
   * Parse ternary expression (? :)
   */
  private parseTernary(): Expression {
    const expr = this.parseLogicalOr();

    if (this.match(TokenType.Question)) {
      const consequent = this.parseExpression();
      this.consume(TokenType.Colon, 'Expected ":" in ternary expression');
      const alternate = this.parseTernary();
      return {
        type: 'ConditionalExpression',
        test: expr,
        consequent,
        alternate,
      };
    }

    return expr;
  }

  /**
   * Parse logical OR (||)
   */
  private parseLogicalOr(): Expression {
    let left = this.parseLogicalAnd();

    while (this.match(TokenType.PipePipe)) {
      const right = this.parseLogicalAnd();
      left = {
        type: 'BinaryExpression',
        operator: '||',
        left,
        right,
      };
    }

    return left;
  }

  /**
   * Parse logical AND (&&)
   */
  private parseLogicalAnd(): Expression {
    let left = this.parseBitwiseOr();

    while (this.match(TokenType.AmpersandAmpersand)) {
      const right = this.parseBitwiseOr();
      left = {
        type: 'BinaryExpression',
        operator: '&&',
        left,
        right,
      };
    }

    return left;
  }

  /**
   * Parse bitwise OR (|)
   */
  private parseBitwiseOr(): Expression {
    let left = this.parseBitwiseXor();

    while (this.match(TokenType.Pipe)) {
      const right = this.parseBitwiseXor();
      left = {
        type: 'BinaryExpression',
        operator: '|',
        left,
        right,
      };
    }

    return left;
  }

  /**
   * Parse bitwise XOR (^)
   */
  private parseBitwiseXor(): Expression {
    let left = this.parseBitwiseAnd();

    while (this.match(TokenType.Caret)) {
      const right = this.parseBitwiseAnd();
      left = {
        type: 'BinaryExpression',
        operator: '^',
        left,
        right,
      };
    }

    return left;
  }

  /**
   * Parse bitwise AND (&)
   */
  private parseBitwiseAnd(): Expression {
    let left = this.parseEquality();

    while (this.match(TokenType.Ampersand)) {
      const right = this.parseEquality();
      left = {
        type: 'BinaryExpression',
        operator: '&',
        left,
        right,
      };
    }

    return left;
  }

  /**
   * Parse equality (== !=)
   */
  private parseEquality(): Expression {
    let left = this.parseComparison();

    while (true) {
      if (this.match(TokenType.EqualsEquals)) {
        const right = this.parseComparison();
        left = { type: 'BinaryExpression', operator: '==', left, right };
      } else if (this.match(TokenType.BangEquals)) {
        const right = this.parseComparison();
        left = { type: 'BinaryExpression', operator: '!=', left, right };
      } else {
        break;
      }
    }

    return left;
  }

  /**
   * Parse comparison (< <= > >=)
   */
  private parseComparison(): Expression {
    let left = this.parseShift();

    while (true) {
      if (this.match(TokenType.Less)) {
        const right = this.parseShift();
        left = { type: 'BinaryExpression', operator: '<', left, right };
      } else if (this.match(TokenType.LessEquals)) {
        const right = this.parseShift();
        left = { type: 'BinaryExpression', operator: '<=', left, right };
      } else if (this.match(TokenType.Greater)) {
        const right = this.parseShift();
        left = { type: 'BinaryExpression', operator: '>', left, right };
      } else if (this.match(TokenType.GreaterEquals)) {
        const right = this.parseShift();
        left = { type: 'BinaryExpression', operator: '>=', left, right };
      } else {
        break;
      }
    }

    return left;
  }

  /**
   * Parse shift (<< >>)
   */
  private parseShift(): Expression {
    let left = this.parseAdditive();

    while (true) {
      if (this.match(TokenType.LessLess)) {
        const right = this.parseAdditive();
        left = { type: 'BinaryExpression', operator: '<<', left, right };
      } else if (this.match(TokenType.GreaterGreater)) {
        const right = this.parseAdditive();
        left = { type: 'BinaryExpression', operator: '>>', left, right };
      } else {
        break;
      }
    }

    return left;
  }

  /**
   * Parse additive (+ -)
   */
  private parseAdditive(): Expression {
    let left = this.parseMultiplicative();

    while (true) {
      if (this.match(TokenType.Plus)) {
        const right = this.parseMultiplicative();
        left = { type: 'BinaryExpression', operator: '+', left, right };
      } else if (this.match(TokenType.Minus)) {
        const right = this.parseMultiplicative();
        left = { type: 'BinaryExpression', operator: '-', left, right };
      } else {
        break;
      }
    }

    return left;
  }

  /**
   * Parse multiplicative (* / %)
   */
  private parseMultiplicative(): Expression {
    let left = this.parseUnary();

    while (true) {
      if (this.match(TokenType.Star)) {
        const right = this.parseUnary();
        left = { type: 'BinaryExpression', operator: '*', left, right };
      } else if (this.match(TokenType.Slash)) {
        const right = this.parseUnary();
        left = { type: 'BinaryExpression', operator: '/', left, right };
      } else if (this.match(TokenType.Percent)) {
        const right = this.parseUnary();
        left = { type: 'BinaryExpression', operator: '%', left, right };
      } else {
        break;
      }
    }

    return left;
  }

  /**
   * Parse unary (- + ! ~ ++ --)
   */
  private parseUnary(): Expression {
    if (
      this.check(TokenType.Minus) ||
      this.check(TokenType.Plus) ||
      this.check(TokenType.Bang) ||
      this.check(TokenType.Tilde) ||
      this.check(TokenType.PlusPlus) ||
      this.check(TokenType.MinusMinus)
    ) {
      const operator = this.advance().value as UnaryExpression['operator'];
      const argument = this.parseUnary();
      return {
        type: 'UnaryExpression',
        operator,
        argument,
        prefix: true,
      };
    }

    return this.parsePostfix();
  }

  /**
   * Parse postfix (++ -- . [] ())
   */
  private parsePostfix(): Expression {
    let expr = this.parsePrimary();

    while (true) {
      if (this.match(TokenType.PlusPlus)) {
        expr = {
          type: 'UnaryExpression',
          operator: '++',
          argument: expr,
          prefix: false,
        };
      } else if (this.match(TokenType.MinusMinus)) {
        expr = {
          type: 'UnaryExpression',
          operator: '--',
          argument: expr,
          prefix: false,
        };
      } else if (this.match(TokenType.Dot)) {
        if (!this.check(TokenType.Identifier)) {
          throw this.error('Expected property name after "."');
        }
        const property: Identifier = {
          type: 'Identifier',
          name: this.advance().value,
        };
        expr = {
          type: 'MemberExpression',
          object: expr,
          property,
          computed: false,
        };
      } else if (this.match(TokenType.LeftBracket)) {
        const index = this.parseExpression();
        this.consume(TokenType.RightBracket, 'Expected "]"');
        expr = {
          type: 'IndexExpression',
          object: expr,
          index,
        };
      } else if (this.match(TokenType.LeftParen)) {
        // Function call
        const args: Expression[] = [];
        if (!this.check(TokenType.RightParen)) {
          do {
            args.push(this.parseExpression());
          } while (this.match(TokenType.Comma));
        }
        this.consume(TokenType.RightParen, 'Expected ")" after arguments');
        expr = {
          type: 'CallExpression',
          callee: expr,
          arguments: args,
        };
      } else {
        break;
      }
    }

    return expr;
  }

  /**
   * Parse primary expression
   */
  private parsePrimary(): Expression {
    // Boolean literal
    if (this.check(TokenType.BoolLiteral)) {
      const token = this.advance();
      return {
        type: 'BoolLiteral',
        value: token.value === 'true',
        location: this.makeRange(token.location),
      };
    }

    // Integer literal
    if (this.check(TokenType.IntLiteral)) {
      const token = this.advance();
      return {
        type: 'IntLiteral',
        value: parseInt(token.value, token.value.startsWith('0x') ? 16 : 10),
        location: this.makeRange(token.location),
      };
    }

    // Float literal
    if (this.check(TokenType.FloatLiteral)) {
      const token = this.advance();
      return {
        type: 'FloatLiteral',
        value: parseFloat(token.value),
        location: this.makeRange(token.location),
      };
    }

    // Vector constructor (vec2, vec3, vec4, etc.)
    if (this.check(TokenType.Type)) {
      const typeToken = this.peek();
      if (TYPES.has(typeToken.value) && typeToken.value.startsWith('vec')) {
        return this.parseVectorConstructor();
      }
      // Other type constructors (mat2, mat3, etc.)
      if (TYPES.has(typeToken.value)) {
        return this.parseTypeConstructor();
      }
    }

    // Identifier
    if (this.check(TokenType.Identifier)) {
      const token = this.advance();
      return {
        type: 'Identifier',
        name: token.value,
        location: this.makeRange(token.location),
      };
    }

    // Parenthesized expression
    if (this.match(TokenType.LeftParen)) {
      const expr = this.parseExpression();
      this.consume(TokenType.RightParen, 'Expected ")"');
      return expr;
    }

    throw this.error(`Unexpected token: ${this.peek().value}`);
  }

  /**
   * Parse vector constructor: vec2(x, y), vec3(x, y, z), etc.
   */
  private parseVectorConstructor(): VectorLiteral {
    const start = this.peek().location;
    const vectorType = this.advance().value as GLSLType;

    this.consume(TokenType.LeftParen, 'Expected "(" after vector type');

    const components: Expression[] = [];
    if (!this.check(TokenType.RightParen)) {
      do {
        components.push(this.parseExpression());
      } while (this.match(TokenType.Comma));
    }

    this.consume(TokenType.RightParen, 'Expected ")" after vector components');

    return {
      type: 'VectorLiteral',
      vectorType,
      components,
      location: this.makeRange(start),
    };
  }

  /**
   * Parse type constructor: mat3(1.0), float(x), etc.
   */
  private parseTypeConstructor(): CallExpression {
    const start = this.peek().location;
    const typeName = this.advance().value;

    this.consume(TokenType.LeftParen, 'Expected "(" after type');

    const args: Expression[] = [];
    if (!this.check(TokenType.RightParen)) {
      do {
        args.push(this.parseExpression());
      } while (this.match(TokenType.Comma));
    }

    this.consume(TokenType.RightParen, 'Expected ")" after arguments');

    return {
      type: 'CallExpression',
      callee: {
        type: 'Identifier',
        name: typeName,
        location: this.makeRange(start),
      },
      arguments: args,
      location: this.makeRange(start),
    };
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  /**
   * Check if at end of tokens
   */
  private isAtEnd(): boolean {
    return this.peek().type === TokenType.EOF;
  }

  /**
   * Get current token without consuming
   */
  private peek(): Token {
    return this.tokens[this.current]!;
  }

  /**
   * Get previous token
   */
  private previous(): Token {
    return this.tokens[this.current - 1]!;
  }

  /**
   * Consume current token and return it
   */
  private advance(): Token {
    if (!this.isAtEnd()) {
      this.current++;
    }
    return this.previous();
  }

  /**
   * Check if current token matches type
   */
  private check(type: TokenType): boolean {
    if (this.isAtEnd()) return false;
    return this.peek().type === type;
  }

  /**
   * Check if current token is a specific keyword
   */
  private checkKeyword(keyword: string): boolean {
    if (this.isAtEnd()) return false;
    const token = this.peek();
    return (
      (token.type === TokenType.Keyword || token.type === TokenType.Identifier) &&
      token.value === keyword
    );
  }

  /**
   * Match and consume token if it matches
   */
  private match(type: TokenType): boolean {
    if (this.check(type)) {
      this.advance();
      return true;
    }
    return false;
  }

  /**
   * Consume expected token or throw error
   */
  private consume(type: TokenType, message: string): Token {
    if (this.check(type)) {
      return this.advance();
    }
    throw this.error(message);
  }

  /**
   * Create parse error at current position
   */
  private error(message: string): ParseError {
    const token = this.peek();
    return new ParseError(message, token.location.line, token.location.column);
  }

  /**
   * Create source range from start location to current
   */
  private makeRange(start: { line: number; column: number; offset: number }): SourceRange {
    const end = this.previous()?.location || start;
    return {
      start: { line: start.line, column: start.column, offset: start.offset },
      end: { line: end.line, column: end.column, offset: end.offset },
    };
  }

  /**
   * Synchronize after error (skip to next statement)
   */
  private synchronize(): void {
    this.advance();

    while (!this.isAtEnd()) {
      if (this.previous().type === TokenType.Semicolon) return;
      if (this.previous().type === TokenType.RightBrace) return;

      switch (this.peek().type) {
        case TokenType.Keyword:
          if (
            ['shader_type', 'render_mode', 'uniform', 'varying', 'if', 'for', 'while', 'return'].includes(
              this.peek().value,
            )
          ) {
            return;
          }
          break;
        case TokenType.Type:
          return;
      }

      this.advance();
    }
  }

  /**
   * Get all parse errors
   */
  getErrors(): ParseError[] {
    return this.errors;
  }
}

/**
 * Parse VSL source code into an AST
 */
export function parse(source: string): ShaderAST {
  const parser = new Parser();
  return parser.parse(source);
}
