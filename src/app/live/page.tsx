"use client";

import { useState, useEffect, useCallback } from "react";
import { LiveView } from "@/components/live/live-view";
import { ProjectPicker } from "@/components/live/project-picker";
import type { ActiveProjectInfo, ProjectPickerItem, ProjectStat } from "@/lib/types";

export default function LivePage() {
  const [activeProject, setActiveProject] = useState<ActiveProjectInfo | null>(null);
  const [allProjects, setAllProjects] = useState<ProjectPickerItem[]>([]);
  const [projectStats, setProjectStats] = useState<ProjectStat[]>([]);
  const [selectedProject, setSelectedProject] = useState<{ name: string; encodedName: string; path: string } | null>(null);
  const [loading, setLoading] = useState(true);

  const loadInitialData = useCallback(async () => {
    try {
      const [activeRes, projectsRes, statsRes] = await Promise.all([
        fetch("/api/memory/active-project").then((r) => r.json()),
        fetch("/api/memory").then((r) => r.json()),
        fetch("/api/sessions?view=projects").then((r) => r.json()),
      ]);

      setActiveProject(activeRes as ActiveProjectInfo);
      setAllProjects((projectsRes as { projects: ProjectPickerItem[] }).projects);
      setProjectStats(statsRes as ProjectStat[]);

      // Auto-select active project
      const active = activeRes as ActiveProjectInfo;
      if (active.activeProject && active.encodedName) {
        const decoded = active.encodedName.replace(/^-/, "/").replace(/-/g, "/");
        setSelectedProject({
          name: active.activeProject,
          encodedName: active.encodedName,
          path: decoded,
        });
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Poll for active project changes every 30s
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch("/api/memory/active-project");
        const data = (await res.json()) as ActiveProjectInfo;
        setActiveProject(data);
      } catch {
        // silently fail
      }
    }, 30_000);
    return () => clearInterval(interval);
  }, []);

  const handleSelectProject = useCallback((project: ProjectPickerItem) => {
    const decoded = project.encodedName.replace(/^-/, "/").replace(/-/g, "/");
    setSelectedProject({
      name: project.name,
      encodedName: project.encodedName,
      path: decoded,
    });
  }, []);

  const handleBack = useCallback(() => {
    setSelectedProject(null);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-zinc-700 border-t-violet-500 rounded-full animate-spin" />
          <p className="text-zinc-500 text-sm">Detecting active project...</p>
        </div>
      </div>
    );
  }

  if (!selectedProject) {
    return (
      <div className="p-6">
        <ProjectPicker projects={allProjects} onSelect={handleSelectProject} />
      </div>
    );
  }

  const isMatchingActive = activeProject?.encodedName === selectedProject.encodedName;
  const isRecentlyActive = isMatchingActive && activeProject?.lastActivity
    ? Date.now() - new Date(activeProject.lastActivity).getTime() < 10 * 60 * 1000
    : false;
  const stats = projectStats.find((p) => p.projectPath === selectedProject.path) ?? null;

  return (
    <div className="p-6">
      <LiveView
        encodedName={selectedProject.encodedName}
        projectName={selectedProject.name}
        projectPath={selectedProject.path}
        isActive={isRecentlyActive}
        projectStats={stats}
        onBack={handleBack}
      />
    </div>
  );
}
