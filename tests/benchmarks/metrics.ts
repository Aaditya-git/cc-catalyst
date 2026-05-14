export interface BenchmarkResult {
  sessionFile: string
  originalBytes: number
  optimizedBytes: number
  reductionPercent: number
  taskType: string
}

export interface BenchmarkSummary {
  totalSessions: number
  avgReductionPercent: number
  minReductionPercent: number
  maxReductionPercent: number
  passedQualityGate: boolean
}

export function computeSummary(results: BenchmarkResult[]): BenchmarkSummary {
  if (results.length === 0) {
    return {
      totalSessions: 0,
      avgReductionPercent: 0,
      minReductionPercent: 0,
      maxReductionPercent: 0,
      passedQualityGate: false
    }
  }

  const reductions = results.map(r => r.reductionPercent)
  const avg = reductions.reduce((a, b) => a + b, 0) / reductions.length

  return {
    totalSessions: results.length,
    avgReductionPercent: Math.round(avg * 10) / 10,
    minReductionPercent: Math.min(...reductions),
    maxReductionPercent: Math.max(...reductions),
    passedQualityGate: avg >= 20
  }
}
