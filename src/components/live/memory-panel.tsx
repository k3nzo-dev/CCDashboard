"use client";

import { useState } from "react";
import type { MemoryIndexEntry, MemoryFile } from "@/lib/types";

const TYPE_COLORS: Record<string, string> = {
  user: "bg-indigo-500/20 text-indigo-300",
  project: "bg-emerald-500/20 text-emerald-300",
  feedback: "bg-amber-500/20 text-amber-300",
  reference: "bg-pink-500/20 text-pink-300",
};

function MemoryFileCard({ file }: { file: MemoryFile }) {
  const [expanded, setExpanded] = useState(false);
  const typeColor = file.frontmatter?.type
    ? TYPE_COLORS[file.frontmatter.type] || "bg-zinc-500/20 text-zinc-300"
    : "bg-zinc-500/20 text-zinc-300";

  return (
    <div className="border border-zinc-800 rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-zinc-800/50 transition-colors text-left"
      >
        {file.frontmatter?.type && (
          <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded ${typeColor}`}>
            {file.frontmatter.type}
          </span>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm text-zinc-200 truncate">
            {file.frontmatter?.name || file.filename}
          </p>
          {file.frontmatter?.description && (
            <p className="text-xs text-zinc-500 truncate">{file.frontmatter.description}</p>
          )}
        </div>
        <span className="text-zinc-600 text-sm shrink-0">{expanded ? "▾" : "▸"}</span>
      </button>
      {expanded && (
        <div className="px-4 pb-4 border-t border-zinc-800">
          <pre className="text-xs text-zinc-400 whitespace-pre-wrap mt-3 font-mono leading-relaxed">
            {file.content}
          </pre>
        </div>
      )}
    </div>
  );
}

interface Props {
  memoryIndex: MemoryIndexEntry[];
  memoryFiles: MemoryFile[];
}

export function MemoryPanel({ memoryIndex, memoryFiles }: Props) {
  if (memoryIndex.length === 0 && memoryFiles.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-zinc-600 text-sm">No memories stored for this project</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {memoryIndex.length > 0 && (
        <p className="text-zinc-600 text-[10px] uppercase tracking-wider">
          MEMORY.md Index — {memoryIndex.length} {memoryIndex.length === 1 ? "entry" : "entries"}
        </p>
      )}
      {memoryFiles.map((file) => (
        <MemoryFileCard key={file.filename} file={file} />
      ))}
    </div>
  );
}
