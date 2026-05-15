import type { AuditResult } from '../types'

type BreakdownInput = Omit<AuditResult, 'total' | 'recommendations'>

const LABELS: Record<keyof BreakdownInput, string> = {
  globalClaudeMd: 'Global CLAUDE.md',
  projectClaudeMd: 'Project CLAUDE.md',
  sessionHistory: 'Session history',
  mcpDescriptions: 'MCP tool descriptions',
}

const THRESHOLD = 500

export function buildBreakdown(parts: BreakdownInput): AuditResult {
  const total = Object.values(parts).reduce((a, b) => a + b, 0)

  const entries = Object.entries(parts) as [keyof BreakdownInput, number][]
  entries.sort((a, b) => b[1] - a[1])

  const recommendations: string[] = []
  for (const [key, tokens] of entries) {
    if (tokens > THRESHOLD) {
      recommendations.push(`${LABELS[key]} is ${tokens.toLocaleString()} tokens — consider reducing`)
    }
  }

  return { ...parts, total, recommendations }
}
