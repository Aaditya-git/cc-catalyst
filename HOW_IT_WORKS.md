# How cc-catalyst Works

## The One-Line Summary

cc-catalyst installs two hook scripts and a CLAUDE.md activation block into your Claude Code setup. Together they monitor your token budget, log every tool call, learn your patterns, and tell Claude how to work smarter — all without a proxy, daemon, or any network calls.

---

## The Problem It Solves

Every Claude Code session has a 200,000 token context window. That window fills up with:

- **Session history** — every prior turn compounds. By turn 20 you might be at 80% budget just from history.
- **Bloated CLAUDE.md files** — instructions written as paragraphs instead of bullet points. 1,800 tokens that repeat every session.
- **MCP tool descriptions** — every MCP server you've added loads its tool schemas every turn, whether you use them or not.
- **No budget visibility** — Claude Code doesn't show you how full your context window is. You find out when quality degrades.

cc-catalyst fixes all four.

---

## Architecture: No Proxy, No Daemon

```
~/.claude/CLAUDE.md          ← activation block (always-on context planner)
~/.claude/commands/          ← slash commands (/catalyst-audit, /catalyst-compress, etc.)
~/.claude/settings.json      ← Stop + PostToolUse hooks (registered here, scripts live elsewhere)
~/.cc-catalyst/hooks/        ← session-health.js, tool-tracker.js (the actual hook scripts)
~/.cc-catalyst/sessions/     ← tool call logs per day (YYYY-MM-DD.jsonl)
~/.cc-catalyst/projects/     ← per-project learned.json (neverUsed, alwaysUsed tools)
~/.cc-catalyst/session-health.json  ← current session budget (updated after every response)
```

There is no server. There is no background process. Everything runs as short-lived Node.js scripts triggered by Claude Code's own hook system, or as instructions Claude reads from markdown files.

---

## The Four Systems

### 1. Session Health Monitor

**What fires it:** Claude Code's `Stop` event — triggers after every Claude response.

**What it does:**
1. Reads `~/.claude/projects/<hash>/<session-id>.jsonl` — the session log Claude Code writes automatically
2. Finds the last `assistant` message with `message.usage` containing real token counts (`input_tokens + cache_creation_input_tokens + cache_read_input_tokens`)
3. Computes `budgetPercent = inputTokens / 200000 * 100`
4. Writes `~/.cc-catalyst/session-health.json`
5. At ≥70%: injects `[CATALYST] 🟡 Context at 70% — approaching limit.` into Claude's next turn via `hookSpecificOutput.additionalContext`
6. At ≥85%: injects a stronger warning suggesting `/compact` immediately

**How tokens are saved:** You know when to compact before Claude degrades. Without this, most users don't notice until they're at 95%+ and responses start getting worse.

### 2. Token Analytics

**What fires it:** `npx cc-catalyst audit` in terminal, or `/catalyst-audit` inside Claude Code.

**What it does:** Reads four sources and shows a ranked breakdown:

| Source | How measured |
|---|---|
| Global CLAUDE.md | Reads `~/.claude/CLAUDE.md`, estimates tokens as `chars / 4` |
| Project CLAUDE.md | Reads `./CLAUDE.md` and `./.claude/CLAUDE.md` |
| Current session | Reads `inputTokens` from `~/.cc-catalyst/session-health.json` |
| MCP descriptions | Reads `mcpServers` config from `settings.json`, estimates size |

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

**How tokens are saved:** Shows you exactly what to fix. In this example: session history is 99% of the cost — run `/compact`. If CLAUDE.md were 2,000 tokens, it would recommend `/catalyst-compress`.

### 3. Adaptive Context Learning

**What fires it:** Claude Code's `PostToolUse` event — triggers after every tool call.

**What it does:**
1. Receives `{ session_id, tool_name }` from Claude Code via stdin
2. Appends `{ tool, sessionId, timestamp }` to `~/.cc-catalyst/sessions/YYYY-MM-DD.jsonl`
3. After 3+ sessions, `npx cc-catalyst status` (or the CLAUDE.md activation block) runs analysis:
   - `alwaysUsed`: tools used in ≥90% of sessions
   - `neverUsed`: tools used in 0% of sessions
4. Writes `~/.cc-catalyst/projects/<hash>/learned.json`

**How tokens are saved:** The CLAUDE.md activation block reads `learned.json` and tells Claude: "WebSearch has been unused in 12/12 sessions for this project — deprioritize it." Claude doesn't load attention on tools that don't matter for this project. Less cognitive overhead per turn = better decisions with less context.

### 4. Pre-Session Context Planner

**What fires it:** Every session start — Claude reads the `~/.claude/CLAUDE.md` activation block we install.

**What it does:** Instructs Claude to detect the task type from the first message using keyword heuristics:
- "fix" / "bug" / "error" / "debug" → **debugging** → prioritize Read + Bash
- "implement" / "build" / "add" → **coding** → prioritize Edit + Write
- "docs" / "readme" / "explain" → **docs** → prioritize Read + Write

Then Claude displays your budget and any suppressed tools:
```
[CATALYST] ⚡ 41% budget · 82,385 / 200,000 tokens
Task type: coding — prioritizing Edit, Write, Bash
Suppressed: WebSearch (unused in 8/8 recent sessions)
```

**How tokens are saved:** Lazy context loading. Claude focuses on relevant tools instead of considering the full tool set every turn.

---

## Token Savings: Where They Come From

| Action | Saves tokens | When |
|---|---|---|
| Early `/compact` via budget warning | Reclaims 40–80k tokens | During session |
| `/catalyst-compress` on CLAUDE.md | 500–1,500 tokens | Every future session, forever |
| Adaptive tool suppression | ~200–500 tokens/turn attention overhead | After 3+ sessions |
| Task-type context planning | Reduced per-turn overhead | Every session |

The biggest lever is **session compaction**. History compounds — knowing when to compact is worth thousands of tokens per session.

---

## vs. Caveman

[Caveman](https://github.com/juliusbrussee/caveman) makes Claude *say* less (output tokens).  
cc-catalyst makes Claude *see* less (input tokens).

They are complementary. Use both for maximum savings:
- Caveman shrinks Claude's responses → less history accumulates per turn
- cc-catalyst compacts sooner, loads smarter → less context needed per turn

---

## How It Scales to Millions of Users

There is nothing to scale on our end. The entire system is:

1. An npm package (distributed via npm CDN — already handles billions of downloads/month)
2. Node.js scripts that run locally on the user's machine
3. Files in `~/.cc-catalyst/` on the user's machine

No backend. No database. No API keys. No accounts. No rate limits.

Every user is completely independent. User #10,000,000 has the exact same experience as user #1 — a one-command install that runs in under a second and never phones home.

---

## Hook Safety

The v1 approach wrote `ANTHROPIC_BASE_URL` to `settings.json` to route traffic through a local proxy. **This crashed Claude Code's terminal.** Never again.

v2 only touches the `hooks` section of `settings.json` — the same approach used by caveman, which has been battle-tested. Safety properties:

- **Atomic writes**: we write to a `.tmp` file, then `rename()` — never corrupts on crash
- **JSONC-tolerant**: `settings.json` often has comments; our parser handles them
- **Idempotent**: re-running `init` checks for existing hooks before adding, never duplicates
- **Clean removal**: `remove` strips only cc-catalyst hooks, leaves everything else intact
- **Validates before write**: malformed hook entries are removed before we add ours

---

## Running Things

```bash
# Install
npx cc-catalyst init

# See your token budget right now
npx cc-catalyst status

# See where tokens are going
npx cc-catalyst audit

# See what cc-catalyst has learned about this project
npx cc-catalyst learn show

# Clear learned data and start fresh
npx cc-catalyst learn reset

# Un-suppress a tool
npx cc-catalyst learn forget WebSearch

# Clean uninstall
npx cc-catalyst remove
```

Inside Claude Code:
```
/catalyst-status    → live budget + learned patterns
/catalyst-audit     → full token breakdown
/catalyst-compress  → rewrite CLAUDE.md files to be concise
/catalyst-learn     → manage learned patterns
```

---

## File Formats

**`~/.cc-catalyst/session-health.json`**
```json
{
  "sessionId": "cc95e5eb-4fbb-46ed-9f66-515a7b9a13d4",
  "inputTokens": 82385,
  "outputTokens": 246,
  "contextLimit": 200000,
  "budgetPercent": 41,
  "model": "claude-sonnet-4-6",
  "updatedAt": "2026-05-15T02:00:35.367Z"
}
```

**`~/.cc-catalyst/sessions/2026-05-15.jsonl`**
```jsonl
{"tool":"Bash","sessionId":"cc95e5eb-...","timestamp":"2026-05-15T02:01:38.556Z"}
{"tool":"Read","sessionId":"cc95e5eb-...","timestamp":"2026-05-15T02:01:42.303Z"}
```

**`~/.cc-catalyst/projects/<hash>/learned.json`**
```json
{
  "projectHash": "-Users-Aaditya-Documents-Ideas-cc-catalyst",
  "sessionCount": 5,
  "neverUsed": ["WebSearch", "mcp__memory__search"],
  "alwaysUsed": ["Read", "Edit", "Bash"],
  "updatedAt": "2026-05-15T02:00:00.000Z"
}
```
