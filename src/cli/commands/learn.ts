import { Command } from 'commander'
import chalk from 'chalk'
import { readLearned, writeLearned, deleteLearned } from '../../learning/store'

function projectHash(dir: string): string {
  return dir.replace(/\//g, '-')
}

export const learnCommand = new Command('learn')
  .description('Manage learned tool usage patterns')
  .addCommand(
    new Command('show')
      .description('Show learned patterns for this project')
      .action(() => {
        const hash = projectHash(process.cwd())
        const learned = readLearned(hash)
        if (!learned) {
          console.log(chalk.dim('No learned patterns yet. Needs 3+ sessions.\n'))
          return
        }
        console.log(chalk.bold('\nLearned Patterns\n'))
        console.log(`Sessions:     ${learned.sessionCount}`)
        console.log(`Always used:  ${learned.alwaysUsed.join(', ') || '(none yet)'}`)
        console.log(`Suppressed:   ${learned.neverUsed.join(', ') || '(none)'}`)
        console.log(`Updated:      ${new Date(learned.updatedAt).toLocaleString()}\n`)
      })
  )
  .addCommand(
    new Command('reset')
      .description('Clear all learned data for this project')
      .action(() => {
        const hash = projectHash(process.cwd())
        deleteLearned(hash)
        console.log(chalk.green('✓ Learned data cleared for this project.\n'))
      })
  )
  .addCommand(
    new Command('forget')
      .argument('<tool>', 'Tool name to un-suppress')
      .description('Un-suppress a specific tool')
      .action((tool: string) => {
        const hash = projectHash(process.cwd())
        const learned = readLearned(hash)
        if (!learned) { console.log(chalk.dim('No learned data found.\n')); return }
        learned.neverUsed = learned.neverUsed.filter(t => t !== tool)
        writeLearned({ ...learned, updatedAt: new Date().toISOString() })
        console.log(chalk.green(`✓ ${tool} un-suppressed.\n`))
      })
  )
