"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Terminal, Crosshair, Zap, ShieldAlert, PlayCircle, Square,
  Activity, Globe, Shield, ArrowLeft, Skull, Bug, Lock, Wifi
} from "lucide-react";
import { format } from "date-fns";

// ── Types ──
type ThreatEvent = {
  id: string;
  timestamp: string;
  source_ip: string;
  dest: string;
  port: number;
  anomaly_score: number;
  risk_level: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  action: string;
  attack_type: string;
};

// ── Anomaly Scorer ──
function scoreAnomaly(bytes: number, dur: number, port: number, count: number): number {
  let s = 0;
  if (bytes < 60) s += 0.25;
  if (dur < 0.05) s += 0.2;
  if (![80, 443, 53, 123].includes(port)) s += 0.15;
  s += Math.min(count / 100, 0.4);
  return Math.min(s + Math.random() * 0.05, 1.0);
}

function riskOf(s: number): "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" {
  if (s >= 0.8) return "CRITICAL";
  if (s >= 0.6) return "HIGH";
  if (s >= 0.35) return "MEDIUM";
  return "LOW";
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

const attackerIps = ["185.15.54.212", "45.33.32.156", "91.240.118.172", "198.51.100.23", "203.0.113.66"];
const ipPool = Array.from({ length: 50 }, (_, i) => `192.168.1.${i + 10}`);

const ATTACK_VECTORS = [
  { id: "brute_force", label: "Brute Force", icon: Zap, desc: "SSH credential stuffing" },
  { id: "ddos", label: "DDoS Flood", icon: Activity, desc: "Multi-source HTTP flood" },
  { id: "port_scan", label: "Port Scan", icon: ShieldAlert, desc: "Sequential port enumeration" },
  { id: "sql_injection", label: "SQL Injection", icon: Bug, desc: "Database exfiltration attempt" },
  { id: "ransomware", label: "Ransomware", icon: Lock, desc: "Encryption payload delivery" },
  { id: "zero_day", label: "Zero-Day Exploit", icon: Skull, desc: "Unknown vulnerability attack" },
];

// ── Page ──
export default function WarGamesPage() {
  const [isRunning, setIsRunning] = useState(false);
  const [mode, setMode] = useState("mixed");
  const [attackType, setAttackType] = useState("brute_force");
  const [targetUrl, setTargetUrl] = useState("");
  const [totalLogs, setTotalLogs] = useState(0);
  const [threats, setThreats] = useState<ThreatEvent[]>([]);
  const [consoleLogs, setConsoleLogs] = useState<string[]>([
    "[SYS] TARS War Games Engine v2.0 initialized.",
    "[SYS] Enter a target and select attack vector.",
  ]);

  // Chaos state
  const [chaos, setChaos] = useState<"none" | "glitch" | "overload" | "crash" | "recovery">("none");
  const [tickCount, setTickCount] = useState(0);

  const simRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const consoleEndRef = useRef<HTMLDivElement>(null);

  const log = useCallback((msg: string) => {
    setConsoleLogs(p => [...p, `${format(new Date(), "HH:mm:ss.SSS")}  ${msg}`].slice(-50));
  }, []);

  useEffect(() => {
    consoleEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [consoleLogs]);

  // Generate attack batch
  const generateAttack = useCallback((aType: string, dest: string): ThreatEvent[] => {
    const batch: ThreatEvent[] = [];
    const srcIp = attackerIps[Math.floor(Math.random() * attackerIps.length)];

    if (aType === "brute_force") {
      const count = 30 + Math.floor(Math.random() * 40);
      for (let i = 0; i < count; i++) {
        const sc = scoreAnomaly(45, 0.02, 22, count);
        batch.push({ id: crypto.randomUUID(), timestamp: new Date().toISOString(), source_ip: srcIp, dest, port: 22, anomaly_score: sc, risk_level: riskOf(sc), action: actionOf(riskOf(sc)), attack_type: "brute_force" });
      }
    } else if (aType === "ddos") {
      const count = 80 + Math.floor(Math.random() * 120);
      for (let i = 0; i < count; i++) {
        const sc = scoreAnomaly(1000, 0.01, 80, count);
        batch.push({ id: crypto.randomUUID(), timestamp: new Date().toISOString(), source_ip: `203.0.113.${Math.floor(Math.random() * 255)}`, dest, port: 80, anomaly_score: sc, risk_level: riskOf(sc), action: actionOf(riskOf(sc)), attack_type: "ddos" });
      }
    } else if (aType === "port_scan") {
      const count = 25;
      const base = Math.floor(Math.random() * 1000);
      for (let i = 0; i < count; i++) {
        const sc = scoreAnomaly(0, 0.001, base + i, count);
        batch.push({ id: crypto.randomUUID(), timestamp: new Date().toISOString(), source_ip: srcIp, dest, port: base + i, anomaly_score: sc, risk_level: riskOf(sc), action: actionOf(riskOf(sc)), attack_type: "port_scan" });
      }
    } else if (aType === "sql_injection") {
      const count = 15;
      for (let i = 0; i < count; i++) {
        const sc = scoreAnomaly(200, 0.03, 3306, count);
        batch.push({ id: crypto.randomUUID(), timestamp: new Date().toISOString(), source_ip: srcIp, dest, port: 3306, anomaly_score: sc, risk_level: riskOf(sc), action: actionOf(riskOf(sc)), attack_type: "sql_injection" });
      }
    } else if (aType === "ransomware") {
      const count = 10;
      for (let i = 0; i < count; i++) {
        const sc = Math.min(0.85 + Math.random() * 0.15, 1.0);
        batch.push({ id: crypto.randomUUID(), timestamp: new Date().toISOString(), source_ip: srcIp, dest, port: 445, anomaly_score: sc, risk_level: "CRITICAL", action: "BLOCK_IP", attack_type: "ransomware" });
      }
    } else if (aType === "zero_day") {
      const count = 5;
      for (let i = 0; i < count; i++) {
        const sc = Math.min(0.9 + Math.random() * 0.1, 1.0);
        batch.push({ id: crypto.randomUUID(), timestamp: new Date().toISOString(), source_ip: srcIp, dest, port: Math.floor(Math.random() * 65535), anomaly_score: sc, risk_level: "CRITICAL", action: "BLOCK_IP", attack_type: "zero_day" });
      }
    }
    return batch;
  }, []);

  const tick = useCallback(() => {
    const dest = targetUrl;
    let batch: ThreatEvent[] = [];

    setTickCount(prev => {
      const t = prev + 1;

      // Normal traffic
      if (mode === "normal" || mode === "mixed") {
        const n = Math.floor(Math.random() * 8) + 5;
        for (let i = 0; i < n; i++) {
          const port = [80, 443, 53, 123][Math.floor(Math.random() * 4)];
          const bytes = Math.floor(Math.random() * 4900) + 100;
          const dur = Math.random() * 4.9 + 0.1;
          const sc = scoreAnomaly(bytes, dur, port, 1);
          batch.push({ id: crypto.randomUUID(), timestamp: new Date().toISOString(), source_ip: ipPool[Math.floor(Math.random() * ipPool.length)], dest, port, anomaly_score: sc, risk_level: riskOf(sc), action: actionOf(riskOf(sc)), attack_type: "normal" });
        }
        log(`Baseline traffic: ${n} events → ${dest}`);
      }

      // Attack traffic
      const doAttack = mode === "attack_only" || (mode === "mixed" && Math.random() < 0.35);
      if (doAttack) {
        const aType = mode === "mixed"
          ? ATTACK_VECTORS[Math.floor(Math.random() * ATTACK_VECTORS.length)].id
          : attackType;
        const attackBatch = generateAttack(aType, dest);
        batch = [...batch, ...attackBatch];
        const avgScore = attackBatch.reduce((a, e) => a + e.anomaly_score, 0) / Math.max(attackBatch.length, 1);
        log(`[THREAT] ${aType.toUpperCase()} → ${dest} | ${attackBatch.length} payloads | avg_score: ${avgScore.toFixed(3)}`);
      }

      // ── CHAOS EVENTS (random dramatic moments) ──
      if (t === 8 && mode !== "normal") {
        setChaos("glitch");
        log("[WARNING] ██████ ANOMALY SURGE DETECTED — ENTROPY SPIKE ██████");
        setTimeout(() => setChaos("none"), 2500);
      }

      if (t === 15 && mode !== "normal") {
        setChaos("overload");
        log("[CRITICAL] SERVER CAPACITY AT 98% — MEMORY EXHAUSTION IMMINENT");
        log("[CRITICAL] CONNECTION POOL SATURATED — 2,048/2,048 THREADS IN USE");
        // Flood extra events
        const flood = generateAttack("ddos", dest);
        batch = [...batch, ...flood];
        setTimeout(() => {
          setChaos("crash");
          log("[FATAL] ████ SYSTEM CRASH — KERNEL PANIC ████");
          log("[FATAL] Segmentation fault (core dumped)");
          log("[FATAL] Process 'nginx' terminated with signal SIGSEGV");
        }, 1500);
        setTimeout(() => {
          setChaos("recovery");
          log("[SYS] TARS RECOVERY PROTOCOL ENGAGED...");
          log("[SYS] Flushing corrupted memory pages...");
          log("[SYS] Rebuilding firewall rules from last known state...");
        }, 5000);
        setTimeout(() => {
          setChaos("none");
          log("[SYS] ✓ SYSTEM RESTORED — All threat actors neutralized");
          log("[SYS] ✓ 47 IPs added to permanent blacklist");
        }, 8000);
      }

      if (t > 20 && t % 12 === 0 && mode !== "normal") {
        const chaosTypes: Array<"glitch" | "overload"> = ["glitch", "overload"];
        const pick = chaosTypes[Math.floor(Math.random() * chaosTypes.length)];
        setChaos(pick);
        if (pick === "glitch") {
          log("[WARNING] ██ PACKET CORRUPTION DETECTED — CHECKSUM MISMATCH ██");
        } else {
          log("[CRITICAL] CPU THERMAL THROTTLE — LOAD AVERAGE: 47.2, 38.1, 22.6");
        }
        setTimeout(() => setChaos("none"), 3000);
      }

      return t;
    });

    setTotalLogs(p => p + batch.length);
    setThreats(p => [...p, ...batch].slice(-200));
  }, [mode, attackType, targetUrl, log, generateAttack]);

  const toggle = () => {
    if (isRunning) {
      if (simRef.current) clearInterval(simRef.current);
      simRef.current = null;
      setIsRunning(false);
      setChaos("none");
      setTickCount(0);
      log("[SYS] Simulation TERMINATED.");
    } else {
      if (!targetUrl.trim()) {
        log("[ERROR] Target URL/IP is required.");
        return;
      }
      log(`[SYS] ENGAGING target: ${targetUrl}`);
      setIsRunning(true);
      simRef.current = setInterval(tick, 1000);
    }
  };

  useEffect(() => () => { if (simRef.current) clearInterval(simRef.current); }, []);

  const criticals = threats.filter(t => t.risk_level === "CRITICAL").length;
  const highs = threats.filter(t => t.risk_level === "HIGH").length;
  const blocked = threats.filter(t => t.action === "BLOCK_IP").length;

  // CSS classes for chaos effects
  const chaosClass =
    chaos === "glitch" ? "animate-pulse brightness-150 hue-rotate-180" :
    chaos === "overload" ? "animate-pulse saturate-200" :
    chaos === "crash" ? "brightness-0" :
    chaos === "recovery" ? "opacity-70" : "";

  return (
    <div className={`h-screen flex flex-col bg-black text-white overflow-hidden selection:bg-red-600 transition-all duration-300 ${chaosClass}`}>
      
      {/* CRASH OVERLAY */}
      {chaos === "crash" && (
        <div className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center font-mono">
          <div className="text-[#cc0000] text-6xl font-black mb-4 animate-pulse">SYSTEM FAILURE</div>
          <div className="text-[#cc0000] text-sm opacity-60 space-y-1 text-center">
            <div>Kernel panic - not syncing: Fatal exception in interrupt</div>
            <div>CPU: 0 PID: 1 Comm: systemd Tainted: G</div>
            <div>Call Trace: ? page_fault+0x28/0x30</div>
            <div className="mt-4 animate-pulse">TARS recovery protocol initiating...</div>
          </div>
        </div>
      )}

      {/* Top bar */}
      <div className="h-[2px] bg-[#cc0000] flex-shrink-0" />
      <header className="flex items-center justify-between px-6 py-3 border-b border-[#1a1a1a] flex-shrink-0">
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2 text-[#666] hover:text-[#cc0000] transition-colors">
            <ArrowLeft size={14} />
            <span className="font-mono text-[10px] tracking-widest uppercase">Exit</span>
          </Link>
          <div className="w-[1px] h-4 bg-[#1a1a1a]" />
          <div className="flex items-center gap-2">
            <Crosshair size={16} className="text-[#cc0000]" />
            <span className="font-mono text-sm tracking-[0.2em] font-bold text-[#cc0000]">WAR GAMES</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className={`w-2 h-2 rounded-full ${isRunning ? "bg-[#cc0000] animate-pulse" : "bg-[#333]"}`} />
          <span className={`font-mono text-[10px] tracking-widest ${isRunning ? "text-[#cc0000]" : "text-[#555]"}`}>
            {chaos === "crash" ? "SYSTEM DOWN" : chaos === "overload" ? "OVERLOADING" : isRunning ? "SIMULATION ACTIVE" : "STANDBY"}
          </span>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 grid grid-cols-12 gap-0 min-h-0 overflow-hidden">
        {/* Left Panel — Controls */}
        <div className="col-span-3 border-r border-[#1a1a1a] p-5 flex flex-col bg-[#050505] overflow-y-auto">
          {/* Target */}
          <div className="mb-5">
            <label className="text-[9px] font-mono tracking-widest text-[#555] uppercase block mb-2">Target URL / IP Address</label>
            <input type="text" value={targetUrl} onChange={e => setTargetUrl(e.target.value)} placeholder="e.g. target-site.com" disabled={isRunning}
              className="w-full border border-[#1a1a1a] bg-black px-3 py-2.5 text-sm font-mono text-white outline-none focus:border-[#cc0000] transition-colors disabled:opacity-30" />
          </div>

          {/* Mode */}
          <div className="mb-5">
            <label className="text-[9px] font-mono tracking-widest text-[#555] uppercase block mb-2">Mode</label>
            <div className="grid grid-cols-3 gap-1">
              {["normal", "mixed", "attack_only"].map(m => (
                <button key={m} onClick={() => setMode(m)} disabled={isRunning}
                  className={`py-1.5 text-[8px] font-mono tracking-widest uppercase border transition-colors ${mode === m ? "bg-[#111] border-[#cc0000] text-[#cc0000]" : "bg-transparent border-[#1a1a1a] text-[#555]"}`}
                >{m.replace("_", " ")}</button>
              ))}
            </div>
          </div>

          {/* Attack Vector */}
          <div className={`mb-6 ${mode === "normal" ? "opacity-20 pointer-events-none" : ""}`}>
            <label className="text-[9px] font-mono tracking-widest text-[#555] uppercase block mb-2">Attack Vector</label>
            <div className="space-y-1 max-h-[280px] overflow-y-auto">
              {ATTACK_VECTORS.map(a => (
                <button key={a.id} onClick={() => setAttackType(a.id)} disabled={isRunning}
                  className={`w-full py-2 px-3 flex items-center gap-3 text-left border transition-colors ${attackType === a.id ? "bg-[#1a0505] border-[#cc0000]" : "bg-transparent border-[#1a1a1a]"}`}>
                  <a.icon size={14} className={attackType === a.id ? "text-[#cc0000]" : "text-[#444]"} />
                  <div>
                    <div className={`text-[10px] font-mono tracking-widest uppercase ${attackType === a.id ? "text-[#cc0000]" : "text-[#666]"}`}>{a.label}</div>
                    <div className="text-[8px] font-mono text-[#444]">{a.desc}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Launch */}
          <button onClick={toggle}
            className={`mt-auto w-full py-4 flex items-center justify-center gap-2 text-xs font-mono tracking-widest uppercase font-bold border-2 transition-all ${isRunning ? "border-[#cc0000] text-[#cc0000] bg-[#0a0505] hover:bg-[#1a0505]" : "border-[#cc0000] bg-[#cc0000] text-black hover:bg-[#ff0000]"}`}>
            {isRunning ? <><Square size={14} /> TERMINATE</> : <><PlayCircle size={14} /> ENGAGE TARGET</>}
          </button>
        </div>

        {/* Right Panel — Output */}
        <div className="col-span-9 flex flex-col min-h-0 overflow-hidden">
          {/* Stats row */}
          <div className="grid grid-cols-4 border-b border-[#1a1a1a] flex-shrink-0">
            <Stat label="Events Processed" value={totalLogs} />
            <Stat label="Critical" value={criticals} color={criticals > 0 ? "#cc0000" : undefined} />
            <Stat label="High" value={highs} color={highs > 0 ? "#ff6600" : undefined} />
            <Stat label="Blocked" value={blocked} color={blocked > 0 ? "#cc0000" : undefined} />
          </div>

          {/* Console */}
          <div className="h-36 border-b border-[#1a1a1a] bg-black p-3 overflow-y-auto flex-shrink-0 font-mono text-[10px] leading-relaxed">
            {consoleLogs.map((l, i) => (
              <div key={i} className={
                l.includes("[FATAL]") ? "text-[#ff0000] font-bold" :
                l.includes("[CRITICAL]") ? "text-[#cc0000] font-bold" :
                l.includes("[THREAT]") ? "text-[#cc0000]" :
                l.includes("[WARNING]") ? "text-[#ffaa00]" :
                l.includes("[ERROR]") ? "text-[#ff4444]" :
                l.includes("✓") ? "text-[#00ff88]" :
                "text-[#00ff88]"
              }>{l}</div>
            ))}
            {isRunning && <div className="animate-pulse text-[#cc0000] opacity-50">_ executing</div>}
            <div ref={consoleEndRef} />
          </div>

          {/* Live Detection Table */}
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
                {[...threats].reverse().slice(0, 80).map(t => (
                  <tr key={t.id} className={`border-b border-[#111] ${t.risk_level === "CRITICAL" ? "bg-[#0a0303]" : ""}`}>
                    <td className="px-3 py-1.5 text-[#555]">{format(new Date(t.timestamp), "HH:mm:ss")}</td>
                    <td className="px-3 py-1.5 text-[#aaa]">{t.source_ip}</td>
                    <td className="px-3 py-1.5 text-[#666]">{t.dest}</td>
                    <td className="px-3 py-1.5 text-[#666]">{t.port}</td>
                    <td className={`px-3 py-1.5 ${["ransomware", "zero_day"].includes(t.attack_type) ? "text-[#ff0000] font-bold" : "text-[#888]"}`}>{t.attack_type}</td>
                    <td className="px-3 py-1.5 text-white">{t.anomaly_score.toFixed(3)}</td>
                    <td className={`px-3 py-1.5 ${riskColor[t.risk_level]}`}>{t.risk_level}</td>
                    <td className={`px-3 py-1.5 ${t.action === "BLOCK_IP" ? "text-[#cc0000] font-bold" : t.action === "RATE_LIMIT" ? "text-[#ffaa00]" : "text-[#555]"}`}>{t.action}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {threats.length === 0 && (
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
