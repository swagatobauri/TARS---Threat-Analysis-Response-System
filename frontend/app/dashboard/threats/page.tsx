"use client";

import React, { useState } from "react";
import useSWR from "swr";
import { format } from "date-fns";
import { Search, Filter, ChevronDown, ChevronRight } from "lucide-react";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

type Threat = {
  id: string;
  source_ip: string;
  threat_type: string;
  confidence_score: number;
  action_taken: string;
  agent_reasoning: string;
  created_at: string;
  resolved: boolean;
};

export default function ThreatsPage() {
  const { data } = useSWR("http://localhost:8000/api/v1/threats", fetcher, {
    refreshInterval: 15000
  });
  const threats: Threat[] = data?.items || [];
  
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  return (
    <div className="h-full flex flex-col gap-6">
      <header className="pb-4 border-b border-[#1a1a1a] flex justify-between items-end">
        <div>
           <h1 className="text-2xl font-light text-white tracking-widest uppercase">Threat Database</h1>
           <p className="text-[#888] font-mono text-[10px] mt-1 tracking-widest">AGENT DECISION LOG</p>
        </div>
        <div className="flex gap-4">
          <div className="border border-[#1a1a1a] bg-[#050505] px-3 py-1.5 flex items-center gap-2 text-[10px] font-mono text-[#888] uppercase">
            <Filter size={12} /> Filter by Risk
          </div>
          <div className="border border-[#1a1a1a] bg-[#050505] px-3 py-1.5 flex items-center gap-2 text-[10px] font-mono text-[#888] uppercase">
            <Search size={12} /> Search IP
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-auto border border-[#1a1a1a] bg-[#050505]">
        <table className="w-full text-left border-collapse font-mono text-[11px] tracking-wide">
          <thead>
            <tr className="border-b border-[#1a1a1a] text-[#888] bg-[#0a0a0a]">
              <th className="p-3 font-normal w-10"></th>
              <th className="p-3 font-normal">TIMESTAMP</th>
              <th className="p-3 font-normal">SOURCE IP</th>
              <th className="p-3 font-normal">SCORE</th>
              <th className="p-3 font-normal">ACTION TAKEN</th>
              <th className="p-3 font-normal">STATUS</th>
            </tr>
          </thead>
          <tbody>
            {threats.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-10 text-center text-[#444]">_ no threats found in database</td>
              </tr>
            ) : threats.map((t) => (
              <React.Fragment key={t.id}>
                <tr 
                  className={`border-b border-[#1a1a1a] cursor-pointer hover:bg-[#111] transition-colors ${expandedRow === t.id ? 'bg-[#111]' : ''}`}
                  onClick={() => setExpandedRow(expandedRow === t.id ? null : t.id)}
                >
                  <td className="p-3 text-[#444]">
                    {expandedRow === t.id ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </td>
                  <td className="p-3 text-[#666]">{format(new Date(t.created_at), "yyyy-MM-dd HH:mm:ss")}</td>
                  <td className="p-3 text-white">{t.source_ip}</td>
                  <td className="p-3 text-[#888]">{t.confidence_score.toFixed(4)}</td>
                  <td className="p-3 text-white">{t.action_taken}</td>
                  <td className="p-3">
                    {t.resolved ? (
                      <span className="text-safe">RESOLVED</span>
                    ) : (
                      <span className="text-warn">OPEN</span>
                    )}
                  </td>
                </tr>
                {expandedRow === t.id && (
                  <tr className="border-b border-[#1a1a1a] bg-[#0a0a0a]">
                    <td colSpan={6} className="p-6">
                      <div className="pl-6 border-l border-[#333]">
                        <h4 className="text-[10px] uppercase tracking-widest text-[#555] mb-3">Agent Reasoning Engine Explanation</h4>
                        <p className="text-[#ccc] whitespace-pre-wrap leading-relaxed text-xs font-sans">
                          {t.agent_reasoning || "No explanation provided by agent."}
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
