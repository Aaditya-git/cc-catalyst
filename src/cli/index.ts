#!/usr/bin/env node
import { Command } from 'commander'
import { initCommand } from './commands/init'
import { removeCommand } from './commands/remove'
import { auditCommand } from './commands/audit'
import { statusCommand } from './commands/status'

const program = new Command()

program
  .name('cc-catalyst')
  .description('Token optimizer proxy for Claude Code — save tokens without compromising quality')
  .version('0.1.0')

program.addCommand(initCommand)
program.addCommand(removeCommand)
program.addCommand(auditCommand)
program.addCommand(statusCommand)

program.parse()
