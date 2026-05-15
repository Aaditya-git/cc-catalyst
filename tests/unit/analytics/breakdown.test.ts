import { buildBreakdown } from '../../../src/analytics/breakdown'

describe('buildBreakdown', () => {
  it('sums all parts into total', () => {
    const result = buildBreakdown({
      globalClaudeMd: 1000,
      projectClaudeMd: 500,
      sessionHistory: 2000,
      mcpDescriptions: 300,
    })
    expect(result.total).toBe(3800)
  })

  it('generates recommendations for expensive components (>500 tokens)', () => {
    const result = buildBreakdown({
      globalClaudeMd: 2000,
      projectClaudeMd: 100,
      sessionHistory: 5000,
      mcpDescriptions: 0,
    })
    expect(result.recommendations.length).toBeGreaterThan(0)
    expect(result.recommendations.some(r => r.includes('CLAUDE.md'))).toBe(true)
  })

  it('returns no recommendations when all components are small', () => {
    const result = buildBreakdown({
      globalClaudeMd: 100,
      projectClaudeMd: 100,
      sessionHistory: 100,
      mcpDescriptions: 100,
    })
    expect(result.recommendations).toHaveLength(0)
  })

  it('sorts recommendations by cost descending', () => {
    const result = buildBreakdown({
      globalClaudeMd: 3000,
      projectClaudeMd: 100,
      sessionHistory: 8000,
      mcpDescriptions: 0,
    })
    const firstMentionsHistory = result.recommendations[0].includes('Session history')
    expect(firstMentionsHistory).toBe(true)
  })
})
