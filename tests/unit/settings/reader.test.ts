import { stripJsonComments, readSettings } from '../../../src/settings/reader'
import fs from 'fs'
import os from 'os'
import path from 'path'

describe('stripJsonComments', () => {
  it('removes line comments', () => {
    const input = '{\n  // a comment\n  "key": "value"\n}'
    expect(stripJsonComments(input)).not.toContain('//')
  })

  it('removes block comments', () => {
    const input = '{ /* block */ "key": "value" }'
    expect(stripJsonComments(input)).not.toContain('/*')
  })

  it('preserves urls in strings', () => {
    const input = '{ "url": "http://localhost:8080" }'
    expect(JSON.parse(stripJsonComments(input))).toEqual({ url: 'http://localhost:8080' })
  })

  it('removes trailing commas', () => {
    const input = '{ "a": 1, "b": 2, }'
    expect(() => JSON.parse(stripJsonComments(input))).not.toThrow()
  })
})

describe('readSettings', () => {
  it('returns empty object for missing file', () => {
    expect(readSettings('/nonexistent/path/settings.json')).toEqual({})
  })

  it('parses valid JSON', () => {
    const tmp = path.join(os.tmpdir(), `test-${Date.now()}.json`)
    fs.writeFileSync(tmp, JSON.stringify({ hooks: {} }))
    expect(readSettings(tmp)).toEqual({ hooks: {} })
    fs.unlinkSync(tmp)
  })

  it('parses JSONC with comments', () => {
    const tmp = path.join(os.tmpdir(), `test-${Date.now()}.json`)
    fs.writeFileSync(tmp, '{\n  // comment\n  "key": "val"\n}')
    expect(readSettings(tmp)).toEqual({ key: 'val' })
    fs.unlinkSync(tmp)
  })

  it('returns empty object for empty file', () => {
    const tmp = path.join(os.tmpdir(), `test-${Date.now()}.json`)
    fs.writeFileSync(tmp, '')
    expect(readSettings(tmp)).toEqual({})
    fs.unlinkSync(tmp)
  })
})
