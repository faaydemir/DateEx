import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, type FC } from 'react'
import { ExpressionInput } from './components/ExpressionInput.tsx'
import { CalendarView } from './components/CalendarView.tsx'
import { TimeCalendarView } from './components/TimeCalendarView.tsx'
import { ParseTree } from './components/ParseTree.tsx'
import { DateEx, INFINITY, JustDay, NEGATIVE_INFINITY } from './parser/JustDate.ts'
import { TimeEx } from './parser/JustTime.ts'
import { parseExtendedToDomain } from './parser/extended.ts'

const CURRENT_YEAR = new Date().getFullYear()
const DATEEX_QUERY_PARAM = 'dateex'

const EXTENDED_EXAMPLES = [
  { expr: 'Y2026-M3-Dm15-H14-Mi30', meaning: 'March 15, 2026 at 14:30' },
  { expr: 'H14', meaning: 'Hour 14' },
  { expr: 'H14-Mi30', meaning: '14:30' },
  { expr: 'H14-Mi30-S45', meaning: '14:30:45' },
  { expr: 'H14-Mi30-S45-Ms250', meaning: '14:30:45.250' },
  { expr: 'H+1', meaning: 'One hour from the current time' },
  { expr: 'Mi-30', meaning: 'Thirty minutes before the current time' },
  { expr: 'H*-Mi30', meaning: 'Every hour at minute 30' },
  { expr: '[H9>H17]-Mi*', meaning: 'Every minute from 09:00 through 17:59' },
]

function getInitialInputValue(): string {
  if (typeof window === 'undefined') return ''
  return new URLSearchParams(window.location.search).get(DATEEX_QUERY_PARAM) ?? ''
}

export const ExtendedApp: FC = () => {
  const [inputValue, setInputValue] = useState(getInitialInputValue)
  const [calYear, setCalYear] = useState(CURRENT_YEAR)
  const [dateEx, setDateEx] = useState<DateEx | undefined>(undefined)
  const [timeEx, setTimeEx] = useState<TimeEx | undefined>(undefined)
  const [error, setError] = useState<string | undefined>(undefined)
  const [isExpressionFocused, setIsExpressionFocused] = useState(false)
  const expressionSectionRef = useRef<HTMLDivElement>(null)
  const deferredInput = useDeferredValue(inputValue)
  const parseResult = useMemo(() => parseExtendedToDomain(deferredInput), [deferredInput])
  const { ast, domainModel, error: parseError } = parseResult

  useEffect(() => {
    if (!domainModel) {
      setDateEx(undefined)
      setTimeEx(undefined)
      setError(parseError ?? undefined)
      return
    }

    try {
      if (domainModel instanceof TimeEx) {
        const today = DateEx.today()
        setDateEx(today)
        setTimeEx(domainModel)
        setCalYear(today.firstDay.year)
        setError(undefined)
        return
      }

      if (!(domainModel instanceof DateEx)) {
        const nextDateEx = domainModel.dateEx
        const nextTimeEx = domainModel.timeEx

        setTimeEx(nextTimeEx)

        if (!nextDateEx) {
          const today = DateEx.today()
          setDateEx(today)
          setCalYear(today.firstDay.year)
          setError(undefined)
          return
        }

        const firstDay = (nextDateEx.firstDay === NEGATIVE_INFINITY || nextDateEx.firstDay === INFINITY)
          ? JustDay.now()
          : nextDateEx.firstDay

        if (firstDay && firstDay.year) {
          setCalYear(firstDay.year)
        }

        setDateEx(nextDateEx)
        setError(undefined)
        return
      }

      setTimeEx(undefined)
      const nextDateEx = domainModel
      const firstDay = (nextDateEx.firstDay === NEGATIVE_INFINITY || nextDateEx.firstDay === INFINITY)
        ? JustDay.now()
        : nextDateEx.firstDay

      if (firstDay && firstDay.year) {
        setCalYear(firstDay.year)
      }

      setDateEx(nextDateEx)
      setError(undefined)
    } catch (e: unknown) {
      setDateEx(undefined)
      setTimeEx(undefined)
      setError(e instanceof Error ? e.message : 'Invalid expression')
    }
  }, [domainModel, parseError])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const url = new URL(window.location.href)
    const value = inputValue.trim()

    if (value) {
      url.searchParams.set(DATEEX_QUERY_PARAM, value)
    } else {
      url.searchParams.delete(DATEEX_QUERY_PARAM)
    }

    window.history.replaceState({}, '', url)
  }, [inputValue])

  const handleExpressionFocus = useCallback(() => {
    setIsExpressionFocused(true)

    window.requestAnimationFrame(() => {
      expressionSectionRef.current?.scrollIntoView({
        block: 'start',
        behavior: 'smooth',
      })
    })
  }, [])

  const handleExpressionBlur = useCallback(() => {
    setIsExpressionFocused(false)
  }, [])

  const handleInputChange = useCallback((val: string) => {
    setInputValue(val)
    handleExpressionFocus()
  }, [handleExpressionFocus])

  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-6">
      <header className="flex flex-col items-start justify-between py-8 pb-12" role="banner">
        <div className="mb-4 flex items-center gap-3">
          <img
            src={`${import.meta.env.BASE_URL}icon.svg`}
            alt=""
            aria-hidden="true"
            className="h-10 w-10 shrink-0 md:h-12 md:w-12"
          />
          <h1 className="translate-y-0.5 text-4xl leading-none tracking-tight text-[#2D4059] md:text-5xl lg:text-4xl">DateEx Extended</h1>
        </div>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <p className="text-xs font-medium uppercase tracking-widest text-[#F07B3F]">Experimental - Date and Time Expression Language</p>
          <a
            href="./"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#EA5455] underline decoration-[#EA5455]/30 underline-offset-4 hover:text-[#FF0000]"
          >
            Check Standart Version
          </a>
        </div>
      </header>

      <main role="main" className="grow">
        <div ref={expressionSectionRef} className="scroll-mt-4">
          <ExpressionInput
            value={inputValue}
            onChange={handleInputChange}
            onFocus={handleExpressionFocus}
            onBlur={handleExpressionBlur}
            error={error ?? null}
            hasResult={!!ast}
          />
        </div>

        {ast != null && (
          <ParseTree ast={ast} />
        )}

        <section className="mb-6" aria-labelledby="extended-examples-title">
          <h2 id="extended-examples-title" className="sr-only">Try an extended example</h2>
          <div className="flex gap-2 overflow-x-auto py-1">
            {EXTENDED_EXAMPLES.map((example) => (
              <button
                key={example.expr}
                type="button"
                className="shrink-0 whitespace-nowrap rounded-full border border-[#1f8a4c]/35 bg-white px-3 py-1.5 font-mono text-xs font-semibold text-[#1f8a4c] transition-all hover:border-[#1f8a4c] hover:bg-[#1f8a4c]/10"
                onClick={() => handleInputChange(example.expr)}
                title={example.meaning}
                aria-pressed={inputValue === example.expr}
              >
                {example.expr}
              </button>
            ))}
          </div>
        </section>

        {dateEx && !timeEx && (
          <div>
            <CalendarView
              year={calYear}
              onYearChange={setCalYear}
              dateEx={dateEx}
            />
          </div>
        )}

        {timeEx && (
          <div>
            <TimeCalendarView
              year={calYear}
              onYearChange={setCalYear}
              dateEx={dateEx ?? DateEx.today()}
              timeEx={timeEx}
            />
          </div>
        )}

        <section className="mt-8 rounded-xl border border-[#BBD5DA] bg-[#eeeeee] p-4" aria-labelledby="extended-syntax-title">
          <h2 id="extended-syntax-title" className="mb-2 text-lg font-bold text-[#2D4059]">Extended Syntax</h2>
          <p className="text-sm leading-relaxed text-[#2D4059]/70">
            DateEx Extended accepts the full JustDate grammar and adds a separate JustTime grammar:
            {' '}<code className="font-mono text-[#2D4059]">H</code>,
            {' '}<code className="font-mono text-[#2D4059]">Mi</code>,
            {' '}<code className="font-mono text-[#2D4059]">S</code>, and
            {' '}<code className="font-mono text-[#2D4059]">Ms</code>.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-[#2D4059]/70">
            Time units are chained largest to smallest:
            {' '}<code className="font-mono text-[#2D4059]">{'H -> Mi -> S -> Ms'}</code>.
          </p>
        </section>
      </main>
    </div>
  )
}

export default ExtendedApp
