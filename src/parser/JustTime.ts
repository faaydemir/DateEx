import { DateTime } from "luxon";

export enum JustTimeType {
    MS = "ms",
    SECOND = "second",
    MIN = "min",
    HOUR = "hour",
    SPAN = "span",
}

export interface TimeIndexRange {
    unit: JustTimeType;
    parentUnit: JustTimeType;
    from: number;
    to: number;
}

export const timeIndexRanges: TimeIndexRange[] = [
    { unit: JustTimeType.MS, parentUnit: JustTimeType.SECOND, from: 0, to: 999 },
    { unit: JustTimeType.SECOND, parentUnit: JustTimeType.MIN, from: 0, to: 59 },
    { unit: JustTimeType.MIN, parentUnit: JustTimeType.HOUR, from: 0, to: 59 },
];

export const getIndexesForTimeTypeAndParent = (
    type: JustTimeType,
    parentType: JustTimeType,
): number[] => {
    const range = timeIndexRanges.find(
        (item) => item.unit === type && item.parentUnit === parentType,
    );

    if (!range) {
        throw new Error(`No index range found for ${type} in ${parentType}`);
    }

    return Array.from(
        { length: range.to - range.from + 1 },
        (_, index) => range.from + index,
    );
};

export const getIndexesForTimeType = (type: JustTimeType): number[] => {
    switch (type) {
        case JustTimeType.HOUR:
            return Array.from({ length: 24 }, (_, index) => index);
        case JustTimeType.MIN:
        case JustTimeType.SECOND:
            return Array.from({ length: 60 }, (_, index) => index);
        case JustTimeType.MS:
            return Array.from({ length: 1000 }, (_, index) => index);
        default:
            throw new Error(`No index range found for ${type}`);
    }
};

export const getJustTimeSizeOrder = (type: JustTimeType): number => {
    switch (type) {
        case JustTimeType.MS:
            return 1;
        case JustTimeType.SECOND:
            return 2;
        case JustTimeType.MIN:
            return 3;
        case JustTimeType.HOUR:
            return 4;
        default:
            throw new Error(`Unknown JustTimeType: ${type}`);
    }
};

export interface TimeUnit {
    readonly type: JustTimeType;
    readonly value: number;
}

export class TimeCycleUnit {
    readonly type: JustTimeType;
    readonly indexes: number[];
    readonly step: number | null;

    constructor(type: JustTimeType, indexes?: number[], step?: number | null) {
        this.type = type;
        this.indexes = indexes ?? [];
        this.step = step ?? null;
    }

    matchTimeUnit(timeUnit: TimeUnit): boolean {
        const typeMatch = this.type === timeUnit.type;
        const indexMatch = this.indexes.length === 0 || this.indexes.includes(timeUnit.value);
        const stepBase = this.indexes.length > 0 ? Math.min(...this.indexes) : 0;
        const stepMatch = this.step == null || (timeUnit.value - stepBase) % this.step === 0;
        return typeMatch && indexMatch && stepMatch;
    }

    equals(other: TimeCycleUnit): boolean {
        if (this.type !== other.type) return false;
        if (this.step !== other.step) return false;
        if (this.indexes.length !== other.indexes.length) return false;
        const currentSet = new Set(this.indexes);
        for (const idx of other.indexes) {
            if (!currentSet.has(idx)) return false;
        }
        return true;
    }

    isEvery(): boolean {
        if (this.step != null) return false;
        if (this.indexes.length === 0) return true;

        const itemSet = new Set(this.indexes);
        const indexes = getIndexesForTimeType(this.type);
        if (itemSet.size !== indexes.length) return false;

        for (const index of indexes) {
            if (!itemSet.has(index)) return false;
        }

        return true;
    }
}

export type TimePattern = JustTimeType[];

export class JustTimeHierarchical {
    units: TimeUnit[];
    type: JustTimeType;

    constructor(units: TimeUnit[]) {
        if (units.length === 0) {
            throw new Error("Units cannot be empty");
        }
        this.units = this.validateAndSortUnits(units);
        this.type = this.units[this.units.length - 1].type;
    }

    validateAndSortUnits(units: TimeUnit[]): TimeUnit[] {
        const seenTypes = new Set<JustTimeType>();
        const orderedUnits = [...units].sort((a, b) => getJustTimeSizeOrder(b.type) - getJustTimeSizeOrder(a.type));
        if (orderedUnits[0].type !== JustTimeType.HOUR) {
            throw new Error("First unit must be HOUR");
        }
        for (const unit of orderedUnits) {
            if (seenTypes.has(unit.type)) {
                throw new Error(`Duplicate type not allowed: ${unit.type}`);
            }
            seenTypes.add(unit.type);
        }
        return orderedUnits;
    }

    toJustTime(): JustTime {
        const unitMap = new Map<JustTimeType, TimeUnit>();
        this.units.forEach((u) => unitMap.set(u.type, u));

        const hour = unitMap.get(JustTimeType.HOUR)?.value;
        if (hour === undefined) {
            throw new Error("HOUR unit is required");
        }

        const min = unitMap.get(JustTimeType.MIN)?.value;
        const second = unitMap.get(JustTimeType.SECOND)?.value;
        const ms = unitMap.get(JustTimeType.MS)?.value;

        if (ms !== undefined) return new JustMs(hour, min ?? 0, second ?? 0, ms);
        if (second !== undefined) return new JustSecond(hour, min ?? 0, second);
        if (min !== undefined) return new JustMin(hour, min);
        return new JustHour(hour);
    }
}

export class JustTimePattern {
    pattern: TimePattern;

    constructor(pattern: TimePattern) {
        if (pattern.length === 0) {
            throw new Error("Pattern cannot be empty");
        }
        if (pattern[0] !== JustTimeType.HOUR) {
            throw new Error("Pattern must start with HOUR");
        }
        for (let i = 1; i < pattern.length; i++) {
            const current = pattern[i];
            const prev = pattern[i - 1];
            if (getJustTimeSizeOrder(current) >= getJustTimeSizeOrder(prev)) {
                throw new Error("Pattern must be in descending order of size");
            }
        }
        this.pattern = pattern;
    }

    projectTimeToPattern(input: JustTime): JustTimeHierarchical {
        const ms = input.firstMs;
        const patternUnits: TimeUnit[] = [];

        patternUnits.push({
            type: JustTimeType.HOUR,
            value: ms.hour,
        });

        for (let i = 1; i < this.pattern.length; i++) {
            const unit = this.pattern[i];
            switch (unit) {
                case JustTimeType.MIN:
                    patternUnits.push({ type: JustTimeType.MIN, value: ms.min });
                    break;
                case JustTimeType.SECOND:
                    patternUnits.push({ type: JustTimeType.SECOND, value: ms.second });
                    break;
                case JustTimeType.MS:
                    patternUnits.push({ type: JustTimeType.MS, value: ms.ms });
                    break;
                default:
                    throw new Error(`Unsupported unit: ${unit}`);
            }
        }

        return new JustTimeHierarchical(patternUnits);
    }
}

export abstract class JustTime {
    readonly type: JustTimeType;
    private _firstMs?: JustMs;
    private _lastMs?: JustMs;

    protected constructor(type: JustTimeType) {
        this.type = type;
    }

    protected abstract calculateFirstMs(): JustMs;
    protected abstract calculateLastMs(): JustMs;

    get firstMs(): JustMs {
        if (!this._firstMs) {
            this._firstMs = this.calculateFirstMs();
        }
        return this._firstMs;
    }

    get lastMs(): JustMs {
        if (!this._lastMs) {
            this._lastMs = this.calculateLastMs();
        }
        return this._lastMs;
    }

    contains(time: JustTime): boolean {
        return this.firstMs.valueOf() <= time.firstMs.valueOf() && time.lastMs.valueOf() <= this.lastMs.valueOf();
    }

    intersects(time: JustTime): boolean {
        return this.firstMs.valueOf() <= time.lastMs.valueOf() && time.firstMs.valueOf() <= this.lastMs.valueOf();
    }

    isCurrent(): boolean {
        return this.contains(JustTime.fromDate(new Date()).castTo(this.type));
    }

    castTo(type: JustTimeType): JustTime {
        switch (type) {
            case JustTimeType.MS:
                return JustMs.fromJustTime(this);
            case JustTimeType.SECOND:
                return JustSecond.fromJustTime(this);
            case JustTimeType.MIN:
                return JustMin.fromJustTime(this);
            case JustTimeType.HOUR:
                return JustHour.fromJustTime(this);
            default:
                throw new Error(`Cast not supported for type: ${type}`);
        }
    }

    castToMs(): JustMs {
        return JustMs.fromJustTime(this);
    }

    castToSecond(): JustSecond {
        return JustSecond.fromJustTime(this);
    }

    castToMin(): JustMin {
        return JustMin.fromJustTime(this);
    }

    castToHour(): JustHour {
        return JustHour.fromJustTime(this);
    }

    next(): JustTime {
        return this.add(1);
    }

    previous(): JustTime {
        return this.add(-1);
    }

    add(amount: number): JustTime {
        return this.addTimeUnit({ type: this.type, value: amount });
    }

    addTimeUnit(justTime: TimeUnit): JustTime {
        const { type, value } = justTime;

        if (getJustTimeSizeOrder(type) < getJustTimeSizeOrder(this.type)) {
            return this.firstMs.addTimeUnit(justTime).castTo(this.type);
        }

        switch (type) {
            case JustTimeType.MS:
                return this.addMs(value);
            case JustTimeType.SECOND:
                return this.addSeconds(value);
            case JustTimeType.MIN:
                return this.addMin(value);
            case JustTimeType.HOUR:
                return this.addHour(value);
            default:
                throw new Error(`Add not supported for type: ${type}`);
        }
    }

    static now(type: JustTimeType): JustTime {
        return JustTime.fromDate(new Date()).castTo(type);
    }

    static new(type: JustTimeType, start: JustMs = JustMs.fromDate(new Date())): JustTime {
        return JustTime.fromDate(start.startTime()).castTo(type);
    }

    addMs(ms: number): JustTime {
        if (ms === 0) return this;
        return this.addMsInternal(ms);
    }

    addSeconds(seconds: number): JustTime {
        if (seconds === 0) return this;
        return this.addSecondsInternal(seconds);
    }

    addMin(min: number): JustTime {
        if (min === 0) return this;
        return this.addMinInternal(min);
    }

    addHour(hour: number): JustTime {
        if (hour === 0) return this;
        return this.addHourInternal(hour);
    }

    valueOf(): number {
        return this.firstMs.toInt();
    }

    equals(other: JustTime): boolean {
        return this.type === other.type && this.firstMs.toInt() === other.firstMs.toInt();
    }

    protected abstract addMsInternal(ms: number): JustTime;
    protected abstract addSecondsInternal(seconds: number): JustTime;
    protected abstract addMinInternal(min: number): JustTime;
    protected abstract addHourInternal(hour: number): JustTime;

    toJSON(): any {
        return this.toJSONValue();
    }

    toJSONString() {
        return JSON.stringify(this.toJSON());
    }

    toString(): string {
        return `${this.type}_${this.firstMs.toInt()}`;
    }

    protected abstract toJSONValue(): any;

    static fromJSON(json: any): JustMs | JustSecond | JustMin | JustHour | JustTimeSpan {
        switch (json.type) {
            case JustTimeType.MS:
                return new JustMs(json.hour, json.min, json.second, json.ms);
            case JustTimeType.SECOND:
                return new JustSecond(json.hour, json.min, json.second);
            case JustTimeType.MIN:
                return new JustMin(json.hour, json.min);
            case JustTimeType.HOUR:
                return new JustHour(json.hour);
            case JustTimeType.SPAN:
                return new JustTimeSpan(JustTime.fromJSON(json.from), JustTime.fromJSON(json.to));
            default:
                throw new Error(`Unknown type for fromJSON: ${json.type}`);
        }
    }

    static fromDate(date: Date): JustMs {
        const dt = DateTime.fromJSDate(date);
        return new JustMs(dt.hour, dt.minute, dt.second, dt.millisecond);
    }

    static fromLuxon(dt: DateTime): JustMs {
        return new JustMs(dt.hour, dt.minute, dt.second, dt.millisecond);
    }
}

export class JustMs extends JustTime {
    readonly hour: number;
    readonly min: number;
    readonly second: number;
    readonly ms: number;

    constructor(hour: number, min: number, second: number, ms: number) {
        super(JustTimeType.MS);
        this.hour = hour;
        this.min = min;
        this.second = second;
        this.ms = ms;
        this.ensureValid();
    }

    protected toJSONValue() {
        return {
            type: this.type,
            hour: this.hour,
            min: this.min,
            second: this.second,
            ms: this.ms,
        };
    }

    static now(): JustMs {
        return JustMs.fromDate(new Date());
    }

    diff(other: JustMs): number {
        return this.toInt() - other.toInt();
    }

    toInt() {
        return this.ms + 1000 * this.second + 100000 * this.min + 10000000 * this.hour;
    }

    static fromInt(value: number): JustMs {
        const hour = Math.floor(value / 10000000);
        const min = Math.floor((value % 10000000) / 100000);
        const second = Math.floor((value % 100000) / 1000);
        const ms = value % 1000;
        return new JustMs(hour, min, second, ms);
    }

    static fromJustTime(time: JustTime): JustMs {
        return time.firstMs;
    }

    private ensureValid() {
        if (this.hour < 0 || this.hour > 23) throw new Error(`Invalid hour: ${this.hour}`);
        if (this.min < 0 || this.min > 59) throw new Error(`Invalid min: ${this.min}`);
        if (this.second < 0 || this.second > 59) throw new Error(`Invalid second: ${this.second}`);
        if (this.ms < 0 || this.ms > 999) throw new Error(`Invalid ms: ${this.ms}`);
    }

    protected calculateFirstMs(): JustMs {
        return this;
    }

    protected calculateLastMs(): JustMs {
        return this;
    }

    toLuxon(): DateTime {
        return DateTime.local(1970, 1, 1, this.hour, this.min, this.second, this.ms);
    }

    startTime(): Date {
        return this.toLuxon().toJSDate();
    }

    endTime(): Date {
        return this.toLuxon().toJSDate();
    }

    protected addMsInternal(ms: number): JustMs {
        const dt = this.toLuxon().plus({ milliseconds: ms });
        return new JustMs(dt.hour, dt.minute, dt.second, dt.millisecond);
    }

    protected addSecondsInternal(seconds: number): JustMs {
        const dt = this.toLuxon().plus({ seconds });
        return new JustMs(dt.hour, dt.minute, dt.second, dt.millisecond);
    }

    protected addMinInternal(min: number): JustMs {
        const dt = this.toLuxon().plus({ minutes: min });
        return new JustMs(dt.hour, dt.minute, dt.second, dt.millisecond);
    }

    protected addHourInternal(hour: number): JustMs {
        const dt = this.toLuxon().plus({ hours: hour });
        return new JustMs(dt.hour, dt.minute, dt.second, dt.millisecond);
    }
}

export class JustSecond extends JustTime {
    readonly hour: number;
    readonly min: number;
    readonly second: number;

    constructor(hour: number, min: number, second: number) {
        super(JustTimeType.SECOND);
        this.hour = hour;
        this.min = min;
        this.second = second;
        new JustMs(hour, min, second, 0);
    }

    protected toJSONValue() {
        return {
            type: this.type,
            hour: this.hour,
            min: this.min,
            second: this.second,
        };
    }

    static fromJustTime(time: JustTime): JustSecond {
        const ms = time.firstMs;
        return new JustSecond(ms.hour, ms.min, ms.second);
    }

    protected calculateFirstMs(): JustMs {
        return new JustMs(this.hour, this.min, this.second, 0);
    }

    protected calculateLastMs(): JustMs {
        return new JustMs(this.hour, this.min, this.second, 999);
    }

    protected addMsInternal(ms: number): JustSecond {
        return this.firstMs.addMs(ms).castToSecond();
    }

    protected addSecondsInternal(seconds: number): JustSecond {
        const dt = this.firstMs.toLuxon().plus({ seconds });
        return new JustSecond(dt.hour, dt.minute, dt.second);
    }

    protected addMinInternal(min: number): JustSecond {
        const dt = this.firstMs.toLuxon().plus({ minutes: min });
        return new JustSecond(dt.hour, dt.minute, dt.second);
    }

    protected addHourInternal(hour: number): JustSecond {
        const dt = this.firstMs.toLuxon().plus({ hours: hour });
        return new JustSecond(dt.hour, dt.minute, dt.second);
    }
}

export class JustMin extends JustTime {
    readonly hour: number;
    readonly min: number;

    constructor(hour: number, min: number) {
        super(JustTimeType.MIN);
        this.hour = hour;
        this.min = min;
        new JustMs(hour, min, 0, 0);
    }

    protected toJSONValue() {
        return {
            type: this.type,
            hour: this.hour,
            min: this.min,
        };
    }

    static fromJustTime(time: JustTime): JustMin {
        const ms = time.firstMs;
        return new JustMin(ms.hour, ms.min);
    }

    firstSecond(): JustSecond {
        return new JustSecond(this.hour, this.min, 0);
    }

    lastSecond(): JustSecond {
        return new JustSecond(this.hour, this.min, 59);
    }

    protected calculateFirstMs(): JustMs {
        return new JustMs(this.hour, this.min, 0, 0);
    }

    protected calculateLastMs(): JustMs {
        return new JustMs(this.hour, this.min, 59, 999);
    }

    protected addMsInternal(ms: number): JustMin {
        return this.firstMs.addMs(ms).castToMin();
    }

    protected addSecondsInternal(seconds: number): JustMin {
        return this.firstMs.addSeconds(seconds).castToMin();
    }

    protected addMinInternal(min: number): JustMin {
        const dt = this.firstMs.toLuxon().plus({ minutes: min });
        return new JustMin(dt.hour, dt.minute);
    }

    protected addHourInternal(hour: number): JustMin {
        const dt = this.firstMs.toLuxon().plus({ hours: hour });
        return new JustMin(dt.hour, dt.minute);
    }
}

export class JustHour extends JustTime {
    readonly hour: number;

    constructor(hour: number) {
        super(JustTimeType.HOUR);
        this.hour = hour;
        new JustMs(hour, 0, 0, 0);
    }

    protected toJSONValue() {
        return {
            type: this.type,
            hour: this.hour,
        };
    }

    static fromJustTime(time: JustTime): JustHour {
        return new JustHour(time.firstMs.hour);
    }

    firstMin(): JustMin {
        return new JustMin(this.hour, 0);
    }

    lastMin(): JustMin {
        return new JustMin(this.hour, 59);
    }

    protected calculateFirstMs(): JustMs {
        return new JustMs(this.hour, 0, 0, 0);
    }

    protected calculateLastMs(): JustMs {
        return new JustMs(this.hour, 59, 59, 999);
    }

    protected addMsInternal(ms: number): JustHour {
        return this.firstMs.addMs(ms).castToHour();
    }

    protected addSecondsInternal(seconds: number): JustHour {
        return this.firstMs.addSeconds(seconds).castToHour();
    }

    protected addMinInternal(min: number): JustHour {
        return this.firstMs.addMin(min).castToHour();
    }

    protected addHourInternal(hour: number): JustHour {
        const dt = this.firstMs.toLuxon().plus({ hours: hour });
        return new JustHour(dt.hour);
    }
}

export class JustTimeSpan extends JustTime {
    readonly from: JustTime;
    readonly to: JustTime;

    constructor(from: JustTime, to: JustTime) {
        super(JustTimeType.SPAN);
        this.from = from;
        this.to = to;
    }

    protected toJSONValue() {
        return {
            type: JustTimeType.SPAN,
            from: this.from.toJSON(),
            to: this.to.toJSON(),
        };
    }

    protected calculateFirstMs(): JustMs {
        return this.from.firstMs;
    }

    protected calculateLastMs(): JustMs {
        return this.to.lastMs;
    }

    protected addMsInternal(ms: number): JustTimeSpan {
        return new JustTimeSpan(this.from, this.to.firstMs.addMs(ms));
    }

    protected addSecondsInternal(seconds: number): JustTimeSpan {
        return new JustTimeSpan(this.from, this.to.firstMs.addSeconds(seconds));
    }

    protected addMinInternal(min: number): JustTimeSpan {
        return new JustTimeSpan(this.from, this.to.firstMs.addMin(min));
    }

    protected addHourInternal(hour: number): JustTimeSpan {
        return new JustTimeSpan(this.from, this.to.firstMs.addHour(hour));
    }
}

export class JustTimeSet implements Iterable<JustTime> {
    private readonly items = new Map<string, JustTime>();
    type: JustTimeType;

    constructor(values: JustTime[] = [], allowMixedTypes: boolean = false) {
        let type: JustTimeType | null = null;
        if (values.length === 0) throw new Error("JustTimeSet cannot be empty");
        for (const value of values) {
            this.add(value);
            if (!type) {
                type = value.type;
            } else if (type !== value.type) {
                if (allowMixedTypes) {
                    if (getJustTimeSizeOrder(value.type) > getJustTimeSizeOrder(type)) {
                        type = value.type;
                    }
                } else {
                    throw new Error(`All JustTimeSet items must be of the same type. Found ${type} and ${value.type}`);
                }
            }
        }
        this.type = type!;
    }

    get size(): number {
        return this.items.size;
    }

    private add(value: JustTime): this {
        this.items.set(JSON.stringify(value.toJSON()), value);
        return this;
    }

    has(value: JustTime): boolean {
        return this.items.has(JSON.stringify(value.toJSON()));
    }

    values(): IterableIterator<JustTime> {
        return this.items.values();
    }

    toArray(): JustTime[] {
        return Array.from(this.items.values());
    }

    private _firstMs: JustMs | undefined;
    get firstMs(): JustMs {
        if (this._firstMs) return this._firstMs;
        this._firstMs = this.toArray().sort((a, b) => a.firstMs.valueOf() - b.firstMs.valueOf())[0].firstMs;
        return this._firstMs;
    }

    endTime(): JustTime {
        return this.toArray().sort((a, b) => b.lastMs.valueOf() - a.lastMs.valueOf())[0];
    }

    private _lastMs: JustMs | undefined;
    get lastMs(): JustMs {
        if (this._lastMs) return this._lastMs;
        this._lastMs = this.endTime().lastMs;
        return this._lastMs;
    }

    contains(target: JustTime): boolean {
        return this.toArray().some((item) => item.contains(target));
    }

    equals(other?: JustTimeSet): boolean {
        if (!other) return false;
        if (this.size !== other.size) return false;
        return this.toArray().every((item) => other.has(item));
    }

    toJSON(): any {
        return this.toArray().map((item) => item.toJSON());
    }

    static fromJSON(json: any): JustTimeSet {
        return new JustTimeSet((json ?? []).map((item: any) => JustTime.fromJSON(item)));
    }

    [Symbol.iterator](): IterableIterator<JustTime> {
        return this.values();
    }
}

export class TimeEx {
    valueType: "cycle" | "times";
    value: TimeCycle | JustTimeSet;

    constructor(value: TimeCycle | JustTimeSet | JustTime) {
        if (value instanceof TimeCycle) {
            this.valueType = "cycle";
            this.value = value;
        } else if (value instanceof JustTimeSet) {
            this.valueType = "times";
            this.value = value;
        } else if (value instanceof JustTime) {
            this.valueType = "times";
            this.value = new JustTimeSet([value]);
        } else {
            throw new Error("Invalid value for TimeEx");
        }
    }

    get type(): JustTimeType {
        return this.value.type;
    }

    equals(other: TimeEx): boolean {
        if (this.valueType !== other.valueType) return false;
        if (this.valueType === "cycle") {
            return (this.value as TimeCycle).equals(other.value as TimeCycle);
        }
        return (this.value as JustTimeSet).equals(other.value as JustTimeSet);
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

    static fromJSON(json: any): TimeEx {
        if (json.type === "cycle") {
            return new TimeEx(TimeCycle.fromJSON(json.value));
        }
        if (json.type === "times") {
            return new TimeEx(JustTimeSet.fromJSON(json.value));
        }
        throw new Error("Invalid JSON for TimeEx");
    }

    static thisHour = (): TimeEx => new TimeEx(JustTime.new(JustTimeType.HOUR));
    static nextHour = (): TimeEx => new TimeEx(JustTime.new(JustTimeType.HOUR).addHour(1));
    static everyHour = (): TimeEx => new TimeEx(TimeCycle.every(JustTimeType.HOUR));

    static thisMin = (): TimeEx => new TimeEx(JustTime.new(JustTimeType.MIN));
    static nextMin = (): TimeEx => new TimeEx(JustTime.new(JustTimeType.MIN).addMin(1));
    static everyMin = (): TimeEx => new TimeEx(TimeCycle.every(JustTimeType.MIN));

    static thisSecond = (): TimeEx => new TimeEx(JustTime.new(JustTimeType.SECOND));
    static nextSecond = (): TimeEx => new TimeEx(JustTime.new(JustTimeType.SECOND).addSeconds(1));
    static everySecond = (): TimeEx => new TimeEx(TimeCycle.every(JustTimeType.SECOND));

    static thisMs = (): TimeEx => new TimeEx(JustTime.new(JustTimeType.MS));
    static nextMs = (): TimeEx => new TimeEx(JustTime.new(JustTimeType.MS).addMs(1));
    static everyMs = (): TimeEx => new TimeEx(TimeCycle.every(JustTimeType.MS));

    contains(time: JustTime): boolean {
        return this.value.contains(time);
    }

    isMatch(time: JustTime): boolean {
        return this.value.contains(time);
    }

    get firstMs(): JustMs {
        return this.value.firstMs;
    }

    get lastMs(): JustMs {
        return this.value.lastMs;
    }
}

export class TimeCycle {
    cyclePattern: TimeCycleUnit[];
    from: JustTime;
    to: JustTime;
    type: JustTimeType;

    constructor(cyclePattern: TimeCycleUnit[], from?: JustTime, to?: JustTime) {
        this.cyclePattern = cyclePattern;
        if (cyclePattern.length === 0) {
            throw new Error("Cycle pattern cannot be empty");
        }

        for (let i = 1; i < cyclePattern.length; i++) {
            if (getJustTimeSizeOrder(cyclePattern[i].type) >= getJustTimeSizeOrder(cyclePattern[i - 1].type)) {
                throw new Error("Cycle pattern must be ordered from largest to smallest unit");
            }
        }

        if (cyclePattern[0].type !== JustTimeType.HOUR) {
            this.cyclePattern.unshift(new TimeCycleUnit(JustTimeType.HOUR));
        }

        this.type = cyclePattern[cyclePattern.length - 1].type;
        this.from = from ?? new JustHour(0);
        this.to = to ?? new JustMs(23, 59, 59, 999);
    }

    private getTimePattern(): JustTimePattern {
        return new JustTimePattern(this.cyclePattern.map((item) => item.type));
    }

    private getNormalizedFrom(rangeFrom: JustTime): JustTime {
        const rangeFromCasted = rangeFrom.castTo(this.type);
        if (rangeFromCasted < this.from) {
            return this.from;
        }
        return rangeFromCasted;
    }

    private getNormalizedTo(rangeTo: JustTime): JustTime {
        const rangeToCasted = rangeTo.castTo(this.type);
        if (rangeToCasted > this.to) {
            return this.to;
        }
        return rangeToCasted;
    }

    equals(other: TimeCycle): boolean {
        if (this.cyclePattern.length !== other.cyclePattern.length) return false;

        for (let i = 0; i < this.cyclePattern.length; i++) {
            if (!this.cyclePattern[i].equals(other.cyclePattern[i])) {
                return false;
            }
        }
        return this.from.equals(other.from) && this.to.equals(other.to);
    }

    contains(time: JustTime): boolean {
        if (this.lastMs < time.firstMs) return false;
        if (this.firstMs > time.lastMs) return false;
        return this.exactMatch(time);
    }

    private exactMatch(time: JustTime): boolean {
        const patterned = this.getTimePattern().projectTimeToPattern(time);
        return this.cyclePattern.every((cycleUnit) => {
            const matched = patterned.units.find((value) => value.type === cycleUnit.type);
            return matched ? cycleUnit.matchTimeUnit(matched) : false;
        });
    }

    getTimesInRange(from: JustTime, to: JustTime): JustTime[] {
        const start = this.getNormalizedFrom(from);
        const end = this.getNormalizedTo(to);

        const times: JustTime[] = [];
        let current = start;
        while (current <= end) {
            if (this.exactMatch(current)) {
                times.push(current);
            }
            current = current.next();
        }
        return times;
    }

    intersect(time: JustTime): boolean {
        let current = time.firstMs;
        const end = time.lastMs;

        while (current.valueOf() <= end.valueOf()) {
            if (this.exactMatch(current)) {
                return true;
            }
            current = current.addMs(1).castToMs();
        }

        return false;
    }

    get firstMs(): JustMs {
        return this.from.firstMs;
    }

    get lastMs(): JustMs {
        return this.to.lastMs;
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

    static every(type: JustTimeType, { from, to }: { from?: JustTime, to?: JustTime } = {}): TimeCycle {
        return new TimeCycle(
            [new TimeCycleUnit(type)],
            from,
            to,
        );
    }

    static fromJSON(json: any): TimeCycle {
        return new TimeCycle(
            json.cyclePatternOrdered.map((item: any) => new TimeCycleUnit(item.type, item.indexes, item.step ?? null)),
            JustTime.fromJSON(json.from),
            JustTime.fromJSON(json.to),
        );
    }
}
