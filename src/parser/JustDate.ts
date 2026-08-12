import { DateTime, WeekdayNumbers } from "luxon";

export enum JustDateType {
    DAY = "day",
    WEEK = "week",
    MONTH_DAY = "month_day",
    MONTH = "month",
    QUARTER = "quarter",
    YEAR = "year",
    SPAN = "span"
}

export interface IndexRange {
    unit: JustDateType;
    parentUnit: JustDateType;
    from: number;
    to: number;
    toLeast?: number;
}

export const implicitParentMap: Partial<Record<JustDateType, JustDateType[]>> = {
    [JustDateType.DAY]: [JustDateType.YEAR, JustDateType.WEEK],
    [JustDateType.MONTH_DAY]: [JustDateType.YEAR, JustDateType.MONTH],
    [JustDateType.WEEK]: [JustDateType.YEAR],
    [JustDateType.MONTH]: [JustDateType.YEAR],
}

export const isIndexInRange = (index: number, range: IndexRange): boolean => {
    return index >= range.from && index <= range.to;
};
const WEEKDAYCOUNT = 7;

export const indexRanges: IndexRange[] = [
    { unit: JustDateType.DAY, parentUnit: JustDateType.WEEK, from: 1, to: WEEKDAYCOUNT },
    { unit: JustDateType.DAY, parentUnit: JustDateType.MONTH, from: 1, to: WEEKDAYCOUNT * 5, toLeast: WEEKDAYCOUNT * 4 },
    { unit: JustDateType.DAY, parentUnit: JustDateType.QUARTER, from: 1, to: WEEKDAYCOUNT * 14, toLeast: WEEKDAYCOUNT * 13 },
    { unit: JustDateType.DAY, parentUnit: JustDateType.YEAR, from: 1, to: WEEKDAYCOUNT * 52 + 1, toLeast: WEEKDAYCOUNT * 52 },
    { unit: JustDateType.MONTH_DAY, parentUnit: JustDateType.MONTH, from: 1, to: 31, toLeast: 28 },
    { unit: JustDateType.MONTH_DAY, parentUnit: JustDateType.QUARTER, from: 1, to: 92, toLeast: 90 },
    { unit: JustDateType.MONTH_DAY, parentUnit: JustDateType.YEAR, from: 1, to: 366, toLeast: 365 },
    { unit: JustDateType.WEEK, parentUnit: JustDateType.MONTH, from: 1, to: 5, toLeast: 4 },
    { unit: JustDateType.WEEK, parentUnit: JustDateType.QUARTER, from: 1, to: 14, toLeast: 13 },
    { unit: JustDateType.WEEK, parentUnit: JustDateType.YEAR, from: 1, to: 53, toLeast: 52 },
    { unit: JustDateType.MONTH, parentUnit: JustDateType.YEAR, from: 1, to: 12 },
    { unit: JustDateType.MONTH, parentUnit: JustDateType.QUARTER, from: 1, to: 3 },
    { unit: JustDateType.QUARTER, parentUnit: JustDateType.YEAR, from: 1, to: 4 },
];

export const getIndexesForTypeAndParent = (
    type: JustDateType,
    parentType: JustDateType,
    least: boolean = false,
): number[] => {
    const range = indexRanges.find(
        (item) => item.unit === type && item.parentUnit === parentType,
    );

    if (!range) {
        throw new Error(`No index range found for ${type} in ${parentType}`);
    }

    return Array.from(
        { length: (least ? (range.toLeast ?? range.to) : range.to) - range.from + 1 },
        (_, index) => range.from + index,
    );
};

export const getIndexesForTypeAndExactParent = (
    type: JustDateType,
    parent: JustDate,
): number[] => {
    const indexesFromLength = (length: number): number[] =>
        Array.from({ length }, (_, index) => index + 1);
    const ensureLength = (length: number | undefined, context: string): number => {
        if (length === undefined) {
            throw new Error(`Cannot calculate exact index range for ${context}`);
        }
        return length;
    };

    switch (type) {
        case JustDateType.QUARTER:
            if (parent.type === JustDateType.YEAR) {
                return getIndexesForTypeAndParent(type, parent.type);
            }
            break;

        case JustDateType.MONTH:
            if (parent.type === JustDateType.YEAR || parent.type === JustDateType.QUARTER) {
                return getIndexesForTypeAndParent(type, parent.type);
            }
            break;

        case JustDateType.WEEK: {
            if (
                parent.type === JustDateType.YEAR ||
                parent.type === JustDateType.QUARTER ||
                parent.type === JustDateType.MONTH
            ) {
                const length = Math.floor(parent.lastDay.diff(parent.firstDay) / 7) + 1;
                return indexesFromLength(length);
            }
            break;
        }

        case JustDateType.DAY:
            if (parent.type === JustDateType.WEEK) {
                return getIndexesForTypeAndParent(type, parent.type);
            }
            if (
                parent.type === JustDateType.YEAR ||
                parent.type === JustDateType.QUARTER ||
                parent.type === JustDateType.MONTH
            ) {
                return indexesFromLength(parent.lastDay.diff(parent.firstDay) + 1);
            }
            break;

        case JustDateType.MONTH_DAY: {
            if (parent.type === JustDateType.YEAR) {
                const year = parent.castToYear().year;
                return indexesFromLength(ensureLength(DateTime.utc(year, 1, 1).daysInYear, `${type} in ${parent.type}`));
            }

            if (parent.type === JustDateType.QUARTER) {
                const quarter = parent.castToQuarter();
                const startMonth = (quarter.quarter - 1) * 3 + 1;
                const start = DateTime.utc(quarter.year, startMonth, 1);
                const end = start.plus({ months: 3 }).minus({ days: 1 });
                return indexesFromLength(Math.floor(end.diff(start, "days").days) + 1);
            }

            if (parent.type === JustDateType.MONTH) {
                const month = parent.castToMonth();
                return indexesFromLength(ensureLength(DateTime.utc(month.year, month.month, 1).daysInMonth, `${type} in ${parent.type}`));
            }
            break;
        }

        default:
            break;
    }

    throw new Error(`No exact index range found for ${type} in ${parent.type}`);
};


export const getJustDateSizeOrder = (type: JustDateType): number => {
    switch (type) {

        case JustDateType.DAY:
        case JustDateType.MONTH_DAY:
            return 1;
        case JustDateType.WEEK:
            return 2;
        case JustDateType.MONTH:
            return 3;
        case JustDateType.QUARTER:
            return 4;
        case JustDateType.YEAR:
            return 5;
        case JustDateType.SPAN:
            return 6;
        default:
            throw new Error(`Unknown JustDateType: ${type}`);
    }
};


export interface DateUnit {
    readonly type: JustDateType;
    readonly value: number;
}
export interface DateUnitRelative {
    readonly type: JustDateType;
    readonly value: number | 'current'
    readonly diff?: number | undefined
}

export class CycleUnit {
    readonly type: JustDateType;
    readonly indexes: number[];
    readonly step: number | null;

    constructor(type: JustDateType, indexes?: number[], step?: number | null) {
        this.type = type;
        this.indexes = indexes ?? [];
        this.step = step ?? null;
    }
    matchDateUnit(dateUnit: DateUnit): boolean {
        const typeMatch = this.type === dateUnit.type
        const indexMatch = this.indexes.length === 0 || this.indexes.includes(dateUnit.value);
        const stepBase = this.indexes.length > 0 ? Math.min(...this.indexes) : 1;
        const stepMatch = this.step == null || (dateUnit.value - stepBase) % this.step === 0;
        return typeMatch && indexMatch && stepMatch;
    }

    equals(other: CycleUnit): boolean {
        if (this.type !== other.type) return false;
        if (this.step !== other.step) return false;
        if (this.indexes.length !== other.indexes.length) return false;
        const currentSet = new Set(this.indexes);
        for (const idx of other.indexes) {
            if (!currentSet.has(idx)) return false;
        }
        return true;
    }
    isEvery(parentType?: JustDateType): boolean {
        if (this.step != null) return false;
        if (this.indexes.length === 0) return true;
        if (!parentType) return false;

        const itemSet = new Set(this.indexes);
        const indexes: number[] = getIndexesForTypeAndParent(this.type, parentType);
        if (itemSet.size !== indexes.length) return false;

        for (const index of indexes) {
            if (!itemSet.has(index)) return false;
        }

        return true;
    }
}



export type DatePattern = JustDateType[];
export class JustDateHierarchical {
    units: DateUnit[];

    type: JustDateType;

    constructor(units: DateUnit[]) {
        if (units.length === 0) {
            throw new Error("Units cannot be empty");
        }
        this.units = this.validateAndSortUnits(units);
        this.type = this.units[this.units.length - 1].type;
    }
    validateAndSortUnits(units: DateUnit[]): DateUnit[] {
        // not duplicate type allowed
        // month day cannot be used with week
        // if infinity is present, it must be the only unit
        // year unit is must
        const seenTypes = new Set<JustDateType>();
        const orderedUnits = [...units].sort((a, b) => getJustDateSizeOrder(b.type) - getJustDateSizeOrder(a.type));
        if (orderedUnits[0].type !== JustDateType.YEAR) {
            throw new Error("First unit must be YEAR");
        }
        for (let i = 0; i < orderedUnits.length; i++) {
            const unit = orderedUnits[i];
            if (seenTypes.has(unit.type)) {
                throw new Error(`Duplicate type not allowed: ${unit.type}`);
            }
            if (unit.type === JustDateType.MONTH_DAY && seenTypes.has(JustDateType.WEEK)) {
                throw new Error("month day cannot be used with week");
            }

            seenTypes.add(unit.type);
        }
        return orderedUnits;
    }

    toJustDate(): JustDate {
        const unitMap = new Map<JustDateType, DateUnit>();
        this.units.forEach((u) => unitMap.set(u.type, u));
        const getUnit = (type: JustDateType): DateUnit | undefined =>
            unitMap.get(type);

        const year = getUnit(JustDateType.YEAR)?.value;
        if (!year) { throw new Error("YEAR unit is required"); }

        const quarter = getUnit(JustDateType.QUARTER)?.value;
        const month = getUnit(JustDateType.MONTH)?.value;
        const week = getUnit(JustDateType.WEEK)?.value;
        const monthDay = getUnit(JustDateType.MONTH_DAY)?.value;
        const day = getUnit(JustDateType.DAY)?.value;

        // Units are sorted from largest to smallest, find parent for each type
        const findParent = (type: JustDateType): JustDateType | undefined => {
            const idx = this.units.findIndex(u => u.type === type);
            if (idx <= 0) return undefined;
            return this.units[idx - 1].type;
        };

        // Helper: compute absolute month from potentially relative month
        const getAbsoluteMonth = (): number => {
            if (month === undefined) return 1;
            const monthParent = findParent(JustDateType.MONTH);
            if (monthParent === JustDateType.QUARTER && quarter !== undefined) {
                // month is 1-3 relative to quarter
                return (quarter - 1) * 3 + month;
            }
            return month; // absolute month
        };

        // Helper: compute absolute week from potentially relative week
        const getAbsoluteWeek = (): number => {
            if (week === undefined) return 1;
            const weekParent = findParent(JustDateType.WEEK);
            if (weekParent === JustDateType.MONTH) {
                const absoluteMonth = getAbsoluteMonth();
                const monthStart = new JustMonth(year, absoluteMonth);
                return monthStart.firstDay.week + week - 1;
            } else if (weekParent === JustDateType.QUARTER && quarter !== undefined) {
                const quarterStart = new JustQuarter(year, quarter);
                return quarterStart.firstDay.week + week - 1;
            }
            return week; // absolute week (parent is YEAR)
        };

        // Case: Just YEAR
        if (this.units.length === 1) {
            return new JustYear(year);
        }

        // Handle MONTH_DAY (day of month or day within quarter/year)
        if (monthDay !== undefined) {
            const parent = findParent(JustDateType.MONTH_DAY);

            if (parent === JustDateType.MONTH) {
                const absoluteMonth = getAbsoluteMonth();
                return new JustMonthDay(year, absoluteMonth, monthDay);
            } else if (parent === JustDateType.QUARTER && quarter !== undefined) {
                // monthDay is day index within quarter
                const quarterStartMonth = (quarter - 1) * 3 + 1;
                const dt = DateTime.utc(year, quarterStartMonth, 1).plus({ days: monthDay - 1 });
                return new JustMonthDay(dt.year, dt.month, dt.day);
            } else if (parent === JustDateType.YEAR) {
                // monthDay is day index within year
                const dt = DateTime.utc(year, 1, 1).plus({ days: monthDay - 1 });
                return new JustMonthDay(dt.year, dt.month, dt.day);
            }
        }

        // Handle DAY (day of week or day index within parent)
        if (day !== undefined) {
            const parent = findParent(JustDateType.DAY);

            if (parent === JustDateType.WEEK) {
                const absoluteWeek = getAbsoluteWeek();
                return new JustDay(year, absoluteWeek, day);
            } else if (parent === JustDateType.MONTH) {
                const absoluteMonth = getAbsoluteMonth();
                const monthStart = new JustMonth(year, absoluteMonth).firstDay;
                return monthStart.addDays(day - 1).castToDay();
            } else if (parent === JustDateType.QUARTER && quarter !== undefined) {
                const quarterStart = new JustQuarter(year, quarter).firstDay;
                return quarterStart.addDays(day - 1).castToDay();
            } else if (parent === JustDateType.YEAR) {
                const yearStart = new JustYear(year).firstDay;
                return yearStart.addDays(day - 1).castToDay();
            }
        }

        // Handle WEEK
        if (week !== undefined) {
            const absoluteWeek = getAbsoluteWeek();
            return new JustWeek(year, absoluteWeek);
        }

        // Handle MONTH
        if (month !== undefined) {
            const absoluteMonth = getAbsoluteMonth();
            return new JustMonth(year, absoluteMonth);
        }

        // Handle QUARTER
        if (quarter !== undefined) {
            return new JustQuarter(year, quarter);
        }

        return new JustYear(year);
    }
}


export class JustDatePattern {

    pattern: DatePattern;
    constructor(pattern: DatePattern) {
        if (pattern.length === 0) {
            throw new Error("Pattern cannot be empty");
        }
        if (pattern[0] !== JustDateType.YEAR) {
            throw new Error("Pattern must start with YEAR");
        }
        for (let i = 1; i < pattern.length; i++) {
            const current = pattern[i];
            const prev = pattern[i - 1];
            if (getJustDateSizeOrder(current) >= getJustDateSizeOrder(prev)) {
                throw new Error("Pattern must be in descending order of size");
            }
        }
        this.pattern = pattern;
    }


    projectDateToPattern(
        input: JustDate,
    ): JustDateHierarchical {
        if (!this.pattern.length || this.pattern[0] !== JustDateType.YEAR) {
            throw new Error("Pattern must start with YEAR");
        }

        // if input contains month_day do different calculation
        const isMonthDayPattern = this.pattern.includes(JustDateType.MONTH_DAY);
        const patternUnits: DateUnit[] = []

        if (isMonthDayPattern) {
            const monthDay = input.castToMonthDay();
            patternUnits.push({
                type: JustDateType.YEAR,
                value: monthDay.realYear,
            });

            for (let i = 1; i < this.pattern.length; i++) {
                const unit = this.pattern[i];
                const parent = this.pattern[i - 1];
                switch (unit) {
                    case JustDateType.QUARTER: {
                        const quarter = Math.floor((monthDay.realMonth - 1) / 3) + 1;
                        patternUnits.push({
                            type: JustDateType.QUARTER,
                            value: quarter,
                        });
                        break;
                    }
                    case JustDateType.MONTH: {
                        if (parent === JustDateType.QUARTER) {
                            const quarterStartMonth = Math.floor((monthDay.realMonth - 1) / 3) * 3 + 1;
                            patternUnits.push({
                                type: JustDateType.MONTH,
                                value: monthDay.realMonth - quarterStartMonth + 1,
                            });

                        }
                        else if (parent === JustDateType.YEAR) {
                            patternUnits.push({
                                type: JustDateType.MONTH,
                                value: monthDay.realMonth,
                            });
                        }
                        else {
                            throw new Error(`Invalid parent for MONTH: ${parent}`);
                        }
                        break;
                    }
                    case JustDateType.MONTH_DAY: {
                        if (parent === JustDateType.QUARTER) {
                            const quarterStartMonth = Math.floor((monthDay.realMonth - 1) / 3) * 3 + 1;
                            const quarterStart = DateTime.utc(monthDay.realYear, quarterStartMonth, 1);
                            const inputDate = DateTime.utc(monthDay.realYear, monthDay.realMonth, monthDay.dayOfMonth);
                            patternUnits.push({
                                type: JustDateType.MONTH_DAY,
                                value: inputDate.diff(quarterStart, "days").days + 1,
                            });

                        } else if (parent === JustDateType.YEAR) {
                            const yearStart = DateTime.utc(monthDay.realYear, 1, 1);
                            const inputDate = DateTime.utc(monthDay.realYear, monthDay.realMonth, monthDay.dayOfMonth);
                            patternUnits.push({
                                type: JustDateType.MONTH_DAY,
                                value: inputDate.diff(yearStart, "days").days + 1,
                            });
                        }
                        else if (parent === JustDateType.MONTH) {
                            patternUnits.push({
                                type: JustDateType.MONTH_DAY,
                                value: monthDay.dayOfMonth,
                            });
                        }
                        break;
                    }
                }
            }
        }
        else {

            patternUnits.push({
                type: JustDateType.YEAR,
                value: input.castToYear().year,
            })

            for (let i = 1; i < this.pattern.length; i++) {
                const unit = this.pattern[i];
                const parent = this.pattern[i - 1];

                switch (unit) {
                    // --------------------
                    // QUARTER
                    // --------------------
                    case JustDateType.QUARTER: {
                        const quarter = input.castToQuarter().quarter;
                        patternUnits.push({
                            type: JustDateType.QUARTER,
                            value: quarter,
                        });
                        break;
                    }

                    // --------------------
                    // MONTH
                    // --------------------
                    case JustDateType.MONTH: {
                        if (parent === JustDateType.QUARTER) {
                            const quarterStartMonth = input.castToQuarter().firstDay.castToMonth().month;
                            const inputMonth = input.castToMonth().month;
                            patternUnits.push({
                                type: JustDateType.MONTH,
                                value: inputMonth - quarterStartMonth + 1,
                            });
                        } else {

                            patternUnits.push({
                                type: JustDateType.MONTH,
                                value: input.castToMonth().month,
                            });
                        }
                        break;
                    }

                    // --------------------
                    // WEEK
                    // --------------------
                    case JustDateType.WEEK: {
                        if (parent === JustDateType.YEAR) {
                            const week = input.castToWeek().week;
                            patternUnits.push({
                                type: JustDateType.WEEK,
                                value: week,
                            });
                        } else if (parent === JustDateType.MONTH) {
                            const monthStartWeek = input.castToMonth().firstDay.castToWeek().week;
                            const inputWeek = input.castToWeek().week
                            patternUnits.push({
                                type: JustDateType.WEEK,
                                value: inputWeek - monthStartWeek + 1,
                            });
                        } else if (parent === JustDateType.QUARTER) {
                            const quarterStartWeek = input.castToQuarter().firstDay.castToWeek().week;
                            const inputWeek = input.castToWeek().week
                            patternUnits.push({
                                type: JustDateType.WEEK,
                                value: inputWeek - quarterStartWeek + 1,
                            });
                        } else {
                            throw new Error(`Invalid parent for WEEK: ${parent}`);
                        }
                        break;
                    }

                    // --------------------
                    // DAY OF MONTH
                    // --------------------
                    case JustDateType.MONTH_DAY: {
                        if (parent === JustDateType.WEEK) {
                            throw new Error("dayOfMonth cannot be used with week");
                        }
                        if (parent === JustDateType.MONTH) {
                            const dayOfMonth = input.castToMonthDay().dayOfMonth;
                            patternUnits.push({
                                type: JustDateType.MONTH_DAY,
                                value: dayOfMonth,
                            });
                        } else if (parent === JustDateType.QUARTER) {
                            const quarterStart = input.castToQuarter().castToMonth().firstMonthDay().firstDay;
                            const inputMonthDay = input.firstDay;
                            patternUnits.push({
                                type: JustDateType.MONTH_DAY,
                                value: quarterStart.diff(inputMonthDay) + 1,
                            });

                        } else if (parent === JustDateType.YEAR) {
                            const yearStart = input.castToYear().castToMonth().firstMonthDay().firstDay;
                            const inputMonthDay = input.firstDay;
                            patternUnits.push({
                                type: JustDateType.MONTH_DAY,
                                value: yearStart.diff(inputMonthDay) + 1,
                            });
                        } else {
                            throw new Error(`Invalid parent for DAY_OF_MONTH: ${parent}`);
                        }

                        break;
                    }

                    // --------------------
                    // DAY (index inside parent)
                    // --------------------
                    case JustDateType.DAY: {
                        if (parent === JustDateType.WEEK) {
                            const day = input.castToDay().day;
                            patternUnits.push({
                                type: JustDateType.DAY,
                                value: day,
                            });
                        } else if (parent === JustDateType.MONTH) {
                            const monthStart = input.castToMonth().firstDay;
                            const inputDay = input.firstDay;
                            patternUnits.push({
                                type: JustDateType.DAY,
                                value: inputDay.diff(monthStart) + 1,
                            });
                        } else if (parent === JustDateType.QUARTER) {
                            const quarterStart = input.castToQuarter().firstDay;
                            const inputDay = input.firstDay;
                            patternUnits.push({
                                type: JustDateType.DAY,
                                value: inputDay.diff(quarterStart) + 1,
                            });
                        } else if (parent === JustDateType.YEAR) {
                            const yearStart = input.castToYear().firstDay;
                            const inputDay = input.firstDay;
                            patternUnits.push({
                                type: JustDateType.DAY,
                                value: inputDay.diff(yearStart) + 1,
                            });
                        } else {
                            throw new Error(`Invalid parent for DAY: ${parent}`);
                        }

                        break;
                    }
                    default:
                        throw new Error(`Unsupported unit: ${unit}`);
                }
            }
        }
        return new JustDateHierarchical(patternUnits);
    }

}



export abstract class JustDate {
    readonly type: JustDateType;
    private _firstDay?: JustDay;
    private _lastDay?: JustDay;


    protected constructor(type: JustDateType) {
        this.type = type;
    }

    protected abstract calculateFirstDay(): JustDay;
    protected abstract calculateLastDay(): JustDay;


    get firstDay(): JustDay {
        if (!this._firstDay) {
            this._firstDay = this.calculateFirstDay();
        }
        return this._firstDay;
    }
    get lastDay(): JustDay {
        if (!this._lastDay) {
            this._lastDay = this.calculateLastDay();
        }
        return this._lastDay;
    }

    contains(date: JustDate): boolean {
        const end = this.lastDay;
        const otherEnd = date.lastDay;
        if (!end || !otherEnd) return false;
        return this.firstDay.valueOf() <= date.firstDay.valueOf() && otherEnd.valueOf() <= end.valueOf();
    }

    intersects(date: JustDate): boolean {
        return this.firstDay.valueOf() <= date.lastDay.valueOf() && date.firstDay.valueOf() <= this.lastDay.valueOf();
    }

    isCurrent(): boolean {
        return this.contains(JustDate.fromDate(new Date()).castTo(this.type));
    }
    isPast(): boolean {
        const today = JustDay.now();
        return this.lastDay < today;
    }
    isFuture(): boolean {
        const today = JustDay.now();
        return this.firstDay > today;
    }

    castTo(type: JustDateType): JustDate {
        switch (type) {
            case JustDateType.DAY:
                return JustDay.fromJustDate(this);
            case JustDateType.MONTH_DAY:
                return JustMonthDay.fromJustDate(this);
            case JustDateType.WEEK:
                return JustWeek.fromJustDate(this);
            case JustDateType.MONTH:
                return JustMonth.fromJustDate(this);
            case JustDateType.QUARTER:
                return JustQuarter.fromJustDate(this);
            case JustDateType.YEAR:
                return JustYear.fromJustDate(this);
            case JustDateType.SPAN:
                return new JustSpan(this, this)
            default:
                throw new Error(`Cast not supported for type: ${type}`);
        }
    }


    castToDay(): JustDay {
        return JustDay.fromJustDate(this);
    }

    castToMonthDay(): JustMonthDay {
        return JustMonthDay.fromJustDate(this);
    }

    castToWeek(): JustWeek {
        return JustWeek.fromJustDate(this);
    }

    castToMonth(): JustMonth {
        return JustMonth.fromJustDate(this);
    }

    castToQuarter(): JustQuarter {
        return JustQuarter.fromJustDate(this);
    }

    castToYear(): JustYear {
        return JustYear.fromJustDate(this);
    }

    next(): JustDate {
        return this.add(1);
    }

    previous(): JustDate {
        return this.add(-1);
    }

    add(amount: number): JustDate {
        return this.addDateUnit({ type: this.type, value: amount });
    }

    addDateUnit(JustDate: DateUnit): JustDate {
        const { type, value } = JustDate;

        if (
            this.type != JustDateType.SPAN && (
                getJustDateSizeOrder(type as unknown as JustDateType) <
                getJustDateSizeOrder(this.type as unknown as JustDateType)
            )
        ) {
            return this.firstDay.addDateUnit(JustDate).castTo(this.type);
        }

        switch (type) {
            case JustDateType.DAY:
            case JustDateType.MONTH_DAY:
                return this.addDays(value);
            case JustDateType.WEEK:
                return this.addWeeks(value);
            case JustDateType.MONTH:
                return this.addMonths(value);
            case JustDateType.QUARTER:
                return this.addQuarters(value);
            case JustDateType.YEAR:
                return this.addYears(value);
            default:
                throw new Error(`Add not supported for type: ${type}`);
        }
    }

    static now(type: JustDateType): JustDate {
        return JustDate.fromDate(new Date()).castTo(type);
    }

    static new(type: JustDateType, start: JustDay = JustDay.fromDate(new Date())): JustDate {
        return JustDate.fromDate(start.startTime()).castTo(type);
    }


    addDays(days: number): JustDate {
        if (days === 0) return this;
        return this.addDaysInternal(days);
    }

    addWeeks(weeks: number): JustDate {
        if (weeks === 0) return this;
        return this.addWeeksInternal(weeks);
    }

    addMonths(months: number): JustDate {
        if (months === 0) return this;
        return this.addMonthsInternal(months);
    }
    addQuarters(quarters: number): JustDate {
        if (quarters === 0) return this;
        return this.addQuartersInternal(quarters);
    }
    addYears(years: number): JustDate {
        if (years === 0) return this;
        return this.addYearsInternal(years);
    }

    valueOf(): number {
        return this.firstDay.toInt();
    }

    equals(other: JustDate): boolean {
        return this.type === other.type && this.firstDay.toInt() === other.firstDay.toInt();
    }


    protected abstract addDaysInternal(days: number): JustDate;
    protected abstract addWeeksInternal(weeks: number): JustDate;
    protected abstract addMonthsInternal(months: number): JustDate;
    protected abstract addQuartersInternal(quarters: number): JustDate;
    protected abstract addYearsInternal(years: number): JustDate;

    toJSON(): any {
        return this.toJSONValue();
    }
    toJSONString() {
        return JSON.stringify(this.toJSON())
    }
    toString(): string {
        return `${this.type}_${this.firstDay.toInt()}`;
    }

    protected abstract toJSONValue(): any;
    static fromJSON(json: any): JustDay | JustMonthDay | JustWeek | JustMonth | JustQuarter | JustYear | JustSpan {
        switch (json.type) {
            case JustDateType.DAY:
                return new JustDay(json.year, json.week, json.day);
            case JustDateType.MONTH_DAY:
                return new JustMonthDay(json.year, json.month, json.dayOfMonth);
            case JustDateType.WEEK:
                return new JustWeek(json.year, json.week);
            case JustDateType.MONTH:
                return new JustMonth(json.year, json.month);
            case JustDateType.QUARTER:
                return new JustQuarter(json.year, json.quarter);
            case JustDateType.YEAR:
                return new JustYear(json.year);
            case JustDateType.SPAN:
                return new JustSpan(JustDate.fromJSON(json.from), JustDate.fromJSON(json.to))
            default:
                throw new Error(`Unknown type for fromJSON: ${json.type}`);
        }
    }

    static fromDate(date: Date): JustDay {
        const dt = DateTime.fromJSDate(date);
        return new JustDay(dt.weekYear, dt.weekNumber, dt.weekday);
    }
    static fromLuxon(dt: DateTime): JustDay {
        const utcDt = dt.setZone("utc");
        return new JustDay(utcDt.weekYear, utcDt.weekNumber, utcDt.weekday);
    }
}

export type DaysOfWeek = 1 | 2 | 3 | 4 | 5 | 6 | 7; // Sunday to Saturday
export type DayOfMonth = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20 | 21 | 22 | 23 | 24 | 25 | 26 | 27 | 28 | 29 | 30 | 31 | 32 | 33 | 34 | 35;
export type WeeksOfMonth = 1 | 2 | 3 | 4;
export type MonthsOfYear = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;
export type QuartersOfYear = 1 | 2 | 3 | 4;



export class JustDay extends JustDate {
    readonly year: number;
    readonly week: number;
    readonly day: number;

    constructor(year: number, week: number, day: number) {
        super(JustDateType.DAY);
        this.year = year;
        this.week = week;
        this.day = day;
        this.ensureValid();
    }

    protected override toJSONValue() {
        return {
            type: this.type,
            year: this.year,
            week: this.week,
            day: this.day,
        };
    }

    static override now(): JustDay {
        return JustDay.fromDate(new Date());
    }


    diff(other: JustDay): number {
        const thisDate = this.toLuxon();
        const otherDate = other.toLuxon();
        return Math.floor(thisDate.diff(otherDate, "days").days);
    }
    toInt() {
        return this.day + 100 * this.week + 10000 * this.year
    }
    static fromInt(value: number): JustDay {
        const year = Math.floor(value / 10000);
        const week = Math.floor((value % 10000) / 100);
        const day = value % 100;
        return new JustDay(year, week, day);
    }

    private ensureValid() {
        if (this.week < 1 || this.week > 53) {
            throw new Error(`Invalid ISO week: ${this.week}`);
        }
        if (this.day < 1 || this.day > 7) {
            throw new Error(`Invalid ISO day: ${this.day}`);
        }
        // trt to convert luxon date 
        try {
            this.toLuxon();
        } catch (e) {
            throw new Error(`Invalid date combination: year=${this.year}, week=${this.week}, day=${this.day}`);
        }
    }

    static fromJustDate(date: JustDate): JustDay {
        return new JustDay(date.firstDay.year, date.firstDay.week, date.firstDay.day);
    }

    protected calculateFirstDay(): JustDay {
        return this;
    }
    protected calculateLastDay(): JustDay {
        return this;
    }

    toLuxon(): DateTime {
        return DateTime.fromObject(
            {
                weekYear: this.year,
                weekNumber: this.week,
                weekday: this.day as WeekdayNumbers,
            },
            { zone: "utc" },
        );
    }

    startTime(): Date {
        return this.toLuxon().startOf("day").toJSDate();
    }

    endTime(): Date {
        return this.toLuxon().endOf("day").toJSDate();
    }

    protected addDaysInternal(days: number): JustDay {
        const dt = this.toLuxon().plus({ days });
        return new JustDay(dt.weekYear, dt.weekNumber, dt.weekday);
    }

    protected addWeeksInternal(weeks: number): JustDay {
        return this.addDaysInternal(weeks * 7);
    }

    protected addMonthsInternal(months: number): JustDay {
        const dt = this.toLuxon().plus({ months });
        return new JustDay(dt.weekYear, dt.weekNumber, dt.weekday);
    }
    protected addQuartersInternal(quarters: number): JustDay {
        const dt = this.toLuxon().plus({ quarters });
        return new JustDay(dt.weekYear, dt.weekNumber, dt.weekday);
    }

    protected addYearsInternal(years: number): JustDay {
        const dt = this.toLuxon().plus({ years });
        return new JustDay(dt.weekYear, dt.weekNumber, dt.weekday);
    }

}

export class JustMonthDay extends JustDate {
    readonly realYear: number;
    readonly realMonth: number;
    readonly realQuarter: number;
    readonly dayOfMonth: number;


    constructor(year: number, month: number, dayOfMonth: number) {
        super(JustDateType.MONTH_DAY);
        this.realYear = year;
        this.realMonth = month;
        this.realQuarter = Math.floor((month - 1) / 3) + 1;
        this.dayOfMonth = dayOfMonth;
    }

    protected override toJSONValue() {
        return {
            type: JustDateType.MONTH_DAY,
            year: this.realYear,
            month: this.realMonth,
            dayOfMonth: this.dayOfMonth,
        };
    }


    static fromJustDate(date: JustDate): JustMonthDay {
        const dt = date.firstDay.toLuxon();
        return new JustMonthDay(dt.year, dt.month, dt.day);
    }

    protected calculateFirstDay(): JustDay {
        const dt = DateTime.utc(this.realYear, this.realMonth, this.dayOfMonth);
        return new JustDay(dt.weekYear, dt.weekNumber, dt.weekday);
    }
    protected calculateLastDay(): JustDay {
        return this.firstDay;
    }


    protected addDaysInternal(days: number): JustMonthDay {
        const dt = DateTime.utc(this.realYear, this.realMonth, this.dayOfMonth).plus({
            days,
        });
        return new JustMonthDay(dt.year, dt.month, dt.day);
    }

    protected addWeeksInternal(weeks: number): JustMonthDay {
        return this.addDaysInternal(weeks * 7);
    }

    protected addMonthsInternal(months: number): JustMonthDay {
        const dt = DateTime.utc(this.realYear, this.realMonth, this.dayOfMonth).plus({
            months,
        });
        return new JustMonthDay(dt.year, dt.month, dt.day);
    }

    protected addQuartersInternal(quarters: number): JustMonthDay {
        return this.addMonthsInternal(quarters * 3);
    }

    protected addYearsInternal(years: number): JustMonthDay {
        const dt = DateTime.utc(this.realYear, this.realMonth, this.dayOfMonth).plus({
            years,
        });
        return new JustMonthDay(dt.year, dt.month, dt.day);
    }
}

export class JustWeek extends JustDate {
    readonly year: number;
    readonly week: number;

    constructor(year: number, week: number) {
        super(JustDateType.WEEK);
        this.year = year;
        this.week = week;
    }

    public getDays(): JustDay[] {
        const days: JustDay[] = [];
        for (let i = 1; i <= 7; i++) {
            days.push(new JustDay(this.year, this.week, i));
        }
        return days;
    }

    protected override toJSONValue() {
        return {
            type: JustDateType.WEEK,
            year: this.year,
            week: this.week,
        };
    }

    static override now(): JustWeek {
        return JustDate.now(JustDateType.WEEK).castToWeek();
    }

    static fromJustDate(date: JustDate): JustWeek {
        return new JustWeek(date.firstDay.year, date.firstDay.week);
    }

    static fromWeekAndYear(week: number, year: number): JustWeek {
        return new JustWeek(year, week);
    }

    protected calculateFirstDay(): JustDay {
        return new JustDay(this.year, this.week, 1);
    }
    protected calculateLastDay(): JustDay {
        return new JustDay(this.year, this.week, 7);
    }

    protected addDaysInternal(days: number): JustWeek {
        return this.firstDay.addDays(days).castToWeek();
    }

    protected addWeeksInternal(weeks: number): JustWeek {
        const dt = this.firstDay.toLuxon().plus({ weeks });
        return new JustWeek(dt.weekYear, dt.weekNumber);
    }

    protected addMonthsInternal(months: number): JustWeek {
        return this.firstDay.addMonths(months).castToWeek();
    }
    protected addQuartersInternal(quarters: number): JustWeek {
        return this.firstDay.addMonths(quarters * 3).castToWeek();
    }
    protected addYearsInternal(years: number): JustWeek {
        return this.firstDay.addYears(years).castToWeek();
    }
}

export class JustMonth extends JustDate {
    readonly year: number;
    readonly month: number;

    constructor(year: number, month: number) {
        super(JustDateType.MONTH);
        if (month < 1 || month > 12) {
            throw new Error(`Invalid month: ${month}`);
        }
        this.year = year;
        this.month = month;
    }

    public static override now(): JustMonth {

        return JustDate.now(JustDateType.MONTH).castToMonth();
    }

    protected override toJSONValue() {
        return {
            type: JustDateType.MONTH,
            year: this.year,
            month: this.month,
        };
    }
    getWeeks(): JustWeek[] {
        const weeks: JustWeek[] = [];
        const firstWeekNumber = this.firstDay.week
        const lastWeekNumber = this.lastDay.week
        for (let i = firstWeekNumber; i <= lastWeekNumber; i++) {
            weeks.push(new JustWeek(this.year, i));
        }
        return weeks;
    }
    firstMonthDay(): JustMonthDay {
        return new JustMonthDay(this.year, this.month, 1);
    }



    static fromJustDate(date: JustDate): JustMonth {
        // Get the first day of the week (Monday) to determine the "work month"
        const firstDayOfWeek = new JustDay(date.firstDay.year, date.firstDay.week, 4);
        const dt = firstDayOfWeek.toLuxon();
        return new JustMonth(dt.year, dt.month);
    }

    static fromMonthAndYear(month: number, year: number): JustMonth {
        return new JustMonth(year, month);
    }

    protected calculateFirstDay(): JustDay {
        const firstOfMonth = DateTime.utc(this.year, this.month, 1);
        // A week belongs to the month if its Thursday is in the month
        const thursday = firstOfMonth.set({ weekday: 4 });
        const firstWeekDay = thursday.month === this.month
            ? firstOfMonth.startOf('week')
            : firstOfMonth.plus({ weeks: 1 }).startOf('week');

        return new JustDay(firstWeekDay.weekYear, firstWeekDay.weekNumber, 1);
    }
    protected calculateLastDay(): JustDay {
        const lastOfMonth = DateTime.utc(this.year, this.month, 1).plus({ months: 1 }).minus({ days: 1 });
        // A week belongs to the month if its Thursday is in the month
        const thursday = lastOfMonth.set({ weekday: 4 });
        const lastWeekDay = thursday.month === this.month
            ? lastOfMonth.endOf('week')
            : lastOfMonth.minus({ weeks: 1 }).endOf('week');

        return new JustDay(lastWeekDay.weekYear, lastWeekDay.weekNumber, 7);
    }


    protected addDaysInternal(days: number): JustMonth {
        return this.firstDay.addDays(days).castToMonth();
    }

    protected addWeeksInternal(weeks: number): JustMonth {
        return this.firstDay.addWeeks(weeks).castToMonth();
    }

    protected addMonthsInternal(months: number): JustMonth {
        const totalMonths = this.year * 12 + (this.month - 1) + months;
        const newYear = Math.floor(totalMonths / 12);
        const newMonth = (totalMonths % 12) + 1;
        return new JustMonth(newYear, newMonth);
    }
    protected addQuartersInternal(quarters: number): JustMonth {
        return this.addMonthsInternal(quarters * 3);
    }

    protected addYearsInternal(years: number): JustMonth {
        return new JustMonth(this.year + years, this.month);
    }
}

export class JustQuarter extends JustDate {
    readonly year: number;
    readonly quarter: number;

    constructor(year: number, quarter: number) {
        super(JustDateType.QUARTER);
        if (quarter < 1 || quarter > 4) {
            throw new Error(`Invalid quarter: ${quarter}`);
        }
        this.year = year;
        this.quarter = quarter;
    }

    public getMonths(): JustMonth[] {
        const months: JustMonth[] = [];
        const firstMonthOfQuarter = (this.quarter - 1) * 3 + 1;
        for (let i = 0; i < 3; i++) {
            months.push(new JustMonth(this.year, firstMonthOfQuarter + i));
        }
        return months;
    }

    protected override toJSONValue() {
        return {
            type: JustDateType.QUARTER,
            year: this.year,
            quarter: this.quarter,
        };
    }


    static fromJustDate(date: JustDate): JustQuarter {
        const month = date.castToMonth().month;
        return new JustQuarter(date.firstDay.year, Math.floor((month - 1) / 3) + 1);
    }

    protected calculateFirstDay(): JustDay {
        const firstMonthOfQuarter = (this.quarter - 1) * 3 + 1;
        return new JustMonth(this.year, firstMonthOfQuarter).firstDay;
    }


    protected calculateLastDay(): JustDay {
        const lastMonthOfQuarter = this.quarter * 3;
        return new JustMonth(this.year, lastMonthOfQuarter).lastDay;
    }


    protected addDaysInternal(days: number): JustQuarter {
        return this.firstDay.addDays(days).castToQuarter();
    }

    protected addQuartersInternal(quarters: number): JustQuarter {
        const totalQuarters = (this.year * 4 + (this.quarter - 1)) + quarters;
        const newYear = Math.floor(totalQuarters / 4);
        const newQuarter = (totalQuarters % 4) + 1;
        return new JustQuarter(newYear, newQuarter);
    }

    protected addWeeksInternal(weeks: number): JustQuarter {
        return this.firstDay.addWeeks(weeks).castToQuarter();
    }

    protected addMonthsInternal(months: number): JustQuarter {
        return this.firstDay.addMonths(months).castToQuarter();
    }

    protected addYearsInternal(years: number): JustQuarter {
        return new JustQuarter(this.year + years, this.quarter);
    }
}

export class JustYear extends JustDate {
    readonly year: number;

    constructor(year: number) {
        super(JustDateType.YEAR);
        this.year = year;
    }
    public getQuarters(): JustQuarter[] {
        return [new JustQuarter(this.year, 1), new JustQuarter(this.year, 2), new JustQuarter(this.year, 3), new JustQuarter(this.year, 4)];
    }
    public getMonths(): JustMonth[] {
        const months: JustMonth[] = [];
        for (let i = 1; i <= 12; i++) {
            months.push(new JustMonth(this.year, i));
        }
        return months;
    }
    public static override now(): JustYear {

        return JustDate.now(JustDateType.YEAR).castToYear();
    }

    protected override toJSONValue() {
        return {
            type: JustDateType.YEAR,
            year: this.year,
        };
    }

    static fromJustDate(date: JustDate): JustYear {
        return new JustYear(date.firstDay.year);
    }

    protected calculateFirstDay(): JustDay {
        return new JustDay(this.year, 1, 1);
    }

    protected calculateLastDay(): JustDay {
        return new JustMonth(this.year, 12).lastDay;
    }


    protected addDaysInternal(days: number): JustYear {
        return this.firstDay.addDays(days).castToYear();
    }

    protected addWeeksInternal(weeks: number): JustYear {
        return this.firstDay.addWeeks(weeks).castToYear();
    }
    protected addQuartersInternal(quarters: number): JustYear {
        return this.firstDay.addQuarters(quarters).castToYear();
    }

    protected addMonthsInternal(months: number): JustYear {
        return this.firstDay.addMonths(months).castToYear();
    }

    protected addYearsInternal(years: number): JustYear {
        return new JustYear(this.year + years);
    }
}



export class JustSpan extends JustDate {
    readonly from: JustDate
    readonly to: JustDate



    constructor(from: JustDate, to: JustDate) {

        const fromIsOpen = from.equals(NEGATIVE_INFINITY);
        const toIsOpen = to.equals(INFINITY);

        if (!fromIsOpen && !toIsOpen) {
            if (from.type !== to.type) {
                throw new Error(`JustSpan boundaries must be the same type. Found ${from.type} and ${to.type}`);
            }
            if (from.firstDay.valueOf() > to.lastDay.valueOf()) {
                throw new Error("JustSpan from boundary cannot be after to boundary");
            }
        }
        super(JustDateType.SPAN);
        this.from = from
        this.to = to
    }

    getBoundaryType(): JustDateType {
        if (!this.from.equals(NEGATIVE_INFINITY)) {
            return this.from.type;
        }
        if (!this.to.equals(INFINITY)) {
            return this.to.type;
        }
        return JustDateType.SPAN;
    }

    protected override toJSONValue() {
        return {
            type: JustDateType.SPAN,
            from: this.from.toJSON(),
            to: this.to.toJSON()
        };
    }

    protected calculateFirstDay(): JustDay {
        return this.from.firstDay
    }

    protected calculateLastDay(): JustDay {
        return this.to.lastDay
    }


    protected addDaysInternal(days: number): JustSpan {
        return new JustSpan(this.from, this.to.addDays(days));
    }

    protected addWeeksInternal(weeks: number): JustSpan {
        return new JustSpan(this.from, this.to.addWeeks(weeks));
    }
    protected addQuartersInternal(quarters: number): JustSpan {
        return new JustSpan(this.from, this.to.addQuarters(quarters));
    }

    protected addMonthsInternal(months: number): JustSpan {
        return new JustSpan(this.from, this.to.addMonths(months));
    }

    protected addYearsInternal(years: number): JustSpan {
        return new JustSpan(this.from, this.to.addYears(years));
    }
}

export class JustDateSet implements Iterable<JustDate> {
    private readonly items = new Map<string, JustDate>();
    type: JustDateType;

    constructor(values: JustDate[] = [], allowMixedTypes: boolean = false) {
        let type: JustDateType | null = null;
        if (values.length === 0) throw new Error("JustDateSet cannot be empty");
        for (const value of values) {
            this.add(value);
            if (!type) {
                type = value.type;
            } else if (type !== value.type) {
                if (allowMixedTypes) {
                    if (getJustDateSizeOrder(value.type) > getJustDateSizeOrder(type)) {
                        type = value.type;
                    }
                } else {
                    throw new Error(`All JustDateSet items must be of the same type. Found ${type} and ${value.type}`);
                }
            }
        }
        this.type = type!;
    }

    get size(): number {
        return this.items.size;
    }

    private add(value: JustDate): this {
        this.items.set(JSON.stringify(value.toJSON()), value);
        return this;
    }

    // delete(value: JustDate): boolean {
    //     return this.items.delete(JSON.stringify(value.toJSON()));
    // }

    has(value: JustDate): boolean {
        return this.items.has(JSON.stringify(value.toJSON()));
    }

    // clear(): void {
    //     this.items.clear();
    // }

    values(): IterableIterator<JustDate> {
        return this.items.values();
    }

    toArray(): JustDate[] {
        return Array.from(this.items.values());
    }

    private _firstDay: JustDay | undefined;
    get firstDay(): JustDay {
        if (this._firstDay) return this._firstDay;
        this._firstDay = this.toArray().sort((a, b) => a.firstDay.valueOf() - b.firstDay.valueOf())[0].firstDay;
        return this._firstDay;
    }



    endDate(): JustDate {
        return this.toArray().sort((a, b) => {
            const aEnd = a.lastDay?.valueOf() ?? Number.NEGATIVE_INFINITY;
            const bEnd = b.lastDay?.valueOf() ?? Number.NEGATIVE_INFINITY;
            return bEnd - aEnd;
        })[0];
    }

    private _lastDay: JustDay | undefined;
    get lastDay(): JustDay | InfinityDay {
        if (this._lastDay) return this._lastDay;
        const endDate = this.endDate();
        this._lastDay = endDate.lastDay ?? INFINITY;
        return this._lastDay;
    }

    contains(target: JustDate): boolean {
        return this.toArray().some((item) => item.contains(target));
    }


    equals(other?: JustDateSet): boolean {
        if (!other) return false;
        if (this.size !== other.size) return false;
        return this.toArray().every((item) => other.has(item));
    }

    toJSON(): any {
        return this.toArray().map((item) => item.toJSON());
    }

    static fromJSON(json: any): JustDateSet {
        return new JustDateSet((json ?? []).map((item: any) => JustDate.fromJSON(item)));
    }

    [Symbol.iterator](): IterableIterator<JustDate> {
        return this.values();
    }
}


export class DateEx {
    valueType: "cycle" | "dates";
    _type: JustDateType | null = null;
    get type(): JustDateType {
        return this.value.type;
    }

    value: DateCycle | JustDateSet;

    constructor(value: DateCycle | JustDateSet | JustDate) {
        if (value instanceof DateCycle) {
            this.valueType = "cycle";
            this.value = value;
        } else if (value instanceof JustDateSet) {
            this.valueType = "dates";
            this.value = value;
        } else if (value instanceof JustDate) {
            this.valueType = "dates";
            this.value = new JustDateSet([value]);
        } else {
            throw new Error("Invalid value for DateEx");
        }
    }

    equals(other: DateEx): boolean {
        if (this.valueType !== other.valueType) return false;
        if (this.valueType === "cycle") {
            return (this.value as DateCycle).equals(other.value as DateCycle);
        } else {
            return (this.value as JustDateSet).equals(other.value as JustDateSet);
        }
    }
    toJSON(): any {
        return {
            type: this.valueType,
            value: this.value.toJSON(),
        };
    }
    toJSONString(): string {
        return JSON.stringify(this.toJSON());
    }

    static fromJSON(json: any): DateEx {
        if (json.type === "cycle") {
            return new DateEx(DateCycle.fromJSON(json.value));
        } else if (json.type === "dates") {
            return new DateEx(JustDateSet.fromJSON(json.value));
        } else {
            throw new Error("Invalid JSON for DateEx");
        }
    }

    static today = (): DateEx => new DateEx(JustDate.new(JustDateType.DAY));
    static tomorrow = (): DateEx => new DateEx(JustDate.new(JustDateType.DAY).addDays(1));
    static everyday = (): DateEx => new DateEx(DateCycle.every(JustDateType.DAY));

    static thisWeek = (): DateEx => new DateEx(JustDate.new(JustDateType.WEEK));
    static nextWeek = (): DateEx => new DateEx(JustDate.new(JustDateType.WEEK).addWeeks(1));
    static everyWeek = (): DateEx => new DateEx(DateCycle.every(JustDateType.WEEK));

    static thisMonth = (): DateEx => new DateEx(JustDate.new(JustDateType.MONTH));
    static nextMonth = (): DateEx => new DateEx(JustDate.new(JustDateType.MONTH).addMonths(1));
    static everyMonth = (): DateEx => new DateEx(DateCycle.every(JustDateType.MONTH));

    static thisQuarter = (): DateEx => new DateEx(JustDate.new(JustDateType.QUARTER));
    static nextQuarter = (): DateEx => new DateEx(JustDate.new(JustDateType.QUARTER).addMonths(3));
    static everyQuarter = (): DateEx => new DateEx(DateCycle.every(JustDateType.QUARTER));

    static thisYear = (): DateEx => new DateEx(JustDate.new(JustDateType.YEAR))
    static nextYear = (): DateEx => new DateEx(JustDate.new(JustDateType.YEAR).addYears(1));
    static everyYear = (): DateEx => new DateEx(DateCycle.every(JustDateType.YEAR));

    contains(date: JustDate): boolean {
        return this.value.contains(date)
    }
    isMatch(date: JustDate): boolean {
        return this.value.contains(date)
    }

    get firstDay(): JustDay {
        return this.value.firstDay;
    }

    get lastDay(): JustDay | InfinityDay {
        return this.value.lastDay;
    }
}


class BaseInfinityDay extends JustDay {
    override add(_: number): JustDate {
        return this;
    }
    override addMonths(_: number): JustDate {
        return this;
    }
    override addYears(_: number): JustDate {
        return this;
    }

}

class InfinityDay extends BaseInfinityDay {
    constructor() {
        super(9999, 1, 1);
    }
}
class NegativeInfinityDay extends BaseInfinityDay {
    constructor() {
        super(1, 1, 1);
    }
}

export const NEGATIVE_INFINITY = new NegativeInfinityDay();
export const INFINITY = new InfinityDay();


export class DateCycle {
    cyclePattern: CycleUnit[];
    from: JustDate | NegativeInfinityDay;
    to: JustDate | InfinityDay;
    type: JustDateType;


    constructor(cyclePattern: CycleUnit[], from?: JustDate, to?: JustDate) {

        this.cyclePattern = cyclePattern;
        if (cyclePattern.length === 0) {
            throw new Error("Cycle pattern cannot be empty");
        }
        // must be ordered from largest to smallest unit, and must contain year unit, otherwise we will add an implicit year unit
        for (let i = 1; i < cyclePattern.length; i++) {
            if (getJustDateSizeOrder(cyclePattern[i].type) >= getJustDateSizeOrder(cyclePattern[i - 1].type)) {
                throw new Error("Cycle pattern must be ordered from largest to smallest unit");
            }
        }

        // add implict evey year cycle unit if pattern do not contain year
        if (cyclePattern[0].type !== JustDateType.YEAR) {
            this.cyclePattern.unshift(new CycleUnit(JustDateType.YEAR));
        }

        this.type = cyclePattern[cyclePattern.length - 1].type;
        this.from = from ?? NEGATIVE_INFINITY;
        this.to = to ?? INFINITY;
    }

    private getDatePattern(): JustDatePattern {
        return new JustDatePattern(this.cyclePattern.map((item) => item.type));
    }



    private getNormalizedFrom(rangeFrom: JustDate): JustDate {
        const rangeFromCasted = rangeFrom.castTo(this.type);

        if (this.from == NEGATIVE_INFINITY) {
            return rangeFromCasted;
        }

        if (rangeFromCasted < this.from) {
            return this.from as JustDate;
        }
        return rangeFromCasted;
    }

    private getNormalizedTo(rangeTo: JustDate): JustDate {
        const rangeToCasted = rangeTo.castTo(this.type);
        if (this.to == INFINITY) {
            return rangeToCasted;
        }
        if (rangeToCasted > this.to) {
            return this.to as JustDate;
        }
        return rangeToCasted;
    }

    equals(other: DateCycle): boolean {

        if (this.cyclePattern.length !== other.cyclePattern.length) return false;

        for (let i = 0; i < this.cyclePattern.length; i++) {
            if (!(this.cyclePattern[i].equals(other.cyclePattern[i]))) {
                return false;
            }
        }
        return this.from.equals(other.from) && this.to.equals(other.to);
    }

    contains(date: JustDate): boolean {
        if (this.lastDay < date.firstDay) return false;
        if (this.firstDay > date.lastDay) return false;
        return this.exactMatch(date);
    }

    private exactMatch(date: JustDate): boolean {
        //TODO: check
        const patterned = this.getDatePattern().projectDateToPattern(date);
        return this.cyclePattern.every((cycleUnit) => {
            const matched = patterned.units.find(
                (value) => value.type === (cycleUnit.type as unknown as JustDateType),
            );
            return matched ? cycleUnit.matchDateUnit(matched) : false;
        });
    }

    private containsMatch(date: JustDate): boolean {
        //TODO: check
        const patterned = this.getDatePattern().projectDateToPattern(date);
        return this.cyclePattern.every((cycleUnit) => {
            const matched = patterned.units.find(
                (value) => value.type === (cycleUnit.type as unknown as JustDateType),
            );
            return matched ? cycleUnit.matchDateUnit(matched) : false;
        });
    }

    getDatesInRange(from: JustDate, to: JustDate): JustDate[] {
        const start = this.getNormalizedFrom(from);
        const end = this.getNormalizedTo(to);


        const dates: JustDate[] = [];
        let current = start;
        while (current <= end) {
            if (this.exactMatch(current)) {
                dates.push(current);
            }
            current = current.next();
        }
        return dates;
    }

    intersect(date: JustDate): boolean {
        let current = date.firstDay;
        const end = date.lastDay ?? date.firstDay;

        while (current.valueOf() <= end.valueOf()) {
            if (this.exactMatch(current)) {
                return true;
            }
            current = current.addDays(1).castToDay();
        }

        return false;
    }

    get firstDay(): JustDay {
        if (this.from.equals(NEGATIVE_INFINITY)) {
            return NEGATIVE_INFINITY;
        }
        return this.from.firstDay;
    }

    get lastDay(): JustDay | InfinityDay {
        if (this.to.equals(INFINITY)) {
            return INFINITY;
        }
        return this.to.lastDay;
    }

    toJSON(): any {
        return {
            cyclePatternOrdered: this.cyclePattern.map((unit) => ({
                type: unit.type,
                indexes: unit.indexes,
                ...(unit.step == null ? {} : { step: unit.step }),
            })),
            from: this.from.toJSON(),
            to: this.to.toJSON(),
        };
    }
    static every(type: JustDateType, { from, to }: { from?: JustDate, to?: JustDate } = {}): DateCycle {
        return new DateCycle(
            [new CycleUnit(type)],
            from,
            to
        )
    }

    static dayOfWeek({ days, from, to }: { days?: DaysOfWeek[], from?: JustDate, to?: JustDate } = {}): DateCycle {
        return new DateCycle(
            [
                new CycleUnit(JustDateType.WEEK),
                new CycleUnit(JustDateType.DAY, days)],
            from,
            to
        );
    }

    static dayOfMonth({ days, from, to }: { days?: DayOfMonth[], from?: JustDate, to?: JustDate } = {}): DateCycle {
        return new DateCycle(
            [
                new CycleUnit(JustDateType.MONTH),
                new CycleUnit(JustDateType.MONTH_DAY, days)],
            from,
            to
        );
    }

    static weekOfMonth({ weeks, from, to }: { weeks?: WeeksOfMonth[], from?: JustDate, to?: JustDate } = {}): DateCycle {
        return new DateCycle(
            [
                new CycleUnit(JustDateType.MONTH),
                new CycleUnit(JustDateType.WEEK, weeks)
            ],
            from,
            to
        );
    }

    static monthOfYear({ months, from, to }: { months: MonthsOfYear[], from: JustDate, to: JustDate }): DateCycle {
        return new DateCycle(
            [
                new CycleUnit(JustDateType.YEAR),
                new CycleUnit(JustDateType.MONTH, months)
            ],
            from,
            to
        );
    }



    static fromJSON(json: any): DateCycle {
        return new DateCycle(
            (json.cyclePatternOrdered ?? []).map(
                (unit: any) => new CycleUnit(unit.type, unit.indexes ?? [], unit.step ?? null),
            ),
            JustDate.fromJSON(json.from),
            JustDate.fromJSON(json.to),
        );
    }
}
