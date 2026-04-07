import fs from "fs";
import path from "path";
import os from "os";
import readline from "readline";

// ── Pricing (per 1M tokens) ──
// Claude Sonnet 4 pricing as default
const PRICING: Record<string, { input: number; output: number; cacheRead: number; cacheWrite: number }> = {
  "claude-sonnet-4-6": { input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3.75 },
  "claude-sonnet-4-20250514": { input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3.75 },
  "claude-opus-4-6": { input: 15, output: 75, cacheRead: 1.5, cacheWrite: 18.75 },
  "claude-opus-4-20250514": { input: 15, output: 75, cacheRead: 1.5, cacheWrite: 18.75 },
  "claude-3-5-sonnet-20241022": { input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3.75 },
  "claude-3-7-sonnet-20250219": { input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3.75 },
  default: { input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3.75 },
};

function getPricing(model: string) {
  return PRICING[model] || PRICING.default;
}

function costForUsage(model: string, usage: TokenUsage): number {
  const p = getPricing(model);
  return (
    (usage.input * p.input +
      usage.output * p.output +
      usage.cacheRead * p.cacheRead +
      usage.cacheWrite * p.cacheWrite) /
    1_000_000
  );
}

// ── Types ──
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
  date: string; // YYYY-MM-DD
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
}

export interface OverviewStats {
  totalSessions: number;
  totalCost: number;
  totalTokens: TokenUsage;
  totalMessages: number;
  avgSessionDuration: number;
  avgCostPerSession: number;
  topModels: { model: string; count: number }[];
  topTools: { tool: string; count: number }[];
}

// ── Core parsing ──
const CLAUDE_DIR = path.join(os.homedir(), ".claude");
const PROJECTS_DIR = path.join(CLAUDE_DIR, "projects");

function getProjectName(dirName: string): { name: string; fullPath: string } {
  // Decode: -Users-lboschi-Desktop-ListingKit → /Users/lboschi/Desktop/ListingKit
  const fullPath = dirName.replace(/^-/, "/").replace(/-/g, "/");
  const parts = fullPath.split("/").filter(Boolean);
  const name = parts[parts.length - 1] || dirName;
  return { name, fullPath };
}

async function parseSessionFile(filePath: string, project: string, projectPath: string): Promise<SessionSummary | null> {
  const sessionId = path.basename(filePath, ".jsonl");

  let firstTimestamp = "";
  let lastTimestamp = "";
  let userMessages = 0;
  let assistantMessages = 0;
  let messageCount = 0;
  const tokens: TokenUsage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
  const models = new Set<string>();
  const tools: Record<string, number> = {};
  let firstPrompt = "";
  let gitBranch = "";

  const fileStream = fs.createReadStream(filePath);
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  for await (const line of rl) {
    if (!line.trim()) continue;
    try {
      const obj = JSON.parse(line);
      const ts = obj.timestamp;
      if (ts) {
        if (!firstTimestamp) firstTimestamp = ts;
        lastTimestamp = ts;
      }
      if (!gitBranch && obj.gitBranch) gitBranch = obj.gitBranch;

      if (obj.type === "user") {
        userMessages++;
        messageCount++;
        if (!firstPrompt) {
          const msg = obj.message;
          if (msg) {
            const content = msg.content;
            if (typeof content === "string") {
              firstPrompt = content.slice(0, 200);
            } else if (Array.isArray(content)) {
              for (const c of content) {
                if (c?.type === "text" && c.text) {
                  firstPrompt = c.text.slice(0, 200);
                  break;
                }
              }
            }
          }
        }
      } else if (obj.type === "assistant") {
        assistantMessages++;
        messageCount++;
        const msg = obj.message || {};
        const model = msg.model || "";
        if (model && model !== "<synthetic>") models.add(model);

        const usage = msg.usage;
        if (usage) {
          tokens.input += usage.input_tokens || 0;
          tokens.output += usage.output_tokens || 0;
          tokens.cacheRead += usage.cache_read_input_tokens || 0;
          tokens.cacheWrite += usage.cache_creation_input_tokens || 0;
        }

        for (const c of msg.content || []) {
          if (c?.type === "tool_use" && c.name) {
            tools[c.name] = (tools[c.name] || 0) + 1;
          }
        }
      }
    } catch {
      // skip malformed lines
    }
  }

  if (!firstTimestamp || messageCount === 0) return null;

  const durationMs =
    new Date(lastTimestamp).getTime() - new Date(firstTimestamp).getTime();
  const modelList = Array.from(models);
  const primaryModel = modelList[0] || "unknown";
  const cost = costForUsage(primaryModel, tokens);

  return {
    id: sessionId,
    project,
    projectPath,
    firstTimestamp,
    lastTimestamp,
    durationMs,
    messageCount,
    userMessages,
    assistantMessages,
    tokens,
    cost,
    models: modelList,
    tools,
    firstPrompt: firstPrompt.trim(),
    gitBranch,
  };
}

// ── Public API ──
export async function getAllSessions(): Promise<SessionSummary[]> {
  if (!fs.existsSync(PROJECTS_DIR)) return [];

  const projectDirs = fs.readdirSync(PROJECTS_DIR).filter((d) => {
    const full = path.join(PROJECTS_DIR, d);
    return fs.statSync(full).isDirectory();
  });

  const allSessions: SessionSummary[] = [];

  for (const dir of projectDirs) {
    const { name: project, fullPath: projectPath } = getProjectName(dir);
    const dirPath = path.join(PROJECTS_DIR, dir);
    const files = fs.readdirSync(dirPath).filter((f) => f.endsWith(".jsonl"));

    const promises = files.map((f) =>
      parseSessionFile(path.join(dirPath, f), project, projectPath)
    );
    const results = await Promise.all(promises);
    for (const s of results) {
      if (s) allSessions.push(s);
    }
  }

  allSessions.sort(
    (a, b) =>
      new Date(b.firstTimestamp).getTime() - new Date(a.firstTimestamp).getTime()
  );
  return allSessions;
}

export function computeOverview(sessions: SessionSummary[]): OverviewStats {
  const totalTokens: TokenUsage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
  let totalCost = 0;
  let totalMessages = 0;
  let totalDuration = 0;
  const modelCounts: Record<string, number> = {};
  const toolCounts: Record<string, number> = {};

  for (const s of sessions) {
    totalTokens.input += s.tokens.input;
    totalTokens.output += s.tokens.output;
    totalTokens.cacheRead += s.tokens.cacheRead;
    totalTokens.cacheWrite += s.tokens.cacheWrite;
    totalCost += s.cost;
    totalMessages += s.messageCount;
    totalDuration += s.durationMs;
    for (const m of s.models) {
      modelCounts[m] = (modelCounts[m] || 0) + 1;
    }
    for (const [tool, count] of Object.entries(s.tools)) {
      toolCounts[tool] = (toolCounts[tool] || 0) + count;
    }
  }

  const topModels = Object.entries(modelCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([model, count]) => ({ model, count }));

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
    topModels,
    topTools,
  };
}

export function computeDailyStats(sessions: SessionSummary[]): DailyStat[] {
  const byDay: Record<string, DailyStat> = {};

  for (const s of sessions) {
    const date = s.firstTimestamp.slice(0, 10);
    if (!byDay[date]) {
      byDay[date] = {
        date,
        sessions: 0,
        tokens: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        cost: 0,
        messageCount: 0,
      };
    }
    const d = byDay[date];
    d.sessions++;
    d.tokens.input += s.tokens.input;
    d.tokens.output += s.tokens.output;
    d.tokens.cacheRead += s.tokens.cacheRead;
    d.tokens.cacheWrite += s.tokens.cacheWrite;
    d.cost += s.cost;
    d.messageCount += s.messageCount;
  }

  return Object.values(byDay).sort((a, b) => a.date.localeCompare(b.date));
}

export function computeProjectStats(sessions: SessionSummary[]): ProjectStat[] {
  const byProject: Record<string, ProjectStat> = {};

  for (const s of sessions) {
    if (!byProject[s.project]) {
      byProject[s.project] = {
        project: s.project,
        projectPath: s.projectPath,
        sessions: 0,
        tokens: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        cost: 0,
        lastActive: s.firstTimestamp,
      };
    }
    const p = byProject[s.project];
    p.sessions++;
    p.tokens.input += s.tokens.input;
    p.tokens.output += s.tokens.output;
    p.tokens.cacheRead += s.tokens.cacheRead;
    p.tokens.cacheWrite += s.tokens.cacheWrite;
    p.cost += s.cost;
    if (s.firstTimestamp > p.lastActive) p.lastActive = s.firstTimestamp;
  }

  return Object.values(byProject).sort((a, b) => b.cost - a.cost);
}
