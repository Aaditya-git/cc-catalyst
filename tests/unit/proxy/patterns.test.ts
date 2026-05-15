import { getGlobalNeverUsed } from '../../../src/proxy/patterns'

jest.mock('fs')
jest.mock('os', () => ({ homedir: () => '/home/test' }))

import fs from 'fs'

describe('getGlobalNeverUsed', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns empty when no projects directory', () => {
    (fs.existsSync as jest.Mock).mockReturnValue(false)
    expect(getGlobalNeverUsed()).toEqual([])
  })

  it('returns tools that are neverUsed in any project and alwaysUsed in none', () => {
    (fs.existsSync as jest.Mock).mockReturnValue(true)
    ;(fs.readdirSync as jest.Mock).mockReturnValue(['proj-a'])
    ;(fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify({
      neverUsed: ['WebSearch'],
      alwaysUsed: ['Bash'],
    }))
    expect(getGlobalNeverUsed()).toContain('WebSearch')
    expect(getGlobalNeverUsed()).not.toContain('Bash')
  })

  it('excludes a tool if it is alwaysUsed in any project', () => {
    (fs.existsSync as jest.Mock).mockReturnValue(true)
    ;(fs.readdirSync as jest.Mock).mockReturnValue(['proj-a', 'proj-b'])
    ;(fs.readFileSync as jest.Mock)
      .mockReturnValueOnce(JSON.stringify({ neverUsed: ['WebSearch'], alwaysUsed: [] }))
      .mockReturnValueOnce(JSON.stringify({ neverUsed: [], alwaysUsed: ['WebSearch'] }))
    expect(getGlobalNeverUsed()).not.toContain('WebSearch')
  })

  it('returns empty when no learned.json files exist', () => {
    (fs.existsSync as jest.Mock)
      .mockReturnValueOnce(true) // projects dir exists
      .mockReturnValue(false) // learned.json does not exist
    ;(fs.readdirSync as jest.Mock).mockReturnValue(['proj-a'])
    expect(getGlobalNeverUsed()).toEqual([])
  })
})
