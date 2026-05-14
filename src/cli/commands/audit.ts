import { Command } from 'commander'
import fs from 'fs'
import path from 'path'
import os from 'os'
import chalk from 'chalk'

export const auditCommand = new Command('audit')
  .description('Show token usage breakdown and savings estimate')
  .action(() => {
    const profilePath = path.join(os.homedir(), '.cc-catalyst', 'profile.json')
    const profile = fs.existsSync(profilePath)
      ? JSON.parse(fs.readFileSync(profilePath, 'utf-8'))
      : { toolUsageByTaskType: {} }

    console.log(chalk.bold('\ncc-catalyst Token Audit\n'))
    console.log(chalk.gray('Fixed costs every Claude Code session:'))
    console.log(`  System prompt:     ${chalk.yellow('~8,500 tokens')}`)
    console.log(`  System tools:      ${chalk.red('~31,500 tokens')}`)
    console.log(`  Total fixed cost:  ${chalk.red('~40,000 tokens')}`)
    console.log()
    console.log(chalk.gray('cc-catalyst reduces to:'))
    console.log(`  System tools (pruned): ${chalk.green('~8,000–15,000 tokens')} depending on task`)
    console.log(`  Estimated savings:     ${chalk.green('20–55% per session')}`)
    console.log()

    const taskTypes = Object.keys(profile.toolUsageByTaskType)
    if (taskTypes.length > 0) {
      console.log(chalk.gray('Your learned tool profiles:'))
      for (const [type, tools] of Object.entries(profile.toolUsageByTaskType)) {
        console.log(`  ${type}: ${(tools as string[]).join(', ')}`)
      }
    } else {
      console.log(chalk.gray('No session data yet. Run a Claude Code session to start learning.'))
    }
    console.log()
  })
