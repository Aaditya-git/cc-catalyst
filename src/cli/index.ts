#!/usr/bin/env node
import { Command } from 'commander'
import { initCommand } from './commands/init'
import { removeCommand } from './commands/remove'
import { auditCommand } from './commands/audit'
import { statusCommand } from './commands/status'
import { learnCommand } from './commands/learn'

const program = new Command()

program
  .name('cc-catalyst')
  .description('Session intelligence for Claude Code — active token management')
  .version('0.2.0')

program.addCommand(initCommand)
program.addCommand(removeCommand)
program.addCommand(auditCommand)
program.addCommand(statusCommand)
program.addCommand(learnCommand)

program.parse()
