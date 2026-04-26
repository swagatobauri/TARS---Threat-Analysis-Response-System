"use client";

import React, { useState } from "react";
import { PlayCircle, ShieldCheck, ShieldAlert, X } from "lucide-react";

const MOCK_SCENARIOS = [
  { id: "sc_12345", ip: "192.168.1.5", type: "BRUTE_FORCE", date: "2026-04-25T14:30:00Z", action: "BLOCK" },
  { id: "sc_12346", ip: "10.0.0.99", type: "PORT_SCAN", date: "2026-04-24T09:15:00Z", action: "RATE_LIMIT" },
];

export default function ReplayPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isReplaying, setIsReplaying] = useState(false);
  const [replayResult, setReplayResult] = useState<any>(null);

  const runReplay = (id: string) => {
    setIsModalOpen(true);
    setIsReplaying(true);
    setReplayResult(null);

    // Simulate API POST /api/v1/agent/replay
    setTimeout(() => {
      setReplayResult({
        would_detect: true,
        latency_ms: 45.2,
        action_taken: "BLOCK",
        new_confidence: 0.92
      });
      setIsReplaying(false);
    }, 1500);
  };

  return (
    <div className="h-full flex flex-col gap-6 relative">
      <header className="pb-4 border-b border-[#1a1a1a]">
         <h1 className="text-2xl font-light text-white tracking-widest uppercase">Attack Replay System</h1>
         <p className="text-[#888] font-mono text-[10px] mt-1 tracking-widest">MODEL REGRESSION TESTING</p>
      </header>

      <div className="grid grid-cols-3 gap-6">
        {(MOCK_SCENARIOS || []).map((sc) => (
          <div key={sc.id} className="border border-[#1a1a1a] bg-[#050505] p-5 flex flex-col group hover:border-[#333] transition-colors">
            <div className="flex justify-between items-start mb-4">
              <span className="font-mono text-xs text-white">{sc.ip}</span>
              <span className="font-mono text-[9px] text-[#666]">{new Date(sc.date).toLocaleDateString()}</span>
            </div>
            <div className="mb-6 space-y-1">
              <div className="text-[10px] font-mono text-[#888] tracking-widest uppercase">Type: {sc.type}</div>
              <div className="text-[10px] font-mono text-[#888] tracking-widest uppercase">Original: {sc.action}</div>
            </div>
            <button 
              onClick={() => runReplay(sc.id)}
              className="mt-auto border border-[#1a1a1a] bg-[#111] hover:bg-[#222] py-2 flex items-center justify-center gap-2 text-[10px] font-mono text-white uppercase transition-colors"
            >
              <PlayCircle size={14} /> Run Replay
            </button>
          </div>
        ))}
        {MOCK_SCENARIOS.length === 0 && (
          <div className="col-span-3 text-center p-10 border border-[#1a1a1a] border-dashed text-[#444] font-mono text-xs">
            _ no attack scenarios stored yet. they are captured automatically from high+ threats.
          </div>
        )}
      </div>

      {/* Basic Replay Result Modal (Tailwind instead of Shadcn Dialog to guarantee compilation) */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="border border-[#1a1a1a] bg-[#0a0a0a] w-full max-w-lg shadow-glow">
            <div className="flex justify-between items-center p-4 border-b border-[#1a1a1a]">
              <h2 className="font-mono text-sm tracking-widest text-white uppercase">Replay Diagnostic Result</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-[#666] hover:text-white"><X size={16} /></button>
            </div>
            <div className="p-8 flex flex-col items-center justify-center min-h-[200px]">
              {isReplaying ? (
                <div className="flex flex-col items-center gap-4 animate-pulse">
                  <div className="w-8 h-8 border-2 border-[#333] border-t-[#fff] rounded-full animate-spin"></div>
                  <span className="font-mono text-[10px] text-[#888] tracking-widest uppercase">Running inference...</span>
                </div>
              ) : replayResult ? (
                <div className="w-full space-y-6">
                  <div className="flex justify-center mb-8">
                    {replayResult.would_detect ? (
                      <div className="flex flex-col items-center gap-2">
                        <ShieldCheck size={48} className="text-safe" />
                        <span className="font-mono tracking-widest text-safe text-lg">DETECTED</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2">
                        <ShieldAlert size={48} className="text-[#ff4444]" />
                        <span className="font-mono tracking-widest text-[#ff4444] text-lg">MISSED</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="space-y-3 bg-[#050505] border border-[#1a1a1a] p-4">
                    <div className="flex justify-between border-b border-[#1a1a1a] pb-2">
                      <span className="font-mono text-[10px] text-[#666] uppercase">Inference Latency</span>
                      <span className="font-mono text-xs text-white">{replayResult.latency_ms} ms</span>
                    </div>
                    <div className="flex justify-between border-b border-[#1a1a1a] pb-2">
                      <span className="font-mono text-[10px] text-[#666] uppercase">New Action Chosen</span>
                      <span className="font-mono text-xs text-white">{replayResult.action_taken}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-mono text-[10px] text-[#666] uppercase">New Confidence</span>
                      <span className="font-mono text-xs text-white">{replayResult.new_confidence.toFixed(4)}</span>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
