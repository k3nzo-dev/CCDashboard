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

// ── Memory types ──
export interface MemoryFileFrontmatter {
  name: string;
  description: string;
  type: "user" | "feedback" | "project" | "reference";
}

export interface MemoryFile {
  filename: string;
  frontmatter: MemoryFileFrontmatter | null;
  content: string;
}

export interface MemoryIndexEntry {
  title: string;
  file: string;
  description: string;
}

export interface ProjectMemoryData {
  memoryIndex: MemoryIndexEntry[];
  memoryFiles: MemoryFile[];
  claudeMd: string | null;
  claudeMdPath: string | null;
}

export interface ActiveProjectInfo {
  activeProject: string | null;
  encodedName: string | null;
  lastActivity: string | null;
}

export interface ProjectPickerItem {
  name: string;
  encodedName: string;
  lastActive: string;
  sessions: number;
}
