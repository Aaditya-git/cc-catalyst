import fs from 'fs'
import path from 'path'
import os from 'os'
import { UserProfile } from '../types'

const DEFAULT_PATH = path.join(os.homedir(), '.cc-catalyst', 'profile.json')

export interface Profile {
  load(): UserProfile
  save(data: UserProfile): void
  merge(taskType: string, tools: string[]): void
}

export function createProfile(profilePath = DEFAULT_PATH): Profile {
  return {
    load(): UserProfile {
      try {
        return JSON.parse(fs.readFileSync(profilePath, 'utf-8'))
      } catch {
        return { toolUsageByTaskType: {} }
      }
    },

    save(data: UserProfile): void {
      fs.mkdirSync(path.dirname(profilePath), { recursive: true })
      fs.writeFileSync(profilePath, JSON.stringify(data, null, 2))
    },

    merge(taskType: string, tools: string[]): void {
      const current = this.load()
      const existing = current.toolUsageByTaskType[taskType] ?? []
      const merged = [...new Set([...existing, ...tools])]
      this.save({
        ...current,
        toolUsageByTaskType: { ...current.toolUsageByTaskType, [taskType]: merged }
      })
    }
  }
}
