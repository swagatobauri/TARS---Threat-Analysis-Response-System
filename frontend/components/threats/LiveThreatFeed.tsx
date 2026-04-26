"use client";

import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";

type LogEvent = {
  id: string;
  timestamp: string;
  source_ip: string;
  risk_level: string;
  action_taken?: string;
  combined_score: number;
};

export default function LiveThreatFeed() {
  const [events, setEvents] = useState<LogEvent[]>([]);

  useEffect(() => {
    // Connect to SSE endpoint
    const API_URL = process.env.NEXT_PUBLIC_API_URL || (typeof window !== "undefined" && window.location.hostname.includes("onrender.com") ? window.location.origin.replace(/\/$/, "").replace("frontend", "backend") : "http://localhost:8000");
    const eventSource = new EventSource(`${API_URL}/api/v1/logs/live`);
    console.log("Connecting to Live Feed at:", `${API_URL}/api/v1/logs/live`);

    eventSource.onmessage = (e) => {
      try {
        const data: LogEvent = JSON.parse(e.data);
        setEvents((prev) => {
          // Keep last 50 events
          return [data, ...prev].slice(0, 50);
        });
      } catch (err) {
        console.error("SSE parse error", err);
      }
    };

    return () => eventSource.close();
  }, []);

  const getRiskStyle = (level: string) => {
    switch (level?.toUpperCase()) {
      case "CRITICAL": 
        return "text-[#ff4444] shadow-[0_0_8px_#ff4444]";
      case "HIGH": 
        return "text-[#ffaa00] shadow-[0_0_6px_#ffaa00]";
      case "MEDIUM": 
        return "text-yellow-400";
      case "LOW":
      default: 
        return "text-[#666666]";
    }
  };

  return (
    <div className="flex flex-col gap-1 overflow-y-auto h-full pr-2 data-cell">
      <AnimatePresence initial={false}>
        {events.map((ev) => (
          <motion.div
            key={ev.id}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.15 }}
            className="flex items-center gap-4 border-b border-[#111] py-2"
          >
            <span className="text-[#555] whitespace-nowrap w-24 shrink-0">
              {ev.timestamp ? format(new Date(ev.timestamp), "HH:mm:ss") : "--:--:--"}
            </span>
            <span className="w-32 text-white truncate shrink-0">{ev.source_ip}</span>
            <span className={`w-20 font-bold shrink-0 ${getRiskStyle(ev.risk_level)}`}>
              {ev.risk_level || "UNKNOWN"}
            </span>
            <span className="w-24 text-[#888] shrink-0 truncate">{ev.action_taken || "MONITOR"}</span>
            <span className="text-right flex-1 text-[#aaa] shrink-0">
              {ev.combined_score ? ev.combined_score.toFixed(4) : "0.0000"}
            </span>
          </motion.div>
        ))}
      </AnimatePresence>
      
      {events.length === 0 && (
        <div className="text-[#444] text-center mt-10 animate-pulse">
          _ waiting for incoming streams
        </div>
      )}
    </div>
  );
}
