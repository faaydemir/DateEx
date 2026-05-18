// parser.js is the Peggy-generated ES module.
// We wrap it here with proper TypeScript types.
import type { AstNode, ParseResult } from '../types'
import { exprToDateEx } from './DateExpression.ts'
import { mapParseResult } from './mapper.ts'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
import * as rawParser from '../grammar/parser.js'

const parser = rawParser as { parse: (input: string) => AstNode }

/**
 * Parse a DateEx expression string.
 * Returns ParseResult: { ast, error: null } | { ast: null, error: string } | { ast: null, error: null }
 */
export function parse(input: string): ParseResult {
  const trimmed = input.trim()
  if (!trimmed) return { ast: null, error: null }
  try {
    const ast = parser.parse(trimmed)
    return { ast, error: null }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Invalid expression'
    return { ast: null, error: msg }
  }
}

/**
 * Parse and map to domain model.
 */
export function parseToDomain(input: string) {
  const result = parse(input);
  if (result.error || !result.ast) {
    return { domainModel: null, ast: null, error: result.error };
  }
  try {
    const domainModel = exprToDateEx(mapParseResult(result).expr);
    return { domainModel, ast: result.ast, error: null };
  } catch (e: any) {
    return { domainModel: null, ast: result.ast, error: e.message };
  }
}
