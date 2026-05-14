import { AnthropicRequest, CatalystPlan } from '../../src/types'

describe('types', () => {
  it('AnthropicRequest accepts string system prompt', () => {
    const req: AnthropicRequest = {
      model: 'claude-opus-4-7',
      max_tokens: 1024,
      system: 'You are helpful.',
      messages: [{ role: 'user', content: 'hello' }]
    }
    expect(req.model).toBe('claude-opus-4-7')
  })

  it('CatalystPlan has all required fields', () => {
    const plan: CatalystPlan = {
      taskType: 'file_editing',
      toolsToKeep: ['Read', 'Edit'],
      shouldCompressPrompt: true,
      shouldCompactHistory: false,
      outputTruncationLimit: 150
    }
    expect(plan.toolsToKeep).toHaveLength(2)
  })
})
