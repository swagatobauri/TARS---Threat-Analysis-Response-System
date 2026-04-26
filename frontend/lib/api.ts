/**
 * TARS API Client — Typed interface for all backend endpoints.
 */

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 
  (typeof window !== "undefined" && window.location.hostname.includes("onrender.com") 
    ? window.location.origin.replace("frontend", "backend") + "/api/v1" 
    : "/api/v1");

// ── Types ──

export interface NetworkLog {
  id: string;
  source_ip: string;
  dest_ip: string;
  dest_port: number;
  protocol: string;
  bytes_sent: number;
  bytes_received: number;
  duration_seconds: number;
  timestamp: string;
  anomaly_score?: AnomalyScore;
}

export interface AnomalyScore {
  id: string;
  log_id: string;
  isolation_forest_score: number;
  svm_score: number;
  combined_score: number;
  risk_level: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  is_anomaly: boolean;
}

export interface ThreatEvent {
  id: string;
  log_id: string;
  anomaly_score: number;
  risk_level: string;
  action_taken: string;
  reasoning_chain: string[];
  explanation: string;
  source_ip: string;
  timestamp: string;
  resolved: boolean;
}

export interface AgentDecision {
  id: string;
  ip: string;
  action: string;
  anomaly_score: number;
  risk_level: string;
  reasoning: string[];
  timestamp: string;
}

export interface IPProfile {
  ip_address: string;
  reputation_score: number;
  risk_category: string;
  total_events: number;
  attack_events: number;
  false_positives: number;
  first_seen: string;
  last_seen: string;
  attack_timeline: { timestamp: string; type: string; score: number; action: string }[];
}

export interface ActionLog {
  id: string;
  timestamp: string;
  ip: string;
  action: string;
  success: boolean;
  execution_time_ms: number;
  error: string | null;
}

export interface SystemHealth {
  database: { status: string; latency_ms: number };
  celery: { status: string; active_workers: number };
  ml_model: { status: string; last_retrain: string };
  last_detection_seconds_ago: number;
  groq_api: { status: string; response_time_ms: number };
}

export interface ThreatStats {
  active_threats: number;
  blocked_ips: number;
  anomalies_today: number;
  system_status: "ACTIVE" | "DEGRADED";
  recent_scores: { timestamp: string; score: number }[];
}

export interface LogIngestPayload {
  source_ip: string;
  dest_ip: string;
  dest_port: number;
  protocol: string;
  bytes_sent: number;
  bytes_received: number;
  duration_seconds: number;
  timestamp: string;
}

// ── Fetch wrapper ──

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`API ${res.status}: ${body}`);
  }
  return res.json();
}

// ── Threats ──

export async function fetchThreats(filters?: {
  risk_level?: string;
  resolved?: boolean;
  limit?: number;
}): Promise<ThreatEvent[]> {
  const params = new URLSearchParams();
  if (filters?.risk_level) params.set("risk_level", filters.risk_level);
  if (filters?.resolved !== undefined) params.set("resolved", String(filters.resolved));
  if (filters?.limit) params.set("limit", String(filters.limit));
  const qs = params.toString();
  return request<ThreatEvent[]>(`/threats${qs ? `?${qs}` : ""}`);
}

export async function fetchThreatById(id: string): Promise<ThreatEvent> {
  return request<ThreatEvent>(`/threats/${id}`);
}

export async function resolveThreat(id: string): Promise<{ status: string }> {
  return request(`/threats/${id}/resolve`, { method: "PATCH" });
}

// ── Logs ──

export async function fetchLogs(page = 0, limit = 50): Promise<NetworkLog[]> {
  return request<NetworkLog[]>(`/logs?skip=${page * limit}&limit=${limit}`);
}

export async function ingestLogs(logs: LogIngestPayload[]): Promise<{ status: string; ingested: number }> {
  return request(`/logs/ingest`, { method: "POST", body: JSON.stringify(logs) });
}

// ── Agent ──

export async function fetchAgentDecisions(ip?: string): Promise<AgentDecision[]> {
  const qs = ip ? `?ip=${ip}` : "";
  return request<AgentDecision[]>(`/agent/decisions${qs}`);
}

export async function triggerReplay(scenarioId: string): Promise<{
  would_detect: boolean;
  latency_ms: number;
  action_taken: string;
  new_confidence: number;
}> {
  return request(`/agent/replay`, { method: "POST", body: JSON.stringify({ scenario_id: scenarioId }) });
}

// ── Intelligence ──

export async function fetchIPProfile(ip: string): Promise<IPProfile> {
  return request<IPProfile>(`/intelligence/ip/${ip}`);
}

// ── System ──

export async function fetchHealth(): Promise<SystemHealth> {
  return request<SystemHealth>(`/health`);
}

export async function fetchStats(): Promise<ThreatStats> {
  return request<ThreatStats>(`/threats/stats`);
}

// ── SSE (Server-Sent Events) ──

export function createSSEConnection(
  url: string,
  onEvent: (event: { type: string; data: any }) => void,
  onError?: (err: Event) => void
): EventSource {
  const fullUrl = url.startsWith("http") ? url : `${BASE_URL}${url}`;
  const source = new EventSource(fullUrl);

  source.onmessage = (e) => {
    try {
      const parsed = JSON.parse(e.data);
      onEvent({ type: parsed.event_type || "message", data: parsed });
    } catch {
      onEvent({ type: "raw", data: e.data });
    }
  };

  source.onerror = (e) => {
    if (onError) onError(e);
  };

  return source;
}
