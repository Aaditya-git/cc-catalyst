import { Command } from 'commander'
import fs from 'fs'
import path from 'path'
import os from 'os'
import chalk from 'chalk'
import { readSummary } from '../../metrics/store'

const MODEL_INPUT_COST_PER_MTOK: Record<string, number> = {
  'claude-opus-4-7': 15.0,
  'claude-opus-4-5': 15.0,
  'claude-sonnet-4-6': 3.0,
  'claude-sonnet-4-5': 3.0,
  'claude-haiku-4-5': 0.8,
}

export const statusCommand = new Command('status')
  .description('Show proxy status and token savings')
  .action(() => {
    const pidFile = path.join(os.homedir(), '.cc-catalyst', 'proxy.pid')
    const isRunning = fs.existsSync(pidFile) && isProcessAlive(pidFile)

    const settingsPath = path.join(os.homedir(), '.claude', 'settings.json')
    const patched = isSettingsPatched(settingsPath)

    console.log(chalk.bold('\ncc-catalyst Status\n'))
    console.log(`  Proxy:       ${isRunning
      ? chalk.green('● running on http://127.0.0.1:8080')
      : chalk.red('✕ not running  →  run: cc-catalyst init')}`)
    console.log(`  Claude Code: ${patched
      ? chalk.green('✓ routed through cc-catalyst')
      : chalk.red('✕ not configured')}`)

    const DAY_MS = 24 * 60 * 60 * 1000
    const last24h = readSummary(Date.now() - DAY_MS)
    const allTime = readSummary()

    if (allTime.requests === 0) {
      console.log(chalk.dim('\n  No requests proxied yet. Use Claude Code to see savings.\n'))
      return
    }

    console.log(chalk.bold('\n  Token Savings — last 24h'))
    console.log('  ' + '─'.repeat(44))
    printSummaryRows(last24h, null)

    console.log(chalk.bold('\n  All time'))
    console.log('  ' + '─'.repeat(44))
    const avgCostPerMtok = estimateAvgCost()
    printSummaryRows(allTime, avgCostPerMtok)

    console.log()
  })

function printSummaryRows(
  s: ReturnType<typeof readSummary>,
  costPerMtok: number | null
): void {
  if (s.requests === 0) {
    console.log(chalk.dim('  No requests in this period.'))
    return
  }
  console.log(`  Requests proxied:  ${fmt(s.requests)}`)
  console.log(`  Tokens billed:     ${fmt(s.totalRealOptimized)}  ${chalk.dim('(real, from Anthropic)')}`)
  console.log(`  Tokens saved:     ~${fmt(s.savedTokens)}  ${chalk.dim('(estimated vs. unproxied)')}`)
  console.log(`  Reduction:         ~${s.reductionPercent}%`)

  if (costPerMtok !== null && s.savedTokens > 0) {
    const saved = (s.savedTokens / 1_000_000) * costPerMtok
    console.log(`  Est. cost saved:   ~$${saved.toFixed(2)}`)
  }
}

function estimateAvgCost(): number {
  // default to Sonnet rate if we can't determine model breakdown
  const fallback = MODEL_INPUT_COST_PER_MTOK['claude-sonnet-4-6']
  return fallback
}

function fmt(n: number): string {
  return n.toLocaleString('en-US')
}

function isProcessAlive(pidFile: string): boolean {
  try {
    const pid = parseInt(fs.readFileSync(pidFile, 'utf-8'), 10)
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

function isSettingsPatched(settingsPath: string): boolean {
  try {
    const s = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'))
    return s.env?.ANTHROPIC_BASE_URL?.startsWith('http://127.0.0.1') === true
  } catch {
    return false
  }
}
