"use client";

import { useState, useEffect, useCallback } from "react";
import { StatCard } from "@/components/stat-card";
import { MemoryPanel } from "@/components/live/memory-panel";
import { ClaudeMdEditor } from "@/components/live/claude-md-editor";
import { formatCost } from "@/lib/format";
import type { ProjectMemoryData, ProjectStat } from "@/lib/types";

interface Props {
  encodedName: string;
  projectName: string;
  projectPath: string;
  isActive: boolean;
  projectStats: ProjectStat | null;
  onBack: () => void;
}

export function LiveView({ encodedName, projectName, projectPath, isActive, projectStats, onBack }: Props) {
  const [memoryData, setMemoryData] = useState<ProjectMemoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"memory" | "claude-md">("memory");
  const [splitView, setSplitView] = useState(false);

  const loadMemory = useCallback(async () => {
    try {
      const res = await fetch(`/api/memory?project=${encodeURIComponent(encodedName)}`);
      const data = await res.json();
      setMemoryData(data);
    } catch {
      // silently fail, show empty state
    } finally {
      setLoading(false);
    }
  }, [encodedName]);

  useEffect(() => {
    setLoading(true);
    loadMemory();
  }, [loadMemory]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-zinc-700 border-t-violet-500 rounded-full animate-spin" />
          <p className="text-zinc-500 text-sm">Loading project data...</p>
        </div>
      </div>
    );
  }

  const memoryFileCount = memoryData?.memoryFiles.length ?? 0;

  return (
    <div className="space-y-6">
      {/* Project Header */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="text-zinc-500 hover:text-zinc-300 text-sm transition-colors">
          ← All Projects
        </button>
        <div className="flex items-center gap-2.5 ml-2">
          <div
            className={`w-2.5 h-2.5 rounded-full ${
              isActive ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]" : "bg-zinc-600"
            }`}
          />
          <h2 className="text-lg font-semibold">{projectName}</h2>
        </div>
        <span className="text-zinc-600 text-xs font-mono ml-auto">{projectPath}</span>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="Total Sessions"
          value={projectStats ? projectStats.sessions.toLocaleString() : "—"}
          color="text-blue-400"
        />
        <StatCard
          label="Total Cost"
          value={projectStats ? formatCost(projectStats.cost) : "—"}
          color="text-emerald-400"
        />
        <StatCard
          label="Memory Files"
          value={memoryFileCount.toString()}
          color="text-amber-400"
        />
        <StatCard
          label="Primary Model"
          value={projectStats?.primaryModel ?? "—"}
          color="text-purple-400"
        />
      </div>

      {/* Tab Bar */}
      <div className="flex items-center justify-between border-b border-zinc-800 pb-0">
        <div className="flex gap-1">
          <button
            onClick={() => setActiveTab("memory")}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "memory"
                ? "border-violet-500 text-white"
                : "border-transparent text-zinc-500 hover:text-zinc-300"
            }`}
          >
            Memory
          </button>
          <button
            onClick={() => setActiveTab("claude-md")}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "claude-md"
                ? "border-violet-500 text-white"
                : "border-transparent text-zinc-500 hover:text-zinc-300"
            }`}
          >
            CLAUDE.md
          </button>
        </div>
        <button
          onClick={() => setSplitView(!splitView)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
            splitView
              ? "bg-violet-500/20 border-violet-500/30 text-violet-300"
              : "bg-zinc-800/50 border-zinc-700 text-zinc-400 hover:text-zinc-300"
          }`}
        >
          <span className="text-sm">⫿</span> Split View
        </button>
      </div>

      {/* Content Area */}
      {splitView ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div>
            <p className="text-zinc-600 text-[10px] uppercase tracking-wider mb-3">Memory</p>
            <MemoryPanel
              memoryIndex={memoryData?.memoryIndex ?? []}
              memoryFiles={memoryData?.memoryFiles ?? []}
            />
          </div>
          <div>
            <p className="text-zinc-600 text-[10px] uppercase tracking-wider mb-3">CLAUDE.md</p>
            <ClaudeMdEditor
              content={memoryData?.claudeMd ?? null}
              project={encodedName}
              onSaveSuccess={loadMemory}
            />
          </div>
        </div>
      ) : (
        <div>
          {activeTab === "memory" && (
            <MemoryPanel
              memoryIndex={memoryData?.memoryIndex ?? []}
              memoryFiles={memoryData?.memoryFiles ?? []}
            />
          )}
          {activeTab === "claude-md" && (
            <ClaudeMdEditor
              content={memoryData?.claudeMd ?? null}
              project={encodedName}
              onSaveSuccess={loadMemory}
            />
          )}
        </div>
      )}
    </div>
  );
}
