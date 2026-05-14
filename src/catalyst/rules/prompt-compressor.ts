import { AnthropicRequest } from '../../types'

export function applyPromptCompressor(
  request: AnthropicRequest,
  plan: { shouldCompressPrompt: boolean }
): AnthropicRequest {
  if (!plan.shouldCompressPrompt) return request
  if (!request.system || typeof request.system !== 'string') return request

  const compressed = deduplicateLines(request.system)
  return { ...request, system: compressed }
}

function deduplicateLines(text: string): string {
  const lines = text.split('\n')
  const deduped: string[] = []

  for (let i = 0; i < lines.length; i++) {
    if (i === 0 || lines[i] !== lines[i - 1]) {
      deduped.push(lines[i])
    }
  }

  return deduped.join('\n')
}
