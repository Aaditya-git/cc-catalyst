import { Command } from 'commander'
import { spawn } from 'child_process'
import fs from 'fs'
import path from 'path'
import os from 'os'
import chalk from 'chalk'

const DATA_DIR = path.join(os.homedir(), '.cc-catalyst')
const PID_FILE = path.join(DATA_DIR, 'proxy.pid')
const LOG_FILE = path.join(DATA_DIR, 'proxy.log')
const PORT = 3131

function isRunning(pid: number): boolean {
  try { process.kill(pid, 0); return true } catch { return false }
}

function readPid(): number | null {
  if (!fs.existsSync(PID_FILE)) return null
  try {
    const pid = parseInt(fs.readFileSync(PID_FILE, 'utf8').trim(), 10)
    return isNaN(pid) ? null : pid
  } catch { return null }
}

export const proxyCommand = new Command('proxy')
  .description('Manage the cc-catalyst local proxy server')

proxyCommand
  .command('start')
  .description('Start the proxy on port 3131')
  .action(() => {
    const existing = readPid()
    if (existing && isRunning(existing)) {
      console.log(chalk.yellow(`Proxy already running (PID ${existing})`))
      return
    }

    fs.mkdirSync(DATA_DIR, { recursive: true })
    const serverPath = path.join(__dirname, '../../proxy/server.js')

    if (!fs.existsSync(serverPath)) {
      console.error(chalk.red('Proxy server not found. Run: npm run build'))
      process.exit(1)
    }

    const logFd = fs.openSync(LOG_FILE, 'a')
    const child = spawn(process.execPath, [serverPath], {
      detached: true,
      stdio: ['ignore', logFd, logFd],
    })
    child.unref()

    fs.writeFileSync(PID_FILE, String(child.pid))

    console.log(chalk.green(`\nProxy started on port ${PORT} (PID ${child.pid})`))

    const currentBase = process.env.ANTHROPIC_BASE_URL
    if (currentBase !== `http://localhost:${PORT}`) {
      console.log(chalk.bold('\nOne-time setup — add to your shell profile (~/.zshrc or ~/.bashrc):'))
      console.log(chalk.cyan(`\n  export ANTHROPIC_BASE_URL=http://localhost:${PORT}\n`))
      console.log(chalk.dim('Then restart your terminal and Claude Code.'))
    }

    console.log(chalk.dim(`Logs: ${LOG_FILE}`))
  })

proxyCommand
  .command('stop')
  .description('Stop the proxy server')
  .action(() => {
    const pid = readPid()
    if (!pid || !isRunning(pid)) {
      console.log(chalk.dim('Proxy is not running'))
      if (fs.existsSync(PID_FILE)) fs.unlinkSync(PID_FILE)
      return
    }
    process.kill(pid, 'SIGTERM')
    if (fs.existsSync(PID_FILE)) fs.unlinkSync(PID_FILE)
    console.log(chalk.green(`Proxy stopped (PID ${pid})`))
  })

proxyCommand
  .command('status')
  .description('Show proxy status')
  .action(() => {
    const pid = readPid()
    if (!pid || !isRunning(pid)) {
      console.log(chalk.dim('\nProxy: not running'))
      console.log(chalk.dim(`Start with: npx cc-catalyst proxy start\n`))
      return
    }
    console.log(chalk.green(`\nProxy: running on port ${PORT} (PID ${pid})`))
    if (fs.existsSync(LOG_FILE)) {
      const lines = fs.readFileSync(LOG_FILE, 'utf8').trim().split('\n').slice(-5)
      console.log(chalk.dim('\nRecent activity:'))
      lines.forEach(l => console.log(chalk.dim('  ' + l)))
    }
    console.log()
  })
