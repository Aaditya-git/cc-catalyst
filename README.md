# cc-catalyst

**Session intelligence for Claude Code — makes Claude aware of its own limits and learns your workflow over time.**

Install hooks and slash commands:

```bash
npx cc-catalyst init
```

Start the proxy (optional, but where the real savings happen):

```bash
npx cc-catalyst proxy start
```

---

## The problem

Claude has a 200,000 token context window. It has no idea when it's running out.

You're deep in a session, 15 turns in, and Claude starts giving shorter answers, missing context, making mistakes it wouldn't have made an hour ago. You didn't change anything. It just degraded — silently.

cc-catalyst fixes this.

---

## What it does

| Feature | What it does |
|---|---|
| **Proxy** | Sits between Claude Code and Anthropic. Strips unused tool schemas. Trims old history. Real tokens removed from the wire. |
| **Session Health** | Warns Claude at 70% and 85% budget — inside its own context, not just the UI. |
| **Adaptive Learning** | Logs every tool call per project. After 3+ sessions, knows which tools you never use. |
| **Token Analytics** | Shows exactly where tokens go — session history, CLAUDE.md, MCP descriptions. |

---

## The proxy

This is the unique part. No other tool does this.

```
Claude Code → localhost:3131 → api.anthropic.com
```

Every request goes through cc-catalyst before reaching Anthropic. The proxy:

- **Strips tool schemas** for tools you never use (learned per project). Each schema is ~80–300 tokens. Strip 5 unused tools = 400–1,500 tokens saved every single turn.
- **Trims history** beyond the last 20 turns. Old messages you'll never reference again, gone.
- **Logs exactly what it removed**: `[CATALYST PROXY] stripped 3 tools (~720 tokens) | trimmed 8 messages (~4,000 tokens)`
- **Falls back transparently** on any error — Claude Code never breaks.

### Setup

```bash
npx cc-catalyst proxy start
```

Then add one line to your shell profile:

```bash
export ANTHROPIC_BASE_URL=http://localhost:3131
```

Restart your terminal and Claude Code. That's it. Watch the savings in real time:

```bash
tail -f ~/.cc-catalyst/proxy.log
```

---

## vs. Caveman

| | [Caveman](https://github.com/juliusbrussee/caveman) | cc-catalyst |
|---|---|---|
| **Target** | Output tokens (responses) | Input tokens (context, history) |
| **Approach** | Makes Claude talk less | Removes tokens before they're sent |
| **On the wire** | No — text instructions only | Yes — proxy intercepts and strips |
| **Session-aware** | No | Yes — warns Claude at 70%/85% budget |
| **Adaptive** | Static | Learns your project over time |

**Use both.** Caveman shrinks what Claude says. cc-catalyst shrinks what Claude sees.

---

## Install

```bash
npx cc-catalyst init
```

What `init` does:
- Adds slash commands to `~/.claude/commands/` (`/catalyst-audit`, `/catalyst-compress`, `/catalyst-status`, `/catalyst-learn`)
- Appends an activation block to `~/.claude/CLAUDE.md`
- Adds `Stop` and `PostToolUse` hooks to `~/.claude/settings.json`
- Copies hook scripts to `~/.cc-catalyst/hooks/`

Re-running `init` is safe — idempotent, never duplicates anything.

---

## Usage

**Proxy:**

```bash
npx cc-catalyst proxy start    # start proxy on port 3131
npx cc-catalyst proxy status   # check if running, show recent log
npx cc-catalyst proxy stop     # stop proxy
```

**Token analytics:**

```bash
npx cc-catalyst audit          # where are tokens going?
npx cc-catalyst status         # current session budget + learned patterns
```

**Learned patterns:**

```bash
npx cc-catalyst learn show              # what cc-catalyst knows about this project
npx cc-catalyst learn reset             # clear learned data
npx cc-catalyst learn forget <tool>     # un-suppress a specific tool
```

**Inside Claude Code:**

| Command | What it does |
|---|---|
| `/catalyst-status` | Token budget + learned patterns |
| `/catalyst-audit` | Full breakdown by source |
| `/catalyst-compress` | Rewrite CLAUDE.md to be concise |
| `/catalyst-learn` | Manage learned tool patterns |

---

## How it works

```
Claude Code → proxy (optional) → strips tools + trims history → api.anthropic.com
Claude response → Stop hook → reads token count → warns Claude at 70%/85%
Tool call → PostToolUse hook → logs to sessions/YYYY-MM-DD.jsonl
Session start → CLAUDE.md activation block → shows budget + learned suppressions
```

---

## Data directory

```
~/.cc-catalyst/
  session-health.json         # current session budget
  proxy.pid                   # proxy process ID (when running)
  proxy.log                   # proxy activity log
  config.json                 # optional: override port, historyTrimN, enable/disable features
  hooks/
    session-health.js
    tool-tracker.js
  sessions/
    YYYY-MM-DD.jsonl          # tool call log per day
  projects/
    <project-hash>/
      learned.json            # per-project learned patterns
```

### Config (optional)

Create `~/.cc-catalyst/config.json` to override defaults:

```json
{
  "proxy": {
    "port": 3131,
    "historyTrimN": 20,
    "enableToolStripping": true,
    "enableHistoryTrimming": true
  }
}
```

---

## Uninstall

```bash
npx cc-catalyst remove
```

Removes hooks, slash commands, and the CLAUDE.md block. Stop the proxy first with `npx cc-catalyst proxy stop`.

---

MIT License
