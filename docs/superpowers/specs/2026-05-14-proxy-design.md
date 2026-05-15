# cc-catalyst Proxy Design

## Goal

Add a local proxy to cc-catalyst that intercepts Claude Code API requests and removes tokens before they reach Anthropic — stripping unused tool schemas and trimming old history. First tool of its kind.

## Architecture

A local Express server runs on port 3131. The user sets `ANTHROPIC_BASE_URL=http://localhost:3131` in their shell profile once. Claude Code routes all requests through the proxy. The proxy modifies the request body, logs what it removed, and forwards to the real Anthropic API. On any error, it falls back to transparent passthrough so Claude Code never breaks.

```
Claude Code → localhost:3131 (proxy) → api.anthropic.com
```

The proxy is started manually with `npx cc-catalyst proxy start` and stopped with `npx cc-catalyst proxy stop`. It runs as a background process, logging to `~/.cc-catalyst/proxy.log`.

## Components

### `src/proxy/server.ts`
Express server. Listens on port 3131. Single POST route `/v1/messages` that mirrors Anthropic's API. Applies tool-stripper then history-trimmer in sequence. Forwards modified request. On any error (network, parse, crash), falls through to unmodified passthrough.

### `src/proxy/middleware/tool-stripper.ts`
Reads `~/.cc-catalyst/projects/<hash>/learned.json`. Gets `neverUsed` list. Removes matching entries from `request.body.tools[]`. Returns list of removed tool names and token estimate saved (`name.length * 80` tokens per schema as conservative estimate). No-ops if learned.json doesn't exist yet (day one, nothing to strip).

### `src/proxy/middleware/history-trimmer.ts`
Reads `request.body.messages[]`. Keeps last N turns (default 20, configurable via `~/.cc-catalyst/config.json`). Trims oldest messages first. Returns count of messages removed and token estimate saved. No-ops if messages <= N.

### `src/proxy/reporter.ts`
Formats removal report: `[CATALYST PROXY] stripped 3 tools (~900 tokens), trimmed 8 messages (~4,200 tokens)`. Writes to `~/.cc-catalyst/proxy.log`. Also prints to stdout so the user sees it in their terminal.

### `src/cli/commands/proxy.ts`
Three subcommands:
- `proxy start` — spawns server as detached background process, writes PID to `~/.cc-catalyst/proxy.pid`, prints setup instructions including the export line
- `proxy stop` — reads PID file, kills process, removes PID file
- `proxy status` — checks if PID is alive, shows port, shows log tail

## Request/Response Flow

1. Claude Code sends POST `/v1/messages` to localhost:3131
2. Proxy parses body
3. tool-stripper removes neverUsed tools, returns removed list + token estimate
4. history-trimmer removes old messages beyond N, returns count + token estimate
5. reporter logs what was removed
6. Proxy forwards modified request to `https://api.anthropic.com/v1/messages` with original headers (including API key)
7. Anthropic response streamed back to Claude Code unmodified

## Fallback Safety

Any unhandled error → catch block → forward original unmodified request to Anthropic. Claude Code never sees a failure. The proxy failing gracefully is non-negotiable — this is the lesson from v1.

## Config

`~/.cc-catalyst/config.json`:
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

User can disable either feature independently.

## What We Do NOT Touch

- `settings.json` env section (v1 lesson — never again)
- Shell profile files (user adds the export manually)
- Anthropic API key (read from environment, passed through, never stored)

## New Files

- `src/proxy/server.ts`
- `src/proxy/middleware/tool-stripper.ts`
- `src/proxy/middleware/history-trimmer.ts`
- `src/proxy/reporter.ts`
- `src/cli/commands/proxy.ts`

## Modified Files

- `src/cli/index.ts` — register proxy command
- `src/types.ts` — add ProxyConfig, ProxyReport types
- `package.json` — add `express`, `@types/express` dependencies
- `README.md` — add proxy section
