"use client";

import { useState, useEffect } from "react";
import { ShieldCheck, ShieldAlert, AlertTriangle, CheckCircle, Trash2, Plus } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || (typeof window !== "undefined" && window.location.hostname.includes("onrender.com") ? window.location.origin.replace("frontend", "backend") : "http://localhost:8000");

export default function SafetyControls() {
  const [status, setStatus] = useState<any>(null);
  const [allowlist, setAllowlist] = useState<any[]>([]);
  const [baselineReport, setBaselineReport] = useState<any>(null);
  
  const [newEntry, setNewEntry] = useState({ type: "IP", value: "", label: "" });

  useEffect(() => {
    fetchStatus();
    fetchAllowlist();
    fetchBaseline();
  }, []);

  const fetchStatus = async () => {
    const res = await fetch(`${API_URL}/api/v1/safety/status`);
    if (res.ok) setStatus(await res.json());
  };

  const fetchAllowlist = async () => {
    const res = await fetch(`${API_URL}/api/v1/safety/allowlist`);
    if (res.ok) setAllowlist(await res.json());
  };

  const fetchBaseline = async () => {
    const res = await fetch(`${API_URL}/api/v1/intelligence/baseline-report`);
    if (res.ok) setBaselineReport(await res.json());
  };

  const updateMode = async (key: string, value: boolean) => {
    await fetch(`${API_URL}/api/v1/safety/mode`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [key]: value }),
    });
    fetchStatus();
  };

  const updateThreshold = async (key: string, value: number) => {
    await fetch(`${API_URL}/api/v1/safety/thresholds`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [key]: value }),
    });
    fetchStatus();
  };

  const addAllowlistEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch(`${API_URL}/api/v1/safety/allowlist`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        entry_type: newEntry.type,
        value: newEntry.value,
        label: newEntry.label,
        added_by: "Admin"
      }),
    });
    setNewEntry({ type: "IP", value: "", label: "" });
    fetchAllowlist();
  };

  const deleteAllowlistEntry = async (id: string) => {
    await fetch(`${API_URL}/api/v1/safety/allowlist/${id}`, { method: "DELETE" });
    fetchAllowlist();
  };

  if (!status) return <div className="text-white">Loading Safety Controls...</div>;

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-mono tracking-widest uppercase font-bold text-white mb-2">Safety Controls</h1>
        <p className="text-[#888] text-sm">Manage TARS autonomy limits, fallback rules, and operational boundaries.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Baseline Report Card */}
        <div className="border border-[#1a1a1a] bg-[#0c0c0c] rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-mono text-white flex items-center gap-2">
              <BarChartIcon /> Baseline Analysis
            </h2>
          </div>
          {baselineReport ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                {baselineReport.ready_to_enable ? (
                  <CheckCircle className="text-green-500" />
                ) : (
                  <AlertTriangle className="text-yellow-500" />
                )}
                <div>
                  <p className="text-sm font-bold text-white">
                    System Ready: {baselineReport.ready_to_enable ? "YES" : "NO"}
                  </p>
                  <p className="text-xs text-[#888]">{baselineReport.report.recommendation}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-[#1a1a1a]">
                <div>
                  <p className="text-xs text-[#666] uppercase">Shadow Decisions</p>
                  <p className="text-lg text-white font-mono">{baselineReport.report.total_shadow_decisions}</p>
                </div>
                <div>
                  <p className="text-xs text-[#666] uppercase">Est. False Positive Rate</p>
                  <p className="text-lg text-white font-mono">{(baselineReport.report.estimated_fp_rate * 100).toFixed(1)}%</p>
                </div>
              </div>
              {baselineReport.ready_to_enable && status.shadow_mode && (
                <button 
                  onClick={() => updateMode("shadow_mode", false)}
                  className="w-full mt-4 bg-green-900/30 text-green-500 hover:bg-green-900/50 border border-green-900 rounded py-2 text-sm font-mono tracking-widest transition-colors"
                >
                  ENABLE ACTIVE MODE
                </button>
              )}
            </div>
          ) : (
            <p className="text-[#666] text-sm">Loading baseline report...</p>
          )}
        </div>

        {/* Execution Modes */}
        <div className="border border-[#1a1a1a] bg-[#0c0c0c] rounded-lg p-6">
          <h2 className="text-lg font-mono text-white mb-6">Execution Modes</h2>
          
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-white">Shadow Mode</p>
                <p className="text-xs text-[#888]">TARS analyzes threats but executes no actions.</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  className="sr-only peer" 
                  checked={status.shadow_mode}
                  onChange={(e) => updateMode("shadow_mode", e.target.checked)}
                />
                <div className="w-11 h-6 bg-[#333] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-yellow-600"></div>
              </label>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-white">Human Approval Mode</p>
                <p className="text-xs text-[#888]">Require analyst sign-off before blocking IPs.</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  className="sr-only peer" 
                  checked={status.human_approval_mode}
                  onChange={(e) => updateMode("human_approval_mode", e.target.checked)}
                />
                <div className="w-11 h-6 bg-[#333] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
          </div>
        </div>

        {/* Confidence Thresholds */}
        <div className="border border-[#1a1a1a] bg-[#0c0c0c] rounded-lg p-6">
          <h2 className="text-lg font-mono text-white mb-6">Confidence Thresholds</h2>
          
          <div className="space-y-6">
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm text-white font-mono">Auto-Execute (Block)</span>
                <span className="text-sm text-[#cc0000] font-mono">{status.high_confidence_threshold.toFixed(2)}</span>
              </div>
              <input 
                type="range" 
                min="0.5" max="1.0" step="0.01" 
                value={status.high_confidence_threshold}
                onChange={(e) => updateThreshold("high_confidence", parseFloat(e.target.value))}
                className="w-full accent-[#cc0000]"
              />
            </div>

            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm text-white font-mono">Alert-Only</span>
                <span className="text-sm text-yellow-500 font-mono">{status.medium_confidence_threshold.toFixed(2)}</span>
              </div>
              <input 
                type="range" 
                min="0.3" max="0.8" step="0.01" 
                value={status.medium_confidence_threshold}
                onChange={(e) => updateThreshold("medium_confidence", parseFloat(e.target.value))}
                className="w-full accent-yellow-500"
              />
            </div>
          </div>
        </div>

        {/* Auto Rollback */}
        <div className="border border-[#1a1a1a] bg-[#0c0c0c] rounded-lg p-6">
          <h2 className="text-lg font-mono text-white mb-6">Auto-Rollback Rules</h2>
          <div>
            <p className="text-sm text-white mb-2">Unblock IPs after (minutes):</p>
            <div className="flex gap-4 items-center">
              <input 
                type="number" 
                value={status.auto_rollback_minutes}
                onChange={(e) => {
                  // Assuming endpoint supports this, if not this is a mock update locally
                  setStatus({...status, auto_rollback_minutes: parseInt(e.target.value)})
                }}
                className="bg-[#111] border border-[#333] text-white px-3 py-2 rounded focus:outline-none focus:border-[#cc0000] w-24 font-mono"
              />
              <span className="text-xs text-[#888]">(0 = Permanent Block)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Allowlist Manager */}
      <div className="border border-[#1a1a1a] bg-[#0c0c0c] rounded-lg p-6">
        <h2 className="text-lg font-mono text-white mb-6">Trusted Allowlist</h2>
        
        <form onSubmit={addAllowlistEntry} className="flex gap-4 mb-6">
          <select 
            value={newEntry.type}
            onChange={(e) => setNewEntry({...newEntry, type: e.target.value})}
            className="bg-[#111] border border-[#333] text-white px-3 py-2 rounded focus:outline-none focus:border-[#cc0000]"
          >
            <option>IP</option>
            <option>CIDR</option>
          </select>
          <input 
            type="text" 
            placeholder="Value (e.g. 192.168.1.5)"
            value={newEntry.value}
            onChange={(e) => setNewEntry({...newEntry, value: e.target.value})}
            required
            className="flex-1 bg-[#111] border border-[#333] text-white px-3 py-2 rounded focus:outline-none focus:border-[#cc0000] font-mono"
          />
          <input 
            type="text" 
            placeholder="Label (e.g. Office VPN)"
            value={newEntry.label}
            onChange={(e) => setNewEntry({...newEntry, label: e.target.value})}
            className="flex-1 bg-[#111] border border-[#333] text-white px-3 py-2 rounded focus:outline-none focus:border-[#cc0000] font-mono"
          />
          <button type="submit" className="bg-[#111] border border-[#333] text-white hover:bg-[#222] px-4 py-2 rounded flex items-center gap-2 transition-colors">
            <Plus size={16} /> Add
          </button>
        </form>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#333] text-xs font-mono text-[#666] uppercase tracking-wider">
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Value</th>
                <th className="py-3 px-4">Label</th>
                <th className="py-3 px-4">Added By</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {allowlist.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-[#666] font-mono text-sm">
                    No entries in the allowlist.
                  </td>
                </tr>
              ) : (
                (allowlist || []).map((entry) => (
                  <tr key={entry.id} className="border-b border-[#222] hover:bg-[#111] transition-colors">
                    <td className="py-3 px-4 text-sm text-[#aaa] font-mono">{entry.entry_type}</td>
                    <td className="py-3 px-4 text-sm text-white font-mono">{entry.value}</td>
                    <td className="py-3 px-4 text-sm text-[#aaa]">{entry.label || "-"}</td>
                    <td className="py-3 px-4 text-sm text-[#666]">{entry.added_by}</td>
                    <td className="py-3 px-4 text-right">
                      <button onClick={() => deleteAllowlistEntry(entry.id)} className="text-[#666] hover:text-[#cc0000] transition-colors">
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function BarChartIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="20" x2="12" y2="10"></line><line x1="18" y1="20" x2="18" y2="4"></line><line x1="6" y1="20" x2="6" y2="16"></line></svg>
  );
}
