jest.mock('chalk', () => ({
  __esModule: true,
  default: {
    cyan: (s: string) => s,
    green: (s: string) => s,
    bold: (s: string) => s
  }
}))

import { removeClaudeMdBlock } from '../../src/cli/commands/remove'

describe('removeClaudeMdBlock', () => {
  it('strips the cc-catalyst marker block from content', () => {
    const content = `# My CLAUDE.md\n\nSome content.\n\n<!-- cc-catalyst-begin -->\nsome cc-catalyst stuff\n<!-- cc-catalyst-end -->\n`
    const result = removeClaudeMdBlock(content)
    expect(result).not.toContain('cc-catalyst-begin')
    expect(result).toContain('Some content.')
  })

  it('returns content unchanged when no block exists', () => {
    const content = '# My CLAUDE.md\n\nClean content.\n'
    expect(removeClaudeMdBlock(content)).toBe(content)
  })
})
