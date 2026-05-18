import { useRef, useCallback, type FC, type ChangeEvent, type FocusEvent } from 'react'

interface Props {
  value: string
  onChange: (val: string) => void
  onFocus?: () => void
  onBlur?: () => void
  error: string | null
  hasResult: boolean
}

export const ExpressionInput: FC<Props> = ({ value, onChange, onFocus, onBlur, error, hasResult }) => {
  const inputRef = useRef<HTMLInputElement>(null)

  const handleChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value)
  }, [onChange])

  const handleFocus = useCallback(() => {
    onFocus?.()
  }, [onFocus])

  const handleBlur = useCallback((e: FocusEvent<HTMLDivElement>) => {
    if (e.currentTarget.contains(e.relatedTarget)) return
    onBlur?.()
  }, [onBlur])

  const handleClear = useCallback(() => {
    onChange('')
    inputRef.current?.focus()
  }, [onChange])

  const borderClass = error
    ? 'border-[#FF0000]/70 focus:border-[#FF0000] focus:ring-[#FF0000]/15 shadow-[#EA5455]/10'
    : hasResult
      ? 'border-[#F07B3F] focus:border-[#F07B3F] focus:ring-[#F07B3F]/20'
      : 'border-[#BBD5DA] focus:border-[#F07B3F] focus:ring-[#F07B3F]/15'

  return (
    <div className="mb-4" onBlur={handleBlur}>
      <div className="relative">
        <input
          ref={inputRef}
          id="expression-input"
          type="text"
          className={[
            'w-full px-5 py-3 rounded-xl font-mono text-2xl font-medium',
            'bg-[#eeeeee] text-[#2D4059] outline-none',
            'border-2 transition-all duration-200',
            'focus:ring-4 shadow-lg shadow-[#BBD5DA]/40',
            'placeholder:text-[#2D4059]/45 placeholder:font-normal placeholder:tracking-normal',
            borderClass,
          ].join(' ')}
          value={value}
          onChange={handleChange}
          onFocus={handleFocus}
          placeholder="Y2023-Q1-W*"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          aria-label="JustDate expression"
          aria-invalid={!!error}
          aria-describedby={error ? 'expression-error' : undefined}
        />
        {value && (
          <button
            id="clear-input-btn"
            className="absolute right-5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-[#F5F5F5] border border-[#BBD5DA] text-[#2D4059]/60 hover:text-[#FF0000] hover:bg-white flex items-center justify-center text-sm transition-all duration-150"
            onClick={handleClear}
            aria-label="Clear expression"
          >
            <svg xmlns="http://www.w3.org/2000/svg" height="20px" viewBox="0 -960 960 960" width="20px" fill="#2d4059"><path d="m256-200-56-56 224-224-224-224 56-56 224 224 224-224 56 56-224 224 224 224-56 56-224-224-224 224Z" /></svg>
          </button>
        )}
      </div>

      {error && (
        <div
          id="expression-error"
          className="mt-3 px-4 py-3 rounded-xl bg-[#EA5455]/10 border border-[#FF0000]/25 text-[#FF0000] text-sm flex items-start gap-2.5 animate-slide-down"
          role="alert"
          aria-live="polite"
        >
          <span className="mt-0.5 shrink-0" aria-hidden="true">⚠</span>
          <span>{error}</span>
        </div>
      )}
    </div>
  )
}
