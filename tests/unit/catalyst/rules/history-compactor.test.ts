import { applyHistoryCompactor } from '../../../../src/catalyst/rules/history-compactor'
import { AnthropicRequest, Message } from '../../../../src/types'

const makeMessages = (count: number): Message[] =>
  Array.from({ length: count }, (_, i) => ({
    role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
    content: `message ${i}`
  }))

const makeRequest = (messageCount: number): AnthropicRequest => ({
  model: 'claude-opus-4-7',
  max_tokens: 1024,
  messages: makeMessages(messageCount)
})

describe('applyHistoryCompactor', () => {
  it('compacts history when shouldCompactHistory is true and messages > 6', () => {
    const request = makeRequest(10)
    const result = applyHistoryCompactor(request, { shouldCompactHistory: true })
    expect(result.messages.length).toBeLessThan(10)
  })

  it('keeps the most recent 6 messages intact after compaction', () => {
    const request = makeRequest(10)
    const result = applyHistoryCompactor(request, { shouldCompactHistory: true })
    const recent = request.messages.slice(-6)
    const resultRecent = result.messages.slice(-6)
    expect(resultRecent).toEqual(recent)
  })

  it('does not compact when shouldCompactHistory is false', () => {
    const request = makeRequest(10)
    const result = applyHistoryCompactor(request, { shouldCompactHistory: false })
    expect(result.messages.length).toBe(10)
  })

  it('does not compact when messages are 6 or fewer', () => {
    const request = makeRequest(6)
    const result = applyHistoryCompactor(request, { shouldCompactHistory: true })
    expect(result.messages.length).toBe(6)
  })

  it('adds a summary message at the start when compacting', () => {
    const request = makeRequest(10)
    const result = applyHistoryCompactor(request, { shouldCompactHistory: true })
    const first = result.messages[0]
    expect(typeof first.content).toBe('string')
    expect(first.content as string).toContain('[cc-catalyst:')
  })

  it('is a pure function — does not mutate input', () => {
    const request = makeRequest(10)
    const original = JSON.stringify(request)
    applyHistoryCompactor(request, { shouldCompactHistory: true })
    expect(JSON.stringify(request)).toBe(original)
  })
})
