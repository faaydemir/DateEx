import { describe, expect, test } from '@jest/globals'
import { DateEx } from './JustDate.ts'
import { JustTime, JustTimeType, TimeCycle, TimeEx } from './JustTime.ts'
import { parseExtendedToDomain } from './extended.ts'

describe('extended parser domain', () => {
  test('keeps old DateEx expressions on the old domain model', () => {
    const result = parseExtendedToDomain('Y2026-M3-Dm15')

    expect(result.error).toBeNull()
    expect(result.domainModel).toBeInstanceOf(DateEx)
  })

  test('maps JustTime anchors to TimeEx', () => {
    const result = parseExtendedToDomain('H14-Mi30-S45-Ms250')

    expect(result.error).toBeNull()
    expect(result.domainModel).toBeInstanceOf(TimeEx)
    expect((result.domainModel as TimeEx | null)?.toJSON()).toMatchObject({
      type: 'times',
      value: [
        {
          type: JustTimeType.MS,
          hour: 14,
          min: 30,
          second: 45,
          ms: 250,
        },
      ],
    })
  })

  test('maps JustTime relative expressions to TimeEx', () => {
    const result = parseExtendedToDomain('H+1')

    expect(result.error).toBeNull()
    expect(result.domainModel).toBeInstanceOf(TimeEx)
  })

  test('maps JustTime cycles to TimeEx cycle values', () => {
    const result = parseExtendedToDomain('H*-Mi30')

    expect(result.error).toBeNull()
    expect((result.domainModel as TimeEx | null)?.toJSON()).toMatchObject({
      type: 'cycle',
      value: {
        cyclePatternOrdered: [
          { type: JustTimeType.HOUR, indexes: [] },
          { type: JustTimeType.MIN, indexes: [30] },
        ],
      },
    })
  })

  test('maps JustTime stepped cycles to TimeEx cycle values', () => {
    const result = parseExtendedToDomain('H*/2-Mi*/15')

    expect(result.error).toBeNull()
    expect((result.domainModel as TimeEx | null)?.toJSON()).toMatchObject({
      type: 'cycle',
      value: {
        cyclePatternOrdered: [
          { type: JustTimeType.HOUR, indexes: [], step: 2 },
          { type: JustTimeType.MIN, indexes: [], step: 15 },
        ],
      },
    })
  })

  test('maps nested stepped date cycles to DateEx', () => {
    const result = parseExtendedToDomain('M*/2-D*/2')

    expect(result.error).toBeNull()
    expect(result.domainModel).toBeInstanceOf(DateEx)
    expect((result.domainModel as DateEx | null)?.toJSON()).toMatchObject({
      type: 'cycle',
      value: {
        cyclePatternOrdered: [
          { type: 'year', indexes: [] },
          { type: 'month', indexes: [], step: 2 },
          { type: 'day', indexes: [], step: 2 },
        ],
      },
    })
  })

  test('current time units constrain cycle parents', () => {
    const currentHourCycle = parseExtendedToDomain('H-Mi*').domainModel
    const everyHourCycle = parseExtendedToDomain('H*-Mi*').domainModel

    expect(currentHourCycle).toBeInstanceOf(TimeEx)
    expect(everyHourCycle).toBeInstanceOf(TimeEx)

    if (currentHourCycle instanceof TimeEx && currentHourCycle.value instanceof TimeCycle) {
      expect(currentHourCycle.value.cyclePattern.find((unit) => unit.type === JustTimeType.HOUR)?.indexes).toEqual([JustTime.now(JustTimeType.HOUR).firstMs.hour])
    }

    if (everyHourCycle instanceof TimeEx && everyHourCycle.value instanceof TimeCycle) {
      expect(everyHourCycle.value.cyclePattern.find((unit) => unit.type === JustTimeType.HOUR)?.indexes).toEqual([])
    }
  })

  test('splits mixed DateEx Extended expressions into DateEx and TimeEx', () => {
    const result = parseExtendedToDomain('Y2026-M3-Dm15-H14-Mi30')

    expect(result.error).toBeNull()
    expect(result.domainModel).toMatchObject({ type: 'mixed' })

    if (result.domainModel && !(result.domainModel instanceof DateEx) && !(result.domainModel instanceof TimeEx)) {
      expect(result.domainModel.dateEx).toBeInstanceOf(DateEx)
      expect(result.domainModel.timeEx).toBeInstanceOf(TimeEx)
      expect(result.domainModel.dateEx?.firstDay.castToYear().year).toBe(2026)
      expect(result.domainModel.timeEx?.firstMs.hour).toBe(14)
      expect(result.domainModel.timeEx?.firstMs.min).toBe(30)
    }
  })
})
