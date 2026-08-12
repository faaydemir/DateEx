import { describe, expect, test } from '@jest/globals'
import { DateExpression } from './DateExpression.ts'
import { DateCycle, JustDateType, JustWeek } from './JustDate.ts'
import { parseDateEx } from './mapper.ts'

const validExpressions = [
  'Y2026',
  'Y2026-Q1',
  'Y2026-M3',
  'Y2026-M3-W2',
  'Y2026-M3-W2-D1',
  'Y2026-M3-Dm15',
  'Y2026-M3-Dm^1',
  'Y2026-M3-Dm[1,15]',
  'Y2026-M[1>6]',
  'Y2026-D1',
  'Y2026-D70',
  'M3-W2-D1',
  'W2-D1',
  'D1',
  'Dm15',
  'Q2',
  'M3-Dm15',
  'M-D1',
  'M*',
  'W*',
  'D*',
  'Dm*',
  'Q*',
  'Y*',
  'W*-D1',
  'M*-W1-D1',
  'M*-Dm15',
  'M*-Dm[1,15]*',
  'Y2026-M*',
  'Y2026-W*-D[1,5]*',
  'Y2026-M*-Dm[1>10]*',
  'Y2026-Q*-M1-Dm1',
  '[Y2026>Y2027]-M*',
  '[Y2026>]-M*',
  '[>Y2027]-M*',
  '[Y2026-M1>Y2027-M4]-M*',
  '[Y2026-Q2>Y2027-Q1]-W*-D1',
  'D+1',
  'D-1',
  'W+1',
  'M+3',
  'Q-1',
  'Y+1',
  'Dm+1',
  'Y2026-M4',
  'M3-Dm15',
  'D+5',
  'W+1',
  '..Y2026-M4',
  '..Y2026',
  '..M3-Dm15',
  '..D+5',
  '..W+1',
  'Y2023..Y2025',
  'Y2023-M1..Y2026-D4',
  '[Y2026,Y2027]',
  '[D,D+1]',
  '[M1,M6,M12]',
  '[Y2026-M3-Dm1,Y2026-M9-Dm1]',
  '[..Y2026-M4,Y2027]',
  '[M*,Y2026]',
  '[D+1,W+1,M+1]',
]

describe('mapper tests', () => {
  test.each(validExpressions)('maps %s', (sample) => {
    expect(() => {
      const expression = parseDateEx(sample)
      expect(expression).toBeInstanceOf(DateExpression)
    }).not.toThrow()
  })

  test.each([
    'Y2026',
    'Y2023-D[1,2]',
    'Y2026-M3-Dm15',
    'D+1',
    'M*',
    'Y2023..Y2025',
    '[Y2026,Y2027]',
  ])('converts %s to DateEx', (sample) => {
    expect(() => parseDateEx(sample).toDateEx()).not.toThrow()
  })

  test.each([
    ['D', 'D+0'],
    ['W', 'W+0'],
    ['M', 'M+0'],
    ['Dm', 'Dm+0'],
  ])('%s resolves to the current value', (currentExpr, relativeExpr) => {
    expect(parseDateEx(currentExpr).toDateEx().equals(parseDateEx(relativeExpr).toDateEx())).toBe(true)
  })

  test('current units constrain cycle parents', () => {
    const currentWeekCycle = parseDateEx('W-D*').toDateEx().value
    const everyWeekCycle = parseDateEx('W*-D*').toDateEx().value

    expect(currentWeekCycle).toBeInstanceOf(DateCycle)
    expect(everyWeekCycle).toBeInstanceOf(DateCycle)

    if (currentWeekCycle instanceof DateCycle && everyWeekCycle instanceof DateCycle) {
      const currentWeek = JustWeek.now().week
      expect(currentWeekCycle.cyclePattern.find((unit) => unit.type === JustDateType.WEEK)?.indexes).toEqual([currentWeek])
      expect(everyWeekCycle.cyclePattern.find((unit) => unit.type === JustDateType.WEEK)?.indexes).toEqual([])
    }
  })
})
