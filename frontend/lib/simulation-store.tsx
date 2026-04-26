"use client";

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";

// ── Types ──
export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type SimEvent = {
  id: string;
  timestamp: string;
  source_ip: string;
  dest: string;
  port: number;
  anomaly_score: number;
  risk_level: RiskLevel;
  action: string;
  attack_type: string;
};

export type AgentAction = {
  id: string;
  timestamp: string;
  ip: string;
  action: string;
  reason: string;
  risk_level: RiskLevel;
};

export type AgentMessage = {
  id: string;
  timestamp: string;
  analysis: string;
  verdict: string;
  model: string;
  tokens: number;
  agentActive: boolean;
};

type SimState = {
  events: SimEvent[];
  actions: AgentAction[];
  agentMessages: AgentMessage[];
  logs: string[];
  blockedIps: Set<string>;
  resolvedEvents: Set<string>;
  isRunning: boolean;
  target: string;
  agentActive: boolean;
  mode: string;
  attackType: string;
  cumulativeStats: {
    totalEvents: number;
    totalBlocked: number;
    totalCriticals: number;
    totalHighs: number;
    tp: number;
    fp: number;
    fn: number;
  };
};

type SimStore = {
  state: SimState;
  pushEvents: (events: SimEvent[]) => void;
  pushAction: (action: AgentAction) => void;
  pushAgentMessage: (msg: AgentMessage) => void;
  pushLog: (msg: string) => void;
  setRunning: (running: boolean) => void;
  setTarget: (target: string) => void;
  setAgentActive: (active: boolean) => void;
  setMode: (mode: string) => void;
  setAttackType: (type: string) => void;
  resolveEvent: (id: string) => void;
  clearAll: () => void;
  getStats: () => {
    totalEvents: number;
    criticals: number;
    highs: number;
    blocked: number;
    activeThreats: number;
    recentScores: { t: string; s: number }[];
    cumulativeStats?: {
      totalEvents: number;
      totalBlocked: number;
      tp: number;
      fp: number;
      fn: number;
    };
  };
};

const SimContext = createContext<SimStore | null>(null);

// ── Helpers ──
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

// Removed static IP pools in favor of dynamic randomization

const ATTACK_VECTORS = [
  { id: "brute_force", port: 22, bytes: 45, dur: 0.02 },
  { id: "ddos", port: 80, bytes: 1000, dur: 0.01 },
  { id: "port_scan", port: 0, bytes: 0, dur: 0.001 },
  { id: "sql_injection", port: 3306, bytes: 200, dur: 0.03 },
  { id: "ransomware", port: 445, bytes: 50, dur: 0.005 },
  { id: "zero_day", port: 0, bytes: 30, dur: 0.002 },
];

export function SimulationProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<SimState>({
    events: [],
    actions: [],
    agentMessages: [],
    logs: ["[SYS] TARS Simulation Engine initialized."],
    blockedIps: new Set(),
    resolvedEvents: new Set(),
    isRunning: false,
    target: "",
    agentActive: false,
    mode: "mixed",
    attackType: "brute_force",
    cumulativeStats: {
      totalEvents: 0,
      totalBlocked: 0,
      totalCriticals: 0,
      totalHighs: 0,
      tp: 0,
      fp: 0,
      fn: 0,
    },
  });

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const tickCount = useRef(0);
  const lastMemory = useRef("");
  const mainAttackerRef = useRef("185.15.54.212");

  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem("tars_sim_state");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setState(prev => ({
          ...prev,
          ...parsed,
          blockedIps: new Set(parsed.blockedIps || []),
          resolvedEvents: new Set(parsed.resolvedEvents || []),
          isRunning: false,
          cumulativeStats: parsed.cumulativeStats || {
            totalEvents: parsed.events?.length || 0,
            totalBlocked: parsed.actions?.length || 0,
            totalCriticals: parsed.events?.filter((e: any) => e.risk_level === "CRITICAL").length || 0,
            totalHighs: parsed.events?.filter((e: any) => e.risk_level === "HIGH").length || 0,
            tp: 0, fp: 0, fn: 0
          }
        }));
      } catch (e) {}
    }
  }, []);

  // Save to localStorage on change
  useEffect(() => {
    const { blockedIps, resolvedEvents, ...rest } = state;
    localStorage.setItem("tars_sim_state", JSON.stringify({
      ...rest,
      blockedIps: Array.from(blockedIps),
      resolvedEvents: Array.from(resolvedEvents)
    }));
  }, [state]);

  const pushLog = useCallback((msg: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setState(prev => ({
      ...prev,
      logs: [...prev.logs, `${timestamp}  ${msg}`].slice(-100)
    }));
  }, []);

  const pushEvents = useCallback((newEvents: SimEvent[]) => {
    setState(prev => {
      const blockedIps = new Set(prev.blockedIps);
      const newActions: AgentAction[] = [];

      let newTp = 0, newFp = 0, newFn = 0, newCrit = 0, newHigh = 0;

      newEvents.forEach(e => {
        if (e.risk_level === "CRITICAL") newCrit++;
        if (e.risk_level === "HIGH") newHigh++;

        if (e.attack_type !== "normal" && e.risk_level !== "LOW") newTp++;
        else if (e.attack_type === "normal" && e.risk_level !== "LOW") newFp++;
        else if (e.attack_type !== "normal" && e.risk_level === "LOW") newFn++;

        if (e.action === "BLOCK_IP" && !blockedIps.has(e.source_ip)) {
          blockedIps.add(e.source_ip);
          newActions.push({
            id: crypto.randomUUID(), timestamp: e.timestamp, ip: e.source_ip,
            action: "BLOCK_IP",
            reason: `Autonomous block: ${e.attack_type} detected (score: ${e.anomaly_score.toFixed(3)})`,
            risk_level: e.risk_level,
          });
        }
      });

      return {
        ...prev,
        events: [...prev.events, ...newEvents].slice(-500),
        actions: [...prev.actions, ...newActions].slice(-200),
        blockedIps,
        cumulativeStats: {
          totalEvents: (prev.cumulativeStats?.totalEvents || 0) + newEvents.length,
          totalBlocked: (prev.cumulativeStats?.totalBlocked || 0) + newActions.length,
          totalCriticals: (prev.cumulativeStats?.totalCriticals || 0) + newCrit,
          totalHighs: (prev.cumulativeStats?.totalHighs || 0) + newHigh,
          tp: (prev.cumulativeStats?.tp || 0) + newTp,
          fp: (prev.cumulativeStats?.fp || 0) + newFp,
          fn: (prev.cumulativeStats?.fn || 0) + newFn,
        }
      };
    });
  }, []);

  const pushAgentMessage = useCallback((msg: AgentMessage) => {
    setState(prev => ({
      ...prev,
      agentMessages: [...prev.agentMessages, msg].slice(-30),
      agentActive: msg.agentActive,
    }));
  }, []);

  const tick = useCallback(() => {
    setState(current => {
      if (!current.isRunning || !current.target) return current;

      const batch: SimEvent[] = [];
      const dest = current.target;
      const logsToPush: string[] = [];

      // 1. Normal traffic
      if (current.mode === "normal" || current.mode === "mixed") {
        const n = Math.floor(Math.random() * 8) + 5;
        for (let i = 0; i < n; i++) {
          const port = [80, 443, 53, 123][Math.floor(Math.random() * 4)];
          const bytes = Math.floor(Math.random() * 4900) + 100;
          const dur = Math.random() * 4.9 + 0.1;
          const sc = scoreAnomaly(bytes, dur, port, 1);
          batch.push({
            id: crypto.randomUUID(), timestamp: new Date().toISOString(),
            source_ip: `192.168.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
            dest, port, anomaly_score: sc, risk_level: riskOf(sc),
            action: actionOf(riskOf(sc)), attack_type: "normal",
          });
        }
        logsToPush.push(`Baseline: ${n} events → ${dest}`);
      }

      // 2. Attack traffic
      const doAttack = current.mode === "attack_only" || (current.mode === "mixed" && Math.random() < 0.35);
      if (doAttack) {
        const aType = current.mode === "mixed" 
          ? ATTACK_VECTORS[Math.floor(Math.random() * ATTACK_VECTORS.length)].id 
          : current.attackType;
        
        const cfg = ATTACK_VECTORS.find(v => v.id === aType) || ATTACK_VECTORS[0];
        
        // Randomize the main attacker occasionally
        if (Math.random() < 0.1) {
          mainAttackerRef.current = `${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
        }
        
        // Generate dynamic IPs for continuous blocking, keeping some static for repeat offenses
        const useStaticIp = Math.random() < 0.7;
        const srcIp = useStaticIp 
          ? mainAttackerRef.current
          : `${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
          
        const count = aType === "ddos" ? 80 : aType === "brute_force" ? 30 : 15;
        const basePort = Math.floor(Math.random() * 1000);

        for (let i = 0; i < count; i++) {
          const port = aType === "port_scan" ? basePort + i : cfg.port;
          const sc = ["ransomware", "zero_day"].includes(aType) ? 0.9 + Math.random() * 0.1 : scoreAnomaly(cfg.bytes, cfg.dur, port, count);
          const rl = ["ransomware", "zero_day"].includes(aType) ? "CRITICAL" : riskOf(sc);
          batch.push({
            id: crypto.randomUUID(), timestamp: new Date().toISOString(),
            source_ip: aType === "ddos" ? `203.0.113.${Math.floor(Math.random() * 255)}` : srcIp,
            dest, port, anomaly_score: sc, risk_level: rl as RiskLevel,
            action: actionOf(rl), attack_type: aType,
          });
        }
        logsToPush.push(`[THREAT] ${aType.toUpperCase()} engaged → ${dest}`);
      }

      // Schedule AI Agent every 5 ticks
      tickCount.current += 1;
      if (tickCount.current % 5 === 0 && batch.some(e => e.attack_type !== "normal")) {
        fetch("/api/agent/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ events: batch.slice(-30), memory: lastMemory.current }),
        }).then(r => r.json()).then(data => {
          lastMemory.current = data.analysis?.slice(0, 200) || "";
          pushAgentMessage({
            id: crypto.randomUUID(), timestamp: new Date().toISOString(),
            analysis: data.analysis, verdict: data.verdict,
            model: data.model || "llama-3.3-70b", tokens: data.tokens || 0,
            agentActive: data.agentActive
          });
        }).catch(() => {});
      }

      const blockedIps = new Set(current.blockedIps);
      const newActions: AgentAction[] = [];
      batch.forEach(e => {
        if (e.action === "BLOCK_IP" && !blockedIps.has(e.source_ip)) {
          blockedIps.add(e.source_ip);
          newActions.push({
            id: crypto.randomUUID(), timestamp: e.timestamp, ip: e.source_ip,
            action: "BLOCK_IP",
            reason: `Autonomous block: ${e.attack_type} detected (score: ${e.anomaly_score.toFixed(3)})`,
            risk_level: e.risk_level,
          });
        }
      });

      const timestamp = new Date().toLocaleTimeString();
      const formattedLogs = logsToPush.map(l => `${timestamp}  ${l}`);

      let newCrit = 0, newHigh = 0;
      batch.forEach(e => {
        if (e.risk_level === "CRITICAL") newCrit++;
        if (e.risk_level === "HIGH") newHigh++;
      });

      return {
        ...current,
        events: [...current.events, ...batch].slice(-500),
        actions: [...current.actions, ...newActions].slice(-200),
        logs: [...current.logs, ...formattedLogs].slice(-100),
        blockedIps,
        cumulativeStats: {
          ...current.cumulativeStats,
          totalEvents: (current.cumulativeStats?.totalEvents || 0) + batch.length,
          totalBlocked: (current.cumulativeStats?.totalBlocked || 0) + newActions.length,
          totalCriticals: (current.cumulativeStats?.totalCriticals || 0) + newCrit,
          totalHighs: (current.cumulativeStats?.totalHighs || 0) + newHigh,
        }
      };
    });
  }, [pushAgentMessage]);

  useEffect(() => {
    if (state.isRunning) {
      timerRef.current = setInterval(tick, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [state.isRunning, tick]);

  const setRunning = useCallback((running: boolean) => setState(p => ({ ...p, isRunning: running })), []);
  const setTarget = useCallback((target: string) => setState(p => ({ 
    ...p, 
    target,
    events: [],
    actions: [],
    agentMessages: [],
    logs: [`[SYS] Target acquired: ${target}. Sensors recalibrated.`],
    blockedIps: new Set(),
    resolvedEvents: new Set(),
    cumulativeStats: { totalEvents: 0, totalBlocked: 0, totalCriticals: 0, totalHighs: 0, tp: 0, fp: 0, fn: 0 }
  })), []);
  const setMode = useCallback((mode: string) => setState(p => ({ ...p, mode })), []);
  const setAttackType = useCallback((at: string) => setState(p => ({ ...p, attackType: at })), []);
  const setAgentActive = useCallback((a: boolean) => setState(p => ({ ...p, agentActive: a })), []);
  const resolveEvent = useCallback((id: string) => setState(p => {
    const next = new Set(p.resolvedEvents);
    next.add(id);
    return { ...p, resolvedEvents: next };
  }), []);
  const clearAll = useCallback(() => setState(p => ({ 
    ...p, 
    events: [], 
    actions: [], 
    agentMessages: [], 
    logs: ["[SYS] Simulation engine reset."], 
    blockedIps: new Set(), 
    resolvedEvents: new Set(),
    cumulativeStats: { totalEvents: 0, totalBlocked: 0, totalCriticals: 0, totalHighs: 0, tp: 0, fp: 0, fn: 0 }
  })), []);

  const getStats = useCallback(() => {
    const events = state.events;
    return {
      totalEvents: state.cumulativeStats?.totalEvents || events.length,
      criticals: state.cumulativeStats?.totalCriticals || events.filter(e => e.risk_level === "CRITICAL").length,
      highs: state.cumulativeStats?.totalHighs || events.filter(e => e.risk_level === "HIGH").length,
      blocked: state.cumulativeStats?.totalBlocked || state.blockedIps.size,
      activeThreats: events.filter(e => e.risk_level !== "LOW" && Date.now() - new Date(e.timestamp).getTime() < 30000).length,
      recentScores: events.slice(-30).map(e => ({ t: e.timestamp, s: e.anomaly_score })),
      cumulativeStats: state.cumulativeStats,
    };
  }, [state.events, state.blockedIps, state.cumulativeStats]);

  return (
    <SimContext.Provider value={{ state, pushEvents, pushAction: () => {}, pushAgentMessage, pushLog, setRunning, setTarget, setAgentActive, setMode, setAttackType, resolveEvent, clearAll, getStats }}>
      {children}
    </SimContext.Provider>
  );
}

export function useSimulation() {
  const ctx = useContext(SimContext);
  if (!ctx) throw new Error("useSimulation must be used within SimulationProvider");
  return ctx;
}
