import { describe, expect, test } from '@jest/globals'
import { parse } from './parser.js'

const expectParsesAs = (sample, type) => {
  const ast = parse(sample)
  expect(ast).toMatchObject({ type })
}

describe('parser tests', () => {
  describe('anchor expressions', () => {
    test.each([
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
    ])('parses %s', (sample) => {
      expectParsesAs(sample, 'anchor')
    })
  })

  describe('implicit parent expressions', () => {
    test.each([
      'M3-W2-D1',
      'W2-D1',
      'D1',
      'Dm15',
      'Q2',
      'M3-Dm15',
      'M-D1',
    ])('parses %s', (sample) => {
      expectParsesAs(sample, 'anchor')
    })
  })

  describe('cycle expressions', () => {
    test.each([
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
    ])('parses %s', (sample) => {
      expectParsesAs(sample, 'cycle')
    })
  })

  describe('bounded cycle expressions', () => {
    test.each([
      '[Y2026>Y2027]-M*',
      '[Y2026>]-M*',
      '[>Y2027]-M*',
      '[Y2026-M1>Y2027-M4]-M*',
      '[Y2026-Q2>Y2027-Q1]-W*-D1',
    ])('parses %s', (sample) => {
      const ast = parse(sample)
      expect(ast).toMatchObject({ type: 'cycle' })
      expect(ast).toHaveProperty('from')
      expect(ast).toHaveProperty('to')
    })
  })

  describe('relative expressions', () => {
    test.each([
      'D+1',
      'D-1',
      'W+1',
      'M+3',
      'Q-1',
      'Y+1',
      'Dm+1',
    ])('parses %s', (sample) => {
      expectParsesAs(sample, 'relative')
    })
  })

  describe('point expressions', () => {
    test.each([
      ['Y2026-M4', 'anchor'],
      ['M3-Dm15', 'anchor'],
      ['D+5', 'relative'],
      ['W+1', 'relative'],
    ])('parses %s', (sample, type) => {
      expectParsesAs(sample, type)
    })
  })

  describe('span expressions', () => {
    test.each([
      '..Y2026-M4',
      '..Y2026',
      '..M3-Dm15',
      '..D+5',
      '..W+1',
      'Y2023..Y2025',
      'Y2023-M1..Y2026-D4',
    ])('parses %s', (sample) => {
      expectParsesAs(sample, 'span')
    })
  })

  describe('set expressions', () => {
    test.each([
      '[Y2026,Y2027]',
      '[D,D+1]',
      '[M1,M6,M12]',
      '[Y2026-M3-Dm1,Y2026-M9-Dm1]',
      '[..Y2026-M4,Y2027]',
      '[M*,Y2026]',
      '[D+1,W+1,M+1]',
    ])('parses %s', (sample) => {
      const ast = parse(sample)
      expect(ast).toMatchObject({ type: 'set' })
      expect(ast.items.length).toBeGreaterThan(1)
    })
  })

  describe('errors', () => {
    test.each([
      [
        'Y2026-D1-W1',
        /Wrong order: "week" cannot follow "day"/,
      ],
      [
        'Y2026-W1-Dm5',
        /"Dm" cannot follow "W"/,
      ],
      [
        'Y2026-M1-D1-Dm5',
        /"D" \(weekday\) and "Dm" \(month-day\) cannot coexist/,
      ],
      [
        '[Y2026-M1-D1>Y2027-M9-D1]-M*',
        /Bound is more specific than the cycling unit/,
      ],
      [
        '[Y2026>Y2027]-Y2026-M1',
        /Bounds \[...>...] can only be applied to cycle expressions/,
      ],
      [
        '..M*',
        /A point expression cannot contain cycles/,
      ],
      [
        'Y2026-M3-D',
        /Current "day" cannot follow selected "month"/,
      ],
      [
        'M3-D',
        /Current "day" cannot follow selected "month"/,
      ],
      [
        'Y2026-M',
        /Current "month" cannot follow selected "year"/,
      ],
    ])('rejects %s', (sample, message) => {
      expect(() => parse(sample)).toThrow(message)
    })
  })
})
