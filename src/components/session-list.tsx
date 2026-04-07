// src/components/session-list.tsx
"use client";

import { useState } from "react";
import { formatCost, formatTokens, formatDuration, formatDateTime } from "@/lib/format";
import type { SessionSummary } from "@/lib/types";

export function SessionList({
  sessions,
  total,
}: {
  sessions: SessionSummary[];
  total: number;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div className="space-y-2">
      <p className="text-zinc-600 text-xs mb-3">
        {sessions.length} of {total} sessions · Sorted by newest
      </p>
      {sessions.map((s) => {
        const isOpen = expanded === s.id;
        const totalTokens =
          s.tokens.input + s.tokens.output + s.tokens.cacheRead + s.tokens.cacheWrite;
        const modelName = s.models[0]?.replace("claude-", "").split("-2")[0] || "unknown";
        const modelColor = modelName.includes("opus")
          ? "bg-violet-900/40 text-violet-300"
          : modelName.includes("haiku")
            ? "bg-amber-900/40 text-amber-300"
            : "bg-sky-900/40 text-sky-300";

        return (
          <div
            key={s.id}
            className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden"
          >
            <button
              onClick={() => setExpanded(isOpen ? null : s.id)}
              className="w-full text-left px-5 py-4 hover:bg-zinc-800/30 transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm">{s.project}</span>
                    {s.gitBranch && (
                      <span className="text-xs bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded">
                        {s.gitBranch}
                      </span>
                    )}
                    <span className={`text-xs px-2 py-0.5 rounded ${modelColor}`}>
                      {modelName}
                    </span>
                  </div>
                  <p className="text-sm text-zinc-500 truncate">
                    {s.firstPrompt || "No prompt recorded"}
                  </p>
                </div>
                <div className="flex items-center gap-5 text-sm text-zinc-500 shrink-0">
                  <span>{formatDateTime(s.firstTimestamp)}</span>
                  <span>{formatDuration(s.durationMs)}</span>
                  <span>{formatTokens(totalTokens)} tok</span>
                  <span className="font-mono text-emerald-400">{formatCost(s.cost)}</span>
                  <span className={`text-violet-400 transition-transform ${isOpen ? "rotate-180" : ""}`}>▼</span>
                </div>
              </div>
            </button>

            {isOpen && (
              <div className="px-5 pb-4 border-t border-zinc-800 pt-4 bg-zinc-950/50">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div>
                    <p className="text-xs text-zinc-600">Messages</p>
                    <p className="text-sm font-medium">
                      {s.userMessages} user / {s.assistantMessages} assistant
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-zinc-600">Input Tokens</p>
                    <p className="text-sm font-medium">{formatTokens(s.tokens.input)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-zinc-600">Output Tokens</p>
                    <p className="text-sm font-medium">{formatTokens(s.tokens.output)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-zinc-600">Cache Read</p>
                    <p className="text-sm font-medium">{formatTokens(s.tokens.cacheRead)}</p>
                  </div>
                </div>

                {Object.keys(s.tools).length > 0 && (
                  <div>
                    <p className="text-xs text-zinc-600 mb-2">Tools Used</p>
                    <div className="flex flex-wrap gap-1.5">
                      {Object.entries(s.tools)
                        .sort((a, b) => b[1] - a[1])
                        .map(([tool, count]) => (
                          <span
                            key={tool}
                            className="text-xs bg-zinc-800 text-zinc-300 px-2 py-1 rounded"
                          >
                            {tool} <span className="text-zinc-600">x{count}</span>
                          </span>
                        ))}
                    </div>
                  </div>
                )}

                <div className="mt-3">
                  <p className="text-xs text-zinc-600 mb-1">Session ID</p>
                  <p className="text-xs font-mono text-zinc-700">{s.id}</p>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
