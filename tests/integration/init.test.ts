import { buildHookCommand } from '../../src/cli/commands/init'

describe('buildHookCommand', () => {
  it('returns a quoted node + script path command string', () => {
    const cmd = buildHookCommand('/home/user/.cc-catalyst/hooks/session-health.js')
    expect(cmd).toContain('node')
    expect(cmd).toContain('session-health.js')
    expect(cmd.startsWith('"')).toBe(true)
  })
})
