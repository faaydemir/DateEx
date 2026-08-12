import React, { type FC } from 'react'
import { DateEx, JustDay, JustMonth, JustQuarter, JustWeek, JustYear } from '../parser/JustDate'

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const QUARTER_NAMES = ['Q1', 'Q2', 'Q3', 'Q4']
const DAY_HEADERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

// --- Interfaces ---

interface DateProps {
    isMatch: boolean
    isContained: boolean
    isSelected?: boolean
    hoverLabel?: string | null
}

interface YearProps extends DateProps {
    value: JustYear
    quarters: QuarterProps[]
}
interface QuarterProps extends DateProps {
    value: JustQuarter
    months: MonthProps[]
}
interface MonthProps extends DateProps {
    value: JustMonth
    weeks: WeekProps[]
}

interface WeekProps extends DateProps {
    value: JustWeek
    days: DayProps[]
}

interface DayProps extends DateProps {
    value: JustDay
}

// --- Prop Builders ---

const buildDayProps = (
    dateEx: DateEx | undefined,
    day: JustDay,
    selectedDay?: JustDay,
    dayHoverLabel?: (day: JustDay) => string | null,
): DayProps => ({
    value: day,
    isMatch: dateEx?.isMatch(day) ?? false,
    isContained: dateEx?.contains(day) ?? false,
    isSelected: selectedDay ? day.toInt() === selectedDay.toInt() : false,
    hoverLabel: dayHoverLabel?.(day) ?? null,
})

const buildWeekProps = (
    dateEx: DateEx | undefined,
    week: JustWeek,
    selectedDay?: JustDay,
    dayHoverLabel?: (day: JustDay) => string | null,
): WeekProps => ({
    value: week,
    isMatch: dateEx?.isMatch(week) ?? false,
    isContained: dateEx?.contains(week) ?? false,
    days: (week as any).getDays().map((d: JustDay) => buildDayProps(dateEx, d, selectedDay, dayHoverLabel)),
})

const buildMonthProps = (
    dateEx: DateEx | undefined,
    month: JustMonth,
    selectedDay?: JustDay,
    dayHoverLabel?: (day: JustDay) => string | null,
): MonthProps => ({
    value: month,
    isMatch: dateEx?.isMatch(month) ?? false,
    isContained: dateEx?.contains(month) ?? false,
    weeks: (month as any).getWeeks().map((w: JustWeek) => buildWeekProps(dateEx, w, selectedDay, dayHoverLabel)),
})

const buildQuarterProps = (
    dateEx: DateEx | undefined,
    quarter: JustQuarter,
    selectedDay?: JustDay,
    dayHoverLabel?: (day: JustDay) => string | null,
): QuarterProps => ({
    value: quarter,
    isMatch: dateEx?.isMatch(quarter) ?? false,
    isContained: dateEx?.contains(quarter) ?? false,
    months: (quarter as any).getMonths().map((m: JustMonth) => buildMonthProps(dateEx, m, selectedDay, dayHoverLabel)),
})

const buildProps = (
    dateEx: DateEx | undefined,
    yearNum: number,
    selectedDay?: JustDay,
    dayHoverLabel?: (day: JustDay) => string | null,
): YearProps => {
    const year = new JustYear(yearNum);
    return {
        value: year,
        isMatch: dateEx?.isMatch(year) ?? false,
        isContained: dateEx?.contains(year) ?? false,
        quarters: (year as any).getQuarters().map((q: JustQuarter) => buildQuarterProps(dateEx, q, selectedDay, dayHoverLabel)),
    };
}

// --- UI Components ---

const baseBox = 'border rounded-md flex items-center justify-center font-["Inter",system-ui,sans-serif] text-xs font-semibold leading-[1.15] transition-colors duration-200 border-0.5 border-[#BBD5DA] text-[#2D4059]'
const containedClass = " bg-[#eeeeee] text-[#2D4059] font-bold"
const matchClass = " bg-[#BBD5DA] border-[#087E8B] text-[#2D4059] font-bold "
const currentClass = " border-[#FF0000] text-[#FF0000]"
const selectedClass = " ring-2 ring-[#F07B3F]/70 border-[#F07B3F]"


const DayCell: FC<DayProps> = ({ value, isMatch, isContained, isSelected, hoverLabel }) => {
    const isCurrent = value.isCurrent()
    const label = value.castToMonthDay().dayOfMonth

    let cls = `${baseBox} group relative w-full h-full min-h-6 aspect-square text-[10px] tabular-nums`
    if (isMatch) {
        cls += matchClass
    } else if (isContained) {
        cls += containedClass
    }
    if (isSelected) {
        cls += selectedClass
    }
    if (isCurrent) {
        cls += currentClass
    }

    return (
        <div className={cls} title={value.castToMonthDay().dayOfMonth.toString()}>
            {label}
            {hoverLabel && (
                <div className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-md border border-[#BBD5DA] bg-white px-2 py-1 font-mono text-[10px] font-semibold text-[#2D4059] shadow-lg group-hover:block">
                    {hoverLabel}
                </div>
            )}
        </div>
    )
}

const WeekCell: FC<WeekProps> = ({ value, days, isMatch, isContained }) => {
    let cls = "grid grid-cols-8 gap-0.5 px-0.5 mb-0.5 items-stretch"
    // cls += baseBox // Removed as it's a grid container, not a single box
    let isCurrent = value.isCurrent()

    // Week indicator style
    let weekIndicatorCls = `${baseBox} w-full h-full min-h-6 aspect-square text-[9px] tracking-[-0.08em] tabular-nums whitespace-nowrap overflow-hidden`
    if (isMatch) weekIndicatorCls += matchClass
    else if (isContained) weekIndicatorCls += containedClass
    else if (isCurrent) weekIndicatorCls += currentClass

    return (
        <div className={cls}>
            {/* Week Box */}
            <div className={weekIndicatorCls} title={`Week ${value.week}`}>
                W{value.week}
            </div>

            {/* Days */}
            {days.map((d, i) => (
                <DayCell key={i} {...d} />
            ))}
        </div>
    )
}

const MonthCell: FC<MonthProps> = ({ value, weeks, isMatch, isContained }) => {
    const isCurrent = value.isCurrent()

    // Month box (vertical label)
    let monthLabelCls = `${baseBox} writing-vertical text-[10px] uppercase tracking-[0.2em] w-6 transition-colors duration-200 `
    if (isMatch) monthLabelCls += matchClass
    else if (isContained) monthLabelCls += containedClass
    else if (isCurrent) monthLabelCls += currentClass

    return (
        <div className="flex flex-row gap-1 w-full mt-1">
            <div
                className={monthLabelCls}
                style={{ writingMode: 'vertical-lr', transform: 'rotate(180deg)' }}
            >
                {MONTH_NAMES[value.month - 1]}
            </div>

            <div className="flex flex-col flex-1 gap-px">
                {/* Day headers */}
                <div className="grid grid-cols-8 gap-px px-0.5 items-stretch">
                    <div className="w-full" /> {/* Spacer for Week column */}
                    {DAY_HEADERS.map((h, i) => (
                        <div key={i} className="text-[8px] sm:text-[9px] font-bold text-[#2D4059]/65 text-center uppercase">{h}</div>
                    ))}
                </div>

                {/* Weeks */}
                {weeks.map((w, i) => (
                    <WeekCell key={i} {...w} />
                ))}
            </div>
        </div>
    )
}

const QuarterCell: FC<QuarterProps> = ({ value, months, isMatch, isContained }) => {
    const isCurrent = value.isCurrent()

    let bannerCls = `w-full rounded-md py-1.5 text-xs font-bold text-center tracking-[0.2em] transition-colors duration-200 ${baseBox} `
    if (isMatch) bannerCls += matchClass
    else if (isContained) bannerCls += containedClass
    else if (isCurrent) bannerCls += currentClass

    return (
        <div className="flex flex-col w-full h-full bg-[#F5F5F5] rounded-xl p-2 border border-[#BBD5DA]">
            <div className={bannerCls}>
                {QUARTER_NAMES[value.quarter - 1]}
            </div>
            <div className="flex flex-col flex-1 gap-1 w-full justify-between mt-1">
                {months.map((m, i) => (
                    <MonthCell key={i} {...m} />
                ))}
            </div>
        </div>
    )
}

const YearCell: FC<YearProps> = ({ value, quarters, isMatch, isContained }) => {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 w-full">
            {quarters.map((q, i) => (
                <QuarterCell key={i} {...q} />
            ))}
        </div>
    )
}

// --- Main CalendarView ---

interface Props {
    year: number
    onYearChange: (y: number) => void
    dateEx?: DateEx
    selectedDay?: JustDay
    dayHoverLabel?: (day: JustDay) => string | null
}

export const CalendarView: FC<Props> = ({ year, onYearChange, dateEx, selectedDay, dayHoverLabel }) => {
    const yearProps = buildProps(dateEx, year, selectedDay, dayHoverLabel)
    const isCurrentYear = yearProps.value.isCurrent()


    let cls = `${baseBox} h-8 min-w-20 px-3 text-lg tabular-nums`
    if (yearProps.isMatch) cls += matchClass
    else if (yearProps.isContained) cls += containedClass
    else if (isCurrentYear) cls += currentClass

    const navButtonCls = `inline-flex h-8 w-8 items-center justify-center font-["Inter",system-ui,sans-serif] text-lg leading-[1.15] hover:bg-[#BBD5DA] hover:border-[#087E8B] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#087E8B]`
    const todayButtonCls = `inline-flex h-8 min-w-20 items-center justify-center px-3 font-["Inter",system-ui,sans-serif] text-xs uppercase font-bold leading-[1.15] tracking-widest hover:bg-[#BBD5DA] hover:border-[#087E8B] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#087E8B]`


    return (
        <div
            className="bg-[#eeeeee] border border-[#f07b3f] rounded-2xl p-3 sm:p-4 backdrop-blur-xl w-full"
            role="region"
            aria-label={`Calendar for ${year}`}
        >
            {/* Header Container & Year Box */}
            <div className="flex flex-col sm:flex-row items-center justify-between mb-3 gap-3 w-full">

                {/* Year Box / Title */}
                <div className={cls}>
                    {year}
                </div>

                {/* Navigation */}
                <div className={`${baseBox} gap-0 bg-[#eeeeee] p-0`} aria-label="Year navigation">
                    <button
                        className={navButtonCls}
                        onClick={() => onYearChange(year - 1)}
                        aria-label="Previous year"
                    >
                        ‹
                    </button>
                    <button
                        className={todayButtonCls}
                        onClick={() => onYearChange(new Date().getFullYear())}
                        aria-label="Current year"
                    >
                        Today
                    </button>
                    <button
                        className={navButtonCls}
                        onClick={() => onYearChange(year + 1)}
                        aria-label="Next year"
                    >
                        ›
                    </button>
                </div>
            </div>

            {/* Nested Grid Layout */}
            <YearCell {...yearProps} />

        </div>
    )
}
