import fs from 'fs'
import path from 'path'
import os from 'os'
import type { ToolCallLog, LearnedPatterns } from '../types'

const DATA_DIR = path.join(os.homedir(), '.cc-catalyst')

export function dataDir(): string { return DATA_DIR }

export function sessionsDir(): string { return path.join(DATA_DIR, 'sessions') }

export function projectLearnedPath(projectHash: string): string {
  return path.join(DATA_DIR, 'projects', projectHash, 'learned.json')
}

export function logToolCall(log: ToolCallLog): void {
  const dir = sessionsDir()
  fs.mkdirSync(dir, { recursive: true })
  const date = new Date().toISOString().slice(0, 10)
  const file = path.join(dir, `${date}.jsonl`)
  fs.appendFileSync(file, JSON.stringify(log) + '\n')
}

export function readSessionLogs(): ToolCallLog[] {
  const dir = sessionsDir()
  if (!fs.existsSync(dir)) return []
  const logs: ToolCallLog[] = []
  for (const file of fs.readdirSync(dir).filter(f => f.endsWith('.jsonl'))) {
    for (const line of fs.readFileSync(path.join(dir, file), 'utf8').trim().split('\n').filter(Boolean)) {
      try { logs.push(JSON.parse(line) as ToolCallLog) } catch { /* skip */ }
    }
  }
  return logs
}

export function readLearned(projectHash: string): LearnedPatterns | null {
  const p = projectLearnedPath(projectHash)
  if (!fs.existsSync(p)) return null
  try { return JSON.parse(fs.readFileSync(p, 'utf8')) as LearnedPatterns } catch { return null }
}

export function writeLearned(patterns: LearnedPatterns): void {
  const p = projectLearnedPath(patterns.projectHash)
  fs.mkdirSync(path.dirname(p), { recursive: true })
  fs.writeFileSync(p, JSON.stringify(patterns, null, 2))
}

export function deleteLearned(projectHash: string): void {
  const p = projectLearnedPath(projectHash)
  if (fs.existsSync(p)) fs.unlinkSync(p)
}
