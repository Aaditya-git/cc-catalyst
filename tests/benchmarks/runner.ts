import fs from 'fs'
import path from 'path'
import { buildOptimizedBody } from '../../src/proxy/interceptor'
import { computeSummary, BenchmarkResult } from './metrics'
import { UserProfile } from '../../src/types'

const SESSIONS_DIR = path.join(__dirname, 'sessions')
const emptyProfile: UserProfile = { toolUsageByTaskType: {} }

async function run(): Promise<void> {
  if (!fs.existsSync(SESSIONS_DIR)) {
    console.log('No benchmark sessions found. Add fixtures to tests/benchmarks/sessions/')
    process.exit(0)
  }

  const files = fs.readdirSync(SESSIONS_DIR).filter(f => f.endsWith('.json'))
  if (files.length === 0) {
    console.log('No .json fixtures found in tests/benchmarks/sessions/')
    process.exit(0)
  }

  const results: BenchmarkResult[] = []

  for (const file of files) {
    const raw = fs.readFileSync(path.join(SESSIONS_DIR, file), 'utf-8')
    const session = JSON.parse(raw)
    const optimized = buildOptimizedBody(session, emptyProfile)

    const originalBytes = Buffer.byteLength(raw)
    const optimizedBytes = Buffer.byteLength(JSON.stringify(optimized))
    const reductionPercent = ((originalBytes - optimizedBytes) / originalBytes) * 100

    results.push({
      sessionFile: file,
      originalBytes,
      optimizedBytes,
      reductionPercent: Math.round(reductionPercent * 10) / 10,
      taskType: session.messages?.[0]?.content?.slice(0, 40) ?? 'unknown'
    })
  }

  const summary = computeSummary(results)

  console.log('\n=== cc-catalyst Benchmark Results ===\n')
  for (const r of results) {
    const icon = r.reductionPercent >= 20 ? '✓' : '✗'
    console.log(`${icon} ${r.sessionFile}: ${r.reductionPercent}% reduction (${r.originalBytes} → ${r.optimizedBytes} bytes)`)
  }
  console.log(`\nSessions:          ${summary.totalSessions}`)
  console.log(`Avg reduction:     ${summary.avgReductionPercent}%`)
  console.log(`Min/Max:           ${summary.minReductionPercent}% / ${summary.maxReductionPercent}%`)
  console.log(`Quality gate ≥20%: ${summary.passedQualityGate ? 'PASSED ✓' : 'FAILED ✗'}`)

  if (!summary.passedQualityGate) process.exit(1)
}

run().catch(err => { console.error(err); process.exit(1) })
