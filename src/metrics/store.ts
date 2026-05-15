import fs from 'fs'
import path from 'path'
import os from 'os'

export interface TokenSummary {
  requests: number
  totalRealOptimized: number
  savedTokens: number
  reductionPercent: number
}

const METRICS_FILE = path.join(os.homedir(), '.cc-catalyst', 'metrics.jsonl')

export function readSummary(sinceTime?: number): TokenSummary {
  if (!fs.existsSync(METRICS_FILE)) {
    return {
      requests: 0,
      totalRealOptimized: 0,
      savedTokens: 0,
      reductionPercent: 0,
    }
  }

  let requests = 0
  let totalRealOptimized = 0
  let totalEstimatedUnoptimized = 0

  const lines = fs.readFileSync(METRICS_FILE, 'utf8').trim().split('\n').filter(Boolean)
  for (const line of lines) {
    try {
      const entry = JSON.parse(line) as {
        timestamp?: string
        real?: number
        estimated?: number
      }

      if (sinceTime && entry.timestamp) {
        const time = new Date(entry.timestamp).getTime()
        if (time < sinceTime) continue
      }

      requests++
      totalRealOptimized += entry.real ?? 0
      totalEstimatedUnoptimized += entry.estimated ?? 0
    } catch {
      /* skip */
    }
  }

  const savedTokens = Math.max(0, totalEstimatedUnoptimized - totalRealOptimized)
  const reductionPercent =
    totalEstimatedUnoptimized > 0
      ? Math.round((savedTokens / totalEstimatedUnoptimized) * 100)
      : 0

  return {
    requests,
    totalRealOptimized,
    savedTokens,
    reductionPercent,
  }
}
