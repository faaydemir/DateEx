// ─────────────────────────────────────────────
//  AST type definitions for JustDate Grammar V2
// ─────────────────────────────────────────────

export type UnitType = 'year' | 'quarter' | 'month' | 'week' | 'day' | 'monthday'
export type ExtendedUnitType = UnitType | 'hour' | 'minute' | 'second' | 'millisecond'

// ─── Index nodes ─────────────────────────────
export type IdxNode = { type: 'idx'; n: number }
export type RevNode = { type: 'rev'; n: number }
export type PosIndex = IdxNode | RevNode

// ─── Range items ──────────────────────────────
export type SingleItem = { type: 'single'; index: PosIndex }
export type NegItem = { type: 'neg'; index: PosIndex }
export type OpenLeftItem = { type: 'open_left'; to: PosIndex }
export type OpenRightItem = { type: 'open_right'; from: PosIndex }
export type BoundedItem = { type: 'bounded'; from: PosIndex; to: PosIndex }
export type RangeItem = SingleItem | NegItem | OpenLeftItem | OpenRightItem | BoundedItem

export type RangeExpr = { type: 'range'; items: RangeItem[] }

// ─── Unit value ───────────────────────────────
export type UnitValue = number | '*' | RangeExpr | PosIndex

// ─── Cycle unit (used in anchor + cycle + current) ─
export interface AstUnit {
  type: UnitType
  value: UnitValue
  cycle?: boolean
  mode?: 'weekday' | 'sequential'
  implicitParent?: UnitType | null
}

export type CycleUnit = AstUnit

// ─── Bound structures ─────────────────────────
export interface BoundAnchor {
  type: 'anchor'
  units: { type: UnitType; value: number | PosIndex }[]
}

// ─── Top-level AST nodes ──────────────────────
export interface AnchorNode { 
  type: 'anchor'
  units: AstUnit[] 
}

export interface CycleNode { 
  type: 'cycle'
  units: AstUnit[]
  from?: BoundAnchor | null
  to?: BoundAnchor | null
}

export interface RelativeNode { 
  type: 'relative'
  unit: UnitType
  op: '+' | '-'
  amount: number 
}

export interface CurrentNode { 
  type: 'current'
  units: AstUnit[] 
}

export interface SetNode {
  type: 'set'
  items: AstNode[]
}

export type AstNode = AnchorNode | CycleNode | RelativeNode | CurrentNode | SetNode

// ─── Parse result ─────────────────────────────
export type ParseSuccess = { ast: AstNode; error: null }
export type ParseError = { ast: null; error: string }
export type ParseResult = ParseSuccess | ParseError | { ast: null; error: null }

// ─── Shareable Computed DateEx Types ────────────────

// Unified Base
export interface DateEx {
  type: 'Exact' | 'Cron' | 'Relative' | 'Current';
}

// 1. Exact Anchor
export interface ExactDateEx extends DateEx {
  type: 'Exact';
  unit: UnitType;            // The deepest resolution grain
  startDays: Date[];         // Exact starts
}

// Custom wrapper mapping the internal cycle node to a DTO payload
export interface NormalizedCycleUnit {
  type: UnitType;
  value: '*' | number[];     // '*' or explicitly computed arrays
}

// 2. Cycle (Cron)
export interface CycleDateEx extends DateEx {
  type: 'Cron';
  from?: ExactDateEx | null;
  to?: ExactDateEx | null;
  cycleUnits: NormalizedCycleUnit[];
}

// 3. Relative
export interface RelativeDateEx extends DateEx {
  type: 'Relative';
  unit: UnitType;
  op: '+' | '-';
  amount: number;
}

// 4. Current
export interface CurrentDateEx extends DateEx {
  type: 'Current';
  units: NormalizedCycleUnit[];
}

export type DateExValue = ExactDateEx | CycleDateEx | RelativeDateEx | CurrentDateEx;
