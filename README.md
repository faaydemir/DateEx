# DateEx Grammar 
> Draft Documentation 


DateEx is a compact language for describing dates, date sets, relative dates, and recurring date cycles. It is designed for precise scheduling expressions, not natural-language date text.

With DateEx you can express various types of time patterns in different date-unit(year, quarter, month, week, day) scopes. For example:
you can define singular date, set of dates and recurring cycles.

---

## How DateEx Works

A DateEx expression is built by chaining **units** + **selectors** separated by `-`.
Unit must be listed in descending order. Each unit narrows the scope of the one before it.
selectors can be indexes (e.g. `M3` for March), ranges (e.g. `D[1>5]` for days 1 through 5), or `*` for "every instance of this unit within the resolved parent."
selectors are relative to parent units. For example, in `Y2026-M3-W2-D1`, `D1` means the first day of the second week of March 2026, not the first day of the year.

```
Y2026-M3-W2-D1
│     │  │  └─ day 1 of...
│     │  └──── week 2 of...
│     └─────── March of...
└───────────── 2026
```

This hierarchical structure is the core idea behind DateEx. Every unit resolves _within_ the context established by the units to its left. That context is called the **resolved parent**. In `Y2026-M3-W2-D1`, the resolved parent of `D1` is week 2 of March 2026 — not week 2 of the year.

You do not need to specify every level. Units can be skipped as long as the order stays largest to smallest. `Y2026-D70` is valid and means day index 70 of 2026, with no month or week specified.

---

## Units

| Token | Meaning                                                                            |
| ----- | ---------------------------------------------------------------------------------- |
| `Y`   | Year                                                                               |
| `Q`   | Quarter                                                                            |
| `M`   | Month                                                                              |
| `W`   | Week                                                                               |
| `D`   | Day position within the resolved parent (weekday-style index, not a calendar date) |
| `Dm`  | Calendar day-of-month within the resolved parent                                   |

Units must appear in descending order:

```
Y → Q → M → W → D
                 Dm
```

Any descending subsequence is valid. Intermediate units may be skipped.

### D vs Dm — Which Day Unit to Use?

This is the most important distinction in DateEx. Both `D` and `Dm` refer to a day, but they count differently.

**`D` counts positions within its parent (weekday-style).** `D1` always means "the first day-position within the resolved parent." Inside a week, `D1` is Monday, `D5` is Friday. This is useful for expressing recurring weekday patterns.

**`Dm` counts calendar days of the month.** `Dm15` means the 15th day of the month, regardless of what weekday it falls on. This is useful for fixed dates like "the 1st of every month" or "March 15."

| Goal                                    | Use  | Example          |
| --------------------------------------- | ---- | ---------------- |
| Every Monday of the year                | `D`  | `Y2026-W*-D1`    |
| The 15th of every month                 | `Dm` | `M*-Dm15`        |
| A specific calendar date                | `Dm` | `Y2026-M3-Dm15`  |
| First day of the second week of a month | `D`  | `Y2026-M3-W2-D1` |

**Rules:**

- `D` and `Dm` cannot appear in the same expression.
- `Dm` cannot follow `W`. `W2-Dm1` is invalid because weeks are not subdivided by calendar day.

### Selectors

#### IndexSelector

Indexes start at `1`. `M1` is January, `Q1` is the first quarter, `D1` is the first day-position within the resolved parent, `Dm1` is the first calendar day of the month.

**Reverse indexes** count from the end using `^n`. `^1` is the last item, `^2` is the second-to-last, and so on. A reverse index attaches directly to the unit letter:

| Expression      | Meaning                   |
| --------------- | ------------------------- |
| `Y2026-M3-Dm^1` | Last day of March 2026    |
| `Y2026-M^1`     | December 2026             |
| `Y2026-Q^1`     | Last quarter (Q4) of 2026 |
| `M*-Dm^1`       | Last day of every month   |

Do not write reverse indexes inside brackets. `Dm^1` is correct; `Dm[^1]` is not.

---

#### Range and Set Selectors

Square brackets select multiple indexes for a unit. `M[1,6,12]` selects January, June, and December; `D[1>5]` selects a closed span from 1 through 5.

Open-ended range selectors are exclusive at the written bound: `D[<3]` selects values before 3, and `D[3>]` selects values after 3.

#### Cycle Selector

`*` marks a unit as recurring. `M*` means every month in the resolved year, and `W*-D1` means day 1 of every week.

## Expression Kinds

DateEx supports four kinds of expressions:

| Kind              | Summary                          | Starts with            |
| ----------------- | -------------------------------- | ---------------------- |
| **Anchor**        | A fixed, concrete date or period | `Y`                    |
| **Current**       | A date relative to today         | Any unit except `Y`    |
| **Cycle**         | A recurring pattern              | Any unit; contains `*` |
| **Bounded cycle** | A cycle limited to a date range  | `[…>…]-` prefix        |

---

## Anchors

An anchor is a fixed date or period. It always starts with `Y` and resolves to the same point in time regardless of when the expression is evaluated.
--Explain Set,[,]
**Examples:**

| Expression          | Meaning                                    |
| ------------------- | ------------------------------------------ |
| `Y2026`             | All of 2026                                |
| `Y2026-Q1`          | January–March 2026                         |
| `Y2026-M3`          | March 2026                                 |
| `Y2026-M3-W2-D1`    | First day of the second week of March 2026 |
| `Y2026-M3-Dm15`     | March 15, 2026                             |
| `Y2026-D70`         | Day index 70 of 2026                       |
| `Y2026-M3-Dm[1,15]` | March 1 and March 15, 2026                 |
| `[Y2026,Y2027]`     | 2026 and 2027 as a set                     |

---

## Current

A Current omits `Y` and resolves relative to today's date. Missing parent units are filled in automatically from the current date.

Think of a Current as an anchor with the year (and any other missing parents) implied. `M3-Dm15` means March 15 of the current year. `W2-D1` means the first day of week 2 of the current year.

### Bare Units — The Current Value

A unit written alone, with no index, means "the current value of that unit":

| Expression | Meaning                     |
| ---------- | --------------------------- |
| `D`        | Today                       |
| `W`        | This week                   |
| `M`        | This month                  |
| `Q`        | This quarter                |
| `Dm`       | Today's day-of-month number |

### Indexed Units — A Position in the Current Parent

A unit written with an index resolves within an implicit current parent:

| Expression | Implicit parent        | Meaning                                 |
| ---------- | ---------------------- | --------------------------------------- |
| `D1`       | This year + this week  | First day of the current week           |
| `Dm1`      | This year + this month | First calendar day of the current month |
| `W1`       | This year              | Week 1 of this year                     |
| `M1`       | This year              | January of this year                    |
| `Q1`       | This year              | First quarter of this year              |

Current support the same unit ordering as anchors, with `Y` omitted:

```
Q → M → W → D
              Dm
```

**Examples:**

| Expression | Meaning                                         |
| ---------- | ----------------------------------------------- |
| `M3-Dm15`  | March 15 of this year                           |
| `Q2-M1-D1` | First day of the first month of Q2 this year    |
| `M3-W2-D1` | First day of the second week of March this year |
| `W-D5`     | Friday of this week                             |

### Relative Expressions — Offsets from Today

Bare current units (those without an index) support `+` and `-` offsets. The offset moves forward or backward by that many units from the current value.

| Expression | Meaning               |
| ---------- | --------------------- |
| `D+1`      | Tomorrow              |
| `D-1`      | Yesterday             |
| `W+1`      | Next week             |
| `W-1`      | Last week             |
| `M+1`      | Next month            |
| `M-1`      | Last month            |
| `M+3`      | Three months from now |
| `Q+1`      | Next quarter          |
| `Y+1`      | Next year             |
| `Y-1`      | Last year             |

> **Note:** Relative offsets apply only to bare units. `D1+1` is not valid — indexed units do not support offsets.

---

## Sets

Any anchor or Current can be grouped into a set using `[item, item, …]`. A set matches any of the listed dates or periods.

| Expression                    | Meaning                                  |
| ----------------------------- | ---------------------------------------- |
| `[Y2023,Y2025]`               | 2023 and 2025                            |
| `[Y2023,Y2025,Y+1]`           | 2023, 2025, and next year                |
| `[D,D+1]`                     | Today and tomorrow                       |
| `[M,M+1]`                     | This month and next month                |
| `[M1,M6,M12]`                 | January, June, and December of this year |
| `[Y2026-M3-Dm1,Y2026-M9-Dm1]` | March 1 and September 1, 2026            |

Sets can mix anchors and Current freely.

---

## Cycles

A cycle is any expression containing at least one `*`. It describes a **recurring pattern** — a date or period that repeats on a regular schedule.

The `*` means "every instance of this unit within its resolved parent."

- `M*` — every month within the resolved parent (the year, if unspecified)
- `Y2026-M*` — every month of 2026
- `M*-Dm15` — the 15th of every month

### Anchored vs Open Cycles

A cycle that starts with `Y` is **anchored** to that year and produces a finite set of occurrences. A cycle without a `Y` prefix is **open** and repeats indefinitely across all years.

| Expression    | Scope            | Meaning                               |
| ------------- | ---------------- | ------------------------------------- |
| `Y2026-M*`    | Anchored to 2026 | Every month of 2026 (12 occurrences)  |
| `M*`          | Open             | Every month, every year, indefinitely |
| `Y2026-W*-D5` | Anchored to 2026 | Every Friday of 2026                  |
| `W*-D5`       | Open             | Every Friday, forever                 |
| `M*-Dm1`      | Open             | First day of every month, forever     |

### The `*` After a Range

When `*` appears after a range bracket (e.g., `Dm[1>10]*`), the cycle fires on **each value** in the range within every parent, rather than on a single recurring position.

| Expression           | Meaning                                  |
| -------------------- | ---------------------------------------- |
| `Y2026-M*-Dm15`      | The 15th of every month in 2026          |
| `Y2026-M*-Dm[1,15]`  | The 1st and 15th of every month in 2026  |
| `Y2026-M*-Dm[1>10]*` | Days 1 through 10 of every month in 2026 |
| `Y2026-W*-D[1,5]*`   | Monday and Friday of every week in 2026  |

### Cycle Examples

| Expression    | Meaning                                       |
| ------------- | --------------------------------------------- |
| `D*`          | Every day                                     |
| `W*-D1`       | Every Monday                                  |
| `M*-W1-D1`    | First day of the first week of every month    |
| `M*-Dm^1`     | Last day of every month                       |
| `Q*-M1-Dm1`   | First day of the first month of every quarter |
| `Y*-M6-Dm15`  | June 15 of every year                         |
| `Y2026-Q*-M1` | First month of each quarter of 2026           |

---

## Bounded Cycles

A bounded cycle restricts a cycle to a specific date range. The bound is written as a prefix before the cycle:

```
[from>to]-cycle     — from start through end, inclusive on both sides
[from>]-cycle       — from start onward, open-ended into the future
[>to]-cycle         — from the beginning through end
```

The `from` and `to` values are anchors and support the full anchor syntax.

**Examples:**

| Expression               | Meaning                                             |
| ------------------------ | --------------------------------------------------- |
| `[Y2026>Y2027]-M*`       | Every month from January 2026 through December 2027 |
| `[Y2026>]-M*`            | Every month from January 2026 onward, indefinitely  |
| `[>Y2027]-M*`            | Every month up through December 2027                |
| `[Y2026-M3>Y2027-M9]-M*` | Every month from March 2026 through September 2027  |
| `[Y2026-Q2>Y2027-Q1]-M*` | Every month from Q2 2026 through Q1 2027            |
| `[Y2025>Y2026]-W*-D5`    | Every Friday from 2025 through 2026                 |

**Bound depth rule:** The deepest unit in the bound must be at the same level as, or shallower than, the shallowest cycling unit. The bound cannot be more precise than the cycle itself.

| Expression                     | Valid? | Reason                                                      |
| ------------------------------ | ------ | ----------------------------------------------------------- |
| `[Y2026>Y2027]-M*`             | ✅     | Bound at year level; cycle at month level                   |
| `[Y2026-M3>Y2027-M9]-M*`       | ✅     | Bound at month level; cycle at month level                  |
| `[Y2026-M1-D1>Y2027-M9-D1]-M*` | ❌     | Bound goes to day level; cycle is at month level — too deep |

---

## Continues

A continues expression represents a continuous time range from a start point to an end point. It uses the `..` operator to denote the range span. If there is no start or end, it represents infinity (open-ended).

The syntax uses anchors at year level:

```
start..end       — from start through end, inclusive
start..          — from start onward, to infinity
..end            — from infinity (beginning) through end
```

**Examples:**

| Expression        | Meaning                           |
| ----------------- | --------------------------------- |
| `Y2023..Y2027`    | From 2023 through 2027            |
| `Y2023..`         | From 2023 onward, indefinitely    |
| `..Y2027`         | From the beginning through 2027   |
| `Y2020-M3..Y2025` | From March 2020 through 2025      |
| `Y2020-M3..`      | From March 2020 onward            |
| `..Y2022-M6`      | From the beginning through June 2022 |

The continues expression describes a **bounded time period** rather than a recurring cycle. It is useful for defining time windows, task validity periods, or project timelines.

**Difference from Bounded Cycles:**
- **Bounded Cycles** (`[from>to]-cycle`): Restrict a recurring pattern to a date range
- **Continues** (`start..end`): Define a simple continuous time period with no recurrence

| Expression              | Kind                  | Meaning                                |
| ----------------------- | --------------------- | -------------------------------------- |
| `[Y2023>Y2027]-M*`      | Bounded cycle         | Every month from 2023 through 2027     |
| `Y2023..Y2027`          | Continues             | The continuous span from 2023 to 2027  |
| `Y2023-M1..Y2023-M12`   | Continues             | All of 2023 as a continuous period     |

---

## Ranges

Ranges select a subset of index values within a unit. They are written inside brackets attached to the unit.

### Range Syntax

| Syntax | Meaning                               | Example  | Resolves to                         |
| ------ | ------------------------------------- | -------- | ----------------------------------- |
| `n,m`  | Exactly `n` and `m`                   | `D[1,5]` | Days 1 and 5                        |
| `n>m`  | From `n` through `m`, inclusive       | `D[1>5]` | Days 1, 2, 3, 4, 5                  |
| `<n`   | Every value before `n`                | `D[<3]`  | Days 1 and 2                        |
| `n>`   | Every value after `n`                 | `D[3>]`  | Day 4 to the last day of the parent |
| `!n`   | Every index except `n`                | `D[!6]`  | All days except day 6               |

### Range Examples

| Expression        | Meaning                                  |
| ----------------- | ---------------------------------------- |
| `Y2026-M3-D[1,5]` | Day positions 1 and 5 within March 2026  |
| `Y2026-M[1>6]`    | January through June 2026                |
| `Y2026-M[!1]`     | Every month of 2026 except January       |
| `M*-Dm[1,15]`     | The 1st and 15th of every month          |
| `M*-Dm[<10]`      | The first 10 days of every month         |
| `M*-Dm[20>]`      | Day 20 through the end of every month    |
| `Y2026-Q[2>3]`    | Q2 and Q3 of 2026                        |

Ranges combine naturally with cycles. Adding `*` after a range means the cycle fires on every value in the range:

```
M*-Dm[1,15]     — 1st and 15th of every month
M*-Dm[1>5]*     — days 1 through 5 of every month
```

---

## Syntactic Sugar (Draft)

Named day and month aliases are expanded before parsing. They are interchangeable with their numeric equivalents and may be used anywhere the corresponding unit index would appear.

| Name        | Expands to |
| ----------- | ---------- |
| `TODAY `    | `D`        |
| `TOMORROW`  | `D+1`      |
| `MONDAY`    | `D1`       |
| `TUESDAY`   | `D2`       |
| `WEDNESDAY` | `D3`       |
| `THURSDAY`  | `D4`       |
| `FRIDAY`    | `D5`       |
| `SATURDAY`  | `D6`       |
| `SUNDAY`    | `D7`       |
|             |            |
| `JANUARY`   | `M1`       |
| `FEBRUARY`  | `M2`       |
| `MARCH`     | `M3`       |
| `APRIL`     | `M4`       |
| `MAY`       | `M5`       |
| `JUNE`      | `M6`       |
| `JULY`      | `M7`       |
| `AUGUST`    | `M8`       |
| `SEPTEMBER` | `M9`       |
| `OCTOBER`   | `M10`      |
| `NOVEMBER`  | `M11`      |
| `DECEMBER`  | `M12`      |
|             |            |
| `WEEKDAYS`  | `D[1>5]`   |
| `WEEKEND`   | `D[6,7]`   |
|             |            |



- TODO add
    - WEEKDAYS D[1>5]
    - WEEKENDS D[6,7]
    - TOMORROW D+1,TODAY D
    - EVERYDAY D*
    - EVERYWEEK W*
    - EVERYMONTH M*
    - EVERYQUARTER Q* 
    - EVERYYEAR Y*
    - EVERYWEEKDAYS D[1>5]* 
    - EVERYWEEKENDS D[6,7]\*

**Examples:**

| Sugar form                | Canonical form   | Meaning                                 |
| ------------------------- | ---------------- | --------------------------------------- |
| `Y2026-JANUARY-Dm15`      | `Y2026-M1-Dm15`  | January 15, 2026                        |
| `Y2026-M3-W2-MONDAY`      | `Y2026-M3-W2-D1` | Monday of the second week of March 2026 |
| `W*-FRIDAY`               | `W*-D5`          | Every Friday                            |
| `[Y2026>Y2027]-M*-MONDAY` | —                | Every Monday from 2026 through 2027     |

---

## Common Mistakes

| Mistake                  | Problem                             | Fix                                                          |
| ------------------------ | ----------------------------------- | ------------------------------------------------------------ |
| `Y2026-M3-W2-Dm15`       | `Dm` cannot follow `W`              | Drop `W`: `Y2026-M3-Dm15`, or use `D` after `W`              |
| `Y2026-M3-D1-Dm15`       | `D` and `Dm` in the same expression | Choose one: `D` for weekday-position, `Dm` for calendar date |
| `D1+1`                   | Cannot offset an indexed unit       | Use a bare unit: `D+1`                                       |
| `Dm[^1]`                 | Reverse index inside brackets       | Write directly on the unit: `Dm^1`                           |
| `[Y2026-D1>Y2027-D1]-M*` | Bound is deeper than the cycle unit | Bound must not exceed cycle precision: `[Y2026>Y2027]-M*`    |
| `W2-Dm1`                 | `Dm` cannot follow `W`              | Use `W2-D1`, or drop `W` and use `M-Dm1`                     |

---

## Quick Reference

### Building an Expression

| Goal                               | Pattern       | Example                       |
| ---------------------------------- | ------------- | ----------------------------- |
| A specific year                    | `Yn`          | `Y2026`                       |
| A specific month                   | `Yn-Mm`       | `Y2026-M3`                    |
| A specific calendar date           | `Yn-Mm-Dmk`   | `Y2026-M3-Dm15`               |
| A weekday within a week of a month | `Yn-Mm-Ww-Dd` | `Y2026-M3-W2-D1`              |
| Today                              | `D`           | `D`                           |
| Tomorrow / yesterday               | `D+1` / `D-1` | `D+1`                         |
| Next / last month                  | `M+1` / `M-1` | `M+1`                         |
| This month, last day               | `M-Dm^1`      | `M-Dm^1`                      |
| Every week of a year               | `Yn-W*`       | `Y2026-W*`                    |
| Every month, all years             | `M*`          | `M*`                          |
| The 15th of every month            | `M*-Dm15`     | `M*-Dm15`                     |
| Every Friday                       | `W*-D5`       | `W*-D5`                       |
| Last day of every month            | `M*-Dm^1`     | `M*-Dm^1`                     |
| Every month within a range         | `[Yn>Ym]-M*`  | `[Y2026>Y2028]-M*`            |
| Multiple specific dates            | `[expr,expr]` | `[Y2026-M3-Dm1,Y2026-M9-Dm1]` |
| Days 1 and 15 of every month       | `M*-Dm[1,15]` | `M*-Dm[1,15]`                 |
| Every weekday (Mon–Fri)            | `W*-D[1>5]*`  | `W*-D[1>5]*`                  |

## Next

- Add hour(H),minute(Mi),second(S)


### Grammar compilation

The grammar is compiled at dev/build time:

```bash
npm run build:grammar
# → runs: peggy --format es --output src/grammar/parser.js src/grammar/justdate.pegjs
```

This runs automatically before `npm run dev` and `npm run build` via `pre*` npm hooks.

### Adding a grammar rule

1. Edit `src/grammar/justdate.pegjs`
2. Run `npm run build:grammar` to recompile
3. Update `src/parser/interpreter.js` to handle the new AST node type

---

## 🛠️ Tech Stack

| Tool | Version |
|---|---|
| React | 19 (latest) |
| Vite | 6.x |
| Peggy | 4.x |

---

## 📝 License

MIT
