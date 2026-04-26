"use client";

import React, { useState } from "react";
import { format } from "date-fns";
import { Search, ChevronDown, ChevronRight, Crosshair } from "lucide-react";
import Link from "next/link";
import { useSimulation } from "@/lib/simulation-store";

export default function ThreatsPage() {
  const sim = useSimulation();
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [filterRisk, setFilterRisk] = useState<string>("ALL");
  const [searchIp, setSearchIp] = useState("");

  // Get non-normal events, apply filters
  let threats = [...sim.state.events]
    .filter(e => e.attack_type !== "normal")
    .reverse();

  if (filterRisk !== "ALL") {
    threats = threats.filter(t => t.risk_level === filterRisk);
  }
  if (searchIp.trim()) {
    threats = threats.filter(t => t.source_ip.includes(searchIp.trim()));
  }

  const riskColors: Record<string, string> = {
    LOW: "text-[#555]", MEDIUM: "text-[#ffaa00]", HIGH: "text-[#ff6600]", CRITICAL: "text-[#cc0000]",
  };

  return (
    <div className="h-full flex flex-col gap-6">
      {/* Header */}
      <header className="pb-4 border-b border-[#1a1a1a] flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-light text-white tracking-widest uppercase">Threat Feed</h1>
          <p className="text-[#888] font-mono text-[10px] mt-1 tracking-widest">
            {threats.length} EVENTS {sim.state.isRunning && "• LIVE"}
          </p>
        </div>
        <div className="flex gap-3">
          {/* Risk Filter */}
          <select
            value={filterRisk}
            onChange={e => setFilterRisk(e.target.value)}
            className="border border-[#1a1a1a] bg-[#050505] px-3 py-1.5 text-[10px] font-mono text-[#888] uppercase outline-none"
          >
            <option value="ALL">All Risks</option>
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
          </select>
          {/* IP Search */}
          <div className="border border-[#1a1a1a] bg-[#050505] px-3 py-1.5 flex items-center gap-2">
            <Search size={12} className="text-[#555]" />
            <input
              type="text"
              value={searchIp}
              onChange={e => setSearchIp(e.target.value)}
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
              <th className="p-3 font-normal w-10"></th>
              <th className="p-3 font-normal">TIME</th>
              <th className="p-3 font-normal">SOURCE IP</th>
              <th className="p-3 font-normal">TARGET</th>
              <th className="p-3 font-normal">TYPE</th>
              <th className="p-3 font-normal">SCORE</th>
              <th className="p-3 font-normal">RISK</th>
              <th className="p-3 font-normal">ACTION</th>
            </tr>
          </thead>
          <tbody>
            {threats.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-10 text-center text-[#444]">
                  {sim.state.events.length === 0 ? (
                    <div className="space-y-4">
                      <Crosshair size={24} className="mx-auto text-[#333]" />
                      <p>No threat data. Start a simulation in War Games.</p>
                      <Link href="/war-games" className="inline-block border border-[#cc0000] text-[#cc0000] px-4 py-2 text-[10px] uppercase tracking-widest hover:bg-[#cc0000] hover:text-black transition-colors">
                        Launch War Games
                      </Link>
                    </div>
                  ) : (
                    "No threats match current filters."
                  )}
                </td>
              </tr>
            ) : threats.slice(0, 100).map((t) => (
              <React.Fragment key={t.id}>
                <tr
                  className={`border-b border-[#1a1a1a] cursor-pointer hover:bg-[#111] transition-colors ${expandedRow === t.id ? "bg-[#111]" : ""} ${t.risk_level === "CRITICAL" ? "bg-[#0a0303]" : ""}`}
                  onClick={() => setExpandedRow(expandedRow === t.id ? null : t.id)}
                >
                  <td className="p-3 text-[#444]">
                    {expandedRow === t.id ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </td>
                  <td className="p-3 text-[#666]">{format(new Date(t.timestamp), "HH:mm:ss.SSS")}</td>
                  <td className="p-3 text-white">{t.source_ip}</td>
                  <td className="p-3 text-[#666]">{t.dest}</td>
                  <td className={`p-3 ${["ransomware", "zero_day"].includes(t.attack_type) ? "text-[#ff0000]" : "text-[#aaa]"}`}>
                    {t.attack_type.toUpperCase()}
                  </td>
                  <td className="p-3 text-white">{t.anomaly_score.toFixed(3)}</td>
                  <td className={`p-3 font-bold ${riskColors[t.risk_level]}`}>{t.risk_level}</td>
                  <td className={`p-3 ${t.action === "BLOCK_IP" ? "text-[#cc0000] font-bold" : t.action === "RATE_LIMIT" ? "text-[#ffaa00]" : "text-[#555]"}`}>
                    {t.action}
                  </td>
                </tr>
                {expandedRow === t.id && (
                  <tr className="border-b border-[#1a1a1a] bg-[#0a0a0a]">
                    <td colSpan={8} className="p-6">
                      <div className="pl-6 border-l border-[#333] space-y-2">
                        <h4 className="text-[10px] uppercase tracking-widest text-[#555]">Agent Reasoning</h4>
                        <p className="text-[#ccc] text-xs font-mono leading-relaxed">
                          Detected <strong>{t.attack_type}</strong> traffic from <strong>{t.source_ip}</strong> targeting <strong>{t.dest}:{t.port}</strong>.
                          Anomaly score of <strong>{t.anomaly_score.toFixed(3)}</strong> exceeds {t.risk_level} threshold.
                          {t.action === "BLOCK_IP" && " IP has been autonomously blocked at the firewall level."}
                          {t.action === "RATE_LIMIT" && " Connection has been rate-limited to 10 req/min."}
                          {t.action === "ALERT" && " Alert dispatched to SOC team for review."}
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
