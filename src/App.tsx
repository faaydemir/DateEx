import { useState, useCallback, useDeferredValue, type FC, useEffect, useMemo, useRef } from 'react'
import { parseToDomain } from './parser/index.ts'
import { DateEx, INFINITY, JustDay, NEGATIVE_INFINITY } from './parser/JustDate.ts'
import { ExpressionInput } from './components/ExpressionInput.tsx'
import { ExampleChips } from './components/ExampleChips.tsx'
import { CalendarView } from './components/CalendarView.tsx'
import { SyntaxReference } from './components/SyntaxReference.tsx'

const CURRENT_YEAR = new Date().getFullYear()
const DATEEX_QUERY_PARAM = 'dateex'

function getInitialInputValue(): string {
  if (typeof window === 'undefined') return ''
  return new URLSearchParams(window.location.search).get(DATEEX_QUERY_PARAM) ?? ''
}

export const App: FC = () => {
  const [inputValue, setInputValue] = useState(getInitialInputValue)
  const [calYear, setCalYear] = useState(CURRENT_YEAR)
  const [dateEx, setDateEx] = useState<DateEx | undefined>(undefined)
  const [error, setError] = useState<string | undefined>(undefined)
  const [isExpressionFocused, setIsExpressionFocused] = useState(false)
  const expressionSectionRef = useRef<HTMLDivElement>(null)
  const deferredInput = useDeferredValue(inputValue)

  const parseResult = useMemo(() => parseToDomain(deferredInput), [deferredInput])
  const { ast, domainModel, error: parseError } = parseResult

  useEffect(() => {
    if (!domainModel) {
      setDateEx(undefined)
      setError(parseError)
      return
    }

    try {
      const nextCron = domainModel

      const firstDay = (nextCron.firstDay === NEGATIVE_INFINITY || nextCron.firstDay === INFINITY)
        ? JustDay.now()
        : nextCron.firstDay

      if (firstDay && firstDay.year) {
        setCalYear(firstDay.year)
      }
      setDateEx(nextCron)
      setError(undefined)
    } catch (e: any) {
      setError(e.message)
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

  const handleInputChange = useCallback((val: string) => {
    setInputValue(val)
    handleExpressionFocus()
  }, [])

  const handleExampleSelect = useCallback((expr: string) => {
    setInputValue(expr)
    handleExpressionFocus()
  }, [])

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

  return (
    <div className="max-w-6xl mx-auto px-6 min-h-screen flex flex-col">
      {/* Header */}
      <header className="flex flex-col items-start justify-between py-8 pb-12" role="banner">
        <div className="mb-4 flex items-center gap-3">
          <img
            src={`${import.meta.env.BASE_URL}icon.svg`}
            alt=""
            aria-hidden="true"
            className="h-10 w-10 shrink-0 md:h-12 md:w-12"
          />
          <h1 id="hero-title" className="translate-y-0.5 text-4xl md:text-5xl lg:text-4xl tracking-tight text-[#2D4059] leading-none">DateEx</h1>
        </div>
        <p className="text-xs font-medium tracking-widest uppercase text-[#F07B3F] mb-4">Date Expression Language</p>
      </header>



      {/* Main content */}
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


        <ExampleChips currentValue={inputValue} onSelect={handleExampleSelect} />

        {(dateEx) && (
          <div>
            <CalendarView
              year={calYear}
              onYearChange={setCalYear}
              dateEx={dateEx}
            />
          </div>
        )}
        <SyntaxReference onSelect={handleExampleSelect} />
      </main>

    </div>
  )
}

export default App
