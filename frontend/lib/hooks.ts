/**
 * TARS SWR Hooks — Data fetching hooks for all dashboard components.
 */

import useSWR from "swr";
import {
  fetchThreats,
  fetchStats,
  fetchIPProfile,
  fetchAgentDecisions,
  fetchHealth,
  fetchLogs,
  type ThreatEvent,
  type ThreatStats,
  type IPProfile,
  type AgentDecision,
  type SystemHealth,
  type NetworkLog,
} from "./api";

const SWR_CONFIG = {
  revalidateOnFocus: false,
  errorRetryCount: 3,
};

export function useThreats(filters?: { risk_level?: string; resolved?: boolean; limit?: number }) {
  const key = filters ? `/threats?${JSON.stringify(filters)}` : "/threats";
  return useSWR<ThreatEvent[]>(key, () => fetchThreats(filters), {
    ...SWR_CONFIG,
    refreshInterval: 5000,
  });
}

export function useThreatStats() {
  return useSWR<ThreatStats>("/threats/stats", fetchStats, {
    ...SWR_CONFIG,
    refreshInterval: 3000,
  });
}

export function useIPProfile(ip: string | null) {
  return useSWR<IPProfile>(
    ip ? `/intelligence/ip/${ip}` : null,
    () => (ip ? fetchIPProfile(ip) : Promise.reject()),
    SWR_CONFIG
  );
}

export function useAgentDecisions(ip?: string) {
  const key = ip ? `/agent/decisions?ip=${ip}` : "/agent/decisions";
  return useSWR<AgentDecision[]>(key, () => fetchAgentDecisions(ip), {
    ...SWR_CONFIG,
    refreshInterval: 5000,
  });
}

export function useSystemHealth() {
  return useSWR<SystemHealth>("/health", fetchHealth, {
    ...SWR_CONFIG,
    refreshInterval: 5000,
  });
}

export function useActionLogs(page = 0, limit = 50) {
  return useSWR<NetworkLog[]>(`/logs?page=${page}`, () => fetchLogs(page, limit), {
    ...SWR_CONFIG,
    refreshInterval: 5000,
  });
}
