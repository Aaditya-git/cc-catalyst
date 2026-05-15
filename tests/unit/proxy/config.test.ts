import { readConfig } from '../../../src/proxy/config'

jest.mock('fs')
jest.mock('os', () => ({ homedir: () => '/home/test' }))

import fs from 'fs'

describe('readConfig', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns defaults when config file does not exist', () => {
    (fs.existsSync as jest.Mock).mockReturnValue(false)
    const config = readConfig()
    expect(config.port).toBe(3131)
    expect(config.historyTrimN).toBe(20)
    expect(config.enableToolStripping).toBe(true)
    expect(config.enableHistoryTrimming).toBe(true)
  })

  it('merges user config with defaults', () => {
    (fs.existsSync as jest.Mock).mockReturnValue(true)
    ;(fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify({ proxy: { historyTrimN: 10 } }))
    const config = readConfig()
    expect(config.historyTrimN).toBe(10)
    expect(config.port).toBe(3131) // default preserved
  })

  it('returns defaults on parse error', () => {
    (fs.existsSync as jest.Mock).mockReturnValue(true)
    ;(fs.readFileSync as jest.Mock).mockReturnValue('not json')
    const config = readConfig()
    expect(config.port).toBe(3131)
  })
})
