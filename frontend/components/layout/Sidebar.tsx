"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  Home, 
  ShieldAlert, 
  Globe, 
  List, 
  PlayCircle, 
  HeartPulse,
  Crosshair,
  ArrowLeft
} from "lucide-react";

const navItems = [
  { name: "Dashboard", href: "/dashboard", icon: Home },
  { name: "Threat Feed", href: "/dashboard/threats", icon: ShieldAlert },
  { name: "IP Intelligence", href: "/dashboard/ip-intelligence", icon: Globe },
  { name: "Action Logs", href: "/dashboard/action-logs", icon: List },
  { name: "Attack Replay", href: "/dashboard/replay", icon: PlayCircle },
  { name: "System Health", href: "/dashboard/health", icon: HeartPulse },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-56 h-full border-r border-[#1a1a1a] bg-[#050505] flex flex-col flex-shrink-0">
      <div className="h-14 flex items-center px-5 border-b border-[#1a1a1a]">
        <Link href="/" className="flex items-center gap-2 group">
          <ArrowLeft size={12} className="text-[#444] group-hover:text-[#cc0000] transition-colors" />
          <span className="font-mono text-sm tracking-[0.2em] font-bold text-[#cc0000]">
            TARS
          </span>
        </Link>
      </div>

      <nav className="flex-1 py-4 px-2 space-y-0.5">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 text-xs font-mono tracking-widest uppercase transition-colors ${
                isActive 
                  ? "bg-[#111] text-white border-l-2 border-[#cc0000]" 
                  : "text-[#666] border-l-2 border-transparent hover:text-[#aaa]"
              }`}
            >
              <Icon size={14} className={isActive ? "text-[#cc0000]" : "text-[#555]"} />
              {item.name}
            </Link>
          );
        })}
      </nav>

      {/* War Games — highlighted super feature */}
      <div className="px-2 pb-3">
        <Link
          href="/war-games"
          className="flex items-center justify-center gap-2 py-3 bg-[#cc0000] text-black font-mono text-[10px] font-bold tracking-widest uppercase hover:bg-[#ff0000] transition-colors"
        >
          <Crosshair size={14} />
          WAR GAMES
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
