import fs from 'fs'
import path from 'path'
import os from 'os'

const METRICS_PATH = path.join(os.homedir(), '.cc-catalyst', 'metrics.jsonl')

export interface RequestMetric {
  ts: number
  model: string
  estimatedOriginal: number
  realOptimized: number
}

export interface MetricsSummary {
  requests: number
  totalRealOptimized: number
  totalEstimatedOriginal: number
  savedTokens: number
  reductionPercent: number
}

export function appendMetric(metric: RequestMetric): void {
  fs.mkdirSync(path.dirname(METRICS_PATH), { recursive: true })
  fs.appendFileSync(METRICS_PATH, JSON.stringify(metric) + '\n')
}

function readMetrics(): RequestMetric[] {
  try {
    return fs
      .readFileSync(METRICS_PATH, 'utf-8')
      .split('\n')
      .filter(Boolean)
      .map(line => JSON.parse(line) as RequestMetric)
  } catch {
    return []
  }
}

export function readSummary(sinceMs?: number): MetricsSummary {
  const all = readMetrics()
  const rows = sinceMs ? all.filter(r => r.ts >= sinceMs) : all

  const requests = rows.length
  const totalRealOptimized = rows.reduce((s, r) => s + r.realOptimized, 0)
  const totalEstimatedOriginal = rows.reduce((s, r) => s + r.estimatedOriginal, 0)
  const savedTokens = totalEstimatedOriginal - totalRealOptimized
  const reductionPercent =
    totalEstimatedOriginal > 0
      ? Math.round((savedTokens / totalEstimatedOriginal) * 100)
      : 0

  return { requests, totalRealOptimized, totalEstimatedOriginal, savedTokens, reductionPercent }
}
