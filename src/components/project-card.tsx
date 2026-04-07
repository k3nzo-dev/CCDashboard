// src/components/project-card.tsx
"use client";

import { formatCost, formatTokens, formatDuration } from "@/lib/format";
import type { ProjectStat } from "@/lib/types";

interface Props {
  project: ProjectStat;
  expanded: boolean;
  onToggle: () => void;
}

export function ProjectCard({ project, expanded, onToggle }: Props) {
  const totalTokens =
    project.tokens.input +
    project.tokens.output +
    project.tokens.cacheRead +
    project.tokens.cacheWrite;

  const lastActiveLabel = formatRelativeDate(project.lastActive);

  if (!expanded) {
    return (
      <button
        onClick={onToggle}
        className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-left hover:bg-zinc-800/50 transition-colors w-full"
      >
        <div className="flex justify-between items-start mb-3">
          <p className="text-white text-sm font-medium">{project.project}</p>
          <p className="text-emerald-400 text-base font-bold font-mono">
            {formatCost(project.cost)}
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <p className="text-zinc-600 text-[9px] uppercase">Sessions</p>
            <p className="text-zinc-300 text-sm font-medium">{project.sessions}</p>
          </div>
          <div>
            <p className="text-zinc-600 text-[9px] uppercase">Tokens</p>
            <p className="text-blue-400 text-sm font-medium">{formatTokens(totalTokens)}</p>
          </div>
          <div>
            <p className="text-zinc-600 text-[9px] uppercase">Last Active</p>
            <p className="text-zinc-300 text-sm font-medium">{lastActiveLabel}</p>
          </div>
        </div>
        {project.branches.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-3">
            {project.branches.slice(0, 3).map((b) => (
              <span
                key={b.branch}
                className="text-[10px] bg-zinc-800 text-zinc-500 px-2 py-0.5 rounded"
              >
                {b.branch}
              </span>
            ))}
            {project.branches.length > 3 && (
              <span className="text-[10px] bg-zinc-800 text-zinc-500 px-2 py-0.5 rounded">
                +{project.branches.length - 3}
              </span>
            )}
          </div>
        )}
      </button>
    );
  }

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 col-span-2">
      <div className="flex justify-between items-start mb-1">
        <div>
          <button onClick={onToggle} className="text-white text-base font-semibold hover:text-zinc-300 transition-colors">
            {project.project} ←
          </button>
          <p className="text-zinc-600 text-xs mt-1">{project.projectPath}</p>
        </div>
        <div className="text-right">
          <p className="text-emerald-400 text-xl font-bold font-mono">
            {formatCost(project.cost)}
          </p>
          <p className="text-zinc-600 text-xs">API-equivalent cost</p>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-3 mt-4 mb-5">
        <div className="bg-zinc-800 rounded-lg p-3">
          <p className="text-zinc-600 text-[9px] uppercase">Sessions</p>
          <p className="text-white text-base font-semibold">{project.sessions}</p>
        </div>
        <div className="bg-zinc-800 rounded-lg p-3">
          <p className="text-zinc-600 text-[9px] uppercase">Tokens</p>
          <p className="text-blue-400 text-base font-semibold">{formatTokens(totalTokens)}</p>
        </div>
        <div className="bg-zinc-800 rounded-lg p-3">
          <p className="text-zinc-600 text-[9px] uppercase">Total Time</p>
          <p className="text-purple-400 text-base font-semibold">
            {formatDuration(project.totalDurationMs)}
          </p>
        </div>
        <div className="bg-zinc-800 rounded-lg p-3">
          <p className="text-zinc-600 text-[9px] uppercase">Primary Model</p>
          <p className="text-violet-400 text-base font-semibold capitalize">
            {project.primaryModel}
          </p>
        </div>
        <div className="bg-zinc-800 rounded-lg p-3">
          <p className="text-zinc-600 text-[9px] uppercase">Last Active</p>
          <p className="text-white text-base font-semibold">{lastActiveLabel}</p>
        </div>
      </div>

      {project.branches.length > 0 && (
        <div>
          <p className="text-zinc-600 text-[10px] uppercase tracking-wider mb-2">Branches</p>
          <div className="space-y-1">
            {project.branches.map((b) => (
              <div
                key={b.branch}
                className="flex items-center justify-between bg-zinc-800/50 rounded-lg px-3 py-2"
              >
                <div className="flex items-center gap-3">
                  <span className="text-zinc-300 text-xs font-mono">{b.branch}</span>
                  <span className="text-zinc-600 text-[10px]">{b.sessions} sessions</span>
                </div>
                <div className="flex gap-4 text-zinc-500 text-xs">
                  <span>
                    {formatTokens(
                      b.tokens.input + b.tokens.output + b.tokens.cacheRead + b.tokens.cacheWrite,
                    )}{" "}
                    tok
                  </span>
                  <span className="text-emerald-400 font-mono">{formatCost(b.cost)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function formatRelativeDate(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}
