"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";

export default function ShadowBanner() {
  const [isShadowMode, setIsShadowMode] = useState(false);

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const res = await fetch("http://localhost:8000/api/v1/safety/status");
        if (res.ok) {
          const data = await res.json();
          setIsShadowMode(data.shadow_mode);
        }
      } catch (err) {
        console.error("Failed to fetch safety status", err);
      }
    };
    checkStatus();
    
    // Periodically check if shadow mode is toggled elsewhere
    const interval = setInterval(checkStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  if (!isShadowMode) return null;

  return (
    <div className="w-full bg-[#cc6600]/20 border-b border-[#cc6600]/50 text-[#ffaa00] px-4 py-2 flex items-center justify-between z-50 relative">
      <div className="flex items-center gap-3">
        <AlertTriangle size={16} className="animate-pulse" />
        <span className="font-mono text-xs font-bold tracking-widest uppercase">
          SHADOW MODE ACTIVE — TARS IS OBSERVING ONLY. NO ACTIONS WILL EXECUTE.
        </span>
      </div>
      <Link 
        href="/mission-control/safety"
        className="font-mono text-[10px] uppercase underline hover:text-white transition-colors"
      >
        Disable
      </Link>
    </div>
  );
}
