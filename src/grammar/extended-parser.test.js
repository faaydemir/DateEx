import { describe, expect, test } from '@jest/globals'
import { parse } from './extended-parser.js'

const expectParsesAs = (sample, type) => {
  const ast = parse(sample)
  expect(ast).toMatchObject({ type })
}

describe('extended parser tests', () => {
  test.each([
    'Y2026',
    'Y2026-M3-Dm15',
    'D+1',
    'M*-Dm15',
    'Y2023..Y2025',
    '[Y2026,Y2027]',
  ])('still parses old DateEx syntax: %s', (sample) => {
    expect(parse(sample)).toBeTruthy()
  })

  test.each([
    'Y2026-M3-Dm15-H14',
    'Y2026-M3-Dm15-H14-Mi30',
    'Y2026-M3-Dm15-H14-Mi30-S45',
    'Y2026-M3-Dm15-H14-Mi30-S45-Ms250',
    'H14',
    'H14-Mi30',
    'H14-Mi30-S45',
    'H14-Mi30-S45-Ms250',
    'Mi30-S45',
  ])('parses JustTime anchor %s', (sample) => {
    expectParsesAs(sample, 'anchor')
  })

  test.each([
    'H+1',
    'Mi-30',
    'S+45',
    'Ms-250',
  ])('parses extended relative %s', (sample) => {
    expectParsesAs(sample, 'relative')
  })

  test.each([
    'H*',
    'H*-Mi[0>30]*',
    '[H9>H17]-Mi*',
  ])('parses JustTime cycle %s', (sample) => {
    expectParsesAs(sample, 'cycle')
  })

  test.each([
    [
      'H14-S45-Mi30',
      /Wrong order: "minute" cannot follow "second"/,
    ]
  ])('rejects invalid extended order %s', (sample, message) => {
    expect(() => parse(sample)).toThrow(message)
  })
})
