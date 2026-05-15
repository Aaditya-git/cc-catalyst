import { Command } from 'commander'
import path from 'path'
import chalk from 'chalk'
import { analyzeGlobalClaudeMd, analyzeProjectClaudeMd, analyzeMcpDescriptions, analyzeSessionHistory } from '../../analytics/file-analyzer'
import { buildBreakdown } from '../../analytics/breakdown'

function projectHash(dir: string): string {
  return dir.replace(/\//g, '-')
}

function bar(tokens: number, total: number, width = 20): string {
  const filled = total > 0 ? Math.round((tokens / total) * width) : 0
  return '█'.repeat(filled) + '░'.repeat(width - filled)
}

function pct(tokens: number, total: number): string {
  return total > 0 ? `${Math.round((tokens / total) * 100)}%` : '0%'
}

export const auditCommand = new Command('audit')
  .description('Show a token cost breakdown for the current project')
  .action(() => {
    const cwd = process.cwd()
    const hash = projectHash(cwd)

    const parts = {
      globalClaudeMd: analyzeGlobalClaudeMd(),
      projectClaudeMd: analyzeProjectClaudeMd(cwd),
      sessionHistory: analyzeSessionHistory(hash),
      mcpDescriptions: analyzeMcpDescriptions(),
    }

    const result = buildBreakdown(parts)

    console.log(chalk.bold('\nToken Cost Breakdown — ' + path.basename(cwd)))
    console.log('─'.repeat(60))

    const rows: [string, number][] = [
      ['Global CLAUDE.md', result.globalClaudeMd],
      ['Project CLAUDE.md', result.projectClaudeMd],
      ['Session history (cumulative)', result.sessionHistory],
      ['MCP tool descriptions (est.)', result.mcpDescriptions],
    ]

    for (const [label, tokens] of rows) {
      const b = bar(tokens, result.total)
      const p = pct(tokens, result.total)
      console.log(`${label.padEnd(32)} ${String(tokens.toLocaleString()).padStart(7)} tokens  ${b}  ${p}`)
    }

    console.log('─'.repeat(60))
    console.log(`${'Total'.padEnd(32)} ${String(result.total.toLocaleString()).padStart(7)} tokens\n`)

    if (result.recommendations.length > 0) {
      console.log(chalk.yellow('Recommendations:'))
      result.recommendations.forEach((r, i) => console.log(`  ${i + 1}. ${r}`))
      console.log()
    } else {
      console.log(chalk.green('✓ Token usage looks healthy.\n'))
    }
  })
