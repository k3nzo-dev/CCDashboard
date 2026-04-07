"use client";

import { formatCost } from "@/lib/format";
import { PLAN_PRICE } from "@/lib/types";

interface Props {
  apiCost: number;
}

export function CostComparison({ apiCost }: Props) {
  const savings = apiCost - PLAN_PRICE;
  const multiplier = apiCost > 0 ? (apiCost / PLAN_PRICE).toFixed(1) : "0";
  const utilizationPct = apiCost > 0 ? Math.min((PLAN_PRICE / apiCost) * 100, 100) : 100;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
      <h3 className="text-sm font-medium text-zinc-400 mb-4">Cost: Plan vs API</h3>
      <div className="flex items-center gap-6 mb-4">
        <div>
          <p className="text-zinc-600 text-xs">Your Plan</p>
          <p className="text-violet-400 text-xl font-bold">{formatCost(PLAN_PRICE)}</p>
        </div>
        <span className="text-zinc-600 text-lg">vs</span>
        <div>
          <p className="text-zinc-600 text-xs">API Equivalent</p>
          <p className="text-red-400 text-xl font-bold">{formatCost(apiCost)}</p>
        </div>
        <div className="ml-auto bg-emerald-400/10 border border-emerald-400/20 rounded-lg px-3 py-2 text-center">
          <p className="text-emerald-400 text-lg font-bold">{multiplier}x</p>
          <p className="text-emerald-400 text-[10px]">value</p>
        </div>
      </div>
      <div className="bg-zinc-800 rounded-full h-2 overflow-hidden">
        <div
          className="bg-gradient-to-r from-violet-500 to-emerald-400 h-full rounded-full transition-all"
          style={{ width: `${utilizationPct}%` }}
        />
      </div>
      <p className="text-zinc-600 text-xs mt-2">
        {savings > 0
          ? `Saving ${formatCost(savings)} vs API pricing this period`
          : "Your API-equivalent usage is below plan price"}
      </p>
    </div>
  );
}
