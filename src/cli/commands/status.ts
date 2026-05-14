import { Command } from 'commander'
import fs from 'fs'
import path from 'path'
import os from 'os'
import chalk from 'chalk'

export const statusCommand = new Command('status')
  .description('Show proxy status and configuration')
  .action(() => {
    const pidFile = path.join(os.homedir(), '.cc-catalyst', 'proxy.pid')
    const isRunning = fs.existsSync(pidFile) && isProcessAlive(pidFile)

    console.log(chalk.bold('\ncc-catalyst Status\n'))
    console.log(`  Proxy:       ${isRunning
      ? chalk.green('● running on http://127.0.0.1:8080')
      : chalk.red('✕ not running  →  run: cc-catalyst init')}`)

    const settingsPath = path.join(os.homedir(), '.claude', 'settings.json')
    const patched = isSettingsPatched(settingsPath)
    console.log(`  Claude Code: ${patched
      ? chalk.green('✓ routed through cc-catalyst')
      : chalk.red('✕ not configured')}`)
    console.log()
  })

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
    return s.env?.ANTHROPIC_BASE_URL === 'http://127.0.0.1:8080'
  } catch {
    return false
  }
}
