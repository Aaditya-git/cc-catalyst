import fs from 'fs'
import os from 'os'
import path from 'path'
import { createProfile } from '../../../src/adaptive/profile'

describe('profile', () => {
  let tmpDir: string
  let profilePath: string

  beforeEach(() => {
    tmpDir = path.join(os.tmpdir(), `cc-catalyst-test-${Date.now()}`)
    profilePath = path.join(tmpDir, 'profile.json')
  })

  afterEach(() => {
    if (fs.existsSync(profilePath)) fs.unlinkSync(profilePath)
    if (fs.existsSync(tmpDir)) fs.rmdirSync(tmpDir)
  })

  it('returns empty profile when no file exists', () => {
    const profile = createProfile(profilePath)
    const data = profile.load()
    expect(data.toolUsageByTaskType).toEqual({})
  })

  it('saves and reloads profile correctly', () => {
    const profile = createProfile(profilePath)
    profile.save({ toolUsageByTaskType: { file_editing: ['Read', 'WebFetch'] } })
    const loaded = profile.load()
    expect(loaded.toolUsageByTaskType.file_editing).toContain('WebFetch')
  })

  it('merges new tool data into existing profile', () => {
    const profile = createProfile(profilePath)
    profile.save({ toolUsageByTaskType: { file_editing: ['Read'] } })
    profile.merge('file_editing', ['Edit', 'Bash'])
    const loaded = profile.load()
    expect(loaded.toolUsageByTaskType.file_editing).toContain('Read')
    expect(loaded.toolUsageByTaskType.file_editing).toContain('Edit')
  })

  it('deduplicates tools on merge', () => {
    const profile = createProfile(profilePath)
    profile.save({ toolUsageByTaskType: { file_editing: ['Read'] } })
    profile.merge('file_editing', ['Read', 'Edit'])
    const loaded = profile.load()
    expect(loaded.toolUsageByTaskType.file_editing.filter((t: string) => t === 'Read')).toHaveLength(1)
  })
})
