import { Command } from 'commander'
import fs from 'fs'
import path from 'path'
import os from 'os'
import chalk from 'chalk'

export const removeCommand = new Command('remove')
  .description('Uninstall cc-catalyst from Claude Code')
  .action(() => {
    removeProxyDaemon()
    console.log(chalk.green('✓ Proxy daemon stopped'))

    unpatchClaudeCodeSettings()
    console.log(chalk.green('✓ Restored Claude Code settings'))

    console.log(chalk.bold('\ncc-catalyst removed.\n'))
  })

function removeProxyDaemon(): void {
  const pidFile = path.join(os.homedir(), '.cc-catalyst', 'proxy.pid')
  if (!fs.existsSync(pidFile)) return

  const pid = parseInt(fs.readFileSync(pidFile, 'utf-8'), 10)
  try { process.kill(pid) } catch { /* already gone */ }
  fs.unlinkSync(pidFile)
}

function unpatchClaudeCodeSettings(): void {
  const settingsPath = path.join(os.homedir(), '.claude', 'settings.json')
  if (!fs.existsSync(settingsPath)) return

  const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'))
  if (settings.env?.ANTHROPIC_BASE_URL === 'http://127.0.0.1:8080') {
    delete settings.env.ANTHROPIC_BASE_URL
  }
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2))
}
