import LiveThreatFeed from "@/components/threats/LiveThreatFeed";
import AnomalyChart from "@/components/charts/AnomalyChart";
import { ShieldAlert, Ban, Activity, HeartPulse } from "lucide-react";

export default function Dashboard() {
  return (
    <div className="h-full flex flex-col gap-6">
      <header className="pb-4 border-b border-[#1a1a1a]">
        <h1 className="text-2xl font-light text-white tracking-widest uppercase">System Dashboard</h1>
      </header>

      {/* 4 Stat Cards */}
      <div className="grid grid-cols-4 gap-6">
        <StatCard title="Active Threats" value="3" icon={ShieldAlert} glow="text-[#ff4444]" />
        <StatCard title="Blocked IPs" value="12" icon={Ban} />
        <StatCard title="Anomalies Today" value="84" icon={Activity} />
        <StatCard title="System Status" value="ACTIVE" icon={HeartPulse} glow="text-[#00ff88]" />
      </div>

      {/* 2 Column Layout */}
      <div className="flex-1 grid grid-cols-12 gap-6 min-h-0">
        
        {/* Left: Live Threat Feed */}
        <div className="col-span-7 flex flex-col border border-[#1a1a1a] bg-[#050505] p-5">
          <h3 className="text-[10px] font-mono text-[#888888] uppercase tracking-widest mb-4 border-b border-[#1a1a1a] pb-2">
            Live Threat Feed
          </h3>
          <div className="flex-1 overflow-hidden relative">
             <LiveThreatFeed />
             {/* Fade out mask at bottom */}
             <div className="absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-[#050505] to-transparent pointer-events-none" />
          </div>
        </div>

        {/* Right: Anomaly Score Chart */}
        <div className="col-span-5 flex flex-col border border-[#1a1a1a] bg-[#050505] p-5">
          <h3 className="text-[10px] font-mono text-[#888888] uppercase tracking-widest mb-4 border-b border-[#1a1a1a] pb-2">
            Anomaly Score Chart (60m)
          </h3>
          <div className="flex-1 overflow-hidden flex items-end">
            <AnomalyChart />
          </div>
        </div>

      </div>
    </div>
  );
}

function StatCard({ title, value, icon: Icon, glow }: any) {
  return (
    <div className={`border border-[#1a1a1a] bg-[#050505] p-5 relative overflow-hidden`}>
      <div className="flex justify-between items-start mb-2">
        <h3 className="text-[10px] font-mono text-[#888] tracking-widest uppercase">{title}</h3>
        <Icon size={14} className="text-[#444]" />
      </div>
      <div className={`text-3xl font-light ${glow || "text-white"}`}>
        {value}
      </div>
    </div>
  );
}
