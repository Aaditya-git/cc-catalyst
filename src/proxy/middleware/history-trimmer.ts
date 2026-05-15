interface Message {
  role: string
  content: unknown
}

export interface TrimResult {
  body: unknown
  removed: number
  tokensSaved: number
}

export function trimHistory(body: unknown, maxTurns: number): TrimResult {
  const b = body as Record<string, unknown>
  if (!Array.isArray(b.messages)) {
    return { body, removed: 0, tokensSaved: 0 }
  }

  const messages = b.messages as Message[]
  if (messages.length <= maxTurns) {
    return { body, removed: 0, tokensSaved: 0 }
  }

  let trimmed = messages.slice(-maxTurns)

  // Anthropic requires messages to start with a user turn
  const firstUserIdx = trimmed.findIndex(m => m.role === 'user')
  if (firstUserIdx === -1) {
    // No user message in trimmed window — don't trim, return original
    return { body, removed: 0, tokensSaved: 0 }
  }
  if (firstUserIdx > 0) trimmed = trimmed.slice(firstUserIdx)

  const removed = messages.length - trimmed.length

  return {
    body: { ...b, messages: trimmed },
    removed,
    tokensSaved: removed * 500,
  }
}
