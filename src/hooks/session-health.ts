#!/usr/bin/env node
import fs from 'fs'
import path from 'path'
import os from 'os'

interface HookInput { session_id: string; transcript_path?: string }

const CONTEXT_LIMIT = 200_000

function readStdin(): HookInput {
  try {
    const data = fs.readFileSync('/dev/stdin', 'utf8')
    return JSON.parse(data) as HookInput
  } catch { return { session_id: '' } }
}

function findTranscript(sessionId: string, transcriptPath?: string): string | null {
  if (transcriptPath && fs.existsSync(transcriptPath)) return transcriptPath
  const projectsDir = path.join(os.homedir(), '.claude', 'projects')
  if (!fs.existsSync(projectsDir)) return null
  for (const entry of fs.readdirSync(projectsDir)) {
    const candidate = path.join(projectsDir, entry, `${sessionId}.jsonl`)
    if (fs.existsSync(candidate)) return candidate
  }
  return null
}

function readLatestUsage(transcriptPath: string): { inputTokens: number; outputTokens: number; model: string } | null {
  const lines = fs.readFileSync(transcriptPath, 'utf8').trim().split('\n').filter(Boolean)
  for (let i = lines.length - 1; i >= 0; i--) {
    try {
      const obj = JSON.parse(lines[i]) as { message?: { role?: string; model?: string; usage?: Record<string, number> } }
      const msg = obj?.message
      if (msg?.role !== 'assistant' || !msg?.usage) continue
      const u = msg.usage
      return {
        inputTokens: (u.input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0),
        outputTokens: u.output_tokens ?? 0,
        model: msg.model ?? 'unknown',
      }
    } catch { /* skip */ }
  }
  return null
}

const input = readStdin()
const dataDir = path.join(os.homedir(), '.cc-catalyst')
fs.mkdirSync(dataDir, { recursive: true })

const transcriptPath = findTranscript(input.session_id, input.transcript_path)
if (transcriptPath) {
  const usage = readLatestUsage(transcriptPath)
  if (usage) {
    const budgetPercent = Math.round((usage.inputTokens / CONTEXT_LIMIT) * 100)
    const health = {
      sessionId: input.session_id,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      contextLimit: CONTEXT_LIMIT,
      budgetPercent,
      model: usage.model,
      updatedAt: new Date().toISOString(),
    }
    fs.writeFileSync(path.join(dataDir, 'session-health.json'), JSON.stringify(health, null, 2))

    if (budgetPercent >= 85) {
      process.stdout.write(JSON.stringify({
        hookSpecificOutput: {
          additionalContext: `[CATALYST] ⚠️ Context at ${budgetPercent}% (${usage.inputTokens.toLocaleString()}/${CONTEXT_LIMIT.toLocaleString()} tokens). Run /compact now.`
        }
      }))
    } else if (budgetPercent >= 70) {
      process.stdout.write(JSON.stringify({
        hookSpecificOutput: {
          additionalContext: `[CATALYST] 🟡 Context at ${budgetPercent}% — approaching limit.`
        }
      }))
    }
  }
}
