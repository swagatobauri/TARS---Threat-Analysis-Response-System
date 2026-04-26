"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Terminal, Crosshair, Zap, ShieldAlert, PlayCircle, Square,
  Activity, Globe, Shield, AlertTriangle, Ban
} from "lucide-react";
import { format } from "date-fns";

// ---------- Types ----------
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

// ---------- In-Browser Anomaly Scorer ----------
function scoreAnomaly(
  bytes: number, duration: number, port: number, reqCount: number
): number {
  let score = 0;
  if (bytes < 60) score += 0.25;
  if (duration < 0.05) score += 0.2;
  if (![80, 443, 53, 123].includes(port)) score += 0.15;
  score += Math.min(reqCount / 100, 0.4);
  return Math.min(score + Math.random() * 0.05, 1.0);
}

function riskFromScore(s: number): "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" {
  if (s >= 0.8) return "CRITICAL";
  if (s >= 0.6) return "HIGH";
  if (s >= 0.35) return "MEDIUM";
  return "LOW";
}

function actionFromRisk(r: string): string {
  if (r === "CRITICAL") return "BLOCK_IP";
  if (r === "HIGH") return "RATE_LIMIT";
  if (r === "MEDIUM") return "ALERT";
  return "MONITOR";
}

// ---------- Component ----------
export default function SimulationPage() {
  const [isRunning, setIsRunning] = useState(false);
  const [mode, setMode] = useState("mixed");
  const [attackType, setAttackType] = useState("brute_force");
  const [targetUrl, setTargetUrl] = useState("");
  const [logsGenerated, setLogsGenerated] = useState(0);
  const [threats, setThreats] = useState<ThreatEvent[]>([]);
  const [consoleOutput, setConsoleOutput] = useState<string[]>([
    "[SYS] TARS Simulation Engine v2.1 — self-contained mode.",
    "[SYS] All detection runs in-browser. No backend required.",
    "[SYS] Enter a target URL/IP and select attack vector.",
  ]);

  const simRef = useRef<NodeJS.Timeout | null>(null);
  const tickRef = useRef(0);
  const attackerIp = "185.15.54.212";

  const log = useCallback((msg: string) => {
    setConsoleOutput((p) =>
      [...p, `${format(new Date(), "HH:mm:ss.SSS")}  ${msg}`].slice(-30)
    );
  }, []);

  // One simulation tick
  const tick = useCallback(() => {
    const dest = targetUrl || "10.0.0.1";
    const events: ThreatEvent[] = [];
    tickRef.current += 1;

    // Normal traffic
    if (mode === "normal" || mode === "mixed") {
      const n = Math.floor(Math.random() * 6) + 4;
      for (let i = 0; i < n; i++) {
        const port = [80, 443, 53, 123][Math.floor(Math.random() * 4)];
        const bytes = Math.floor(Math.random() * 4900) + 100;
        const dur = Math.random() * 4.9 + 0.1;
        const score = scoreAnomaly(bytes, dur, port, 1);
        const risk = riskFromScore(score);
        events.push({
          id: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
          source_ip: `192.168.1.${Math.floor(Math.random() * 50) + 10}`,
          dest,
          port,
          anomaly_score: score,
          risk_level: risk,
          action: actionFromRisk(risk),
          attack_type: "normal",
        });
      }
      log(`Generated ${n} normal traffic events → ${dest}`);
    }

    // Attack traffic
    const shouldAttack =
      mode === "attack_only" || (mode === "mixed" && Math.random() < 0.25);
    if (shouldAttack) {
      const aType =
        mode === "mixed"
          ? ["brute_force", "ddos", "port_scan"][Math.floor(Math.random() * 3)]
          : attackType;

      let count = 0;
      if (aType === "brute_force") {
        count = 25;
        for (let i = 0; i < count; i++) {
          const score = scoreAnomaly(45, 0.02, 22, count);
          const risk = riskFromScore(score);
          events.push({
            id: crypto.randomUUID(),
            timestamp: new Date().toISOString(),
            source_ip: attackerIp,
            dest,
            port: 22,
            anomaly_score: score,
            risk_level: risk,
            action: actionFromRisk(risk),
            attack_type: "brute_force",
          });
        }
      } else if (aType === "ddos") {
        count = 40;
        for (let i = 0; i < count; i++) {
          const score = scoreAnomaly(1000, 0.01, 80, count);
          const risk = riskFromScore(score);
          events.push({
            id: crypto.randomUUID(),
            timestamp: new Date().toISOString(),
            source_ip: `203.0.113.${Math.floor(Math.random() * 255)}`,
            dest,
            port: 80,
            anomaly_score: score,
            risk_level: risk,
            action: actionFromRisk(risk),
            attack_type: "ddos",
          });
        }
      } else if (aType === "port_scan") {
        count = 20;
        const base = Math.floor(Math.random() * 1000);
        for (let i = 0; i < count; i++) {
          const score = scoreAnomaly(0, 0.001, base + i, count);
          const risk = riskFromScore(score);
          events.push({
            id: crypto.randomUUID(),
            timestamp: new Date().toISOString(),
            source_ip: attackerIp,
            dest,
            port: base + i,
            anomaly_score: score,
            risk_level: risk,
            action: actionFromRisk(risk),
            attack_type: "port_scan",
          });
        }
      }
      log(
        `[ATTACK] ${aType.toUpperCase()} → ${dest} (${count} payloads, avg score ${(events.filter((e) => e.attack_type !== "normal").reduce((a, e) => a + e.anomaly_score, 0) / Math.max(count, 1)).toFixed(3)})`
      );
    }

    setLogsGenerated((p) => p + events.length);
    setThreats((p) => [...p, ...events].slice(-100));
  }, [mode, attackType, targetUrl, log]);

  const toggle = () => {
    if (isRunning) {
      if (simRef.current) clearInterval(simRef.current);
      simRef.current = null;
      setIsRunning(false);
      log("[SYS] Simulation HALTED.");
    } else {
      if (!targetUrl.trim()) {
        log("[ERROR] You must enter a target URL or IP address first.");
        return;
      }
      log(`[SYS] Simulation STARTED → target: ${targetUrl}`);
      setIsRunning(true);
      tickRef.current = 0;
      simRef.current = setInterval(tick, 1000);
    }
  };

  useEffect(() => () => { if (simRef.current) clearInterval(simRef.current); }, []);

  // Derived stats
  const critCount = threats.filter((t) => t.risk_level === "CRITICAL").length;
  const highCount = threats.filter((t) => t.risk_level === "HIGH").length;
  const blocked = threats.filter((t) => t.action === "BLOCK_IP").length;

  const riskColor: Record<string, string> = {
    LOW: "text-[#666]",
    MEDIUM: "text-[#ffaa00]",
    HIGH: "text-[#ff8800]",
    CRITICAL: "text-[#ff4444]",
  };

  return (
    <div className="h-full flex flex-col gap-4 overflow-hidden">
      {/* Header */}
      <header className="pb-3 border-b border-[#1a1a1a] flex-shrink-0">
        <h1 className="text-2xl font-light text-white tracking-widest uppercase">
          War Games Control
        </h1>
        <p className="text-[#888] font-mono text-[10px] mt-1 tracking-widest">
          INTERACTIVE ATTACK SIMULATION — SELF-CONTAINED ENGINE
        </p>
      </header>

      <div className="grid grid-cols-12 gap-4 flex-1 min-h-0 overflow-hidden">
        {/* ---- LEFT: Controls ---- */}
        <div className="col-span-3 border border-[#1a1a1a] bg-[#050505] p-5 flex flex-col overflow-y-auto">
          <h3 className="text-[10px] font-mono text-[#888] uppercase tracking-widest mb-5 border-b border-[#1a1a1a] pb-2 flex items-center gap-2">
            <Crosshair size={12} /> Target Parameters
          </h3>

          <div className="space-y-5">
            {/* Target URL */}
            <div>
              <label className="text-[10px] font-mono tracking-widest text-[#666] uppercase block mb-2 flex items-center gap-2">
                <Globe size={10} /> Target URL / IP
              </label>
              <input
                type="text"
                value={targetUrl}
                onChange={(e) => setTargetUrl(e.target.value)}
                placeholder="e.g. myapp.com or 10.0.0.1"
                disabled={isRunning}
                className="w-full border border-[#1a1a1a] bg-[#0a0a0a] px-3 py-2 text-xs font-mono text-white outline-none focus:border-[#444] transition-colors disabled:opacity-40"
              />
            </div>

            {/* Mode */}
            <div>
              <label className="text-[10px] font-mono tracking-widest text-[#666] uppercase block mb-2">
                Mode
              </label>
              <div className="grid grid-cols-3 gap-1">
                {["normal", "mixed", "attack_only"].map((m) => (
                  <button
                    key={m}
                    onClick={() => setMode(m)}
                    disabled={isRunning}
                    className={`py-1.5 text-[9px] font-mono tracking-widest uppercase border transition-colors ${
                      mode === m
                        ? "bg-[#111] border-white text-white"
                        : "bg-transparent border-[#1a1a1a] text-[#666]"
                    }`}
                  >
                    {m.replace("_", " ")}
                  </button>
                ))}
              </div>
            </div>

            {/* Attack Vector */}
            <div
              className={
                mode === "normal" ? "opacity-30 pointer-events-none" : ""
              }
            >
              <label className="text-[10px] font-mono tracking-widest text-[#666] uppercase block mb-2">
                Attack Vector
              </label>
              <div className="space-y-1">
                {[
                  { id: "brute_force", label: "Brute Force", icon: Zap },
                  { id: "ddos", label: "DDoS Flood", icon: Activity },
                  { id: "port_scan", label: "Port Scan", icon: ShieldAlert },
                ]).map((a) => (
                  <button
                    key={a.id}
                    onClick={() => setAttackType(a.id)}
                    disabled={isRunning}
                    className={`w-full py-2 px-3 flex items-center gap-2 text-[10px] font-mono tracking-widest uppercase border transition-colors ${
                      attackType === a.id
                        ? "bg-[#220a0a] border-[#ff4444] text-[#ff4444]"
                        : "bg-transparent border-[#1a1a1a] text-[#666]"
                    }`}
                  >
                    <a.icon size={12} /> {a.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Launch Button */}
          <div className="mt-auto pt-4 border-t border-[#1a1a1a]">
            <button
              onClick={toggle}
              className={`w-full py-3 flex items-center justify-center gap-2 text-[10px] font-mono tracking-widest uppercase border transition-colors ${
                isRunning
                  ? "bg-[#111] border-[#ff4444] text-[#ff4444]"
                  : "bg-white border-white text-black"
              }`}
            >
              {isRunning ? (
                <><Square size={12} /> HALT SIMULATION</>
              ) : (
                <><PlayCircle size={12} /> LAUNCH ATTACK</>
              )}
            </button>
          </div>
        </div>

        {/* ---- RIGHT: Output ---- */}
        <div className="col-span-9 flex flex-col gap-4 min-h-0 overflow-hidden">
          {/* Stat Cards */}
          <div className="grid grid-cols-4 gap-3 flex-shrink-0">
            <StatCard label="Total Events" value={logsGenerated} />
            <StatCard
              label="Critical Threats"
              value={critCount}
              color={critCount > 0 ? "#ff4444" : undefined}
            />
            <StatCard
              label="High Threats"
              value={highCount}
              color={highCount > 0 ? "#ff8800" : undefined}
            />
            <StatCard
              label="IPs Blocked"
              value={blocked}
              color={blocked > 0 ? "#ff4444" : undefined}
            />
          </div>

          {/* Console */}
          <div className="border border-[#1a1a1a] bg-black p-4 h-36 flex-shrink-0 flex flex-col relative overflow-hidden">
            <h3 className="text-[10px] font-mono text-[#888] uppercase tracking-widest mb-2 border-b border-[#1a1a1a] pb-1 flex items-center gap-2">
              <Terminal size={10} /> Execution Console
            </h3>
            <div className="flex-1 overflow-y-auto font-mono text-[10px] text-[#00ff88] space-y-0.5 leading-relaxed">
              {(consoleOutput || []).map((out, i) => (
                <div
                  key={i}
                  className={
                    out.includes("[ATTACK]")
                      ? "text-[#ffaa00]"
                      : out.includes("[ERROR]")
                      ? "text-[#ff4444]"
                      : ""
                  }
                >
                  {out}
                </div>
              ))}
              {isRunning && (
                <div className="animate-pulse opacity-50">_ running</div>
              )}
            </div>
          </div>

          {/* Live Threat Table */}
          <div className="border border-[#1a1a1a] bg-[#050505] flex-1 flex flex-col min-h-0 overflow-hidden">
            <h3 className="text-[10px] font-mono text-[#888] uppercase tracking-widest p-3 border-b border-[#1a1a1a] flex items-center gap-2 flex-shrink-0">
              <Shield size={10} /> Live Detection Feed — {threats.length} events
            </h3>
            <div className="overflow-auto flex-1">
              <table className="w-full text-left border-collapse font-mono text-[10px]">
                <thead className="sticky top-0 bg-[#0a0a0a] z-10">
                  <tr className="text-[#666] border-b border-[#1a1a1a]">
                    <th className="p-2 font-normal">TIME</th>
                    <th className="p-2 font-normal">SOURCE</th>
                    <th className="p-2 font-normal">TARGET</th>
                    <th className="p-2 font-normal">PORT</th>
                    <th className="p-2 font-normal">SCORE</th>
                    <th className="p-2 font-normal">RISK</th>
                    <th className="p-2 font-normal">ACTION</th>
                  </tr>
                </thead>
                <tbody>
                  {[...threats]
                    .reverse()
                    .slice(0, 50)
                    .map((t) => (
                      <tr
                        key={t.id}
                        className={`border-b border-[#111] ${
                          t.risk_level === "CRITICAL"
                            ? "bg-[#110505]"
                            : ""
                        }`}
                      >
                        <td className="p-2 text-[#888]">
                          {format(new Date(t.timestamp), "HH:mm:ss")}
                        </td>
                        <td className="p-2 text-white">{t.source_ip}</td>
                        <td className="p-2 text-[#888]">{t.dest}</td>
                        <td className="p-2 text-[#888]">{t.port}</td>
                        <td className="p-2 text-white">
                          {t.anomaly_score.toFixed(3)}
                        </td>
                        <td className={`p-2 ${riskColor[t.risk_level]}`}>
                          {t.risk_level}
                        </td>
                        <td
                          className={`p-2 ${
                            t.action === "BLOCK_IP"
                              ? "text-[#ff4444]"
                              : t.action === "RATE_LIMIT"
                              ? "text-[#ffaa00]"
                              : "text-[#888]"
                          }`}
                        >
                          {t.action}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
              {threats.length === 0 && (
                <div className="p-8 text-center text-[#444] font-mono text-xs">
                  _ awaiting simulation launch
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color?: string;
}) {
  return (
    <div className="border border-[#1a1a1a] bg-[#050505] p-3">
      <h4 className="text-[9px] font-mono text-[#888] tracking-widest uppercase mb-1">
        {label}
      </h4>
      <span
        className="text-2xl font-light"
        style={{ color: color || "#fff" }}
      >
        {value}
      </span>
    </div>
  );
}
