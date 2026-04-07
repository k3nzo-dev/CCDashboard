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
