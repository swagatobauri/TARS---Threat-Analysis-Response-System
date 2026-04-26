"use client";

import { useState } from "react";
import useSWR from "swr";
import { Check, X, Clock, ShieldAlert } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || (typeof window !== "undefined" && window.location.hostname.includes("onrender.com") ? window.location.origin.replace("frontend", "backend") : "http://localhost:8000");
const fetcher = (url: string) => fetch(url).then((res) => {
  if (!res.ok) throw new Error("API Connection Failed");
  return res.json();
});

export default function ApprovalsPage() {
  const { data: pendingApprovals, mutate, error } = useSWR(
    `${API_URL}/api/v1/safety/approvals?status=PENDING`,
    fetcher,
    { 
      refreshInterval: 5000,
      revalidateOnFocus: true,
      dedupingInterval: 2000
    }
  );
  
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const handleApprove = async (id: string) => {
    try {
      const res = await fetch(`${API_URL}/api/v1/safety/approvals/${id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewer: "SOC Analyst" })
      });
      if (res.ok) mutate();
    } catch (e) {
      console.error("Approval failed", e);
    }
  };

  const handleReject = async (id: string) => {
    try {
      const res = await fetch(`${API_URL}/api/v1/safety/approvals/${id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewer: "SOC Analyst", reason: rejectReason })
      });
      if (res.ok) {
        setRejectingId(null);
        setRejectReason("");
        mutate();
      }
    } catch (e) {
      console.error("Rejection failed", e);
    }
  };

  if (error) return (
    <div className="text-[#cc0000] font-mono border border-[#cc0000]/30 bg-[#1a0505] p-4 rounded-lg">
      <ShieldAlert className="inline mr-2" size={18} />
      Error: Could not connect to TARS Backend. Check your API URL.
    </div>
  );

  if (!pendingApprovals) return (
    <div className="flex items-center gap-3 text-[#888] font-mono animate-pulse">
      <Clock size={18} />
      Synchronizing Approval Queue...
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-mono tracking-widest uppercase font-bold text-white mb-2 flex items-center gap-3">
            Approval Queue
            {Array.isArray(pendingApprovals) && pendingApprovals.length > 0 && (
              <span className="bg-[#cc0000] text-black text-xs px-2 py-1 rounded-full">
                {pendingApprovals.length} PENDING
              </span>
            )}
          </h1>
          <p className="text-[#888] text-sm font-mono">Human-in-the-loop validation for high-impact defensive actions.</p>
        </div>
      </div>

      {!Array.isArray(pendingApprovals) || pendingApprovals.length === 0 ? (
        <div className="border border-[#1a1a1a] bg-[#0c0c0c] rounded-lg p-12 flex flex-col items-center justify-center text-center">
          <ShieldAlert size={48} className="text-[#333] mb-4" />
          <h3 className="text-lg font-mono text-white mb-2">No pending approvals</h3>
          <p className="text-[#666] text-sm">TARS is handling detections autonomously based on current safety thresholds.</p>
        </div>
      ) : (
        <div className="space-y-4">
          Array.isArray(pendingApprovals) ? pendingApprovals.map((approval: any) => {
            const isExpired = new Date(approval.expires_at) < new Date();
            const timeRemaining = Math.max(0, Math.floor((new Date(approval.expires_at).getTime() - new Date().getTime()) / 1000));
            
            return (
              <div 
                key={approval.id} 
                className={`border rounded-lg p-5 transition-colors ${
                  isExpired 
                    ? "border-[#333] bg-[#111] opacity-60" 
                    : "border-[#cc0000]/30 bg-[#1a0505]"
                }`}
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <span className={`px-2 py-0.5 text-xs font-bold font-mono rounded ${
                        approval.proposed_action === 'BLOCK' ? 'bg-[#cc0000] text-white' : 'bg-yellow-600 text-white'
                      }`}>
                        {approval.proposed_action}
                      </span>
                      <span className="text-[#aaa] font-mono text-sm border border-[#333] px-2 py-0.5 rounded">
                        Confidence: {(approval.confidence_score * 100).toFixed(1)}%
                      </span>
                      {isExpired && (
                        <span className="bg-[#333] text-[#888] text-xs font-bold font-mono px-2 py-0.5 rounded">
                          AUTO-EXPIRED
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[#666] font-mono mt-1">Threat Event ID: {approval.threat_event_id}</p>
                  </div>
                  
                  {!isExpired && (
                    <div className="flex items-center gap-2 text-yellow-500 font-mono text-sm">
                      <Clock size={16} />
                      {Math.floor(timeRemaining / 60)}:{(timeRemaining % 60).toString().padStart(2, '0')}
                    </div>
                  )}
                </div>

                <div className="bg-[#0a0a0a] border border-[#222] p-3 rounded mb-4 font-mono text-sm text-[#ddd]">
                  {approval.reasoning_summary}
                </div>

                {!isExpired && (
                  <div className="flex justify-end gap-3">
                    {rejectingId === approval.id ? (
                      <div className="flex w-full gap-2 items-center">
                        <input 
                          type="text" 
                          placeholder="Reason for rejection..."
                          value={rejectReason}
                          onChange={(e) => setRejectReason(e.target.value)}
                          className="flex-1 bg-[#0a0a0a] border border-[#cc0000] text-white px-3 py-1.5 rounded font-mono text-sm focus:outline-none"
                          autoFocus
                        />
                        <button 
                          onClick={() => handleReject(approval.id)}
                          className="bg-[#cc0000] hover:bg-[#ff0000] text-white px-4 py-1.5 rounded font-mono text-sm transition-colors flex items-center gap-2"
                        >
                          Confirm Reject
                        </button>
                        <button 
                          onClick={() => setRejectingId(null)}
                          className="text-[#888] hover:text-white px-3 font-mono text-sm"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <>
                        <button 
                          onClick={() => setRejectingId(approval.id)}
                          className="border border-[#cc0000] text-[#cc0000] hover:bg-[#cc0000]/10 px-4 py-1.5 rounded font-mono text-sm transition-colors flex items-center gap-2"
                        >
                          <X size={16} /> Reject
                        </button>
                        <button 
                          onClick={() => handleApprove(approval.id)}
                          className="bg-green-700 hover:bg-green-600 text-white px-6 py-1.5 rounded font-mono text-sm font-bold transition-colors flex items-center gap-2 shadow-[0_0_15px_rgba(21,128,61,0.4)]"
                        >
                          <Check size={16} /> APPROVE
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          }) : null
        )}
      </div>
    </div>
  );
}
