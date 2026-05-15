export const CC_MARKER = 'cc-catalyst'

type HookEntry = { hooks: Array<{ type: string; command?: string; timeout?: number }> }
type HooksMap = Record<string, HookEntry[]>

function getHooksMap(settings: Record<string, unknown>): HooksMap {
  if (!settings.hooks || typeof settings.hooks !== 'object') {
    settings.hooks = {}
  }
  return settings.hooks as HooksMap
}

export function hasHook(settings: Record<string, unknown>, event: string): boolean {
  const map = settings.hooks as HooksMap | undefined
  const arr = map?.[event]
  if (!Array.isArray(arr)) return false
  return arr.some(entry =>
    Array.isArray(entry?.hooks) &&
    entry.hooks.some(h => h?.type === 'command' && h?.command?.includes(CC_MARKER))
  )
}

export function addHook(settings: Record<string, unknown>, event: string, command: string): boolean {
  const map = getHooksMap(settings)
  if (!Array.isArray(map[event])) map[event] = []
  if (hasHook(settings, event)) return false
  map[event].push({ hooks: [{ type: 'command', command, timeout: 10000 }] })
  return true
}

export function removeHooks(settings: Record<string, unknown>): number {
  const map = settings.hooks as HooksMap | undefined
  if (!map) return 0
  let removed = 0
  for (const event of Object.keys(map)) {
    if (!Array.isArray(map[event])) { delete map[event]; continue }
    const before = map[event].length
    map[event] = map[event].filter(entry =>
      !entry?.hooks?.some(h => h?.type === 'command' && h?.command?.includes(CC_MARKER))
    )
    removed += before - map[event].length
    if (map[event].length === 0) delete map[event]
  }
  if (Object.keys(map).length === 0) delete settings.hooks
  return removed
}

export function validateHooks(settings: Record<string, unknown>): void {
  const map = settings.hooks as HooksMap | undefined
  if (!map) return
  for (const event of Object.keys(map)) {
    if (!Array.isArray(map[event])) { delete map[event]; continue }
    map[event] = map[event].filter(entry => {
      if (!entry?.hooks || !Array.isArray(entry.hooks)) return false
      entry.hooks = entry.hooks.filter(
        h => h?.type === 'command' && typeof h?.command === 'string' && h.command.length > 0
      )
      return entry.hooks.length > 0
    })
    if (map[event].length === 0) delete map[event]
  }
  if (Object.keys(map).length === 0) delete settings.hooks
}
