import fs from 'fs'
import path from 'path'
import os from 'os'
import type { LearnedPatterns } from '../types'

const PROJECTS_DIR = path.join(os.homedir(), '.cc-catalyst', 'projects')

export function getGlobalNeverUsed(): string[] {
  if (!fs.existsSync(PROJECTS_DIR)) return []

  const neverUsedSet = new Set<string>()
  const alwaysUsedSet = new Set<string>()

  for (const project of fs.readdirSync(PROJECTS_DIR)) {
    const learnedPath = path.join(PROJECTS_DIR, project, 'learned.json')
    if (!fs.existsSync(learnedPath)) continue
    try {
      const learned = JSON.parse(fs.readFileSync(learnedPath, 'utf8')) as LearnedPatterns
      learned.neverUsed.forEach(t => neverUsedSet.add(t))
      learned.alwaysUsed.forEach(t => alwaysUsedSet.add(t))
    } catch { /* skip malformed */ }
  }

  return [...neverUsedSet].filter(t => !alwaysUsedSet.has(t))
}
