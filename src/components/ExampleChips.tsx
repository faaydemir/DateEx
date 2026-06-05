import { useEffect, useState, type FC } from 'react'

type ExampleGroup = 'anchor' | 'current' | 'relative' | 'cycle' | 'span'

interface Example {
  label: string
  meaning: string
  group: ExampleGroup
  featured?: boolean
}

const EXAMPLE_GROUPS: { group: ExampleGroup; label: string }[] = [
  { group: 'anchor', label: 'Anchor' },
  { group: 'current', label: 'Current' },
  { group: 'relative', label: 'Relative' },
  { group: 'cycle', label: 'Cycle' },
  { group: 'span', label: 'Span' },
]

const EXAMPLES: Example[] = [
  { label: 'Y2026', meaning: 'All of 2026', group: 'anchor', featured: true },
  { label: 'Y2026-M3', meaning: 'March 2026', group: 'anchor', featured: true },
  { label: 'Y2026-M3-W2-D1', meaning: 'First day of the second week of March 2026', group: 'anchor', featured: true },
  { label: 'Y2026-M3-Dm15', meaning: 'March 15, 2026', group: 'anchor' },
  { label: 'Y2026-D70', meaning: 'Day index 70 of 2026', group: 'anchor' },
  { label: 'Y2026-M3-Dm^1', meaning: 'Last day of March 2026', group: 'anchor', featured: true },
  { label: 'Y2026-M[1>6]', meaning: 'January through June 2026', group: 'anchor' },
  { label: 'Y2026-Q[2>3]', meaning: 'Q2 and Q3 of 2026', group: 'anchor' },
  { label: 'Y2026-M3-D[1,5]', meaning: 'Day 1 and 5 within March 2026', group: 'anchor' },

  { label: 'D', meaning: 'Today', group: 'current', featured: true },
  { label: 'W', meaning: 'This week', group: 'current' },
  { label: 'M', meaning: 'This month', group: 'current', featured: true },
  { label: 'Q', meaning: 'This quarter', group: 'current' },
  { label: 'Dm', meaning: "Today's day-of-month number", group: 'current' },
  { label: 'D1', meaning: 'First day of the current week', group: 'current' },
  { label: 'Dm1', meaning: 'First calendar day of this month', group: 'current' },
  { label: 'M3-Dm15', meaning: 'March 15 of this year', group: 'current' },
  { label: 'M3-W2-D1', meaning: 'First day of the second week of March this year', group: 'current', featured: true },
  { label: 'W-D5', meaning: 'Friday of this week', group: 'current' },

  { label: 'D+1', meaning: 'Tomorrow', group: 'relative', featured: true },
  { label: 'D-1', meaning: 'Yesterday', group: 'relative', featured: true },
  { label: 'W+2', meaning: 'Two weeks from now', group: 'relative', featured: true },
  { label: 'M-1', meaning: 'Last month', group: 'relative' },
  { label: 'Q+1', meaning: 'Next quarter', group: 'relative' },
  { label: 'Y+1', meaning: 'Next year', group: 'relative', featured: true },
  { label: '[Y2026,Y2027]', meaning: '2026 and 2027 as a set', group: 'relative' },
  { label: '[Y2023,Y2025,Y+1]', meaning: '2023, 2025, and next year', group: 'relative' },
  { label: '[D,D+1]', meaning: 'Today and tomorrow', group: 'relative', featured: true },
  { label: '[M,M+1]', meaning: 'This month and next month', group: 'relative' },
  { label: '[M1,M6,M12]', meaning: 'January, June, and December this year', group: 'relative' },
  { label: '[Y2026-M3-Dm1,Y2026-M9-Dm1]', meaning: 'March 1 and September 1, 2026', group: 'relative' },

  { label: 'D*', meaning: 'Every day', group: 'cycle' },
  { label: 'W*', meaning: 'Every week', group: 'cycle', featured: true },
  { label: 'W*-D1', meaning: 'Every Monday', group: 'cycle' },
  { label: 'M*-Dm15', meaning: 'The 15th of every month', group: 'cycle', featured: true },
  { label: 'M*-Dm^1', meaning: 'Last day of every month', group: 'cycle', featured: true },
  { label: 'Q*-M1-Dm1', meaning: 'First day of the first month of every quarter', group: 'cycle' },
  { label: 'Y*-M6-Dm15', meaning: 'June 15 of every year', group: 'cycle' },
  { label: 'Y2026-W*-D[1,5]*', meaning: 'Monday and Friday of every week in 2026', group: 'cycle', featured: true },
  { label: 'Y2026-M*-Dm[1>10]*', meaning: 'Days 1 through 10 of every month in 2026', group: 'cycle' },
  { label: 'M*-Dm[1,15]', meaning: 'The 1st and 15th of every month', group: 'cycle', featured: true },
  { label: 'M*-Dm[1>5]*', meaning: 'Days 1 through 5 of every month', group: 'cycle' },
  { label: '[Y2026>Y2027]-M*', meaning: 'Every month from 2026 through 2027', group: 'cycle', featured: true },
  { label: '[Y2026-M3>Y2027-M9]-M*', meaning: 'Every month from March 2026 through September 2027', group: 'cycle' },
  { label: '[Y2025>Y2026]-W*-D5', meaning: 'Every Friday from 2025 through 2026', group: 'cycle' },

  { label: 'Y2023..Y2026', meaning: 'The span span from 2023 through 2026', group: 'span', featured: true },
  { label: 'Y2023-M1..Y2023-M12', meaning: 'All of 2023 as a span period', group: 'span' },
  { label: 'Y2023-M6..Y2026-M3', meaning: 'From June 2023 through March 2026', group: 'span' },
  { label: 'Y2023-M1..Y2026-M12', meaning: 'From January 2023 through December 2026', group: 'span' },
]

const GROUP_COLORS: Record<ExampleGroup, string> = {
  anchor: 'border-[#0b5cad]/40 text-[#0b5cad] hover:border-[#0b5cad] hover:bg-[#0b5cad]/10',
  current: 'border-[#b21f73]/40 text-[#b21f73] hover:border-[#b21f73] hover:bg-[#b21f73]/10',
  relative: 'border-[#c77700]/35 text-[#c77700] hover:border-[#c77700] hover:bg-[#c77700]/10',
  cycle: 'border-[#1f8a4c]/35 text-[#1f8a4c] hover:border-[#1f8a4c] hover:bg-[#1f8a4c]/10',
  span: 'border-[#6f45b7]/35 text-[#6f45b7] hover:border-[#6f45b7] hover:bg-[#6f45b7]/10',
}

const GROUP_LABEL_COLORS: Record<ExampleGroup, string> = {
  anchor: 'text-[#0b5cad]',
  current: 'text-[#b21f73]',
  relative: 'text-[#c77700]',
  cycle: 'text-[#1f8a4c]',
  span: 'text-[#6f45b7]',
}

const VISIBLE_EXAMPLE_COUNT = EXAMPLES.filter((ex) => ex.featured).length

function getRandomExamples(count: number): Example[] {
  const shuffled = [...EXAMPLES]

  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    const current = shuffled[i]
    shuffled[i] = shuffled[j]
    shuffled[j] = current
  }

  return shuffled.slice(0, count)
}

interface Props {
  currentValue: string
  onSelect: (expr: string) => void
}

interface ExampleButtonProps {
  example: Example
  isActive: boolean
  onSelect: (expr: string) => void
}

const ExampleChipButton: FC<ExampleButtonProps> = ({ example, isActive, onSelect }) => {
  const active = isActive ? 'ring-2 ring-[#F07B3F]/30 border-[#F07B3F]' : ''

  return (
    <button
      id={`example-${example.label.replace(/[^a-z0-9]/gi, '-')}`}
      type="button"
      className={`shrink-0 whitespace-nowrap rounded-full border bg-white px-3 py-1.5 font-mono text-xs transition-all duration-150 ${GROUP_COLORS[example.group]} ${active} hover:shadow-md`}
      onClick={() => onSelect(example.label)}
      title={`${example.group} expression`}
      aria-pressed={isActive}
    >
      <span className="font-mono text-xs font-semibold">{example.label}</span>
    </button>
  )
}

interface ExampleOptionButtonProps extends ExampleButtonProps {
  onClose: () => void
}

const ExampleOptionButton: FC<ExampleOptionButtonProps> = ({ example, isActive, onSelect, onClose }) => {
  const active = isActive ? 'ring-2 ring-[#F07B3F]/30 border-[#F07B3F]' : ''

  return (
    <button
      type="button"
      className={`w-full rounded-lg border bg-white px-3 py-2 text-left transition-all duration-150 ${GROUP_COLORS[example.group]} ${active} hover:-translate-y-px hover:shadow-md`}
      onClick={() => {
        onSelect(example.label)
        onClose()
      }}
      title={`${example.group} expression`}
      aria-pressed={isActive}
    >
      <span className="block overflow-x-auto whitespace-nowrap font-mono text-xs font-semibold">{example.label}</span>
      <span className="mt-1 block text-xs leading-snug text-[#2D4059]/70">{example.meaning}</span>
    </button>
  )
}

export const ExampleChips: FC<Props> = ({ currentValue, onSelect }) => {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [visibleExamples, setVisibleExamples] = useState(() => getRandomExamples(VISIBLE_EXAMPLE_COUNT))

  useEffect(() => {
    if (!isModalOpen) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsModalOpen(false)
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isModalOpen])

  return (
    <section className="mb-5" aria-labelledby="examples-title">
      <h2 id="examples-title" className="sr-only">Try an example</h2>
      <div className="flex items-start justify-between gap-1">
        <div className="flex-1 overflow-scroll py-1">
          <div className="flex flex-nowrap gap-2">
            {visibleExamples.map((ex) => (
              <ExampleChipButton
                key={ex.label}
                example={ex}
                isActive={currentValue === ex.label}
                onSelect={onSelect}
              />
            ))}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            className="flex h-8 items-center justify-center  hover:border-[#EA5455]/35 hover:text-[#EA5455]"
            onClick={() => setVisibleExamples(getRandomExamples(VISIBLE_EXAMPLE_COUNT))}
            aria-label="Refresh examples"
            title="Refresh examples"
          >
            <svg xmlns="http://www.w3.org/2000/svg" height="20px" viewBox="0 -960 960 960" width="20px" fill="#2D405970"><path d="M480-160q-134 0-227-93t-93-227q0-134 93-227t227-93q69 0 132 28.5T720-690v-110h80v280H520v-80h168q-32-56-87.5-88T480-720q-100 0-170 70t-70 170q0 100 70 170t170 70q77 0 139-44t87-116h84q-28 106-114 173t-196 67Z" /></svg>
          </button>
          <button
            type="button"
            className="whitespace-nowrap text-sm font-semibold text-[#EA5455] underline decoration-[#EA5455]/30 underline-offset-4 transition-colors hover:text-[#FF0000] hover:decoration-[#FF0000]/50"
            onClick={() => setIsModalOpen(true)}
            aria-expanded={isModalOpen}
            aria-controls="all-examples"
          >
            See All
          </button>
        </div>
      </div>


      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#2D4059]/45 px-4 py-8"
          role="presentation"
          onClick={() => setIsModalOpen(false)}
        >
          <div
            id="all-examples"
            className="max-h-[86vh] w-full max-w-5xl overflow-y-auto rounded-2xl border border-[#BBD5DA] bg-[#F5F5F5] p-5 shadow-2xl shadow-[#2D4059]/25"
            role="dialog"
            aria-modal="true"
            aria-labelledby="all-examples-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-5 flex items-center justify-between gap-4">
              <h3 id="all-examples-title" className="text-lg font-bold text-[#2D4059]">All examples</h3>
              <button
                type="button"
                className="flex h-8 w-8 items-center justify-center rounded-full border border-[#BBD5DA] bg-white text-[#2D4059]/70 transition-colors hover:border-[#FF0000]/35 hover:text-[#FF0000]"
                onClick={() => setIsModalOpen(false)}
                aria-label="Close examples"
              >
                x
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {EXAMPLE_GROUPS.map(({ group, label }) => (
                <div key={group} className="rounded-xl border border-[#BBD5DA] bg-[#eeeeee] p-4">
                  <div className={`mb-3 text-[11px] font-bold uppercase tracking-widest ${GROUP_LABEL_COLORS[group]}`}>
                    {label}
                  </div>
                  <div className="flex flex-col gap-2">
                    {EXAMPLES.filter((ex) => ex.group === group).map((ex) => (
                      <ExampleOptionButton
                        key={ex.label}
                        example={ex}
                        isActive={currentValue === ex.label}
                        onSelect={onSelect}
                        onClose={() => setIsModalOpen(false)}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
