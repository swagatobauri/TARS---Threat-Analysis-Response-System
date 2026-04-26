"use client";

import { useState, useEffect } from "react";
import useSWR from "swr";
import { 
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend 
} from "recharts";
import { Target, Zap, Activity, Clock, TrendingDown, ShieldAlert } from "lucide-react";

const API_URL = (process.env.NEXT_PUBLIC_API_URL || (typeof window !== "undefined" && window.location.hostname.includes("onrender.com") ? window.location.origin.replace("frontend", "backend") : "http://localhost:8000")).replace(/\/$/, "");
const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function MetricsPage() {
  const { data: detectionMetrics, error: detError } = useSWR(
    `${API_URL}/api/v1/metrics/detection?days=1`,
    fetcher,
    { refreshInterval: 60000 }
  );

  const { data: impactData, error: impError } = useSWR(
    `${API_URL}/api/v1/metrics/impact?days=7`,
    fetcher
  );

  const { data: shadowReport, error: shaError } = useSWR(
    `${API_URL}/api/v1/metrics/shadow`,
    fetcher
  );

  const { data: threatStats, error: thrError } = useSWR(
    `${API_URL}/api/v1/threats/stats`,
    fetcher
  );

  const [staticBaseline, setStaticBaseline] = useState<number>(12.5); // 12.5% FP rate

  if (detError || impError || shaError || thrError) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] space-y-4">
        <div className="text-[#cc0000] font-mono border border-[#cc0000]/30 bg-[#1a0505] p-6 rounded-lg max-w-md text-center">
          <ShieldAlert className="mx-auto mb-4" size={32} />
          <h3 className="text-lg font-bold mb-2 uppercase tracking-widest">Telemetry Lost</h3>
          <p className="text-sm opacity-80">
            Performance metrics and ROI calculations are currently unavailable. 
            Unable to stream data from the TARS core.
          </p>
          <div className="mt-4 pt-4 border-t border-[#cc0000]/20 text-[10px] uppercase opacity-60">
            Telemetry Node: {API_URL}
          </div>
        </div>
      </div>
    );
  }

  if (!detectionMetrics || !threatStats || !shadowReport) {
    return (
      <div className="flex items-center gap-3 text-[#888] font-mono animate-pulse p-10">
        <Activity size={18} />
        Aggregating Performance Telemetry...
      </div>
    );
  }

  // Get latest metric for top cards
  const latestMetric = detectionMetrics.length > 0 
    ? detectionMetrics[detectionMetrics.length - 1] 
    : { precision: 0, recall: 0, false_positive_rate: 0 };

  const currentFpRate = threatStats.fp_rate_last_24h * 100;
  const fpReduction = ((staticBaseline - currentFpRate) / staticBaseline) * 100;

  // Format data for charts
  const lineData = Array.isArray(detectionMetrics) ? detectionMetrics.map((m: any) => ({
    time: new Date(m.measured_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    Precision: parseFloat((m.precision * 100).toFixed(1)),
    Recall: parseFloat((m.recall * 100).toFixed(1)),
  })) : [];

  const barData = (Array.isArray(impactData) ? impactData : []).map((i: any) => ({
    date: new Date(i.measured_at).toLocaleDateString([], { month: 'short', day: 'numeric' }),
    "Blocked Requests": i.requests_blocked,
    "Cost Saved ($)": parseFloat(i.cost_saved_usd.toFixed(2)),
  }));

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      <div>
        <h1 className="text-2xl font-mono tracking-widest uppercase font-bold text-white mb-2">Metrics & Proof</h1>
        <p className="text-[#888] text-sm font-mono">Quantifiable ROI and detection efficacy of the TARS autonomous loop.</p>
      </div>

      {/* 4 Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          title="Precision" 
          value={`${(latestMetric.precision * 100).toFixed(1)}%`}
          icon={<Target className="text-green-500" />}
          subtitle="True Positive Accuracy"
        />
        <StatCard 
          title="Recall" 
          value={`${(latestMetric.recall * 100).toFixed(1)}%`}
          icon={<Activity className="text-blue-500" />}
          subtitle="Threats Caught"
        />
        <StatCard 
          title="False Positive Rate" 
          value={`${currentFpRate.toFixed(1)}%`}
          icon={<TrendingDown className="text-yellow-500" />}
          subtitle="Last 24 Hours"
        />
        <StatCard 
          title="Avg Detection Latency" 
          value={`${threatStats.avg_detection_latency_ms.toFixed(0)} ms`}
          icon={<Clock className="text-[#cc0000]" />}
          subtitle="Observe to Act"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Line Chart */}
        <div className="border border-[#1a1a1a] bg-[#0c0c0c] rounded-lg p-6 lg:col-span-2">
          <h3 className="text-sm font-mono text-[#888] uppercase mb-6">Detection Efficacy (Last 24h)</h3>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={lineData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" vertical={false} />
                <XAxis dataKey="time" stroke="#444" tick={{ fill: '#666', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis stroke="#444" tick={{ fill: '#666', fontSize: 10 }} axisLine={false} tickLine={false} domain={[0, 100]} />
                <RechartsTooltip 
                  contentStyle={{ backgroundColor: '#0a0a0a', borderColor: '#333', color: '#fff', fontSize: '12px', fontFamily: 'monospace' }}
                  itemStyle={{ fontSize: '12px', fontFamily: 'monospace' }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', fontFamily: 'monospace', color: '#888' }} />
                <Line type="monotone" dataKey="Precision" stroke="#10b981" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                <Line type="monotone" dataKey="Recall" stroke="#3b82f6" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Proof & Shadow Report Column */}
        <div className="space-y-6">
          {/* ROI Comparison */}
          <div className="border border-[#1a1a1a] bg-[#0c0c0c] rounded-lg p-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <Zap size={100} />
            </div>
            <h3 className="text-sm font-mono text-[#888] uppercase mb-6">Alert Fatigue Reduction</h3>
            
            <div className="mb-6">
              <div className="flex justify-between text-xs text-[#666] font-mono mb-2">
                <span>Static Rules Baseline FP%</span>
                <span>{staticBaseline}%</span>
              </div>
              <input 
                type="range" min="5" max="30" step="0.5" 
                value={staticBaseline} 
                onChange={(e) => setStaticBaseline(parseFloat(e.target.value))}
                className="w-full accent-[#555]"
              />
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-3xl font-mono font-bold text-green-500">-{fpReduction.toFixed(0)}%</p>
                <p className="text-xs text-[#888] font-mono mt-1">Reduction in False Positives vs Static Baseline</p>
              </div>
              <div className="pt-4 border-t border-[#1a1a1a]">
                <p className="text-xs text-[#666] font-mono leading-relaxed">
                  By replacing static thresholds with contextual anomaly scoring and kill chain awareness, TARS successfully eliminated <b>{fpReduction.toFixed(0)}%</b> of the noise that would have reached human analysts.
                </p>
              </div>
            </div>
          </div>

          {/* Shadow Report */}
          <div className="border border-[#1a1a1a] bg-[#0c0c0c] rounded-lg p-6">
            <h3 className="text-sm font-mono text-[#888] uppercase mb-4">Shadow Mode Assessment</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center bg-[#111] p-3 rounded border border-[#222]">
                <span className="text-xs text-[#888] font-mono">Total Decisions Analyzed</span>
                <span className="text-sm text-white font-mono font-bold">{shadowReport.total_shadow_decisions}</span>
              </div>
              <div className="flex justify-between items-center bg-[#111] p-3 rounded border border-[#222]">
                <span className="text-xs text-[#888] font-mono">Would Have Blocked</span>
                <span className="text-sm text-[#cc0000] font-mono font-bold">{shadowReport.would_be_blocked}</span>
              </div>
              <div className="flex justify-between items-center bg-[#111] p-3 rounded border border-[#222]">
                <span className="text-xs text-[#888] font-mono">Would Have Alerted</span>
                <span className="text-sm text-yellow-500 font-mono font-bold">{shadowReport.would_be_alerted}</span>
              </div>
              <p className="text-[10px] text-[#666] font-mono mt-2 italic text-center">
                Estimated if auto-execute was fully enabled over this period.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Business Impact Chart */}
      {barData.length > 0 && (
        <div className="border border-[#1a1a1a] bg-[#0c0c0c] rounded-lg p-6">
          <h3 className="text-sm font-mono text-[#888] uppercase mb-6">Daily Business Impact</h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" vertical={false} />
                <XAxis dataKey="date" stroke="#444" tick={{ fill: '#666', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="left" stroke="#444" tick={{ fill: '#666', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="right" orientation="right" stroke="#444" tick={{ fill: '#666', fontSize: 10 }} axisLine={false} tickLine={false} />
                <RechartsTooltip 
                  contentStyle={{ backgroundColor: '#0a0a0a', borderColor: '#333', color: '#fff', fontSize: '12px', fontFamily: 'monospace' }}
                  cursor={{ fill: '#1a1a1a' }}
                />
                <Legend wrapperStyle={{ fontSize: '12px', fontFamily: 'monospace', color: '#888' }} />
                <Bar yAxisId="left" dataKey="Blocked Requests" fill="#cc0000" radius={[2, 2, 0, 0]} />
                <Bar yAxisId="right" dataKey="Cost Saved ($)" fill="#10b981" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ title, value, icon, subtitle }: { title: string, value: string, icon: React.ReactNode, subtitle: string }) {
  return (
    <div className="border border-[#1a1a1a] bg-[#0c0c0c] rounded-lg p-5 flex items-center gap-4">
      <div className="p-3 bg-[#111] rounded-full border border-[#222]">
        {icon}
      </div>
      <div>
        <p className="text-2xl text-white font-mono font-bold">{value}</p>
        <p className="text-xs text-[#888] uppercase tracking-wider">{title}</p>
        <p className="text-[10px] text-[#555] font-mono mt-0.5">{subtitle}</p>
      </div>
    </div>
  );
}
