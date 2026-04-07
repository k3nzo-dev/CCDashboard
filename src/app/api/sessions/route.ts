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
