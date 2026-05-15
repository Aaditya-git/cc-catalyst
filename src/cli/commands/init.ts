import { Command } from 'commander'
import fs from 'fs'
import path from 'path'
import os from 'os'
import crypto from 'crypto'
import chalk from 'chalk'
import { readSettings } from '../../settings/reader'
import { addHook, validateHooks } from '../../settings/hooks'
import {
  CLAUDE_MD_BLOCK,
  CATALYST_AUDIT_CMD,
  CATALYST_COMPRESS_CMD,
  CATALYST_STATUS_CMD,
  CATALYST_LEARN_CMD,
} from '../../skills/content'

const CLAUDE_DIR = path.join(os.homedir(), '.claude')
const DATA_DIR = path.join(os.homedir(), '.cc-catalyst')
const HOOKS_DIR = path.join(DATA_DIR, 'hooks')
const COMMANDS_DIR = path.join(CLAUDE_DIR, 'commands')
const SETTINGS_PATH = path.join(CLAUDE_DIR, 'settings.json')
const CLAUDE_MD_PATH = path.join(CLAUDE_DIR, 'CLAUDE.md')
const CC_MD_BEGIN = '<!-- cc-catalyst-begin -->'

export function buildHookCommand(scriptPath: string): string {
  return `"${process.execPath}" "${scriptPath}"`
}

function installHookScripts(): void {
  fs.mkdirSync(HOOKS_DIR, { recursive: true })
  const distHooksDir = path.join(__dirname, '../../hooks')
  for (const script of ['session-health.js', 'tool-tracker.js']) {
    const src = path.join(distHooksDir, script)
    const dst = path.join(HOOKS_DIR, script)
    if (fs.existsSync(src)) fs.copyFileSync(src, dst)
  }
}

function installSlashCommands(): void {
  fs.mkdirSync(COMMANDS_DIR, { recursive: true })
  const commands: Record<string, string> = {
    'catalyst-audit.md': CATALYST_AUDIT_CMD,
    'catalyst-compress.md': CATALYST_COMPRESS_CMD,
    'catalyst-status.md': CATALYST_STATUS_CMD,
    'catalyst-learn.md': CATALYST_LEARN_CMD,
  }
  for (const [file, content] of Object.entries(commands)) {
    fs.writeFileSync(path.join(COMMANDS_DIR, file), content.trim())
  }
}

function installClaudeMdBlock(): void {
  const existing = fs.existsSync(CLAUDE_MD_PATH)
    ? fs.readFileSync(CLAUDE_MD_PATH, 'utf8')
    : ''
  if (existing.includes(CC_MD_BEGIN)) return
  fs.writeFileSync(CLAUDE_MD_PATH, existing + '\n' + CLAUDE_MD_BLOCK.trim() + '\n')
}

function installHooks(): void {
  const settings = readSettings(SETTINGS_PATH)
  validateHooks(settings)
  addHook(settings, 'Stop', buildHookCommand(path.join(HOOKS_DIR, 'session-health.js')))
  addHook(settings, 'PostToolUse', buildHookCommand(path.join(HOOKS_DIR, 'tool-tracker.js')))
  fs.mkdirSync(CLAUDE_DIR, { recursive: true })
  const tmp = SETTINGS_PATH + `.${process.pid}.${crypto.randomBytes(4).toString('hex')}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(settings, null, 2) + '\n', { mode: 0o600 })
  fs.renameSync(tmp, SETTINGS_PATH)
}

export const initCommand = new Command('init')
  .description('Install cc-catalyst — adds skills, hooks, and session intelligence')
  .action(() => {
    console.log(chalk.cyan('\nInstalling cc-catalyst...\n'))

    installHookScripts()
    console.log(chalk.green('✓ Hook scripts installed'))

    installSlashCommands()
    console.log(chalk.green('✓ Slash commands installed (/catalyst-audit, /catalyst-compress, /catalyst-status, /catalyst-learn)'))

    installClaudeMdBlock()
    console.log(chalk.green('✓ CLAUDE.md activation block added'))

    installHooks()
    console.log(chalk.green('✓ Hooks added to settings.json (Stop + PostToolUse)'))

    console.log(chalk.bold('\n✅ cc-catalyst is active. Restart Claude Code to apply.\n'))
    console.log('  Run ' + chalk.cyan('cc-catalyst status') + ' to verify.')
    console.log('  Run ' + chalk.cyan('/catalyst-audit') + ' inside Claude Code for token breakdown.\n')
  })
