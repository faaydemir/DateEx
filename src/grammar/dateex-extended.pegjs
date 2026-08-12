// ═════════════════════════════════════════════════════════
//  DateEx Extended PEG Grammar V1 (Peggy)
//  peggyjs.org/online
//
//  TERMINOLOGY
//  ───────────────────────────────────────────────────────
//  unit        →  time level identifier
//                 date: Y | Q | M | W | D | Dm
//                 time: H | Mi | S | Ms
//
//  selector    →  what follows the unit letter(s)
//                 scalar    2026       single index
//                 wildcard  *          every instance
//                 list      [1,3,5]    explicit set
//                 span      [1>6]      inclusive range
//                 open      [3>][<3]   open-ended span
//                 negation  [!3]       every except
//                 ref       ^1         reverse index
//
//  term        →  unit + selector
//                 Y2026  M*  D[1>3]  W^1
//
//  cycle       →  term whose selector ends with *
//                 M*  D[1,3]*  W1*
//
//  stepped     →  cycle term with a /n step
//                 D*/2       every 2nd day in its parent
//                 M*/2-D*/2  every 2nd month, every 2nd day in those months
//
//  point-expr  →  single resolved date, no cycles
//                 Y2026-M3  D+1  M3-Dm15
//
//  anchor      →  term-expr with no cycle terms
//                 Y2026-M3-W2-D1
//
//  cycle-expr  →  term-expr with at least one cycle term
//                 M*-W1-D1  Y2026-M*
//
//  relative    →  unit + (+/-) + integer
//                 D+1  M-2  Y+1
//
//  span  →  ".." + point-expr
//                 active until that date
//
//  bounds      →  [point-expr > point-expr]
//                 window constraint on a cycle-expr
//
//  set         →  [expr, expr, …]
//                 matches any of the listed expressions
// ═════════════════════════════════════════════════════════

// ─── Pre-parse syntactic sugar ───────────────────────────
//
//  Longest-match token substitution before parsing:
//
//  MONDAY    → D1    JANUARY   → M1
//  TUESDAY   → D2    FEBRUARY  → M2
//  WEDNESDAY → D3    MARCH     → M3
//  THURSDAY  → D4    APRIL     → M4
//  FRIDAY    → D5    MAY       → M5
//  SATURDAY  → D6    JUNE      → M6
//  SUNDAY    → D7    JULY      → M7
//                    AUGUST    → M8
//                    SEPTEMBER → M9
//                    OCTOBER   → M10
//                    NOVEMBER  → M11
//                    DECEMBER  → M12
//
// ─────────────────────────────────────────────────────────

// ═════════════════════════════════════════════════════════
//  TOP LEVEL
// ═════════════════════════════════════════════════════════

DateEx
  = SpanExpr
  / SetExpr
  / BoundedCycleExpr
  / Expr

// ═════════════════════════════════════════════════════════
//  POINT EXPRESSION
//  a single resolved date — no cycles, no wildcards
//  shared by SpanExpr and Bounds
// ═════════════════════════════════════════════════════════

PointExpr
  = r:RelativeExpr
  { return r }
  / t:TermExpr
  {
    if (t.type === "cycle") {
      throw new Error(
        `A point expression cannot contain cycles — remove "*" from terms`
      )
    }
    return t
  }

// ═════════════════════════════════════════════════════════
//  SPAN  ..point-expr
//  "active until this date"
// ═════════════════════════════════════════════════════════

SpanExpr
  = ".." expr:PointExpr
  { return { type: "span", until: expr } }
  / &InfixSpan from:PointExpr ".." to:PointExpr
  { return { type: "span", from, until: to } }

InfixSpan
  = (!".." .)* ".."

// ═════════════════════════════════════════════════════════
//  SET  [expr, expr, …]
//  matches any of the listed expressions
//  distinguished from bounds by absence of ">"
//  distinguished from range selector by being standalone
// ═════════════════════════════════════════════════════════

SetExpr
  = "[" first:SetItem rest:("," SetItem)+ "]"
  { return { type: "set", items: [first, ...rest.map(r => r[1])] } }

SetItem
  = SpanExpr
  / BoundedCycleExpr
  / Expr

// ═════════════════════════════════════════════════════════
//  BOUNDED CYCLE  [point-expr > point-expr] - cycle-expr
//  constrains a cycle-expr to a date window
// ═════════════════════════════════════════════════════════

BoundedCycleExpr
  = bounds:Bounds "-" expr:Expr
  {
    if (expr.type !== "cycle") {
      throw new Error(
        `Bounds [...>...] can only be applied to cycle expressions`
      )
    }

    // depth of each unit type
    const depth = { year: 0, quarter: 1, month: 2, week: 3, day: 4, monthday: 4, hour: 5, minute: 6, second: 7, millisecond: 8 }

    // deepest unit appearing in either bound
    const boundTerms = [
      ...(bounds.from?.terms ?? []),
      ...(bounds.to?.terms   ?? [])
    ]
    const boundDepth = boundTerms.length
      ? Math.max(...boundTerms.map(t => depth[t.unit]))
      : -1

    // shallowest cycling term in the expression
    const cycleDepth = Math.min(
      ...expr.terms.filter(t => t.cycle).map(t => depth[t.unit])
    )

    if (boundDepth > cycleDepth) {
      throw new Error(
        `Bound is more specific than the cycling unit — ` +
        `bound must be at the same level or shallower`
      )
    }

    return {
      type:  "cycle",
      terms: expr.terms,
      from:  bounds.from ?? null,
      to:    bounds.to   ?? null
    }
  }

Bounds
  = "[" from:PointExpr ">" to:PointExpr "]" { return { from, to         } }
  / "[" from:PointExpr ">"              "]" { return { from, to: null   } }
  / "["               ">" to:PointExpr "]" { return { from: null, to   } }

// ═════════════════════════════════════════════════════════
//  EXPRESSION
//  resolves to anchor or cycle based on terms present
// ═════════════════════════════════════════════════════════

Expr
  = RelativeExpr
  / TermExpr

// ═════════════════════════════════════════════════════════
//  TERM EXPRESSION  one or more terms joined by -
// ═════════════════════════════════════════════════════════

TermExpr
  = head:Term rest:("-" Term)*
  {
    const terms   = [head, ...rest.map(r => r[1])]
    const hasCycle = terms.some(t => t.cycle)
    const units    = terms.map(t => t.unit)
    const hasWeek  = units.includes("week")
    // validation: D and Dm cannot coexist
    if (units.includes("day") && units.includes("monthday")) {
      throw new Error(
        `"D" (weekday) and "Dm" (month-day) cannot coexist in the same expression`
      )
    }

    // validation: order must follow Y → Q → M → W → (D | Dm) → H → Mi → S → Ms
    const order = { year: 0, quarter: 1, month: 2, week: 3, day: 4, monthday: 4, hour: 5, minute: 6, second: 7, millisecond: 8 }
    for (let i = 1; i < terms.length; i++) {
      if (order[terms[i].unit] <= order[terms[i-1].unit]) {
        throw new Error(
          `Wrong order: "${terms[i].unit}" cannot follow "${terms[i-1].unit}". ` +
          `Must be Y → Q → M → W → (D | Dm) → H → Mi → S → Ms`
        )
      }
    }

    // validation: Dm cannot follow W
    for (let i = 1; i < terms.length; i++) {
      if (terms[i].unit === "monthday" && terms[i-1].unit === "week") {
        throw new Error(
          `"Dm" cannot follow "W" — use "D" for week-day positions`
        )
      }
    }

    // validation: current/default units cannot refine an already selected unit
    const isCurrent = t => t.selector === "*" && !t.cycle
    const isSelected = t => !isCurrent(t) && !t.cycle
    for (let i = 1; i < terms.length; i++) {
      if (isCurrent(terms[i]) && isSelected(terms[i-1])) {
        throw new Error(
          `Current "${terms[i].unit}" cannot follow selected "${terms[i-1].unit}"`
        )
      }
    }

    // tag D terms with mode based on W presence
    // weekday   → D means Mon-Sun position within a week
    // sequential → D means nth workday within parent
    const taggedTerms = terms.map(t => {
      if (t.unit === "day") {
        return { ...t, mode: hasWeek ? "weekday" : "sequential" }
      }
      return t
    })

    // implicit parent resolution is handled at the domain layer
    // grammar just flags anchor vs cycle
    return hasCycle
      ? { type: "cycle",  terms: taggedTerms }
      : { type: "anchor", terms: taggedTerms }
  }

// ═════════════════════════════════════════════════════════
//  TERM  unit + selector
// ═════════════════════════════════════════════════════════

Term
  = u:Unit s:Selector
  { return { unit: u, selector: s.value, cycle: s.cycle, step: s.step } }

// ─── Unit ─────────────────────────────────────────────────

Unit
  = "Ms" { return "millisecond" } // must precede "M"
  / "Mi" { return "minute" }
  / "S"  { return "second" }
  / "Dm" { return "monthday" }  // must precede "D"
  / "H"  { return "hour"      }
  / "D"  { return "day"      }
  / "W"  { return "week"     }
  / "M"  { return "month"    }
  / "Q"  { return "quarter"  }
  / "Y"  { return "year"     }

// ─── Selector ─────────────────────────────────────────────
//
//  All selector types, cycle variants tried first
//
//  scalar    n         single index (no brackets)
//  ref       ^n        reverse index (no brackets)
//  range     [items]   list / span / negation inside []
//  wildcard  *         every instance (no index)

Selector
  = v:ScalarSelector "*" step:Step? { return { value: v, cycle: true,  step: step ?? null } }
  / v:RefSelector    "*" step:Step? { return { value: v, cycle: true,  step: step ?? null } }
  / v:RangeSelector  "*" step:Step? { return { value: v, cycle: true,  step: step ?? null } }
  / "*" step:Step?                  { return { value: "*", cycle: true,  step: step ?? null } }
  / v:ScalarSelector                { return { value: v, cycle: false, step: null } }
  / v:RefSelector                   { return { value: v, cycle: false, step: null } }
  / v:RangeSelector                 { return { value: v, cycle: false, step: null } }
  / ""                              { return { value: "*", cycle: false, step: null } }

Step
  = "/" n:INT
  {
    if (n < 2) {
      throw new Error("Cycle step must be >= 2")
    }
    return n
  }

// scalar: single integer  2026  3  15
ScalarSelector
  = n:INT
  { return { type: "scalar", n } }

// ref: reverse index  ^1  ^3
RefSelector
  = "^" n:INT
  { return { type: "ref", n } }

// range: list / span / negation inside []
RangeSelector
  = "[" first:RangeItem rest:("," RangeItem)* "]"
  { return { type: "range", items: [first, ...rest.map(r => r[1])] } }

// ─── Range items ──────────────────────────────────────────

RangeItem
  = NegationItem
  / OpenLeftItem
  / SpanOrOpenRightItem
  / SingleItem

// negation  !n  — every index except n
NegationItem
  = "!" idx:IndexVal
  { return { type: "negation", index: idx } }

// open-left  <n  — from first up to n inclusive
OpenLeftItem
  = "<" idx:IndexVal
  { return { type: "open-left", to: idx } }

// span  n>m  — n through m inclusive
// open-right  n>  — from n to last
SpanOrOpenRightItem
  = from:IndexVal ">" to:IndexVal { return { type: "span",       from, to } }
  / from:IndexVal ">"             { return { type: "open-right", from     } }

// single  n  — exactly n
SingleItem
  = idx:IndexVal
  { return { type: "single", index: idx } }

// index value: reverse ^n or plain n
IndexVal
  = "^" n:INT { return { type: "ref",    n } }
  / n:INT     { return { type: "scalar", n } }

// ═════════════════════════════════════════════════════════
//  RELATIVE EXPRESSION  unit + (+/-) + integer
//  D+1  M-2  Y+1  H+1  Mi-30  S+45  Ms-250
// ═════════════════════════════════════════════════════════

RelativeExpr
  = u:Unit op:("+" / "-") n:INT
  { return { type: "relative", unit: u, op, amount: n } }

// ═════════════════════════════════════════════════════════
//  PRIMITIVES
// ═════════════════════════════════════════════════════════

INT
  = digits:[0-9]+
  { return parseInt(digits.join(""), 10) }

// ═════════════════════════════════════════════════════════
//  TEST INPUTS
// ═════════════════════════════════════════════════════════

//  ANCHOR
//  Y2026
//  Y2026-Q1
//  Y2026-M3
//  Y2026-M3-W2
//  Y2026-M3-W2-D1
//  Y2026-M3-Dm15
//  Y2026-M3-Dm^1
//  Y2026-M3-Dm[1,15]
//  Y2026-M[1>6]
//  Y2026-D1
//  Y2026-D70

//  IMPLICIT PARENT (domain layer resolves)
//  M3-W2-D1     → Y(current)-M3-W2-D1
//  W2-D1        → Y(current)-W2-D1
//  D1           → W(current)-D1
//  Dm15         → M(current)-Dm15
//  Q2           → Y(current)-Q2
//  M3-Dm15      → Y(current)-M3-Dm15

//  CYCLE
//  M*
//  W*
//  D*
//  Dm*
//  Q*
//  Y*
//  W*-D1
//  M*-W1-D1
//  M*-Dm15
//  M*-Dm[1,15]*
//  Y2026-M*
//  Y2026-W*-D[1,5]*
//  Y2026-M*-Dm[1>10]*
//  Y2026-Q*-M1-Dm1
//  D*/2
//  M*/2-D*/2
//  [Y2026-M1>]-D*/2
//  [Y2026-M1>]-M*/2-D*/2

//  BOUNDED CYCLE
//  [Y2026>Y2027]-M*
//  [Y2026>]-M*
//  [>Y2027]-M*
//  [Y2026-M1>Y2027-M4]-M*
//  [Y2026-Q2>Y2027-Q1]-W*-D1

//  RELATIVE
//  D+1
//  D-1
//  W+1
//  M+3
//  Q-1
//  Y+1
//  Dm+1

//  POINT
//  Y2026-M4
//  M3-Dm15
//  D+5
//  W+1

//  SPAN
//  ..Y2026-M4
//  ..Y2026
//  ..M3-Dm15
//  ..D+5
//  ..W+1
//  Y2023..Y2025
//  Y2023-M1..Y2026-D4

//  SET
//  [Y2026,Y2027]
//  [D,D+1]
//  [M1,M6,M12]
//  [Y2026-M3-Dm1,Y2026-M9-Dm1]
//  [..Y2026-M4,Y2027]
//  [M*,Y2026]
//  [D+1,W+1,M+1]

//  ERRORS (expected)
//  Y2026-D1-W1                    → wrong order
//  Y2026-W1-Dm5                   → Dm cannot follow W
//  Y2026-M1-D1-Dm5                → D and Dm cannot coexist
//  [Y2026-M1-D1>Y2027-M9-D1]-M*  → bound deeper than cycle
//  [Y2026>Y2027]-Y2026-M1         → bounds on non-cycle
//  ..M*                           → span cannot contain cycle
