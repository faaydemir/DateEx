import {
  CycleUnit,
  DateEx,
  DateCycle,
  DaysOfWeek,
  INFINITY,
  JustDate,
  JustDateSet,
  JustSpan,
  JustDateType,
  JustDay,
  NEGATIVE_INFINITY,
} from "./JustDate";

type Translate = (t: string, ...args: any[]) => string;
const defaultTranslate: Translate = (s, ...args) => {
  let i = 0;
  if (args.length === 0) return s;
  if (!s) return "";
  return s.replace(/{\d+}/g, () => args[i++]);
};

let configuredTranslate: Translate | undefined;

export const setJustDateTranslate = (
  translate: Translate | undefined,
): void => {
  configuredTranslate = translate;
};

const getTranslate = (translate?: Translate | undefined): Translate => {
  return translate ?? configuredTranslate ?? defaultTranslate;
};

const dayNames = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];
const dayShortNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const dayLetters = ["M", "T", "W", "T", "F", "S", "S"];
const monthNames = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const monthShortNames = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export const toMonthDayString = (
  justDay: JustDay,
  t?: Translate | undefined,
): string => {
  t = getTranslate(t);
  const dayOfMonth = justDay.castToMonthDay();
  return `
        ${getMonthShortName(dayOfMonth.realMonth, t)} ${dayOfMonth.dayOfMonth}
    `.trim();
};

export const justDateToShortString = (
  justDate: JustDate,
  t?: Translate | undefined,
): string => {
  t = getTranslate(t);
  const currentYear = JustDay.now().firstDay.year;
  switch (justDate.type) {
    case JustDateType.DAY:
    case JustDateType.MONTH_DAY:
      const dayOfMonth = justDate.firstDay.castToMonthDay();
      const monthName = getMonthShortName(dayOfMonth.realMonth, t);
      if (justDate.firstDay.year === currentYear) {
        return `${monthName} ${dayOfMonth.dayOfMonth}`;
      } else {
        return `${monthName} ${dayOfMonth.dayOfMonth} ${justDate.firstDay.year}`;
      }
    case JustDateType.WEEK:
      const week = justDate.firstDay.week;
      const year = justDate.firstDay.year;
      if (year === currentYear) {
        return `${t("Week")} ${week}`;
      } else {
        return `${t("Week")} ${week} ${year}`;
      }
    case JustDateType.MONTH:
      const month = justDate.firstDay.castToMonth().month;
      const monthNameFull = getMonthName(month, t);
      if (justDate.firstDay.year === currentYear) {
        return monthNameFull;
      } else {
        return `${monthNameFull} ${justDate.firstDay.year}`;
      }
    case JustDateType.QUARTER:
      const quarter = justDate.firstDay.castToQuarter().quarter;
      const quarterName = getQuarterName(quarter, t);
      if (justDate.firstDay.year === currentYear) {
        return quarterName;
      } else {
        return `${quarterName} ${justDate.firstDay.year}`;
      }
    case JustDateType.YEAR:
      return justDate.firstDay.year.toString();
    case JustDateType.SPAN:
      const span = justDate as JustSpan
      return `${t("From")} ${justDateToCurrentString(span.from)} ${t("Until")} ${justDateToCurrentString(span.to)}`;
    default:
      throw new Error("Unsupported JustDateType");
  }
};

export const justDateToCurrentString = (
  justDate: JustDate,
  t?: Translate | undefined,
): string => {
  t = getTranslate(t);
  if (!justDate.isCurrent()) {
    return justDateToShortString(justDate, t);
  }

  switch (justDate.type) {
    case JustDateType.DAY:
    case JustDateType.MONTH_DAY:
      return t("Today");
    case JustDateType.WEEK:
      return t("This week");
    case JustDateType.MONTH:
      return t("This month");
    case JustDateType.QUARTER:
      return t("This quarter");
    case JustDateType.YEAR:
      return t("This year");
    default:
      return justDateToShortString(justDate, t);
  }
};

export const getDayName = (
  dayIndex: number,
  t?: Translate | undefined,
): string => {
  t = getTranslate(t);
  return t(dayNames[dayIndex - 1]);
};

export const getDayShortName = (
  dayIndex: number,
  t?: Translate | undefined,
): string => {
  t = getTranslate(t);
  return t(dayShortNames[dayIndex - 1]);
};

export const getDayLetter = (
  dayIndex: number,
  t?: Translate | undefined,
): string => {
  t = getTranslate(t);
  const key = `DayLetter_${dayIndex}`;
  const translated = t(key);
  return translated === key ? t(dayLetters[dayIndex - 1]) : translated;
};

export const getMonthName = (
  monthIndex: number,
  t?: Translate | undefined,
): string => {
  t = getTranslate(t);
  return t(monthNames[monthIndex - 1]);
};
export const getWeekDays = (): DaysOfWeek[] => {
  return [1, 2, 3, 4, 5, 6, 7];
};

export const getQShort = (
  quarterIndex: number,
  t?: Translate | undefined,
): string => {
  t = getTranslate(t);

  return `${t("Q")}${quarterIndex}`;
};

export const getQFull = (
  quarterIndex: number,
  t?: Translate | undefined,
): string => {
  t = getTranslate(t);

  return `${t("Quarter")} ${quarterIndex}`;
};

export const getWeekShort = (
  weekIndex: number,
  t?: Translate | undefined,
): string => {
  t = getTranslate(t);

  return `${t("W")}${weekIndex}`;
};

export const getWeekFull = (
  weekIndex: number,
  t?: Translate | undefined,
): string => {
  t = getTranslate(t);

  return `${t("Week")} ${weekIndex}`;
};

export const getMonthShortName = (
  monthIndex: number,
  t?: Translate | undefined,
): string => {
  t = getTranslate(t);

  return t(monthShortNames[monthIndex - 1]);
};

export const getQuarterName = (
  quarterIndex: number,
  t?: Translate | undefined,
): string => {
  t = getTranslate(t);
  return `${t("Q")}${quarterIndex}`;
};

export const toDateExShortString = (
  date: DateEx,
  defaultStr: string = "Date",
  limit: number | undefined = undefined,
  t: Translate | undefined = undefined,
): string => {
  t = getTranslate(t);
  const dateString = formatDateExString(date, t).join(", ");

  if (limit && dateString.length > limit) {
    return defaultStr;
  }
  return dateString;
};
export const toIndexString = (
  index: number,
  t?: Translate | undefined,
): string => {
  t = getTranslate(t);
  const suffixes = ["th", "st", "nd", "rd"];
  const v = index % 100;
  return index + (suffixes[(v - 20) % 10] || suffixes[v] || suffixes[0]);
};
export const toTypeString = (
  type: JustDateType,
  plural: boolean = false,
  t?: Translate | undefined,
): string => {
  t = getTranslate(t);
  switch (type) {
    case JustDateType.DAY:
      return t(plural ? "Days" : "Day");
    case JustDateType.MONTH_DAY:
      return t(plural ? "Days" : "Day");
    case JustDateType.WEEK:
      return t(plural ? "Weeks" : "Week");
    case JustDateType.MONTH:
      return t(plural ? "Months" : "Month");
    case JustDateType.QUARTER:
      return t(plural ? "Quarters" : "Quarter");
    case JustDateType.YEAR:
      return t(plural ? "Years" : "Year");
    case JustDateType.SPAN:
      return t(plural ? "Spans" : "Span");
    default:
      return "";
  }
};
const isInfinity = (date: JustDate): boolean => {
  return (
    date.firstDay.equals(INFINITY.firstDay) ||
    date.firstDay.equals(NEGATIVE_INFINITY.firstDay)
  );
};
export const dateExToString = (
  date: DateEx,
  t?: Translate | undefined,
): string => {
  return formatDateExString(date, t).join(", ");
};

export const minDate = (...dates: JustDate[]): JustDate => {
  if (dates.length === 0) {
    throw new Error("minDate requires at least one date");
  }
  return dates.reduce((min, d) =>
    min.firstDay.valueOf() <= d.firstDay.valueOf() ? min : d,
  );
};

export const maxDate = (...dates: JustDate[]): JustDate => {
  if (dates.length === 0) {
    throw new Error("maxDate requires at least one date");
  }
  return dates.reduce((max, d) =>
    max.firstDay.valueOf() >= d.firstDay.valueOf() ? max : d,
  );
};

export const getContainingUnits = (date: JustDate): JustDate[] => {
  switch (date.type) {
    case JustDateType.DAY:
      return [date, date.castToWeek(), date.castToMonth(), date.castToQuarter(), date.castToYear()]
    case JustDateType.MONTH_DAY:
      return [date, date.castToMonth(), date.castToQuarter(), date.castToYear()]
    case JustDateType.WEEK:
      return [date, date.castToMonth(), date.castToQuarter(), date.castToYear()]
    case JustDateType.MONTH:
      return [date, date.castToQuarter(), date.castToYear()]
    case JustDateType.QUARTER:
      return [date, date.castToYear()]
    case JustDateType.YEAR:
      return [date]
    default:
      return [date]
  }
}

export const getAllMatched = (
  date: DateEx,
  from: JustDate,
  to: JustDate,
  limit: number = 1000,
): JustDate[] => {
  const startDay =
    date.firstDay > from.firstDay ? date.firstDay : from.firstDay;
  const endDay = date.lastDay < to.lastDay ? date.lastDay : to.lastDay;

  if (startDay > endDay) {
    return [];
  }

  if (date.valueType === "dates") {
    const matchedDates: JustDate[] = [];
    for (const item of date.value as JustDateSet) {
      if (item.lastDay < startDay || item.firstDay > endDay) {
        continue;
      }
      if (!date.contains(item)) {
        continue;
      }

      matchedDates.push(item);
      if (limit && matchedDates.length >= limit) {
        break;
      }
    }

    return matchedDates;
  }

  const start = startDay.castTo(date.type);
  const end = endDay.castTo(date.type);
  const matchedMap = new Map<string, JustDate>();

  let current = start;
  let count = 0;
  while (current <= end) {
    if (!matchedMap.has(current.toJSONString()) && date.contains(current)) {
      matchedMap.set(current.toJSONString(), current);
      count++;
      if (limit && count >= limit) {
        break;
      }
    }
    current = current.add(1);
  }

  return Array.from(matchedMap.values());
};
export const formatDateExString = (
  date: DateEx,
  t?: Translate | undefined,
): string[] => {
  t = getTranslate(t);
  if (date.valueType === "dates") {
    return formatJustDates((date.value as JustDateSet).toArray(), date.type, t);
  } else {
    let cycleString: string[] = [];
    const cycleValue = date.value as DateCycle;
    if (cycleValue.from && !isInfinity(cycleValue.from)) {
      cycleString.push(t("From {0}", justDateToCurrentString(cycleValue.from, t)));
    }
    if (cycleValue.to && !isInfinity(cycleValue.to)) {
      cycleString.push(t("To {0}", justDateToCurrentString(cycleValue.to, t)));
    }
    let desc = "";

    let parent: CycleUnit | undefined = undefined;
    let cascadingEvery = true;
    for (let i = 0; i < cycleValue.cyclePattern.length; i++) {
      const period = cycleValue.cyclePattern[i];
      const isEvery = period.isEvery(parent?.type);
      if (isEvery && cascadingEvery && i < cycleValue.cyclePattern.length - 1) {
        // do nothing
      } else {
        if (period.step != null) {
          desc += t(`Every {0} {1} `, period.step, toTypeString(period.type, false, t));
        } else if (period.isEvery(parent?.type)) {
          desc += t(`Every {0} `, toTypeString(period.type, false, t));
        } else if (period.indexes) {
          if (
            period.type === JustDateType.DAY &&
            parent?.type === JustDateType.WEEK
          ) {
            desc += t(
              `Every {0} `,
              period.indexes.map((i) => getDayShortName(i, t)).join(", "),
            );
          } else if (
            period.type === JustDateType.MONTH &&
            parent?.type === JustDateType.YEAR
          ) {
            desc += t(
              `Every {0} `,
              period.indexes.map((i) => getMonthShortName(i, t)).join(", "),
            );
          } else {
            const indexes = Array.from(period.indexes)
              .map((i) => i)
              .sort((a, b) => a - b);
            desc += t(
              `Every {0} {1} `,
              indexes.map((i) => toIndexString(i, t)).join(", "),
              toTypeString(period.type, false, t),
            );
          }
        }
        if (parent && !cascadingEvery) {
          desc += t("of ");
        }
      }
      parent = period;
    }
    return [...cycleString, desc.trim()];
  }
};

export const formatJustDates = (
  dates: JustDate[],
  type?: JustDateType | undefined,
  t?: Translate | undefined,
): string[] => {
  if (dates.length === 0) {
    return [];
  }

  t = getTranslate(t);
  if (!type) {
    type = dates[0].type;
  }
  const joinWithAnd = (items: string[]): string => {
    if (items.length === 0) return "";
    if (items.length === 1) return items[0];
    if (items.length === 2) return `${items[0]} ${t("and")} ${items[1]}`;
    return `${items.slice(0, -1).join(", ")} ${t("and")} ${items[items.length - 1]}`;
  };

  const sorted = [...dates].sort(
    (a, b) => a.firstDay.toJSON() - b.firstDay.toJSON(),
  );

  if (type === JustDateType.SPAN) {
    return sorted.map((date) => {
      const span = date as JustSpan;
      const hasFrom = !isInfinity(span.from);
      const hasTo = !isInfinity(span.to);
      const fromLabel = hasFrom ? justDateToCurrentString(span.from, t) : "";
      const toLabel = hasTo ? justDateToCurrentString(span.to, t) : "";

      if (hasFrom && hasTo) {
        return t("From {0} until {1}", fromLabel, toLabel);
      }
      if (hasFrom) {
        return t("From {0}", fromLabel);
      }
      if (hasTo) {
        return t("Until {0}", toLabel);
      }
      return t("Any date");
    });
  }

  if (type === JustDateType.YEAR) {
    const years = sorted.map((d) => d.firstDay.year.toString());
    return [joinWithAnd(years)];
  }

  if (type === JustDateType.QUARTER) {
    const yearToQuarters = new Map<number, number[]>();
    for (const d of sorted) {
      const year = d.firstDay.year;
      const quarter = d.firstDay.castToQuarter().quarter;
      if (!yearToQuarters.has(year)) yearToQuarters.set(year, []);
      yearToQuarters.get(year)!.push(quarter);
    }
    const parts: string[] = [];
    for (const year of Array.from(yearToQuarters.keys()).sort(
      (a, b) => a - b,
    )) {
      const quarters = Array.from(new Set(yearToQuarters.get(year)!)).sort(
        (a, b) => a - b,
      );
      const label = joinWithAnd(quarters.map((q) => getQuarterName(q, t)));
      parts.push(`${label} ${year}`);
    }
    return parts;
  }

  if (type === JustDateType.MONTH) {
    const yearToMonths = new Map<number, number[]>();
    for (const d of sorted) {
      const year = d.firstDay.year;
      const monthIndex = d.firstDay.castToMonth().month;
      if (!yearToMonths.has(year)) yearToMonths.set(year, []);
      yearToMonths.get(year)!.push(monthIndex);
    }
    const parts: string[] = [];
    for (const year of Array.from(yearToMonths.keys()).sort((a, b) => a - b)) {
      const months = Array.from(new Set(yearToMonths.get(year)!)).sort(
        (a, b) => a - b,
      );
      const label = joinWithAnd(months.map((m) => getMonthShortName(m, t)));
      parts.push(`${label} ${year}`);
    }
    return parts;
  }

  if (type === JustDateType.WEEK) {
    const yearToWeeks = new Map<number, number[]>();
    for (const d of sorted) {
      const year = d.firstDay.year;
      const week = d.firstDay.week;
      if (!yearToWeeks.has(year)) yearToWeeks.set(year, []);
      yearToWeeks.get(year)!.push(week);
    }
    const parts: string[] = [];
    for (const year of Array.from(yearToWeeks.keys()).sort((a, b) => a - b)) {
      const weeks = Array.from(new Set(yearToWeeks.get(year)!)).sort(
        (a, b) => a - b,
      );
      const label = joinWithAnd(weeks.map((w) => getWeekFull(w, t)));
      parts.push(`${label} ${year}`);
    }
    return parts;
  }

  if (type === JustDateType.DAY) {
    const yearToMonthDays = new Map<number, Map<number, number[]>>();
    for (const d of sorted) {
      const year = d.castToYear().year;
      const monthIndex = d.castToMonth().month;
      const day = d.castToMonthDay().dayOfMonth;

      if (!yearToMonthDays.has(year)) yearToMonthDays.set(year, new Map());
      const monthMap = yearToMonthDays.get(year)!;
      if (!monthMap.has(monthIndex)) monthMap.set(monthIndex, []);
      monthMap.get(monthIndex)!.push(day);
    }

    const parts: string[] = [];
    for (const year of Array.from(yearToMonthDays.keys()).sort(
      (a, b) => a - b,
    )) {
      const monthMap = yearToMonthDays.get(year)!;
      const monthParts: string[] = [];
      for (const month of Array.from(monthMap.keys()).sort((a, b) => a - b)) {
        const days = Array.from(new Set(monthMap.get(month)!)).sort(
          (a, b) => a - b,
        );
        const dayLabel = joinWithAnd(days.map((d) => d.toString()));
        monthParts.push(`${dayLabel} ${getMonthShortName(month, t)} ${year}`);
      }
      parts.push(monthParts.join("; "));
    }
    return parts;
  }

  return [];
};
