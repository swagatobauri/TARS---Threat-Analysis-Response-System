"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Crosshair, Zap, ShieldAlert, PlayCircle, Square,
  Activity, ArrowLeft, Bug, Lock, Skull
} from "lucide-react";
import { format } from "date-fns";
import { useSimulation } from "@/lib/simulation-store";

const riskColor: Record<string, string> = {
  LOW: "text-[#555]", MEDIUM: "text-[#ffaa00]", HIGH: "text-[#ff6600]", CRITICAL: "text-[#cc0000]",
};

const ATTACK_VECTORS = [
  { id: "brute_force", label: "Brute Force", icon: Zap, desc: "SSH credential stuffing — port 22" },
  { id: "ddos", label: "DDoS Flood", icon: Activity, desc: "Multi-source volumetric flood" },
  { id: "port_scan", label: "Port Scan", icon: ShieldAlert, desc: "Sequential port enumeration" },
  { id: "sql_injection", label: "SQL Injection", icon: Bug, desc: "Database exfiltration — port 3306" },
  { id: "ransomware", label: "Ransomware", icon: Lock, desc: "Encryption payload — port 445" },
  { id: "zero_day", label: "Zero-Day", icon: Skull, desc: "Unknown CVE exploitation" },
];

// ── Page ──
export default function WarGamesPage() {
  const sim = useSimulation();
  const consoleEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    consoleEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [sim.state.logs]);

  const toggle = () => {
    if (sim.state.isRunning) {
      sim.setRunning(false);
      sim.pushLog("[SYS] Simulation terminated. Data persists in Mission Control.");
    } else {
      if (!sim.state.target.trim()) {
        sim.pushLog("[ERROR] Target URL/IP required.");
        return;
      }
      sim.setRunning(true);
      sim.pushLog(`[SYS] Engaging ${sim.state.target} — AI agent armed`);
    }
  };

  const stats = sim.getStats();

  return (
    <div className="h-screen flex flex-col bg-black text-white overflow-hidden selection:bg-red-600">
      <div className="h-[2px] bg-[#cc0000] flex-shrink-0" />
      <header className="flex items-center justify-between px-6 py-3 border-b border-[#1a1a1a] flex-shrink-0">
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2 text-[#666] hover:text-[#cc0000] transition-colors">
            <ArrowLeft size={14} />
            <span className="font-mono text-[10px] tracking-widest uppercase">Exit</span>
          </Link>
          <div className="w-[1px] h-4 bg-[#1a1a1a]" />
          <Crosshair size={16} className="text-[#cc0000]" />
          <span className="font-mono text-sm tracking-[0.2em] font-bold text-[#cc0000]">WAR GAMES</span>
        </div>
        <div className="flex items-center gap-6">
          <Link href="/mission-control" className="font-mono text-[10px] tracking-widest text-[#555] hover:text-[#00ff88] transition-colors uppercase">
            → Open Mission Control
          </Link>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${sim.state.isRunning ? "bg-[#cc0000] animate-pulse" : "bg-[#333]"}`} />
            <span className={`font-mono text-[10px] tracking-widest ${sim.state.isRunning ? "text-[#cc0000]" : "text-[#555]"}`}>
              {sim.state.isRunning ? "LIVE" : "STANDBY"}
            </span>
          </div>
        </div>
      </header>

      <div className="flex-1 grid grid-cols-12 gap-0 min-h-0 overflow-hidden">
        {/* Controls */}
        <div className="col-span-3 border-r border-[#1a1a1a] p-5 flex flex-col bg-[#050505] overflow-y-auto">
          <div className="mb-5 flex items-end gap-2">
            <div className="flex-1">
              <label className="text-[9px] font-mono tracking-widest text-[#555] uppercase block mb-2">Target URL / IP</label>
              <input type="text" value={sim.state.target} onChange={e => sim.setTarget(e.target.value)} placeholder="e.g. myapp.com" disabled={sim.state.isRunning}
                className="w-full border border-[#1a1a1a] bg-black px-3 py-2.5 text-sm font-mono text-white outline-none focus:border-[#cc0000] transition-colors disabled:opacity-30" />
            </div>
            <button onClick={sim.clearAll} disabled={sim.state.isRunning} className="px-3 py-2.5 border border-[#1a1a1a] bg-[#111] text-[#555] hover:text-white transition-colors text-xs font-mono disabled:opacity-30">
              CLEAR
            </button>
          </div>

          <div className="mb-5">
            <label className="text-[9px] font-mono tracking-widest text-[#555] uppercase block mb-2">Mode</label>
            <div className="grid grid-cols-3 gap-1">
              {["normal", "mixed", "attack_only"].map(m => (
                <button key={m} onClick={() => sim.setMode(m)} disabled={sim.state.isRunning}
                  className={`py-1.5 text-[8px] font-mono tracking-widest uppercase border ${sim.state.mode === m ? "bg-[#111] border-[#cc0000] text-[#cc0000]" : "border-[#1a1a1a] text-[#555]"}`}>
                  {m.replace("_", " ")}
                </button>
              ))}
            </div>
          </div>

          <div className={`mb-6 ${sim.state.mode === "normal" ? "opacity-20 pointer-events-none" : ""}`}>
            <label className="text-[9px] font-mono tracking-widest text-[#555] uppercase block mb-2">Attack Vector</label>
            <div className="space-y-1">
              {ATTACK_VECTORS.map(a => (
                <button key={a.id} onClick={() => sim.setAttackType(a.id)} disabled={sim.state.isRunning}
                  className={`w-full py-2 px-3 flex items-center gap-3 text-left border ${sim.state.attackType === a.id ? "bg-[#1a0505] border-[#cc0000]" : "border-[#1a1a1a]"}`}>
                  <a.icon size={14} className={sim.state.attackType === a.id ? "text-[#cc0000]" : "text-[#444]"} />
                  <div>
                    <div className={`text-[10px] font-mono tracking-widest uppercase ${sim.state.attackType === a.id ? "text-[#cc0000]" : "text-[#666]"}`}>{a.label}</div>
                    <div className="text-[8px] font-mono text-[#444]">{a.desc}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <button onClick={toggle}
            className={`mt-auto w-full py-4 flex items-center justify-center gap-2 text-xs font-mono tracking-widest uppercase font-bold border-2 transition-all ${sim.state.isRunning ? "border-[#cc0000] text-[#cc0000] bg-[#0a0505]" : "border-[#cc0000] bg-[#cc0000] text-black hover:bg-[#ff0000]"}`}>
            {sim.state.isRunning ? <><Square size={14} /> TERMINATE</> : <><PlayCircle size={14} /> ENGAGE</>}
          </button>
        </div>

        {/* Output */}
        <div className="col-span-9 flex flex-col min-h-0 overflow-hidden">
          <div className="grid grid-cols-5 border-b border-[#1a1a1a] flex-shrink-0">
            <Stat label="Events" value={stats.totalEvents} />
            <Stat label="Active Threats" value={stats.activeThreats} color={stats.activeThreats > 0 ? "#ff6600" : undefined} />
            <Stat label="Critical" value={stats.criticals} color={stats.criticals > 0 ? "#cc0000" : undefined} />
            <Stat label="Blocked IPs" value={stats.blocked} color={stats.blocked > 0 ? "#cc0000" : undefined} />
            <Stat label="High" value={stats.highs} color={stats.highs > 0 ? "#ff6600" : undefined} />
          </div>

          {/* Console */}
          <div className="h-36 border-b border-[#1a1a1a] bg-black p-3 overflow-y-auto flex-shrink-0 font-mono text-[10px] leading-relaxed">
            {sim.state.logs.map((l, i) => (
              <div key={i} className={
                l.includes("[AGENT]") ? "text-[#00ff88] font-bold" :
                l.includes("[THREAT]") ? "text-[#cc0000]" :
                l.includes("[ERROR]") ? "text-[#ff4444]" : "text-[#666]"
              }>{l}</div>
            ))}
            {sim.state.isRunning && <div className="animate-pulse text-[#cc0000] opacity-50">_</div>}
            <div ref={consoleEndRef} />
          </div>

          {/* Table */}
          <div className="flex-1 overflow-auto bg-[#050505]">
            <table className="w-full text-left border-collapse font-mono text-[10px]">
              <thead className="sticky top-0 bg-[#0a0a0a] z-10 border-b border-[#1a1a1a]">
                <tr className="text-[#555]">
                  <th className="px-3 py-2 font-normal">TIME</th>
                  <th className="px-3 py-2 font-normal">SOURCE</th>
                  <th className="px-3 py-2 font-normal">TARGET</th>
                  <th className="px-3 py-2 font-normal">PORT</th>
                  <th className="px-3 py-2 font-normal">TYPE</th>
                  <th className="px-3 py-2 font-normal">SCORE</th>
                  <th className="px-3 py-2 font-normal">RISK</th>
                  <th className="px-3 py-2 font-normal">ACTION</th>
                </tr>
              </thead>
              <tbody>
                {[...sim.state.events].reverse().slice(0, 100).map(t => (
                  <tr key={t.id} className={`border-b border-[#111] ${t.risk_level === "CRITICAL" ? "bg-[#0a0303]" : ""}`}>
                    <td className="px-3 py-1.5 text-[#555]">{format(new Date(t.timestamp), "HH:mm:ss")}</td>
                    <td className="px-3 py-1.5 text-[#aaa]">{t.source_ip}</td>
                    <td className="px-3 py-1.5 text-[#666]">{t.dest}</td>
                    <td className="px-3 py-1.5 text-[#666]">{t.port}</td>
                    <td className={`px-3 py-1.5 ${["ransomware", "zero_day"].includes(t.attack_type) ? "text-[#ff0000]" : "text-[#888]"}`}>{t.attack_type}</td>
                    <td className="px-3 py-1.5 text-white">{t.anomaly_score.toFixed(3)}</td>
                    <td className={`px-3 py-1.5 ${riskColor[t.risk_level]}`}>{t.risk_level}</td>
                    <td className={`px-3 py-1.5 ${t.action === "BLOCK_IP" ? "text-[#cc0000] font-bold" : t.action === "RATE_LIMIT" ? "text-[#ffaa00]" : "text-[#555]"}`}>{t.action}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {sim.state.events.length === 0 && (
              <div className="p-12 text-center font-mono text-[#333] text-xs tracking-widest">_ AWAITING TARGET ENGAGEMENT</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="px-4 py-3 border-r border-[#1a1a1a] last:border-r-0">
      <div className="text-[8px] font-mono tracking-widest text-[#555] uppercase mb-1">{label}</div>
      <div className="text-xl font-light font-mono" style={{ color: color || "#fff" }}>{value}</div>
    </div>
  );
}
