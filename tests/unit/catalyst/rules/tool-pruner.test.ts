import { applyToolPruner } from '../../../../src/catalyst/rules/tool-pruner'
import { AnthropicRequest, CatalystPlan } from '../../../../src/types'

const makePlan = (overrides: Partial<CatalystPlan> = {}): CatalystPlan => ({
  taskType: 'file_editing',
  toolsToKeep: ['Read', 'Edit', 'Write', 'Bash', 'Glob', 'Grep'],
  shouldCompressPrompt: false,
  shouldCompactHistory: false,
  outputTruncationLimit: 150,
  ...overrides
})

const makeRequest = (toolNames: string[]): AnthropicRequest => ({
  model: 'claude-opus-4-7',
  max_tokens: 1024,
  messages: [{ role: 'user', content: 'fix the bug' }],
  tools: toolNames.map(name => ({
    name,
    description: `${name} tool`,
    input_schema: { type: 'object', properties: {} }
  }))
})

describe('applyToolPruner', () => {
  it('removes tools not in toolsToKeep for file_editing', () => {
    const request = makeRequest(['Read', 'Edit', 'WebFetch', 'Agent', 'Bash'])
    const result = applyToolPruner(request, makePlan())
    const names = result.tools!.map((t: { name: string }) => t.name)
    expect(names).toContain('Read')
    expect(names).toContain('Edit')
    expect(names).toContain('Bash')
    expect(names).not.toContain('WebFetch')
    expect(names).not.toContain('Agent')
  })

  it('keeps all tools when taskType is general', () => {
    const request = makeRequest(['Read', 'Edit', 'WebFetch', 'Agent'])
    const result = applyToolPruner(request, makePlan({ taskType: 'general', toolsToKeep: [] }))
    expect(result.tools).toHaveLength(4)
  })

  it('returns original request unchanged when no tools present', () => {
    const request: AnthropicRequest = {
      model: 'claude-opus-4-7',
      max_tokens: 1024,
      messages: [{ role: 'user', content: 'hello' }]
    }
    const result = applyToolPruner(request, makePlan())
    expect(result.tools).toBeUndefined()
  })

  it('never returns empty tools array — safety net', () => {
    const request = makeRequest(['SomeUnknownTool'])
    const result = applyToolPruner(request, makePlan())
    expect(result.tools!.length).toBeGreaterThan(0)
  })

  it('is a pure function — does not mutate input', () => {
    const request = makeRequest(['Read', 'WebFetch', 'Agent'])
    const original = JSON.stringify(request)
    applyToolPruner(request, makePlan())
    expect(JSON.stringify(request)).toBe(original)
  })
})
