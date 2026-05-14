import { applyOutputTruncator } from '../../../../src/catalyst/rules/output-truncator'
import { AnthropicRequest, CatalystPlan } from '../../../../src/types'

const makePlan = (limit = 5): CatalystPlan => ({
  taskType: 'file_editing',
  toolsToKeep: [],
  shouldCompressPrompt: false,
  shouldCompactHistory: false,
  outputTruncationLimit: limit
})

const makeRequestWithToolResult = (content: string): AnthropicRequest => ({
  model: 'claude-opus-4-7',
  max_tokens: 1024,
  messages: [
    { role: 'user', content: 'fix bug' },
    {
      role: 'assistant',
      content: [{ type: 'tool_use', id: 'tu_1', name: 'Bash', input: { command: 'ls' } }]
    },
    {
      role: 'user',
      content: [{ type: 'tool_result', tool_use_id: 'tu_1', content }]
    }
  ]
})

describe('applyOutputTruncator', () => {
  it('truncates tool results exceeding the line limit', () => {
    const longOutput = Array.from({ length: 20 }, (_, i) => `line ${i}`).join('\n')
    const request = makeRequestWithToolResult(longOutput)
    const result = applyOutputTruncator(request, makePlan(5))

    const toolResult = (result.messages[2].content as Array<{ content: string }>)[0]
    const lines = toolResult.content.split('\n')
    expect(lines.length).toBeLessThanOrEqual(7)
    expect(toolResult.content).toContain('[cc-catalyst: truncated')
  })

  it('leaves tool results under the limit untouched', () => {
    const shortOutput = 'line1\nline2\nline3'
    const request = makeRequestWithToolResult(shortOutput)
    const result = applyOutputTruncator(request, makePlan(10))

    const toolResult = (result.messages[2].content as Array<{ content: string }>)[0]
    expect(toolResult.content).toBe(shortOutput)
  })

  it('does not modify assistant messages', () => {
    const request = makeRequestWithToolResult('line1\nline2')
    const result = applyOutputTruncator(request, makePlan(5))
    expect(result.messages[1].content).toEqual(request.messages[1].content)
  })

  it('is a pure function — does not mutate input', () => {
    const longOutput = Array.from({ length: 20 }, (_, i) => `line ${i}`).join('\n')
    const request = makeRequestWithToolResult(longOutput)
    const original = JSON.stringify(request)
    applyOutputTruncator(request, makePlan(5))
    expect(JSON.stringify(request)).toBe(original)
  })
})
