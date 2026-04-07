"use client";

import { formatDateTime } from "@/lib/format";
import type { ProjectPickerItem } from "@/lib/types";

interface Props {
  projects: ProjectPickerItem[];
  onSelect: (project: ProjectPickerItem) => void;
}

export function ProjectPicker({ projects, onSelect }: Props) {
  if (projects.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-zinc-600 text-sm">No Claude Code projects found</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Select a Project</h2>
        <p className="text-zinc-500 text-sm mt-1">No active session detected. Choose a project to view.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {projects.map((project) => (
          <button
            key={project.encodedName}
            onClick={() => onSelect(project)}
            className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-left hover:border-zinc-600 transition-colors group"
          >
            <p className="text-sm font-medium text-zinc-200 group-hover:text-white transition-colors">
              {project.name}
            </p>
            <div className="flex items-center gap-3 mt-2">
              <span className="text-zinc-600 text-xs">
                {project.sessions} {project.sessions === 1 ? "session" : "sessions"}
              </span>
              {project.lastActive && (
                <span className="text-zinc-600 text-xs">
                  Last: {formatDateTime(project.lastActive)}
                </span>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
