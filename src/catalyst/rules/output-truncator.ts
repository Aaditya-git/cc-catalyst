import { AnthropicRequest, CatalystPlan, ToolResultBlock } from '../../types'

export function applyOutputTruncator(
  request: AnthropicRequest,
  plan: CatalystPlan
): AnthropicRequest {
  const messages = request.messages.map(message => {
    if (message.role !== 'user') return message
    if (typeof message.content === 'string') return message

    const content = message.content.map(block =>
      block.type === 'tool_result'
        ? truncateToolResult(block as ToolResultBlock, plan.outputTruncationLimit)
        : block
    )

    return { ...message, content }
  })

  return { ...request, messages }
}

function truncateToolResult(block: ToolResultBlock, maxLines: number): ToolResultBlock {
  if (typeof block.content !== 'string') return block

  const lines = block.content.split('\n')
  if (lines.length <= maxLines) return block

  const truncated =
    lines.slice(0, maxLines).join('\n') +
    `\n[cc-catalyst: truncated ${lines.length - maxLines} lines to save tokens]`

  return { ...block, content: truncated }
}
