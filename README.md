# Claude Code Analytics Dashboard

A local-only Next.js dashboard that visualizes your Claude Code usage. It reads session logs directly from `~/.claude/projects/` — no cloud services, no databases, no telemetry. Everything stays on your machine.

## What it shows

**Dashboard** (`/`) — Total tokens, API-equivalent cost, session count, active projects, average session duration. Charts for daily token trends (stacked area), model distribution (donut), daily cost (bar), and top 10 tools used (horizontal bar). Includes a cost comparison card showing what you'd pay at API rates vs. your $100/mo plan.

**Sessions** (`/sessions`) — Searchable, filterable list of every session. Each row shows project, branch, model, first prompt, timestamp, duration, tokens, and cost. Expand a row for full token breakdown and tool list.

**Projects** (`/projects`) — Card per project with cost, session count, token totals, last active date, and branch tags. Expand for per-branch breakdowns. Sortable by cost, sessions, tokens, or last active.

All pages share a date range picker (presets: 7d, 30d, 90d, custom) that filters data globally.

## Where the data comes from

Claude Code writes one JSONL file per session to:

```
~/.claude/projects/<encoded-project-path>/<session-id>.jsonl
```

Each line is a JSON object with a `type` field:

| Type | What it contains |
|------|-----------------|
| `user` | Your prompts (message text) |
| `assistant` | Model responses: `message.usage` (token counts by type), `message.model`, `message.content[]` (including `tool_use` blocks) |
| `system` | Metadata like the active git branch |

The dashboard reads these files, extracts token counts, model names, tool calls, timestamps, and branch info, then computes costs using per-model pricing rates.

Directory names are encoded paths (`-Users-you-project` = `/Users/you/project`). The dashboard reverses this for display.

## Project structure

```
src/
├── lib/                          # Data layer
│   ├── claude-data.ts            # JSONL parsing, cost math, aggregation
│   ├── types.ts                  # TypeScript interfaces
│   ├── format.ts                 # Display formatters (cost, tokens, duration, relative dates)
│   └── hooks/
│       └── use-dashboard-data.ts # React hook: fetch, cache, auto-refresh
│
├── app/                          # Pages & API
│   ├── api/sessions/route.ts     # Single API endpoint, multiple views
│   ├── page.tsx                  # Dashboard home
│   ├── sessions/page.tsx         # Session list
│   ├── projects/page.tsx         # Project cards
│   ├── layout.tsx                # Root layout with sidebar
│   └── globals.css               # Tailwind imports & global styles
│
└── components/                   # UI
    ├── sidebar.tsx               # Nav + plan info
    ├── stat-card.tsx             # Metric display card
    ├── date-range-filter.tsx     # Date preset/custom picker
    ├── token-chart.tsx           # Daily token area chart
    ├── model-chart.tsx           # Model usage donut chart
    ├── cost-chart.tsx            # Daily cost bar chart
    ├── cost-comparison.tsx       # Plan vs API cost card
    ├── tools-chart.tsx           # Top tools bar chart
    ├── project-card.tsx          # Expandable project detail
    └── session-list.tsx          # Expandable session rows
```

## Data flow

```
~/.claude/projects/**/*.jsonl
        │
        ▼
src/lib/claude-data.ts          ← parses JSONL line-by-line via Node readline
        │                         extracts tokens, model, tools, branch, timestamps
        │                         computes per-session cost from pricing table
        ▼
src/app/api/sessions/route.ts   ← single GET endpoint with ?view= param
        │                         views: overview | daily | projects | sessions | meta
        │                         filters: from, to, project, model
        │                         pagination: limit, offset
        │                         in-memory cache (30s TTL)
        ▼
src/lib/hooks/use-dashboard-data.ts  ← client-side hook
        │                              fetches multiple views in parallel
        │                              auto-refreshes every 30s
        ▼
React components                ← render charts, cards, lists
```

## Key design choices

**Single API endpoint with views.** Instead of `/api/overview`, `/api/daily`, etc., one route at `/api/sessions` takes a `view` query param. This keeps aggregation logic in one place and lets the client fetch multiple views in a single hook call. Add a new view by adding a case to the route handler.

**Streaming JSONL parse.** Session files are read line-by-line with Node's `readline` interface rather than loading entire files into memory. This keeps memory usage predictable even with large session histories.

**30s cache + 30s auto-refresh.** The server caches parsed sessions in memory for 30 seconds. The client polls every 30 seconds. This means data is at most ~60s stale but avoids re-parsing all JSONL files on every interaction.

**No database.** The JSONL files _are_ the database. Parsing is fast enough for personal usage volumes, and it means zero setup — no migrations, no schema, no syncing.

**Client-side text search.** The sessions page filters by text in the browser rather than sending search queries to the server. With personal-scale data this is instant and avoids unnecessary round-trips.

**Per-model pricing table.** Costs are calculated from a lookup table in `claude-data.ts`. Unknown models fall back to Sonnet pricing. To update prices or add a new model, edit the `PRICING` object:

```typescript
const PRICING = {
  "claude-sonnet-4-6":  { input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3.75 },
  "claude-opus-4-6":    { input: 15, output: 75, cacheRead: 1.5, cacheWrite: 18.75 },
  // rates are per 1M tokens
  default:              { input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3.75 },
};
```

**Plan cost comparison.** The dashboard assumes a $100/mo Max plan and shows an API-cost multiplier. This constant (`PLAN_PRICE`) lives in `claude-data.ts` — change it if you're on a different plan.

## Tech stack

| Layer | Choice | Why |
|-------|--------|-----|
| Framework | Next.js 15 (App Router) | Server-side API route + client pages in one project |
| UI | React 19 + Tailwind CSS v4 | Utility-first styling, fast iteration |
| Charts | Recharts | Composable React chart components, good defaults |
| Dates | date-fns | Tree-shakeable, no moment.js weight |
| Language | TypeScript | Type safety across data parsing → API → components |

No external services. No auth. No env vars required.

## Getting started

```bash
git clone https://github.com/k3nzo-dev/CCDashboard.git
cd CCDashboard
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The dashboard reads from `~/.claude/projects/` — if you've used Claude Code, you'll see data immediately.

## Customizing

**Change the data source path** — Edit the base path in `src/lib/claude-data.ts` (look for `os.homedir()` + `.claude/projects`).

**Add a new model's pricing** — Add an entry to the `PRICING` object in `src/lib/claude-data.ts`.

**Change the plan price** — Update `PLAN_PRICE` in `src/lib/claude-data.ts`.

**Add a new chart or metric** — Add a compute function in `claude-data.ts`, expose it as a new view case in `route.ts`, fetch it in `use-dashboard-data.ts`, render it in a component.

**Change the refresh interval** — Edit the `setInterval` duration in `src/lib/hooks/use-dashboard-data.ts`.

**Change chart colors** — Model colors are in `getColor()` within each chart component. Token type colors are inline in `token-chart.tsx`.
