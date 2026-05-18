import type { FC } from 'react'
import grammarFileUrl from '../grammar/justdate.pegjs?url'

type ReferenceCategory = 'anchor' | 'current' | 'relative' | 'cycle' | 'continuous'

interface ReferenceGroup {
  category: ReferenceCategory
  label: string
  definition: string
  rows: { expr: string; meaning: string }[]
}

const SYNTAX_REFERENCE: ReferenceGroup[] = [
  {
    category: 'anchor',
    label: 'Anchor — exact date',
    definition: 'A fixed date or period. Anchors always start with Y and resolve the same way every time.',
    rows: [
      { expr: 'Y2026', meaning: 'All of 2026' },
      { expr: 'Y2026-Q1', meaning: 'January through March 2026' },
      { expr: 'Y2026-M3', meaning: 'March 2026' },
      { expr: 'Y2026-M3-Dm15', meaning: 'March 15, 2026' },
      { expr: 'Y2026-M3-W2-D1', meaning: 'First day of the second week of March 2026' },
      { expr: 'Y2026-M3-Dm^1', meaning: 'Last day of March 2026' },
      { expr: 'Y2026-D70', meaning: 'Day index 70 of 2026' },
      { expr: 'Y2026-M[1>6]', meaning: 'January through June 2026' },
    ],
  },
  {
    category: 'current',
    label: 'Current — this period',
    definition: 'A date relative to today. Current expressions omit Y and fill missing parents from the current date.',
    rows: [
      { expr: 'D', meaning: 'Today' },
      { expr: 'W', meaning: 'This week' },
      { expr: 'M', meaning: 'This month' },
      { expr: 'Q', meaning: 'This quarter' },
      { expr: 'Dm', meaning: "Today's day-of-month number" },
      { expr: 'M3-Dm15', meaning: 'March 15 of this year' },
      { expr: 'W-D5', meaning: 'Friday of this week' },
    ],
  },
  {
    category: 'relative',
    label: 'Relative — offset from now',
    definition: 'Bare current units can move with + or -. Sets also live here: they match any listed item.',
    rows: [
      { expr: 'D+1', meaning: 'Tomorrow' },
      { expr: 'D-1', meaning: 'Yesterday' },
      { expr: 'W+2', meaning: 'Two weeks from now' },
      { expr: 'M-1', meaning: 'Last month' },
      { expr: 'Q+1', meaning: 'Next quarter' },
      { expr: 'Y+1', meaning: 'Next year' },
      { expr: '[D,D+1]', meaning: 'Today and tomorrow' },
      { expr: '[Y2026,Y2027]', meaning: '2026 and 2027' },
    ],
  },
  {
    category: 'cycle',
    label: 'Cycle — recurring',
    definition: 'Any expression containing * is recurring. A Y prefix anchors the cycle to that year.',
    rows: [
      { expr: 'D*', meaning: 'Every day' },
      { expr: 'W*-D1', meaning: 'Every Monday' },
      { expr: 'M*-Dm15', meaning: 'The 15th of every month' },
      { expr: 'M*-Dm^1', meaning: 'Last day of every month' },
      { expr: 'M*-Dm[1,15]', meaning: 'The 1st and 15th of every month' },
      { expr: 'Y2026-W*-D[1,5]*', meaning: 'Monday and Friday of every week in 2026' },
      { expr: '[Y2026>Y2027]-M*', meaning: 'Every month from 2026 through 2027' },
      { expr: '[Y2025>Y2026]-W*-D5', meaning: 'Every Friday from 2025 through 2026' },
    ],
  },
  {
    category: 'continuous',
    label: 'Continuous — time span',
    definition: 'A continuous expression uses .. to describe one uninterrupted closed time window from a start to an end.',
    rows: [
      { expr: 'Y2023..Y2026', meaning: 'The continuous span from 2023 through 2026' },
      { expr: 'Y2023-M1..Y2023-M12', meaning: 'All of 2023 as a continuous period' },
      { expr: 'Y2023-M6..Y2026-M3', meaning: 'From June 2023 through March 2026' },
      { expr: 'Y2023-M1..Y2026-M12', meaning: 'From January 2023 through December 2026' },
    ],
  },
]

const CATEGORY_COLORS: Record<ReferenceCategory, string> = {
  anchor: 'text-[#0b5cad]',
  cycle: 'text-[#1f8a4c]',
  relative: 'text-[#c77700]',
  current: 'text-[#b21f73]',
  continuous: 'text-[#6f45b7]',
}

interface Props {
  onSelect: (expr: string) => void
}

export const SyntaxReference: FC<Props> = ({ onSelect }) => {
  return (
    <section className="mt-8" aria-labelledby="syntax-title">
      <div className="flex flex-col gap-3 mb-7">
        <div className="flex items-center justify-between  w-full gap-3">
          <h2 id="syntax-title" className="text-lg font-bold text-[#2D4059] mb-1.5">Syntax</h2>
          <a
            href={grammarFileUrl}
            target="_blank"
            rel="noreferrer"
            className="font-mono text-sm text-[#EA5455] underline decoration-[#EA5455]/30 underline-offset-4 transition-colors hover:text-[#FF0000] hover:decoration-[#FF0000]/50"
          >
            see pegjs grammar
          </a>
        </div>
        <p className="text-sm text-[#2D4059]/70 leading-relaxed">
          DateEx is a compact language for describing exact dates, date sets, relative dates, continuous time spans, and recurring cycles.
        </p>
        <p className="text-sm text-[#2D4059]/70 leading-relaxed">
          Units are chained from largest to smallest:
          {' '}<code className="font-mono text-[#2D4059]">Y → Q → M → W → D</code>
          {' '}or <code className="font-mono text-[#2D4059]">Dm</code>.
          Selectors choose which part of each unit to use: indexes like <code className="font-mono text-[#2D4059]">M3</code>,
          <code className="font-mono text-[#2D4059]">[...]</code> for sets or ranges,
          <code className="font-mono text-[#2D4059]">*</code> for recurring cycles,
          <code className="font-mono text-[#2D4059]">..</code> for continuous spans, and
          <code className="font-mono text-[#2D4059]">^1</code> for the last index.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-2">
        {SYNTAX_REFERENCE.map((group) => (
          <div
            key={group.category}
            className="bg-[#eeeeee] border border-[#BBD5DA] rounded-xl p-3 hover:border-[#F07B3F]/60 transition-all duration-200"
            role="group"
            aria-label={group.label}
          >
            <div className={`text-[11px] font-bold uppercase tracking-widest mb-2 ${CATEGORY_COLORS[group.category]}`}>
              {group.label}
            </div>
            <p className="mb-4 text-xs leading-relaxed text-[#2D4059]/65">{group.definition}</p>
            <div className="flex flex-col gap-2.5">
              {group.rows.map((row) => (
                <div key={row.expr} className="flex flex-col gap-1">
                  <div>
                    <button
                      type="button"
                      onClick={() => onSelect(row.expr)}
                      className="font-mono text-[12px] text-[#2D4059] bg-white border border-[#BBD5DA]/70 px-1.5 py-0.5 rounded items-start self-start transition-colors hover:bg-[#F07B3F] hover:border-[#F07B3F] hover:text-white"
                      title="Use this expression"
                    >
                      {row.expr}
                    </button>
                  </div>
                  <span className="text-xs text-[#2D4059]/65">{row.meaning}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
