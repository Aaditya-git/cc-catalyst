export interface Tracker {
  record(taskType: string, toolName: string): void
  getToolsUsed(taskType: string): string[]
}

export function createTracker(): Tracker {
  const usage: Record<string, Set<string>> = {}

  return {
    record(taskType: string, toolName: string): void {
      if (!usage[taskType]) usage[taskType] = new Set()
      usage[taskType].add(toolName)
    },

    getToolsUsed(taskType: string): string[] {
      return Array.from(usage[taskType] ?? [])
    }
  }
}
