# cc-catalyst

> Save 20–55% of tokens on every Claude Code session — without compromising quality.

cc-catalyst is a local proxy that sits between Claude Code and the Anthropic API. It intercepts every request, runs it through a **Catalyst optimizer** (inspired by Apache Spark's query optimizer), strips what isn't needed, and forwards a leaner request. Claude Code never knows anything changed.

```
Before:  Claude Code ──── 40,000 tokens ────► api.anthropic.com
After:   Claude Code ──► cc-catalyst ──── 18,000 tokens ────► api.anthropic.com
```

---

## Why

Every Claude Code session starts with a fixed tax:

| Category | Tokens |
|----------|--------|
| System prompt | ~8,500 |
| System tool schemas | ~31,500 |
| **Total before you type a word** | **~40,000** |

On top of that, every tool result (bash output, file reads, web fetches) accumulates in context and gets re-sent every turn. By turn 20, you can be carrying 30,000+ tokens of stale output.

cc-catalyst eliminates both problems.

---

## How it works

```
User message arrives
        │
        ▼
┌───────────────────────┐
│   Catalyst Planner    │  detects task type from message
│   "fix bug in auth.ts"│  → task_type: file_editing
└──────────┬────────────┘
           │
           ▼
┌───────────────────────┐
│  Optimization Rules   │
│  • Tool pruner        │  strips 26 unused tool schemas  → saves ~22k tokens
│  • Prompt compressor  │  removes duplicate lines        → saves ~1–2k tokens
│  • Output truncator   │  caps long bash/read outputs    → saves variable
│  • History compactor  │  summarizes old turns           → saves variable
└──────────┬────────────┘
           │
           ▼
┌───────────────────────┐
│  Adaptive Engine      │  learns which tools your tasks actually need
│                       │  gets smarter every session
└──────────┬────────────┘
           │
           ▼
     Optimized request → api.anthropic.com
```

**Quality guarantee:** task success rate must stay ≥ 99.5%. If any optimization rule degrades quality, it gets reverted. Savings come from certainty, not guessing.

**Latency:** the proxy adds ~5–10ms overhead. Sending fewer tokens saves 300–500ms on Anthropic's side. cc-catalyst is a **net latency win**.

---

## Install

```bash
npx cc-catalyst init
```

That's it. The command:
1. Detects your Claude Code installation
2. Sets `ANTHROPIC_BASE_URL=http://127.0.0.1:8080` in `~/.claude/settings.json`
3. Starts the proxy daemon in the background

To verify it's running:

```bash
npx cc-catalyst status
```

To uninstall:

```bash
npx cc-catalyst remove
```

---

## Commands

```bash
cc-catalyst init     # install and start proxy
cc-catalyst status   # show proxy status and routing
cc-catalyst audit    # token breakdown + savings estimate
cc-catalyst remove   # clean uninstall
```

---

## Architecture

```
src/
├── proxy/
│   ├── server.ts         HTTP server on localhost:8080
│   └── interceptor.ts    buffers request → optimizer → forwards + streams
├── catalyst/
│   ├── planner.ts        detects task type from user message
│   ├── optimizer.ts      orchestrates all rules
│   └── rules/
│       ├── tool-pruner.ts        strips unneeded tool schemas
│       ├── output-truncator.ts   caps long tool outputs
│       ├── history-compactor.ts  summarizes old message turns
│       └── prompt-compressor.ts  removes redundant system prompt content
├── adaptive/
│   ├── tracker.ts        records which tools Claude actually calls
│   └── profile.ts        persists per-user tool profile to ~/.cc-catalyst/
└── cli/
    ├── index.ts
    └── commands/         init, remove, audit, status
```

### Catalyst optimizer (the Spark analogy)

Just like Apache Spark builds a logical plan, applies optimization rules, and produces a physical plan before executing — cc-catalyst:

1. **Logical plan:** parse the user's intent from the message
2. **Optimization rules:** prune tools, compress prompt, compact history, truncate outputs
3. **Physical plan:** the minimal context set needed for this specific task
4. **Execute:** forward to Anthropic

### Adaptive engine

After each session, the tracker records which tools were actually called. Over time, the optimizer learns your real usage patterns and produces better-targeted tool sets. A "file editing" session that consistently uses `WebFetch` will see it added to that task's tool set automatically.

---

## Development

```bash
npm install
npm run build          # compile TypeScript
npm test               # unit tests (46 tests)
npm run benchmark      # run golden session dataset
npx tsc --noEmit       # typecheck
```

### Running locally

```bash
node dist/proxy/server.js       # start proxy manually
node dist/cli/index.js audit    # run audit CLI
```

### Adding benchmark sessions

Drop anonymized Claude Code API request fixtures (JSON) into `tests/benchmarks/sessions/`. The benchmark runner measures token reduction % against each session and enforces a ≥ 20% average reduction gate.

---

## Quality gates

Every PR must pass:

| Metric | Threshold |
|--------|-----------|
| Unit tests | 100% pass |
| TypeScript errors | 0 |
| Token reduction (benchmarks) | ≥ 20% average |
| Proxy latency overhead | < 50ms p99 |

---

## Roadmap

- [ ] Session dashboard with live token savings counter
- [ ] Per-project MCP server pruning
- [ ] Streaming response inspection for adaptive tool tracking
- [ ] npm publish as `cc-catalyst`
- [ ] CI with GitHub Actions

---

## License

MIT
