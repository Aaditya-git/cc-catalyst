# cc-catalyst v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild cc-catalyst as a skill + hook system that reduces Claude Code input tokens through active session health monitoring, token analytics, adaptive context learning, and a pre-session context planner — with zero proxy, zero daemon, one-command install.

**Architecture:** `npx cc-catalyst init` drops slash-command markdown files into `~/.claude/commands/`, patches `~/.claude/CLAUDE.md` with an activation block, adds `PostToolUse` and `Stop` hooks to `~/.claude/settings.json` (atomic, JSONC-safe), and copies self-contained hook scripts to `~/.cc-catalyst/hooks/`. All session data lives in `~/.cc-catalyst/`. No proxy, no daemon, no shell profile changes.

**Tech Stack:** TypeScript, Node.js ≥20, Commander, Chalk, Jest + ts-jest. Zero new runtime dependencies.

---

## File Map

### Delete (old proxy architecture)
- `src/proxy/` — entire directory
- `src/catalyst/` — entire directory
- `src/adaptive/` — entire directory
- `src/metrics/` — entire directory
- `tests/unit/proxy/`, `tests/unit/catalyst/`, `tests/unit/adaptive/` — old tests
- `tests/benchmarks/` — old benchmarks

### Create / Rewrite
```
src/
  types.ts                          rewrite
  cli/
    index.ts                        modify (remove proxy commands, add learn)
    commands/
      init.ts                       rewrite
      remove.ts                     rewrite
      audit.ts                      rewrite
      status.ts                     rewrite
      learn.ts                      new
  settings/
    reader.ts                       new — JSONC-tolerant settings.json reader
    hooks.ts                        new — hook add/remove/validate (idempotent)
  session/
    log-reader.ts                   new — parse JSONL, extract token usage
  analytics/
    token-counter.ts                new — char-based token estimation (chars/4)
    file-analyzer.ts                new — CLAUDE.md + MCP config token costs
    breakdown.ts                    new — full audit result builder
  learning/
    store.ts                        new — read/write ~/.cc-catalyst/projects/<hash>/learned.json
    analyzer.ts                     new — detect tool usage patterns from session logs
  hooks/
    session-health.ts               new — Stop hook: reads JSONL, writes health file
    tool-tracker.ts                 new — PostToolUse hook: logs tool calls
  skills/
    content.ts                      new — all skill/command markdown as TypeScript strings

tests/
  unit/
    settings/
      reader.test.ts                new
      hooks.test.ts                 new
    session/
      log-reader.test.ts            new
    analytics/
      token-counter.test.ts         new
      breakdown.test.ts             new
    learning/
      analyzer.test.ts              new
  integration/
    init.test.ts                    new
    remove.test.ts                  new
```

---

## Task 1: Clean slate

**Files:**
- Delete: `src/proxy/`, `src/catalyst/`, `src/adaptive/`, `src/metrics/`
- Delete: `tests/unit/proxy/`, `tests/unit/catalyst/`, `tests/unit/adaptive/`, `tests/benchmarks/`
- Modify: `package.json`

- [ ] **Step 1: Delete old source directories**

```bash
rm -rf src/proxy src/catalyst src/adaptive src/metrics
rm -rf tests/unit/proxy tests/unit/catalyst tests/unit/adaptive tests/benchmarks
rm -f tests/unit/types.test.ts
```

- [ ] **Step 2: Update package.json**

Replace the full contents of `package.json` with:

```json
{
  "name": "cc-catalyst",
  "version": "0.2.0",
  "description": "Session intelligence for Claude Code — active token management via skills and hooks",
  "main": "dist/cli/index.js",
  "bin": {
    "cc-catalyst": "dist/cli/index.js"
  },
  "files": [
    "dist",
    "README.md"
  ],
  "scripts": {
    "build": "tsc && chmod +x dist/cli/index.js",
    "build:watch": "tsc --watch",
    "cli": "node dist/cli/index.js",
    "prepublishOnly": "npm test && npm run build",
    "test": "jest --testPathPattern='tests/unit'",
    "test:integration": "jest --testPathPattern='tests/integration'",
    "typecheck": "tsc --noEmit"
  },
  "keywords": ["claude", "claude-code", "token", "optimization", "skills", "hooks", "anthropic"],
  "license": "MIT",
  "dependencies": {
    "commander": "^12.0.0",
    "chalk": "^5.3.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@types/jest": "^29.0.0",
    "jest": "^29.0.0",
    "ts-jest": "^29.0.0",
    "ts-node": "^10.9.0",
    "typescript": "^5.4.0"
  },
  "engines": {
    "node": ">=20.0.0"
  }
}
```

- [ ] **Step 3: Verify build still compiles (only src/types.ts and src/cli/ remain)**

```bash
cd /Users/Aaditya/Documents/Ideas/cc-catalyst && npm run typecheck 2>&1 | head -30
```

Expected: errors about missing imports in the old CLI commands — that's fine, we'll rewrite them next.

- [ ] **Step 4: Commit**

```bash
cd /Users/Aaditya/Documents/Ideas/cc-catalyst
git add -A
git commit -m "chore: delete proxy/catalyst/adaptive/metrics — v2 clean slate"
```

---

## Task 2: Core types

**Files:**
- Rewrite: `src/types.ts`
- Create: `tests/unit/types.test.ts` (skipped — types have no runtime logic to test)

- [ ] **Step 1: Rewrite src/types.ts**

```typescript
export interface SessionHealth {
  sessionId: string
  inputTokens: number
  outputTokens: number
  contextLimit: number
  budgetPercent: number
  model: string
  updatedAt: string
}

export interface ToolCallLog {
  tool: string
  sessionId: string
  timestamp: string
}

export interface LearnedPatterns {
  projectHash: string
  sessionCount: number
  neverUsed: string[]
  alwaysUsed: string[]
  updatedAt: string
}

export interface AuditResult {
  globalClaudeMd: number
  projectClaudeMd: number
  sessionHistory: number
  mcpDescriptions: number
  total: number
  recommendations: string[]
}

export interface HookInput {
  session_id: string
  transcript_path?: string
  tool_name?: string
  tool_input?: unknown
  tool_response?: unknown
  stop_hook_active?: boolean
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/Aaditya/Documents/Ideas/cc-catalyst
git add src/types.ts
git commit -m "feat: add v2 core types"
```

---

## Task 3: Settings reader (JSONC-tolerant)

**Files:**
- Create: `src/settings/reader.ts`
- Create: `tests/unit/settings/reader.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/settings/reader.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run test — verify it fails**

```bash
cd /Users/Aaditya/Documents/Ideas/cc-catalyst && npx jest tests/unit/settings/reader.test.ts --no-coverage 2>&1 | tail -10
```

Expected: `Cannot find module '../../../src/settings/reader'`

- [ ] **Step 3: Implement src/settings/reader.ts**

```typescript
import fs from 'fs'

export function stripJsonComments(src: string): string {
  let out = ''
  let i = 0
  let inString = false
  let stringChar = ''
  let inLine = false
  let inBlock = false

  while (i < src.length) {
    const c = src[i]
    const next = i + 1 < src.length ? src[i + 1] : ''

    if (inLine) {
      if (c === '\n') { inLine = false; out += c }
      i++; continue
    }
    if (inBlock) {
      if (c === '*' && next === '/') { inBlock = false; i += 2; continue }
      i++; continue
    }
    if (inString) {
      out += c
      if (c === '\\' && i + 1 < src.length) { out += src[i + 1]; i += 2; continue }
      if (c === stringChar) inString = false
      i++; continue
    }
    if (c === '"' || c === "'") { inString = true; stringChar = c; out += c; i++; continue }
    if (c === '/' && next === '/') { inLine = true; i += 2; continue }
    if (c === '/' && next === '*') { inBlock = true; i += 2; continue }
    out += c; i++
  }

  return out.replace(/,(\s*[}\]])/g, '$1')
}

export function readSettings(filePath: string): Record<string, unknown> {
  if (!fs.existsSync(filePath)) return {}
  const raw = fs.readFileSync(filePath, 'utf8').trim()
  if (!raw) return {}
  try { return JSON.parse(raw) as Record<string, unknown> } catch { /* try JSONC */ }
  try { return JSON.parse(stripJsonComments(raw)) as Record<string, unknown> } catch {
    process.stderr.write(`cc-catalyst: cannot parse ${filePath} — skipping\n`)
    return {}
  }
}
```

- [ ] **Step 4: Run test — verify it passes**

```bash
cd /Users/Aaditya/Documents/Ideas/cc-catalyst && npx jest tests/unit/settings/reader.test.ts --no-coverage 2>&1 | tail -5
```

Expected: `Tests: 7 passed`

- [ ] **Step 5: Commit**

```bash
cd /Users/Aaditya/Documents/Ideas/cc-catalyst
git add src/settings/reader.ts tests/unit/settings/reader.test.ts
git commit -m "feat: add JSONC-tolerant settings reader"
```

---

## Task 4: Hook management (add / remove / validate)

**Files:**
- Create: `src/settings/hooks.ts`
- Create: `tests/unit/settings/hooks.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/settings/hooks.test.ts`:

```typescript
import { hasHook, addHook, removeHooks, validateHooks } from '../../../src/settings/hooks'

const CC_MARKER = 'cc-catalyst'

function makeSettings(): Record<string, unknown> {
  return {}
}

describe('addHook', () => {
  it('adds a hook entry to the event array', () => {
    const s = makeSettings()
    const added = addHook(s, 'Stop', '/usr/local/bin/node /path/cc-catalyst/session-health.js')
    expect(added).toBe(true)
    const hooks = (s.hooks as Record<string, unknown[]>)['Stop']
    expect(Array.isArray(hooks)).toBe(true)
    expect(hooks).toHaveLength(1)
  })

  it('is idempotent — does not add duplicate', () => {
    const s = makeSettings()
    addHook(s, 'Stop', '/usr/local/bin/node /path/cc-catalyst/session-health.js')
    const added = addHook(s, 'Stop', '/usr/local/bin/node /path/cc-catalyst/session-health.js')
    expect(added).toBe(false)
    const hooks = (s.hooks as Record<string, unknown[]>)['Stop']
    expect(hooks).toHaveLength(1)
  })

  it('adds hooks for different events independently', () => {
    const s = makeSettings()
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
    const s = makeSettings()
    addHook(s, 'Stop', '/node /path/cc-catalyst/session-health.js')
    expect(hasHook(s, 'Stop')).toBe(true)
  })
})

describe('removeHooks', () => {
  it('removes all cc-catalyst hooks', () => {
    const s = makeSettings()
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
```

- [ ] **Step 2: Run test — verify it fails**

```bash
cd /Users/Aaditya/Documents/Ideas/cc-catalyst && npx jest tests/unit/settings/hooks.test.ts --no-coverage 2>&1 | tail -5
```

Expected: `Cannot find module '../../../src/settings/hooks'`

- [ ] **Step 3: Implement src/settings/hooks.ts**

```typescript
export const CC_MARKER = 'cc-catalyst'

type HookEntry = { hooks: Array<{ type: string; command?: string; timeout?: number }> }
type HooksMap = Record<string, HookEntry[]>

function getHooksMap(settings: Record<string, unknown>): HooksMap {
  if (!settings.hooks || typeof settings.hooks !== 'object') {
    settings.hooks = {}
  }
  return settings.hooks as HooksMap
}

export function hasHook(settings: Record<string, unknown>, event: string): boolean {
  const map = settings.hooks as HooksMap | undefined
  const arr = map?.[event]
  if (!Array.isArray(arr)) return false
  return arr.some(entry =>
    Array.isArray(entry?.hooks) &&
    entry.hooks.some(h => h?.type === 'command' && h?.command?.includes(CC_MARKER))
  )
}

export function addHook(settings: Record<string, unknown>, event: string, command: string): boolean {
  const map = getHooksMap(settings)
  if (!Array.isArray(map[event])) map[event] = []
  if (hasHook(settings, event)) return false
  map[event].push({ hooks: [{ type: 'command', command, timeout: 10000 }] })
  return true
}

export function removeHooks(settings: Record<string, unknown>): number {
  const map = settings.hooks as HooksMap | undefined
  if (!map) return 0
  let removed = 0
  for (const event of Object.keys(map)) {
    if (!Array.isArray(map[event])) { delete map[event]; continue }
    const before = map[event].length
    map[event] = map[event].filter(entry =>
      !entry?.hooks?.some(h => h?.type === 'command' && h?.command?.includes(CC_MARKER))
    )
    removed += before - map[event].length
    if (map[event].length === 0) delete map[event]
  }
  if (Object.keys(map).length === 0) delete settings.hooks
  return removed
}

export function validateHooks(settings: Record<string, unknown>): void {
  const map = settings.hooks as HooksMap | undefined
  if (!map) return
  for (const event of Object.keys(map)) {
    if (!Array.isArray(map[event])) { delete map[event]; continue }
    map[event] = map[event].filter(entry => {
      if (!entry?.hooks || !Array.isArray(entry.hooks)) return false
      entry.hooks = entry.hooks.filter(
        h => h?.type === 'command' && typeof h?.command === 'string' && h.command.length > 0
      )
      return entry.hooks.length > 0
    })
    if (map[event].length === 0) delete map[event]
  }
  if (Object.keys(map).length === 0) delete settings.hooks
}
```

- [ ] **Step 4: Run test — verify it passes**

```bash
cd /Users/Aaditya/Documents/Ideas/cc-catalyst && npx jest tests/unit/settings/hooks.test.ts --no-coverage 2>&1 | tail -5
```

Expected: `Tests: 8 passed`

- [ ] **Step 5: Commit**

```bash
cd /Users/Aaditya/Documents/Ideas/cc-catalyst
git add src/settings/hooks.ts tests/unit/settings/hooks.test.ts
git commit -m "feat: add hook management (add/remove/validate, idempotent)"
```

---

## Task 5: Session log reader

**Files:**
- Create: `src/session/log-reader.ts`
- Create: `tests/unit/session/log-reader.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/session/log-reader.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run test — verify it fails**

```bash
cd /Users/Aaditya/Documents/Ideas/cc-catalyst && npx jest tests/unit/session/log-reader.test.ts --no-coverage 2>&1 | tail -5
```

Expected: `Cannot find module '../../../src/session/log-reader'`

- [ ] **Step 3: Implement src/session/log-reader.ts**

```typescript
import fs from 'fs'

export interface UsageResult {
  inputTokens: number
  outputTokens: number
  model: string
}

export function readLatestUsage(transcriptPath: string): UsageResult | null {
  if (!fs.existsSync(transcriptPath)) return null
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
    } catch { /* skip malformed lines */ }
  }
  return null
}

export function readAllToolCalls(transcriptPath: string): string[] {
  if (!fs.existsSync(transcriptPath)) return []
  const tools: string[] = []
  const lines = fs.readFileSync(transcriptPath, 'utf8').trim().split('\n').filter(Boolean)
  for (const line of lines) {
    try {
      const obj = JSON.parse(line) as { message?: { content?: Array<{ type: string; name?: string }> } }
      const content = obj?.message?.content
      if (!Array.isArray(content)) continue
      for (const block of content) {
        if (block?.type === 'tool_use' && block?.name) tools.push(block.name)
      }
    } catch { /* skip */ }
  }
  return tools
}
```

- [ ] **Step 4: Run test — verify it passes**

```bash
cd /Users/Aaditya/Documents/Ideas/cc-catalyst && npx jest tests/unit/session/log-reader.test.ts --no-coverage 2>&1 | tail -5
```

Expected: `Tests: 6 passed`

- [ ] **Step 5: Commit**

```bash
cd /Users/Aaditya/Documents/Ideas/cc-catalyst
git add src/session/log-reader.ts tests/unit/session/log-reader.test.ts
git commit -m "feat: add session log reader (token usage + tool call extraction)"
```

---

## Task 6: Token counter + file analyzer

**Files:**
- Create: `src/analytics/token-counter.ts`
- Create: `src/analytics/file-analyzer.ts`
- Create: `tests/unit/analytics/token-counter.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/analytics/token-counter.test.ts`:

```typescript
import { estimateTokens, CHARS_PER_TOKEN } from '../../../src/analytics/token-counter'

describe('estimateTokens', () => {
  it('returns 0 for empty string', () => {
    expect(estimateTokens('')).toBe(0)
  })

  it('estimates tokens as ceil(chars / CHARS_PER_TOKEN)', () => {
    const text = 'a'.repeat(100)
    expect(estimateTokens(text)).toBe(Math.ceil(100 / CHARS_PER_TOKEN))
  })

  it('rounds up for partial tokens', () => {
    expect(estimateTokens('abc')).toBe(1) // 3 chars / 4 = 0.75 → ceil = 1
  })
})
```

- [ ] **Step 2: Run test — verify it fails**

```bash
cd /Users/Aaditya/Documents/Ideas/cc-catalyst && npx jest tests/unit/analytics/token-counter.test.ts --no-coverage 2>&1 | tail -5
```

Expected: `Cannot find module '../../../src/analytics/token-counter'`

- [ ] **Step 3: Implement src/analytics/token-counter.ts**

```typescript
export const CHARS_PER_TOKEN = 4

export function estimateTokens(text: string): number {
  if (!text) return 0
  return Math.ceil(text.length / CHARS_PER_TOKEN)
}
```

- [ ] **Step 4: Implement src/analytics/file-analyzer.ts**

```typescript
import fs from 'fs'
import path from 'path'
import os from 'os'
import { estimateTokens } from './token-counter'
import { readSettings } from '../settings/reader'

export function analyzeGlobalClaudeMd(): number {
  const p = path.join(os.homedir(), '.claude', 'CLAUDE.md')
  if (!fs.existsSync(p)) return 0
  return estimateTokens(fs.readFileSync(p, 'utf8'))
}

export function analyzeProjectClaudeMd(projectDir: string): number {
  let total = 0
  for (const rel of ['CLAUDE.md', '.claude/CLAUDE.md']) {
    const p = path.join(projectDir, rel)
    if (fs.existsSync(p)) total += estimateTokens(fs.readFileSync(p, 'utf8'))
  }
  return total
}

export function analyzeMcpDescriptions(): number {
  const settingsPath = path.join(os.homedir(), '.claude', 'settings.json')
  const settings = readSettings(settingsPath)
  const mcp = settings?.mcpServers
  if (!mcp || typeof mcp !== 'object') return 0
  return estimateTokens(JSON.stringify(mcp))
}

export function analyzeSessionHistory(projectHash: string, sessionId?: string): number {
  const projectsDir = path.join(os.homedir(), '.claude', 'projects', projectHash)
  if (!fs.existsSync(projectsDir)) return 0
  let totalInputTokens = 0
  const files = fs.readdirSync(projectsDir).filter(f => f.endsWith('.jsonl'))
  const targets = sessionId ? files.filter(f => f.startsWith(sessionId)) : files
  for (const file of targets) {
    const lines = fs.readFileSync(path.join(projectsDir, file), 'utf8').trim().split('\n').filter(Boolean)
    for (const line of lines) {
      try {
        const obj = JSON.parse(line) as { message?: { role?: string; usage?: Record<string, number> } }
        const u = obj?.message?.usage
        if (!u || obj?.message?.role !== 'assistant') continue
        totalInputTokens += (u.input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0)
      } catch { /* skip */ }
    }
  }
  return totalInputTokens
}
```

- [ ] **Step 5: Run token counter tests — verify pass**

```bash
cd /Users/Aaditya/Documents/Ideas/cc-catalyst && npx jest tests/unit/analytics/token-counter.test.ts --no-coverage 2>&1 | tail -5
```

Expected: `Tests: 3 passed`

- [ ] **Step 6: Commit**

```bash
cd /Users/Aaditya/Documents/Ideas/cc-catalyst
git add src/analytics/ tests/unit/analytics/token-counter.test.ts
git commit -m "feat: add token counter and file analyzer"
```

---

## Task 7: Audit breakdown engine

**Files:**
- Create: `src/analytics/breakdown.ts`
- Create: `tests/unit/analytics/breakdown.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/analytics/breakdown.test.ts`:

```typescript
import { buildBreakdown } from '../../../src/analytics/breakdown'
import type { AuditResult } from '../../../src/types'

describe('buildBreakdown', () => {
  it('sums all parts into total', () => {
    const result = buildBreakdown({
      globalClaudeMd: 1000,
      projectClaudeMd: 500,
      sessionHistory: 2000,
      mcpDescriptions: 300,
    })
    expect(result.total).toBe(3800)
  })

  it('generates recommendations for expensive components (>500 tokens)', () => {
    const result = buildBreakdown({
      globalClaudeMd: 2000,
      projectClaudeMd: 100,
      sessionHistory: 5000,
      mcpDescriptions: 0,
    })
    expect(result.recommendations.length).toBeGreaterThan(0)
    expect(result.recommendations.some(r => r.includes('CLAUDE.md'))).toBe(true)
  })

  it('returns no recommendations when all components are small', () => {
    const result = buildBreakdown({
      globalClaudeMd: 100,
      projectClaudeMd: 100,
      sessionHistory: 100,
      mcpDescriptions: 100,
    })
    expect(result.recommendations).toHaveLength(0)
  })

  it('sorts recommendations by cost descending', () => {
    const result = buildBreakdown({
      globalClaudeMd: 3000,
      projectClaudeMd: 100,
      sessionHistory: 8000,
      mcpDescriptions: 0,
    })
    const firstMentionsHistory = result.recommendations[0].includes('Session history')
    expect(firstMentionsHistory).toBe(true)
  })
})
```

- [ ] **Step 2: Run test — verify it fails**

```bash
cd /Users/Aaditya/Documents/Ideas/cc-catalyst && npx jest tests/unit/analytics/breakdown.test.ts --no-coverage 2>&1 | tail -5
```

Expected: `Cannot find module '../../../src/analytics/breakdown'`

- [ ] **Step 3: Implement src/analytics/breakdown.ts**

```typescript
import type { AuditResult } from '../types'

type BreakdownInput = Omit<AuditResult, 'total' | 'recommendations'>

const LABELS: Record<keyof BreakdownInput, string> = {
  globalClaudeMd: 'Global CLAUDE.md',
  projectClaudeMd: 'Project CLAUDE.md',
  sessionHistory: 'Session history',
  mcpDescriptions: 'MCP tool descriptions',
}

const THRESHOLD = 500

export function buildBreakdown(parts: BreakdownInput): AuditResult {
  const total = Object.values(parts).reduce((a, b) => a + b, 0)

  const entries = Object.entries(parts) as [keyof BreakdownInput, number][]
  entries.sort((a, b) => b[1] - a[1])

  const recommendations: string[] = []
  for (const [key, tokens] of entries) {
    if (tokens > THRESHOLD) {
      recommendations.push(`${LABELS[key]} is ${tokens.toLocaleString()} tokens — consider reducing`)
    }
  }

  return { ...parts, total, recommendations }
}
```

- [ ] **Step 4: Run test — verify it passes**

```bash
cd /Users/Aaditya/Documents/Ideas/cc-catalyst && npx jest tests/unit/analytics/breakdown.test.ts --no-coverage 2>&1 | tail -5
```

Expected: `Tests: 4 passed`

- [ ] **Step 5: Commit**

```bash
cd /Users/Aaditya/Documents/Ideas/cc-catalyst
git add src/analytics/breakdown.ts tests/unit/analytics/breakdown.test.ts
git commit -m "feat: add audit breakdown engine with ranked recommendations"
```

---

## Task 8: Learning system

**Files:**
- Create: `src/learning/store.ts`
- Create: `src/learning/analyzer.ts`
- Create: `tests/unit/learning/analyzer.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/learning/analyzer.test.ts`:

```typescript
import { analyzePatterns } from '../../../src/learning/analyzer'
import type { ToolCallLog } from '../../../src/types'

function logs(tool: string, sessions: string[]): ToolCallLog[] {
  return sessions.map(sessionId => ({ tool, sessionId, timestamp: new Date().toISOString() }))
}

describe('analyzePatterns', () => {
  it('returns empty results when fewer than minSessions', () => {
    const result = analyzePatterns(logs('Read', ['s1', 's2']), 3)
    expect(result.neverUsed).toEqual([])
    expect(result.alwaysUsed).toEqual([])
    expect(result.sessionCount).toBe(2)
  })

  it('marks tools used in all sessions as alwaysUsed', () => {
    const allSessions = ['s1', 's2', 's3', 's4', 's5']
    const result = analyzePatterns(logs('Read', allSessions), 3)
    expect(result.alwaysUsed).toContain('Read')
  })

  it('marks tools never used as neverUsed after enough sessions', () => {
    const allSessions = ['s1', 's2', 's3', 's4', 's5']
    const mixed = [
      ...logs('Read', allSessions),
      ...logs('WebSearch', ['s1']),
    ]
    const result = analyzePatterns(mixed, 3)
    expect(result.neverUsed).not.toContain('Read')
    expect(result.alwaysUsed).toContain('Read')
  })

  it('counts unique sessions', () => {
    const mixed = [
      ...logs('Read', ['s1', 's1', 's2']),
    ]
    const result = analyzePatterns(mixed, 1)
    expect(result.sessionCount).toBe(2)
  })
})
```

- [ ] **Step 2: Run test — verify it fails**

```bash
cd /Users/Aaditya/Documents/Ideas/cc-catalyst && npx jest tests/unit/learning/analyzer.test.ts --no-coverage 2>&1 | tail -5
```

Expected: `Cannot find module '../../../src/learning/analyzer'`

- [ ] **Step 3: Implement src/learning/analyzer.ts**

```typescript
import type { ToolCallLog, LearnedPatterns } from '../types'

export function analyzePatterns(
  logs: ToolCallLog[],
  minSessions = 3
): { neverUsed: string[]; alwaysUsed: string[]; sessionCount: number } {
  const sessions = new Set(logs.map(l => l.sessionId))
  const sessionCount = sessions.size

  if (sessionCount < minSessions) {
    return { neverUsed: [], alwaysUsed: [], sessionCount }
  }

  const toolSessions = new Map<string, Set<string>>()
  for (const log of logs) {
    if (!toolSessions.has(log.tool)) toolSessions.set(log.tool, new Set())
    toolSessions.get(log.tool)!.add(log.sessionId)
  }

  const neverUsed: string[] = []
  const alwaysUsed: string[] = []

  for (const [tool, usedIn] of toolSessions) {
    const ratio = usedIn.size / sessionCount
    if (ratio === 0) neverUsed.push(tool)
    if (ratio >= 0.9) alwaysUsed.push(tool)
  }

  return { neverUsed, alwaysUsed, sessionCount }
}
```

- [ ] **Step 4: Implement src/learning/store.ts**

```typescript
import fs from 'fs'
import path from 'path'
import os from 'os'
import type { ToolCallLog, LearnedPatterns } from '../types'

const DATA_DIR = path.join(os.homedir(), '.cc-catalyst')

export function dataDir(): string { return DATA_DIR }

export function sessionsDir(): string { return path.join(DATA_DIR, 'sessions') }

export function projectLearnedPath(projectHash: string): string {
  return path.join(DATA_DIR, 'projects', projectHash, 'learned.json')
}

export function logToolCall(log: ToolCallLog): void {
  const dir = sessionsDir()
  fs.mkdirSync(dir, { recursive: true })
  const date = new Date().toISOString().slice(0, 10)
  const file = path.join(dir, `${date}.jsonl`)
  fs.appendFileSync(file, JSON.stringify(log) + '\n')
}

export function readSessionLogs(): ToolCallLog[] {
  const dir = sessionsDir()
  if (!fs.existsSync(dir)) return []
  const logs: ToolCallLog[] = []
  for (const file of fs.readdirSync(dir).filter(f => f.endsWith('.jsonl'))) {
    for (const line of fs.readFileSync(path.join(dir, file), 'utf8').trim().split('\n').filter(Boolean)) {
      try { logs.push(JSON.parse(line) as ToolCallLog) } catch { /* skip */ }
    }
  }
  return logs
}

export function readLearned(projectHash: string): LearnedPatterns | null {
  const p = projectLearnedPath(projectHash)
  if (!fs.existsSync(p)) return null
  try { return JSON.parse(fs.readFileSync(p, 'utf8')) as LearnedPatterns } catch { return null }
}

export function writeLearned(patterns: LearnedPatterns): void {
  const p = projectLearnedPath(patterns.projectHash)
  fs.mkdirSync(path.dirname(p), { recursive: true })
  fs.writeFileSync(p, JSON.stringify(patterns, null, 2))
}

export function deleteLearned(projectHash: string): void {
  const p = projectLearnedPath(projectHash)
  if (fs.existsSync(p)) fs.unlinkSync(p)
}
```

- [ ] **Step 5: Run test — verify it passes**

```bash
cd /Users/Aaditya/Documents/Ideas/cc-catalyst && npx jest tests/unit/learning/analyzer.test.ts --no-coverage 2>&1 | tail -5
```

Expected: `Tests: 4 passed`

- [ ] **Step 6: Commit**

```bash
cd /Users/Aaditya/Documents/Ideas/cc-catalyst
git add src/learning/ tests/unit/learning/analyzer.test.ts
git commit -m "feat: add adaptive learning system (analyzer + store)"
```

---

## Task 9: Hook scripts (session-health + tool-tracker)

These are self-contained Node.js scripts (no imports from cc-catalyst package). They get compiled to `dist/hooks/` and copied to `~/.cc-catalyst/hooks/` by `init`.

**Files:**
- Create: `src/hooks/session-health.ts`
- Create: `src/hooks/tool-tracker.ts`

- [ ] **Step 1: Create src/hooks/session-health.ts**

```typescript
#!/usr/bin/env node
/**
 * Stop hook — runs after every Claude response.
 * Reads the session JSONL to compute token budget, writes session-health.json.
 * Warns Claude via stdout JSON when budget exceeds thresholds.
 */
import fs from 'fs'
import path from 'path'
import os from 'os'

interface HookInput { session_id: string; transcript_path?: string }
interface SessionHealth {
  sessionId: string; inputTokens: number; outputTokens: number
  contextLimit: number; budgetPercent: number; model: string; updatedAt: string
}

const CONTEXT_LIMIT = 200_000

function readStdin(): HookInput {
  try {
    return JSON.parse(fs.readFileSync('/dev/stdin', 'utf8')) as HookInput
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
    const health: SessionHealth = {
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
```

- [ ] **Step 2: Create src/hooks/tool-tracker.ts**

```typescript
#!/usr/bin/env node
/**
 * PostToolUse hook — runs after every tool call.
 * Logs the tool name + session ID to ~/.cc-catalyst/sessions/YYYY-MM-DD.jsonl
 * for adaptive learning.
 */
import fs from 'fs'
import path from 'path'
import os from 'os'

interface HookInput { session_id: string; tool_name?: string }

function readStdin(): HookInput {
  try {
    return JSON.parse(fs.readFileSync('/dev/stdin', 'utf8')) as HookInput
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
```

- [ ] **Step 3: Build and verify hook scripts compile**

```bash
cd /Users/Aaditya/Documents/Ideas/cc-catalyst && npm run build 2>&1 | tail -10
```

Expected: no errors, `dist/hooks/session-health.js` and `dist/hooks/tool-tracker.js` created.

```bash
ls dist/hooks/
```

Expected: `session-health.js  session-health.js.map  tool-tracker.js  tool-tracker.js.map`

- [ ] **Step 4: Commit**

```bash
cd /Users/Aaditya/Documents/Ideas/cc-catalyst
git add src/hooks/ dist/hooks/
git commit -m "feat: add session-health and tool-tracker hook scripts"
```

---

## Task 10: Skill content

**Files:**
- Create: `src/skills/content.ts`

- [ ] **Step 1: Create src/skills/content.ts**

```typescript
export const CLAUDE_MD_BLOCK = `
<!-- cc-catalyst-begin -->
## cc-catalyst — Session Intelligence

At the start of each session, use the Read tool to check \`~/.cc-catalyst/session-health.json\` if it exists.
Display: \`[CATALYST] ⚡ {budgetPercent}% budget · {inputTokens}/{contextLimit} tokens\`

Budget guidance:
- ≥ 85%: strongly suggest running /compact immediately
- 70–84%: mention budget is climbing, suggest /compact soon
- < 70%: no action needed

Also check \`~/.cc-catalyst/projects/<hash>/learned.json\` if it exists (project hash = current working directory path with every \`/\` replaced by \`-\`, prefixed with \`-\`). Tell the user which tools have been suppressed based on past sessions.

Task type detection from first message:
- "fix" / "bug" / "error" / "debug" → debugging: prioritize Read + Bash
- "implement" / "build" / "add" → coding: prioritize Edit + Write  
- "docs" / "readme" / "explain" → docs: prioritize Read + Write
- Otherwise: no special context loading

Context window = 200,000 tokens for all Claude models.
<!-- cc-catalyst-end -->
`

export const CATALYST_AUDIT_CMD = `# /catalyst-audit

Show a token cost breakdown for this project.

Run this command in your terminal and report the output:

\`\`\`bash
npx cc-catalyst audit
\`\`\`

Display the full breakdown table and all recommendations to the user.
`

export const CATALYST_COMPRESS_CMD = `# /catalyst-compress

Compress CLAUDE.md files to reduce input tokens on every future session.

Steps:
1. Read \`~/.claude/CLAUDE.md\` (global) and the project's \`CLAUDE.md\` / \`.claude/CLAUDE.md\`
2. For each file: rewrite it to be maximally concise while preserving ALL information
   - Remove filler phrases ("Please", "Make sure to", "You should", "It is important to")
   - Use bullet points instead of paragraphs
   - Use imperative form ("Run tests before commit" not "You should always run tests before committing")
   - Preserve all code blocks, paths, commands, and technical names exactly
   - Do NOT remove any instructions or facts — only compress the prose
3. Show a before/after token estimate
4. Ask user to confirm before writing changes
5. Write compressed versions back to the same files
`

export const CATALYST_STATUS_CMD = `# /catalyst-status

Show current session health and learned patterns.

Steps:
1. Read \`~/.cc-catalyst/session-health.json\` with the Read tool and display:
   - Budget percentage and token counts
   - Model name
   - Last updated time
2. Compute the project hash (current working directory path: replace \`/\` with \`-\`, prefix with \`-\`)
3. Read \`~/.cc-catalyst/projects/<hash>/learned.json\` if it exists and display:
   - Session count
   - Always-used tools
   - Never-used tools (suppressed)
   - Last updated time
4. If neither file exists: display "No session data yet. cc-catalyst will start learning after your first session."
`

export const CATALYST_LEARN_CMD = `# /catalyst-learn

Manage learned tool usage patterns for this project.

Usage: \`/catalyst-learn [show|reset|forget <tool>]\`

- \`show\` (default): Display learned patterns (run /catalyst-status)
- \`reset\`: Run \`npx cc-catalyst learn reset\` to clear all learned data for this project
- \`forget <tool>\`: Run \`npx cc-catalyst learn forget <tool>\` to un-suppress a specific tool

Always confirm with the user before running reset or forget commands.
`
```

- [ ] **Step 2: Verify it compiles**

```bash
cd /Users/Aaditya/Documents/Ideas/cc-catalyst && npm run typecheck 2>&1 | tail -5
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/Aaditya/Documents/Ideas/cc-catalyst
git add src/skills/content.ts
git commit -m "feat: add skill and command markdown content"
```

---

## Task 11: Init command

**Files:**
- Rewrite: `src/cli/commands/init.ts`
- Create: `tests/integration/init.test.ts`

- [ ] **Step 1: Write the failing integration test**

Create `tests/integration/init.test.ts`:

```typescript
import fs from 'fs'
import os from 'os'
import path from 'path'

// We test the individual functions, not the CLI command directly
import { buildHookCommand } from '../../src/cli/commands/init'

describe('buildHookCommand', () => {
  it('returns absolute node path + absolute script path', () => {
    const cmd = buildHookCommand('/home/user/.cc-catalyst/hooks/session-health.js')
    expect(cmd).toContain('node')
    expect(cmd).toContain('session-health.js')
    expect(cmd.startsWith('"')).toBe(true)
  })
})
```

- [ ] **Step 2: Run test — verify it fails**

```bash
cd /Users/Aaditya/Documents/Ideas/cc-catalyst && npx jest tests/integration/init.test.ts --no-coverage 2>&1 | tail -5
```

Expected: `Cannot find module '../../src/cli/commands/init'`

- [ ] **Step 3: Rewrite src/cli/commands/init.ts**

```typescript
import { Command } from 'commander'
import fs from 'fs'
import path from 'path'
import os from 'os'
import chalk from 'chalk'
import { readSettings } from '../../settings/reader'
import { addHook, validateHooks } from '../../settings/hooks'
import {
  CLAUDE_MD_BLOCK,
  CATALYST_AUDIT_CMD,
  CATALYST_COMPRESS_CMD,
  CATALYST_STATUS_CMD,
  CATALYST_LEARN_CMD,
} from '../../skills/content'

const CLAUDE_DIR = path.join(os.homedir(), '.claude')
const DATA_DIR = path.join(os.homedir(), '.cc-catalyst')
const HOOKS_DIR = path.join(DATA_DIR, 'hooks')
const COMMANDS_DIR = path.join(CLAUDE_DIR, 'commands')
const SETTINGS_PATH = path.join(CLAUDE_DIR, 'settings.json')
const CLAUDE_MD_PATH = path.join(CLAUDE_DIR, 'CLAUDE.md')
const CC_MD_BEGIN = '<!-- cc-catalyst-begin -->'
const CC_MD_END = '<!-- cc-catalyst-end -->'

export function buildHookCommand(scriptPath: string): string {
  return `"${process.execPath}" "${scriptPath}"`
}

function installHookScripts(): void {
  fs.mkdirSync(HOOKS_DIR, { recursive: true })
  const distHooksDir = path.join(__dirname, '../../hooks')
  for (const script of ['session-health.js', 'tool-tracker.js']) {
    const src = path.join(distHooksDir, script)
    const dst = path.join(HOOKS_DIR, script)
    if (fs.existsSync(src)) fs.copyFileSync(src, dst)
  }
}

function installSlashCommands(): void {
  fs.mkdirSync(COMMANDS_DIR, { recursive: true })
  const commands: Record<string, string> = {
    'catalyst-audit.md': CATALYST_AUDIT_CMD,
    'catalyst-compress.md': CATALYST_COMPRESS_CMD,
    'catalyst-status.md': CATALYST_STATUS_CMD,
    'catalyst-learn.md': CATALYST_LEARN_CMD,
  }
  for (const [file, content] of Object.entries(commands)) {
    fs.writeFileSync(path.join(COMMANDS_DIR, file), content.trim())
  }
}

function installClaudeMdBlock(): void {
  const existing = fs.existsSync(CLAUDE_MD_PATH)
    ? fs.readFileSync(CLAUDE_MD_PATH, 'utf8')
    : ''
  if (existing.includes(CC_MD_BEGIN)) return
  fs.writeFileSync(CLAUDE_MD_PATH, existing + '\n' + CLAUDE_MD_BLOCK.trim() + '\n')
}

function installHooks(): void {
  const settings = readSettings(SETTINGS_PATH)
  validateHooks(settings)
  addHook(settings, 'Stop', buildHookCommand(path.join(HOOKS_DIR, 'session-health.js')))
  addHook(settings, 'PostToolUse', buildHookCommand(path.join(HOOKS_DIR, 'tool-tracker.js')))
  fs.mkdirSync(CLAUDE_DIR, { recursive: true })

  const crypto = require('crypto') as typeof import('crypto')
  const tmp = SETTINGS_PATH + `.${process.pid}.${crypto.randomBytes(4).toString('hex')}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(settings, null, 2) + '\n', { mode: 0o600 })
  fs.renameSync(tmp, SETTINGS_PATH)
}

export const initCommand = new Command('init')
  .description('Install cc-catalyst — adds skills, hooks, and session intelligence')
  .action(() => {
    console.log(chalk.cyan('\nInstalling cc-catalyst...\n'))

    installHookScripts()
    console.log(chalk.green('✓ Hook scripts installed'))

    installSlashCommands()
    console.log(chalk.green('✓ Slash commands installed (/catalyst-audit, /catalyst-compress, /catalyst-status, /catalyst-learn)'))

    installClaudeMdBlock()
    console.log(chalk.green('✓ CLAUDE.md activation block added'))

    installHooks()
    console.log(chalk.green('✓ Hooks added to settings.json (Stop + PostToolUse)'))

    console.log(chalk.bold('\n✅ cc-catalyst is active. Restart Claude Code to apply.\n'))
    console.log('  Run ' + chalk.cyan('cc-catalyst status') + ' to verify.')
    console.log('  Run ' + chalk.cyan('/catalyst-audit') + ' inside Claude Code for token breakdown.\n')
  })
```

- [ ] **Step 4: Run integration test — verify it passes**

```bash
cd /Users/Aaditya/Documents/Ideas/cc-catalyst && npx jest tests/integration/init.test.ts --no-coverage 2>&1 | tail -5
```

Expected: `Tests: 1 passed`

- [ ] **Step 5: Commit**

```bash
cd /Users/Aaditya/Documents/Ideas/cc-catalyst
git add src/cli/commands/init.ts tests/integration/init.test.ts
git commit -m "feat: rewrite init command — skills, hooks, CLAUDE.md block (no proxy)"
```

---

## Task 12: Remove command

**Files:**
- Rewrite: `src/cli/commands/remove.ts`
- Create: `tests/integration/remove.test.ts`

- [ ] **Step 1: Write the failing integration test**

Create `tests/integration/remove.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run test — verify it fails**

```bash
cd /Users/Aaditya/Documents/Ideas/cc-catalyst && npx jest tests/integration/remove.test.ts --no-coverage 2>&1 | tail -5
```

Expected: `Cannot find module '../../src/cli/commands/remove'`

- [ ] **Step 3: Rewrite src/cli/commands/remove.ts**

```typescript
import { Command } from 'commander'
import fs from 'fs'
import path from 'path'
import os from 'os'
import chalk from 'chalk'
import { readSettings } from '../../settings/reader'
import { removeHooks, validateHooks } from '../../settings/hooks'

const CLAUDE_DIR = path.join(os.homedir(), '.claude')
const DATA_DIR = path.join(os.homedir(), '.cc-catalyst')
const COMMANDS_DIR = path.join(CLAUDE_DIR, 'commands')
const SETTINGS_PATH = path.join(CLAUDE_DIR, 'settings.json')
const CLAUDE_MD_PATH = path.join(CLAUDE_DIR, 'CLAUDE.md')

export function removeClaudeMdBlock(content: string): string {
  return content
    .replace(/\n?<!-- cc-catalyst-begin -->[\s\S]*?<!-- cc-catalyst-end -->\n?/g, '')
}

export const removeCommand = new Command('remove')
  .description('Uninstall cc-catalyst — removes skills, hooks, and CLAUDE.md block')
  .action(() => {
    console.log(chalk.cyan('\nRemoving cc-catalyst...\n'))

    // Remove slash commands
    for (const file of ['catalyst-audit.md', 'catalyst-compress.md', 'catalyst-status.md', 'catalyst-learn.md']) {
      const p = path.join(COMMANDS_DIR, file)
      if (fs.existsSync(p)) fs.unlinkSync(p)
    }
    console.log(chalk.green('✓ Slash commands removed'))

    // Remove CLAUDE.md block
    if (fs.existsSync(CLAUDE_MD_PATH)) {
      const content = fs.readFileSync(CLAUDE_MD_PATH, 'utf8')
      fs.writeFileSync(CLAUDE_MD_PATH, removeClaudeMdBlock(content))
    }
    console.log(chalk.green('✓ CLAUDE.md activation block removed'))

    // Remove hooks from settings.json
    if (fs.existsSync(SETTINGS_PATH)) {
      const settings = readSettings(SETTINGS_PATH)
      validateHooks(settings)
      removeHooks(settings)
      const crypto = require('crypto') as typeof import('crypto')
      const tmp = SETTINGS_PATH + `.${process.pid}.${crypto.randomBytes(4).toString('hex')}.tmp`
      fs.writeFileSync(tmp, JSON.stringify(settings, null, 2) + '\n', { mode: 0o600 })
      fs.renameSync(tmp, SETTINGS_PATH)
    }
    console.log(chalk.green('✓ Hooks removed from settings.json'))

    // Remove hook scripts
    const hooksDir = path.join(DATA_DIR, 'hooks')
    if (fs.existsSync(hooksDir)) {
      fs.rmSync(hooksDir, { recursive: true })
    }
    console.log(chalk.green('✓ Hook scripts removed'))

    console.log(chalk.bold('\n✅ cc-catalyst removed. Restart Claude Code to apply.\n'))
  })
```

- [ ] **Step 4: Run test — verify it passes**

```bash
cd /Users/Aaditya/Documents/Ideas/cc-catalyst && npx jest tests/integration/remove.test.ts --no-coverage 2>&1 | tail -5
```

Expected: `Tests: 2 passed`

- [ ] **Step 5: Commit**

```bash
cd /Users/Aaditya/Documents/Ideas/cc-catalyst
git add src/cli/commands/remove.ts tests/integration/remove.test.ts
git commit -m "feat: rewrite remove command — clean uninstall of all cc-catalyst artifacts"
```

---

## Task 13: Audit command

**Files:**
- Rewrite: `src/cli/commands/audit.ts`

- [ ] **Step 1: Rewrite src/cli/commands/audit.ts**

```typescript
import { Command } from 'commander'
import path from 'path'
import os from 'os'
import chalk from 'chalk'
import { analyzeGlobalClaudeMd, analyzeProjectClaudeMd, analyzeMcpDescriptions, analyzeSessionHistory } from '../../analytics/file-analyzer'
import { buildBreakdown } from '../../analytics/breakdown'

function projectHash(dir: string): string {
  return dir.replace(/\//g, '-')
}

function bar(tokens: number, total: number, width = 20): string {
  const filled = total > 0 ? Math.round((tokens / total) * width) : 0
  return '█'.repeat(filled) + '░'.repeat(width - filled)
}

function pct(tokens: number, total: number): string {
  return total > 0 ? `${Math.round((tokens / total) * 100)}%` : '0%'
}

export const auditCommand = new Command('audit')
  .description('Show a token cost breakdown for the current project')
  .action(() => {
    const cwd = process.cwd()
    const hash = projectHash(cwd)

    const parts = {
      globalClaudeMd: analyzeGlobalClaudeMd(),
      projectClaudeMd: analyzeProjectClaudeMd(cwd),
      sessionHistory: analyzeSessionHistory(hash),
      mcpDescriptions: analyzeMcpDescriptions(),
    }

    const result = buildBreakdown(parts)

    console.log(chalk.bold('\nToken Cost Breakdown — ' + path.basename(cwd)))
    console.log('─'.repeat(60))

    const rows: [string, number][] = [
      ['Global CLAUDE.md', result.globalClaudeMd],
      ['Project CLAUDE.md', result.projectClaudeMd],
      ['Session history (cumulative)', result.sessionHistory],
      ['MCP tool descriptions (est.)', result.mcpDescriptions],
    ]

    for (const [label, tokens] of rows) {
      const b = bar(tokens, result.total)
      const p = pct(tokens, result.total)
      console.log(`${label.padEnd(32)} ${String(tokens.toLocaleString()).padStart(7)} tokens  ${b}  ${p}`)
    }

    console.log('─'.repeat(60))
    console.log(`${'Total'.padEnd(32)} ${String(result.total.toLocaleString()).padStart(7)} tokens\n`)

    if (result.recommendations.length > 0) {
      console.log(chalk.yellow('Recommendations:'))
      result.recommendations.forEach((r, i) => console.log(`  ${i + 1}. ${r}`))
      console.log()
    } else {
      console.log(chalk.green('✓ Token usage looks healthy.\n'))
    }
  })
```

- [ ] **Step 2: Build and smoke-test**

```bash
cd /Users/Aaditya/Documents/Ideas/cc-catalyst && npm run build 2>&1 | tail -5 && node dist/cli/index.js audit
```

Expected: a formatted table showing token breakdown for this project.

- [ ] **Step 3: Commit**

```bash
cd /Users/Aaditya/Documents/Ideas/cc-catalyst
git add src/cli/commands/audit.ts
git commit -m "feat: rewrite audit command with formatted token breakdown table"
```

---

## Task 14: Status and Learn commands

**Files:**
- Rewrite: `src/cli/commands/status.ts`
- Create: `src/cli/commands/learn.ts`

- [ ] **Step 1: Rewrite src/cli/commands/status.ts**

```typescript
import { Command } from 'commander'
import fs from 'fs'
import path from 'path'
import os from 'os'
import chalk from 'chalk'
import type { SessionHealth, LearnedPatterns } from '../../types'
import { readLearned } from '../../learning/store'

const DATA_DIR = path.join(os.homedir(), '.cc-catalyst')

function projectHash(dir: string): string {
  return dir.replace(/\//g, '-')
}

export const statusCommand = new Command('status')
  .description('Show session health and learned patterns for this project')
  .action(() => {
    console.log(chalk.bold('\ncc-catalyst Status\n'))

    // Session health
    const healthPath = path.join(DATA_DIR, 'session-health.json')
    if (fs.existsSync(healthPath)) {
      const health = JSON.parse(fs.readFileSync(healthPath, 'utf8')) as SessionHealth
      const color = health.budgetPercent >= 85 ? chalk.red
        : health.budgetPercent >= 70 ? chalk.yellow
        : chalk.green
      console.log('Session Health:')
      console.log(`  Budget:  ${color(health.budgetPercent + '%')} (${health.inputTokens.toLocaleString()} / ${health.contextLimit.toLocaleString()} tokens)`)
      console.log(`  Model:   ${health.model}`)
      console.log(`  Updated: ${new Date(health.updatedAt).toLocaleString()}\n`)
    } else {
      console.log(chalk.dim('Session Health: no data yet (starts after first Claude response)\n'))
    }

    // Learned patterns
    const hash = projectHash(process.cwd())
    const learned = readLearned(hash)
    if (learned) {
      console.log('Learned Patterns (' + learned.sessionCount + ' sessions):')
      if (learned.alwaysUsed.length > 0)
        console.log('  Always used: ' + chalk.green(learned.alwaysUsed.join(', ')))
      if (learned.neverUsed.length > 0)
        console.log('  Suppressed:  ' + chalk.yellow(learned.neverUsed.join(', ')))
      console.log(`  Updated: ${new Date(learned.updatedAt).toLocaleString()}\n`)
    } else {
      console.log(chalk.dim('Learned Patterns: no data yet (needs 3+ sessions)\n'))
    }
  })
```

- [ ] **Step 2: Create src/cli/commands/learn.ts**

```typescript
import { Command } from 'commander'
import fs from 'fs'
import chalk from 'chalk'
import { readLearned, writeLearned, deleteLearned } from '../../learning/store'

function projectHash(dir: string): string {
  return dir.replace(/\//g, '-')
}

export const learnCommand = new Command('learn')
  .description('Manage learned tool usage patterns')
  .addCommand(
    new Command('show')
      .description('Show learned patterns for this project')
      .action(() => {
        const hash = projectHash(process.cwd())
        const learned = readLearned(hash)
        if (!learned) {
          console.log(chalk.dim('No learned patterns yet. Needs 3+ sessions.\n'))
          return
        }
        console.log(chalk.bold('\nLearned Patterns\n'))
        console.log(`Sessions:     ${learned.sessionCount}`)
        console.log(`Always used:  ${learned.alwaysUsed.join(', ') || '(none yet)'}`)
        console.log(`Suppressed:   ${learned.neverUsed.join(', ') || '(none)'}`)
        console.log(`Updated:      ${new Date(learned.updatedAt).toLocaleString()}\n`)
      })
  )
  .addCommand(
    new Command('reset')
      .description('Clear all learned data for this project')
      .action(() => {
        const hash = projectHash(process.cwd())
        deleteLearned(hash)
        console.log(chalk.green('✓ Learned data cleared for this project.\n'))
      })
  )
  .addCommand(
    new Command('forget')
      .argument('<tool>', 'Tool name to un-suppress')
      .description('Un-suppress a specific tool')
      .action((tool: string) => {
        const hash = projectHash(process.cwd())
        const learned = readLearned(hash)
        if (!learned) { console.log(chalk.dim('No learned data found.\n')); return }
        learned.neverUsed = learned.neverUsed.filter(t => t !== tool)
        writeLearned({ ...learned, updatedAt: new Date().toISOString() })
        console.log(chalk.green(`✓ ${tool} un-suppressed.\n`))
      })
  )
```

- [ ] **Step 3: Update src/cli/index.ts to wire all commands**

```typescript
#!/usr/bin/env node
import { Command } from 'commander'
import { initCommand } from './commands/init'
import { removeCommand } from './commands/remove'
import { auditCommand } from './commands/audit'
import { statusCommand } from './commands/status'
import { learnCommand } from './commands/learn'

const program = new Command()

program
  .name('cc-catalyst')
  .description('Session intelligence for Claude Code — active token management')
  .version('0.2.0')

program.addCommand(initCommand)
program.addCommand(removeCommand)
program.addCommand(auditCommand)
program.addCommand(statusCommand)
program.addCommand(learnCommand)

program.parse()
```

- [ ] **Step 4: Build and smoke-test status + learn**

```bash
cd /Users/Aaditya/Documents/Ideas/cc-catalyst && npm run build 2>&1 | tail -5
node dist/cli/index.js status
node dist/cli/index.js learn show
```

Expected: clean output, no errors (shows "no data yet" messages).

- [ ] **Step 5: Commit**

```bash
cd /Users/Aaditya/Documents/Ideas/cc-catalyst
git add src/cli/commands/status.ts src/cli/commands/learn.ts src/cli/index.ts
git commit -m "feat: add status and learn commands"
```

---

## Task 15: Run all tests + full build verification

- [ ] **Step 1: Run full unit test suite**

```bash
cd /Users/Aaditya/Documents/Ideas/cc-catalyst && npm test 2>&1 | tail -20
```

Expected: all tests pass, no failures.

- [ ] **Step 2: Run integration tests**

```bash
cd /Users/Aaditya/Documents/Ideas/cc-catalyst && npm run test:integration 2>&1 | tail -10
```

Expected: all integration tests pass.

- [ ] **Step 3: Full build**

```bash
cd /Users/Aaditya/Documents/Ideas/cc-catalyst && npm run build 2>&1
```

Expected: no TypeScript errors.

- [ ] **Step 4: Smoke-test every CLI command**

```bash
node dist/cli/index.js --help
node dist/cli/index.js audit
node dist/cli/index.js status
node dist/cli/index.js learn show
```

Expected: all commands run cleanly with formatted output.

- [ ] **Step 5: Commit**

```bash
cd /Users/Aaditya/Documents/Ideas/cc-catalyst
git add -A
git commit -m "test: verify all tests pass on v2 clean build"
```

---

## Task 16: README rewrite

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Rewrite README.md**

```markdown
# cc-catalyst 🧠

**Session intelligence for Claude Code — makes Claude work smarter, not just quieter.**

> Caveman makes Claude talk less. cc-catalyst makes Claude **work smarter**.

Install in one command. No proxy. No daemon. No shell profile changes.

\`\`\`bash
npx cc-catalyst init
\`\`\`

---

## What it does

Claude Code burns tokens on things it never needed to see: bloated CLAUDE.md files, session history that compounds across turns, and tool descriptions loaded wholesale. cc-catalyst fixes this through four active systems:

| Feature | What it does |
|---|---|
| **Session Health** | Monitors your token budget after every response. Warns you before you hit the wall. |
| **Token Analytics** | Breaks down exactly where tokens go — CLAUDE.md, history, MCP, tool outputs. Ranked recommendations. |
| **Adaptive Learning** | Learns which tools you actually use per project. Suppresses the ones you never touch. |
| **Context Planner** | Detects task type (coding / debugging / docs) and loads only the context you need. |

---

## vs. Caveman

| | [Caveman](https://github.com/juliusbrussee/caveman) | cc-catalyst |
|---|---|---|
| **Target** | Output tokens (responses) | Input tokens (context, history) |
| **Approach** | Makes Claude talk less | Makes Claude work smarter |
| **Session-aware** | No | Yes — tracks budget, learns patterns |
| **Analytics** | Total count | Breakdown by source + recommendations |
| **Adaptive** | Static | Learns your project over time |

**Use both.** They're complementary: caveman shrinks what Claude *says*, cc-catalyst shrinks what Claude *sees*.

---

## Install

```bash
npx cc-catalyst init
```

Done. Restart Claude Code. That's it.

What `init` does:
- Adds `/catalyst-audit`, `/catalyst-compress`, `/catalyst-status`, `/catalyst-learn` slash commands
- Adds an activation block to `~/.claude/CLAUDE.md`
- Adds `Stop` and `PostToolUse` hooks to `~/.claude/settings.json` (safe, atomic, idempotent)
- Copies hook scripts to `~/.cc-catalyst/hooks/`

No proxy. No env vars. No network config.

---

## Usage

**Inside Claude Code:**

| Command | What it does |
|---|---|
| `/catalyst-status` | Show token budget and learned patterns |
| `/catalyst-audit` | Deep token breakdown for this project |
| `/catalyst-compress` | Rewrite CLAUDE.md files to cut input tokens forever |
| `/catalyst-learn` | Show or manage learned tool patterns |

**In terminal:**

\`\`\`bash
npx cc-catalyst audit          # token breakdown
npx cc-catalyst status         # health + learned patterns
npx cc-catalyst learn show     # what has been learned
npx cc-catalyst learn reset    # clear learned data
npx cc-catalyst learn forget Read   # un-suppress a tool
npx cc-catalyst remove         # clean uninstall
\`\`\`

---

## How it works

1. **Stop hook** runs after every Claude response → reads your session JSONL, computes token budget, writes `~/.cc-catalyst/session-health.json`
2. **PostToolUse hook** runs after every tool call → logs tool name to `~/.cc-catalyst/sessions/`
3. **Activation block** in `~/.claude/CLAUDE.md` → Claude checks health file on session start, applies learned patterns
4. **Slash commands** in `~/.claude/commands/` → on-demand audit, compress, and learning management

Session data lives in `~/.cc-catalyst/`. All local, no cloud, no telemetry.

---

## Uninstall

\`\`\`bash
npx cc-catalyst remove
\`\`\`

Removes all hooks, slash commands, and the CLAUDE.md block. Your other settings are untouched.

---

MIT License
```

- [ ] **Step 2: Commit**

```bash
cd /Users/Aaditya/Documents/Ideas/cc-catalyst
git add README.md
git commit -m "docs: rewrite README for v2 — skill-based, caveman comparison, clean install story"
```

---

## Task 17: Push

- [ ] **Step 1: Verify clean state**

```bash
cd /Users/Aaditya/Documents/Ideas/cc-catalyst && git status && git log --oneline -10
```

Expected: clean working tree, 10+ commits on main.

- [ ] **Step 2: Push to remote**

```bash
cd /Users/Aaditya/Documents/Ideas/cc-catalyst && git push
```

Expected: pushed successfully.
