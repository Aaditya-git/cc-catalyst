import { buildOptimizedBody } from '../../../src/proxy/interceptor'
import { UserProfile } from '../../../src/types'

const emptyProfile: UserProfile = { toolUsageByTaskType: {} }

const makeBody = () => ({
  model: 'claude-opus-4-7',
  max_tokens: 1024,
  system: 'You are helpful.\nYou are helpful.',
  tools: [
    { name: 'Read', description: 'Read', input_schema: {} },
    { name: 'WebFetch', description: 'Fetch', input_schema: {} },
    { name: 'Agent', description: 'Agent', input_schema: {} }
  ],
  messages: [{ role: 'user' as const, content: 'fix the bug in auth.ts' }]
})

describe('buildOptimizedBody', () => {
  it('returns a valid JSON-serializable object', () => {
    const result = buildOptimizedBody(makeBody(), emptyProfile)
    expect(() => JSON.stringify(result)).not.toThrow()
  })

  it('reduces payload size for a file_editing request', () => {
    const body = makeBody()
    const result = buildOptimizedBody(body, emptyProfile)
    expect(JSON.stringify(result).length).toBeLessThan(JSON.stringify(body).length)
  })

  it('preserves required Anthropic API fields', () => {
    const result = buildOptimizedBody(makeBody(), emptyProfile)
    expect(result.model).toBeDefined()
    expect(result.max_tokens).toBeDefined()
    expect(result.messages).toBeDefined()
  })

  it('prunes Agent and WebFetch for file_editing task', () => {
    const result = buildOptimizedBody(makeBody(), emptyProfile)
    const names = result.tools!.map(t => t.name)
    expect(names).not.toContain('Agent')
    expect(names).not.toContain('WebFetch')
  })
})
