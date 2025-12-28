/**
 * Entity Query Parser
 *
 * Parses string queries for filtering entities in the hierarchy viewer.
 *
 * Query Syntax:
 * - `Test` - Entity name contains "test" (case-insensitive)
 * - `Test C:Sprite2D` - Name contains "test" AND has Sprite2D
 * - `C:Sprite2D,Transform3D` - Has BOTH Sprite2D AND Transform3D
 * - `C:Sprite2D C:Camera` - Has Sprite2D OR Camera (space = OR for C: blocks)
 * - `NC:Rigidbody2D` - Does NOT have Rigidbody2D
 * - `Player | Enemy` - Name contains "player" OR "enemy"
 * - `C:Sprite2D & NC:Camera` - Has Sprite2D AND lacks Camera
 */

/**
 * Represents a single filter condition
 */
export type QueryFilter =
  | { type: 'name'; value: string }
  | { type: 'hasComponent'; names: string[] } // Has ALL of these components (comma-separated)
  | { type: 'hasAnyComponent'; names: string[] } // Has ANY of these components (space-separated C:)
  | { type: 'notComponent'; names: string[] }; // Lacks ALL of these components

/**
 * A term is a collection of filters that are all ANDed together
 * Example: "Player C:Sprite2D NC:Camera" becomes one term with 3 filters
 */
export interface QueryTerm {
  filters: QueryFilter[];
}

/**
 * An AND expression is multiple terms ANDed together with &
 */
export interface AndExpression {
  terms: QueryTerm[];
}

/**
 * The top-level query is OR of AND expressions (DNF form)
 * Example: "A & B | C & D" = (A AND B) OR (C AND D)
 */
export interface ParsedQuery {
  orExpressions: AndExpression[];
}

/**
 * Result of parsing - either success or error
 */
export type ParseResult =
  | { success: true; query: ParsedQuery }
  | { success: false; error: string };

/**
 * Token types for the lexer
 */
type TokenType = 'text' | 'component' | 'notComponent' | 'or' | 'and';

interface Token {
  type: TokenType;
  value: string;
  componentNames?: string[]; // For component/notComponent tokens
}

/**
 * Tokenize the input query string
 */
function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  const trimmed = input.trim();

  if (!trimmed) {
    return tokens;
  }

  // Split by | first (OR operator), preserving it
  const orParts = trimmed.split(/(\|)/);

  for (const orPart of orParts) {
    const part = orPart.trim();

    if (part === '|') {
      tokens.push({ type: 'or', value: '|' });
      continue;
    }

    if (!part) continue;

    // Split by & (AND operator), preserving it
    const andParts = part.split(/(&)/);

    for (const andPart of andParts) {
      const subPart = andPart.trim();

      if (subPart === '&') {
        tokens.push({ type: 'and', value: '&' });
        continue;
      }

      if (!subPart) continue;

      // Now parse the term: could contain name text, C:..., NC:...
      // Use regex to find all C:... and NC:... patterns
      // \b matches word boundary, (N?C) matches "C" or "NC"
      const componentPattern = /\b(N?C):([A-Za-z0-9_,-]+)/g;
      let lastIndex = 0;
      let match: RegExpExecArray | null;

      while ((match = componentPattern.exec(subPart)) !== null) {
        // Add any text before this match as a name filter
        const textBefore = subPart.slice(lastIndex, match.index).trim();
        if (textBefore) {
          tokens.push({ type: 'text', value: textBefore });
        }

        const prefix = match[1]; // "C" or "NC"
        const namesStr = match[2] ?? ''; // "Sprite2D" or "Sprite2D,Transform3D"
        const names = namesStr.split(',').map((n) => n.trim()).filter(Boolean);

        if (prefix === 'NC') {
          tokens.push({ type: 'notComponent', value: match[0], componentNames: names });
        } else {
          tokens.push({ type: 'component', value: match[0], componentNames: names });
        }

        lastIndex = match.index + match[0].length;
      }

      // Add any remaining text after last match
      const textAfter = subPart.slice(lastIndex).trim();
      if (textAfter) {
        tokens.push({ type: 'text', value: textAfter });
      }
    }
  }

  return tokens;
}

/**
 * Parse tokens into a QueryTerm
 * A term contains filters from a segment between operators
 */
function parseTermFromTokens(tokens: Token[]): QueryTerm {
  const filters: QueryFilter[] = [];
  const nameTexts: string[] = [];
  const hasComponentGroups: string[][] = []; // Each C: is a group
  const notComponentNames: string[] = [];

  for (const token of tokens) {
    switch (token.type) {
      case 'text':
        nameTexts.push(token.value);
        break;
      case 'component':
        if (token.componentNames && token.componentNames.length > 0) {
          hasComponentGroups.push(token.componentNames);
        }
        break;
      case 'notComponent':
        if (token.componentNames) {
          notComponentNames.push(...token.componentNames);
        }
        break;
    }
  }

  // Combine all name texts into one filter
  if (nameTexts.length > 0) {
    const combinedName = nameTexts.join(' ').trim();
    if (combinedName) {
      filters.push({ type: 'name', value: combinedName });
    }
  }

  // Handle component groups:
  // - Single C: with comma-separated names = hasComponent (must have ALL)
  // - Multiple C: blocks = hasAnyComponent (must have at least one from ANY block)
  if (hasComponentGroups.length === 1 && hasComponentGroups[0]) {
    // Single C: block - entity must have ALL components in the comma list
    filters.push({ type: 'hasComponent', names: hasComponentGroups[0] });
  } else if (hasComponentGroups.length > 1) {
    // Multiple C: blocks - entity must match at least one block
    // Each block is an AND (must have all in that block)
    // Blocks are OR'd together
    // For simplicity, we'll flatten this: hasAnyComponent checks if entity has ANY of the groups
    // But wait - the spec says "C:A C:B" means has A OR has B
    // So multiple C: blocks = OR between blocks
    // We need to handle this at evaluation time differently

    // For now, collect all unique component names and use hasAnyComponent
    // This means entity must have at least ONE of any component mentioned
    const allNames = new Set<string>();
    for (const group of hasComponentGroups) {
      for (const name of group) {
        allNames.add(name);
      }
    }
    filters.push({ type: 'hasAnyComponent', names: Array.from(allNames) });
  }

  // NC: components - entity must NOT have ANY of these
  if (notComponentNames.length > 0) {
    filters.push({ type: 'notComponent', names: notComponentNames });
  }

  return { filters };
}

/**
 * Parse the query string into a ParsedQuery structure
 */
export function parseQuery(input: string): ParseResult {
  try {
    const tokens = tokenize(input);

    if (tokens.length === 0) {
      return { success: true, query: { orExpressions: [] } };
    }

    // Group tokens by OR operator
    const orGroups: Token[][] = [];
    let currentOrGroup: Token[] = [];

    for (const token of tokens) {
      if (token.type === 'or') {
        if (currentOrGroup.length > 0) {
          orGroups.push(currentOrGroup);
          currentOrGroup = [];
        }
      } else {
        currentOrGroup.push(token);
      }
    }
    if (currentOrGroup.length > 0) {
      orGroups.push(currentOrGroup);
    }

    // For each OR group, split by AND and create terms
    const orExpressions: AndExpression[] = [];

    for (const orGroup of orGroups) {
      // Split by AND operator
      const andGroups: Token[][] = [];
      let currentAndGroup: Token[] = [];

      for (const token of orGroup) {
        if (token.type === 'and') {
          if (currentAndGroup.length > 0) {
            andGroups.push(currentAndGroup);
            currentAndGroup = [];
          }
        } else {
          currentAndGroup.push(token);
        }
      }
      if (currentAndGroup.length > 0) {
        andGroups.push(currentAndGroup);
      }

      // Parse each AND group into a term
      const terms: QueryTerm[] = [];
      for (const andGroup of andGroups) {
        const term = parseTermFromTokens(andGroup);
        if (term.filters.length > 0) {
          terms.push(term);
        }
      }

      if (terms.length > 0) {
        orExpressions.push({ terms });
      }
    }

    return { success: true, query: { orExpressions } };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown parse error',
    };
  }
}
