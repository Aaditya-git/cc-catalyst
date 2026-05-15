import fs from 'fs'
import path from 'path'
import os from 'os'
import { estimateTokens } from './token-counter'
import { readSettings } from '../settings/reader'

export function analyzeGlobalClaudeMd(): number {
  const p = path.join(os.homedir(), '.claude', 'CLAUDE.md')
  if (!fs.existsSync(p)) return 0
  return estimateTokens(fs.readFileSync(p, 'utf8'))
}

export function analyzeProjectClaudeMd(projectDir: string): number {
  let total = 0
  for (const rel of ['CLAUDE.md', '.claude/CLAUDE.md']) {
    const p = path.join(projectDir, rel)
    if (fs.existsSync(p)) total += estimateTokens(fs.readFileSync(p, 'utf8'))
  }
  return total
}

export function analyzeMcpDescriptions(): number {
  const settingsPath = path.join(os.homedir(), '.claude', 'settings.json')
  const settings = readSettings(settingsPath)
  const mcp = settings?.mcpServers
  if (!mcp || typeof mcp !== 'object') return 0
  return estimateTokens(JSON.stringify(mcp))
}

export function analyzeSessionHistory(): number {
  const healthPath = path.join(os.homedir(), '.cc-catalyst', 'session-health.json')
  if (fs.existsSync(healthPath)) {
    try {
      const h = JSON.parse(fs.readFileSync(healthPath, 'utf8')) as { inputTokens?: number }
      if (typeof h.inputTokens === 'number') return h.inputTokens
    } catch { /* fall through */ }
  }
  return 0
}
