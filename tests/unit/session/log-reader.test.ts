import { readLatestUsage, readAllToolCalls } from '../../../src/session/log-reader'
import fs from 'fs'
import os from 'os'
import path from 'path'

function writeTmpJSONL(lines: object[]): string {
  const p = path.join(os.tmpdir(), `session-${Date.now()}.jsonl`)
  fs.writeFileSync(p, lines.map(l => JSON.stringify(l)).join('\n'))
  return p
}

const assistantMsg = (inputTokens: number, outputTokens: number, model = 'claude-sonnet-4-6') => ({
  message: {
    role: 'assistant',
    model,
    usage: {
      input_tokens: inputTokens,
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: 0,
      output_tokens: outputTokens,
    },
  },
})

describe('readLatestUsage', () => {
  it('returns null for missing file', () => {
    expect(readLatestUsage('/nonexistent.jsonl')).toBeNull()
  })

  it('reads input and output tokens from latest assistant message', () => {
    const p = writeTmpJSONL([
      { type: 'permission-mode' },
      assistantMsg(1000, 200),
    ])
    const result = readLatestUsage(p)
    expect(result?.inputTokens).toBe(1000)
    expect(result?.outputTokens).toBe(200)
    fs.unlinkSync(p)
  })

  it('sums input + cache_creation + cache_read tokens', () => {
    const p = writeTmpJSONL([{
      message: {
        role: 'assistant',
        model: 'claude-sonnet-4-6',
        usage: {
          input_tokens: 100,
          cache_creation_input_tokens: 500,
          cache_read_input_tokens: 200,
          output_tokens: 50,
        },
      },
    }])
    const result = readLatestUsage(p)
    expect(result?.inputTokens).toBe(800)
    fs.unlinkSync(p)
  })

  it('returns the LAST assistant message when multiple exist', () => {
    const p = writeTmpJSONL([
      assistantMsg(500, 100),
      assistantMsg(1500, 300),
    ])
    const result = readLatestUsage(p)
    expect(result?.inputTokens).toBe(1500)
    fs.unlinkSync(p)
  })
})

describe('readAllToolCalls', () => {
  it('returns empty array for missing file', () => {
    expect(readAllToolCalls('/nonexistent.jsonl')).toEqual([])
  })

  it('extracts tool names from assistant content blocks', () => {
    const p = writeTmpJSONL([{
      message: {
        role: 'assistant',
        content: [
          { type: 'tool_use', name: 'Read' },
          { type: 'tool_use', name: 'Bash' },
          { type: 'text', text: 'some text' },
        ],
      },
    }])
    expect(readAllToolCalls(p)).toEqual(['Read', 'Bash'])
    fs.unlinkSync(p)
  })
})
