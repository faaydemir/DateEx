// ═══════════════════════════════════════════════════════
//  DateEx Type System
// ═══════════════════════════════════════════════════════

import {
  CycleUnit,
  DateCycle,
  DateEx,
  getIndexesForTypeAndExactParent,
  getIndexesForTypeAndParent,
  implicitParentMap,
  INFINITY,
  JustSpan,
  JustDate,
  JustDateHierarchical,
  JustDateSet,
  JustDateType,
  NEGATIVE_INFINITY,
  type DateUnit,
} from "./JustDate.ts"

// ─── Unit ────────────────────────────────────────────────

export type DateExUnitType =
  | "year"
  | "quarter"
  | "month"
  | "week"
  | "day"       // D  — weekday or sequential depending on mode
  | "monthday"  // Dm — calendar day of month

// ─── Index ───────────────────────────────────────────────

export type DateExScalarIndex = { type: "scalar"; n: number }
export type DateExRevIndex    = { type: "ref";    n: number }
export type DateExIndexVal    = DateExScalarIndex | DateExRevIndex

// ─── Range items ─────────────────────────────────────────

export type DateExRangeItem =
  | { type: "single";     index: DateExIndexVal }
  | { type: "negation";   index: DateExIndexVal }
  | { type: "open-left";  to:    DateExIndexVal }
  | { type: "open-right"; from:  DateExIndexVal }
  | { type: "span";       from:  DateExIndexVal; to: DateExIndexVal }

export type DateExRangeSelector = {
  type:  "range"
  items: DateExRangeItem[]
}

// ─── Selector ────────────────────────────────────────────
//
//  scalar    →  single index          Y2026  M3  D1
//  ref       →  reverse index         Dm^1   M^1
//  range     →  list/span/negation    D[1,3,5]  M[1>6]
//  wildcard  →  every instance        M*  W*
//  current   →  bare unit             D  M  W  (no index)

export type DateExSelector =
  | { type: "scalar";   n: number }
  | { type: "ref";      n: number }
  | { type: "range";    items: DateExRangeItem[] }
  | { type: "wildcard" }
  | { type: "current" }

// ─── Day mode ────────────────────────────────────────────
//
//  weekday    →  D with W present in chain  (Mon=1 … Sun=7)
//  sequential →  D without W               (nth workday of parent)

export type DateExDayMode = "weekday" | "sequential"

// ─── Term ────────────────────────────────────────────────
//
//  A single unit + selector pair.
//  cycle: true when selector ends with *

export type DateExTerm = {
  unit:     DateExUnitType
  selector: DateExSelector
  cycle:    boolean
  mode?:    DateExDayMode   // only present when unit === "day"
}

// ─── Point expression ────────────────────────────────────
//
//  A single resolved date — no cycles, no wildcards.
//  Shared by SpanExpr bounds.
//  Implicit parent resolution handled at domain layer.

export type DateExPointExpr =
  | { type: "anchor";   terms: DateExTerm[] }
  | { type: "relative"; unit: DateExUnitType; op: "+" | "-"; amount: number }

// ─── Anchor expression ───────────────────────────────────
//
//  One or more terms, no cycles.
//  May have implicit year parent (resolved at domain layer).

export type DateExAnchorExpr = {
  type:  "anchor"
  terms: DateExTerm[]
}

// ─── Cycle expression ────────────────────────────────────
//
//  One or more terms, at least one has cycle: true.
//  May have bounds constraining the cycle window.

export type DateExCycleExpr = {
  type:  "cycle"
  terms: DateExTerm[]
  from:  DateExPointExpr | null  // bound start, null = open
  to:    DateExPointExpr | null  // bound end,   null = open
}

// ─── Relative expression ─────────────────────────────────
//
//  D+1  M-2  Y+1

export type DateExRelativeExpr = {
  type:   "relative"
  unit:   DateExUnitType
  op:     "+" | "-"
  amount: number
}

// ─── Span expression ───────────────────────────────
//
//  Y2023..Y2024   active from start until end
//  Y2023..        open end
//  ..Y2024        open start

export type DateExSpanExpr = {
  type: "span"
  from: DateExPointExpr | null  // null = open start
  to:   DateExPointExpr | null  // null = open end
}

// ─── Set expression ──────────────────────────────────────
//
//  [Y2026, Y2027]  matches any of the listed expressions

export type DateExSetExpr = {
  type:  "set"
  items: DateExExpr[]
}

// ─── Union of all expression types ───────────────────────

export type DateExExpr =
  | DateExAnchorExpr
  | DateExCycleExpr
  | DateExRelativeExpr
  | DateExSpanExpr
  | DateExSetExpr

function toJustDateType(unit: DateExUnitType): JustDateType {
  switch (unit) {
    case "year": return JustDateType.YEAR
    case "quarter": return JustDateType.QUARTER
    case "month": return JustDateType.MONTH
    case "week": return JustDateType.WEEK
    case "day": return JustDateType.DAY
    case "monthday": return JustDateType.MONTH_DAY
  }
}

function toDateExUnitType(type: JustDateType): DateExUnitType {
  switch (type) {
    case JustDateType.YEAR: return "year"
    case JustDateType.QUARTER: return "quarter"
    case JustDateType.MONTH: return "month"
    case JustDateType.WEEK: return "week"
    case JustDateType.DAY: return "day"
    case JustDateType.MONTH_DAY: return "monthday"
    default:
      throw new Error(`Cannot convert ${type} to DateEx unit`)
  }
}

function currentValue(type: JustDateType): number {
  const current = JustDate.now(type)
  switch (type) {
    case JustDateType.YEAR: return current.castToYear().year
    case JustDateType.QUARTER: return current.castToQuarter().quarter
    case JustDateType.MONTH: return current.castToMonth().month
    case JustDateType.WEEK: return current.castToWeek().week
    case JustDateType.DAY: return current.castToDay().day
    case JustDateType.MONTH_DAY: return current.castToMonthDay().dayOfMonth
    default:
      throw new Error(`Cannot get current value for ${type}`)
  }
}

function parentTypeFor(terms: DateExTerm[], index: number): JustDateType {
  const previous = terms[index - 1]
  return previous ? toJustDateType(previous.unit) : JustDateType.YEAR
}

function exactParentForUnits(units: DateUnit[]): JustDate | null {
  return units.length > 0 ? new JustDateHierarchical(units).toJustDate() : null
}

function expandImplicitParentTerms(terms: DateExTerm[]): DateExTerm[] {
  const first = terms[0]
  if (!first || toJustDateType(first.unit) === JustDateType.YEAR) {
    return terms
  }

  const firstType = toJustDateType(first.unit)
  const parentTypes = implicitParentMap[firstType] ?? [JustDateType.YEAR]
  const parentTerms: DateExTerm[] = parentTypes.map((type) => ({
    unit: toDateExUnitType(type),
    selector: { type: "current" },
    cycle: false,
  }))

  return [...parentTerms, ...terms]
}

function resolveIndex(index: DateExIndexVal, unit: JustDateType, parent: JustDate): number {
  const indexes = getIndexesForTypeAndExactParent(unit, parent)

  if (index.type === "scalar") {
    if (!Number.isInteger(index.n) || !indexes.includes(index.n)) {
      throw new Error(`Index ${index.n} is out of range for ${unit} in ${parent.type}`)
    }
    return index.n
  }

  const resolved = indexes[indexes.length - index.n]
  if (resolved === undefined) {
    throw new Error(`Reverse index ^${index.n} is out of range for ${unit} in ${parent.type}`)
  }
  return resolved
}

function resolveCycleIndex(index: DateExIndexVal, unit: JustDateType, parent: JustDateType): number {
  const indexes = getIndexesForTypeAndParent(unit, parent)

  if (index.type === "scalar") {
    if (!Number.isInteger(index.n) || !indexes.includes(index.n)) {
      throw new Error(`Index ${index.n} is out of range for ${unit} in ${parent}`)
    }
    return index.n
  }

  const resolved = indexes[indexes.length - index.n]
  if (resolved === undefined) {
    throw new Error(`Reverse index ^${index.n} is out of range for ${unit} in ${parent}`)
  }
  return resolved
}

function selectorToValues(term: DateExTerm, parent: JustDate | null): number[] {
  const unit = toJustDateType(term.unit)

  switch (term.selector.type) {
    case "scalar":
      return [term.selector.n]
    case "ref":
      if (!parent) {
        throw new Error(`Reverse index requires an exact parent for ${unit}`)
      }
      return [resolveIndex(term.selector, unit, parent)]
    case "current":
      return [currentValue(unit)]
    case "range":
      if (!parent) {
        throw new Error(`Range selector requires an exact parent for ${unit}`)
      }
      return rangeToIndexes(term.selector.items, unit, parent)
    case "wildcard":
      throw new Error("wildcard selector cannot be converted to fixed dates")
  }
}

function selectorToCycleIndexes(term: DateExTerm, parent: JustDateType): number[] {
  const unit = toJustDateType(term.unit)

  switch (term.selector.type) {
    case "wildcard":
      return []
    case "current":
      return [currentValue(unit)]
    case "scalar":
      return [term.selector.n]
    case "ref":
      return [resolveCycleIndex(term.selector, unit, parent)]
    case "range":
      return rangeToCycleIndexes(term.selector.items, unit, parent)
  }
}

function rangeToIndexes(items: DateExRangeItem[], unit: JustDateType, parent: JustDate): number[] {
  const all = getIndexesForTypeAndExactParent(unit, parent)
  const selected = new Set(items.some((item) => item.type === "negation") ? all : [])

  for (const item of items) {
    switch (item.type) {
      case "single":
        selected.add(resolveIndex(item.index, unit, parent))
        break
      case "negation":
        selected.delete(resolveIndex(item.index, unit, parent))
        break
      case "open-left": {
        const to = resolveIndex(item.to, unit, parent)
        all.filter((index) => index < to).forEach((index) => selected.add(index))
        break
      }
      case "open-right": {
        const from = resolveIndex(item.from, unit, parent)
        all.filter((index) => index > from).forEach((index) => selected.add(index))
        break
      }
      case "span": {
        const from = resolveIndex(item.from, unit, parent)
        const to = resolveIndex(item.to, unit, parent)
        all.filter((index) => index >= from && index <= to).forEach((index) => selected.add(index))
        break
      }
    }
  }

  return all.filter((index) => selected.has(index))
}

function rangeToCycleIndexes(items: DateExRangeItem[], unit: JustDateType, parent: JustDateType): number[] {
  const all = getIndexesForTypeAndParent(unit, parent)
  const selected = new Set(items.some((item) => item.type === "negation") ? all : [])

  for (const item of items) {
    switch (item.type) {
      case "single":
        selected.add(resolveCycleIndex(item.index, unit, parent))
        break
      case "negation":
        selected.delete(resolveCycleIndex(item.index, unit, parent))
        break
      case "open-left": {
        const to = resolveCycleIndex(item.to, unit, parent)
        all.filter((index) => index < to).forEach((index) => selected.add(index))
        break
      }
      case "open-right": {
        const from = resolveCycleIndex(item.from, unit, parent)
        all.filter((index) => index > from).forEach((index) => selected.add(index))
        break
      }
      case "span": {
        const from = resolveCycleIndex(item.from, unit, parent)
        const to = resolveCycleIndex(item.to, unit, parent)
        all.filter((index) => index >= from && index <= to).forEach((index) => selected.add(index))
        break
      }
    }
  }

  return all.filter((index) => selected.has(index))
}

function anchorToJustDates(expr: DateExAnchorExpr): JustDate[] {
  const terms = expandImplicitParentTerms(expr.terms)
  let unitGroups = terms.reduce<DateUnit[][]>((groups, term) => {
    const type = toJustDateType(term.unit)
    return groups.flatMap((units) => {
      const parent = exactParentForUnits(units)
      return selectorToValues(term, parent).map((value) => [...units, { type, value }])
    })
  }, [[]])

  if (!unitGroups.some((units) => units.some((unit) => unit.type === JustDateType.YEAR))) {
    unitGroups = unitGroups.map((units) => [
      { type: JustDateType.YEAR, value: currentValue(JustDateType.YEAR) },
      ...units,
    ])
  }

  return unitGroups.map((units) => new JustDateHierarchical(units).toJustDate())
}

function anchorToJustDate(expr: DateExAnchorExpr): JustDate {
  const dates = anchorToJustDates(expr)
  if (dates.length !== 1) {
    throw new Error("Point expression must resolve to exactly one date")
  }
  return dates[0]
}

function relativeToJustDate(expr: DateExRelativeExpr): JustDate {
  const type = toJustDateType(expr.unit)
  const amount = expr.op === "-" ? -expr.amount : expr.amount
  return JustDate.new(type).add(amount)
}

function pointToJustDate(expr: DateExPointExpr): JustDate {
  return expr.type === "relative" ? relativeToJustDate(expr) : anchorToJustDate(expr)
}

function cycleToDateCycle(expr: DateExCycleExpr): DateCycle {
  const cyclePattern = expr.terms.map((term, index) => {
    const type = toJustDateType(term.unit)
    const parent = parentTypeFor(expr.terms, index)
    return new CycleUnit(type, selectorToCycleIndexes(term, parent))
  })

  return new DateCycle(
    cyclePattern,
    expr.from ? pointToJustDate(expr.from) : undefined,
    expr.to ? pointToJustDate(expr.to) : undefined,
  )
}

export function exprToDateEx(expr: DateExExpr): DateEx {
  switch (expr.type) {
    case "anchor": {
      const dates = anchorToJustDates(expr)
      return dates.length === 1
        ? new DateEx(dates[0])
        : new DateEx(new JustDateSet(dates, true))
    }
    case "relative":
      return new DateEx(relativeToJustDate(expr))
    case "cycle":
      return new DateEx(cycleToDateCycle(expr))
    case "span":
      return new DateEx(new JustSpan(
        expr.from ? pointToJustDate(expr.from) : NEGATIVE_INFINITY,
        expr.to ? pointToJustDate(expr.to) : INFINITY,
      ))
    case "set": {
      const dates = expr.items.flatMap((item) => {
        const value = exprToDateEx(item)
        if (value.valueType === "cycle") {
          throw new Error("Set expressions containing cycles cannot be converted to a single DateEx")
        }
        return (value.value as JustDateSet).toArray()
      })
      return new DateEx(new JustDateSet(dates, true))
    }
  }
}

// ═══════════════════════════════════════════════════════
//  DateExpression class
// ═══════════════════════════════════════════════════════

export class DateExpression {
  readonly expr: DateExExpr

  constructor(expr: DateExExpr) {
    this.expr = expr
  }

  // type guards for convenient narrowing
  isAnchor():     this is DateExpression & { expr: DateExAnchorExpr     } {
    return this.expr.type === "anchor"
  }
  isCycle():      this is DateExpression & { expr: DateExCycleExpr      } {
    return this.expr.type === "cycle"
  }
  isRelative():   this is DateExpression & { expr: DateExRelativeExpr   } {
    return this.expr.type === "relative"
  }
  isSpan(): this is DateExpression & { expr: DateExSpanExpr } {
    return this.expr.type === "span"
  }
  isSet():        this is DateExpression & { expr: DateExSetExpr        } {
    return this.expr.type === "set"
  }

  toJSON(): DateExExpr {
    return this.expr
  }

  toDateEx(): DateEx {
    return exprToDateEx(this.expr)
  }

  static fromJSON(expr: DateExExpr): DateExpression {
    return new DateExpression(expr)
  }
}

// ═══════════════════════════════════════════════════════
//  Parse result examples
// ═══════════════════════════════════════════════════════
//
//  Y2026-M3-W2-D1  →  DateExAnchorExpr {
//    type: "anchor",
//    terms: [
//      { unit: "year",  selector: { type: "scalar", n: 2026 }, cycle: false },
//      { unit: "month", selector: { type: "scalar", n: 3    }, cycle: false },
//      { unit: "week",  selector: { type: "scalar", n: 2    }, cycle: false },
//      { unit: "day",   selector: { type: "scalar", n: 1    }, cycle: false, mode: "weekday" }
//    ]
//  }
//
//  M*  →  DateExCycleExpr {
//    type: "cycle",
//    terms: [{ unit: "month", selector: { type: "wildcard" }, cycle: true }],
//    from: null,
//    to:   null
//  }
//
//  D+1  →  DateExRelativeExpr {
//    type: "relative", unit: "day", op: "+", amount: 1
//  }
//
//  Y2023..Y2024  →  DateExSpanExpr {
//    type: "span",
//    from: { type: "anchor", terms: [{ unit: "year", selector: { type: "scalar", n: 2023 }, cycle: false }] },
//    to:   { type: "anchor", terms: [{ unit: "year", selector: { type: "scalar", n: 2024 }, cycle: false }] }
//  }
//
//  [Y2026, Y2027]  →  DateExSetExpr {
//    type: "set",
//    items: [
//      { type: "anchor", terms: [{ unit: "year", selector: { type: "scalar", n: 2026 }, cycle: false }] },
//      { type: "anchor", terms: [{ unit: "year", selector: { type: "scalar", n: 2027 }, cycle: false }] }
//    ]
//  }
