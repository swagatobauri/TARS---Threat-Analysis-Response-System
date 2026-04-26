"use client";

import React, { useState } from "react";
import useSWR from "swr";
import { Search, ChevronDown, ChevronRight, Check, X, Crosshair, Link2, ShieldAlert } from "lucide-react";
import Link from "next/link";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || (typeof window !== "undefined" && window.location.hostname.includes("onrender.com") ? window.location.origin.replace("frontend", "backend") : "http://localhost:8000");
const API_URL = BASE_URL.replace(/\/$/, "");
const API = API_URL;

// ── Helpers ──────────────────────────────────────────────────────────────────

const STAGE_COLORS: Record<string, { border: string; bg: string; text: string }> = {
  RECONNAISSANCE: { border: "#3b82f6", bg: "#3b82f620", text: "#3b82f6" },
  ENUMERATION:    { border: "#f59e0b", bg: "#f59e0b20", text: "#f59e0b" },
  EXPLOITATION:   { border: "#ef4444", bg: "#ef444420", text: "#ef4444" },
  PERSISTENCE:    { border: "#991b1b", bg: "#991b1b20", text: "#fca5a5" },
};

const FP_RISK_COLORS: Record<string, { label: string; color: string }> = {
  LOW:    { label: "FP:LOW",    color: "#10b981" },
  MEDIUM: { label: "FP:MED",   color: "#f59e0b" },
  HIGH:   { label: "FP:HIGH",  color: "#ef4444" },
};

const ACTION_COLORS: Record<string, string> = {
  BLOCK:      "text-[#cc0000] font-bold",
  RATE_LIMIT: "text-[#ffaa00]",
  ALERT:      "text-blue-400",
  MONITOR:    "text-[#555]",
};

const RISK_COLORS: Record<string, string> = {
  LOW:      "text-[#555]",
  MEDIUM:   "text-[#ffaa00]",
  HIGH:     "text-[#ff6600]",
  CRITICAL: "text-[#cc0000]",
};

function fpRiskLevel(score?: number | null): string {
  if (!score || score < 0.3) return "LOW";
  if (score < 0.6) return "MEDIUM";
  return "HIGH";
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StageBadge({ stage }: { stage?: string | null }) {
  if (!stage) return null;
  const colors = STAGE_COLORS[stage];
  if (!colors) return null;
  return (
    <span
      className="px-2 py-0.5 text-[10px] font-bold font-mono rounded-full border flex items-center gap-1 w-max"
      style={{ borderColor: colors.border, backgroundColor: colors.bg, color: colors.text }}
    >
      <Link2 size={9} />
      {stage.slice(0, 4)}
    </span>
  );
}

function FPRiskChip({ score }: { score?: number | null }) {
  const level = fpRiskLevel(score);
  const { label, color } = FP_RISK_COLORS[level];
  return (
    <span
      className="px-2 py-0.5 text-[10px] font-bold font-mono rounded border"
      style={{ borderColor: `${color}66`, color, backgroundColor: `${color}22` }}
    >
      {label}
    </span>
  );
}

function FeedbackButtons({
  threatId,
  onFeedback,
}: {
  threatId: string;
  onFeedback: () => void;
}) {
  const [loading, setLoading] = useState<"tp" | "fp" | null>(null);
  const [done, setDone] = useState<"tp" | "fp" | null>(null);

  const mark = async (type: "tp" | "fp", e: React.MouseEvent) => {
    e.stopPropagation();
    setLoading(type);
    const endpoint =
      type === "tp"
        ? `${API}/api/v1/threats/${threatId}/mark-true-positive`
        : `${API}/api/v1/threats/${threatId}/mark-false-positive`;
    await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reporter: "SOC Analyst" }),
    });
    setLoading(null);
    setDone(type);
    onFeedback();
  };

  if (done === "tp") return <span className="text-[10px] font-mono text-green-500">✓ TP</span>;
  if (done === "fp") return <span className="text-[10px] font-mono text-[#cc0000]">✗ FP</span>;

  return (
    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
      <button
        title="Mark as True Positive"
        onClick={(e) => mark("tp", e)}
        disabled={loading !== null}
        className="p-1 rounded text-[#444] hover:text-green-500 hover:bg-green-500/10 transition-colors disabled:opacity-50"
      >
        <Check size={13} />
      </button>
      <button
        title="Mark as False Positive"
        onClick={(e) => mark("fp", e)}
        disabled={loading !== null}
        className="p-1 rounded text-[#444] hover:text-[#cc0000] hover:bg-red-500/10 transition-colors disabled:opacity-50"
      >
        <X size={13} />
      </button>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ThreatsPage() {
  const [filterRisk, setFilterRisk] = useState("ALL");
  const [searchIp, setSearchIp] = useState("");
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const { data: apiThreats, mutate, error } = useSWR(
    `${API}/api/v1/threats?limit=150`,
    fetcher,
    { refreshInterval: 5000 }
  );

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] space-y-4">
        <div className="text-[#cc0000] font-mono border border-[#cc0000]/30 bg-[#1a0505] p-6 rounded-lg max-w-md text-center">
          <ShieldAlert className="mx-auto mb-4" size={32} />
          <h3 className="text-lg font-bold mb-2 uppercase tracking-widest">Feed Interrupted</h3>
          <p className="text-sm opacity-80">
            Threat intelligence synchronization failed. The secure uplink to TARS Backend is offline.
          </p>
          <div className="mt-4 pt-4 border-t border-[#cc0000]/20 text-[10px] uppercase opacity-60">
            Node: {API_URL}
          </div>
        </div>
      </div>
    );
  }

  let threats: any[] = apiThreats ?? [];

  if (filterRisk !== "ALL") {
    threats = threats.filter((t) => {
      const risk = t.risk_level ?? "UNKNOWN";
      return risk === filterRisk;
    });
  }
  if (searchIp.trim()) {
    threats = threats.filter((t) => t.source_ip?.includes(searchIp.trim()));
  }

  return (
    <div className="h-full flex flex-col gap-6">
      {/* Header */}
      <header className="pb-4 border-b border-[#1a1a1a] flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-light text-white tracking-widest uppercase">
            Live Threat Feed
          </h1>
          <p className="text-[#888] font-mono text-[10px] mt-1 tracking-widest">
            {threats.length} EVENTS · POLLING EVERY 5s
          </p>
        </div>
        <div className="flex gap-3">
          <select
            value={filterRisk}
            onChange={(e) => setFilterRisk(e.target.value)}
            className="border border-[#1a1a1a] bg-[#050505] px-3 py-1.5 text-[10px] font-mono text-[#888] uppercase outline-none"
          >
            <option value="ALL">All Risks</option>
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>
          <div className="border border-[#1a1a1a] bg-[#050505] px-3 py-1.5 flex items-center gap-2">
            <Search size={12} className="text-[#555]" />
            <input
              type="text"
              value={searchIp}
              onChange={(e) => setSearchIp(e.target.value)}
              placeholder="Search IP..."
              className="bg-transparent text-[10px] font-mono text-white outline-none w-24"
            />
          </div>
        </div>
      </header>

      {/* Table */}
      <div className="flex-1 overflow-auto border border-[#1a1a1a] bg-[#050505]">
        <table className="w-full text-left border-collapse font-mono text-[11px] tracking-wide">
          <thead>
            <tr className="border-b border-[#1a1a1a] text-[#888] bg-[#0a0a0a] sticky top-0 z-10">
              <th className="p-3 font-normal w-8" />
              <th className="p-3 font-normal">TIME</th>
              <th className="p-3 font-normal">SOURCE IP</th>
              <th className="p-3 font-normal">TYPE</th>
              <th className="p-3 font-normal">KILL CHAIN</th>
              <th className="p-3 font-normal">SCORE</th>
              <th className="p-3 font-normal">RISK</th>
              <th className="p-3 font-normal">ACTION</th>
              <th className="p-3 font-normal">FP RISK</th>
              <th className="p-3 font-normal">FEEDBACK</th>
            </tr>
          </thead>
          <tbody>
            {threats.length === 0 ? (
              <tr>
                <td colSpan={10} className="p-10 text-center text-[#444]">
                  <div className="space-y-4">
                    <Crosshair size={24} className="mx-auto text-[#333]" />
                    {apiThreats ? (
                      <p>No threats match current filters.</p>
                    ) : (
                      <>
                        <p>No threat data yet. Start a simulation.</p>
                        <Link
                          href="/war-games"
                          className="inline-block border border-[#cc0000] text-[#cc0000] px-4 py-2 text-[10px] uppercase tracking-widest hover:bg-[#cc0000] hover:text-black transition-colors"
                        >
                          Launch War Games
                        </Link>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
            Array.isArray(threats) ? threats.map((t) => (
                <React.Fragment key={t.id}>
                  <tr
                    className={`border-b border-[#1a1a1a] cursor-pointer hover:bg-[#111] transition-colors ${
                      expandedRow === t.id ? "bg-[#111]" : ""
                    } ${t.action_taken === "BLOCK" ? "bg-[#0a0303]" : ""}`}
                    onClick={() =>
                      setExpandedRow(expandedRow === t.id ? null : t.id)
                    }
                  >
                    <td className="p-3 text-[#444]">
                      {expandedRow === t.id ? (
                        <ChevronDown size={14} />
                      ) : (
                        <ChevronRight size={14} />
                      )}
                    </td>
                    <td className="p-3 text-[#666]">
                      {t.created_at
                        ? new Date(t.created_at).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit",
                          })
                        : "—"}
                    </td>
                    <td className="p-3 text-white">{t.source_ip ?? "—"}</td>
                    <td
                      className={`p-3 ${
                        ["ransomware", "zero_day"].includes(t.threat_type ?? "")
                          ? "text-[#ff0000]"
                          : "text-[#aaa]"
                      }`}
                    >
                      {(t.threat_type ?? "UNKNOWN").toUpperCase()}
                    </td>
                    <td className="p-3">
                      <StageBadge stage={t.kill_chain_stage} />
                    </td>
                    <td className="p-3 text-white">
                      {typeof t.confidence_score === "number"
                        ? t.confidence_score.toFixed(3)
                        : "—"}
                    </td>
                    <td className={`p-3 font-bold ${RISK_COLORS[t.risk_level ?? ""] ?? "text-[#888]"}`}>
                      {t.risk_level ?? "—"}
                    </td>
                    <td className={`p-3 ${ACTION_COLORS[t.action_taken ?? ""] ?? "text-[#555]"}`}>
                      {t.action_taken ?? "—"}
                    </td>
                    <td className="p-3">
                      <FPRiskChip score={t.fp_risk_score} />
                    </td>
                    <td className="p-3">
                      <FeedbackButtons threatId={t.id} onFeedback={mutate} />
                    </td>
                  </tr>

                  {/* Expanded reasoning */}
                  {expandedRow === t.id && (
                    <tr className="border-b border-[#1a1a1a] bg-[#0a0a0a]">
                      <td colSpan={10} className="p-6">
                        <div className="pl-6 border-l border-[#333] space-y-3">
                          {t.kill_chain_stage && (
                            <div className="flex items-center gap-3">
                              <span className="text-[10px] uppercase tracking-widest text-[#555]">Kill Chain Stage</span>
                              <StageBadge stage={t.kill_chain_stage} />
                            </div>
                          )}
                          <div>
                            <h4 className="text-[10px] uppercase tracking-widest text-[#555] mb-1">Agent Reasoning</h4>
                            <p className="text-[#ccc] text-xs font-mono leading-relaxed whitespace-pre-wrap">
                              {t.agent_reasoning ?? "No reasoning recorded."}
                            </p>
                          </div>
                          {t.fp_risk_factors && t.fp_risk_factors.length > 0 && (
                            <div>
                              <h4 className="text-[10px] uppercase tracking-widest text-[#555] mb-1">FP Risk Factors</h4>
                              <div className="flex flex-wrap gap-2">
                                {Array.isArray(t.fp_risk_factors) && t.fp_risk_factors.map((f: string, i: number) => (
                                  <span key={i} className="text-[10px] font-mono px-2 py-0.5 border border-[#333] text-[#888] rounded">
                                    {f}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))
            : [])}
          </tbody>
        </table>
      </div>
    </div>
  );
}
