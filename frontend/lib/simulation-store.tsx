"use client";

import React, { createContext, useContext, useState, useCallback, useEffect } from "react";

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
  blockedIps: Set<string>;
  isRunning: boolean;
  target: string;
  agentActive: boolean;
};

type SimStore = {
  state: SimState;
  pushEvents: (events: SimEvent[]) => void;
  pushAction: (action: AgentAction) => void;
  pushAgentMessage: (msg: AgentMessage) => void;
  setRunning: (running: boolean) => void;
  setTarget: (target: string) => void;
  setAgentActive: (active: boolean) => void;
  clearAll: () => void;
  getStats: () => {
    totalEvents: number;
    criticals: number;
    highs: number;
    blocked: number;
    activeThreats: number;
    recentScores: { t: string; s: number }[];
  };
};

const SimContext = createContext<SimStore | null>(null);

export function SimulationProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<SimState>({
    events: [],
    actions: [],
    agentMessages: [],
    blockedIps: new Set(),
    isRunning: false,
    target: "",
    agentActive: false,
  });

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
          isRunning: false // Don't auto-start simulation on refresh
        }));
      } catch (e) {
        console.error("Failed to load sim state", e);
      }
    }
  }, []);

  // Save to localStorage on change
  useEffect(() => {
    const { blockedIps, ...rest } = state;
    localStorage.setItem("tars_sim_state", JSON.stringify({
      ...rest,
      blockedIps: Array.from(blockedIps)
    }));
  }, [state]);

  const pushEvents = useCallback((newEvents: SimEvent[]) => {
    setState(prev => {
      const blockedIps = new Set(prev.blockedIps);
      const newActions: AgentAction[] = [];

      newEvents.forEach(e => {
        if (e.action === "BLOCK_IP" && !blockedIps.has(e.source_ip)) {
          blockedIps.add(e.source_ip);
          newActions.push({
            id: crypto.randomUUID(), timestamp: e.timestamp, ip: e.source_ip,
            action: "BLOCK_IP",
            reason: `Autonomous block: ${e.attack_type} detected (score: ${e.anomaly_score.toFixed(3)})`,
            risk_level: e.risk_level,
          });
        }
        if (e.action === "RATE_LIMIT" && !blockedIps.has(e.source_ip)) {
          newActions.push({
            id: crypto.randomUUID(), timestamp: e.timestamp, ip: e.source_ip,
            action: "RATE_LIMIT",
            reason: `Throttled: anomalous ${e.attack_type} traffic pattern`,
            risk_level: e.risk_level,
          });
        }
      });

      return {
        ...prev,
        events: [...prev.events, ...newEvents].slice(-500),
        actions: [...prev.actions, ...newActions].slice(-200),
        blockedIps,
      };
    });
  }, []);

  const pushAction = useCallback((action: AgentAction) => {
    setState(prev => ({ ...prev, actions: [...prev.actions, action].slice(-200) }));
  }, []);

  const pushAgentMessage = useCallback((msg: AgentMessage) => {
    setState(prev => ({
      ...prev,
      agentMessages: [...prev.agentMessages, msg].slice(-30),
      agentActive: msg.agentActive,
    }));
  }, []);

  const setRunning = useCallback((running: boolean) => {
    setState(prev => ({ ...prev, isRunning: running }));
  }, []);

  const setTarget = useCallback((target: string) => {
    setState(prev => ({ ...prev, target }));
  }, []);

  const setAgentActive = useCallback((active: boolean) => {
    setState(prev => ({ ...prev, agentActive: active }));
  }, []);

  const clearAll = useCallback(() => {
    setState({ events: [], actions: [], agentMessages: [], blockedIps: new Set(), isRunning: false, target: "", agentActive: false });
  }, []);

  const getStats = useCallback(() => {
    const events = state.events;
    const last30 = events.slice(-30);
    return {
      totalEvents: events.length,
      criticals: events.filter(e => e.risk_level === "CRITICAL").length,
      highs: events.filter(e => e.risk_level === "HIGH").length,
      blocked: state.blockedIps.size,
      activeThreats: events.filter(e => e.risk_level !== "LOW" && Date.now() - new Date(e.timestamp).getTime() < 30000).length,
      recentScores: last30.map(e => ({ t: e.timestamp, s: e.anomaly_score })),
    };
  }, [state.events, state.blockedIps]);

  return (
    <SimContext.Provider value={{ state, pushEvents, pushAction, pushAgentMessage, setRunning, setTarget, setAgentActive, clearAll, getStats }}>
      {children}
    </SimContext.Provider>
  );
}

export function useSimulation() {
  const ctx = useContext(SimContext);
  if (!ctx) throw new Error("useSimulation must be used within SimulationProvider");
  return ctx;
}
