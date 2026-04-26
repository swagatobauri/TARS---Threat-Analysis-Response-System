"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Crosshair, ShieldAlert, Activity, ChevronRight, X } from "lucide-react";
import { useSimulation } from "@/lib/simulation-store";

const API_URL = (process.env.NEXT_PUBLIC_API_URL || (typeof window !== "undefined" && window.location.hostname.includes("onrender.com") ? window.location.origin.replace("frontend", "backend") : "http://localhost:8000")).replace(/\/$/, "");
const fetcher = (url: string) => fetch(url).then((res) => res.json());

const STAGE_COLORS: Record<string, string> = {
  RECONNAISSANCE: "#3b82f6", // blue
  ENUMERATION: "#f59e0b",    // amber
  EXPLOITATION: "#ef4444",   // red
  PERSISTENCE: "#991b1b",    // dark red
};

function StageBadge({ stage, pulse = false }: { stage: string, pulse?: boolean }) {
  const color = STAGE_COLORS[stage] || "#666";
  return (
    <span 
      className={`px-2 py-1 text-[10px] font-bold font-mono rounded-full border bg-opacity-20 flex items-center w-max ${pulse && stage === 'PERSISTENCE' ? 'animate-pulse' : ''}`}
      style={{ borderColor: color, color: color, backgroundColor: `${color}33` }}
    >
      {stage}
    </span>
  );
}

export default function KillChainPage() {
  const sim = useSimulation();
  const { data: apiAttackers, mutate, error: attackersError } = useSWR(
    `${API_URL}/api/v1/kill-chain/active`,
    fetcher,
    { refreshInterval: 5000 }
  );

  const { data: apiStats, error: statsError } = useSWR(
    `${API_URL}/api/v1/kill-chain/stats`,
    fetcher,
    { refreshInterval: 5000 }
  );

  const [selectedAttacker, setSelectedAttacker] = useState<any>(null);

  if (attackersError || statsError) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] space-y-4">
        <div className="text-[#cc0000] font-mono border border-[#cc0000]/30 bg-[#1a0505] p-6 rounded-lg max-w-md text-center">
          <ShieldAlert className="mx-auto mb-4" size={32} />
          <h3 className="text-lg font-bold mb-2 uppercase tracking-widest">Intelligence Gap</h3>
          <p className="text-sm opacity-80">
            Kill chain tracking is offline. Unable to reach the intelligence processing unit.
          </p>
          <div className="mt-4 pt-4 border-t border-[#cc0000]/20 text-[10px] uppercase opacity-60">
            Source: {API_URL}
          </div>
        </div>
      </div>
    );
  }

  // ── Merge Logic ──
  const simAttackersMap: Record<string, any> = {};
  sim.state.events
    .filter(e => e.attack_type !== "normal")
    .forEach(e => {
      const stage = e.risk_level === "CRITICAL" ? "EXPLOITATION" : e.risk_level === "HIGH" ? "ENUMERATION" : "RECONNAISSANCE";
      if (!simAttackersMap[e.source_ip]) {
        simAttackersMap[e.source_ip] = {
          source_ip: e.source_ip,
          current_stage: stage,
          stage_history: [],
          first_stage_seen: e.timestamp,
          last_activity: e.timestamp,
          predicted_next_action: "Potential persistence attempt",
          is_simulated: true
        };
      }
      simAttackersMap[e.source_ip].stage_history.push({
        stage,
        timestamp: e.timestamp,
        confidence: e.anomaly_score
      });
      // Update to most recent stage
      if (new Date(e.timestamp) > new Date(simAttackersMap[e.source_ip].last_activity)) {
        simAttackersMap[e.source_ip].current_stage = stage;
        simAttackersMap[e.source_ip].last_activity = e.timestamp;
      }
    });

  const activeAttackers = [...Object.values(simAttackersMap), ...(apiAttackers ?? [])];
  
  const stats = apiStats ? { ...apiStats } : {
    total_active: activeAttackers.length,
    stage_distribution: {
      RECONNAISSANCE: activeAttackers.filter(a => a.current_stage === "RECONNAISSANCE").length,
      ENUMERATION: activeAttackers.filter(a => a.current_stage === "ENUMERATION").length,
      EXPLOITATION: activeAttackers.filter(a => a.current_stage === "EXPLOITATION").length,
      PERSISTENCE: activeAttackers.filter(a => a.current_stage === "PERSISTENCE").length,
    }
  };

  if (!apiAttackers && activeAttackers.length === 0) {
    return (
      <div className="flex items-center gap-3 text-[#888] font-mono animate-pulse p-10">
        <Activity size={18} />
        Synchronizing Kill Chain Intelligence...
      </div>
    );
  }

  const chartData = Array.isArray(Object.entries(stats?.stage_distribution || {})) ? Object.entries(stats.stage_distribution).map(([stage, count]) => ({
    stage,
    count,
  })) : [];

  const exploitCount = stats.stage_distribution["EXPLOITATION"] || 0;
  const persistenceCount = stats.stage_distribution["PERSISTENCE"] || 0;

  return (
    <div className="max-w-7xl mx-auto flex gap-6 h-[calc(100vh-8rem)]">
      {/* Main Content */}
      <div className="flex-1 flex flex-col space-y-6 overflow-y-auto pr-2">
        <div>
          <h1 className="text-2xl font-mono tracking-widest uppercase font-bold text-white mb-2 flex items-center gap-3">
            Kill Chain Intelligence
          </h1>
          <p className="text-[#888] text-sm font-mono">Real-time tracking of attacker progression across the cyber kill chain.</p>
        </div>

        {/* Summary Bar */}
        <div className="grid grid-cols-3 gap-4">
          <div className="border border-[#1a1a1a] bg-[#0c0c0c] rounded-lg p-4 flex items-center gap-4">
            <Activity size={24} className="text-[#cc0000]" />
            <div>
              <p className="text-2xl text-white font-mono font-bold">{stats.total_active}</p>
              <p className="text-xs text-[#666] uppercase tracking-wider">Active Attackers</p>
            </div>
          </div>
          <div className="border border-[#1a1a1a] bg-[#0c0c0c] rounded-lg p-4 flex items-center gap-4">
            <ShieldAlert size={24} className={exploitCount > 0 ? "text-yellow-500" : "text-[#444]"} />
            <div>
              <p className="text-2xl text-white font-mono font-bold">{exploitCount}</p>
              <p className="text-xs text-[#666] uppercase tracking-wider">In Exploitation</p>
            </div>
          </div>
          <div className="border border-[#1a1a1a] bg-[#0c0c0c] rounded-lg p-4 flex items-center gap-4">
            <Crosshair size={24} className={persistenceCount > 0 ? "text-red-500 animate-pulse" : "text-[#444]"} />
            <div>
              <p className="text-2xl text-white font-mono font-bold">{persistenceCount}</p>
              <p className="text-xs text-[#666] uppercase tracking-wider">In Persistence</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Chart */}
          <div className="border border-[#1a1a1a] bg-[#0c0c0c] rounded-lg p-4 lg:col-span-1 h-64 flex flex-col">
            <h3 className="text-sm font-mono text-[#888] mb-4">Stage Distribution</h3>
            <div className="flex-1 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 0, right: 0, left: -25, bottom: 0 }}>
                  <XAxis dataKey="stage" tick={{ fill: '#666', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#666', fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip 
                    cursor={{ fill: '#1a1a1a' }}
                    contentStyle={{ backgroundColor: '#0a0a0a', borderColor: '#333', color: '#fff', fontSize: '12px', fontFamily: 'monospace' }}
                  />
                  <Bar dataKey="count" radius={[2, 2, 0, 0]}>
                    {Array.isArray(chartData) && chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={STAGE_COLORS[entry.stage] || '#444'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Table */}
          <div className="border border-[#1a1a1a] bg-[#0c0c0c] rounded-lg lg:col-span-2 overflow-hidden flex flex-col">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#222] bg-[#111] text-xs font-mono text-[#666] uppercase tracking-wider">
                    <th className="py-3 px-4">Attacker IP</th>
                    <th className="py-3 px-4">Current Stage</th>
                    <th className="py-3 px-4 hidden sm:table-cell">Stages Observed</th>
                    <th className="py-3 px-4 hidden md:table-cell">Predicted Next</th>
                    <th className="py-3 px-4"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1a1a1a]">
                  {activeAttackers.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-[#666] font-mono text-sm">
                        No active kill chains tracked.
                      </td>
                    </tr>
                  ) : (
                  Array.isArray(activeAttackers) ? activeAttackers.map((attacker: any) => (
                      <tr 
                        key={attacker.source_ip} 
                        onClick={() => setSelectedAttacker(attacker)}
                        className={`cursor-pointer transition-colors ${selectedAttacker?.source_ip === attacker.source_ip ? 'bg-[#1a0505]' : 'hover:bg-[#111]'}`}
                      >
                        <td className="py-3 px-4 text-sm text-white font-mono">{attacker.source_ip}</td>
                        <td className="py-3 px-4">
                          <StageBadge stage={attacker.current_stage} pulse={true} />
                        </td>
                        <td className="py-3 px-4 hidden sm:table-cell text-sm text-[#888] font-mono">
                          {attacker.stage_history.length}
                        </td>
                        <td className="py-3 px-4 hidden md:table-cell text-xs text-[#aaa] font-mono">
                          {attacker.predicted_next_action || "Unknown"}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <ChevronRight size={16} className="text-[#444] inline-block" />
                        </td>
                      </tr>
                    )) : null
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Side Panel */}
      {selectedAttacker && (
        <div className="w-80 border border-[#1a1a1a] bg-[#0c0c0c] rounded-lg p-5 flex flex-col flex-shrink-0 animate-in slide-in-from-right-8 duration-200">
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-[#222]">
            <div>
              <h3 className="text-sm font-mono text-[#888] uppercase tracking-widest">Attacker Profile</h3>
              <p className="text-lg font-mono text-white mt-1">{selectedAttacker.source_ip}</p>
            </div>
            <button 
              onClick={() => setSelectedAttacker(null)}
              className="text-[#666] hover:text-white transition-colors p-1"
            >
              <X size={20} />
            </button>
          </div>

          <div className="space-y-4 mb-8">
            <div>
              <p className="text-xs text-[#666] uppercase font-mono mb-1">Current Stage</p>
              <StageBadge stage={selectedAttacker.current_stage} />
            </div>
            <div>
              <p className="text-xs text-[#666] uppercase font-mono mb-1">Predicted Next Move</p>
              <p className="text-sm text-[#ccc] font-mono">{selectedAttacker.predicted_next_action || "Unknown"}</p>
            </div>
            <div>
              <p className="text-xs text-[#666] uppercase font-mono mb-1">First Seen</p>
              <p className="text-sm text-[#888] font-mono">
                {new Date(selectedAttacker.first_stage_seen).toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-xs text-[#666] uppercase font-mono mb-1">Last Active</p>
              <p className="text-sm text-white font-mono">
                {new Date(selectedAttacker.last_activity).toLocaleString()}
              </p>
            </div>
          </div>

          <h4 className="text-xs font-mono text-[#888] uppercase tracking-widest mb-4">Stage History Timeline</h4>
          <div className="flex-1 overflow-y-auto pr-2 relative before:absolute before:inset-0 before:ml-2.5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-[#333] before:to-transparent">
            <div className="space-y-6 relative">
              {Array.isArray(selectedAttacker.stage_history) && selectedAttacker.stage_history.map((hist: any, i: number) => (
                <div key={i} className="relative flex items-start gap-4">
                  <div className="absolute left-2.5 -translate-x-1/2 w-3 h-3 rounded-full border-2 border-[#0c0c0c] bg-[#333] z-10" 
                       style={{ backgroundColor: STAGE_COLORS[hist.stage] }}></div>
                  <div className="pl-6 w-full">
                    <p className="text-xs text-[#666] font-mono mb-1">
                      {new Date(hist.timestamp).toLocaleTimeString()}
                    </p>
                    <StageBadge stage={hist.stage} />
                    <p className="text-[10px] text-[#555] font-mono mt-1">Conf: {(hist.confidence * 100).toFixed(0)}%</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
