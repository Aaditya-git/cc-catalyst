import { createOptimizer } from '../../../src/catalyst/optimizer'
import { AnthropicRequest, UserProfile } from '../../../src/types'

const emptyProfile: UserProfile = { toolUsageByTaskType: {} }

const makeRequest = (): AnthropicRequest => ({
  model: 'claude-opus-4-7',
  max_tokens: 1024,
  system: 'You are helpful.\nYou are helpful.',
  tools: [
    { name: 'Read', description: 'Read files', input_schema: {} },
    { name: 'WebFetch', description: 'Fetch URLs', input_schema: {} },
    { name: 'Agent', description: 'Spawn agents', input_schema: {} }
  ],
  messages: [{ role: 'user', content: 'fix the bug in auth.ts' }]
})

describe('optimizer', () => {
  it('returns a leaner request than the original', () => {
    const optimizer = createOptimizer(() => emptyProfile)
    const original = makeRequest()
    const result = optimizer.optimize(original)
    expect(JSON.stringify(result).length).toBeLessThan(JSON.stringify(original).length)
  })

  it('prunes WebFetch and Agent for file_editing tasks', () => {
    const optimizer = createOptimizer(() => emptyProfile)
    const result = optimizer.optimize(makeRequest())
    const toolNames = result.tools!.map(t => t.name)
    expect(toolNames).not.toContain('WebFetch')
    expect(toolNames).not.toContain('Agent')
  })

  it('deduplicates system prompt lines', () => {
    const optimizer = createOptimizer(() => emptyProfile)
    const result = optimizer.optimize(makeRequest())
    expect(result.system).toBe('You are helpful.')
  })

  it('preserves the original model and max_tokens', () => {
    const optimizer = createOptimizer(() => emptyProfile)
    const result = optimizer.optimize(makeRequest())
    expect(result.model).toBe('claude-opus-4-7')
    expect(result.max_tokens).toBe(1024)
  })

  it('does not mutate the original request', () => {
    const optimizer = createOptimizer(() => emptyProfile)
    const original = makeRequest()
    const snapshot = JSON.stringify(original)
    optimizer.optimize(original)
    expect(JSON.stringify(original)).toBe(snapshot)
  })
})
