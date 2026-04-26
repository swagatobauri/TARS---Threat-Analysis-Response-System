"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { 
  Home, 
  ShieldAlert, 
  Globe, 
  List, 
  PlayCircle, 
  HeartPulse,
  Crosshair,
  ArrowLeft,
  Link2,
  CheckSquare,
  BarChart,
  ShieldCheck,
  TerminalSquare
} from "lucide-react";

export default function Sidebar() {
  const pathname = usePathname();
  const [pendingApprovals, setPendingApprovals] = useState(0);

  useEffect(() => {
    const fetchApprovals = async () => {
      try {
        const API_URL = process.env.NEXT_PUBLIC_API_URL || (typeof window !== "undefined" && window.location.hostname.includes("onrender.com") ? window.location.origin.replace(/\/$/, "").replace("frontend", "backend") : "http://localhost:8000");
        const res = await fetch(`${API_URL}/api/v1/safety/approvals?status=PENDING`);
        if (res.ok) {
          const data = await res.json();
          setPendingApprovals(data.length);
        }
      } catch (err) {
        console.error("Failed to fetch approvals", err);
      }
    };
    
    fetchApprovals();
    const interval = setInterval(fetchApprovals, 5000);
    return () => clearInterval(interval);
  }, []);

  const navItems = [
    { name: "Overview", href: "/mission-control", icon: Home },
    { name: "Live Threat Feed", href: "/mission-control/threats", icon: ShieldAlert },
    { name: "Kill Chain Tracker", href: "/mission-control/kill-chain", icon: Link2 },
    { name: "IP Intelligence", href: "/mission-control/ip-intelligence", icon: Globe },
    { 
      name: "Approval Queue", 
      href: "/mission-control/approvals", 
      icon: CheckSquare,
      badge: pendingApprovals > 0 ? pendingApprovals : null
    },
    { name: "Action Logs", href: "/mission-control/action-logs", icon: List },
    { name: "War Games", href: "/war-games", icon: Crosshair },
    { name: "Metrics & Proof", href: "/mission-control/metrics", icon: BarChart },
    { name: "Safety Controls", href: "/mission-control/safety", icon: ShieldCheck },
    { name: "System Health", href: "/mission-control/health", icon: HeartPulse },
  ];

  return (
    <aside className="w-56 h-full border-r border-[#1a1a1a] bg-[#050505] flex flex-col flex-shrink-0">
      <div className="h-14 flex items-center px-5 border-b border-[#1a1a1a]">
        <Link href="/" className="flex items-center gap-2 group">
          <ArrowLeft size={12} className="text-[#444] group-hover:text-[#cc0000] transition-colors" />
          <span className="font-mono text-sm tracking-[0.2em] font-bold text-[#cc0000]">
            TARS — MISSION CONTROL
          </span>
        </Link>
      </div>

      <nav className="flex-1 py-4 px-2 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center justify-between px-3 py-2 text-xs font-mono tracking-widest uppercase transition-colors ${
                isActive 
                  ? "bg-[#111] text-white border-l-2 border-[#cc0000]" 
                  : item.name === "War Games"
                    ? "text-[#cc0000] border-l-2 border-transparent hover:text-[#ff0000]"
                    : "text-[#666] border-l-2 border-transparent hover:text-[#aaa]"
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon size={14} className={isActive || item.name === "War Games" ? "text-[#cc0000]" : "text-[#555]"} />
                {item.name}
                {item.name === "War Games" && (
                  <div className="w-1.5 h-1.5 rounded-full bg-[#cc0000] animate-pulse ml-auto" />
                )}
              </div>
              {item.badge !== null && item.badge !== undefined && (
                <span className="bg-[#cc0000] text-black text-[10px] font-bold px-1.5 py-0.5 rounded-sm">
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="px-2 pb-2">
        <Link 
          href="/mission-control/sdk"
          className={`flex items-center gap-3 px-3 py-2 rounded-md text-xs font-mono tracking-widest uppercase transition-colors ${
            pathname === "/mission-control/sdk"
              ? "bg-white text-black font-bold shadow-sm" 
              : "text-[#888] hover:text-white hover:bg-[#111]"
          }`}
        >
          <TerminalSquare size={14} className={pathname === "/mission-control/sdk" ? "text-black" : "text-[#555]"} />
          SDK Integration
        </Link>
      </div>

      <div className="p-3 border-t border-[#1a1a1a]">
        <div className="flex items-center gap-2 text-[10px] font-mono text-[#666]">
          <div className="w-1.5 h-1.5 rounded-full bg-[#00ff88] animate-pulse"></div>
          AGENT ONLINE
        </div>
      </div>
    </aside>
  );
}
