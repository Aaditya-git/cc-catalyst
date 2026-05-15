import { Command } from 'commander'
import { execFileSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import os from 'os'
import crypto from 'crypto'
import chalk from 'chalk'
import { readSettings } from '../../settings/reader'
import { removeHooks, validateHooks } from '../../settings/hooks'

const CLAUDE_DIR = path.join(os.homedir(), '.claude')
const DATA_DIR = path.join(os.homedir(), '.cc-catalyst')
const COMMANDS_DIR = path.join(CLAUDE_DIR, 'commands')
const SETTINGS_PATH = path.join(CLAUDE_DIR, 'settings.json')
const CLAUDE_MD_PATH = path.join(CLAUDE_DIR, 'CLAUDE.md')
const PID_FILE = path.join(DATA_DIR, 'proxy.pid')
const PROXY_PORT = 3131
const PROXY_ENV_LINE = `export ANTHROPIC_BASE_URL=http://localhost:${PROXY_PORT}`
const SHELL_PROFILES = ['.zshrc', '.bashrc', '.bash_profile'].map(f => path.join(os.homedir(), f))

function isRunning(pid: number): boolean {
  try { process.kill(pid, 0); return true } catch { return false }
}

function clearNpxCache(): void {
  const npxCacheDir = path.join(os.homedir(), '.npm', '_npx')
  if (!fs.existsSync(npxCacheDir)) return
  for (const entry of fs.readdirSync(npxCacheDir)) {
    const pkgJson = path.join(npxCacheDir, entry, 'package.json')
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgJson, 'utf8'))
      const deps = { ...pkg.dependencies, ...pkg.devDependencies }
      if ('cc-catalyst' in deps) fs.rmSync(path.join(npxCacheDir, entry), { recursive: true })
    } catch { /* not a valid package dir */ }
  }
}

function killByPort(port: number): boolean {
  try {
    const pid = execFileSync('lsof', ['-ti', `:${port}`], { encoding: 'utf8' }).trim()
    if (!pid) return false
    process.kill(parseInt(pid, 10), 'SIGTERM')
    return true
  } catch {
    return false
  }
}

export function removeClaudeMdBlock(content: string): string {
  return content.replace(/\n?<!-- cc-catalyst-begin -->[\s\S]*?<!-- cc-catalyst-end -->\n?/g, '')
}

export const removeCommand = new Command('remove')
  .description('Uninstall cc-catalyst — removes skills, hooks, and CLAUDE.md block')
  .action(() => {
    console.log(chalk.cyan('\nRemoving cc-catalyst...\n'))

    // Remove slash commands
    for (const file of ['catalyst-audit.md', 'catalyst-compress.md', 'catalyst-status.md', 'catalyst-learn.md']) {
      const p = path.join(COMMANDS_DIR, file)
      if (fs.existsSync(p)) fs.unlinkSync(p)
    }
    console.log(chalk.green('✓ Slash commands removed'))

    // Remove CLAUDE.md block
    if (fs.existsSync(CLAUDE_MD_PATH)) {
      const content = fs.readFileSync(CLAUDE_MD_PATH, 'utf8')
      fs.writeFileSync(CLAUDE_MD_PATH, removeClaudeMdBlock(content))
    }
    console.log(chalk.green('✓ CLAUDE.md activation block removed'))

    // Remove hooks from settings.json
    if (fs.existsSync(SETTINGS_PATH)) {
      const settings = readSettings(SETTINGS_PATH)
      validateHooks(settings)
      removeHooks(settings)
      const tmp = SETTINGS_PATH + `.${process.pid}.${crypto.randomBytes(4).toString('hex')}.tmp`
      fs.writeFileSync(tmp, JSON.stringify(settings, null, 2) + '\n', { mode: 0o600 })
      fs.renameSync(tmp, SETTINGS_PATH)
    }
    console.log(chalk.green('✓ Hooks removed from settings.json'))

    // Remove hook scripts
    const hooksDir = path.join(DATA_DIR, 'hooks')
    if (fs.existsSync(hooksDir)) fs.rmSync(hooksDir, { recursive: true })
    console.log(chalk.green('✓ Hook scripts removed'))

    // Stop proxy if running
    let proxyKilled = false
    if (fs.existsSync(PID_FILE)) {
      const pid = parseInt(fs.readFileSync(PID_FILE, 'utf8').trim(), 10)
      if (!isNaN(pid) && isRunning(pid)) {
        try {
          process.kill(pid, 'SIGTERM')
          proxyKilled = true
        } catch (err) {
          console.log(chalk.yellow(`⚠ Could not stop proxy (PID ${pid}): ${(err as NodeJS.ErrnoException).message}`))
          console.log(chalk.yellow(`  Kill it manually: kill ${pid}`))
        }
      }
      try { fs.unlinkSync(PID_FILE) } catch { /* already gone */ }
    }
    if (!proxyKilled) proxyKilled = killByPort(PROXY_PORT)
    if (proxyKilled) console.log(chalk.green('✓ Proxy stopped'))

    // Clear stale npx cache entries
    clearNpxCache()
    console.log(chalk.green('✓ npx cache cleared'))

    // Remove ANTHROPIC_BASE_URL from shell profiles
    let removedFromProfile = false
    for (const profile of SHELL_PROFILES) {
      if (!fs.existsSync(profile)) continue
      const content = fs.readFileSync(profile, 'utf8')
      if (!content.includes(PROXY_ENV_LINE)) continue
      const updated = content.split('\n').filter(line => line.trim() !== PROXY_ENV_LINE).join('\n')
      fs.writeFileSync(profile, updated)
      removedFromProfile = true
    }

    if (removedFromProfile) {
      console.log(chalk.green('✓ ANTHROPIC_BASE_URL removed from shell profile'))
      console.log(chalk.yellow('\n  Run this now to take effect in your current terminal:'))
      console.log(chalk.cyan('  unset ANTHROPIC_BASE_URL\n'))
    } else if (process.env.ANTHROPIC_BASE_URL === `http://localhost:${PROXY_PORT}`) {
      console.log(chalk.yellow('\n  ANTHROPIC_BASE_URL is still set in this session. Run:'))
      console.log(chalk.cyan('  unset ANTHROPIC_BASE_URL\n'))
    }

    console.log(chalk.bold('\n✅ cc-catalyst removed. Restart your terminal and Claude Code to apply.\n'))
  })
