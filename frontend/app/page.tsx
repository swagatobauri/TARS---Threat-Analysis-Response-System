"use client";

import { motion } from "framer-motion";
import { Activity, ShieldAlert, Terminal, Globe, Server, AlertTriangle } from "lucide-react";
import { useEffect, useState } from "react";

export default function DashboardPage() {
  const [time, setTime] = useState("");

  useEffect(() => {
    // Start interval
    const timer = setInterval(() => {
      setTime(new Date().toISOString().split("T")[1].split(".")[0]);
    }, 1000);
    // Initial set
    setTime(new Date().toISOString().split("T")[1].split(".")[0]);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="h-full flex flex-col gap-6 relative">
      
      {/* VoidZero style ambient background glow */}
      <div className="absolute top-0 left-1/4 w-[800px] h-[400px] bg-white opacity-[0.02] blur-[120px] pointer-events-none z-[-1]" />

      {/* Header - Shift5 style typography */}
      <header className="flex justify-between items-end border-b border-[#1a1a1a] pb-4">
        <div>
          <h1 className="text-4xl font-light tracking-tight text-white mb-1">Operational Intelligence</h1>
          <p className="text-[#888888] font-mono text-[10px] tracking-widest uppercase">TARS // Autonomous Defense Grid</p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-mono text-white glow-text">{time} <span className="text-xs text-[#555]">UTC</span></div>
          <div className="flex items-center gap-2 justify-end mt-1">
            <span className="w-1.5 h-1.5 rounded-full bg-safe animate-pulse shadow-[0_0_8px_#00ff88]"></span>
            <span className="text-[10px] font-mono text-safe tracking-widest">SYSTEM ONLINE</span>
          </div>
        </div>
      </header>

      {/* Main Grid */}
      <div className="flex-1 grid grid-cols-12 gap-6 min-h-0">
        
        {/* Left Column: Metrics & Status (Shift5 Style) */}
        <div className="col-span-3 flex flex-col gap-4 overflow-y-auto pr-1">
          <MetricCard title="Active Threats" value="0" label="Monitoring..." color="text-safe" icon={ShieldAlert} />
          <MetricCard title="Network Load" value="24.5k" label="req/sec" color="text-white" icon={Activity} />
          
          <div className="border border-[#1a1a1a] bg-[#050505] p-5 flex-1 mt-2">
            <h3 className="text-[10px] font-mono text-[#888888] mb-6 uppercase tracking-widest flex items-center gap-2">
              <Terminal size={12} /> System Status
            </h3>
            <ul className="space-y-3 font-mono text-[10px] tracking-widest text-[#888]">
              <StatusRow num="01" label="INGESTION_ENGINE" status="NOMINAL" />
              <StatusRow num="02" label="FEATURE_EXTRACTION" status="NOMINAL" />
              <StatusRow num="03" label="ISOLATION_FOREST" status="ACTIVE" />
              <StatusRow num="04" label="ONE_CLASS_SVM" status="ACTIVE" />
              <StatusRow num="05" label="AGENT_REASONING" status="STANDBY" color="text-warn" />
              <StatusRow num="06" label="GROQ_EXPLAINER" status="READY" />
              <StatusRow num="07" label="REDIS_MEMORY" status="SYNCED" />
            </ul>

            <div className="mt-8 pt-6 border-t border-[#1a1a1a]">
               <p className="font-mono text-[9px] text-[#444] leading-relaxed">
                 01001001 00110101 00110101<br/>
                 00000100 00110101 00011101<br/>
                 10101110 00111001 10100101
               </p>
            </div>
          </div>
        </div>

        {/* Center: The Visualization (Altis / Shift5 Wireframe Style) */}
        <div className="col-span-6 border border-[#1a1a1a] bg-black relative overflow-hidden flex items-center justify-center">
          
          {/* Abstract Wireframe Sphere (Altis/Shift5 inspiration) */}
          <div className="absolute inset-0 flex items-center justify-center opacity-30">
            <motion.div 
              animate={{ rotate: 360 }}
              transition={{ duration: 150, repeat: Infinity, ease: "linear" }}
              className="w-[450px] h-[450px] relative"
            >
              {/* Concentric circles & ellipses */}
              <div className="absolute inset-0 border border-[#333] rounded-full"></div>
              <div className="absolute inset-0 border border-[#444] rounded-full transform scale-x-50"></div>
              <div className="absolute inset-0 border border-[#444] rounded-full transform rotate-45 scale-x-50"></div>
              <div className="absolute inset-0 border border-[#444] rounded-full transform -rotate-45 scale-x-50"></div>
              <div className="absolute inset-0 border border-[#444] rounded-full transform rotate-90 scale-x-50"></div>
              
              {/* Latitude lines */}
              <div className="absolute top-1/4 bottom-1/4 left-0 right-0 border border-[#333] rounded-[100%]"></div>
              <div className="absolute top-[10%] bottom-[10%] left-0 right-0 border border-[#333] rounded-[100%]"></div>
            </motion.div>
          </div>
          
          <div className="relative z-10 text-center flex flex-col items-center">
            <Globe size={32} className="mb-4 text-[#333]" strokeWidth={1} />
            <h2 className="text-lg font-light tracking-[0.2em] text-[#666] uppercase">Global Traffic</h2>
            <div className="mt-4 flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-[#333] animate-pulse"></div>
              <p className="font-mono text-[10px] tracking-widest text-[#555] uppercase">Awaiting telemetry streams</p>
            </div>
          </div>
          
          {/* Technical Corner Brackets */}
          <div className="absolute top-4 left-4 w-6 h-6 border-t border-l border-[#333]"></div>
          <div className="absolute top-4 right-4 w-6 h-6 border-t border-r border-[#333]"></div>
          <div className="absolute bottom-4 left-4 w-6 h-6 border-b border-l border-[#333]"></div>
          <div className="absolute bottom-4 right-4 w-6 h-6 border-b border-r border-[#333]"></div>
        </div>

        {/* Right Column: Live Feed (VoidZero terminal style) */}
        <div className="col-span-3 border border-[#1a1a1a] bg-[#050505] p-5 flex flex-col relative">
          <h3 className="text-[10px] font-mono text-[#888888] mb-4 uppercase tracking-widest flex items-center justify-between pb-4 border-b border-[#1a1a1a]">
            <span>Live Intelligence Feed</span>
            <Activity size={12} className="text-[#555]" />
          </h3>
          
          <div className="flex-1 flex flex-col justify-end space-y-3">
             <div className="flex gap-3 text-[#444]">
               <span className="font-mono text-[10px]">{time}</span>
               <span className="font-mono text-[10px]">[SYS] Engine initialized.</span>
             </div>
             <div className="flex gap-3 text-[#444]">
               <span className="font-mono text-[10px]">{time}</span>
               <span className="font-mono text-[10px]">[MEM] Redis timeline synced.</span>
             </div>
             <div className="flex gap-3 mt-4">
               <span className="font-mono text-[10px] text-white animate-pulse">_ listening</span>
             </div>
          </div>

          {/* VoidZero style top glow */}
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
        </div>

      </div>
    </div>
  );
}

function MetricCard({ title, value, label, color, icon: Icon }: any) {
  return (
    <div className="border border-[#1a1a1a] p-5 bg-[#050505] relative group overflow-hidden">
      <div className="flex justify-between items-start mb-3">
        <h3 className="text-[10px] font-mono text-[#888888] uppercase tracking-widest">{title}</h3>
        <Icon size={14} className="text-[#444]" />
      </div>
      <div className="flex items-baseline gap-2">
        <span className={`text-3xl font-light tracking-tight ${color}`}>{value}</span>
        <span className="text-[10px] font-mono text-[#555] uppercase tracking-wider">{label}</span>
      </div>
    </div>
  );
}

function StatusRow({ num, label, status, color = "text-white" }: any) {
  return (
    <li className="flex justify-between items-center group">
      <div className="flex gap-4 items-center">
        <span className="text-[#333]">{num}.</span>
        <span className="text-[#888]">{label}</span>
      </div>
      <div className="flex-1 border-b border-dotted border-[#222] mx-4 relative top-[4px] group-hover:border-[#444] transition-colors"></div>
      <span className={color}>{status}</span>
    </li>
  );
}
