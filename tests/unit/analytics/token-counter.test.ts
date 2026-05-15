import { estimateTokens, CHARS_PER_TOKEN } from '../../../src/analytics/token-counter'

describe('estimateTokens', () => {
  it('returns 0 for empty string', () => {
    expect(estimateTokens('')).toBe(0)
  })

  it('estimates tokens as ceil(chars / CHARS_PER_TOKEN)', () => {
    const text = 'a'.repeat(100)
    expect(estimateTokens(text)).toBe(Math.ceil(100 / CHARS_PER_TOKEN))
  })

  it('rounds up for partial tokens', () => {
    expect(estimateTokens('abc')).toBe(1) // 3 chars / 4 = 0.75 → ceil = 1
  })
})
