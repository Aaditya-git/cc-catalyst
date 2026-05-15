import fs from 'fs'

export interface UsageResult {
  inputTokens: number
  outputTokens: number
  model: string
}

export function readLatestUsage(transcriptPath: string): UsageResult | null {
  if (!fs.existsSync(transcriptPath)) return null
  const lines = fs.readFileSync(transcriptPath, 'utf8').trim().split('\n').filter(Boolean)
  for (let i = lines.length - 1; i >= 0; i--) {
    try {
      const obj = JSON.parse(lines[i]) as { message?: { role?: string; model?: string; usage?: Record<string, number> } }
      const msg = obj?.message
      if (msg?.role !== 'assistant' || !msg?.usage) continue
      const u = msg.usage
      return {
        inputTokens: (u.input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0),
        outputTokens: u.output_tokens ?? 0,
        model: msg.model ?? 'unknown',
      }
    } catch { /* skip malformed lines */ }
  }
  return null
}

export function readAllToolCalls(transcriptPath: string): string[] {
  if (!fs.existsSync(transcriptPath)) return []
  const tools: string[] = []
  const lines = fs.readFileSync(transcriptPath, 'utf8').trim().split('\n').filter(Boolean)
  for (const line of lines) {
    try {
      const obj = JSON.parse(line) as { message?: { content?: Array<{ type: string; name?: string }> } }
      const content = obj?.message?.content
      if (!Array.isArray(content)) continue
      for (const block of content) {
        if (block?.type === 'tool_use' && block?.name) tools.push(block.name)
      }
    } catch { /* skip */ }
  }
  return tools
}
