"use client";

import { useState, useEffect, useCallback } from "react";

interface Props {
  content: string | null;
  project: string;
  onSaveSuccess?: () => void;
}

export function ClaudeMdEditor({ content, project, onSaveSuccess }: Props) {
  const [value, setValue] = useState(content ?? "");
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved" | "error">("idle");
  const [dirty, setDirty] = useState(false);

  // Sync when content prop changes (e.g. project switch), but not while dirty
  useEffect(() => {
    if (!dirty) {
      setValue(content ?? "");
    }
  }, [content, dirty]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value);
    setDirty(true);
    setSaveStatus("idle");
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setSaveStatus("idle");
    try {
      const res = await fetch("/api/memory/claude-md", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project, content: value }),
      });
      const data = await res.json();
      if (data.ok) {
        setSaveStatus("saved");
        setDirty(false);
        onSaveSuccess?.();
      } else {
        setSaveStatus("error");
      }
    } catch {
      setSaveStatus("error");
    } finally {
      setSaving(false);
    }
  }, [project, value, onSaveSuccess]);

  const handleReset = useCallback(() => {
    setValue(content ?? "");
    setDirty(false);
    setSaveStatus("idle");
  }, [content]);

  if (content === null) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-zinc-600 text-sm">No CLAUDE.md found for this project</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <button
          onClick={handleSave}
          disabled={saving || !dirty}
          className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {saving ? "Saving..." : "Save"}
        </button>
        <button
          onClick={handleReset}
          disabled={!dirty}
          className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors text-zinc-400 border border-zinc-700 hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Reset
        </button>
        {saveStatus === "saved" && (
          <span className="text-emerald-400 text-xs">Saved</span>
        )}
        {saveStatus === "error" && (
          <span className="text-red-400 text-xs">Save failed</span>
        )}
        {dirty && saveStatus === "idle" && (
          <span className="text-amber-400 text-xs">Unsaved changes</span>
        )}
      </div>
      <textarea
        value={value}
        onChange={handleChange}
        spellCheck={false}
        className="w-full min-h-[400px] bg-zinc-900/50 border border-zinc-800 rounded-lg p-4 font-mono text-xs text-zinc-300 leading-relaxed resize-y focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/25"
      />
    </div>
  );
}
