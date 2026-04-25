"use client";

import React, { useState, useRef, useEffect } from "react";
import { Terminal, Crosshair, Zap, ShieldAlert, PlayCircle, Square, Activity } from "lucide-react";
import { format } from "date-fns";

const API_ENDPOINT = "http://localhost:8000/api/v1/logs/ingest";

type LogPayload = {
  source_ip: string;
  dest_ip: string;
  dest_port: number;
  protocol: string;
  bytes_sent: number;
  bytes_received: number;
  duration_seconds: number;
  timestamp: string;
};

export default function SimulationPage() {
  const [isRunning, setIsRunning] = useState(false);
  const [mode, setMode] = useState("mixed");
  const [attackType, setAttackType] = useState("brute_force");
  const [logsGenerated, setLogsGenerated] = useState(0);
  const [consoleOutput, setConsoleOutput] = useState<string[]>(["[SYS] Simulation Engine Ready."]);
  
  const simIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const ipPool = Array.from({length: 50}, (_, i) => `192.168.1.${i+10}`);
  const attackerIp = "185.15.54.212";

  const addConsoleLog = (msg: string) => {
    setConsoleOutput(prev => [...prev, `${format(new Date(), "HH:mm:ss.SSS")} - ${msg}`].slice(-20));
  };

  const generateNormalLog = (): LogPayload => {
    return {
      source_ip: ipPool[Math.floor(Math.random() * ipPool.length)],
      dest_ip: `10.0.0.${Math.floor(Math.random() * 20) + 1}`,
      dest_port: [80, 443, 53, 123][Math.floor(Math.random() * 4)],
      protocol: Math.random() > 0.2 ? "TCP" : "UDP",
      bytes_sent: Math.floor(Math.random() * 4900) + 100,
      bytes_received: Math.floor(Math.random() * 19500) + 500,
      duration_seconds: Math.random() * 4.9 + 0.1,
      timestamp: new Date().toISOString()
    };
  };

  const generateAttackLogs = (type: string): LogPayload[] => {
    const logs: LogPayload[] = [];
    const now = new Date().toISOString();
    
    if (type === "brute_force") {
      for (let i = 0; i < 20; i++) {
        logs.push({
          source_ip: attackerIp,
          dest_ip: "10.0.0.5",
          dest_port: 22,
          protocol: "TCP",
          bytes_sent: Math.floor(Math.random() * 20) + 40,
          bytes_received: Math.floor(Math.random() * 60) + 40,
          duration_seconds: Math.random() * 0.04 + 0.01,
          timestamp: now
        });
      }
    } else if (type === "ddos") {
      for (let i = 0; i < 50; i++) {
        logs.push({
          source_ip: `203.0.113.${Math.floor(Math.random() * 255)}`,
          dest_ip: "10.0.0.1",
          dest_port: 80,
          protocol: "TCP",
          bytes_sent: 1000,
          bytes_received: 0,
          duration_seconds: 0.01,
          timestamp: now
        });
      }
    } else if (type === "port_scan") {
      const startPort = Math.floor(Math.random() * 1000);
      for (let i = 0; i < 20; i++) {
        logs.push({
          source_ip: attackerIp,
          dest_ip: "10.0.0.10",
          dest_port: startPort + i,
          protocol: "TCP",
          bytes_sent: 0,
          bytes_received: 0,
          duration_seconds: 0.001,
          timestamp: now
        });
      }
    }
    return logs;
  };

  const tickSimulation = async () => {
    let payload: LogPayload[] = [];
    
    // Normal Traffic (approx 10-20 requests per tick)
    if (mode === "normal" || mode === "mixed") {
      const reqs = Math.floor(Math.random() * 10) + 10;
      for (let i = 0; i < reqs; i++) payload.push(generateNormalLog());
      addConsoleLog(`Generated ${reqs} normal traffic events.`);
    }

    // Attack Traffic
    if (mode === "attack_only" || (mode === "mixed" && Math.random() < 0.2)) {
      const aType = mode === "mixed" ? ["brute_force", "ddos", "port_scan"][Math.floor(Math.random() * 3)] : attackType;
      const aLogs = generateAttackLogs(aType);
      payload.push(...aLogs);
      addConsoleLog(`[WARNING] Executed ${aType.toUpperCase()} payload (${aLogs.length} events)`);
    }

    setLogsGenerated(prev => prev + payload.length);

    try {
      await fetch(API_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } catch (e) {
      addConsoleLog("[ERROR] Failed to push to Ingestion Engine. Is the backend running?");
    }
  };

  const toggleSimulation = () => {
    if (isRunning) {
      if (simIntervalRef.current) clearInterval(simIntervalRef.current);
      setIsRunning(false);
      addConsoleLog("[SYS] Simulation HALTED.");
    } else {
      addConsoleLog("[SYS] Simulation STARTED.");
      setIsRunning(true);
      // Run tick every 1000ms
      simIntervalRef.current = setInterval(tickSimulation, 1000);
    }
  };

  useEffect(() => {
    return () => {
      if (simIntervalRef.current) clearInterval(simIntervalRef.current);
    };
  }, []);

  return (
    <div className="h-full flex flex-col gap-6">
      <header className="pb-4 border-b border-[#1a1a1a]">
         <h1 className="text-2xl font-light text-white tracking-widest uppercase">War Games Control</h1>
         <p className="text-[#888] font-mono text-[10px] mt-1 tracking-widest">INTERACTIVE ATTACK SIMULATION ENGINE</p>
      </header>

      <div className="grid grid-cols-12 gap-6 flex-1 min-h-0">
        
        {/* Left Column: Controls */}
        <div className="col-span-4 border border-[#1a1a1a] bg-[#050505] p-6 flex flex-col">
          <h3 className="text-[10px] font-mono text-[#888888] uppercase tracking-widest mb-6 border-b border-[#1a1a1a] pb-2 flex items-center gap-2">
            <Crosshair size={12} /> Target Parameters
          </h3>

          <div className="space-y-6">
            <div>
              <label className="text-[10px] font-mono tracking-widest text-[#666] uppercase block mb-3">Simulation Mode</label>
              <div className="grid grid-cols-3 gap-2">
                {["normal", "mixed", "attack_only"].map(m => (
                  <button 
                    key={m} 
                    onClick={() => setMode(m)}
                    className={`py-2 text-[10px] font-mono tracking-widest uppercase border transition-colors ${
                      mode === m 
                        ? "bg-[#111] border-white text-white" 
                        : "bg-transparent border-[#1a1a1a] text-[#666] hover:border-[#333]"
                    }`}
                  >
                    {m.replace("_", " ")}
                  </button>
                ))}
              </div>
            </div>

            <div className={`transition-opacity ${mode === 'normal' ? 'opacity-30 pointer-events-none' : 'opacity-100'}`}>
              <label className="text-[10px] font-mono tracking-widest text-[#666] uppercase block mb-3">Targeted Attack Vector</label>
              <div className="grid grid-cols-1 gap-2">
                {[
                  { id: "brute_force", label: "Brute Force (Credential Stuffing)", icon: Zap },
                  { id: "ddos", label: "DDoS (Flood)", icon: Activity },
                  { id: "port_scan", label: "Port Scan (Sequential)", icon: ShieldAlert },
                ].map(a => (
                  <button 
                    key={a.id} 
                    onClick={() => setAttackType(a.id)}
                    className={`py-3 px-4 flex items-center gap-3 text-xs font-mono tracking-widest uppercase border transition-colors ${
                      attackType === a.id 
                        ? "bg-[#220a0a] border-[#ff4444] text-[#ff4444]" 
                        : "bg-transparent border-[#1a1a1a] text-[#666] hover:border-[#333]"
                    }`}
                  >
                    <a.icon size={14} /> {a.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-auto pt-6 border-t border-[#1a1a1a]">
            <button 
              onClick={toggleSimulation}
              className={`w-full py-4 flex items-center justify-center gap-3 text-xs font-mono tracking-widest uppercase border transition-colors ${
                isRunning 
                  ? "bg-[#111] border-[#ff4444] text-[#ff4444] hover:bg-[#221111]" 
                  : "bg-white border-white text-black hover:bg-[#ddd]"
              }`}
            >
              {isRunning ? (
                <><Square size={14} /> HALT SIMULATION</>
              ) : (
                <><PlayCircle size={14} /> LAUNCH ATTACK SEQUENCE</>
              )}
            </button>
          </div>
        </div>

        {/* Right Column: Console & Stats */}
        <div className="col-span-8 flex flex-col gap-6">
          
          <div className="grid grid-cols-2 gap-6">
            <div className="border border-[#1a1a1a] bg-[#050505] p-5">
              <h4 className="text-[10px] font-mono text-[#888] tracking-widest uppercase mb-2">Total Logs Generated</h4>
              <span className="text-3xl font-light text-white">{logsGenerated}</span>
            </div>
            <div className="border border-[#1a1a1a] bg-[#050505] p-5">
              <h4 className="text-[10px] font-mono text-[#888] tracking-widest uppercase mb-2">Engine Status</h4>
              <div className="flex items-center gap-2 mt-1">
                <span className={`w-2 h-2 rounded-full ${isRunning ? "bg-[#ff4444] animate-pulse shadow-glow-threat" : "bg-[#333]"}`}></span>
                <span className={`text-sm font-mono tracking-widest ${isRunning ? "text-[#ff4444]" : "text-[#666]"}`}>
                  {isRunning ? "ACTIVE" : "STANDBY"}
                </span>
              </div>
            </div>
          </div>

          <div className="border border-[#1a1a1a] bg-black p-5 flex-1 flex flex-col relative overflow-hidden">
            <h3 className="text-[10px] font-mono text-[#888888] uppercase tracking-widest mb-4 border-b border-[#1a1a1a] pb-2 flex items-center gap-2">
              <Terminal size={12} /> Execution Console
            </h3>
            <div className="flex-1 overflow-y-auto font-mono text-[11px] text-[#00ff88] space-y-1 pb-4 leading-relaxed tracking-wider">
              {consoleOutput.map((out, i) => (
                <div key={i} className={out.includes("[WARNING]") ? "text-[#ffaa00]" : out.includes("[ERROR]") ? "text-[#ff4444]" : ""}>
                  {out}
                </div>
              ))}
              {isRunning && (
                <div className="animate-pulse opacity-50">_ running</div>
              )}
            </div>
            {/* Top/Bottom Fade masks */}
            <div className="absolute top-12 left-0 right-0 h-4 bg-gradient-to-b from-black to-transparent pointer-events-none" />
            <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-black to-transparent pointer-events-none" />
          </div>

        </div>

      </div>
    </div>
  );
}
