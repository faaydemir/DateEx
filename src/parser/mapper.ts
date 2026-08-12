import type {
    DateExExpr,
    DateExAnchorExpr,
    DateExCycleExpr,
    DateExRelativeExpr,
    DateExSpanExpr,
    DateExSetExpr,
    DateExPointExpr,
    DateExTerm,
    DateExSelector,
    DateExRangeItem,
    DateExIndexVal,
    DateExUnitType,
    DateExDayMode,
} from "./DateExpression.ts"
import { DateExpression } from "./DateExpression.ts"
import type { ParseResult } from "../types"
import * as rawParser from "../grammar/parser.js"

// ═══════════════════════════════════════════════════════
//  Raw PEG output types
//  (what the parser actually returns before mapping)
// ═══════════════════════════════════════════════════════

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
    unit: DateExUnitType
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
    unit: DateExUnitType
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

// ═══════════════════════════════════════════════════════
//  Mappers
// ═══════════════════════════════════════════════════════

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
    if (!raw) {
        return { type: "current" }
    }

    if (raw === "*") {
        return cycle ? { type: "wildcard" } : { type: "current" }
    }

    switch (raw.type) {
        case "scalar":
            return { type: "scalar", n: raw.n }
        case "ref":
            return { type: "ref", n: raw.n }
        case "range":
            return { type: "range", items: raw.items.map(mapRangeItem) }
    }
}

function mapTerm(raw: RawTerm): DateExTerm {
    const term: DateExTerm = {
        unit: raw.unit,
        selector: mapSelector(raw.selector, raw.cycle),
        cycle: raw.cycle,
        step: raw.step ?? null,
    }
    if (raw.unit === "day" && raw.mode) {
        term.mode = raw.mode
    }
    return term
}

function mapPointExpr(raw: RawPointExpr): DateExPointExpr {
    if (raw.type === "relative") {
        return mapRelative(raw)
    }
    return mapAnchor(raw)
}

function mapAnchor(raw: RawAnchor): DateExAnchorExpr {
    return {
        type: "anchor",
        terms: raw.terms.map(mapTerm),
    }
}

function mapCycle(raw: RawCycle): DateExCycleExpr {
    return {
        type: "cycle",
        terms: raw.terms.map(mapTerm),
        from: raw.from ? mapPointExpr(raw.from) : null,
        to: raw.to ? mapPointExpr(raw.to) : null,
    }
}

function mapRelative(raw: RawRelative): DateExRelativeExpr {
    return {
        type: "relative",
        unit: raw.unit,
        op: raw.op,
        amount: raw.amount,
    }
}

function mapSpan(raw: RawSpan): DateExSpanExpr {
    return {
        type: "span",
        from: raw.from ? mapPointExpr(raw.from) : null,
        to: raw.until ? mapPointExpr(raw.until) : null,
    }
}

function mapSet(raw: RawSet): DateExSetExpr {
    return {
        type: "set",
        items: raw.items.map(mapNode),
    }
}

function mapNode(raw: RawNode): DateExExpr {
    switch (raw.type) {
        case "anchor": return mapAnchor(raw)
        case "cycle": return mapCycle(raw)
        case "relative": return mapRelative(raw)
        case "span": return mapSpan(raw)
        case "set": return mapSet(raw)
    }
}

// ═══════════════════════════════════════════════════════
//  Public API
// ═══════════════════════════════════════════════════════

/**
 * Map a raw parser node to a DateExpression.
 * Set expressions are preserved as DateExSetExpr inside DateExpression.
 */
export function mapRawNode(raw: RawNode): DateExpression {
    return new DateExpression(mapNode(raw))
}

/**
 * Map the parser wrapper result to a DateExpression.
 *
 * @throws {Error} when parsing failed or the input is empty.
 */
export function mapParseResult(result: ParseResult): DateExpression {
    if (result.error) {
        throw new Error(result.error)
    }
    if (!result.ast) {
        throw new Error("No expression to map")
    }

    return mapRawNode(result.ast as unknown as RawNode)
}

/**
 * Parse a DateEx expression string.
 * Returns a DateExpression.
 *
 * @throws {SyntaxError} on invalid input
 *
 * @example
 * parseDateEx("Y2026-M3")
 * // → DateExpression({ type: "anchor", terms: [...] })
 *
 * @example
 * parseDateEx("[Y2026, Y2027]")
 * // → DateExpression({ type: "set", items: [...] })
 *
 * @example
 * parseDateEx("M*")
 * // → DateExpression({ type: "cycle", terms: [...], from: null, to: null })
 */
export function parseDateEx(input: string): DateExpression {
    const raw = rawParser.parse(input) as unknown as RawNode
    return mapRawNode(raw)
}

/**
 * Parse a DateEx expression string.
 * Returns the inner DateExExpr for callers that do not need the wrapper.
 *
 * @throws {SyntaxError} on invalid input
 */
export function parseDateExOne(input: string): DateExExpr {
    return parseDateEx(input).expr
}
