/**
 * VoidShader Language (VSL) - Lexer
 *
 * Tokenizes VoidShader source code into a stream of tokens for parsing.
 */

import type { SourceLocation } from './ast.js';

/**
 * Token types in VSL
 */
export enum TokenType {
  // Literals
  IntLiteral = 'IntLiteral',
  FloatLiteral = 'FloatLiteral',
  BoolLiteral = 'BoolLiteral',
  StringLiteral = 'StringLiteral',

  // Identifiers and Keywords
  Identifier = 'Identifier',
  Keyword = 'Keyword',
  Type = 'Type',

  // Operators
  Plus = 'Plus', // +
  Minus = 'Minus', // -
  Star = 'Star', // *
  Slash = 'Slash', // /
  Percent = 'Percent', // %
  Ampersand = 'Ampersand', // &
  Pipe = 'Pipe', // |
  Caret = 'Caret', // ^
  Tilde = 'Tilde', // ~
  Bang = 'Bang', // !
  Question = 'Question', // ?
  Colon = 'Colon', // :
  Less = 'Less', // <
  Greater = 'Greater', // >
  Equals = 'Equals', // =
  Dot = 'Dot', // .

  // Compound operators
  PlusEquals = 'PlusEquals', // +=
  MinusEquals = 'MinusEquals', // -=
  StarEquals = 'StarEquals', // *=
  SlashEquals = 'SlashEquals', // /=
  PercentEquals = 'PercentEquals', // %=
  AmpersandEquals = 'AmpersandEquals', // &=
  PipeEquals = 'PipeEquals', // |=
  CaretEquals = 'CaretEquals', // ^=
  EqualsEquals = 'EqualsEquals', // ==
  BangEquals = 'BangEquals', // !=
  LessEquals = 'LessEquals', // <=
  GreaterEquals = 'GreaterEquals', // >=
  AmpersandAmpersand = 'AmpersandAmpersand', // &&
  PipePipe = 'PipePipe', // ||
  LessLess = 'LessLess', // <<
  GreaterGreater = 'GreaterGreater', // >>
  PlusPlus = 'PlusPlus', // ++
  MinusMinus = 'MinusMinus', // --

  // Punctuation
  LeftParen = 'LeftParen', // (
  RightParen = 'RightParen', // )
  LeftBrace = 'LeftBrace', // {
  RightBrace = 'RightBrace', // }
  LeftBracket = 'LeftBracket', // [
  RightBracket = 'RightBracket', // ]
  Comma = 'Comma', // ,
  Semicolon = 'Semicolon', // ;
  Hash = 'Hash', // #

  // Special
  Comment = 'Comment',
  Whitespace = 'Whitespace',
  Newline = 'Newline',
  EOF = 'EOF',
  Error = 'Error',
}

/**
 * A token produced by the lexer
 */
export interface Token {
  type: TokenType;
  value: string;
  location: SourceLocation;
}

/**
 * VSL Keywords
 */
export const KEYWORDS = new Set([
  // Shader declarations
  'shader_type',
  'render_mode',
  'uniform',
  'varying',
  'const',

  // Control flow
  'if',
  'else',
  'for',
  'while',
  'do',
  'switch',
  'case',
  'default',
  'break',
  'continue',
  'return',
  'discard',

  // Function qualifiers
  'in',
  'out',
  'inout',

  // Include
  'include',
]);

/**
 * VSL Types
 */
export const TYPES = new Set([
  'void',
  'bool',
  'int',
  'uint',
  'float',
  'vec2',
  'vec3',
  'vec4',
  'ivec2',
  'ivec3',
  'ivec4',
  'uvec2',
  'uvec3',
  'uvec4',
  'bvec2',
  'bvec3',
  'bvec4',
  'mat2',
  'mat3',
  'mat4',
  'sampler2D',
  'samplerCube',
]);

/**
 * Shader types
 */
export const SHADER_TYPES = new Set(['canvas_item', 'spatial', 'particles']);

/**
 * Render modes
 */
export const RENDER_MODES = new Set([
  // Canvas item
  'unshaded',
  'light_only',
  'blend_add',
  'blend_mul',
  'blend_sub',
  'blend_premul_alpha',
  'skip_vertex_transform',
  // Spatial
  'cull_front',
  'cull_back',
  'cull_disabled',
  'depth_draw_opaque',
  'depth_draw_always',
  'depth_draw_never',
  'depth_test_disabled',
]);

/**
 * Uniform hints
 */
export const UNIFORM_HINTS = new Set([
  'hint_range',
  'source_color',
  'hint_texture',
  'hint_normal',
  'hint_white',
  'hint_black',
  'hint_aniso',
  'hint_default_texture',
  'hint_runtime',
]);

/**
 * Check if a character is a digit
 */
function isDigit(ch: string): boolean {
  return ch >= '0' && ch <= '9';
}

/**
 * Check if a character is a letter
 */
function isLetter(ch: string): boolean {
  return (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || ch === '_';
}

/**
 * Check if a character is alphanumeric
 */
function isAlphaNumeric(ch: string): boolean {
  return isLetter(ch) || isDigit(ch);
}

/**
 * Check if a character is whitespace (excluding newlines)
 */
function isWhitespace(ch: string): boolean {
  return ch === ' ' || ch === '\t' || ch === '\r';
}

/**
 * VSL Lexer
 *
 * Tokenizes VoidShader source code into a stream of tokens.
 */
export class Lexer {
  private source: string;
  private position: number = 0;
  private line: number = 1;
  private column: number = 1;
  private tokens: Token[] = [];

  constructor(source: string) {
    this.source = source;
  }

  /**
   * Tokenize the entire source
   */
  tokenize(): Token[] {
    this.tokens = [];
    this.position = 0;
    this.line = 1;
    this.column = 1;

    while (!this.isAtEnd()) {
      const token = this.nextToken();
      if (token) {
        // Skip whitespace and comments for cleaner token stream
        if (
          token.type !== TokenType.Whitespace &&
          token.type !== TokenType.Newline &&
          token.type !== TokenType.Comment
        ) {
          this.tokens.push(token);
        }
      }
    }

    // Add EOF token
    this.tokens.push({
      type: TokenType.EOF,
      value: '',
      location: this.currentLocation(),
    });

    return this.tokens;
  }

  /**
   * Get the next token
   */
  private nextToken(): Token | null {
    const ch = this.peek();

    // Whitespace
    if (isWhitespace(ch)) {
      return this.readWhitespace();
    }

    // Newline
    if (ch === '\n') {
      return this.readNewline();
    }

    // Comments
    if (ch === '/') {
      const next = this.peekNext();
      if (next === '/') {
        return this.readLineComment();
      }
      if (next === '*') {
        return this.readBlockComment();
      }
    }

    // Numbers
    if (isDigit(ch) || (ch === '.' && isDigit(this.peekNext()))) {
      return this.readNumber();
    }

    // Strings
    if (ch === '"') {
      return this.readString();
    }

    // Identifiers and keywords
    if (isLetter(ch)) {
      return this.readIdentifier();
    }

    // Hash (for #include)
    if (ch === '#') {
      return this.readHash();
    }

    // Operators and punctuation
    return this.readOperator();
  }

  /**
   * Read whitespace
   */
  private readWhitespace(): Token {
    const start = this.currentLocation();
    let value = '';

    while (!this.isAtEnd() && isWhitespace(this.peek())) {
      value += this.advance();
    }

    return { type: TokenType.Whitespace, value, location: start };
  }

  /**
   * Read newline
   */
  private readNewline(): Token {
    const start = this.currentLocation();
    this.advance(); // consume \n
    this.line++;
    this.column = 1;
    return { type: TokenType.Newline, value: '\n', location: start };
  }

  /**
   * Read line comment
   */
  private readLineComment(): Token {
    const start = this.currentLocation();
    let value = '';

    // Skip //
    value += this.advance();
    value += this.advance();

    // Read until end of line
    while (!this.isAtEnd() && this.peek() !== '\n') {
      value += this.advance();
    }

    return { type: TokenType.Comment, value, location: start };
  }

  /**
   * Read block comment
   */
  private readBlockComment(): Token {
    const start = this.currentLocation();
    let value = '';

    // Skip /*
    value += this.advance();
    value += this.advance();

    // Read until */
    while (!this.isAtEnd()) {
      if (this.peek() === '*' && this.peekNext() === '/') {
        value += this.advance();
        value += this.advance();
        break;
      }
      if (this.peek() === '\n') {
        value += this.advance();
        this.line++;
        this.column = 1;
      } else {
        value += this.advance();
      }
    }

    return { type: TokenType.Comment, value, location: start };
  }

  /**
   * Read a number literal (int or float)
   */
  private readNumber(): Token {
    const start = this.currentLocation();
    let value = '';
    let isFloat = false;

    // Handle hex numbers
    if (
      this.peek() === '0' &&
      (this.peekNext() === 'x' || this.peekNext() === 'X')
    ) {
      value += this.advance(); // 0
      value += this.advance(); // x
      while (!this.isAtEnd() && this.isHexDigit(this.peek())) {
        value += this.advance();
      }
      return {
        type: TokenType.IntLiteral,
        value,
        location: start,
      };
    }

    // Read integer part
    while (!this.isAtEnd() && isDigit(this.peek())) {
      value += this.advance();
    }

    // Check for decimal point
    if (this.peek() === '.' && isDigit(this.peekNext())) {
      isFloat = true;
      value += this.advance(); // .
      while (!this.isAtEnd() && isDigit(this.peek())) {
        value += this.advance();
      }
    }

    // Check for exponent
    if (this.peek() === 'e' || this.peek() === 'E') {
      isFloat = true;
      value += this.advance(); // e/E
      if (this.peek() === '+' || this.peek() === '-') {
        value += this.advance();
      }
      while (!this.isAtEnd() && isDigit(this.peek())) {
        value += this.advance();
      }
    }

    // Check for float suffix
    if (this.peek() === 'f' || this.peek() === 'F') {
      isFloat = true;
      value += this.advance();
    }

    return {
      type: isFloat ? TokenType.FloatLiteral : TokenType.IntLiteral,
      value,
      location: start,
    };
  }

  /**
   * Check if character is hex digit
   */
  private isHexDigit(ch: string): boolean {
    return isDigit(ch) || (ch >= 'a' && ch <= 'f') || (ch >= 'A' && ch <= 'F');
  }

  /**
   * Read a string literal
   */
  private readString(): Token {
    const start = this.currentLocation();
    let value = '';

    this.advance(); // Skip opening "

    while (!this.isAtEnd() && this.peek() !== '"') {
      if (this.peek() === '\\') {
        value += this.advance(); // backslash
        if (!this.isAtEnd()) {
          value += this.advance(); // escaped char
        }
      } else if (this.peek() === '\n') {
        // Error: unterminated string
        break;
      } else {
        value += this.advance();
      }
    }

    if (this.peek() === '"') {
      this.advance(); // Skip closing "
    }

    return { type: TokenType.StringLiteral, value, location: start };
  }

  /**
   * Read an identifier or keyword
   */
  private readIdentifier(): Token {
    const start = this.currentLocation();
    let value = '';

    while (!this.isAtEnd() && isAlphaNumeric(this.peek())) {
      value += this.advance();
    }

    // Check for boolean literals
    if (value === 'true' || value === 'false') {
      return { type: TokenType.BoolLiteral, value, location: start };
    }

    // Check for types
    if (TYPES.has(value)) {
      return { type: TokenType.Type, value, location: start };
    }

    // Check for keywords
    if (KEYWORDS.has(value)) {
      return { type: TokenType.Keyword, value, location: start };
    }

    return { type: TokenType.Identifier, value, location: start };
  }

  /**
   * Read hash directive (for #include)
   */
  private readHash(): Token {
    const start = this.currentLocation();
    this.advance(); // consume #
    return { type: TokenType.Hash, value: '#', location: start };
  }

  /**
   * Read operator or punctuation
   */
  private readOperator(): Token {
    const start = this.currentLocation();
    const ch = this.advance();

    switch (ch) {
      case '(':
        return { type: TokenType.LeftParen, value: '(', location: start };
      case ')':
        return { type: TokenType.RightParen, value: ')', location: start };
      case '{':
        return { type: TokenType.LeftBrace, value: '{', location: start };
      case '}':
        return { type: TokenType.RightBrace, value: '}', location: start };
      case '[':
        return { type: TokenType.LeftBracket, value: '[', location: start };
      case ']':
        return { type: TokenType.RightBracket, value: ']', location: start };
      case ',':
        return { type: TokenType.Comma, value: ',', location: start };
      case ';':
        return { type: TokenType.Semicolon, value: ';', location: start };
      case ':':
        return { type: TokenType.Colon, value: ':', location: start };
      case '?':
        return { type: TokenType.Question, value: '?', location: start };
      case '~':
        return { type: TokenType.Tilde, value: '~', location: start };
      case '.':
        return { type: TokenType.Dot, value: '.', location: start };

      case '+':
        if (this.match('=')) {
          return { type: TokenType.PlusEquals, value: '+=', location: start };
        }
        if (this.match('+')) {
          return { type: TokenType.PlusPlus, value: '++', location: start };
        }
        return { type: TokenType.Plus, value: '+', location: start };

      case '-':
        if (this.match('=')) {
          return { type: TokenType.MinusEquals, value: '-=', location: start };
        }
        if (this.match('-')) {
          return { type: TokenType.MinusMinus, value: '--', location: start };
        }
        return { type: TokenType.Minus, value: '-', location: start };

      case '*':
        if (this.match('=')) {
          return { type: TokenType.StarEquals, value: '*=', location: start };
        }
        return { type: TokenType.Star, value: '*', location: start };

      case '/':
        if (this.match('=')) {
          return { type: TokenType.SlashEquals, value: '/=', location: start };
        }
        return { type: TokenType.Slash, value: '/', location: start };

      case '%':
        if (this.match('=')) {
          return {
            type: TokenType.PercentEquals,
            value: '%=',
            location: start,
          };
        }
        return { type: TokenType.Percent, value: '%', location: start };

      case '&':
        if (this.match('=')) {
          return {
            type: TokenType.AmpersandEquals,
            value: '&=',
            location: start,
          };
        }
        if (this.match('&')) {
          return {
            type: TokenType.AmpersandAmpersand,
            value: '&&',
            location: start,
          };
        }
        return { type: TokenType.Ampersand, value: '&', location: start };

      case '|':
        if (this.match('=')) {
          return { type: TokenType.PipeEquals, value: '|=', location: start };
        }
        if (this.match('|')) {
          return { type: TokenType.PipePipe, value: '||', location: start };
        }
        return { type: TokenType.Pipe, value: '|', location: start };

      case '^':
        if (this.match('=')) {
          return { type: TokenType.CaretEquals, value: '^=', location: start };
        }
        return { type: TokenType.Caret, value: '^', location: start };

      case '!':
        if (this.match('=')) {
          return { type: TokenType.BangEquals, value: '!=', location: start };
        }
        return { type: TokenType.Bang, value: '!', location: start };

      case '=':
        if (this.match('=')) {
          return { type: TokenType.EqualsEquals, value: '==', location: start };
        }
        return { type: TokenType.Equals, value: '=', location: start };

      case '<':
        if (this.match('=')) {
          return { type: TokenType.LessEquals, value: '<=', location: start };
        }
        if (this.match('<')) {
          return { type: TokenType.LessLess, value: '<<', location: start };
        }
        return { type: TokenType.Less, value: '<', location: start };

      case '>':
        if (this.match('=')) {
          return {
            type: TokenType.GreaterEquals,
            value: '>=',
            location: start,
          };
        }
        if (this.match('>')) {
          return {
            type: TokenType.GreaterGreater,
            value: '>>',
            location: start,
          };
        }
        return { type: TokenType.Greater, value: '>', location: start };

      default:
        return { type: TokenType.Error, value: ch, location: start };
    }
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  /**
   * Check if we've reached the end of source
   */
  private isAtEnd(): boolean {
    return this.position >= this.source.length;
  }

  /**
   * Get current character without consuming
   */
  private peek(): string {
    if (this.isAtEnd()) return '\0';
    return this.source[this.position] ?? '\0';
  }

  /**
   * Get next character without consuming
   */
  private peekNext(): string {
    if (this.position + 1 >= this.source.length) return '\0';
    return this.source[this.position + 1] ?? '\0';
  }

  /**
   * Consume and return current character
   */
  private advance(): string {
    const ch = this.source[this.position] ?? '\0';
    this.position++;
    this.column++;
    return ch;
  }

  /**
   * Match and consume a character if it matches
   */
  private match(expected: string): boolean {
    if (this.isAtEnd()) return false;
    if (this.source[this.position] !== expected) return false;
    this.position++;
    this.column++;
    return true;
  }

  /**
   * Get current source location
   */
  private currentLocation(): SourceLocation {
    return {
      line: this.line,
      column: this.column,
      offset: this.position,
    };
  }
}

/**
 * Tokenize VSL source code
 */
export function tokenize(source: string): Token[] {
  const lexer = new Lexer(source);
  return lexer.tokenize();
}
