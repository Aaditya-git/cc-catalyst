#!/usr/bin/env node
import fs from 'fs'
import path from 'path'
import os from 'os'

interface HookInput { session_id: string; tool_name?: string }

function readStdin(): HookInput {
  try {
    const data = fs.readFileSync('/dev/stdin', 'utf8')
    return JSON.parse(data) as HookInput
  } catch { return { session_id: '' } }
}

const input = readStdin()
if (input.session_id && input.tool_name) {
  const dir = path.join(os.homedir(), '.cc-catalyst', 'sessions')
  fs.mkdirSync(dir, { recursive: true })
  const date = new Date().toISOString().slice(0, 10)
  const log = JSON.stringify({ tool: input.tool_name, sessionId: input.session_id, timestamp: new Date().toISOString() })
  fs.appendFileSync(path.join(dir, `${date}.jsonl`), log + '\n')
}
