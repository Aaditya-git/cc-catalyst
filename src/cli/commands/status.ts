import { Command } from 'commander'
import fs from 'fs'
import path from 'path'
import os from 'os'
import chalk from 'chalk'
import type { SessionHealth, LearnedPatterns } from '../../types'
import { readLearned } from '../../learning/store'

const DATA_DIR = path.join(os.homedir(), '.cc-catalyst')

function projectHash(dir: string): string {
  return dir.replace(/\//g, '-')
}

export const statusCommand = new Command('status')
  .description('Show session health and learned patterns for this project')
  .action(() => {
    console.log(chalk.bold('\ncc-catalyst Status\n'))

    const healthPath = path.join(DATA_DIR, 'session-health.json')
    if (fs.existsSync(healthPath)) {
      const health = JSON.parse(fs.readFileSync(healthPath, 'utf8')) as SessionHealth
      const color = health.budgetPercent >= 85 ? chalk.red
        : health.budgetPercent >= 70 ? chalk.yellow
        : chalk.green
      console.log('Session Health:')
      console.log(`  Budget:  ${color(health.budgetPercent + '%')} (${health.inputTokens.toLocaleString()} / ${health.contextLimit.toLocaleString()} tokens)`)
      console.log(`  Model:   ${health.model}`)
      console.log(`  Updated: ${new Date(health.updatedAt).toLocaleString()}\n`)
    } else {
      console.log(chalk.dim('Session Health: no data yet (starts after first Claude response)\n'))
    }

    const hash = projectHash(process.cwd())
    const learned = readLearned(hash)
    if (learned) {
      console.log('Learned Patterns (' + learned.sessionCount + ' sessions):')
      if (learned.alwaysUsed.length > 0)
        console.log('  Always used: ' + chalk.green(learned.alwaysUsed.join(', ')))
      if (learned.neverUsed.length > 0)
        console.log('  Suppressed:  ' + chalk.yellow(learned.neverUsed.join(', ')))
      console.log(`  Updated: ${new Date(learned.updatedAt).toLocaleString()}\n`)
    } else {
      console.log(chalk.dim('Learned Patterns: no data yet (needs 3+ sessions)\n'))
    }
  })
