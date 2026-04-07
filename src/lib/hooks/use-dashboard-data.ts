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
