"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { formatTokens } from "@/lib/format";

interface DailyStat {
  date: string;
  tokens: { input: number; output: number; cacheRead: number; cacheWrite: number };
}

export function TokenChart({ daily }: { daily: DailyStat[] }) {
  const data = daily.map((d) => ({
    date: d.date.slice(5),
    input: d.tokens.input,
    output: d.tokens.output,
    cacheRead: d.tokens.cacheRead,
  }));

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
      <h3 className="text-sm font-medium text-zinc-400 mb-4">
        Daily Tokens
      </h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
            <XAxis
              dataKey="date"
              tick={{ fill: "#71717a", fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: "#27272a" }}
            />
            <YAxis
              tick={{ fill: "#71717a", fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => formatTokens(v)}
            />
            <Tooltip
              contentStyle={{
                background: "#18181b",
                border: "1px solid #27272a",
                borderRadius: "8px",
                fontSize: "13px",
              }}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              formatter={(value: any, name: any) => [formatTokens(Number(value)), String(name)]}
            />
            <Area
              type="monotone"
              dataKey="cacheRead"
              stackId="1"
              stroke="#34d399"
              fill="#34d39933"
              name="Cache Read"
            />
            <Area
              type="monotone"
              dataKey="input"
              stackId="1"
              stroke="#60a5fa"
              fill="#60a5fa33"
              name="Input"
            />
            <Area
              type="monotone"
              dataKey="output"
              stackId="1"
              stroke="#f472b6"
              fill="#f472b633"
              name="Output"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
