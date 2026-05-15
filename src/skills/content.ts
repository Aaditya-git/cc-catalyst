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
