import { describe, expect, test } from '@jest/globals'
import {
  JustHour,
  JustMin,
  JustMs,
  JustSecond,
  JustTimeHierarchical,
  JustTimeSet,
  JustTimeType,
  TimeCycle,
  TimeCycleUnit,
  TimeEx,
} from './JustTime.ts'

describe('JustTime', () => {
  test('builds hierarchical time values', () => {
    const time = new JustTimeHierarchical([
      { type: JustTimeType.HOUR, value: 14 },
      { type: JustTimeType.MIN, value: 30 },
      { type: JustTimeType.SECOND, value: 45 },
      { type: JustTimeType.MS, value: 250 },
    ]).toJustTime()

    expect(time).toBeInstanceOf(JustMs)
    expect(time.toJSON()).toMatchObject({
      type: JustTimeType.MS,
      hour: 14,
      min: 30,
      second: 45,
      ms: 250,
    })
  })

  test('uses firstMs and lastMs as boundaries', () => {
    const hour = new JustHour(9)
    const min = new JustMin(9, 15)
    const second = new JustSecond(9, 15, 30)

    expect(hour.firstMs.toJSON()).toMatchObject({ hour: 9, min: 0, second: 0, ms: 0 })
    expect(hour.lastMs.toJSON()).toMatchObject({ hour: 9, min: 59, second: 59, ms: 999 })
    expect(min.firstMs.toJSON()).toMatchObject({ hour: 9, min: 15, second: 0, ms: 0 })
    expect(min.lastMs.toJSON()).toMatchObject({ hour: 9, min: 15, second: 59, ms: 999 })
    expect(second.lastMs.toJSON()).toMatchObject({ hour: 9, min: 15, second: 30, ms: 999 })
  })

  test('adds time units and casts back to the current type', () => {
    const min = new JustMin(9, 59)
    const hour = new JustHour(22)

    expect(min.addMin(2).toJSON()).toMatchObject({ type: JustTimeType.MIN, hour: 10, min: 1 })
    expect(hour.addHour(2).toJSON()).toMatchObject({ type: JustTimeType.HOUR, hour: 0 })
    expect(new JustMs(9, 0, 0, 999).addMs(1).toJSON()).toMatchObject({ hour: 9, min: 0, second: 1, ms: 0 })
  })

  test('supports sets and TimeEx wrappers', () => {
    const set = new JustTimeSet([new JustHour(8), new JustHour(9)])
    const timeEx = new TimeEx(set)

    expect(timeEx.firstMs.hour).toBe(8)
    expect(timeEx.lastMs.hour).toBe(9)
    expect(timeEx.contains(new JustMin(9, 30))).toBe(true)
  })

  test('supports cycles with the same flow as DateCycle', () => {
    const cycle = new TimeCycle([
      new TimeCycleUnit(JustTimeType.HOUR),
      new TimeCycleUnit(JustTimeType.MIN, [30]),
    ])

    expect(cycle.contains(new JustMin(8, 30))).toBe(true)
    expect(cycle.contains(new JustMin(8, 31))).toBe(false)
    expect(TimeEx.everyMin().valueType).toBe('cycle')
  })
})
