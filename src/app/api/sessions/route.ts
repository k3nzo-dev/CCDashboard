import { NextResponse } from "next/server";
import {
  getAllSessions,
  computeOverview,
  computeDailyStats,
  computeProjectStats,
} from "@/lib/claude-data";

// Cache parsed sessions for 30 seconds to avoid re-parsing on every request
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

  const sessions = await getCachedSessions();

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
      let filtered = sessions;
      if (project) {
        filtered = sessions.filter((s) => s.project === project);
      }
      return NextResponse.json({
        total: filtered.length,
        sessions: filtered.slice(offset, offset + limit),
      });
    }
    default:
      return NextResponse.json({ error: "Unknown view" }, { status: 400 });
  }
}
