import { applyPromptCompressor } from '../../../../src/catalyst/rules/prompt-compressor'
import { AnthropicRequest } from '../../../../src/types'

const makeRequest = (system?: string): AnthropicRequest => ({
  model: 'claude-opus-4-7',
  max_tokens: 1024,
  system,
  messages: [{ role: 'user', content: 'hello' }]
})

describe('applyPromptCompressor', () => {
  it('removes duplicate consecutive lines from system prompt', () => {
    const system = 'Line A\nLine A\nLine B\nLine B\nLine B\nLine C'
    const result = applyPromptCompressor(makeRequest(system), { shouldCompressPrompt: true })
    expect(result.system).toBe('Line A\nLine B\nLine C')
  })

  it('returns request unchanged when shouldCompressPrompt is false', () => {
    const system = 'Line A\nLine A\nLine B'
    const result = applyPromptCompressor(makeRequest(system), { shouldCompressPrompt: false })
    expect(result.system).toBe(system)
  })

  it('returns request unchanged when system is undefined', () => {
    const request = makeRequest(undefined)
    const result = applyPromptCompressor(request, { shouldCompressPrompt: true })
    expect(result.system).toBeUndefined()
  })

  it('preserves unique lines unchanged', () => {
    const system = 'Line A\nLine B\nLine C'
    const result = applyPromptCompressor(makeRequest(system), { shouldCompressPrompt: true })
    expect(result.system).toBe(system)
  })

  it('is a pure function — does not mutate input', () => {
    const request = makeRequest('Line A\nLine A\nLine B')
    const original = JSON.stringify(request)
    applyPromptCompressor(request, { shouldCompressPrompt: true })
    expect(JSON.stringify(request)).toBe(original)
  })
})
