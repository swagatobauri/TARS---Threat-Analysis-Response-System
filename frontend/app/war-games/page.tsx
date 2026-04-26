"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Crosshair, Zap, ShieldAlert, PlayCircle, Square,
  Activity, ArrowLeft, Bug, Lock, Skull
} from "lucide-react";
import { format } from "date-fns";
import { useSimulation } from "@/lib/simulation-store";

// ── Anomaly Scorer ──
function scoreAnomaly(bytes: number, dur: number, port: number, count: number): number {
  let s = 0;
  if (bytes < 60) s += 0.25;
  if (dur < 0.05) s += 0.2;
  if (![80, 443, 53, 123].includes(port)) s += 0.15;
  s += Math.min(count / 100, 0.4);
  return Math.min(s + Math.random() * 0.05, 1.0);
}

function riskOf(s: number) {
  if (s >= 0.8) return "CRITICAL" as const;
  if (s >= 0.6) return "HIGH" as const;
  if (s >= 0.35) return "MEDIUM" as const;
  return "LOW" as const;
}

function actionOf(r: string) {
  if (r === "CRITICAL") return "BLOCK_IP";
  if (r === "HIGH") return "RATE_LIMIT";
  if (r === "MEDIUM") return "ALERT";
  return "MONITOR";
}

const riskColor: Record<string, string> = {
  LOW: "text-[#555]", MEDIUM: "text-[#ffaa00]", HIGH: "text-[#ff6600]", CRITICAL: "text-[#cc0000]",
};

const attackerIps = ["185.15.54.212", "45.33.32.156", "91.240.118.172", "198.51.100.23"];
const ipPool = Array.from({ length: 50 }, (_, i) => `192.168.1.${i + 10}`);

const ATTACK_VECTORS = [
  { id: "brute_force", label: "Brute Force", icon: Zap, desc: "SSH credential stuffing — port 22" },
  { id: "ddos", label: "DDoS Flood", icon: Activity, desc: "Multi-source volumetric flood" },
  { id: "port_scan", label: "Port Scan", icon: ShieldAlert, desc: "Sequential port enumeration" },
  { id: "sql_injection", label: "SQL Injection", icon: Bug, desc: "Database exfiltration — port 3306" },
  { id: "ransomware", label: "Ransomware", icon: Lock, desc: "Encryption payload — port 445" },
  { id: "zero_day", label: "Zero-Day", icon: Skull, desc: "Unknown CVE exploitation" },
];

function generateAttack(aType: string, dest: string) {
  const batch: any[] = [];
  const srcIp = attackerIps[Math.floor(Math.random() * attackerIps.length)];

  const configs: Record<string, { count: number; port: number; bytes: number; dur: number }> = {
    brute_force: { count: 25 + Math.floor(Math.random() * 30), port: 22, bytes: 45, dur: 0.02 },
    ddos: { count: 60 + Math.floor(Math.random() * 80), port: 80, bytes: 1000, dur: 0.01 },
    port_scan: { count: 20, port: 0, bytes: 0, dur: 0.001 },
    sql_injection: { count: 12 + Math.floor(Math.random() * 8), port: 3306, bytes: 200, dur: 0.03 },
    ransomware: { count: 8 + Math.floor(Math.random() * 5), port: 445, bytes: 50, dur: 0.005 },
    zero_day: { count: 3 + Math.floor(Math.random() * 4), port: Math.floor(Math.random() * 65535), bytes: 30, dur: 0.002 },
  };

  const cfg = configs[aType] || configs.brute_force;
  const base = Math.floor(Math.random() * 1000);

  for (let i = 0; i < cfg.count; i++) {
    const port = aType === "port_scan" ? base + i : cfg.port;
    const sc = aType === "ransomware" || aType === "zero_day"
      ? Math.min(0.85 + Math.random() * 0.15, 1.0)
      : scoreAnomaly(cfg.bytes, cfg.dur, port, cfg.count);
    const rl = aType === "ransomware" || aType === "zero_day" ? "CRITICAL" as const : riskOf(sc);
    batch.push({
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      source_ip: aType === "ddos" ? `203.0.113.${Math.floor(Math.random() * 255)}` : srcIp,
      dest, port, anomaly_score: sc, risk_level: rl,
      action: actionOf(rl), attack_type: aType,
    });
  }
  return batch;
}

// ── Page ──
export default function WarGamesPage() {
  const sim = useSimulation();
  const [mode, setMode] = useState("mixed");
  const [attackType, setAttackType] = useState("brute_force");
  const [targetUrl, setTargetUrl] = useState("");
  const [consoleLogs, setConsoleLogs] = useState<string[]>([
    "[SYS] TARS War Games Engine initialized.",
    "[SYS] Events will flow to Mission Control in real-time.",
  ]);

  const simRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const consoleEndRef = useRef<HTMLDivElement>(null);

  const log = useCallback((msg: string) => {
    setConsoleLogs(p => [...p, `${format(new Date(), "HH:mm:ss.SSS")}  ${msg}`].slice(-60));
  }, []);

  useEffect(() => {
    consoleEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [consoleLogs]);

  const tick = useCallback(() => {
    const dest = targetUrl;
    let batch: any[] = [];

    // Normal traffic
    if (mode === "normal" || mode === "mixed") {
      const n = Math.floor(Math.random() * 8) + 5;
      for (let i = 0; i < n; i++) {
        const port = [80, 443, 53, 123][Math.floor(Math.random() * 4)];
        const bytes = Math.floor(Math.random() * 4900) + 100;
        const dur = Math.random() * 4.9 + 0.1;
        const sc = scoreAnomaly(bytes, dur, port, 1);
        batch.push({
          id: crypto.randomUUID(), timestamp: new Date().toISOString(),
          source_ip: ipPool[Math.floor(Math.random() * ipPool.length)],
          dest, port, anomaly_score: sc, risk_level: riskOf(sc),
          action: actionOf(riskOf(sc)), attack_type: "normal",
        });
      }
      log(`Baseline: ${n} events → ${dest}`);
    }

    // Attack traffic
    const doAttack = mode === "attack_only" || (mode === "mixed" && Math.random() < 0.35);
    if (doAttack) {
      const aType = mode === "mixed"
        ? ATTACK_VECTORS[Math.floor(Math.random() * ATTACK_VECTORS.length)].id
        : attackType;
      const attackBatch = generateAttack(aType, dest);
      batch = [...batch, ...attackBatch];
      const avg = attackBatch.reduce((a: number, e: any) => a + e.anomaly_score, 0) / attackBatch.length;
      log(`[THREAT] ${aType.toUpperCase()} | ${attackBatch.length} payloads | score: ${avg.toFixed(3)}`);

      const crits = attackBatch.filter((e: any) => e.risk_level === "CRITICAL");
      if (crits.length > 0) {
        log(`[AGENT] Autonomous response: ${crits.length} IPs → BLOCK_IP`);
      }
    }

    // Push to shared store (Dashboard reads this)
    sim.pushEvents(batch);
  }, [mode, attackType, targetUrl, log, sim]);

  const toggle = () => {
    if (sim.state.isRunning) {
      if (simRef.current) clearInterval(simRef.current);
      simRef.current = null;
      sim.setRunning(false);
      log("[SYS] Simulation terminated. Data persists in Mission Control.");
    } else {
      if (!targetUrl.trim()) { log("[ERROR] Target URL/IP required."); return; }
      sim.setTarget(targetUrl);
      sim.setRunning(true);
      log(`[SYS] Engaging ${targetUrl} — streaming to Mission Control`);
      simRef.current = setInterval(tick, 1000);
    }
  };

  useEffect(() => () => { if (simRef.current) clearInterval(simRef.current); }, []);

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
          <Link href="/dashboard" className="font-mono text-[10px] tracking-widest text-[#555] hover:text-[#00ff88] transition-colors uppercase">
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
          <div className="mb-5">
            <label className="text-[9px] font-mono tracking-widest text-[#555] uppercase block mb-2">Target URL / IP</label>
            <input type="text" value={targetUrl} onChange={e => setTargetUrl(e.target.value)} placeholder="e.g. myapp.com" disabled={sim.state.isRunning}
              className="w-full border border-[#1a1a1a] bg-black px-3 py-2.5 text-sm font-mono text-white outline-none focus:border-[#cc0000] transition-colors disabled:opacity-30" />
          </div>

          <div className="mb-5">
            <label className="text-[9px] font-mono tracking-widest text-[#555] uppercase block mb-2">Mode</label>
            <div className="grid grid-cols-3 gap-1">
              {["normal", "mixed", "attack_only"].map(m => (
                <button key={m} onClick={() => setMode(m)} disabled={sim.state.isRunning}
                  className={`py-1.5 text-[8px] font-mono tracking-widest uppercase border ${mode === m ? "bg-[#111] border-[#cc0000] text-[#cc0000]" : "border-[#1a1a1a] text-[#555]"}`}>
                  {m.replace("_", " ")}
                </button>
              ))}
            </div>
          </div>

          <div className={`mb-6 ${mode === "normal" ? "opacity-20 pointer-events-none" : ""}`}>
            <label className="text-[9px] font-mono tracking-widest text-[#555] uppercase block mb-2">Attack Vector</label>
            <div className="space-y-1">
              {ATTACK_VECTORS.map(a => (
                <button key={a.id} onClick={() => setAttackType(a.id)} disabled={sim.state.isRunning}
                  className={`w-full py-2 px-3 flex items-center gap-3 text-left border ${attackType === a.id ? "bg-[#1a0505] border-[#cc0000]" : "border-[#1a1a1a]"}`}>
                  <a.icon size={14} className={attackType === a.id ? "text-[#cc0000]" : "text-[#444]"} />
                  <div>
                    <div className={`text-[10px] font-mono tracking-widest uppercase ${attackType === a.id ? "text-[#cc0000]" : "text-[#666]"}`}>{a.label}</div>
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
            {consoleLogs.map((l, i) => (
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
