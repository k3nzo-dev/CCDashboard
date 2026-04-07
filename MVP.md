# Claude Code Analytics Dashboard — MVP Spec

## Overview

A local Next.js dashboard that reads Claude Code session data from `~/.claude/projects/` and displays usage analytics: token consumption, estimated costs, session history, tool usage breakdown, and trends over time.

All data stays local. No cloud services, no telemetry.

---

## Data Source

Claude Code stores sessions as JSONL files:

```
~/.claude/projects/<encoded-cwd>/<session-id>.jsonl
```

Where `<encoded-cwd>` is the absolute working directory with `/` replaced by `-` (e.g. `/Users/me/proj` → `-Users-me-proj`).

Each JSONL file is one JSON object per line. Relevant record types:

| `type` | What it contains |
|---|---|
| `system` | Session metadata — `subtype: "turn_duration"`, `durationMs`, `teamName`, `slug`, `gitBranch`, `cwd` |
| `user` | User prompts — `message.content` (text or array of content blocks) |
| `assistant` | Model responses — `message.model`, `message.usage` (tokens), `message.content` (text, thinking, tool_use blocks) |
| `progress` | Hook progress events |

### Key fields on every record

- `sessionId` — UUID
- `timestamp` — ISO 8601
- `cwd` — working directory
- `version` — Claude Code version
- `gitBranch` — current git branch

### Token usage (on `assistant` records → `message.usage`)

```json
{
  "input_tokens": 3,
  "output_tokens": 8,
  "cache_creation_input_tokens": 13626,
  "cache_read_input_tokens": 9707,
  "service_tier": "standard"
}
```

### Tool usage (on `assistant` records → `message.content[]`)

Content blocks with `"type": "tool_use"` contain a `name` field (e.g. `Read`, `Edit`, `Bash`, `Glob`, `Grep`, `Agent`, `SendMessage`, etc.).

### Global history

`~/.claude/history.jsonl` — one line per user prompt across all sessions:

```json
{
  "display": "the prompt text",
  "timestamp": 1772498868931,
  "project": "/Users/me/proj",
  "sessionId": "uuid"
}
```

---

## Cost Model (Sonnet 4)

| Token type | Price per 1M tokens |
|---|---|
| Input | $3.00 |
| Output | $15.00 |
| Cache write | $3.75 |
| Cache read | $0.30 |

Formula per assistant message:
```
cost = (input_tokens * 3.00 + output_tokens * 15.00
      + cache_creation_input_tokens * 3.75
      + cache_read_input_tokens * 0.30) / 1_000_000
```

---

## MVP Features

### 1. Summary Cards (top of dashboard)
- **Total sessions** — count of JSONL files
- **Total cost** — sum across all sessions
- **Total tokens** — input + output + cache
- **Active projects** — unique `cwd` values

### 2. Cost Over Time Chart
- Bar or area chart, grouped by day
- X-axis: date, Y-axis: estimated cost in $
- Stacked by token type (input, output, cache read, cache write)

### 3. Session List / Table
- Columns: date, project name (last path segment of `cwd`), git branch, duration, token count, estimated cost, model, first prompt (truncated)
- Sortable by date, cost, tokens
- Click to expand and see tool usage breakdown

### 4. Token Breakdown (per session or global)
- Pie/donut chart: input vs output vs cache read vs cache write

### 5. Tool Usage Breakdown
- Bar chart of tool names and their frequency across all sessions
- e.g. Read: 450, Edit: 320, Bash: 280, etc.

### 6. Project Breakdown
- Table or bar chart showing cost/tokens per project
- Derived from the `cwd` field on each record

---

## Tech Stack

- **Next.js 15** (App Router) + TypeScript
- **Tailwind CSS** for styling
- **Recharts** for charts
- **date-fns** for date formatting
- No database — reads JSONL files directly from disk via API routes

---

## Architecture

```
src/
  lib/
    parser.ts          — reads ~/.claude/projects/, parses JSONL files
    costs.ts           — token-to-cost calculation
    types.ts           — TypeScript interfaces for parsed data
  app/
    api/
      sessions/route.ts    — GET all sessions (summary data)
      sessions/[id]/route.ts — GET single session detail
      stats/route.ts       — GET aggregate stats
    page.tsx               — Dashboard page
    components/
      SummaryCards.tsx
      CostChart.tsx
      SessionTable.tsx
      TokenBreakdown.tsx
      ToolUsageChart.tsx
      ProjectBreakdown.tsx
```

### Data flow

1. API routes call `parser.ts` to scan `~/.claude/projects/`
2. Parser reads each `*.jsonl`, extracts `assistant` records for token/cost data
3. API returns JSON to the frontend
4. React components render charts and tables

---

## Parsing Strategy

For the MVP, parse on every request (no caching). The dataset for a single user is small enough (~1K sessions, each a few hundred lines) that this is fine.

```ts
// Pseudocode
function parseSession(filePath: string): SessionSummary {
  const lines = readFileSync(filePath, 'utf-8').split('\n')
  let totalInput = 0, totalOutput = 0, cacheRead = 0, cacheWrite = 0
  let model = '', firstPrompt = '', tools: Record<string, number> = {}

  for (const line of lines) {
    const record = JSON.parse(line)
    if (record.type === 'assistant') {
      const usage = record.message?.usage ?? {}
      totalInput += usage.input_tokens ?? 0
      totalOutput += usage.output_tokens ?? 0
      cacheRead += usage.cache_read_input_tokens ?? 0
      cacheWrite += usage.cache_creation_input_tokens ?? 0
      model = record.message?.model ?? model
      for (const block of record.message?.content ?? []) {
        if (block.type === 'tool_use') tools[block.name] = (tools[block.name] ?? 0) + 1
      }
    }
    if (record.type === 'user' && !firstPrompt) {
      firstPrompt = extractText(record.message?.content)
    }
  }
  return { sessionId, cwd, gitBranch, model, firstPrompt, tokens: {...}, cost, tools, startTime, endTime }
}
```

---

## Out of Scope (for MVP)

- Real-time / live session tracking
- Multi-model cost support (just Sonnet 4 pricing for now)
- Database or persistent caching
- Authentication
- Session replay / conversation viewer
- Subagent / parent-child session linking
- Export / CSV download

---

## Example Data (from your actual sessions)

- **24 projects** in `~/.claude/projects/`
- **1,178 JSONL session files**
- **1,607 history entries** in `history.jsonl`
- Sample session: 133 assistant messages, 14K output tokens, 7.3M cache read tokens, ~31 min duration
- Common tools: `SendMessage`, `Bash`, `Read`, `Edit`, `Glob`, `Grep`, `Agent`
