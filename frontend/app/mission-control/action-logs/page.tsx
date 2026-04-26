"use client";

import React, { useState } from "react";
import { Download, Filter, Search } from "lucide-react";
import { format } from "date-fns";

// Mock Data
const MOCK_LOGS = Array.from({ length: 25 }).map((_, i) => ({
  id: `log-${i}`,
  time: new Date(Date.now() - i * 1500000).toISOString(),
  ip: `192.168.1.${Math.floor(Math.random() * 255)}`,
  action: ["BLOCK", "RATE_LIMIT", "ALERT", "MONITOR"][Math.floor(Math.random() * 4)],
  success: Math.random() > 0.1,
  executionTime: Math.floor(Math.random() * 50) + 10,
  error: Math.random() > 0.9 ? "Timeout connecting to firewall API" : null
}));

export default function ActionLogsPage() {
  const [logs, setLogs] = useState(MOCK_LOGS);

  const exportCSV = () => {
    const headers = ["Time", "IP", "Action", "Success", "Execution Time (ms)", "Error"];
    const csvContent = [
      headers.join(","),
      ...logs.map(l => `${l.time},${l.ip},${l.action},${l.success},${l.executionTime},"${l.error || ""}"`)
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", `tars_action_logs_${format(new Date(), "yyyyMMdd")}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="h-full flex flex-col gap-6">
      <header className="pb-4 border-b border-[#1a1a1a] flex justify-between items-end">
        <div>
           <h1 className="text-2xl font-light text-white tracking-widest uppercase">Action Logs</h1>
           <p className="text-[#888] font-mono text-[10px] mt-1 tracking-widest">SYSTEM EXECUTION HISTORY</p>
        </div>
        <div className="flex gap-4">
          <div className="border border-[#1a1a1a] bg-[#050505] px-3 py-1.5 flex items-center gap-2 text-[10px] font-mono text-[#888] uppercase">
            <Search size={12} /> Search Target
          </div>
          <button 
            onClick={exportCSV}
            className="border border-[#1a1a1a] bg-[#111] hover:bg-[#222] px-4 py-1.5 flex items-center gap-2 text-[10px] font-mono text-white uppercase transition-colors"
          >
            <Download size={12} /> Export CSV
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-auto border border-[#1a1a1a] bg-[#050505]">
        <table className="w-full text-left border-collapse font-mono text-[11px] tracking-wide">
          <thead className="sticky top-0 bg-[#0a0a0a] z-10 border-b border-[#1a1a1a]">
            <tr className="text-[#666]">
              <th className="p-4 font-normal">TIMESTAMP</th>
              <th className="p-4 font-normal">TARGET IP</th>
              <th className="p-4 font-normal">ACTION TYPE</th>
              <th className="p-4 font-normal">OUTCOME</th>
              <th className="p-4 font-normal">LATENCY</th>
              <th className="p-4 font-normal">ERROR TRACE</th>
            </tr>
          </thead>
          <tbody>
            {(logs || []).map((log) => (
              <tr 
                key={log.id} 
                className={`border-b border-[#1a1a1a] hover:bg-[#111] transition-colors ${!log.success ? 'border-l-2 border-l-[#ff4444]' : ''}`}
              >
                <td className="p-4 text-[#888]">{format(new Date(log.time), "yyyy-MM-dd HH:mm:ss")}</td>
                <td className="p-4 text-white">{log.ip}</td>
                <td className="p-4 text-[#aaa]">{log.action}</td>
                <td className="p-4">
                  {log.success 
                    ? <span className="text-[#00ff88]">SUCCESS</span> 
                    : <span className="text-[#ff4444]">FAILED</span>
                  }
                </td>
                <td className="p-4 text-[#666]">{log.executionTime}ms</td>
                <td className="p-4 text-[#888] truncate max-w-xs">{log.error || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
