import { describe, expect, it } from 'vitest'
import { parseTime } from './parseTime'

describe('parseTime', () => {
  it('accepts the usual ways of typing a time', () => {
    expect(parseTime('840')).toBe('08:40')
    expect(parseTime('0840')).toBe('08:40')
    expect(parseTime('8:40')).toBe('08:40')
    expect(parseTime('8.40')).toBe('08:40')
    expect(parseTime('13:30')).toBe('13:30')
    expect(parseTime('9')).toBe('09:00')
  })
  it('rejects nonsense', () => {
    expect(parseTime('25:00')).toBeNull()
    expect(parseTime('8:75')).toBeNull()
    expect(parseTime('abc')).toBeNull()
    expect(parseTime('')).toBeNull()
  })
})
