# cc-catalyst 🧠

**Session intelligence for Claude Code — makes Claude work smarter, not just quieter.**

> Caveman makes Claude talk less. cc-catalyst makes Claude **work smarter**.

Install in one command. No proxy. No daemon. No shell profile changes.

```bash
npx cc-catalyst init
```

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

```bash
npx cc-catalyst audit          # token breakdown
npx cc-catalyst status         # health + learned patterns
npx cc-catalyst learn show     # what has been learned
npx cc-catalyst learn reset    # clear learned data
npx cc-catalyst learn forget Read   # un-suppress a tool
npx cc-catalyst remove         # clean uninstall
```

---

## How it works

1. **Stop hook** runs after every Claude response → reads your session JSONL, computes token budget, writes `~/.cc-catalyst/session-health.json`
2. **PostToolUse hook** runs after every tool call → logs tool name to `~/.cc-catalyst/sessions/`
3. **Activation block** in `~/.claude/CLAUDE.md` → Claude checks health file on session start, applies learned patterns
4. **Slash commands** in `~/.claude/commands/` → on-demand audit, compress, and learning management

Session data lives in `~/.cc-catalyst/`. All local, no cloud, no telemetry.

---

## Uninstall

```bash
npx cc-catalyst remove
```

Removes all hooks, slash commands, and the CLAUDE.md block. Your other settings are untouched.

---

MIT License
