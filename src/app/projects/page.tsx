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
