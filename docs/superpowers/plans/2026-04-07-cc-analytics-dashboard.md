# CC Analytics Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the existing single-page Claude Code analytics dashboard into a sidebar-navigated, multi-page app with date range filtering, auto-refresh, model usage charts, cost comparison, git branch tracking, and per-project drill-downs.

**Architecture:** Next.js App Router with sidebar layout wrapping three page routes (/, /sessions, /projects). API routes accept date range query params and filter server-side. Client polls every 30s for live updates. All state management via React hooks — no external state library.

**Tech Stack:** Next.js 15, TypeScript, Tailwind CSS, Recharts, date-fns

---

## File Structure

```
src/
├── app/
│   ├── layout.tsx              # UPDATE: Add sidebar layout wrapper
│   ├── page.tsx                # UPDATE: Dashboard overview (refactored from dashboard.tsx)
│   ├── sessions/
│   │   └── page.tsx            # CREATE: Sessions page
│   ├── projects/
│   │   └── page.tsx            # CREATE: Projects page
│   └── api/
│       └── sessions/
│           └── route.ts        # UPDATE: Add date range filtering, branch stats, model filter
├── components/
│   ├── sidebar.tsx             # CREATE: Navigation sidebar
│   ├── date-range-filter.tsx   # CREATE: Shared date range picker
│   ├── stat-card.tsx           # CREATE: Single reusable stat card (replaces stats-cards.tsx)
│   ├── stats-cards.tsx         # DELETE: Replaced by stat-card.tsx used in page.tsx
│   ├── dashboard.tsx           # DELETE: Logic moves into app/page.tsx
│   ├── model-chart.tsx         # CREATE: Model usage donut/pie chart
│   ├── cost-comparison.tsx     # CREATE: Plan vs API cost comparison panel
│   ├── token-chart.tsx         # UPDATE: Accept date-filtered data
│   ├── cost-chart.tsx          # UPDATE: Accept date-filtered data
│   ├── tools-chart.tsx         # UPDATE: Accept date-filtered data
│   ├── session-list.tsx        # UPDATE: Add model/project filter dropdowns
│   ├── project-card.tsx        # CREATE: Expandable project card with branch breakdown
│   └── project-table.tsx       # DELETE: Replaced by project-card.tsx
└── lib/
    ├── types.ts                # CREATE: Shared types (DRY up duplicated interfaces)
    ├── claude-data.ts          # UPDATE: Add date filtering, branch aggregation per project
    ├── cost.ts                 # CREATE: Extract cost constants (plan price, pricing table)
    ├── cache.ts                # UPDATE: Extract cache into own module
    ├── format.ts               # KEEP: No changes needed
    └── hooks/
        └── use-dashboard-data.ts  # CREATE: Shared data fetching hook with auto-refresh
```

---

### Task 1: Extract Shared Types

**Files:**
- Create: `src/lib/types.ts`

- [ ] **Step 1: Create shared types file**

```typescript
// src/lib/types.ts
export interface TokenUsage {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
}

export interface SessionSummary {
  id: string;
  project: string;
  projectPath: string;
  firstTimestamp: string;
  lastTimestamp: string;
  durationMs: number;
  messageCount: number;
  userMessages: number;
  assistantMessages: number;
  tokens: TokenUsage;
  cost: number;
  models: string[];
  tools: Record<string, number>;
  firstPrompt: string;
  gitBranch: string;
}

export interface DailyStat {
  date: string;
  sessions: number;
  tokens: TokenUsage;
  cost: number;
  messageCount: number;
}

export interface ProjectStat {
  project: string;
  projectPath: string;
  sessions: number;
  tokens: TokenUsage;
  cost: number;
  lastActive: string;
  branches: BranchStat[];
  totalDurationMs: number;
  primaryModel: string;
}

export interface BranchStat {
  branch: string;
  sessions: number;
  tokens: TokenUsage;
  cost: number;
}

export interface OverviewStats {
  totalSessions: number;
  totalCost: number;
  totalTokens: TokenUsage;
  totalMessages: number;
  avgSessionDuration: number;
  avgCostPerSession: number;
  activeProjects: number;
  activeToday: number;
  topModels: { model: string; count: number; tokens: number }[];
  topTools: { tool: string; count: number }[];
}

export interface DateRange {
  from: string | null;
  to: string | null;
  preset: "7d" | "30d" | "90d" | "all" | "custom";
}

export const PLAN_PRICE = 100; // Max 5x monthly cost
```

- [ ] **Step 2: Update claude-data.ts to import from types.ts**

In `src/lib/claude-data.ts`, replace the local type definitions (lines 32-84) with imports:

```typescript
// Replace the existing type definitions at the top with:
import type {
  TokenUsage,
  SessionSummary,
  DailyStat,
  ProjectStat,
  BranchStat,
  OverviewStats,
} from "./types";
```

Keep all the existing exports (`getAllSessions`, `computeOverview`, `computeDailyStats`, `computeProjectStats`) — they still need to be exported from this file. Just remove the duplicate interface declarations.

- [ ] **Step 3: Verify the app still compiles**

Run: `cd /Users/lboschi/.superset/worktrees/CCDashboard/claudecodeanalytics && npx next build 2>&1 | tail -20`

Expected: Build succeeds (or only has warnings about unused vars which we'll fix in later tasks).

- [ ] **Step 4: Commit**

```bash
git add src/lib/types.ts src/lib/claude-data.ts
git commit -m "refactor: extract shared types to lib/types.ts"
```

---

### Task 2: Add Branch Aggregation and Date Filtering to Data Layer

**Files:**
- Modify: `src/lib/claude-data.ts`
- Modify: `src/app/api/sessions/route.ts`

- [ ] **Step 1: Update computeProjectStats to include branch breakdown**

In `src/lib/claude-data.ts`, replace the `computeProjectStats` function with:

```typescript
export function computeProjectStats(sessions: SessionSummary[]): ProjectStat[] {
  const byProject: Record<string, {
    project: string;
    projectPath: string;
    sessions: number;
    tokens: TokenUsage;
    cost: number;
    lastActive: string;
    totalDurationMs: number;
    modelCounts: Record<string, number>;
    branches: Record<string, { sessions: number; tokens: TokenUsage; cost: number }>;
  }> = {};

  for (const s of sessions) {
    if (!byProject[s.project]) {
      byProject[s.project] = {
        project: s.project,
        projectPath: s.projectPath,
        sessions: 0,
        tokens: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        cost: 0,
        lastActive: s.firstTimestamp,
        totalDurationMs: 0,
        modelCounts: {},
        branches: {},
      };
    }
    const p = byProject[s.project];
    p.sessions++;
    p.tokens.input += s.tokens.input;
    p.tokens.output += s.tokens.output;
    p.tokens.cacheRead += s.tokens.cacheRead;
    p.tokens.cacheWrite += s.tokens.cacheWrite;
    p.cost += s.cost;
    p.totalDurationMs += s.durationMs;
    if (s.firstTimestamp > p.lastActive) p.lastActive = s.firstTimestamp;

    for (const m of s.models) {
      p.modelCounts[m] = (p.modelCounts[m] || 0) + 1;
    }

    const branch = s.gitBranch || "unknown";
    if (!p.branches[branch]) {
      p.branches[branch] = { sessions: 0, tokens: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, cost: 0 };
    }
    const b = p.branches[branch];
    b.sessions++;
    b.tokens.input += s.tokens.input;
    b.tokens.output += s.tokens.output;
    b.tokens.cacheRead += s.tokens.cacheRead;
    b.tokens.cacheWrite += s.tokens.cacheWrite;
    b.cost += s.cost;
  }

  return Object.values(byProject)
    .map((p) => {
      const primaryModel = Object.entries(p.modelCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "unknown";
      const branches: BranchStat[] = Object.entries(p.branches)
        .map(([branch, data]) => ({ branch, ...data }))
        .sort((a, b) => b.cost - a.cost);
      return {
        project: p.project,
        projectPath: p.projectPath,
        sessions: p.sessions,
        tokens: p.tokens,
        cost: p.cost,
        lastActive: p.lastActive,
        branches,
        totalDurationMs: p.totalDurationMs,
        primaryModel: primaryModel.replace("claude-", "").split("-2")[0],
      };
    })
    .sort((a, b) => b.cost - a.cost);
}
```

- [ ] **Step 2: Update computeOverview to include activeProjects, activeToday, and token counts per model**

In `src/lib/claude-data.ts`, replace the `computeOverview` function with:

```typescript
export function computeOverview(sessions: SessionSummary[]): OverviewStats {
  const totalTokens: TokenUsage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
  let totalCost = 0;
  let totalMessages = 0;
  let totalDuration = 0;
  const modelCounts: Record<string, { count: number; tokens: number }> = {};
  const toolCounts: Record<string, number> = {};
  const projectSet = new Set<string>();
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayProjects = new Set<string>();

  for (const s of sessions) {
    totalTokens.input += s.tokens.input;
    totalTokens.output += s.tokens.output;
    totalTokens.cacheRead += s.tokens.cacheRead;
    totalTokens.cacheWrite += s.tokens.cacheWrite;
    totalCost += s.cost;
    totalMessages += s.messageCount;
    totalDuration += s.durationMs;
    projectSet.add(s.project);
    if (s.firstTimestamp.startsWith(todayStr)) todayProjects.add(s.project);

    const sessionTokens = s.tokens.input + s.tokens.output + s.tokens.cacheRead + s.tokens.cacheWrite;
    for (const m of s.models) {
      if (!modelCounts[m]) modelCounts[m] = { count: 0, tokens: 0 };
      modelCounts[m].count++;
      modelCounts[m].tokens += sessionTokens;
    }
    for (const [tool, count] of Object.entries(s.tools)) {
      toolCounts[tool] = (toolCounts[tool] || 0) + count;
    }
  }

  const topModels = Object.entries(modelCounts)
    .sort((a, b) => b[1].tokens - a[1].tokens)
    .slice(0, 5)
    .map(([model, data]) => ({ model, count: data.count, tokens: data.tokens }));

  const topTools = Object.entries(toolCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([tool, count]) => ({ tool, count }));

  return {
    totalSessions: sessions.length,
    totalCost,
    totalTokens,
    totalMessages,
    avgSessionDuration: sessions.length ? totalDuration / sessions.length : 0,
    avgCostPerSession: sessions.length ? totalCost / sessions.length : 0,
    activeProjects: projectSet.size,
    activeToday: todayProjects.size,
    topModels,
    topTools,
  };
}
```

- [ ] **Step 3: Add date filtering helper**

Add this function to `src/lib/claude-data.ts` after the imports:

```typescript
export function filterByDateRange(
  sessions: SessionSummary[],
  from: string | null,
  to: string | null,
): SessionSummary[] {
  if (!from && !to) return sessions;
  return sessions.filter((s) => {
    const ts = s.firstTimestamp;
    if (from && ts < from) return false;
    if (to && ts > to) return false;
    return true;
  });
}
```

- [ ] **Step 4: Update API route to support date range and model filtering**

Replace `src/app/api/sessions/route.ts` with:

```typescript
import { NextResponse } from "next/server";
import {
  getAllSessions,
  computeOverview,
  computeDailyStats,
  computeProjectStats,
  filterByDateRange,
} from "@/lib/claude-data";

let cache: { data: Awaited<ReturnType<typeof getAllSessions>>; ts: number } | null = null;
const CACHE_TTL = 30_000;

async function getCachedSessions() {
  if (cache && Date.now() - cache.ts < CACHE_TTL) return cache.data;
  const data = await getAllSessions();
  cache = { data, ts: Date.now() };
  return data;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const view = searchParams.get("view") || "overview";
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const allSessions = await getCachedSessions();
  const sessions = filterByDateRange(allSessions, from, to);

  switch (view) {
    case "overview":
      return NextResponse.json(computeOverview(sessions));
    case "daily":
      return NextResponse.json(computeDailyStats(sessions));
    case "projects":
      return NextResponse.json(computeProjectStats(sessions));
    case "sessions": {
      const limit = parseInt(searchParams.get("limit") || "50", 10);
      const offset = parseInt(searchParams.get("offset") || "0", 10);
      const project = searchParams.get("project");
      const model = searchParams.get("model");
      let filtered = sessions;
      if (project) {
        filtered = filtered.filter((s) => s.project === project);
      }
      if (model) {
        filtered = filtered.filter((s) => s.models.some((m) => m.includes(model)));
      }
      return NextResponse.json({
        total: filtered.length,
        sessions: filtered.slice(offset, offset + limit),
      });
    }
    case "meta": {
      const projects = [...new Set(allSessions.map((s) => s.project))].sort();
      const models = [...new Set(allSessions.flatMap((s) => s.models))].sort();
      return NextResponse.json({ projects, models, lastUpdated: cache?.ts });
    }
    default:
      return NextResponse.json({ error: "Unknown view" }, { status: 400 });
  }
}
```

- [ ] **Step 5: Verify build**

Run: `cd /Users/lboschi/.superset/worktrees/CCDashboard/claudecodeanalytics && npx next build 2>&1 | tail -20`

- [ ] **Step 6: Commit**

```bash
git add src/lib/claude-data.ts src/app/api/sessions/route.ts
git commit -m "feat: add date range filtering, branch aggregation, model filter to API"
```

---

### Task 3: Create Sidebar Component

**Files:**
- Create: `src/components/sidebar.tsx`
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Create the sidebar component**

```typescript
// src/components/sidebar.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PLAN_PRICE } from "@/lib/types";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: "📊" },
  { href: "/sessions", label: "Sessions", icon: "💬" },
  { href: "/projects", label: "Projects", icon: "📁" },
];

export function Sidebar({ refreshStatus }: { refreshStatus: "live" | "paused" }) {
  const pathname = usePathname();

  return (
    <aside className="w-56 bg-zinc-950 border-r border-zinc-800 flex flex-col h-screen sticky top-0 shrink-0">
      <div className="px-5 pt-5 pb-2">
        <h1 className="text-violet-400 font-bold text-base tracking-tight">CC Analytics</h1>
        <p className="text-zinc-600 text-xs">Claude Code Dashboard</p>
      </div>

      <nav className="flex-1 px-3 mt-4 space-y-0.5">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                isActive
                  ? "bg-zinc-800 text-white"
                  : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50"
              }`}
            >
              <span className={isActive ? "opacity-80" : "opacity-50"}>{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="px-5 pb-5 space-y-4 border-t border-zinc-800 pt-4">
        <div>
          <p className="text-zinc-600 text-[10px] uppercase tracking-wider mb-1">Auto-refresh</p>
          <div className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full ${refreshStatus === "live" ? "bg-emerald-400" : "bg-zinc-600"}`} />
            <span className={`text-xs ${refreshStatus === "live" ? "text-emerald-400" : "text-zinc-600"}`}>
              {refreshStatus === "live" ? "Live · 30s" : "Paused"}
            </span>
          </div>
        </div>
        <div>
          <p className="text-zinc-600 text-[10px] uppercase tracking-wider mb-1">Plan</p>
          <p className="text-violet-400 text-sm font-medium">Max 5x</p>
          <p className="text-zinc-600 text-xs">${PLAN_PRICE}/mo</p>
        </div>
      </div>
    </aside>
  );
}
```

- [ ] **Step 2: Update root layout to include sidebar**

Replace `src/app/layout.tsx` with:

```typescript
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/sidebar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Claude Code Analytics",
  description: "Local dashboard to track Claude Code usage, tokens, and costs",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-zinc-950 text-zinc-100`}
      >
        <div className="flex min-h-screen">
          <Sidebar refreshStatus="live" />
          <main className="flex-1 overflow-auto">{children}</main>
        </div>
      </body>
    </html>
  );
}
```

- [ ] **Step 3: Verify build**

Run: `cd /Users/lboschi/.superset/worktrees/CCDashboard/claudecodeanalytics && npx next build 2>&1 | tail -20`

- [ ] **Step 4: Commit**

```bash
git add src/components/sidebar.tsx src/app/layout.tsx
git commit -m "feat: add sidebar navigation layout"
```

---

### Task 4: Create Date Range Filter Component

**Files:**
- Create: `src/components/date-range-filter.tsx`

- [ ] **Step 1: Create the date range filter**

```typescript
// src/components/date-range-filter.tsx
"use client";

import { useState } from "react";
import type { DateRange } from "@/lib/types";
import { subDays, format } from "date-fns";

type Preset = DateRange["preset"];

const PRESETS: { label: string; value: Preset }[] = [
  { label: "7d", value: "7d" },
  { label: "30d", value: "30d" },
  { label: "90d", value: "90d" },
  { label: "All", value: "all" },
  { label: "Custom", value: "custom" },
];

function presetToRange(preset: Preset): { from: string | null; to: string | null } {
  if (preset === "all") return { from: null, to: null };
  const days = preset === "7d" ? 7 : preset === "30d" ? 30 : 90;
  const from = format(subDays(new Date(), days), "yyyy-MM-dd");
  return { from, to: null };
}

export function DateRangeFilter({
  value,
  onChange,
}: {
  value: DateRange;
  onChange: (range: DateRange) => void;
}) {
  const [showCustom, setShowCustom] = useState(false);
  const [customFrom, setCustomFrom] = useState(value.from || "");
  const [customTo, setCustomTo] = useState(value.to || "");

  function handlePreset(preset: Preset) {
    if (preset === "custom") {
      setShowCustom(true);
      return;
    }
    setShowCustom(false);
    const { from, to } = presetToRange(preset);
    onChange({ from, to, preset });
  }

  function applyCustom() {
    onChange({ from: customFrom || null, to: customTo || null, preset: "custom" });
  }

  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-0.5 bg-zinc-900 border border-zinc-800 rounded-lg p-0.5">
        {PRESETS.map((p) => (
          <button
            key={p.value}
            onClick={() => handlePreset(p.value)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              value.preset === p.value
                ? "bg-zinc-700 text-white"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
      {showCustom && (
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={customFrom}
            onChange={(e) => setCustomFrom(e.target.value)}
            className="bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-1.5 text-xs text-zinc-300 focus:outline-none focus:ring-1 focus:ring-zinc-600"
          />
          <span className="text-zinc-600 text-xs">to</span>
          <input
            type="date"
            value={customTo}
            onChange={(e) => setCustomTo(e.target.value)}
            className="bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-1.5 text-xs text-zinc-300 focus:outline-none focus:ring-1 focus:ring-zinc-600"
          />
          <button
            onClick={applyCustom}
            className="bg-violet-600 hover:bg-violet-500 text-white text-xs px-3 py-1.5 rounded-lg transition-colors"
          >
            Apply
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/date-range-filter.tsx
git commit -m "feat: add date range filter component"
```

---

### Task 5: Create Data Fetching Hook with Auto-Refresh

**Files:**
- Create: `src/lib/hooks/use-dashboard-data.ts`

- [ ] **Step 1: Create the hook**

```typescript
// src/lib/hooks/use-dashboard-data.ts
"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import type {
  OverviewStats,
  DailyStat,
  ProjectStat,
  SessionSummary,
  DateRange,
} from "@/lib/types";

interface DashboardData {
  overview: OverviewStats | null;
  daily: DailyStat[];
  projects: ProjectStat[];
  sessions: SessionSummary[];
  sessionsTotal: number;
  meta: { projects: string[]; models: string[] };
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

function buildQueryParams(dateRange: DateRange, extra?: Record<string, string>): string {
  const params = new URLSearchParams();
  if (dateRange.from) params.set("from", dateRange.from);
  if (dateRange.to) params.set("to", dateRange.to);
  if (extra) {
    for (const [k, v] of Object.entries(extra)) {
      if (v) params.set(k, v);
    }
  }
  const qs = params.toString();
  return qs ? `&${qs}` : "";
}

export function useDashboardData(
  dateRange: DateRange,
  views: ("overview" | "daily" | "projects" | "sessions" | "meta")[] = ["overview", "daily", "projects", "sessions", "meta"],
  sessionFilters?: { project?: string; model?: string; limit?: number },
): DashboardData {
  const [overview, setOverview] = useState<OverviewStats | null>(null);
  const [daily, setDaily] = useState<DailyStat[]>([]);
  const [projects, setProjects] = useState<ProjectStat[]>([]);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [sessionsTotal, setSessionsTotal] = useState(0);
  const [meta, setMeta] = useState<{ projects: string[]; models: string[] }>({ projects: [], models: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    try {
      const qp = buildQueryParams(dateRange, {
        project: sessionFilters?.project || "",
        model: sessionFilters?.model || "",
        limit: String(sessionFilters?.limit || 100),
      });

      const fetches: Promise<unknown>[] = views.map((view) =>
        fetch(`/api/sessions?view=${view}${qp}`).then((r) => r.json()),
      );

      const results = await Promise.all(fetches);

      views.forEach((view, i) => {
        switch (view) {
          case "overview":
            setOverview(results[i] as OverviewStats);
            break;
          case "daily":
            setDaily(results[i] as DailyStat[]);
            break;
          case "projects":
            setProjects(results[i] as ProjectStat[]);
            break;
          case "sessions": {
            const data = results[i] as { total: number; sessions: SessionSummary[] };
            setSessions(data.sessions);
            setSessionsTotal(data.total);
            break;
          }
          case "meta":
            setMeta(results[i] as { projects: string[]; models: string[] });
            break;
        }
      });

      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, [dateRange, views, sessionFilters?.project, sessionFilters?.model, sessionFilters?.limit]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  useEffect(() => {
    intervalRef.current = setInterval(load, 30_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [load]);

  return {
    overview,
    daily,
    projects,
    sessions,
    sessionsTotal,
    meta,
    loading,
    error,
    refresh: load,
  };
}
```

- [ ] **Step 2: Commit**

```bash
mkdir -p src/lib/hooks
git add src/lib/hooks/use-dashboard-data.ts
git commit -m "feat: add auto-refreshing data hook with date range support"
```

---

### Task 6: Create New Chart Components (Model Chart + Cost Comparison)

**Files:**
- Create: `src/components/model-chart.tsx`
- Create: `src/components/cost-comparison.tsx`
- Create: `src/components/stat-card.tsx`

- [ ] **Step 1: Create the model usage pie chart**

```typescript
// src/components/model-chart.tsx
"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { formatTokens } from "@/lib/format";

interface Props {
  models: { model: string; count: number; tokens: number }[];
}

const MODEL_COLORS: Record<string, string> = {
  opus: "#a78bfa",
  sonnet: "#38bdf8",
  haiku: "#fbbf24",
};

function getColor(model: string): string {
  const lower = model.toLowerCase();
  for (const [key, color] of Object.entries(MODEL_COLORS)) {
    if (lower.includes(key)) return color;
  }
  return "#71717a";
}

function shortName(model: string): string {
  return model
    .replace("claude-", "")
    .replace(/-\d{8}$/, "")
    .split("-")
    .slice(0, 2)
    .join("-");
}

export function ModelChart({ models }: Props) {
  const totalTokens = models.reduce((sum, m) => sum + m.tokens, 0);

  const data = models.map((m) => ({
    name: shortName(m.model),
    value: m.tokens,
    pct: totalTokens > 0 ? Math.round((m.tokens / totalTokens) * 100) : 0,
    color: getColor(m.model),
  }));

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
      <h3 className="text-sm font-medium text-zinc-400 mb-4">Model Usage</h3>
      <div className="flex items-center gap-6">
        <div className="w-28 h-28">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={30}
                outerRadius={50}
                dataKey="value"
                stroke="none"
              >
                {data.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: "#18181b",
                  border: "1px solid #27272a",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
                formatter={(value: number) => [formatTokens(value), "Tokens"]}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex-1 space-y-2">
          {data.map((d) => (
            <div key={d.name} className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <span style={{ color: d.color }}>●</span>
                <span className="text-zinc-300 capitalize">{d.name}</span>
              </div>
              <span className="text-zinc-500">{d.pct}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create the cost comparison panel**

```typescript
// src/components/cost-comparison.tsx
"use client";

import { formatCost } from "@/lib/format";
import { PLAN_PRICE } from "@/lib/types";

interface Props {
  apiCost: number;
}

export function CostComparison({ apiCost }: Props) {
  const savings = apiCost - PLAN_PRICE;
  const multiplier = apiCost > 0 ? (apiCost / PLAN_PRICE).toFixed(1) : "0";
  const utilizationPct = apiCost > 0 ? Math.min((PLAN_PRICE / apiCost) * 100, 100) : 100;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
      <h3 className="text-sm font-medium text-zinc-400 mb-4">Cost: Plan vs API</h3>
      <div className="flex items-center gap-6 mb-4">
        <div>
          <p className="text-zinc-600 text-xs">Your Plan</p>
          <p className="text-violet-400 text-xl font-bold">{formatCost(PLAN_PRICE)}</p>
        </div>
        <span className="text-zinc-600 text-lg">vs</span>
        <div>
          <p className="text-zinc-600 text-xs">API Equivalent</p>
          <p className="text-red-400 text-xl font-bold">{formatCost(apiCost)}</p>
        </div>
        <div className="ml-auto bg-emerald-400/10 border border-emerald-400/20 rounded-lg px-3 py-2 text-center">
          <p className="text-emerald-400 text-lg font-bold">{multiplier}x</p>
          <p className="text-emerald-400 text-[10px]">value</p>
        </div>
      </div>
      <div className="bg-zinc-800 rounded-full h-2 overflow-hidden">
        <div
          className="bg-gradient-to-r from-violet-500 to-emerald-400 h-full rounded-full transition-all"
          style={{ width: `${utilizationPct}%` }}
        />
      </div>
      <p className="text-zinc-600 text-xs mt-2">
        {savings > 0
          ? `Saving ${formatCost(savings)} vs API pricing this period`
          : "Your API-equivalent usage is below plan price"}
      </p>
    </div>
  );
}
```

- [ ] **Step 3: Create reusable stat card**

```typescript
// src/components/stat-card.tsx
"use client";

interface Props {
  label: string;
  value: string;
  sub?: string;
  color?: string;
}

export function StatCard({ label, value, sub, color = "text-white" }: Props) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
      <p className="text-zinc-600 text-[10px] uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      {sub && <p className="text-zinc-600 text-xs mt-1">{sub}</p>}
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/model-chart.tsx src/components/cost-comparison.tsx src/components/stat-card.tsx
git commit -m "feat: add model chart, cost comparison, and stat card components"
```

---

### Task 7: Build Dashboard Overview Page

**Files:**
- Modify: `src/app/page.tsx`
- Delete: `src/components/dashboard.tsx`
- Delete: `src/components/stats-cards.tsx`

- [ ] **Step 1: Rewrite the dashboard page**

Replace `src/app/page.tsx` with:

```typescript
// src/app/page.tsx
"use client";

import { useState } from "react";
import { useDashboardData } from "@/lib/hooks/use-dashboard-data";
import { DateRangeFilter } from "@/components/date-range-filter";
import { StatCard } from "@/components/stat-card";
import { TokenChart } from "@/components/token-chart";
import { ModelChart } from "@/components/model-chart";
import { CostComparison } from "@/components/cost-comparison";
import { ToolsChart } from "@/components/tools-chart";
import { formatCost, formatTokens, formatDuration } from "@/lib/format";
import { PLAN_PRICE } from "@/lib/types";
import type { DateRange } from "@/lib/types";

export default function DashboardPage() {
  const [dateRange, setDateRange] = useState<DateRange>({
    from: null,
    to: null,
    preset: "30d",
  });

  const { overview, daily, loading } = useDashboardData(
    dateRange,
    ["overview", "daily"],
  );

  if (loading && !overview) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-zinc-700 border-t-violet-500 rounded-full animate-spin" />
          <p className="text-zinc-500 text-sm">Parsing sessions...</p>
        </div>
      </div>
    );
  }

  if (!overview) return null;

  const totalTokenCount =
    overview.totalTokens.input +
    overview.totalTokens.output +
    overview.totalTokens.cacheRead +
    overview.totalTokens.cacheWrite;

  const savings = overview.totalCost - PLAN_PRICE;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Dashboard</h2>
        <DateRangeFilter value={dateRange} onChange={setDateRange} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <StatCard
          label="Total Tokens"
          value={formatTokens(totalTokenCount)}
          color="text-blue-400"
          sub={`${formatTokens(overview.totalTokens.output)} output`}
        />
        <StatCard
          label="API-Eq Cost"
          value={formatCost(overview.totalCost)}
          color="text-emerald-400"
          sub={savings > 0 ? `Saving ${formatCost(savings)}` : undefined}
        />
        <StatCard
          label="Sessions"
          value={overview.totalSessions.toLocaleString()}
          color="text-pink-400"
          sub={overview.totalSessions > 0
            ? `${(overview.totalSessions / 30).toFixed(1)} avg/day`
            : undefined}
        />
        <StatCard
          label="Active Projects"
          value={overview.activeProjects.toLocaleString()}
          color="text-amber-400"
          sub={`${overview.activeToday} active today`}
        />
        <StatCard
          label="Avg Session"
          value={formatDuration(overview.avgSessionDuration)}
          color="text-purple-400"
          sub={`${formatTokens(totalTokenCount / (overview.totalSessions || 1))} tok avg`}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <TokenChart daily={daily} />
        </div>
        <ModelChart models={overview.topModels} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <CostComparison apiCost={overview.totalCost} />
        <ToolsChart tools={overview.topTools} />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Delete old dashboard.tsx and stats-cards.tsx**

```bash
rm src/components/dashboard.tsx src/components/stats-cards.tsx
```

- [ ] **Step 3: Verify build**

Run: `cd /Users/lboschi/.superset/worktrees/CCDashboard/claudecodeanalytics && npx next build 2>&1 | tail -20`

- [ ] **Step 4: Commit**

```bash
git add -A src/app/page.tsx src/components/
git commit -m "feat: build dashboard overview page with sidebar layout"
```

---

### Task 8: Build Sessions Page

**Files:**
- Create: `src/app/sessions/page.tsx`
- Modify: `src/components/session-list.tsx`

- [ ] **Step 1: Update session-list to accept filter props**

Replace `src/components/session-list.tsx` with:

```typescript
// src/components/session-list.tsx
"use client";

import { useState } from "react";
import { formatCost, formatTokens, formatDuration, formatDateTime } from "@/lib/format";
import type { SessionSummary } from "@/lib/types";

export function SessionList({
  sessions,
  total,
}: {
  sessions: SessionSummary[];
  total: number;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div className="space-y-2">
      <p className="text-zinc-600 text-xs mb-3">
        {sessions.length} of {total} sessions · Sorted by newest
      </p>
      {sessions.map((s) => {
        const isOpen = expanded === s.id;
        const totalTokens =
          s.tokens.input + s.tokens.output + s.tokens.cacheRead + s.tokens.cacheWrite;
        const modelName = s.models[0]?.replace("claude-", "").split("-2")[0] || "unknown";
        const modelColor = modelName.includes("opus")
          ? "bg-violet-900/40 text-violet-300"
          : modelName.includes("haiku")
            ? "bg-amber-900/40 text-amber-300"
            : "bg-sky-900/40 text-sky-300";

        return (
          <div
            key={s.id}
            className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden"
          >
            <button
              onClick={() => setExpanded(isOpen ? null : s.id)}
              className="w-full text-left px-5 py-4 hover:bg-zinc-800/30 transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm">{s.project}</span>
                    {s.gitBranch && (
                      <span className="text-xs bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded">
                        {s.gitBranch}
                      </span>
                    )}
                    <span className={`text-xs px-2 py-0.5 rounded ${modelColor}`}>
                      {modelName}
                    </span>
                  </div>
                  <p className="text-sm text-zinc-500 truncate">
                    {s.firstPrompt || "No prompt recorded"}
                  </p>
                </div>
                <div className="flex items-center gap-5 text-sm text-zinc-500 shrink-0">
                  <span>{formatDateTime(s.firstTimestamp)}</span>
                  <span>{formatDuration(s.durationMs)}</span>
                  <span>{formatTokens(totalTokens)} tok</span>
                  <span className="font-mono text-emerald-400">{formatCost(s.cost)}</span>
                  <span className={`text-violet-400 transition-transform ${isOpen ? "rotate-180" : ""}`}>▼</span>
                </div>
              </div>
            </button>

            {isOpen && (
              <div className="px-5 pb-4 border-t border-zinc-800 pt-4 bg-zinc-950/50">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div>
                    <p className="text-xs text-zinc-600">Messages</p>
                    <p className="text-sm font-medium">
                      {s.userMessages} user / {s.assistantMessages} assistant
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-zinc-600">Input Tokens</p>
                    <p className="text-sm font-medium">{formatTokens(s.tokens.input)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-zinc-600">Output Tokens</p>
                    <p className="text-sm font-medium">{formatTokens(s.tokens.output)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-zinc-600">Cache Read</p>
                    <p className="text-sm font-medium">{formatTokens(s.tokens.cacheRead)}</p>
                  </div>
                </div>

                {Object.keys(s.tools).length > 0 && (
                  <div>
                    <p className="text-xs text-zinc-600 mb-2">Tools Used</p>
                    <div className="flex flex-wrap gap-1.5">
                      {Object.entries(s.tools)
                        .sort((a, b) => b[1] - a[1])
                        .map(([tool, count]) => (
                          <span
                            key={tool}
                            className="text-xs bg-zinc-800 text-zinc-300 px-2 py-1 rounded"
                          >
                            {tool} <span className="text-zinc-600">x{count}</span>
                          </span>
                        ))}
                    </div>
                  </div>
                )}

                <div className="mt-3">
                  <p className="text-xs text-zinc-600 mb-1">Session ID</p>
                  <p className="text-xs font-mono text-zinc-700">{s.id}</p>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Create sessions page**

```typescript
// src/app/sessions/page.tsx
"use client";

import { useState } from "react";
import { useDashboardData } from "@/lib/hooks/use-dashboard-data";
import { DateRangeFilter } from "@/components/date-range-filter";
import { SessionList } from "@/components/session-list";
import type { DateRange } from "@/lib/types";

export default function SessionsPage() {
  const [dateRange, setDateRange] = useState<DateRange>({
    from: null,
    to: null,
    preset: "30d",
  });
  const [search, setSearch] = useState("");
  const [projectFilter, setProjectFilter] = useState("");
  const [modelFilter, setModelFilter] = useState("");

  const { sessions, sessionsTotal, meta, loading } = useDashboardData(
    dateRange,
    ["sessions", "meta"],
    { project: projectFilter, model: modelFilter, limit: 200 },
  );

  const filtered = search
    ? sessions.filter(
        (s) =>
          s.project.toLowerCase().includes(search.toLowerCase()) ||
          s.firstPrompt.toLowerCase().includes(search.toLowerCase()) ||
          s.gitBranch.toLowerCase().includes(search.toLowerCase()),
      )
    : sessions;

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Sessions</h2>
        <DateRangeFilter value={dateRange} onChange={setDateRange} />
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Search sessions, projects, branches, prompts..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-zinc-600 placeholder:text-zinc-600"
        />
        <select
          value={projectFilter}
          onChange={(e) => setProjectFilter(e.target.value)}
          className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-600"
        >
          <option value="">All Projects</option>
          {meta.projects.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
        <select
          value={modelFilter}
          onChange={(e) => setModelFilter(e.target.value)}
          className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-600"
        >
          <option value="">All Models</option>
          {meta.models.map((m) => (
            <option key={m} value={m}>
              {m.replace("claude-", "").split("-2")[0]}
            </option>
          ))}
        </select>
      </div>

      {loading && !sessions.length ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-zinc-700 border-t-violet-500 rounded-full animate-spin" />
        </div>
      ) : (
        <SessionList sessions={filtered} total={sessionsTotal} />
      )}
    </div>
  );
}
```

- [ ] **Step 3: Verify build**

Run: `cd /Users/lboschi/.superset/worktrees/CCDashboard/claudecodeanalytics && npx next build 2>&1 | tail -20`

- [ ] **Step 4: Commit**

```bash
mkdir -p src/app/sessions
git add src/app/sessions/page.tsx src/components/session-list.tsx
git commit -m "feat: add sessions page with search, project/model filters"
```

---

### Task 9: Build Projects Page

**Files:**
- Create: `src/components/project-card.tsx`
- Create: `src/app/projects/page.tsx`
- Delete: `src/components/project-table.tsx`

- [ ] **Step 1: Create project card component**

```typescript
// src/components/project-card.tsx
"use client";

import { formatCost, formatTokens, formatDuration } from "@/lib/format";
import type { ProjectStat } from "@/lib/types";

interface Props {
  project: ProjectStat;
  expanded: boolean;
  onToggle: () => void;
}

export function ProjectCard({ project, expanded, onToggle }: Props) {
  const totalTokens =
    project.tokens.input +
    project.tokens.output +
    project.tokens.cacheRead +
    project.tokens.cacheWrite;

  const lastActiveLabel = formatRelativeDate(project.lastActive);

  if (!expanded) {
    return (
      <button
        onClick={onToggle}
        className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-left hover:bg-zinc-800/50 transition-colors w-full"
      >
        <div className="flex justify-between items-start mb-3">
          <p className="text-white text-sm font-medium">{project.project}</p>
          <p className="text-emerald-400 text-base font-bold font-mono">
            {formatCost(project.cost)}
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <p className="text-zinc-600 text-[9px] uppercase">Sessions</p>
            <p className="text-zinc-300 text-sm font-medium">{project.sessions}</p>
          </div>
          <div>
            <p className="text-zinc-600 text-[9px] uppercase">Tokens</p>
            <p className="text-blue-400 text-sm font-medium">{formatTokens(totalTokens)}</p>
          </div>
          <div>
            <p className="text-zinc-600 text-[9px] uppercase">Last Active</p>
            <p className="text-zinc-300 text-sm font-medium">{lastActiveLabel}</p>
          </div>
        </div>
        {project.branches.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-3">
            {project.branches.slice(0, 3).map((b) => (
              <span
                key={b.branch}
                className="text-[10px] bg-zinc-800 text-zinc-500 px-2 py-0.5 rounded"
              >
                {b.branch}
              </span>
            ))}
            {project.branches.length > 3 && (
              <span className="text-[10px] bg-zinc-800 text-zinc-500 px-2 py-0.5 rounded">
                +{project.branches.length - 3}
              </span>
            )}
          </div>
        )}
      </button>
    );
  }

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 col-span-2">
      <div className="flex justify-between items-start mb-1">
        <div>
          <button onClick={onToggle} className="text-white text-base font-semibold hover:text-zinc-300 transition-colors">
            {project.project} ←
          </button>
          <p className="text-zinc-600 text-xs mt-1">{project.projectPath}</p>
        </div>
        <div className="text-right">
          <p className="text-emerald-400 text-xl font-bold font-mono">
            {formatCost(project.cost)}
          </p>
          <p className="text-zinc-600 text-xs">API-equivalent cost</p>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-3 mt-4 mb-5">
        <div className="bg-zinc-800 rounded-lg p-3">
          <p className="text-zinc-600 text-[9px] uppercase">Sessions</p>
          <p className="text-white text-base font-semibold">{project.sessions}</p>
        </div>
        <div className="bg-zinc-800 rounded-lg p-3">
          <p className="text-zinc-600 text-[9px] uppercase">Tokens</p>
          <p className="text-blue-400 text-base font-semibold">{formatTokens(totalTokens)}</p>
        </div>
        <div className="bg-zinc-800 rounded-lg p-3">
          <p className="text-zinc-600 text-[9px] uppercase">Total Time</p>
          <p className="text-purple-400 text-base font-semibold">
            {formatDuration(project.totalDurationMs)}
          </p>
        </div>
        <div className="bg-zinc-800 rounded-lg p-3">
          <p className="text-zinc-600 text-[9px] uppercase">Primary Model</p>
          <p className="text-violet-400 text-base font-semibold capitalize">
            {project.primaryModel}
          </p>
        </div>
        <div className="bg-zinc-800 rounded-lg p-3">
          <p className="text-zinc-600 text-[9px] uppercase">Last Active</p>
          <p className="text-white text-base font-semibold">{lastActiveLabel}</p>
        </div>
      </div>

      {project.branches.length > 0 && (
        <div>
          <p className="text-zinc-600 text-[10px] uppercase tracking-wider mb-2">Branches</p>
          <div className="space-y-1">
            {project.branches.map((b) => (
              <div
                key={b.branch}
                className="flex items-center justify-between bg-zinc-800/50 rounded-lg px-3 py-2"
              >
                <div className="flex items-center gap-3">
                  <span className="text-zinc-300 text-xs font-mono">{b.branch}</span>
                  <span className="text-zinc-600 text-[10px]">{b.sessions} sessions</span>
                </div>
                <div className="flex gap-4 text-zinc-500 text-xs">
                  <span>
                    {formatTokens(
                      b.tokens.input + b.tokens.output + b.tokens.cacheRead + b.tokens.cacheWrite,
                    )}{" "}
                    tok
                  </span>
                  <span className="text-emerald-400 font-mono">{formatCost(b.cost)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function formatRelativeDate(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}
```

- [ ] **Step 2: Create projects page**

```typescript
// src/app/projects/page.tsx
"use client";

import { useState } from "react";
import { useDashboardData } from "@/lib/hooks/use-dashboard-data";
import { DateRangeFilter } from "@/components/date-range-filter";
import { ProjectCard } from "@/components/project-card";
import type { DateRange } from "@/lib/types";

type SortKey = "cost" | "sessions" | "tokens" | "lastActive";

export default function ProjectsPage() {
  const [dateRange, setDateRange] = useState<DateRange>({
    from: null,
    to: null,
    preset: "30d",
  });
  const [expandedProject, setExpandedProject] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortKey>("cost");

  const { projects, loading } = useDashboardData(dateRange, ["projects"]);

  const sorted = [...projects].sort((a, b) => {
    switch (sortBy) {
      case "cost":
        return b.cost - a.cost;
      case "sessions":
        return b.sessions - a.sessions;
      case "tokens": {
        const at = a.tokens.input + a.tokens.output + a.tokens.cacheRead + a.tokens.cacheWrite;
        const bt = b.tokens.input + b.tokens.output + b.tokens.cacheRead + b.tokens.cacheWrite;
        return bt - at;
      }
      case "lastActive":
        return b.lastActive.localeCompare(a.lastActive);
      default:
        return 0;
    }
  });

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Projects</h2>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-zinc-600 text-xs">Sort by:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortKey)}
              className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 text-sm text-zinc-300 focus:outline-none focus:ring-1 focus:ring-zinc-600"
            >
              <option value="cost">Cost</option>
              <option value="sessions">Sessions</option>
              <option value="tokens">Tokens</option>
              <option value="lastActive">Last Active</option>
            </select>
          </div>
          <DateRangeFilter value={dateRange} onChange={setDateRange} />
        </div>
      </div>

      {loading && !projects.length ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-zinc-700 border-t-violet-500 rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {sorted.map((p) => (
            <ProjectCard
              key={p.project}
              project={p}
              expanded={expandedProject === p.project}
              onToggle={() =>
                setExpandedProject(expandedProject === p.project ? null : p.project)
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Delete old project-table.tsx**

```bash
rm src/components/project-table.tsx
```

- [ ] **Step 4: Verify build**

Run: `cd /Users/lboschi/.superset/worktrees/CCDashboard/claudecodeanalytics && npx next build 2>&1 | tail -20`

- [ ] **Step 5: Commit**

```bash
mkdir -p src/app/projects
git add src/app/projects/page.tsx src/components/project-card.tsx
git add -u src/components/project-table.tsx
git commit -m "feat: add projects page with expandable cards and branch breakdown"
```

---

### Task 10: Update Cost Chart for Date-Filtered Data

**Files:**
- Modify: `src/components/cost-chart.tsx`

- [ ] **Step 1: Update cost-chart.tsx to remove hardcoded 30-day slice**

The `cost-chart.tsx` currently slices to last 30 days internally. Since the API now handles date filtering, remove the slice and just render whatever data is passed:

In `src/components/cost-chart.tsx`, replace `daily.slice(-30).map(...)` with `daily.map(...)`:

```typescript
const data = daily.map((d) => ({
  date: d.date.slice(5),
  cost: parseFloat(d.cost.toFixed(4)),
  sessions: d.sessions,
}));
```

- [ ] **Step 2: Similarly update token-chart.tsx**

In `src/components/token-chart.tsx`, replace `daily.slice(-30).map(...)` with `daily.map(...)`:

```typescript
const data = daily.map((d) => ({
  date: d.date.slice(5),
  input: d.tokens.input,
  output: d.tokens.output,
  cacheRead: d.tokens.cacheRead,
}));
```

Also update the heading from "Daily Tokens (last 30 days)" to "Daily Tokens":

```typescript
<h3 className="text-sm font-medium text-zinc-400 mb-4">
  Daily Tokens
</h3>
```

- [ ] **Step 3: Commit**

```bash
git add src/components/cost-chart.tsx src/components/token-chart.tsx
git commit -m "fix: remove hardcoded 30-day slices, use date-filtered data"
```

---

### Task 11: Add .gitignore for .superpowers and Cleanup

**Files:**
- Modify: `.gitignore` (or create if not exists)

- [ ] **Step 1: Ensure .gitignore covers .superpowers and node_modules**

Check if `.gitignore` exists. If not, create it. Make sure it contains:

```
node_modules/
.next/
.superpowers/
```

- [ ] **Step 2: Remove `src/components/dashboard.tsx` and `src/components/stats-cards.tsx` if still present**

```bash
rm -f src/components/dashboard.tsx src/components/stats-cards.tsx
```

- [ ] **Step 3: Final build verification**

Run: `cd /Users/lboschi/.superset/worktrees/CCDashboard/claudecodeanalytics && npx next build 2>&1 | tail -30`

Expected: Build succeeds with no errors.

- [ ] **Step 4: Run the dev server and verify manually**

Run: `cd /Users/lboschi/.superset/worktrees/CCDashboard/claudecodeanalytics && npx next dev`

Open `http://localhost:3000` and verify:
- Sidebar navigation works (Dashboard, Sessions, Projects)
- Dashboard shows stat cards, charts, cost comparison
- Sessions page has search, filters, expandable rows
- Projects page has sortable cards with branch breakdown
- Date range filter changes data across all pages
- Auto-refresh indicator shows "Live · 30s" in sidebar

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: add gitignore, cleanup deleted components"
```

---

## Summary

| Task | Description | Files Changed |
|------|-------------|---------------|
| 1 | Extract shared types | +types.ts, ~claude-data.ts |
| 2 | Date filtering + branch aggregation | ~claude-data.ts, ~route.ts |
| 3 | Sidebar navigation | +sidebar.tsx, ~layout.tsx |
| 4 | Date range filter component | +date-range-filter.tsx |
| 5 | Auto-refresh data hook | +use-dashboard-data.ts |
| 6 | Model chart + cost comparison | +model-chart.tsx, +cost-comparison.tsx, +stat-card.tsx |
| 7 | Dashboard overview page | ~page.tsx, -dashboard.tsx, -stats-cards.tsx |
| 8 | Sessions page | +sessions/page.tsx, ~session-list.tsx |
| 9 | Projects page | +projects/page.tsx, +project-card.tsx, -project-table.tsx |
| 10 | Update charts for date filtering | ~cost-chart.tsx, ~token-chart.tsx |
| 11 | Gitignore + cleanup | +.gitignore, final verification |
