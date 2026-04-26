"use client";

import React, { useMemo } from "react";
import useSWR from "swr";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { format } from "date-fns";

const fetcher = (url: string) => fetch(url).then(res => res.json());

export default function AnomalyChart() {
  const API_URL = process.env.NEXT_PUBLIC_API_URL || (typeof window !== "undefined" && window.location.hostname.includes("onrender.com") ? window.location.origin.replace(/\/$/, "").replace("frontend", "backend") : "http://localhost:8000");
  const { data } = useSWR(`${API_URL}/api/v1/threats/stats`, fetcher, {
    refreshInterval: 30000,
  });

  // Mock historical data generation for visual if real endpoint doesn't return timeseries yet
  const chartData = useMemo(() => {
    if (data && data.timeseries) return data.timeseries;
    
    const now = new Date();
    return Array.from({ length: 60 }).map((_, i) => {
      // Create some fake spikes for testing
      const spike = (i === 45 || i === 50) ? 0.6 : 0;
      return {
        time: new Date(now.getTime() - (59 - i) * 60000).toISOString(),
        score: Math.random() * 0.3 + spike
      };
    });
  }, [data]);

  return (
    <div className="w-full h-full min-h-[300px]">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#ffffff" stopOpacity={0.08} />
              <stop offset="95%" stopColor="#ffffff" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis 
            dataKey="time" 
            tickFormatter={(tick) => format(new Date(tick), "HH:mm")}
            stroke="#333" 
            fontSize={10} 
            fontFamily="var(--font-mono)"
            tickMargin={8}
            axisLine={false}
            tickLine={false}
          />
          <YAxis 
            stroke="#333" 
            fontSize={10} 
            fontFamily="var(--font-mono)"
            domain={[0, 1]}
            tickCount={5}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: "#050505", 
              border: "1px solid #1a1a1a", 
              fontFamily: "var(--font-mono)", 
              fontSize: "12px", 
              borderRadius: "0px" 
            }}
            itemStyle={{ color: "#fff" }}
            labelFormatter={(label) => format(new Date(label), "HH:mm:ss")}
          />
          <ReferenceLine y={0.8} stroke="#ff4444" strokeDasharray="3 3" opacity={0.3} />
          <ReferenceLine y={0.6} stroke="#ffaa00" strokeDasharray="3 3" opacity={0.3} />
          <Area 
            type="monotone" 
            dataKey="score" 
            stroke="#ffffff" 
            strokeWidth={1}
            fillOpacity={1} 
            fill="url(#colorScore)" 
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
