"use client";

import React, { useState, useEffect } from "react";
import { Database, Server, Brain, Activity, MessageSquare } from "lucide-react";

export default function HealthPage() {
  const [secondsAgo, setSecondsAgo] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setSecondsAgo(s => s + 5), 5000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="h-full flex flex-col gap-6">
      <header className="pb-4 border-b border-[#1a1a1a]">
         <h1 className="text-2xl font-light text-white tracking-widest uppercase">System Health</h1>
         <p className="text-[#888] font-mono text-[10px] mt-1 tracking-widest">INFRASTRUCTURE STATUS</p>
      </header>

      <div className="grid grid-cols-3 gap-6">
        
        <HealthCard 
          title="Database Connection" 
          icon={Database} 
          status="ONLINE" 
          statusColor="bg-safe"
          details={[
            { label: "Latency", value: "12ms" },
            { label: "Active Connections", value: "24" }
          ]}
        />

        <HealthCard 
          title="Celery Workers" 
          icon={Server} 
          status="ONLINE" 
          statusColor="bg-safe"
          details={[
            { label: "Active Nodes", value: "4" },
            { label: "Queue Depth", value: "0" }
          ]}
        />

        <HealthCard 
          title="ML Ensemble Model" 
          icon={Brain} 
          status="LOADED" 
          statusColor="bg-safe"
          details={[
            { label: "Last Retrain", value: "24h ago" },
            { label: "Memory Footprint", value: "412 MB" }
          ]}
        />

        <HealthCard 
          title="Last Detection" 
          icon={Activity} 
          status="MONITORING" 
          statusColor="bg-[#ffaa00]"
          details={[
            { label: "Time Elapsed", value: `${secondsAgo}s ago` },
            { label: "Status", value: "Awaiting logs" }
          ]}
        />

        <HealthCard 
          title="Groq API Integration" 
          icon={MessageSquare} 
          status="ONLINE" 
          statusColor="bg-safe"
          details={[
            { label: "Response Time", value: "230ms" },
            { label: "Rate Limit Status", value: "98% remaining" }
          ]}
        />

      </div>
    </div>
  );
}

function HealthCard({ title, icon: Icon, status, statusColor, details }: any) {
  return (
    <div className="border border-[#1a1a1a] bg-[#050505] p-6 relative">
      <div className="flex justify-between items-start mb-6 border-b border-[#1a1a1a] pb-4">
        <div className="flex items-center gap-3">
          <Icon size={18} className="text-[#555]" />
          <h3 className="text-sm font-mono text-white tracking-widest uppercase">{title}</h3>
        </div>
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${statusColor} animate-pulse`}></span>
          <span className="text-[10px] font-mono text-[#888] tracking-widest">{status}</span>
        </div>
      </div>
      
      <div className="space-y-3">
        {details( || []).map((d: any, i: number) => (
          <div key={i} className="flex justify-between">
            <span className="text-[10px] font-mono tracking-widest text-[#666] uppercase">{d.label}</span>
            <span className="text-xs font-mono text-[#ccc]">{d.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
