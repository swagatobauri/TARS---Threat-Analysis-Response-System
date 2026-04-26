"use client";

import React, { useState, useMemo } from "react";
import { Search, Globe, ShieldAlert, Activity } from "lucide-react";
import { BarChart, Bar, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import useSWR from "swr";
import { format } from "date-fns";

const API_URL = process.env.NEXT_PUBLIC_API_URL || (typeof window !== "undefined" && window.location.hostname.includes("onrender.com") ? window.location.origin.replace("frontend", "backend") : "http://localhost:8000");

const fetcher = (url: string) => fetch(url).then((res) => {
  if (!res.ok) throw new Error("API Connection Failed");
  return res.json();
});

export default function IPIntelligencePage() {
  const [ip, setIp] = useState("");
  const [searchIp, setSearchIp] = useState("192.168.1.5");
  
  const { data: decisions, error, isValidating } = useSWR(
    `${API_URL}/api/v1/intelligence/decisions`,
    fetcher,
    { refreshInterval: 5000 }
  );

  const profile = useMemo(() => {
    if (!decisions || decisions.length === 0) return null;
    const latest = decisions[0];
    return {
      ip_address: latest.source_ip || searchIp,
      reputation_score: latest.confidence_score || 0.0,
      risk_category: latest.confidence_score > 0.8 ? "CRITICAL" : "MEDIUM",
      total_events: decisions.length,
      attack_events: decisions.filter((d: any) => d.action_taken === "BLOCK").length,
      false_positives: 0,
      attack_pattern: latest.threat_type || "anomaly_detected",
      timeline: decisions( || []).map((d: any, i: number) => ({
        date: d.created_at,
        events: 1
      }))
    };
  }, [decisions, searchIp]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchIp(ip);
  };

  // Pure CSS Circular Gauge Calculation
  const strokeDasharray = 283; // 2 * pi * 45
  const strokeDashoffset = profile 
    ? strokeDasharray - (strokeDasharray * profile.reputation_score)
    : strokeDasharray;

  if (!profile && !error && !decisions) return (
    <div className="flex items-center justify-center h-full text-[#888] font-mono animate-pulse">
      <Globe className="mr-3 animate-spin-slow" />
      SYNCHRONIZING WITH INTELLIGENCE CORE...
    </div>
  );

  if (!profile) return (
    <div className="flex flex-col items-center justify-center h-full border border-dashed border-[#333] rounded-lg bg-[#050505] p-12 text-center">
      <ShieldAlert size={48} className="text-[#222] mb-4" />
      <h3 className="text-white font-mono mb-2 uppercase tracking-widest">No Intelligence Data</h3>
      <p className="text-[#666] font-mono text-xs max-w-md">The AI reasoning engine has not profiled any actors yet. Run a simulation in War Games to generate live threat intelligence.</p>
    </div>
  );

  return (
    <div className="h-full flex flex-col gap-6">
      <header className="pb-4 border-b border-[#1a1a1a] flex justify-between items-end">
        <div>
           <h1 className="text-2xl font-light text-white tracking-widest uppercase">IP Intelligence</h1>
           <p className="text-[#888] font-mono text-[10px] mt-1 tracking-widest">THREAT ACTOR PROFILING</p>
        </div>
        <form onSubmit={handleSearch} className="flex gap-2">
          <input 
            type="text" 
            placeholder="Enter IP Address..." 
            value={ip}
            onChange={(e) => setIp(e.target.value)}
            className="border border-[#1a1a1a] bg-[#050505] px-3 py-1.5 text-xs font-mono text-white outline-none focus:border-[#444] transition-colors w-64"
          />
          <button type="submit" disabled={isValidating} className="border border-[#1a1a1a] bg-[#111] hover:bg-[#222] px-4 py-1.5 flex items-center gap-2 text-[10px] font-mono text-white uppercase transition-colors">
            {isValidating ? <Activity size={12} className="animate-spin" /> : <Search size={12} />} 
            Scan
          </button>
        </form>
      </header>

      <div className="grid grid-cols-12 gap-6 flex-1 min-h-0">
        
        {/* Left Column: Profile Card */}
        <div className="col-span-4 border border-[#1a1a1a] bg-[#050505] p-6 flex flex-col items-center">
          <Globe size={48} className="text-[#333] mb-6" strokeWidth={1} />
          <h2 className="text-xl font-mono text-white tracking-wider mb-2">{profile.ip_address}</h2>
          
          <div className="mb-8 relative w-32 h-32 flex items-center justify-center">
            <svg className="w-full h-full transform -rotate-90">
              <circle cx="64" cy="64" r="45" fill="none" stroke="#1a1a1a" strokeWidth="6" />
              <circle 
                cx="64" cy="64" r="45" fill="none" stroke="#ff4444" strokeWidth="6"
                strokeDasharray={strokeDasharray}
                strokeDashoffset={strokeDashoffset}
                className="transition-all duration-1000 ease-out"
                style={{ filter: "drop-shadow(0 0 4px rgba(255,68,68,0.5))" }}
              />
            </svg>
            <div className="absolute flex flex-col items-center">
              <span className="text-2xl font-light text-white">{profile.reputation_score.toFixed(2)}</span>
              <span className="text-[9px] font-mono tracking-widest text-[#888] uppercase">Reputation</span>
            </div>
          </div>

          <div className="w-full space-y-4">
            <div className="flex justify-between items-center border-b border-[#1a1a1a] pb-2">
              <span className="text-[10px] font-mono tracking-widest text-[#666] uppercase">Risk Category</span>
              <span className="text-[10px] font-mono tracking-widest text-[#ff4444] shadow-glow-threat">{profile.risk_category}</span>
            </div>
            <div className="flex justify-between items-center border-b border-[#1a1a1a] pb-2">
              <span className="text-[10px] font-mono tracking-widest text-[#666] uppercase">Total Events</span>
              <span className="text-sm font-light text-white">{profile.total_events}</span>
            </div>
            <div className="flex justify-between items-center border-b border-[#1a1a1a] pb-2">
              <span className="text-[10px] font-mono tracking-widest text-[#666] uppercase">Attack Events</span>
              <span className="text-sm font-light text-white">{profile.attack_events}</span>
            </div>
            <div className="flex justify-between items-center border-b border-[#1a1a1a] pb-2">
              <span className="text-[10px] font-mono tracking-widest text-[#666] uppercase">False Positives</span>
              <span className="text-sm font-light text-white">{profile.false_positives}</span>
            </div>
          </div>

          {profile.attack_pattern && (
            <div className="mt-8 border border-[#ffaa00] bg-[#1a1200] p-3 w-full text-center">
               <span className="text-[10px] font-mono tracking-widest text-[#ffaa00] uppercase flex items-center justify-center gap-2">
                 <ShieldAlert size={12} /> Pattern: {profile.attack_pattern.replace(/_/g, ' ')}
               </span>
            </div>
          )}
        </div>

        {/* Right Column: Timeline & Decisions */}
        <div className="col-span-8 flex flex-col gap-6">
          
          {/* Chart */}
          <div className="border border-[#1a1a1a] bg-[#050505] p-5 h-64 flex flex-col">
            <h3 className="text-[10px] font-mono text-[#888888] mb-4 uppercase tracking-widest pb-2 border-b border-[#1a1a1a]">
              30-Day Threat Timeline
            </h3>
            <div className="flex-1">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={profile.timeline} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <XAxis 
                    dataKey="date" 
                    tickFormatter={(tick) => format(new Date(tick), "MMM dd")}
                    stroke="#333" 
                    fontSize={9} 
                    fontFamily="var(--font-mono)"
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis stroke="#333" fontSize={9} fontFamily="var(--font-mono)" tickLine={false} axisLine={false} />
                  <Tooltip 
                    cursor={{ fill: '#111' }}
                    contentStyle={{ backgroundColor: "#000", border: "1px solid #333", fontSize: "10px", fontFamily: "var(--font-mono)", borderRadius: "0px" }}
                    labelFormatter={(label) => format(new Date(label), "yyyy-MM-dd")}
                  />
                  <Bar dataKey="events" fill="#555" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Decisions Table */}
          <div className="border border-[#1a1a1a] bg-[#050505] p-5 flex-1 overflow-hidden flex flex-col">
            <h3 className="text-[10px] font-mono text-[#888888] mb-4 uppercase tracking-widest pb-2 border-b border-[#1a1a1a]">
              Recent Agent Decisions
            </h3>
            <div className="overflow-auto flex-1">
              <table className="w-full text-left border-collapse font-mono text-[10px] tracking-widest">
                <thead>
                  <tr className="border-b border-[#1a1a1a] text-[#666]">
                    <th className="pb-2 font-normal">TIMESTAMP</th>
                    <th className="pb-2 font-normal">SCORE</th>
                    <th className="pb-2 font-normal">ACTION</th>
                  </tr>
                </thead>
                <tbody>
                  {decisions?.slice(0, 10)( || []).map((d: any) => (
                    <tr key={d.threat_event_id}>
                      <td className="py-3 border-b border-[#1a1a1a] text-[#888]">{format(new Date(d.created_at), "yyyy-MM-dd HH:mm")}</td>
                      <td className="py-3 border-b border-[#1a1a1a] text-[#888]">{d.confidence_score.toFixed(4)}</td>
                      <td className={`py-3 border-b border-[#1a1a1a] ${d.action_taken === 'BLOCK' ? 'text-[#ff4444]' : 'text-[#ffaa00]'}`}>{d.action_taken}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
