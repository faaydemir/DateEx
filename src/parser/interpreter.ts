// ─────────────────────────────────────────────
//  interpreter.ts  —  AST → human description
//                   + date matching helpers
// ─────────────────────────────────────────────
import type {
  AstNode, AnchorNode, CycleNode,
  CycleUnit, UnitType, UnitValue,
  PosIndex, RangeExpr, RangeItem,
} from '../types'

// ─── Ordinal helper ───────────────────────────

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

// ─── Index description ────────────────────────

function describeIndex(idx: PosIndex): string {
  if (idx.type === 'rev') return `${ordinal(idx.n)} from last`
  return ordinal(idx.n)
}

function describeRangeItem(item: RangeItem): string {
  switch (item.type) {
    case 'single':     return describeIndex(item.index)
    case 'neg':        return `not ${describeIndex(item.index)}`
    case 'open_left':  return `before ${describeIndex(item.to)}`
    case 'open_right': return `after ${describeIndex(item.from)}`
    case 'bounded':    return `${describeIndex(item.from)} to ${describeIndex(item.to)}`
  }
}

function describeRange(range: RangeExpr, type: UnitType): string {
  const parts = range.items.map(describeRangeItem)
  return `${type}s [${parts.join(', ')}]`
}

// ─── Unit description ─────────────────────────

function describeUnit(unit: CycleUnit): string {
  const { type, value } = unit
  if (value === '*') {
    const all: Record<UnitType, string> = {
      year: 'every year', quarter: 'every quarter',
      month: 'every month', week: 'every week', day: 'every day',
      monthday: 'every month day',
    }
    return all[type]
  }
  if (typeof value === 'number') {
    return type === 'year' ? `year ${value}` : `${ordinal(value)} ${type}`
  }
  if (typeof value === 'object' && value.type === 'range') {
    return describeRange(value, type)
  }
  if (typeof value === 'object' && (value.type === 'idx' || value.type === 'rev')) {
    return type === 'year' && value.type === 'idx'
      ? `year ${value.n}`
      : describeIndex(value) + ` ${type}`
  }
  return String(value)
}

// ─── Month name ───────────────────────────────

function monthName(n: number | unknown): string {
  if (typeof n !== 'number') return 'month'
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return months[n] ?? `month ${n}`
}

// ─── Anchor builder ───────────────────────────

function buildAnchorDescription(units: CycleUnit[]): string {
  const yearUnit    = units.find(u => u.type === 'year')
  const quarterUnit = units.find(u => u.type === 'quarter')
  const monthUnit   = units.find(u => u.type === 'month')
  const weekUnit    = units.find(u => u.type === 'week')
  const dayUnit     = units.find(u => u.type === 'day')
  const monthDayUnit = units.find(u => u.type === 'monthday')

  const parts: string[] = []

  if (dayUnit)     parts.push(describeUnit(dayUnit) + ' of')
  if (monthDayUnit) parts.push(describeUnit(monthDayUnit) + ' of')
  if (weekUnit)    parts.push('week ' + (typeof weekUnit.value === 'number' ? weekUnit.value : describeUnit(weekUnit)) + ' of')
  if (monthUnit && monthUnit.value !== '*') {
    parts.push(typeof monthUnit.value === 'number' ? monthName(monthUnit.value) : describeUnit(monthUnit))
  }
  if (quarterUnit && quarterUnit.value !== '*') {
    const qNum = typeof quarterUnit.value === 'number' ? quarterUnit.value + 1 : '?'
    parts.push(`Q${qNum}`)
  }
  if (yearUnit) {
    parts.push(String(yearUnit.value))
  }

  return parts.join(' ').trim() || units.map(describeUnit).join(', ')
}

// ─── Cycle builder ────────────────────────────

function buildCycleDescription(units: CycleUnit[]): string {
  const cycleUnits  = units.filter(u => u.cycle)
  const anchorUnits = units.filter(u => !u.cycle)

  const last = cycleUnits[cycleUnits.length - 1]
  const allLabels: Record<UnitType, string> = {
    year: 'Every year', quarter: 'Every quarter',
    month: 'Every month', week: 'Every week', day: 'Every day',
    monthday: 'Every month day',
  }

  let desc = last.value === '*'
    ? allLabels[last.type]
    : `Every ${describeUnit({ ...last, cycle: false })}`

  const context: string[] = []

  // parent cycle units (all but innermost)
  for (const u of cycleUnits.slice(0, -1)) {
    context.push(u.value === '*' ? `every ${u.type}` : `in ${describeUnit({ ...u, cycle: false })}`)
  }

  // anchor context
  for (const u of anchorUnits) {
    if (u.type === 'year')    context.push(`in ${u.value}`)
    else if (u.type === 'quarter' && typeof u.value === 'number') context.push(`in Q${u.value + 1}`)
    else if (u.type === 'month'   && typeof u.value === 'number') context.push(`in ${monthName(u.value)}`)
    else context.push(`in ${describeUnit(u)}`)
  }

  if (context.length > 0) desc += ' ' + context.join(', ')
  return desc
}

// ─── Public: describe ─────────────────────────

/**
 * Returns a human-readable description of a JustDate AST node.
 */
export function describe(ast: AstNode): string {
  switch (ast.type) {
    case 'current': {
      const names: Record<UnitType, string> = {
        day: 'Today', week: 'This week', month: 'This month',
        quarter: 'This quarter', year: 'This year',
        monthday: "Today's day-of-month",
      }
      return ast.units.map((unit) => names[unit.type] ?? describeUnit(unit)).join(', ')
    }

    case 'relative': {
      const { unit, op, amount } = ast
      const sign = op === '+' ? 1 : -1
      if (unit === 'day' && amount === 1) return sign > 0 ? 'Tomorrow' : 'Yesterday'
      const unitLabel: Record<UnitType, string> = {
        day: 'day', week: 'week', month: 'month', quarter: 'quarter', year: 'year',
        monthday: 'day-of-month',
      }
      const label = unitLabel[unit]
      const dir = op === '+' ? 'ahead' : 'ago'
      return `${amount} ${label}${amount !== 1 ? 's' : ''} ${dir}`
    }

    case 'anchor': return buildAnchorDescription(ast.units)
    case 'cycle':  return buildCycleDescription(ast.units)
    case 'set':    return ast.items.map(describe).join(' or ')
  }
}

// ─────────────────────────────────────────────
//  Date matching
// ─────────────────────────────────────────────

function toISO(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function allDaysInYear(year: number): Date[] {
  const days: Date[] = []
  const d = new Date(year, 0, 1)
  while (d.getFullYear() === year) {
    days.push(new Date(d))
    d.setDate(d.getDate() + 1)
  }
  return days
}

function getWeekStarts(year: number): Date[] {
  const weeks: Date[] = []
  const d = new Date(year, 0, 1)
  while (d.getDay() !== 0) d.setDate(d.getDate() + 1)
  while (d.getFullYear() === year) {
    weeks.push(new Date(d))
    d.setDate(d.getDate() + 7)
  }
  return weeks
}

function resolveScalarIndex(value: UnitValue): number[] {
  if (value === '*') return []
  if (typeof value === 'number') return [value]
  if (typeof value === 'object') {
    if (value.type === 'idx') return [value.n]
    if (value.type === 'range') {
      return value.items.flatMap((item): number[] => {
        if (item.type === 'single' && item.index.type === 'idx') return [item.index.n]
        return []
      })
    }
  }
  return []
}

function resolveDayIndices(value: UnitValue, total: number): number[] {
  if (!value || value === '*') return Array.from({ length: total }, (_, i) => i)
  if (typeof value === 'number') return [value]
  if (typeof value === 'object') {
    if (value.type === 'idx') return [value.n]
    if (value.type === 'rev') return [total - 1 - value.n]
    if (value.type === 'range') {
      const result = new Set<number>()
      for (const item of value.items) {
        const resolveIdx = (idx: PosIndex) =>
          idx.type === 'rev' ? total - 1 - idx.n : idx.n

        switch (item.type) {
          case 'single':
            result.add(resolveIdx(item.index))
            break
          case 'neg': {
            const ex = resolveIdx(item.index)
            for (let i = 0; i < total; i++) if (i !== ex) result.add(i)
            break
          }
          case 'open_left': {
            const to = resolveIdx(item.to)
            for (let i = 0; i < to; i++) result.add(i)
            break
          }
          case 'open_right': {
            const from = resolveIdx(item.from)
            for (let i = from + 1; i < total; i++) result.add(i)
            break
          }
          case 'bounded': {
            const from = resolveIdx(item.from)
            const to   = resolveIdx(item.to)
            for (let i = from; i <= to; i++) result.add(i)
            break
          }
        }
      }
      return [...result].sort((a, b) => a - b)
    }
  }
  return [0]
}

function filterDaysByUnits(days: Date[], units: CycleUnit[]): Date[] {
  const quarterUnit = units.find(u => u.type === 'quarter')
  const monthUnit   = units.find(u => u.type === 'month')
  const weekUnit    = units.find(u => u.type === 'week')
  const dayUnit     = units.find(u => u.type === 'day')
  const monthDayUnit = units.find(u => u.type === 'monthday')

  let result = days

  if (quarterUnit && quarterUnit.value !== '*') {
    const idxs = resolveScalarIndex(quarterUnit.value)
    if (idxs.length > 0) {
      result = result.filter(d => idxs.includes(Math.floor(d.getMonth() / 3)))
    }
  }

  if (monthUnit && monthUnit.value !== '*') {
    const idxs = resolveScalarIndex(monthUnit.value)
    if (idxs.length > 0) {
      result = result.filter(d => idxs.includes(d.getMonth()))
    }
  }

  if (weekUnit && weekUnit.value !== '*') {
    const year = days[0]?.getFullYear() ?? new Date().getFullYear()
    const weekStarts = getWeekStarts(year)
    const idxs = resolveScalarIndex(weekUnit.value)
    const allowedStarts = idxs.flatMap(i => weekStarts[i] ? [weekStarts[i]] : [])
    result = result.filter(d =>
      allowedStarts.some(ws => {
        const end = new Date(ws)
        end.setDate(end.getDate() + 6)
        return d >= ws && d <= end
      })
    )
  }

  if (dayUnit) {
    const total = result.length
    const idxs = resolveDayIndices(dayUnit.value, total)
    result = idxs.map(i => result[i]).filter((d): d is Date => !!d)
  }

  if (monthDayUnit) {
    const idxs = resolveScalarIndex(monthDayUnit.value)
    if (idxs.length > 0) {
      result = result.filter(d => idxs.includes(d.getDate()))
    }
  }

  return result
}

function currentDateStr(unit: UnitType): string {
  const now = new Date()
  if (unit === 'day') return toISO(now)
  if (unit === 'week') {
    const d = new Date(now)
    d.setDate(d.getDate() - d.getDay())
    return toISO(d)
  }
  if (unit === 'month') return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`
  if (unit === 'monthday') return toISO(now)
  if (unit === 'quarter') {
    const q = Math.floor(now.getMonth() / 3)
    return `${now.getFullYear()}-${String(q*3+1).padStart(2,'0')}-01`
  }
  return `${now.getFullYear()}-01-01`
}

function relativeDate(unit: UnitType, op: '+' | '-', amount: number): string {
  const now = new Date()
  const sign = op === '+' ? 1 : -1
  const d = new Date(now)
  if (unit === 'day')   d.setDate(d.getDate() + sign * amount)
  if (unit === 'week')  d.setDate(d.getDate() + sign * amount * 7)
  if (unit === 'month') d.setMonth(d.getMonth() + sign * amount)
  if (unit === 'quarter') d.setMonth(d.getMonth() + sign * amount * 3)
  if (unit === 'year')  d.setFullYear(d.getFullYear() + sign * amount)
  if (unit === 'monthday') d.setDate(d.getDate() + sign * amount)
  return toISO(d)
}

/**
 * Returns ISO date strings (YYYY-MM-DD) matched by the AST in the given year.
 */
export function matchDates(ast: AstNode, year: number = new Date().getFullYear()): string[] {
  try {
    switch (ast.type) {
      case 'current':  return ast.units.map((unit) => currentDateStr(unit.type))
      case 'relative': return [relativeDate(ast.unit, ast.op, ast.amount)]
      case 'set':      return ast.items.flatMap((item) => matchDates(item, year))
      case 'anchor':
      case 'cycle': {
        const yearUnit = ast.units.find(u => u.type === 'year')
        const effectiveYear = yearUnit && typeof yearUnit.value === 'number'
          ? yearUnit.value
          : year

        const allDays = allDaysInYear(effectiveYear)
        return filterDaysByUnits(allDays, ast.units).map(toISO)
      }
    }
  } catch {
    return []
  }
}

// ─────────────────────────────────────────────
//  Public API Interfaces
// ─────────────────────────────────────────────

export interface DateEx {
  describe(ast: AstNode): string;
  matchDates(ast: AstNode, year?: number): string[];
}
