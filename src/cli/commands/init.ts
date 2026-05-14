import { Command } from 'commander'
import { spawn } from 'child_process'
import fs from 'fs'
import path from 'path'
import os from 'os'
import chalk from 'chalk'

export const initCommand = new Command('init')
  .description('Install cc-catalyst proxy into Claude Code')
  .action(() => {
    console.log(chalk.cyan('\nInstalling cc-catalyst...\n'))

    patchClaudeCodeSettings()
    console.log(chalk.green('✓ Patched Claude Code settings (ANTHROPIC_BASE_URL)'))

    startProxyDaemon()
    console.log(chalk.green('✓ Proxy daemon started on http://127.0.0.1:8080'))

    console.log(chalk.bold('\ncc-catalyst is active. Run: cc-catalyst status\n'))
  })

function patchClaudeCodeSettings(): void {
  const settingsPath = path.join(os.homedir(), '.claude', 'settings.json')
  const settings = fs.existsSync(settingsPath)
    ? JSON.parse(fs.readFileSync(settingsPath, 'utf-8'))
    : {}

  settings.env = settings.env ?? {}
  settings.env.ANTHROPIC_BASE_URL = 'http://127.0.0.1:8080'

  fs.mkdirSync(path.dirname(settingsPath), { recursive: true })
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2))
}

function startProxyDaemon(): void {
  const logDir = path.join(os.homedir(), '.cc-catalyst')
  fs.mkdirSync(logDir, { recursive: true })

  const proxyScript = path.join(__dirname, '../../proxy/server.js')
  const logFile = path.join(logDir, 'proxy.log')
  const out = fs.openSync(logFile, 'a')

  const child = spawn(process.execPath, [proxyScript], {
    detached: true,
    stdio: ['ignore', out, out]
  })

  child.unref()
  fs.writeFileSync(path.join(logDir, 'proxy.pid'), String(child.pid))
}
