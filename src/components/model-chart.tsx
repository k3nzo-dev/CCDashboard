"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { formatTokens } from "@/lib/format";

interface Props {
  models: { model: string; count: number; tokens: number }[];
}

const MODEL_COLORS: Record<string, string> = {
  opus: "#a78bfa",
  sonnet: "#38bdf8",
  haiku: "#fbbf24",
};

function getColor(model: string): string {
  const lower = model.toLowerCase();
  for (const [key, color] of Object.entries(MODEL_COLORS)) {
    if (lower.includes(key)) return color;
  }
  return "#71717a";
}

function shortName(model: string): string {
  return model
    .replace("claude-", "")
    .replace(/-\d{8}$/, "")
    .split("-")
    .slice(0, 2)
    .join("-");
}

export function ModelChart({ models }: Props) {
  const totalTokens = models.reduce((sum, m) => sum + m.tokens, 0);

  const data = models.map((m) => ({
    name: shortName(m.model),
    value: m.tokens,
    pct: totalTokens > 0 ? Math.round((m.tokens / totalTokens) * 100) : 0,
    color: getColor(m.model),
  }));

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
      <h3 className="text-sm font-medium text-zinc-400 mb-4">Model Usage</h3>
      <div className="flex items-center gap-6">
        <div className="w-28 h-28">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={30}
                outerRadius={50}
                dataKey="value"
                stroke="none"
              >
                {data.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: "#18181b",
                  border: "1px solid #27272a",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
                formatter={(value: number) => [formatTokens(value), "Tokens"]}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex-1 space-y-2">
          {data.map((d) => (
            <div key={d.name} className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <span style={{ color: d.color }}>●</span>
                <span className="text-zinc-300 capitalize">{d.name}</span>
              </div>
              <span className="text-zinc-500">{d.pct}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
