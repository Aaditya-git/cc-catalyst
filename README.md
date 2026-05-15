# cc-catalyst 

**Session intelligence for Claude Code — makes Claude work smarter, not just quieter.**

> Caveman makes Claude talk less. cc-catalyst makes Claude **work smarter**.

Install in one command. No proxy. No daemon. No shell profile changes.

```bash
npx cc-catalyst init
```

---

## What it does

Claude Code burns tokens on things it never needed to see: bloated CLAUDE.md files, session history that compounds across turns, and MCP tool descriptions loaded wholesale. cc-catalyst fixes this through four active systems:

| Feature | What it does |
|---|---|
| **Session Health** | Monitors your token budget after every response. Warns Claude at 70% and 85% before you hit the wall. |
| **Token Analytics** | Breaks down exactly where tokens go — CLAUDE.md, current session, MCP descriptions. Ranked recommendations. |
| **Adaptive Learning** | Learns which tools you actually use per project after 3+ sessions. Surfaces patterns automatically. |
| **Context Planner** | Detects task type (coding / debugging / docs) from your first message and primes Claude to focus. |

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
- Adds `/catalyst-audit`, `/catalyst-compress`, `/catalyst-status`, `/catalyst-learn` slash commands to `~/.claude/commands/`
- Appends an activation block to `~/.claude/CLAUDE.md` (idempotent — safe to re-run)
- Adds `Stop` and `PostToolUse` hooks to `~/.claude/settings.json` (atomic write, JSONC-safe, idempotent)
- Copies hook scripts to `~/.cc-catalyst/hooks/`

No proxy. No env vars. No network config. Re-running `init` is safe and won't duplicate anything.

---

## See it in action

Run this after a Claude Code session:

```bash
npx cc-catalyst audit
```

Real output from a live session:

```
Token Cost Breakdown — cc-catalyst
────────────────────────────────────────────────────────────
Global CLAUDE.md                     280 tokens  ░░░░░░░░░░░░░░░░░░░░   0%
Project CLAUDE.md                    459 tokens  ░░░░░░░░░░░░░░░░░░░░   1%
Current session input tokens      91,963 tokens  ████████████████████  99%
MCP tool descriptions (est.)           0 tokens  ░░░░░░░░░░░░░░░░░░░░   0%
────────────────────────────────────────────────────────────
Total                             92,243 tokens

Recommendations:
  1. Session history is 91,963 tokens — consider reducing
```

Session history dominates at 99% — that's the compressible part. Run `/compact` inside Claude Code to reclaim it.

Check your live token budget:

```bash
npx cc-catalyst status
```

```
cc-catalyst Status

Session Health:
  Budget:  46% (91,963 / 200,000 tokens)
  Model:   claude-sonnet-4-6
  Updated: 5/15/2026, 7:01 AM

```

---

## Usage

**Inside Claude Code (slash commands):**

| Command | What it does |
|---|---|
| `/catalyst-status` | Show token budget % and learned patterns for this project |
| `/catalyst-audit` | Full token breakdown — see what's eating your context |
| `/catalyst-compress` | Rewrite CLAUDE.md files to be concise — saves tokens on every future session |
| `/catalyst-learn` | Show or manage learned tool usage patterns |

**In terminal:**

```bash
npx cc-catalyst audit                  # token breakdown for current session
npx cc-catalyst status                 # health + learned patterns
npx cc-catalyst learn show             # what cc-catalyst has learned about this project
npx cc-catalyst learn reset            # clear learned data for this project
npx cc-catalyst learn forget <tool>    # un-suppress a specific tool
npx cc-catalyst remove                 # clean uninstall
```

---

## How it works

```
Claude response → Stop hook → reads session JSONL → writes ~/.cc-catalyst/session-health.json
Tool call       → PostToolUse hook → logs to ~/.cc-catalyst/sessions/YYYY-MM-DD.jsonl
Session start   → CLAUDE.md activation block → Claude checks health, applies learned patterns
```

1. **Stop hook** — fires after every Claude response. Reads your session JSONL at `~/.claude/projects/<hash>/`, computes input token usage against the 200k limit, writes `session-health.json`. Injects a warning into Claude's next turn at ≥70% budget, and a compact suggestion at ≥85%.

2. **PostToolUse hook** — fires after every tool call. Logs `{ tool, sessionId, timestamp }` to `~/.cc-catalyst/sessions/`. After 3+ sessions, patterns emerge: which tools you always use, which you never touch.

3. **CLAUDE.md activation block** — instructs Claude to check `session-health.json` on session start and display your budget. Also reads `learned.json` to tell Claude which tools have been suppressed based on your history.

4. **Slash commands** — installed in `~/.claude/commands/`. `/catalyst-audit` runs the token breakdown, `/catalyst-compress` rewrites your CLAUDE.md files for maximum token efficiency, `/catalyst-learn` surfaces and manages adaptive patterns.

All session data lives in `~/.cc-catalyst/`. Fully local. No cloud. No telemetry.

---

## Data directory

```
~/.cc-catalyst/
  session-health.json              # current session budget (updated after every response)
  hooks/
    session-health.js              # Stop hook script
    tool-tracker.js                # PostToolUse hook script
  sessions/
    2026-05-15.jsonl               # tool call log: {tool, sessionId, timestamp}
  projects/
    <project-hash>/
      learned.json                 # per-project learned patterns
```

---

## Uninstall

```bash
npx cc-catalyst remove
```

Removes all hooks, slash commands, and the CLAUDE.md block. Your other `settings.json` content is untouched.

---

MIT License
