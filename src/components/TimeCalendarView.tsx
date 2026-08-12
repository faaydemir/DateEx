import { useEffect, useMemo, useState, type FC, type MouseEvent } from 'react'
import { DateEx, JustDay } from '../parser/JustDate.ts'
import { JustMs, JustTimeSet, JustTimeType, TimeCycle, TimeEx } from '../parser/JustTime.ts'
import { CalendarView } from './CalendarView.tsx'

const DAY_MS = 24 * 60 * 60 * 1000

interface Props {
  year: number
  onYearChange: (year: number) => void
  dateEx: DateEx
  timeEx?: TimeEx
}

interface Segment {
  start: number
  end: number
}

interface TimeLineBarProps {
  timeEx: TimeEx
  hoverMs: number | null
  currentMs: number | null
  onHoverMs: (ms: number | null) => void
}

export const TimeCalendarView: FC<Props> = ({ year, onYearChange, dateEx, timeEx }) => {
  const [hoverMs, setHoverMs] = useState<number | null>(null)
  const [now, setNow] = useState(() => new Date())
  const selectedDay = useMemo(() => dateEx.firstDay, [dateEx])
  const isSelectedDayToday = selectedDay.toInt() === JustDay.now().toInt()
  const timeLabel = timeEx ? describeTimeEx(timeEx) : null

  useEffect(() => {
    if (!isSelectedDayToday) return

    const interval = window.setInterval(() => {
      setNow(new Date())
    }, 50)

    return () => window.clearInterval(interval)
  }, [isSelectedDayToday])

  const currentMs = isSelectedDayToday ? dateToMsOfDay(now) : null

  return (
    <div className="bg-[#eeeeee] border border-[#f07b3f] rounded-2xl p-3 sm:p-4 backdrop-blur-xl w-full">
      {timeEx && (
        <TimeLineBar
          timeEx={timeEx}
          hoverMs={hoverMs}
          currentMs={currentMs}
          onHoverMs={setHoverMs}
        />
      )}
      <CalendarView
        year={year}
        onYearChange={onYearChange}
        dateEx={dateEx}
        selectedDay={selectedDay}
        dayHoverLabel={(day) => (
          timeLabel && day.toInt() === selectedDay.toInt()
            ? timeLabel
            : null
        )}
      />
    </div>
  )
}

const TimeLineBar: FC<TimeLineBarProps> = ({ timeEx, hoverMs, currentMs, onHoverMs }) => {
  const segments = useMemo(() => buildSegments(timeEx), [timeEx])

  const handleMouseMove = (event: MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width))
    onHoverMs(Math.round(ratio * (DAY_MS - 1)))
  }

  return (
    <div className="mb-4">
      <div
        className="relative h-8 w-full overflow-hidden rounded-md border border-[#BBD5DA] bg-[#F5F5F5]"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => onHoverMs(null)}
        aria-label="Selected time within the day"
      >
        <div
          className="pointer-events-none absolute inset-0 z-10 grid"
          style={{ gridTemplateColumns: 'repeat(24, minmax(0, 1fr))' }}
        >
          {Array.from({ length: 24 }, (_, hour) => (
            <div
              key={hour}
              className="flex h-full items-center justify-center border-l border-[#2D4059]/10 first:border-l-0"
            >
              <span className="font-mono text-[10px] font-semibold text-[#2D4059]/30">
                {String(hour).padStart(2, '0')}
              </span>
            </div>
          ))}
        </div>
        {segments.map((segment, index) => (
          <div
            key={`${segment.start}-${segment.end}-${index}`}
            className="absolute top-0 h-full bg-[#BBD5DA]"
            style={{
              left: `${(segment.start / DAY_MS) * 100}%`,
              width: `${Math.max(((segment.end - segment.start + 1) / DAY_MS) * 100, 0.08)}%`,
            }}
          />
        ))}
        {currentMs !== null && (
          <div
            className="absolute top-0 z-20 h-full w-px bg-[#FF0000]"
            style={{ left: `${(currentMs / DAY_MS) * 100}%` }}
          />
        )}
        {hoverMs !== null && (
          <div
            className="pointer-events-none absolute bottom-full z-30 mb-2 -translate-x-1/2 whitespace-nowrap rounded-md border border-[#BBD5DA] bg-white px-2 py-1 font-mono text-[10px] font-semibold text-[#2D4059] shadow-lg"
            style={{ left: `${(hoverMs / DAY_MS) * 100}%` }}
          >
            {formatMs(hoverMs)}
          </div>
        )}
      </div>
    </div>
  )
}

function dateToMsOfDay(date: Date): number {
  return date.getHours() * 60 * 60 * 1000 +
    date.getMinutes() * 60 * 1000 +
    date.getSeconds() * 1000 +
    date.getMilliseconds()
}

function justMsToMsOfDay(value: JustMs): number {
  return value.hour * 60 * 60 * 1000 +
    value.min * 60 * 1000 +
    value.second * 1000 +
    value.ms
}

function formatMs(value: number): string {
  const hour = Math.floor(value / 3_600_000)
  const min = Math.floor((value % 3_600_000) / 60_000)
  const second = Math.floor((value % 60_000) / 1000)
  const ms = value % 1000

  return `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}:${String(second).padStart(2, '0')}:${String(ms).padStart(3, '0')}`
}

function buildSegments(timeEx: TimeEx): Segment[] {
  if (timeEx.value instanceof JustTimeSet) {
    return timeEx.value.toArray().map((time) => ({
      start: justMsToMsOfDay(time.firstMs),
      end: justMsToMsOfDay(time.lastMs),
    }))
  }

  if (timeEx.value instanceof TimeCycle) {
    return buildCycleSegments(timeEx.value)
  }

  return []
}

function buildCycleSegments(cycle: TimeCycle): Segment[] {
  const hourIndexes = indexesForCycleUnit(cycle, JustTimeType.HOUR)
  const minIndexes = indexesForCycleUnit(cycle, JustTimeType.MIN)
  const secondIndexes = indexesForCycleUnit(cycle, JustTimeType.SECOND)
  const msIndexes = indexesForCycleUnit(cycle, JustTimeType.MS)
  const hasMsUnit = cycle.cyclePattern.some((unit) => unit.type === JustTimeType.MS)
  const segments: Segment[] = []

  for (const hour of hourIndexes) {
    for (const min of minIndexes) {
      for (const second of secondIndexes) {
        const secondStart = toMsOfDay(hour, min, second, 0)

        if (!hasMsUnit || msIndexes.length === 1000) {
          segments.push({ start: secondStart, end: secondStart + 999 })
          continue
        }

        for (const ms of msIndexes) {
          segments.push({ start: secondStart + ms, end: secondStart + ms })
        }
      }
    }
  }

  return mergeSegments(segments)
}

function indexesForCycleUnit(cycle: TimeCycle, type: JustTimeType): number[] {
  const unit = cycle.cyclePattern.find((item) => item.type === type)
  if (unit && unit.indexes.length > 0) return unit.indexes

  switch (type) {
    case JustTimeType.HOUR:
      return Array.from({ length: 24 }, (_, index) => index)
    case JustTimeType.MIN:
    case JustTimeType.SECOND:
      return Array.from({ length: 60 }, (_, index) => index)
    case JustTimeType.MS:
      return Array.from({ length: 1000 }, (_, index) => index)
    default:
      return []
  }
}

function mergeSegments(segments: Segment[]): Segment[] {
  if (segments.length === 0) return []

  const sorted = [...segments].sort((a, b) => a.start - b.start || a.end - b.end)
  const merged: Segment[] = [sorted[0]]

  for (const segment of sorted.slice(1)) {
    const last = merged[merged.length - 1]
    if (segment.start <= last.end + 1) {
      last.end = Math.max(last.end, segment.end)
    } else {
      merged.push({ ...segment })
    }
  }

  return merged
}

function toMsOfDay(hour: number, min: number, second: number, ms: number): number {
  return hour * 60 * 60 * 1000 + min * 60 * 1000 + second * 1000 + ms
}

function describeTimeEx(timeEx: TimeEx): string {
  if (timeEx.value instanceof JustTimeSet) {
    return timeEx.value.toArray().map((time) => {
      const first = justMsToMsOfDay(time.firstMs)
      const last = justMsToMsOfDay(time.lastMs)
      return first === last ? formatMs(first) : `${formatMs(first)} - ${formatMs(last)}`
    }).join(', ')
  }

  return 'Recurring time'
}
