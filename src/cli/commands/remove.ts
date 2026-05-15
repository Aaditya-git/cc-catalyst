import { Command } from 'commander'
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

    console.log(chalk.bold('\n✅ cc-catalyst removed. Restart Claude Code to apply.\n'))
  })
