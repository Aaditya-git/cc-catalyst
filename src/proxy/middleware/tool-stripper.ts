interface Tool {
  name: string
  description?: string
  input_schema?: unknown
}

export interface StripResult {
  body: unknown
  removed: string[]
  tokensSaved: number
}

export function stripTools(body: unknown, neverUsed: string[]): StripResult {
  const b = body as Record<string, unknown>
  if (!Array.isArray(b.tools) || b.tools.length === 0 || neverUsed.length === 0) {
    return { body, removed: [], tokensSaved: 0 }
  }

  const removed: string[] = []
  const filtered = (b.tools as Tool[]).filter(tool => {
    if (neverUsed.includes(tool.name)) {
      removed.push(tool.name)
      return false
    }
    return true
  })

  if (removed.length === 0) return { body, removed: [], tokensSaved: 0 }

  return {
    body: { ...b, tools: filtered },
    removed,
    tokensSaved: removed.length * 80,
  }
}
