# CC Analytics — Claude Code Usage Dashboard

## Overview

A local Next.js dashboard that reads Claude Code session data from `~/.claude/` and presents usage analytics: token consumption, cost tracking, session history, and per-project breakdowns. Runs locally via `next dev`, no external services required.

## Target User

Developer on Claude Max 5x plan ($100/mo) who wants visibility into their Claude Code usage patterns and whether the plan is delivering value vs API pricing.

## Architecture

### Data Flow

```
~/.claude/projects/**/*.jsonl
        │
        ▼
  Next.js API Routes (server-side)
  ├── Parse JSONL files
  ├── Aggregate by session/project/day
  ├── Calculate costs per model
  └── In-memory cache (5-min TTL)
        │
        ▼
  React Frontend (client-side)
  ├── Fetches from API routes
  ├── Auto-refresh polling (30s)
  └── Recharts for visualization
```

### Tech Stack

- **Framework:** Next.js 15 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS (dark theme, zinc palette)
- **Charts:** Recharts
- **Database:** None — reads JSONL files directly
- **Caching:** In-memory Map with 5-minute TTL

### Data Source

Claude Code stores session data in `~/.claude/projects/`. Each project has a directory (path-encoded name) containing UUID-named `.jsonl` files — one per session.

**JSONL line types:**

- `type: "user"` — user messages with `sessionId`, `cwd`, `gitBranch`, `timestamp`
- `type: "assistant"` — assistant responses with:
  - `message.model` (e.g., `"claude-opus-4-6"`)
  - `message.usage.input_tokens`
  - `message.usage.output_tokens`
  - `message.usage.cache_creation_input_tokens`
  - `message.usage.cache_read_input_tokens`
  - `timestamp`, `sessionId`

### Cost Calculation

API-equivalent cost calculated per assistant message using Anthropic API pricing:

| Model | Input | Output | Cache Read | Cache Write |
|-------|-------|--------|------------|-------------|
| Opus 4 | $15/MTok | $75/MTok | $1.50/MTok | $18.75/MTok |
| Sonnet 4 | $3/MTok | $15/MTok | $0.30/MTok | $3.75/MTok |
| Haiku 3.5 | $0.80/MTok | $4/MTok | $0.08/MTok | $1/MTok |

Plan comparison: show API-equivalent total vs $100/mo (Max 5x) to calculate value multiplier.

## Layout

Sidebar navigation with three pages:

- **Dashboard** — overview with stat cards and charts
- **Sessions** — searchable session history
- **Projects** — per-project breakdown

Sidebar also shows:
- App branding ("CC Analytics")
- Current plan info (Max 5x, $100/mo)
- Auto-refresh status indicator (green dot, "Live · 30s")

Global date range filter on every page: 7d / 30d / 90d / All / Custom

## Pages

### 1. Dashboard (Overview)

**Stat Cards (row of 5):**
- Total Tokens (with % change vs previous period)
- API-Equivalent Cost (with savings amount vs plan)
- Sessions (with daily average)
- Active Projects (with count active today)
- Avg Session Duration (with avg tokens per session)

**Charts (2x2 grid):**
- **Daily Token Usage** (2/3 width) — stacked area chart, last 30 days. Layers: cache read (green), input (blue), output (pink). Respects date range filter.
- **Model Usage** (1/3 width) — donut chart showing % split across Opus/Sonnet/Haiku by token count.
- **Cost: Plan vs API** (1/2 width) — side-by-side comparison showing plan cost ($100), API equivalent, value multiplier (e.g., "8.5x"), and a progress bar showing plan utilization.
- **Top Tools** (1/2 width) — horizontal bar chart of top 10 tools by invocation count (Read, Edit, Bash, Grep, Write, etc.)

### 2. Sessions

**Controls:**
- Search bar — searches across project name, git branch, first prompt text
- Dropdown filters: Project, Model
- Date range filter (shared component)
- Count display: "142 of 142 sessions · Sorted by newest"

**Session Rows (expandable):**
- **Collapsed:** project name, git branch badge, model badge (color-coded), first prompt (truncated), timestamp, duration, token count, cost
- **Expanded:** message counts (user/assistant), token breakdown (input/output/cache read/cache write), tools used with counts, session ID

### 3. Projects

**Controls:**
- Sort by: Cost, Tokens, Sessions, Last Active

**Project Cards:**
- **Expanded view** (top project or clicked): project name, full path, API-eq cost, stat grid (sessions, tokens, total time, primary model, last active), branch breakdown table (branch name, session count, tokens, cost per branch)
- **Compact cards** (remaining): project name, cost, sessions/tokens/last active stats, branch tags

Clicking a compact card expands it to the detailed view.

## Features

### Date Range Filtering
- Preset buttons: 7d, 30d, 90d, All
- Custom range: date picker for start/end
- Applied globally — all stat cards, charts, session lists, and project breakdowns respect the selected range
- Persisted in URL query params

### Git Branch Tracking
- Extracted from `gitBranch` field in user message JSONL lines
- Displayed as badges on session rows
- Aggregated per-project on the Projects page (sessions, tokens, cost per branch)

### Auto-Refresh
- Frontend polls API routes every 30 seconds
- Green status indicator in sidebar: "Live · 30s"
- Only re-fetches if data has changed (API returns last-modified timestamp)
- Can be paused/resumed

### Cost Comparison
- API-equivalent cost calculated per assistant message based on model and token counts
- Compared against Max 5x plan price ($100/mo)
- Value multiplier shown (API cost / plan cost)
- Savings amount shown on stat card

## File Structure

```
src/
├── app/
│   ├── layout.tsx              # Root layout with sidebar
│   ├── page.tsx                # Dashboard overview
│   ├── sessions/
│   │   └── page.tsx            # Sessions list
│   ├── projects/
│   │   └── page.tsx            # Projects breakdown
│   └── api/
│       ├── stats/
│       │   └── route.ts        # Aggregated stats (cards, charts)
│       ├── sessions/
│       │   └── route.ts        # Session list with filtering
│       └── projects/
│           └── route.ts        # Project breakdown
├── components/
│   ├── sidebar.tsx             # Navigation sidebar
│   ├── date-range-filter.tsx   # Shared date range picker
│   ├── stat-card.tsx           # Reusable stat card
│   ├── token-chart.tsx         # Daily token area chart
│   ├── model-chart.tsx         # Model usage donut
│   ├── cost-comparison.tsx     # Plan vs API comparison
│   ├── tools-chart.tsx         # Top tools bar chart
│   ├── session-list.tsx        # Expandable session rows
│   └── project-card.tsx        # Expandable project cards
└── lib/
    ├── parse-sessions.ts       # JSONL parser + session aggregator
    ├── cache.ts                # In-memory cache with TTL
    ├── cost.ts                 # Cost calculation per model
    └── format.ts               # Number/date/token formatters
```

## Error Handling

- If `~/.claude/` doesn't exist or is empty: show friendly "No Claude Code data found" message with instructions
- If a JSONL file is malformed: skip the bad line, continue parsing
- If cache is stale and re-parse fails: serve stale data with a warning indicator

## Out of Scope (for MVP)

- Export/download reports
- Multiple plan comparison (only Max 5x for now)
- Subagent session tracking (can add later)
- Historical plan switching (assumes consistent plan)
