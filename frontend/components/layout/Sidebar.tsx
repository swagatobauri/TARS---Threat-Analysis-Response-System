"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  Home, 
  ShieldAlert, 
  Activity, 
  Globe, 
  List, 
  PlayCircle, 
  HeartPulse 
} from "lucide-react";

const navItems = [
  { name: "Dashboard", href: "/dashboard", icon: Home },
  { name: "Threat Feed", href: "/dashboard/threats", icon: ShieldAlert },
  { name: "IP Intelligence", href: "/dashboard/ip-intelligence", icon: Globe },
  { name: "Action Logs", href: "/dashboard/action-logs", icon: List },
  { name: "Attack Replay", href: "/dashboard/replay", icon: PlayCircle },
  { name: "War Games", href: "/dashboard/simulation", icon: Crosshair },
  { name: "System Health", href: "/dashboard/health", icon: HeartPulse },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 h-full border-r border-[#1a1a1a] bg-[#0a0a0a] flex flex-col">
      <div className="h-16 flex items-center px-6 border-b border-[#1a1a1a]">
        <span className="font-mono text-lg tracking-wider font-semibold glow-text text-white">
          TARS_OS
        </span>
      </div>

      <nav className="flex-1 py-6 px-3 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 text-sm font-medium transition-colors ${
                isActive 
                  ? "bg-[#111111] text-white border-l-2 border-white" 
                  : "text-[#888888] border-l-2 border-transparent"
              }`}
            >
              <Icon size={16} className={isActive ? "text-white" : "text-[#888888]"} />
              {item.name}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-[#1a1a1a]">
        <div className="flex items-center gap-2 text-xs font-mono text-[#888888]">
          <div className="w-2 h-2 rounded-full bg-safe animate-pulse"></div>
          AGENT: ONLINE
        </div>
      </div>
    </aside>
  );
}
