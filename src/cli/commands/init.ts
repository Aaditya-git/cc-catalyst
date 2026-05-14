import { Command } from 'commander'
import { spawn } from 'child_process'
import http from 'http'
import fs from 'fs'
import path from 'path'
import os from 'os'
import chalk from 'chalk'

const PROXY_PORT = parseInt(process.env.CC_CATALYST_PORT ?? '8080', 10)
const HEALTH_TIMEOUT_MS = 5000
const HEALTH_POLL_MS = 200

export const initCommand = new Command('init')
  .description('Install cc-catalyst proxy into Claude Code')
  .action(async () => {
    console.log(chalk.cyan('\nInstalling cc-catalyst...\n'))

    startProxyDaemon()
    console.log(chalk.green('✓ Proxy daemon started'))

    process.stdout.write('  Waiting for proxy to be ready...')
    const ready = await waitForProxy()
    if (!ready) {
      console.log(chalk.red('\n✗ Proxy failed to start. Check ~/.cc-catalyst/proxy.log for details.'))
      process.exit(1)
    }
    console.log(chalk.green(' ready'))

    patchClaudeCodeSettings()
    console.log(chalk.green(`✓ Patched Claude Code settings (ANTHROPIC_BASE_URL=http://127.0.0.1:${PROXY_PORT})`))

    console.log(chalk.bold('\ncc-catalyst is active. Run: cc-catalyst status\n'))
  })

function patchClaudeCodeSettings(): void {
  const settingsPath = path.join(os.homedir(), '.claude', 'settings.json')
  const settings = fs.existsSync(settingsPath)
    ? JSON.parse(fs.readFileSync(settingsPath, 'utf-8'))
    : {}

  settings.env = settings.env ?? {}
  settings.env.ANTHROPIC_BASE_URL = `http://127.0.0.1:${PROXY_PORT}`

  fs.mkdirSync(path.dirname(settingsPath), { recursive: true })
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2))
}

function startProxyDaemon(): void {
  const logDir = path.join(os.homedir(), '.cc-catalyst')
  fs.mkdirSync(logDir, { recursive: true })

  const watchdogScript = path.join(__dirname, '../../proxy/watchdog.js')
  const logFile = path.join(logDir, 'proxy.log')
  const out = fs.openSync(logFile, 'a')

  const child = spawn(process.execPath, [watchdogScript], {
    detached: true,
    stdio: ['ignore', out, out]
  })

  child.unref()
  fs.writeFileSync(path.join(logDir, 'proxy.pid'), String(child.pid))
}

function waitForProxy(): Promise<boolean> {
  return new Promise(resolve => {
    const deadline = Date.now() + HEALTH_TIMEOUT_MS

    function poll(): void {
      const req = http.request(
        { hostname: '127.0.0.1', port: PROXY_PORT, path: '/health', method: 'GET', timeout: 500 },
        res => { resolve(res.statusCode === 200) }
      )
      req.on('error', () => {
        if (Date.now() >= deadline) return resolve(false)
        setTimeout(poll, HEALTH_POLL_MS)
      })
      req.end()
    }

    poll()
  })
}
