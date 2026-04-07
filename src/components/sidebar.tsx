"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PLAN_PRICE } from "@/lib/types";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: "📊" },
  { href: "/sessions", label: "Sessions", icon: "💬" },
  { href: "/projects", label: "Projects", icon: "📁" },
];

export function Sidebar({ refreshStatus }: { refreshStatus: "live" | "paused" }) {
  const pathname = usePathname();

  return (
    <aside className="w-56 bg-zinc-950 border-r border-zinc-800 flex flex-col h-screen sticky top-0 shrink-0">
      <div className="px-5 pt-5 pb-2">
        <h1 className="text-violet-400 font-bold text-base tracking-tight">CC Analytics</h1>
        <p className="text-zinc-600 text-xs">Claude Code Dashboard</p>
      </div>

      <nav className="flex-1 px-3 mt-4 space-y-0.5">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                isActive
                  ? "bg-zinc-800 text-white"
                  : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50"
              }`}
            >
              <span className={isActive ? "opacity-80" : "opacity-50"}>{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="px-5 pb-5 space-y-4 border-t border-zinc-800 pt-4">
        <div>
          <p className="text-zinc-600 text-[10px] uppercase tracking-wider mb-1">Auto-refresh</p>
          <div className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full ${refreshStatus === "live" ? "bg-emerald-400" : "bg-zinc-600"}`} />
            <span className={`text-xs ${refreshStatus === "live" ? "text-emerald-400" : "text-zinc-600"}`}>
              {refreshStatus === "live" ? "Live · 30s" : "Paused"}
            </span>
          </div>
        </div>
        <div>
          <p className="text-zinc-600 text-[10px] uppercase tracking-wider mb-1">Plan</p>
          <p className="text-violet-400 text-sm font-medium">Max 5x</p>
          <p className="text-zinc-600 text-xs">${PLAN_PRICE}/mo</p>
        </div>
      </div>
    </aside>
  );
}
