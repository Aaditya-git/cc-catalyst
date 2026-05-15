import { trimHistory } from '../../../src/proxy/middleware/history-trimmer'

function makeMessages(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    role: i % 2 === 0 ? 'user' : 'assistant',
    content: `message ${i}`,
  }))
}

describe('trimHistory', () => {
  it('does not trim when messages <= maxTurns', () => {
    const body = { messages: makeMessages(10) }
    const result = trimHistory(body, 20)
    expect(result.removed).toBe(0)
    expect((result.body as typeof body).messages).toHaveLength(10)
  })

  it('trims to last maxTurns messages', () => {
    const body = { messages: makeMessages(30) }
    const result = trimHistory(body, 20)
    expect((result.body as typeof body).messages.length).toBeLessThanOrEqual(20)
    expect(result.removed).toBeGreaterThan(0)
  })

  it('ensures first message after trim is a user message', () => {
    const messages = [
      { role: 'user', content: 'first' },
      { role: 'assistant', content: 'reply' },
      { role: 'user', content: 'second' },
      { role: 'assistant', content: 'reply2' },
      { role: 'user', content: 'third' },
    ]
    const body = { messages }
    // trim to 2: slice(-2) = [assistant reply2, user third] — starts with assistant, bad
    // so we should skip the leading assistant and give [user third]
    const result = trimHistory(body, 2)
    const msgs = (result.body as typeof body).messages
    expect(msgs[0].role).toBe('user')
  })

  it('reports tokensSaved as removed * 500', () => {
    const body = { messages: makeMessages(25) }
    const result = trimHistory(body, 20)
    expect(result.tokensSaved).toBe(result.removed * 500)
  })

  it('returns original body when no messages array', () => {
    const body = { model: 'test' }
    const result = trimHistory(body, 20)
    expect(result.body).toBe(body)
    expect(result.removed).toBe(0)
  })

  it('does not trim when trimmed window has no user messages', () => {
    const body = {
      messages: [
        { role: 'user', content: 'start' },
        { role: 'assistant', content: 'a1' },
        { role: 'assistant', content: 'a2' },
      ],
    }
    // trim to 2: slice(-2) = [assistant a1, assistant a2] — no user found, should not trim
    const result = trimHistory(body, 2)
    expect(result.removed).toBe(0)
    expect((result.body as typeof body).messages).toHaveLength(3)
  })
})
