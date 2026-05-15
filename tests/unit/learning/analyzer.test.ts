import { analyzePatterns } from '../../../src/learning/analyzer'
import type { ToolCallLog } from '../../../src/types'

function logs(tool: string, sessions: string[]): ToolCallLog[] {
  return sessions.map(sessionId => ({ tool, sessionId, timestamp: new Date().toISOString() }))
}

describe('analyzePatterns', () => {
  it('returns empty results when fewer than minSessions', () => {
    const result = analyzePatterns(logs('Read', ['s1', 's2']), 3)
    expect(result.neverUsed).toEqual([])
    expect(result.alwaysUsed).toEqual([])
    expect(result.sessionCount).toBe(2)
  })

  it('marks tools used in all sessions as alwaysUsed', () => {
    const allSessions = ['s1', 's2', 's3', 's4', 's5']
    const result = analyzePatterns(logs('Read', allSessions), 3)
    expect(result.alwaysUsed).toContain('Read')
  })

  it('marks tools used in only some sessions as neither', () => {
    const allSessions = ['s1', 's2', 's3', 's4', 's5']
    const mixed = [
      ...logs('Read', allSessions),
      ...logs('WebSearch', ['s1']),
    ]
    const result = analyzePatterns(mixed, 3)
    expect(result.neverUsed).not.toContain('Read')
    expect(result.alwaysUsed).toContain('Read')
    // WebSearch only in 1/5 sessions = 20%, not always
    expect(result.alwaysUsed).not.toContain('WebSearch')
  })

  it('counts unique sessions correctly', () => {
    // Same session appears multiple times (multiple tool calls in one session)
    const mixed = [
      ...logs('Read', ['s1', 's1', 's2']),
    ]
    const result = analyzePatterns(mixed, 1)
    expect(result.sessionCount).toBe(2)
  })
})
