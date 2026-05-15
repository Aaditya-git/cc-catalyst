import { hasHook, addHook, removeHooks, validateHooks } from '../../../src/settings/hooks'

describe('addHook', () => {
  it('adds a hook entry to the event array', () => {
    const s: Record<string, unknown> = {}
    const added = addHook(s, 'Stop', '/usr/local/bin/node /path/cc-catalyst/session-health.js')
    expect(added).toBe(true)
    const hooks = (s.hooks as Record<string, unknown[]>)['Stop']
    expect(Array.isArray(hooks)).toBe(true)
    expect(hooks).toHaveLength(1)
  })

  it('is idempotent — does not add duplicate', () => {
    const s: Record<string, unknown> = {}
    addHook(s, 'Stop', '/usr/local/bin/node /path/cc-catalyst/session-health.js')
    const added = addHook(s, 'Stop', '/usr/local/bin/node /path/cc-catalyst/session-health.js')
    expect(added).toBe(false)
    const hooks = (s.hooks as Record<string, unknown[]>)['Stop']
    expect(hooks).toHaveLength(1)
  })

  it('adds hooks for different events independently', () => {
    const s: Record<string, unknown> = {}
    addHook(s, 'Stop', '/node /path/cc-catalyst/session-health.js')
    addHook(s, 'PostToolUse', '/node /path/cc-catalyst/tool-tracker.js')
    const h = s.hooks as Record<string, unknown[]>
    expect(h['Stop']).toHaveLength(1)
    expect(h['PostToolUse']).toHaveLength(1)
  })
})

describe('hasHook', () => {
  it('returns false when no hooks exist', () => {
    expect(hasHook({}, 'Stop')).toBe(false)
  })

  it('returns true when cc-catalyst hook present', () => {
    const s: Record<string, unknown> = {}
    addHook(s, 'Stop', '/node /path/cc-catalyst/session-health.js')
    expect(hasHook(s, 'Stop')).toBe(true)
  })
})

describe('removeHooks', () => {
  it('removes all cc-catalyst hooks', () => {
    const s: Record<string, unknown> = {}
    addHook(s, 'Stop', '/node /path/cc-catalyst/session-health.js')
    addHook(s, 'PostToolUse', '/node /path/cc-catalyst/tool-tracker.js')
    const removed = removeHooks(s)
    expect(removed).toBe(2)
    expect(s.hooks).toBeUndefined()
  })

  it('leaves non-cc-catalyst hooks intact', () => {
    const s: Record<string, unknown> = {
      hooks: {
        Stop: [{ hooks: [{ type: 'command', command: '/some/other/hook.sh' }] }]
      }
    }
    addHook(s, 'Stop', '/node /path/cc-catalyst/session-health.js')
    removeHooks(s)
    const hooks = (s.hooks as Record<string, unknown[]>)['Stop']
    expect(hooks).toHaveLength(1)
    const entry = hooks[0] as { hooks: Array<{ command: string }> }
    expect(entry.hooks[0].command).toBe('/some/other/hook.sh')
  })
})

describe('validateHooks', () => {
  it('removes malformed hook entries', () => {
    const s: Record<string, unknown> = {
      hooks: { Stop: [{ hooks: [{ type: 'command', command: '' }] }] }
    }
    validateHooks(s)
    expect(s.hooks).toBeUndefined()
  })
})
