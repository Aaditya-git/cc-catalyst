# cc-catalyst v2 — Design Spec

**Date:** 2026-05-14  
**Status:** Approved  

---

## Problem

Claude Code users burn tokens on things Claude never needed to see: bloated CLAUDE.md files, session history that compounds across turns, MCP tool descriptions loaded wholesale, and tool outputs that never get trimmed. The proxy-based v1 approach (intercepting API traffic via localhost) caused Claude Code to crash when `settings.json` was patched with `ANTHROPIC_BASE_URL`. That approach is abandoned.

## One-Line Pitch

Caveman makes Claude talk less. cc-catalyst makes Claude **work smarter**.

## Differentiation from Caveman

| | Caveman | cc-catalyst v2 |
|---|---|---|
| Target | Output tokens (responses) | Input tokens (context, history, tool outputs) |
| Mechanism | Skill file — changes how Claude speaks | Skill + hooks — changes how Claude manages its session |
| Session awareness | None | Active: monitors budget, auto-compacts, learns patterns |
| Adaptive | Static | Learns per-project tool usage over sessions |
| Analytics | Total count (`/caveman-stats`) | Deep breakdown by source with actionable recommendations |

**They are complementary, not competing.** Use both: caveman shrinks what Claude says, cc-catalyst shrinks what Claude sees.

---

## Architecture

### Three layers — no proxy, no daemon

```
~/.claude/skills/cc-catalyst/     ← skill files Claude reads each session
~/.claude/settings.json           ← hooks only (PostToolUse, Stop) — safe, atomic write
~/.cc-catalyst/                   ← session logs, learned patterns, config
```

**What we do NOT touch:**
- `settings.json` env section (changing API URL causes crashes — v1 lesson)
- Any proxy or network routing
- User's shell profile (`.zshrc`, `.bashrc`)

### Installation

```bash
npx cc-catalyst init    # install — adds hooks + skill files
npx cc-catalyst remove  # clean uninstall — idempotent
```

`init` does exactly:
1. Drops skill files into `~/.claude/skills/cc-catalyst/`
2. Adds `PostToolUse` and `Stop` hooks to `~/.claude/settings.json` using atomic writes + JSONC-tolerant parsing (same pattern as caveman's `settings.js`)
3. Creates `~/.cc-catalyst/` data directory

### Settings.json hook safety

Following caveman's battle-tested approach:
- Atomic write (temp file + `rename`) — never corrupts on crash
- JSONC parser — handles commented settings files
- Idempotent — re-running `init` is safe, won't duplicate hooks
- Validates hook shape before write (Claude Code uses strict Zod validation)
- `remove` cleanly strips only cc-catalyst hooks, leaves everything else intact

---

## Features

### Feature 1: Active Session Health Management

**Mechanism:** `Stop` hook fires a Node script after every Claude response.

The script:
1. Reads the Claude Code session log (JSONL at `~/.claude/projects/<hash>/`) to count tokens used this session
2. Computes budget percentage: tokens used / context limit (200k for Sonnet, 680k for Opus)
3. Writes a health status file: `~/.cc-catalyst/session-health.json`
4. At ≥70% budget: injects a warning into Claude's next turn via hook stdout
5. At ≥85% budget: injects a compact suggestion

The `cc-catalyst` skill reads `session-health.json` on session start and displays:
```
[CATALYST] ⚡ 42% budget · 84k / 200k tokens
```

**Thresholds:**
- < 70%: green, no action
- 70–84%: yellow warning shown
- ≥ 85%: suggest `/compact` with one-click instruction

### Feature 2: Token Analytics

**Command:** `npx cc-catalyst audit`

Reads:
- All CLAUDE.md files in `~/.claude/` and current project
- `~/.claude/settings.json` for MCP server configs (fetches their tool descriptions)
- `~/.cc-catalyst/sessions/` for historical tool output sizes
- Claude Code session logs for history token counts

Outputs a breakdown:
```
Token Cost Breakdown — my-project
──────────────────────────────────────────
CLAUDE.md (global)        1,840 tokens  ████████░░  23%
CLAUDE.md (project)       1,200 tokens  █████░░░░░  15%
Session history           2,100 tokens  ████████░░  26%
MCP tool descriptions     1,800 tokens  ███████░░░  22%
Tool outputs (avg/turn)     900 tokens  ████░░░░░░  11%
System prompt               200 tokens  █░░░░░░░░░   2%
──────────────────────────────────────────
Total                     8,040 tokens

Top recommendations:
  1. CLAUDE.md has 6 sections unreferenced in 8 sessions → run /catalyst-compress (saves ~620 tokens/session)
  2. MCP server "filesystem" tool descriptions are verbose → run /catalyst-shrink-mcp (saves ~400 tokens/session)
  3. Session history grew 3× in last 5 sessions → enable auto-compact in settings
```

**Zero network calls.** All analysis is local.

### Feature 3: Adaptive Context Learning

**Mechanism:** `PostToolUse` hook logs each tool call (tool name, session ID, timestamp) to `~/.cc-catalyst/sessions/<date>.jsonl`.

After 3+ sessions, the `cc-catalyst` skill surfaces patterns:

```
[CATALYST] Learned: You never use WebSearch in coding sessions (0/12 calls).
           Adding to prune list — saves ~340 tokens/session.
           Run /catalyst-forget WebSearch to undo.
```

The skill generates a per-project `~/.cc-catalyst/projects/<hash>/learned.json`:
```json
{
  "neverUsed": ["WebSearch", "mcp__memory__search"],
  "alwaysUsed": ["Read", "Edit", "Bash"],
  "sessionTypes": { "coding": ["Read","Edit","Bash"], "docs": ["Read","Write"] }
}
```

The `cc-catalyst` skill reads this and prefixes each session with:
```
[cc-catalyst context plan]
Task type detected: coding session
Suppressing: WebSearch, mcp__memory__search (unused in 12/12 recent sessions)
Focus tools: Read, Edit, Bash
```

This doesn't remove tool schemas from the wire (no proxy), but it primes Claude to ignore irrelevant tools — reducing attention cost and tool-selection overhead.

**CLI commands for learned data:**
```bash
npx cc-catalyst learn show      # display learned patterns
npx cc-catalyst learn reset     # clear all learned data
npx cc-catalyst learn forget WebSearch   # un-suppress a tool
```

### Feature 4: Pre-session Context Planner

**Mechanism:** The `cc-catalyst` skill auto-activates at session start (via hook + flag file, same pattern as caveman's activate hook).

On activation, Claude executes the context plan skill which:
1. Reads the first user message to detect task type (coding / docs / debugging / architecture)
2. Loads `learned.json` for this project
3. Generates a compact session plan:

```
[CATALYST] Session plan
Type: coding
Load: CLAUDE.md §2 (architecture), §4 (commands) — skip §1 (setup), §3 (deploy)  
History: summarize turns older than 5
Tools: prioritize Read, Edit, Bash
Budget: 200k · ~8 sessions at current usage rate
```

This is the Spark Catalyst analogy made real: **lazy evaluation** of context, loading only what the detected task type actually needs.

**Task type detection** — keyword heuristics in the skill:
- "fix", "bug", "error", "debug" → debugging
- "add feature", "implement", "build" → coding  
- "write docs", "readme", "explain" → docs
- "should we", "design", "architecture" → architecture

---

## Skill Files

```
~/.claude/skills/cc-catalyst/
  SKILL.md              ← main skill (auto-activates, context planner, health display)
  catalyst-audit.md     ← /catalyst-audit slash command
  catalyst-compress.md  ← /catalyst-compress (CLAUDE.md optimizer)
  catalyst-status.md    ← /catalyst-status (live health view)
  catalyst-learn.md     ← /catalyst-learn (show/manage learned patterns)
```

## Hook Scripts

```
~/.cc-catalyst/hooks/
  session-health.js     ← Stop hook: reads logs, writes health file, injects warnings
  tool-tracker.js       ← PostToolUse hook: logs tool calls to sessions/
```

Hook scripts are installed by `npx cc-catalyst init` into `~/.cc-catalyst/hooks/`. The `settings.json` hook entries point to these paths with the absolute Node path (same approach as caveman to survive GUI launchers with minimal PATH).

---

## Data Model

```
~/.cc-catalyst/
  config.json                       ← user preferences (thresholds, opt-outs)
  session-health.json               ← current session health (written by Stop hook)
  sessions/
    2026-05-14.jsonl                ← tool call log: {sessionId, tool, ts, outputBytes}
  projects/
    <project-hash>/
      learned.json                  ← per-project learned patterns
      audit-cache.json              ← last audit result (invalidated on file change)
```

---

## CLI Commands

| Command | What it does |
|---|---|
| `npx cc-catalyst init` | Install: drop skills, add hooks, create data dir |
| `npx cc-catalyst remove` | Uninstall: remove skills, strip hooks, optionally delete data |
| `npx cc-catalyst audit` | Deep token breakdown for current project |
| `npx cc-catalyst status` | Show current session health and learned patterns |
| `npx cc-catalyst learn show` | Display all learned tool patterns |
| `npx cc-catalyst learn reset` | Clear learned data |
| `npx cc-catalyst learn forget <tool>` | Un-suppress a specific tool |
| `npx cc-catalyst update` | Pull latest skill files and hook scripts |

---

## Skill Slash Commands (inside Claude Code)

| Command | What it does |
|---|---|
| `/catalyst-status` | Show current token budget and session health |
| `/catalyst-compress` | Rewrite CLAUDE.md to be token-efficient (preserves code/paths) |
| `/catalyst-audit` | Show token breakdown in-session |
| `/catalyst-learn` | Show learned patterns for this project |

---

## Distribution

- `npx cc-catalyst init` — zero-install, one command
- Open source GitHub repo (MIT)
- `npm install -g cc-catalyst` for persistent global install
- README leads with caveman comparison — complementary, not competing

---

## Success Metrics

- Input token reduction ≥ 30% average across sessions
- Zero crashes on install (hook-only settings.json writes)
- Session health warnings fire ≥ 5 turns before context limit
- Adaptive learning surfaces actionable patterns after ≤ 5 sessions
- `npx cc-catalyst audit` runs in < 2 seconds (all local, no network)

---

## Implementation Risks

- **Session log format:** Feature 1 and 2 rely on reading Claude Code session logs at `~/.claude/projects/<hash>/`. The JSONL format must include token counts or message sizes. If token counts are absent, fall back to character-count estimation (1 token ≈ 4 chars). Verify format in first implementation task before building the health monitor.
- **Hook stdout injection:** Claude Code's hook stdout-to-context behavior must be confirmed for the `Stop` event. If Stop hook stdout is not injected into Claude's next turn, use a flag-file approach (skill reads file, not hook stdout directly) as fallback.
- **Skill auto-activation:** Confirm Claude Code loads skills from `~/.claude/skills/` automatically. If not, the install step must also write a skill reference into the project or global CLAUDE.md.

---

## What We Are NOT Building

- No proxy or daemon (v1 lesson — causes crashes, complexity)
- No ANTHROPIC_BASE_URL in settings.json (v1 lesson)
- No shell profile modification (invasive, cleanup burden)
- No output token compression (caveman owns that — use both tools together)
- No cloud sync of learned data (privacy — all local)
