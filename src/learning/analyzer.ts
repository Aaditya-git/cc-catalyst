import type { ToolCallLog } from '../types'

export function analyzePatterns(
  logs: ToolCallLog[],
  minSessions = 3
): { neverUsed: string[]; alwaysUsed: string[]; sessionCount: number } {
  const sessions = new Set(logs.map(l => l.sessionId))
  const sessionCount = sessions.size

  if (sessionCount < minSessions) {
    return { neverUsed: [], alwaysUsed: [], sessionCount }
  }

  const toolSessions = new Map<string, Set<string>>()
  for (const log of logs) {
    if (!toolSessions.has(log.tool)) toolSessions.set(log.tool, new Set())
    toolSessions.get(log.tool)!.add(log.sessionId)
  }

  const neverUsed: string[] = []
  const alwaysUsed: string[] = []

  for (const [tool, usedIn] of toolSessions) {
    const ratio = usedIn.size / sessionCount
    if (ratio === 0) neverUsed.push(tool)
    if (ratio >= 0.9) alwaysUsed.push(tool)
  }

  return { neverUsed, alwaysUsed, sessionCount }
}
