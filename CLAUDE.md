# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## SESSION START

1. Read [l](http://todo.md)essons.md — apply all lessons before touching anything
2. Read todo.md — understand current state
3. If neither exists, create them before starting

## Project Context

Claude Code Analytics is a local-only Next.js dashboard that reads Claude Code session data from `~/.claude/projects/` and displays usage analytics (token consumption, estimated costs, session history, tool usage, trends). No cloud services, no database, no telemetry — all data stays local, parsed from JSONL files on every request (with a 30s in-memory cache).

Tech stack: Next.js 16 (App Router) + TypeScript + Tailwind CSS v4 + Recharts + date-fns.

## Commands

- `npm run dev` — start dev server (localhost:3000)
- `npm run build` — production build
- `npm run lint` — run ESLint (flat config, eslint.config.mjs)
- No test framework is configured yet

## WORKFLOW

### 1. Plan First

- Enter plan mode for any non-trivial task (3+ steps)
- Write plan to tasks/todo.md before implementing
- If something goes wrong, STOP and re-plan — never push through

### 2. Subagent Strategy

- Use subagents to keep main context clean
- One task per subagent
- Throw more compute at hard problems

### 3. Self-Improvement Loop

- After any correction: update tasks/lessons.md
- Format: \[date\] | what went wrong | rule to prevent it
- Review lessons at every session start

### 4. Verification Standard

- Never mark complete without proving it works
- Run tests, check logs, diff behavior
- Ask: "Would a staff engineer approve this?"

### 5. Demand Elegance

- For non-trivial changes: is there a more elegant solution?
- If a fix feels hacky: rebuild it properly
- Don't over-engineer simple things

### 6. Autonomous Bug Fixing

- When given a bug: just fix it
- Go to logs, find root cause, resolve it
- No hand-holding needed

## CORE PRINCIPLES

- Simplicity First — touch minimal code
- No Laziness — root causes only, no temp fixes
- Never Assume — verify paths, APIs, variables before using
- Ask Once — one question upfront if unclear, never interrupt mid-task

## Workflow Preferences

When asked to build something, start writing code immediately. Do not invoke brainstorming or planning workflows unless the user explicitly asks for a plan.

## Architecture

### Data Flow

1. `src/lib/claude-data.ts` — scans `~/.claude/projects/`, streams each `*.jsonl` file via `readline`, extracts session summaries with token usage, tool counts, and cost calculations
2. `src/app/api/sessions/route.ts` — single API route serving four views via `?view=` query param: `overview`, `daily`, `projects`, `sessions` (with pagination via `limit`/`offset` and optional `project` filter). Results cached in-memory for 30s
3. `src/components/dashboard.tsx` — client-side orchestrator that fetches all four views in parallel on mount, manages tab state (overview/sessions)

### Key Modules

- `src/lib/claude-data.ts` — JSONL parser, cost calculator (multi-model pricing table), and aggregation functions (`computeOverview`, `computeDailyStats`, `computeProjectStats`)
- `src/lib/format.ts` — display formatters for cost, tokens, duration, dates (shared between components)
- `src/components/` — all `"use client"` components: `stats-cards`, `cost-chart`, `token-chart`, `project-table`, `session-list`, `tools-chart`

### Pricing Model

Multi-model pricing defined in `PRICING` map in `claude-data.ts`. Cost is calculated per-session using the primary model's rates. To add a new model, add an entry to the `PRICING` record.

### JSONL Record Types

Sessions are parsed from `~/.claude/projects/<encoded-cwd>/<session-id>.jsonl`. Key record types: `user` (prompts), `assistant` (model responses with `message.usage` tokens and `message.content[]` tool_use blocks), `system` (metadata).

## Agent Teams / Parallel Work

When implementing features via parallel agent teams, always verify environment variables (.env.local) are copied to worktrees before running builds or tests.

After any parallel agent team implementation, run a full integration pass checking for: white-on-white text, broken links, incorrect API response destructuring, and missing test files before marking complete.

## Debugging

When diagnosing build or production errors, check environment variables and database schema (missing columns/migrations) before refactoring code. Prefer minimal fixes over large refactors.

## TASK MANAGEMENT

1. Plan → tasks/todo.md
2. Verify → confirm before implementing
3. Track → mark complete as you go
4. Explain → high-level summary each step
5. Learn → tasks/lessons.md after corrections

## LEARNED

(Claude fills this in over time)