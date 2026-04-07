"use client";

import { useState } from "react";
import type { DateRange } from "@/lib/types";
import { subDays, format } from "date-fns";

type Preset = DateRange["preset"];

const PRESETS: { label: string; value: Preset }[] = [
  { label: "7d", value: "7d" },
  { label: "30d", value: "30d" },
  { label: "90d", value: "90d" },
  { label: "All", value: "all" },
  { label: "Custom", value: "custom" },
];

function presetToRange(preset: Preset): { from: string | null; to: string | null } {
  if (preset === "all") return { from: null, to: null };
  const days = preset === "7d" ? 7 : preset === "30d" ? 30 : 90;
  const from = format(subDays(new Date(), days), "yyyy-MM-dd");
  return { from, to: null };
}

export function DateRangeFilter({
  value,
  onChange,
}: {
  value: DateRange;
  onChange: (range: DateRange) => void;
}) {
  const [showCustom, setShowCustom] = useState(false);
  const [customFrom, setCustomFrom] = useState(value.from || "");
  const [customTo, setCustomTo] = useState(value.to || "");

  function handlePreset(preset: Preset) {
    if (preset === "custom") {
      setShowCustom(true);
      return;
    }
    setShowCustom(false);
    const { from, to } = presetToRange(preset);
    onChange({ from, to, preset });
  }

  function applyCustom() {
    onChange({ from: customFrom || null, to: customTo || null, preset: "custom" });
  }

  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-0.5 bg-zinc-900 border border-zinc-800 rounded-lg p-0.5">
        {PRESETS.map((p) => (
          <button
            key={p.value}
            onClick={() => handlePreset(p.value)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              value.preset === p.value
                ? "bg-zinc-700 text-white"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
      {showCustom && (
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={customFrom}
            onChange={(e) => setCustomFrom(e.target.value)}
            className="bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-1.5 text-xs text-zinc-300 focus:outline-none focus:ring-1 focus:ring-zinc-600"
          />
          <span className="text-zinc-600 text-xs">to</span>
          <input
            type="date"
            value={customTo}
            onChange={(e) => setCustomTo(e.target.value)}
            className="bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-1.5 text-xs text-zinc-300 focus:outline-none focus:ring-1 focus:ring-zinc-600"
          />
          <button
            onClick={applyCustom}
            className="bg-violet-600 hover:bg-violet-500 text-white text-xs px-3 py-1.5 rounded-lg transition-colors"
          >
            Apply
          </button>
        </div>
      )}
    </div>
  );
}
