import { type FC } from 'react'

type JsonRecord = Record<string, unknown>

interface Props {
  ast: unknown
}

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const WEEKDAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

export const ParseTree: FC<Props> = ({ ast }) => {
  if (!isRecord(ast)) return null

  const lines = describeNode(ast)
  if (!lines.length) return null

  return (
    <section className="mb-2 -mt-2 px-1 leading-none" aria-label="Parsed expression meaning">
      <div className="flex flex-col gap-1">
        {lines.map((line, index) => (
          <div
            key={`${line}-${index}`}
            className={index === 0
              ? 'text-sm font-medium leading-tight text-[#2D4059]/70'
              : 'text-xs leading-tight text-[#2D4059]/55'}
          >
            {line}
          </div>
        ))}
      </div>
    </section>
  )
}

function describeNode(node: unknown): string[] {
  if (!isRecord(node)) return []

  switch (node.type) {
    case 'anchor':
      return [describeAnchor(arrayOfRecords(node.terms))]
    case 'cycle':
      return describeCycle(node)
    case 'relative':
      return [describeRelative(node)]
    case 'span':
      return [describeSpan(node)]
    case 'set':
      return describeSet(node)
    default:
      return []
  }
}

function describeAnchor(terms: JsonRecord[]): string {
  const timeText = describeTime(terms)
  const dateText = describeDate(terms)

  if (dateText && timeText) return `${dateText} at ${timeText}`
  if (timeText) return timeText
  return dateText || 'current period'
}

function describeDate(terms: JsonRecord[]): string | null {
  const year = scalar(findTerm(terms, 'year'))
  const quarter = scalar(findTerm(terms, 'quarter'))
  const month = scalar(findTerm(terms, 'month'))
  const week = scalar(findTerm(terms, 'week'))
  const day = scalar(findTerm(terms, 'day'))
  const monthday = scalar(findTerm(terms, 'monthday'))

  if (terms.length === 1) {
    const term = terms[0]
    if (isCurrent(term)) return `current ${unitName(String(term.unit))}`
    if (String(term.unit) === 'week' && term.selector === '*') return 'every week'
  }

  if (year !== null && month !== null && monthday !== null) {
    return `${MONTH_NAMES[month - 1] ?? `month ${month}`} ${monthday}, ${year}`
  }

  if (year !== null && month !== null && week !== null && day !== null) {
    return `${weekdayName(day)} of week ${week} in ${MONTH_NAMES[month - 1] ?? `month ${month}`} ${year}`
  }

  if (year !== null && month !== null) {
    return `${MONTH_NAMES[month - 1] ?? `month ${month}`} ${year}`
  }

  if (year !== null && quarter !== null) return `quarter ${quarter} of ${year}`
  if (year !== null) return `year ${year}`
  if (month !== null && monthday !== null) return `${MONTH_NAMES[month - 1] ?? `month ${month}`} ${monthday} of the current year`
  if (week !== null && day !== null) return `${weekdayName(day)} of week ${week}`
  if (month !== null) return `${MONTH_NAMES[month - 1] ?? `month ${month}`} of the current year`
  if (week !== null) return `week ${week}`
  if (day !== null) return day >= 1 && day <= 7 ? weekdayName(day) : `day ${day}`
  if (monthday !== null) return `day ${monthday} of the current month`

  const currentTerm = terms.find(isCurrent)
  if (currentTerm) return `current ${unitName(String(currentTerm.unit))}`

  return terms.length ? terms.map(describeTerm).join(', ') : null
}

function describeTime(terms: JsonRecord[]): string | null {
  const hour = scalar(findTerm(terms, 'hour'))
  const minute = scalar(findTerm(terms, 'minute'))
  const second = scalar(findTerm(terms, 'second'))
  const ms = scalar(findTerm(terms, 'millisecond'))

  if (hour === null && minute === null && second === null && ms === null) {
    const currentTerm = terms.find((term) => isCurrent(term) && isTimeUnit(String(term.unit)))
    return currentTerm ? `current ${unitName(String(currentTerm.unit))}` : null
  }

  if (hour === null) {
    const timeCurrent = terms.find((term) => isTimeUnit(String(term.unit)))
    return timeCurrent ? describeTerm(timeCurrent) : null
  }

  const hh = String(hour).padStart(2, '0')
  const mi = String(minute ?? 0).padStart(2, '0')
  const ss = String(second ?? 0).padStart(2, '0')
  const mmm = String(ms ?? 0).padStart(3, '0')

  if (ms !== null) return `${hh}:${mi}:${ss}.${mmm}`
  if (second !== null) return `${hh}:${mi}:${ss}`
  return `${hh}:${mi}`
}

function describeCycle(node: JsonRecord): string[] {
  const terms = arrayOfRecords(node.terms)
  const cycleTerms = terms.filter((term) => term.cycle === true)
  const fixedTerms = terms.filter((term) => term.cycle !== true)
  const currentTerms = fixedTerms.filter(isCurrent)
  const selectedTerms = fixedTerms.filter((term) => !isCurrent(term))
  const main = cycleTerms.length
    ? `Every ${cycleTerms.map((term) => cyclePhrase(term)).join(', ')}${currentTerms.length ? ` in ${currentTerms.map(describeTerm).join(', ')}` : ''}${selectedTerms.length ? ` where ${selectedTerms.map(describeTerm).join(', ')}` : ''}`
    : `Recurring ${terms.map(describeTerm).join(', ')}`

  const lines = [main]
  if (node.from || node.to) {
    lines.push(`limited from ${node.from ? describeNode(node.from)[0] : 'the beginning'} to ${node.to ? describeNode(node.to)[0] : 'open end'}`)
  }
  return lines
}

function describeRelative(node: JsonRecord): string {
  const unit = unitName(String(node.unit))
  const amount = Number(node.amount)
  const direction = node.op === '-' ? 'before now' : 'from now'

  if (amount === 1) {
    if (node.unit === 'day') return node.op === '-' ? 'yesterday' : 'tomorrow'
    return `one ${unit} ${direction}`
  }

  return `${amount} ${plural(unit, amount)} ${direction}`
}

function describeSpan(node: JsonRecord): string {
  const from = node.from ? describeNode(node.from)[0] : 'open start'
  const until = node.until ? describeNode(node.until)[0] : 'open end'
  return `From ${from} to ${until}`
}

function describeSet(node: JsonRecord): string[] {
  const items = arrayOfRecords(node.items).map((item) => describeNode(item)[0]).filter(Boolean)
  return [joinEnglish(items)]
}

function describeTerm(term: JsonRecord): string {
  const unit = unitName(String(term.unit))
  if (isCurrent(term)) return `current ${unit}`
  if (term.selector === '*') return `every ${unit}`
  if (isRecord(term.selector)) {
    if (term.selector.type === 'scalar') {
      const n = Number(term.selector.n)
      if (term.unit === 'day' && n >= 1 && n <= 7) return weekdayName(n)
      if (term.unit === 'month' && n >= 1 && n <= 12) return MONTH_NAMES[n - 1]
      return `${unit} ${n}`
    }
    if (term.selector.type === 'ref') return `last ${unit} ${String(term.selector.n)}`
    if (term.selector.type === 'range') return `${unit} range ${arrayOfRecords(term.selector.items).map(rangeItemText).join(', ')}`
  }
  return unit
}

function cyclePhrase(term: JsonRecord): string {
  const unit = unitName(String(term.unit))
  if (term.selector === '*') return unit
  if (isRecord(term.selector) && term.selector.type === 'scalar') {
    return `${unit} ${String(term.selector.n)}`
  }
  if (isRecord(term.selector) && term.selector.type === 'range') {
    return `${unit} ${arrayOfRecords(term.selector.items).map(rangeItemText).join(', ')}`
  }
  return unit
}

function rangeItemText(item: JsonRecord): string {
  switch (item.type) {
    case 'single': return indexText(item.index)
    case 'negation': return `except ${indexText(item.index)}`
    case 'open-left': return `up to ${indexText(item.to)}`
    case 'open-right': return `from ${indexText(item.from)} onward`
    case 'span': return `${indexText(item.from)} through ${indexText(item.to)}`
    default: return String(item.type)
  }
}

function indexText(index: unknown): string {
  if (!isRecord(index)) return String(index)
  return index.type === 'ref' ? `last ${String(index.n)}` : String(index.n)
}

function findTerm(terms: JsonRecord[], unit: string): JsonRecord | undefined {
  return terms.find((term) => term.unit === unit)
}

function scalar(term: JsonRecord | undefined): number | null {
  if (!term || !isRecord(term.selector) || term.selector.type !== 'scalar') return null
  return typeof term.selector.n === 'number' ? term.selector.n : null
}

function isCurrent(term: JsonRecord): boolean {
  return term.cycle !== true && term.selector === '*'
}

function isTimeUnit(unit: string): boolean {
  return unit === 'hour' || unit === 'minute' || unit === 'second' || unit === 'millisecond'
}

function weekdayName(value: number): string {
  return WEEKDAY_NAMES[value - 1] ?? `day ${value}`
}

function unitName(unit: string): string {
  switch (unit) {
    case 'year': return 'year'
    case 'quarter': return 'quarter'
    case 'month': return 'month'
    case 'week': return 'week'
    case 'day': return 'day'
    case 'monthday': return 'month day'
    case 'hour': return 'hour'
    case 'minute': return 'minute'
    case 'second': return 'second'
    case 'millisecond': return 'millisecond'
    default: return unit
  }
}

function plural(word: string, amount: number): string {
  return amount === 1 ? word : `${word}s`
}

function joinEnglish(items: string[]): string {
  if (items.length === 0) return ''
  if (items.length === 1) return items[0]
  if (items.length === 2) return `${items[0]} and ${items[1]}`
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null
}

function arrayOfRecords(value: unknown): JsonRecord[] {
  return Array.isArray(value) ? value.filter(isRecord) : []
}
