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
