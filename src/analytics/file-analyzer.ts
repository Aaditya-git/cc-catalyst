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

export function analyzeSessionHistory(projectHash: string): number {
  const projectsDir = path.join(os.homedir(), '.claude', 'projects', projectHash)
  if (!fs.existsSync(projectsDir)) return 0
  let totalInputTokens = 0
  const files = fs.readdirSync(projectsDir).filter(f => f.endsWith('.jsonl'))
  for (const file of files) {
    const lines = fs.readFileSync(path.join(projectsDir, file), 'utf8').trim().split('\n').filter(Boolean)
    for (const line of lines) {
      try {
        const obj = JSON.parse(line) as { message?: { role?: string; usage?: Record<string, number> } }
        const u = obj?.message?.usage
        if (!u || obj?.message?.role !== 'assistant') continue
        totalInputTokens += (u.input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0)
      } catch { /* skip */ }
    }
  }
  return totalInputTokens
}
