import { AnthropicRequest, Message, ToolUseBlock } from '../../types'

const RECENT_TURNS_TO_KEEP = 6

export function applyHistoryCompactor(
  request: AnthropicRequest,
  plan: { shouldCompactHistory: boolean }
): AnthropicRequest {
  if (!plan.shouldCompactHistory) return request
  if (request.messages.length <= RECENT_TURNS_TO_KEEP) return request

  const recent = request.messages.slice(-RECENT_TURNS_TO_KEEP)
  const older = request.messages.slice(0, -RECENT_TURNS_TO_KEEP)

  const summary = buildSummary(older)
  const summaryMessage: Message = {
    role: 'user',
    content: `[cc-catalyst: ${older.length} earlier messages compacted]\n${summary}`
  }

  return { ...request, messages: [summaryMessage, ...recent] }
}

function buildSummary(messages: Message[]): string {
  const actions: string[] = []

  for (const msg of messages) {
    if (msg.role !== 'assistant' || typeof msg.content === 'string') continue
    for (const block of msg.content) {
      if (block.type === 'tool_use') {
        const b = block as ToolUseBlock
        const inputSnippet = JSON.stringify(b.input).slice(0, 60)
        actions.push(`${b.name}(${inputSnippet})`)
      }
    }
  }

  if (actions.length === 0) return 'Earlier context from this session.'
  return `Tools called: ${actions.slice(-8).join(', ')}`
}
