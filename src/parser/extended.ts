import type { ParseResult } from '../types'
import { DateEx } from './JustDate.ts'
import {
  JustTime,
  JustTimeHierarchical,
  JustTimeSet,
  JustTimeType,
  TimeCycle,
  TimeCycleUnit,
  TimeEx,
  type TimeUnit,
} from './JustTime.ts'
import { mapRawNode } from './mapper.ts'
import type { DateExDayMode, DateExIndexVal, DateExRangeItem, DateExSelector, DateExUnitType } from './DateExpression.ts'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
import * as rawParser from '../grammar/extended-parser.js'

const parser = rawParser as { parse: (input: string) => unknown }

type ExtendedUnitType = DateExUnitType | JustTimeType

type RawIndexVal =
  | { type: "scalar"; n: number }
  | { type: "ref"; n: number }

type RawRangeItem =
  | { type: "single"; index: RawIndexVal }
  | { type: "negation"; index: RawIndexVal }
  | { type: "open-left"; to: RawIndexVal }
  | { type: "open-right"; from: RawIndexVal }
  | { type: "span"; from: RawIndexVal; to: RawIndexVal }

type RawRangeSelector = {
  type: "range"
  items: RawRangeItem[]
}

type RawSelectorValue =
  | { type: "scalar"; n: number }
  | { type: "ref"; n: number }
  | RawRangeSelector
  | "*"

type RawTerm = {
  unit: ExtendedUnitType | "hour" | "minute" | "second" | "millisecond"
  selector?: RawSelectorValue
  cycle: boolean
  step?: number | null
  mode?: DateExDayMode
}

type RawAnchor = {
  type: "anchor"
  terms: RawTerm[]
}

type RawCycle = {
  type: "cycle"
  terms: RawTerm[]
  from?: RawPointExpr | null
  to?: RawPointExpr | null
}

type RawRelative = {
  type: "relative"
  unit: RawTerm["unit"]
  op: "+" | "-"
  amount: number
}

type RawSpan = {
  type: "span"
  from?: RawPointExpr | null
  until?: RawPointExpr | null
}

type RawSet = {
  type: "set"
  items: RawNode[]
}

type RawPointExpr = RawAnchor | RawRelative
type RawNode = RawAnchor | RawCycle | RawRelative | RawSpan | RawSet

type TimePointExpr =
  | { type: "anchor"; terms: TimeTerm[] }
  | { type: "relative"; unit: JustTimeType; op: "+" | "-"; amount: number }

type TimeExpr =
  | { type: "anchor"; terms: TimeTerm[] }
  | { type: "cycle"; terms: TimeTerm[]; from: TimePointExpr | null; to: TimePointExpr | null }
  | { type: "relative"; unit: JustTimeType; op: "+" | "-"; amount: number }
  | { type: "span"; from: TimePointExpr | null; to: TimePointExpr | null }
  | { type: "set"; items: TimeExpr[] }

type TimeTerm = {
  unit: JustTimeType
  selector: DateExSelector
  cycle: boolean
  step?: number | null
}

export interface ExtendedMixedDomainModel {
  type: "mixed"
  dateEx?: DateEx
  timeEx?: TimeEx
}

export type ExtendedDomainModel = DateEx | TimeEx | ExtendedMixedDomainModel

const rawUnitToUnit = (unit: RawTerm["unit"]): ExtendedUnitType => {
  switch (unit) {
    case "hour": return JustTimeType.HOUR
    case "minute": return JustTimeType.MIN
    case "second": return JustTimeType.SECOND
    case "millisecond": return JustTimeType.MS
    default: return unit
  }
}

const isTimeUnit = (unit: ExtendedUnitType): unit is JustTimeType =>
  unit === JustTimeType.HOUR ||
  unit === JustTimeType.MIN ||
  unit === JustTimeType.SECOND ||
  unit === JustTimeType.MS

function collectUnits(node: RawNode | RawPointExpr): ExtendedUnitType[] {
  switch (node.type) {
    case "anchor":
    case "cycle":
      return node.terms.map((term) => rawUnitToUnit(term.unit))
    case "relative":
      return [rawUnitToUnit(node.unit)]
    case "span":
      return [
        ...(node.from ? collectUnits(node.from) : []),
        ...(node.until ? collectUnits(node.until) : []),
      ]
    case "set":
      return node.items.flatMap(collectUnits)
  }
}

function expressionKind(node: RawNode): "date" | "time" | "mixed" {
  const units = collectUnits(node)
  const hasTime = units.some(isTimeUnit)
  const hasDate = units.some((unit) => !isTimeUnit(unit))

  if (hasDate && hasTime) return "mixed"
  return hasTime ? "time" : "date"
}

function isRawTimeTerm(term: RawTerm): boolean {
  return isTimeUnit(rawUnitToUnit(term.unit))
}

function splitRawTerms(terms: RawTerm[]) {
  return {
    dateTerms: terms.filter((term) => !isRawTimeTerm(term)),
    timeTerms: terms.filter(isRawTimeTerm),
  }
}

function dateNodeFromRaw(raw: RawNode): RawNode | null {
  switch (raw.type) {
    case "anchor": {
      const { dateTerms } = splitRawTerms(raw.terms)
      return dateTerms.length ? { type: "anchor", terms: dateTerms } : null
    }
    case "cycle": {
      const { dateTerms } = splitRawTerms(raw.terms)
      return dateTerms.length ? {
        type: dateTerms.some((term) => term.cycle) ? "cycle" : "anchor",
        terms: dateTerms,
        from: raw.from,
        to: raw.to,
      } as RawNode : null
    }
    case "relative":
      return isTimeUnit(rawUnitToUnit(raw.unit)) ? null : raw
    case "span": {
      const from = raw.from ? dateNodeFromRaw(raw.from) : null
      const to = raw.until ? dateNodeFromRaw(raw.until) : null
      if (!from && !to) return null
      return {
        type: "span",
        from: from && (from.type === "anchor" || from.type === "relative") ? from : undefined,
        until: to && (to.type === "anchor" || to.type === "relative") ? to : undefined,
      }
    }
    case "set": {
      const items = raw.items.map(dateNodeFromRaw).filter((item): item is RawNode => !!item)
      return items.length ? { type: "set", items } : null
    }
  }
}

function timeNodeFromRaw(raw: RawNode): RawNode | null {
  switch (raw.type) {
    case "anchor": {
      const { timeTerms } = splitRawTerms(raw.terms)
      return timeTerms.length ? { type: "anchor", terms: timeTerms } : null
    }
    case "cycle": {
      const { timeTerms } = splitRawTerms(raw.terms)
      return timeTerms.length ? { type: timeTerms.some((term) => term.cycle) ? "cycle" : "anchor", terms: timeTerms } as RawNode : null
    }
    case "relative":
      return isTimeUnit(rawUnitToUnit(raw.unit)) ? raw : null
    case "span": {
      const from = raw.from ? timeNodeFromRaw(raw.from) : null
      const to = raw.until ? timeNodeFromRaw(raw.until) : null
      if (!from && !to) return null
      return {
        type: "span",
        from: from && (from.type === "anchor" || from.type === "relative") ? from : undefined,
        until: to && (to.type === "anchor" || to.type === "relative") ? to : undefined,
      }
    }
    case "set": {
      const items = raw.items.map(timeNodeFromRaw).filter((item): item is RawNode => !!item)
      return items.length ? { type: "set", items } : null
    }
  }
}

function mapIndexVal(raw: RawIndexVal): DateExIndexVal {
  return raw.type === "ref"
    ? { type: "ref", n: raw.n }
    : { type: "scalar", n: raw.n }
}

function mapRangeItem(raw: RawRangeItem): DateExRangeItem {
  switch (raw.type) {
    case "single":
      return { type: "single", index: mapIndexVal(raw.index) }
    case "negation":
      return { type: "negation", index: mapIndexVal(raw.index) }
    case "open-left":
      return { type: "open-left", to: mapIndexVal(raw.to) }
    case "open-right":
      return { type: "open-right", from: mapIndexVal(raw.from) }
    case "span":
      return { type: "span", from: mapIndexVal(raw.from), to: mapIndexVal(raw.to) }
  }
}

function mapSelector(raw: RawSelectorValue | undefined, cycle: boolean): DateExSelector {
  if (!raw) return { type: "current" }
  if (raw === "*") return cycle ? { type: "wildcard" } : { type: "current" }

  switch (raw.type) {
    case "scalar":
      return { type: "scalar", n: raw.n }
    case "ref":
      return { type: "ref", n: raw.n }
    case "range":
      return { type: "range", items: raw.items.map(mapRangeItem) }
  }
}

function mapTimeTerm(raw: RawTerm): TimeTerm {
  const unit = rawUnitToUnit(raw.unit)
  if (!isTimeUnit(unit)) {
    throw new Error(`${unit} is not a JustTime unit`)
  }

  return {
    unit,
    selector: mapSelector(raw.selector, raw.cycle),
    cycle: raw.cycle,
    step: raw.step ?? null,
  }
}

function mapTimePoint(raw: RawPointExpr): TimePointExpr {
  if (raw.type === "relative") {
    const unit = rawUnitToUnit(raw.unit)
    if (!isTimeUnit(unit)) throw new Error(`${unit} is not a JustTime unit`)
    return { type: "relative", unit, op: raw.op, amount: raw.amount }
  }
  return { type: "anchor", terms: raw.terms.map(mapTimeTerm) }
}

function mapTimeNode(raw: RawNode): TimeExpr {
  switch (raw.type) {
    case "anchor":
      return { type: "anchor", terms: raw.terms.map(mapTimeTerm) }
    case "cycle":
      return {
        type: "cycle",
        terms: raw.terms.map(mapTimeTerm),
        from: raw.from ? mapTimePoint(raw.from) : null,
        to: raw.to ? mapTimePoint(raw.to) : null,
      }
    case "relative": {
      const unit = rawUnitToUnit(raw.unit)
      if (!isTimeUnit(unit)) throw new Error(`${unit} is not a JustTime unit`)
      return { type: "relative", unit, op: raw.op, amount: raw.amount }
    }
    case "span":
      return {
        type: "span",
        from: raw.from ? mapTimePoint(raw.from) : null,
        to: raw.until ? mapTimePoint(raw.until) : null,
      }
    case "set":
      return { type: "set", items: raw.items.map(mapTimeNode) }
  }
}

function currentTimeValue(type: JustTimeType): number {
  const now = JustTime.now(type).firstMs
  switch (type) {
    case JustTimeType.HOUR: return now.hour
    case JustTimeType.MIN: return now.min
    case JustTimeType.SECOND: return now.second
    case JustTimeType.MS: return now.ms
    default:
      throw new Error(`Cannot get current value for ${type}`)
  }
}

function indexesFor(type: JustTimeType): number[] {
  switch (type) {
    case JustTimeType.HOUR:
      return Array.from({ length: 24 }, (_, index) => index)
    case JustTimeType.MIN:
    case JustTimeType.SECOND:
      return Array.from({ length: 60 }, (_, index) => index)
    case JustTimeType.MS:
      return Array.from({ length: 1000 }, (_, index) => index)
    default:
      throw new Error(`No indexes for ${type}`)
  }
}

function resolveTimeIndex(index: DateExIndexVal, unit: JustTimeType): number {
  const all = indexesFor(unit)
  if (index.type === "scalar") {
    if (!Number.isInteger(index.n) || !all.includes(index.n)) {
      throw new Error(`Index ${index.n} is out of range for ${unit}`)
    }
    return index.n
  }

  const resolved = all[all.length - index.n]
  if (resolved === undefined) {
    throw new Error(`Reverse index ^${index.n} is out of range for ${unit}`)
  }
  return resolved
}

function rangeToTimeIndexes(items: DateExRangeItem[], unit: JustTimeType): number[] {
  const all = indexesFor(unit)
  const selected = new Set(items.some((item) => item.type === "negation") ? all : [])

  for (const item of items) {
    switch (item.type) {
      case "single":
        selected.add(resolveTimeIndex(item.index, unit))
        break
      case "negation":
        selected.delete(resolveTimeIndex(item.index, unit))
        break
      case "open-left": {
        const to = resolveTimeIndex(item.to, unit)
        all.filter((index) => index < to).forEach((index) => selected.add(index))
        break
      }
      case "open-right": {
        const from = resolveTimeIndex(item.from, unit)
        all.filter((index) => index > from).forEach((index) => selected.add(index))
        break
      }
      case "span": {
        const from = resolveTimeIndex(item.from, unit)
        const to = resolveTimeIndex(item.to, unit)
        all.filter((index) => index >= from && index <= to).forEach((index) => selected.add(index))
        break
      }
    }
  }

  return all.filter((index) => selected.has(index))
}

function selectorToTimeValues(term: TimeTerm): number[] {
  switch (term.selector.type) {
    case "scalar": return [resolveTimeIndex(term.selector, term.unit)]
    case "ref": return [resolveTimeIndex(term.selector, term.unit)]
    case "current": return [currentTimeValue(term.unit)]
    case "range": return rangeToTimeIndexes(term.selector.items, term.unit)
    case "wildcard": throw new Error("wildcard selector cannot be converted to fixed times")
  }
}

function selectorToCycleIndexes(term: TimeTerm): number[] {
  switch (term.selector.type) {
    case "wildcard":
      return []
    case "current":
      return [currentTimeValue(term.unit)]
    case "scalar":
      return [resolveTimeIndex(term.selector, term.unit)]
    case "ref":
      return [resolveTimeIndex(term.selector, term.unit)]
    case "range":
      return rangeToTimeIndexes(term.selector.items, term.unit)
  }
}

function expandImplicitTimeParents(terms: TimeTerm[]): TimeTerm[] {
  const first = terms[0]
  if (!first || first.unit === JustTimeType.HOUR) return terms

  const parentOrder =
    first.unit === JustTimeType.MIN ? [JustTimeType.HOUR] :
      first.unit === JustTimeType.SECOND ? [JustTimeType.HOUR, JustTimeType.MIN] :
        [JustTimeType.HOUR, JustTimeType.MIN, JustTimeType.SECOND]

  return [
    ...parentOrder.map((unit): TimeTerm => ({
      unit,
      selector: { type: "current" },
      cycle: false,
    })),
    ...terms,
  ]
}

function anchorToJustTimes(expr: Extract<TimeExpr, { type: "anchor" }>): JustTime[] {
  const terms = expandImplicitTimeParents(expr.terms)
  const unitGroups = terms.reduce<TimeUnit[][]>((groups, term) => {
    return groups.flatMap((units) =>
      selectorToTimeValues(term).map((value) => [...units, { type: term.unit, value }]))
  }, [[]])

  return unitGroups.map((units) => new JustTimeHierarchical(units).toJustTime())
}

function anchorToJustTime(expr: Extract<TimeExpr, { type: "anchor" }>): JustTime {
  const times = anchorToJustTimes(expr)
  if (times.length !== 1) {
    throw new Error("Point expression must resolve to exactly one time")
  }
  return times[0]
}

function relativeToJustTime(expr: Extract<TimeExpr, { type: "relative" }>): JustTime {
  const amount = expr.op === "-" ? -expr.amount : expr.amount
  return JustTime.new(expr.unit).add(amount)
}

function pointToJustTime(expr: TimePointExpr): JustTime {
  return expr.type === "relative" ? relativeToJustTime(expr) : anchorToJustTime(expr)
}

function cycleToTimeCycle(expr: Extract<TimeExpr, { type: "cycle" }>): TimeCycle {
  return new TimeCycle(
    expr.terms.map((term) => new TimeCycleUnit(term.unit, selectorToCycleIndexes(term), term.step ?? null)),
    expr.from ? pointToJustTime(expr.from) : undefined,
    expr.to ? pointToJustTime(expr.to) : undefined,
  )
}

function exprToTimeEx(expr: TimeExpr): TimeEx {
  switch (expr.type) {
    case "anchor": {
      const times = anchorToJustTimes(expr)
      return times.length === 1
        ? new TimeEx(times[0])
        : new TimeEx(new JustTimeSet(times, true))
    }
    case "relative":
      return new TimeEx(relativeToJustTime(expr))
    case "cycle":
      return new TimeEx(cycleToTimeCycle(expr))
    case "span":
      return new TimeEx(new JustTimeSet([
        expr.from ? pointToJustTime(expr.from) : new JustTimeHierarchical([{ type: JustTimeType.HOUR, value: 0 }]).toJustTime(),
        expr.to ? pointToJustTime(expr.to) : new JustTimeHierarchical([
          { type: JustTimeType.HOUR, value: 23 },
          { type: JustTimeType.MIN, value: 59 },
          { type: JustTimeType.SECOND, value: 59 },
          { type: JustTimeType.MS, value: 999 },
        ]).toJustTime(),
      ], true))
    case "set":
      return new TimeEx(new JustTimeSet(expr.items.flatMap((item) => {
        const value = exprToTimeEx(item)
        if (value.valueType === "cycle") {
          throw new Error("Set expressions containing cycles cannot be converted to a single TimeEx")
        }
        return (value.value as JustTimeSet).toArray()
      }), true))
  }
}

/**
 * Parse a DateEx Extended expression string.
 * Extended keeps old DateEx parsing and adds separate JustTime parsing.
 */
export function parseExtended(input: string): ParseResult {
  const trimmed = input.trim()
  if (!trimmed) return { ast: null, error: null }

  try {
    const ast = parser.parse(trimmed)
    return { ast: ast as ParseResult['ast'], error: null }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Invalid expression'
    return { ast: null, error: msg }
  }
}

export function parseExtendedToDomain(input: string): { domainModel: ExtendedDomainModel | null; ast: unknown | null; error: string | null } {
  const trimmed = input.trim()
  if (!trimmed) return { domainModel: null, ast: null, error: null }

  try {
    const raw = parser.parse(trimmed) as RawNode
    const kind = expressionKind(raw)

    if (kind === "date") {
      return { domainModel: mapRawNode(raw as never).toDateEx(), ast: raw, error: null }
    }

    if (kind === "time") {
      return { domainModel: exprToTimeEx(mapTimeNode(raw)), ast: raw, error: null }
    }

    const dateNode = dateNodeFromRaw(raw)
    const timeNode = timeNodeFromRaw(raw)

    return {
      domainModel: {
        type: "mixed",
        dateEx: dateNode ? mapRawNode(dateNode as never).toDateEx() : undefined,
        timeEx: timeNode ? exprToTimeEx(mapTimeNode(timeNode)) : undefined,
      },
      ast: raw,
      error: null,
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Invalid expression'
    return { domainModel: null, ast: null, error: msg }
  }
}
