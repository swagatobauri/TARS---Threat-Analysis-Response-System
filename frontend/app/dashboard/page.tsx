"use client";

import React from "react";
import Link from "next/link";
import { ShieldAlert, Crosshair, Ban, Activity, AlertTriangle } from "lucide-react";
import { useSimulation } from "@/lib/simulation-store";
import { format } from "date-fns";

export default function DashboardPage() {
  const sim = useSimulation();
  const stats = sim.getStats();
  const events = sim.state.events;
  const actions = sim.state.actions;

  // Recent threats (last 20 non-normal events)
  const recentThreats = [...events].reverse().filter(e => e.attack_type !== "normal").slice(0, 20);
  // Recent agent actions
  const recentActions = [...actions].reverse().slice(0, 10);

  return (
    <div className="space-y-8 max-w-[1400px]">

      {/* Status bar */}
      {sim.state.isRunning && (
        <div className="flex items-center gap-3 border border-[#cc0000] bg-[#0a0303] px-4 py-3">
          <div className="w-2 h-2 rounded-full bg-[#cc0000] animate-pulse" />
          <span className="font-mono text-xs text-[#cc0000] tracking-widest">
            LIVE SIMULATION — Target: {sim.state.target}
          </span>
          <Link href="/war-games" className="ml-auto font-mono text-[10px] text-[#666] hover:text-[#cc0000] tracking-widest uppercase">
            → War Games Console
          </Link>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white font-mono">Mission Control</h1>
          <p className="text-[#555] font-mono text-xs mt-1 tracking-widest uppercase">Threat Analysis & Response System</p>
        </div>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${stats.activeThreats > 0 ? "bg-[#cc0000] animate-pulse" : "bg-[#00ff88]"}`} />
          <span className={`font-mono text-xs ${stats.activeThreats > 0 ? "text-[#cc0000]" : "text-[#00ff88]"}`}>
            {stats.activeThreats > 0 ? "UNDER ATTACK" : "ALL CLEAR"}
          </span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard icon={Activity} label="Events Processed" value={stats.totalEvents} />
        <StatCard icon={AlertTriangle} label="Active Threats" value={stats.activeThreats} color={stats.activeThreats > 0 ? "#ff6600" : undefined} />
        <StatCard icon={ShieldAlert} label="Critical Detections" value={stats.criticals} color={stats.criticals > 0 ? "#cc0000" : undefined} />
        <StatCard icon={Ban} label="IPs Blocked" value={stats.blocked} color={stats.blocked > 0 ? "#cc0000" : undefined} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Live Threat Feed */}
        <div className="border border-[#1a1a1a] bg-[#050505]">
          <div className="px-4 py-3 border-b border-[#1a1a1a] flex items-center justify-between">
            <h2 className="font-mono text-xs tracking-widest text-[#888] uppercase">Live Threat Feed</h2>
            {sim.state.isRunning && <div className="w-1.5 h-1.5 rounded-full bg-[#cc0000] animate-pulse" />}
          </div>
          <div className="max-h-[400px] overflow-y-auto">
            {recentThreats.length === 0 ? (
              <div className="p-8 text-center font-mono text-[#333] text-xs tracking-widest">
                {sim.state.isRunning ? "Monitoring..." : "No threats detected. Start a simulation in War Games."}
              </div>
            ) : (
              recentThreats.map(t => (
                <div key={t.id} className={`px-4 py-3 border-b border-[#111] flex items-center gap-4 ${t.risk_level === "CRITICAL" ? "bg-[#0a0303]" : ""}`}>
                  <div className={`w-1 h-8 flex-shrink-0 ${t.risk_level === "CRITICAL" ? "bg-[#cc0000]" : t.risk_level === "HIGH" ? "bg-[#ff6600]" : "bg-[#ffaa00]"}`} />
                  <div className="flex-1 min-w-0">
                    <div className="font-mono text-xs text-white truncate">
                      {t.attack_type.toUpperCase()} from <span className="text-[#aaa]">{t.source_ip}</span>
                    </div>
                    <div className="font-mono text-[10px] text-[#555] mt-0.5">
                      Port {t.port} → {t.dest} | Score: {t.anomaly_score.toFixed(3)}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className={`font-mono text-[10px] font-bold ${t.action === "BLOCK_IP" ? "text-[#cc0000]" : t.action === "RATE_LIMIT" ? "text-[#ffaa00]" : "text-[#555]"}`}>
                      {t.action}
                    </div>
                    <div className="font-mono text-[9px] text-[#444]">
                      {format(new Date(t.timestamp), "HH:mm:ss")}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Agent Actions */}
        <div className="border border-[#1a1a1a] bg-[#050505]">
          <div className="px-4 py-3 border-b border-[#1a1a1a]">
            <h2 className="font-mono text-xs tracking-widest text-[#888] uppercase">Autonomous Agent Actions</h2>
          </div>
          <div className="max-h-[400px] overflow-y-auto">
            {recentActions.length === 0 ? (
              <div className="p-8 text-center font-mono text-[#333] text-xs tracking-widest">
                No autonomous actions taken yet.
              </div>
            ) : (
              recentActions.map(a => (
                <div key={a.id} className="px-4 py-3 border-b border-[#111]">
                  <div className="flex items-center justify-between mb-1">
                    <span className={`font-mono text-xs font-bold ${a.action === "BLOCK_IP" ? "text-[#cc0000]" : "text-[#ffaa00]"}`}>
                      {a.action}
                    </span>
                    <span className="font-mono text-[9px] text-[#444]">{format(new Date(a.timestamp), "HH:mm:ss")}</span>
                  </div>
                  <div className="font-mono text-[10px] text-[#aaa]">{a.ip}</div>
                  <div className="font-mono text-[10px] text-[#555] mt-1">{a.reason}</div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

      {/* AI Agent Intelligence */}
      <div className="border border-[#1a1a1a] bg-[#050505]">
        <div className="px-4 py-3 border-b border-[#1a1a1a] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${sim.state.agentActive ? "bg-[#00ff88] animate-pulse" : "bg-[#333]"}`} />
            <h2 className="font-mono text-xs tracking-widest text-[#888] uppercase">
              TARS AI Agent {sim.state.agentActive ? "(LLaMA 3.3 70B)" : "(Offline)"}
            </h2>
          </div>
          {sim.state.agentMessages.length > 0 && (
            <span className="font-mono text-[9px] text-[#444]">
              {sim.state.agentMessages[sim.state.agentMessages.length - 1]?.tokens || 0} tokens
            </span>
          )}
        </div>
        <div className="max-h-[300px] overflow-y-auto">
          {sim.state.agentMessages.length === 0 ? (
            <div className="p-8 text-center font-mono text-[#333] text-xs tracking-widest">
              {sim.state.agentActive
                ? "Agent is processing..."
                : "AI agent activates during simulation. Add GROQ_API_KEY to frontend/.env.local for live LLM reasoning."}
            </div>
          ) : (
            [...sim.state.agentMessages].reverse().map(msg => (
              <div key={msg.id} className="px-4 py-4 border-b border-[#111]">
                <div className="flex items-center justify-between mb-2">
                  <span className={`font-mono text-[10px] font-bold tracking-widest ${
                    msg.verdict === "NEUTRALIZE" ? "text-[#cc0000]" :
                    msg.verdict === "ESCALATE" ? "text-[#ff6600]" :
                    msg.verdict === "MONITOR" ? "text-[#ffaa00]" :
                    msg.verdict === "SAFE" ? "text-[#00ff88]" : "text-[#555]"
                  }`}>
                    VERDICT: {msg.verdict}
                  </span>
                  <span className="font-mono text-[9px] text-[#444]">
                    {format(new Date(msg.timestamp), "HH:mm:ss")}
                  </span>
                </div>
                <p className="font-mono text-xs text-[#aaa] leading-relaxed">{msg.analysis}</p>
              </div>
            ))
          )}
        </div>
      </div>

      {/* CTA if not running */}
      {!sim.state.isRunning && events.length === 0 && (
        <div className="border-2 border-dashed border-[#1a1a1a] p-8 text-center">
          <Crosshair size={32} className="text-[#333] mx-auto mb-4" />
          <p className="font-mono text-sm text-[#555] mb-4">No simulation running. Launch War Games to see live data here.</p>
          <Link href="/war-games" className="inline-block bg-[#cc0000] text-black px-6 py-3 font-mono text-xs tracking-widest uppercase font-bold hover:bg-[#ff0000] transition-colors">
            Launch War Games
          </Link>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: number; color?: string }) {
  return (
    <div className="border border-[#1a1a1a] bg-[#050505] p-5">
      <div className="flex items-center gap-2 mb-3">
        <Icon size={14} className="text-[#555]" />
        <span className="font-mono text-[9px] tracking-widest text-[#555] uppercase">{label}</span>
      </div>
      <div className="text-3xl font-light font-mono" style={{ color: color || "#fff" }}>{value}</div>
    </div>
  );
}
